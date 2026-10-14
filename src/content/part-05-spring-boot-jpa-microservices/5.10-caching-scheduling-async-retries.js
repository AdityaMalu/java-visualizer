/* 5.10 Caching, scheduling, async, retries */
topic('5', { no:'5.10', title:'Caching, scheduling, async, retries', idea:`@Cacheable miss then hit then evict; a nightly job on 3 pods with ShedLock; @Async on your own executor; @Retryable backoff timing.`,
actors:'Actors', stateTitle:'State',
codes:{a:`@Cacheable(cacheNames = "cars", key = "#id")
public CarDto get(long id) { return load(id); }       // 2nd call: method not run
@CacheEvict(cacheNames = "cars", key = "#id")
public void update(long id, CarDto d) { /* ... */ }

@Scheduled(cron = "0 0 2 * * *")                      // 02:00 every day
@SchedulerLock(name = "nightlyReport", lockAtMostFor = "PT30M")   // ShedLock
public void nightlyReport() { /* ... */ }

@Async("ioExecutor") public CompletableFuture<Void> sendMail(Mail m) { /* ... */ }

@Retryable(retryFor = TimeoutException.class, maxAttempts = 3,
           backoff = @Backoff(delay = 200, multiplier = 2))
public Quote fetchQuote() { /* ... */ }`},
steps:[
{hl:{cache:[1,2]}, th:[['get(7)','miss:warn','method runs']], g:[G('cache "cars" (Caffeine / Redis)',['7','CarDto(7) stored','hot'])], log:['load(7): SELECT … 35 ms'],
 say:`<code>@Cacheable</code> is a proxy (5.3): it computes the key (<code>#id</code>), checks the cache, and on a <b>miss</b> runs the method and stores the result.`},
{th:[['get(7)','hit:ok','method NOT run']], log:['get(7): 0.05 ms from cache'],
 say:`On a <b>hit</b>, the proxy returns the cached value and your method body never runs, so any logging or side effects inside it won't happen either.`},
{hl:{cache:[3,4]}, th:[['update(7)','evict:info','']], g:[G('cache "cars"',['7','evicted','bad'])],
 say:`<code>@CacheEvict</code> removes the entry on update (or <code>@CachePut</code> refreshes it). Distributed concerns: with a local cache like Caffeine, <b>each pod</b> has its own copy, so evictions don't propagate. Use Redis or short TTLs. Always set size and TTL limits (1.4 leaks).`},
{hl:{sched:[6,7,8]}, th:[['pod-1','RUN:ok','acquired lock → runs'],['pod-2','RUN:dim','lock held → skip'],['pod-3','RUN:dim','lock held → skip']], g:[G('shedlock table',['name','nightlyReport'],['locked_by','pod-1','hot'],['lock_until','02:30'])], log:['02:00 pod-1: running nightlyReport','02:00 pod-2: skipped (locked)','02:00 pod-3: skipped (locked)'],
 say:`<code>@Scheduled</code> runs in <b>every</b> instance. Three pods would send the report three times. <b>ShedLock</b> does an atomic insert/update on a lock row (a conditional UPDATE, like 3.7e), and only the winner runs. <code>lockAtMostFor</code> frees the lock if that pod dies. Note that scheduled tasks share a single thread by default, so configure a scheduler pool.`},
{hl:{async:[10]}, th:[['http-nio-1','RUN:ok','returns immediately'],['io-3','RUN:ok','sendMail()']], g:[G('@Async',['runs on','"ioExecutor" (your bounded ThreadPoolTaskExecutor)','ok'],['exceptions (void methods)','go to AsyncUncaughtExceptionHandler','bad'],['ThreadLocals (MDC, security)','not propagated: use a TaskDecorator','bad'],['self-invocation','not async (proxy!)','bad'])],
 say:`<code>@Async</code> moves the call onto an executor through a proxy. Always name a <b>bounded</b> executor (4.13). Return a <code>CompletableFuture</code> if callers need the result or the error. MDC trace ids and security context don't follow automatically (4.12).`},
{hl:{retry:[12,13,14]}, th:[['fetchQuote','retrying:warn','']], g:[G('attempts',['#1 at 0 ms','TimeoutException','bad'],['#2 at +200 ms','TimeoutException','bad'],['#3 at +400 ms','✔ success','ok'])], log:['attempt 1 failed','wait 200 ms','attempt 2 failed','wait 400 ms','attempt 3 ok'],
 say:`<code>@Retryable</code> with <b>exponential backoff</b>. Add <b>jitter</b> (<code>random = true</code>) so a thousand clients don't retry in lockstep. Retry <b>only idempotent</b> operations (5.13c), only on transient errors (timeouts, 503), never on 400s, and put a circuit breaker around repeated failures (5.13a).`},
{th:[], g:[G('Events',['ApplicationEventPublisher','in-process observer (3.7f)'],['@EventListener','synchronous by default'],['@TransactionalEventListener','after commit'])],
 say:`All of these features are <b>proxies plus infrastructure</b>. The same two questions catch most bugs: "is this call crossing a proxy?" and "which thread or executor does this run on?".`}
],
keep:[`@Cacheable: hit skips the method; local caches are per pod; set TTL/size.`,`@Scheduled runs on every pod → ShedLock (DB lock row) for run-once.`,`@Async: bounded executor, CompletableFuture, no ThreadLocal propagation. @Retryable: backoff + jitter, idempotent only.`]}, {
  imp: 'good',
  theory: TH(`Spring adds common production features with annotations: caching results, running scheduled jobs, running methods asynchronously, and retrying failures.`,
`<ul><li><b>@Cacheable</b>: the first call runs the method and stores the result; later calls with the same arguments return it from the cache.</li><li><b>@Scheduled</b>: runs a method on a timer or cron expression.</li><li><b>@Async</b>: runs the method on another thread and returns immediately.</li><li><b>@Retryable</b> (Spring Retry): re-runs a failed call with backoff.</li></ul>
<p>All are implemented with proxies, so they share the proxy rules (5.3), and each has a multi-instance pitfall once you run several pods.</p>`,
[[`Cache provider`,`Caffeine (in-memory, per pod) or Redis (shared).`],[`TTL`,`Time-to-live before a cache entry expires.`],[`Distributed lock`,`A lock shared by all pods (e.g. ShedLock).`],[`Backoff + jitter`,`Growing, randomised delays between retries.`]],
[`Enable features with @EnableCaching / @EnableScheduling / @EnableAsync.`,`Annotate methods; configure a cache provider and executors.`,`Set TTLs and sizes for caches; bounded executors for @Async.`,`Make retried operations idempotent.`],
[`A @Scheduled job runs on every pod; use ShedLock if it must run once.`,`Local caches differ per pod; choose short TTLs or a shared cache.`],
[`@Async with the default executor and no error handling.`,`Retrying non-idempotent operations like payments without an idempotency key.`]),
  quiz: [
    [`@Cacheable with local Caffeine caches on 3 pods. Pod A updates a price. Pods B and C serve?`,[`The new price immediately`,`An error until they reload`,`Nothing: the entry is evicted everywhere`,`Possibly the stale price until TTL or eviction`],3,`Local caches are per pod. Use a short TTL, a shared cache or invalidation messages.`,'E'],
    [`A <code>@Scheduled</code> nightly billing job, 4 pods. What happens, and the fix?`,[`Runs once: Spring coordinates pods`,`Runs 4 times: use ShedLock or similar`,`Runs only on the leader pod`,`Doesn't run in Kubernetes`],1,`Scheduling is per JVM.`,'M'],
    [`<code>@Retryable</code> on a "charge card" call with no idempotency key. Risk?`,[`None: retries only happen after a failure`,`Slower startup while retry proxies are built`,`Double charge if the first attempt actually succeeded`,`Cache misses on the payment client`],2,`A timeout is an unknown outcome. Only retry idempotent operations, with backoff and jitter.`,'H'],
    [`What does <code>@Cacheable("cars")</code> do on a cache hit?`,[`Runs the method and refreshes the cached value`,`Returns the cached value without running the method`,`Runs the method, then compares it to the cache`,`Returns the cached value, then refreshes it async`],1,`On a miss it runs and stores.`,'E'],
    [`Which annotation removes a cache entry?`,[`@CachePut`,`@CacheEvict`,`@Cacheable`,`@Caching`],1,`@CachePut always runs and updates.`,'M'],
    [`What enables @Scheduled?`,[`Nothing`,`@EnableScheduling`,`@Async`,`@EnableCaching`],1,`Then use fixedRate, fixedDelay or cron.`,'E'],
    [`fixedRate vs fixedDelay?`,[`fixedDelay: start every N ms; fixedRate: N ms after the last run ends`,`fixedRate: start every N ms; fixedDelay: N ms after the last run ends`,`fixedRate: N ms after the last run ends; fixedDelay: once after N ms`,`fixedDelay waits N ms before the first run; fixedRate starts at once`],1,`Default scheduler is single-threaded.`,'M'],
    [`What does @Async return for a value?`,[`The value, computed on another thread`,`A CompletableFuture (or void)`,`An Optional filled in later`,`A Thread you can join()`],1,`Configure a bounded executor.`,'M'],
  ],
  quizAdv: [
    [`Two concurrent requests miss <code>@Cacheable</code> for the same key. What happens?`,[`Only one runs the method`,`Both may run it`,`The second waits`,`The second throws`],1,`sync = true coalesces loads per key (supported by Caffeine).`,'H'],
    [`<code>@Scheduled(fixedRate = 1000)</code>, but the task takes 3 s. Default scheduler?`,[`Three runs overlap`,`Missed runs are dropped`,`Runs queue back to back`,`It throws`],2,`The default scheduler has one thread, so runs queue up.`,'H'],
    [`Cache stampede with @Cacheable: Spring option?`,[`@CachePut on the method so every caller refreshes the value first`,`@Cacheable(sync = true) so only one caller computes per key in this JVM`,`@Cacheable(sync = true) so one caller computes per key across the cluster`,`@Async on the method so callers don't block while it computes`],1,`See 6.5 for cross-pod approaches.`,'H'],
    [`Retry with exponential backoff and jitter: why jitter?`,[`To make each retry wait longer than the last`,`To avoid many clients retrying in sync`,`To cap the total time spent on retries`,`To vary the request payload between retries`],1,`Spring Retry and Resilience4j support it.`,'M'],
  ],
});
