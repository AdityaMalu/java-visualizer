/* 5.13a Circuit breaker, timeouts, retries */
topic('5', { no:'5.13a', title:'Circuit breaker, timeouts, retries', idea:`The pricing service starts failing. Watch the breaker count failures, trip OPEN, fail fast, probe in HALF_OPEN, and close again.`,
actors:'Calls', stateTitle:'Sliding window (last 10 calls)', dgTitle:'Circuit breaker states',
vb:'0 0 520 190',
nodes:{CL:{x:80,y:60,label:'CLOSED',w:110}, OP:{x:440,y:60,label:'OPEN',w:110}, HO:{x:260,y:150,label:'HALF_OPEN',w:120}},
edges:[['CL','OP','failure rate ≥ 50%'],['OP','HO','after 30 s'],['HO','CL','trial calls ok'],['HO','OP','trial fails']],
codes:{a:`@CircuitBreaker(name = "pricing", fallbackMethod = "cachedPrice")
@Retry(name = "pricing")
@TimeLimiter(name = "pricing")                 // timeout: 800 ms
public CompletableFuture<Price> price(long carId) { /* HTTP call */ }

Price cachedPrice(long carId, Throwable t) {   // fallback
  return cache.getOrDefault(carId, Price.unknown());
}
# resilience4j.circuitbreaker.instances.pricing:
#   sliding-window-size: 10
#   failure-rate-threshold: 50
#   wait-duration-in-open-state: 30s
#   permitted-number-of-calls-in-half-open-state: 3`},
steps:[
{hl:{cb:[1,4]}, th:[['calls','flowing:ok','']], d:{type:'graph',on:['CL']}, g:[G('Sliding window (last 10 calls)',C('',[['ok','ok'],['ok','ok'],['ok','ok'],['ok','ok'],['ok','ok'],['ok','ok']]),['failure rate','0%'])],
 say:`<b>CLOSED</b> = normal: calls pass through and the breaker records each outcome in a sliding window (the last 10 calls here).`},
{hl:{cb:[3]}, th:[['calls','timeouts:bad','pricing p99 → 5 s']], g:[G('Sliding window (last 10 calls)',C('',[['ok','ok'],['ok','ok'],['ok','ok'],['ok','ok'],['ok','ok'],['T/O','bad'],['T/O','bad'],['T/O','bad'],['T/O','bad']]),['failure rate','44%','hot'])], log:['timeout after 800 ms ×4 → fallback cachedPrice()'],
 say:`Pricing slows down. The <b>TimeLimiter</b> cuts each call at 800 ms, so our threads aren't stuck for 5 s (4.13: without timeouts every pool thread would end up waiting on pricing). Each timeout counts as a failure and returns the fallback.`},
{th:[['calls','tripped:bad','']], d:{type:'graph',on:['OP'],e:[['CL','OP','50% ≥ threshold','bad']]}, g:[G('Sliding window (last 10 calls)',C('',[['ok','ok'],['ok','ok'],['ok','ok'],['ok','ok'],['ok','ok'],['T/O','bad'],['T/O','bad'],['T/O','bad'],['T/O','bad'],['T/O','bad']]),['failure rate','50% → OPEN','bad'])], log:['CircuitBreaker \'pricing\' changed state from CLOSED to OPEN'],
 say:`The failure rate hits the 50% threshold, so the breaker trips <b>OPEN</b>.`},
{th:[['calls','fail fast:warn','no network call']], d:{type:'graph',on:['OP']}, log:['CallNotPermittedException → fallback in 0.1 ms (×1,200 calls)'],
 say:`While <b>OPEN</b>, calls are rejected <b>immediately</b> (<code>CallNotPermittedException</code> → fallback) without touching the network. Users get cached prices fast, our threads stay free, and the struggling pricing service gets breathing room instead of a retry storm. This is how you stop <b>cascading failure</b>.`},
{th:[['calls','probing:info','3 trial calls']], d:{type:'graph',on:['HO'],e:[['OP','HO','30 s elapsed','hot']]}, g:[G('Half-open trials',C('',[['ok','ok'],['ok','ok'],['ok','ok']]))],
 say:`After 30 s the breaker goes <b>HALF_OPEN</b> and lets a few <b>trial</b> calls through. One trial failure sends it back to OPEN for another wait.`},
{th:[['calls','flowing:ok','']], d:{type:'graph',on:['CL'],e:[['HO','CL','3/3 ok','ok']]}, log:['CircuitBreaker \'pricing\' changed state from HALF_OPEN to CLOSED'],
 say:`Trials succeeded, so the breaker is <b>CLOSED</b> again with a fresh window. The whole cycle happened without a deploy or a page to on-call.`},
{hl:{cb:[2]}, th:[], d:null, g:[G('Layering (outer → inner)',['Retry','retries the whole thing'],['CircuitBreaker','counts each attempt'],['TimeLimiter','bounds each attempt'],['Bulkhead','limits concurrent calls (Semaphore, 4.11)']), G('Retry rules',['only idempotent calls','GET, or POST with idempotency key (5.13c)','ok'],['backoff + jitter','200 ms, 400 ms, 800 ms ± random','ok'],['retry budget','≤ 10% extra load'],['never retry','4xx client errors','bad'])],
 say:`An SDE-2 answer combines them: <b>timeout</b> every remote call, <b>retry</b> a little with backoff and jitter (only idempotent operations), <b>circuit-break</b> on sustained failure, isolate with a <b>bulkhead</b>, and always have a <b>fallback</b> (cached or default data, or graceful degradation).`}
],
keep:[`CLOSED (count) → OPEN (fail fast) → HALF_OPEN (probe) → CLOSED or back to OPEN.`,`Timeouts on every remote call; breaker stops cascading failures and retry storms.`,`Retry only idempotent calls, with backoff + jitter; add bulkhead + fallback.`]}, {
  imp: 'must',
  theory: TH(`When a downstream service is slow or failing, timeouts stop you waiting forever, retries handle brief glitches, and a circuit breaker stops calling it for a while so failures don't cascade.`,
`<p>In microservices, your service calls others over the network, and they <i>will</i> sometimes be slow or down. Without protection, your threads pile up waiting, and you go down too: a <b>cascading failure</b>.</p>
<p>A <b>circuit breaker</b> works like the one in your house. While calls succeed it's <b>CLOSED</b> (current flows). If too many fail, it trips <b>OPEN</b> and fails calls immediately without trying, giving the other service time to recover. After a wait it goes <b>HALF_OPEN</b> and lets a few test calls through; if they succeed, it closes again.</p>`,
[[`Timeout`,`Maximum time to wait for a call.`],[`Retry with backoff`,`Try again after increasing, randomised delays.`],[`Circuit breaker`,`Stops calls to a failing dependency for a while.`],[`Fallback`,`What to return when the call can't be made (cached value, default).`],[`Bulkhead`,`Limits concurrent calls to one dependency.`]],
[`Every remote call gets a timeout.`,`A few retries with backoff and jitter, only for idempotent calls.`,`The breaker tracks failures in a sliding window and trips at a threshold.`,`While OPEN, return the fallback immediately; probe in HALF_OPEN.`],
[`Resilience4j with Spring Boot annotations (@CircuitBreaker, @Retry, @TimeLimiter, @Bulkhead).`,`Monitor breaker state changes; they're early warnings.`],
[`Retries at every layer, multiplying load.`,`No timeouts (some HTTP clients wait forever by default).`]),
  quiz: [
    [`Pricing is down and the caller has no timeouts or breaker. Typical result?`,[`Threads pile up waiting, and the caller fails too`,`Nothing: the HTTP client gives up after a second`,`It falls back to a cached value automatically`,`It fails fast with a clear error message`],0,`Default HTTP timeouts are often infinite or very long: cascading failure.`,'E'],
    [`What is HALF_OPEN for?`,[`Letting all traffic through again`,`Blocking traffic until a restart`,`Resetting the failure metrics`,`Testing recovery with a few calls`],3,`Success closes the breaker; failure re-opens it.`,'M'],
    [`Why add jitter to retry backoff?`,[`To make retry tests deterministic`,`To lower average latency`,`So clients don't all retry at once`,`Because the HTTP spec requires it`],2,`Synchronised retries cause retry storms.`,'H'],
    [`Circuit breaker states?`,[`ON / OFF`,`CLOSED, OPEN, HALF_OPEN`,`READY / BUSY`,`NEW / DONE`],1,`CLOSED = normal.`,'E'],
    [`What happens to calls when the breaker is OPEN?`,[`They wait in a queue until the breaker moves back to CLOSED`,`They fail fast (or use a fallback) without calling the service`,`They're retried with backoff until the service responds again`,`They pass through, but failures are no longer counted`],1,`Gives the dependency time to recover.`,'E'],
    [`Which calls are safe to retry?`,[`Any call that failed with a 4xx client error`,`Idempotent ones (or protected by an idempotency key)`,`Only POST calls, since they create new resources`,`Any call, as long as backoff is configured`],1,`Retrying a charge can double-charge.`,'M'],
    [`What's a fallback?`,[`A second attempt of the same call after a short backoff delay`,`An alternative response when the call fails (cache, default, degraded)`,`A timeout that cancels the call when the service is too slow`,`A breaker state where a few trial calls are let through`],1,`Graceful degradation.`,'E'],
    [`Why must every remote call have a timeout?`,[`HTTP clients reject requests that don't declare a timeout`,`Without one, threads can wait forever and the caller collapses`,`Timeouts make retries idempotent, so duplicates are avoided`,`Load balancers drop connections that have no client timeout set`],1,`Timeouts come first.`,'M'],
  ],
  quizAdv: [
    [`Three service layers, and each retries 3 times. Calls reaching the bottom service per user request at worst?`,[`27 calls`,`3 calls`,`9 calls`,`1 call`],0,`Retry amplification. Retry at one layer, with budgets.`,'H'],
    [`What is a bulkhead for?`,[`Retrying failed calls`,`Caching responses`,`Encrypting traffic`,`Capping concurrency`],3,`One slow dependency can't use up every thread.`,'M'],
    [`What is a bulkhead?`,[`A retry policy that spaces attempts out to protect a dependency`,`Separate threads or permits per dependency so one can't exhaust all`,`A breaker state that blocks calls after a failure threshold`,`A rate limiter shared by all dependencies in one global pool`],1,`Like ship compartments.`,'M'],
    [`Sliding window by count vs time in Resilience4j?`,[`Count-based opens after N failures in a row; time-based after N seconds down`,`Count-based uses the last N calls; time-based uses calls in the last N seconds`,`Time-based uses the last N calls; count-based uses calls in the last N seconds`,`Count-based resets every N calls; time-based ignores slow calls entirely`],1,`Pick what matches traffic patterns.`,'H'],
  ],
});
