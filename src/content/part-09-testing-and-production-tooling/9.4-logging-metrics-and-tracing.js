/* 9.4 Logging, metrics and tracing */
topic('9', { no:'9.4', title:'Logging, metrics and tracing', imp:'good', idea:`The three pillars of observability in a Spring service: well-formed logs with context, metrics with sane tags, and distributed traces that follow one request across services.`,
actors:'Request', stateTitle:'Signals emitted', logTitle:'Log output (JSON lines)',
codes:{a:`private static final Logger log = LoggerFactory.getLogger(OrderService.class);

public Order place(Cart cart) {
  MDC.put("orderId", cart.id());                         // added to every log line
  log.info("Placing order with {} items", cart.size());  // {} = lazy formatting
  try {
    Order o = repository.save(Order.from(cart));
    meterRegistry.counter("orders.placed", "country", cart.country()).increment();
    return o;
  } catch (DataAccessException e) {
    log.error("Could not save order", e);                // exception as the last argument
    throw e;
  } finally {
    MDC.remove("orderId");
  }
}`},
steps:[
{hl:{req:[1]}, th:[['req','RUN','POST /orders']], g:[G('Three pillars',['logs','what happened, in detail (events)'],['metrics','how much / how fast, aggregated (numbers over time)'],['traces','where the time went across services (one request)'])],
 say:`<b>Observability</b> means you can understand what a running system is doing from the outside. Logs tell you <i>what happened</i>, metrics tell you <i>how much and how fast</i>, traces tell you <i>where a request spent its time</i> across services. You need all three during an incident.`},
{hl:{req:[1]}, g:[G('SLF4J',['your code uses','the SLF4J API (a facade)'],['implementation','Logback (Spring Boot default) or Log4j2'],['levels','ERROR > WARN > INFO > DEBUG > TRACE'],['production level','INFO (DEBUG per package when needed)'])],
 say:`Code logs through <b>SLF4J</b>, a facade, and an implementation (Logback by default in Boot) writes the output. You choose levels per package in config, so you can turn on DEBUG for one package in production without redeploying (via Actuator's loggers endpoint).`},
{hl:{req:[4,5]}, g:[G('MDC (per thread)',['traceId','4bf92f3577b34da6','hot'],['orderId','ord-981','hot'])], log:['{"level":"INFO","msg":"Placing order with 3 items","orderId":"ord-981","traceId":"4bf92f3577b34da6"}'],
 say:`<b>MDC</b> (Mapped Diagnostic Context) holds key-values for the current thread (a ThreadLocal, 4.12) that are added to every log line, so you can filter all logs of one order or one request. The <code>{}</code> placeholder formats lazily: if INFO is off, the message string is never built.`},
{hl:{req:[8]}, g:[G('Metrics (Micrometer)',['orders.placed{country="DE"}','counter +1','ok'],['http.server.requests','timer: count, p50/p95/p99 latency (automatic)'],['tag cardinality','country: ~50 values ✔ · userId: millions ✘','bad'])],
 say:`<b>Micrometer</b> records numbers that a monitoring system (Prometheus + Grafana) graphs and alerts on. Counters, timers and gauges, with <b>tags</b> to slice them. Keep tag values bounded: tagging by user id creates millions of time series and can take down your metrics backend.`},
{hl:{req:[10,11,12]}, th:[['req','RUN:bad','DB error']], g:[G('Logging exceptions',['log.error("…", e)','message + full stack trace','ok'],['log.error("… " + e)','only e.toString(): stack trace lost','bad'],['log and rethrow at every layer','same error logged 4 times','bad'])], log:['{"level":"ERROR","msg":"Could not save order","orderId":"ord-981","traceId":"4bf92f3577b34da6","stack_trace":"org.springframework.dao…"}'],
 say:`Pass the exception as the <b>last argument</b> so the stack trace is logged. Log it <b>once</b>, where it's handled (often a central @ControllerAdvice); logging and rethrowing at every layer floods the logs with duplicates.`},
{hl:{req:[13,14]}, th:[['req','TERM','response sent']], g:[G('MDC cleanup',['MDC.remove in finally','next request on this pooled thread starts clean','ok'],['async work','copy MDC explicitly (TaskDecorator)'])],
 say:`Remove MDC entries in <code>finally</code>: request threads are pooled, and a stale orderId would appear in the next request's logs (the ThreadLocal leak from 4.12).`},
{th:[], g:[G('Distributed trace (one request)',['api-gateway','12 ms'],['order-service','180 ms'],['  ├ postgres INSERT','25 ms'],['  └ payment-service','140 ms','hot'],['traceId','propagated in the traceparent header','ok'])],
 say:`A <b>trace</b> follows one request through every service. Each step is a <b>span</b> with timing; the <b>trace id</b> travels in HTTP/Kafka headers (W3C <code>traceparent</code>). With Micrometer Tracing / OpenTelemetry, Spring Boot creates spans automatically and puts traceId in the MDC, linking logs to traces.`},
{th:[], g:[G('Rules',['structured JSON logs','searchable in ELK / Loki','ok'],['never log','passwords, tokens, card numbers, personal data','bad'],['alert on','symptoms users feel: error rate, latency (SLOs)','ok'],['health','/actuator/health liveness & readiness'])],
 say:`<b>Say it:</b> "I log with SLF4J at sensible levels, structured JSON with MDC context like traceId; exceptions logged once with stack traces; no secrets or personal data. Metrics via Micrometer with bounded tags, alerting on error rate and latency. Distributed tracing with OpenTelemetry so a slow request can be followed across services."`}
],
keep:[`Logs (what), metrics (how much/fast), traces (where across services).`,`SLF4J with {} placeholders; MDC for context (cleared in finally); exception as last arg; log once; no secrets.`,`Micrometer metrics with bounded tags; traceId propagated via headers; JSON logs linked to traces.`]}, {
  imp: 'good',
  theory: TH(`Observability means understanding a running system from its outputs: logs record events, metrics measure rates and latencies, and traces follow single requests across services.`,
`<p>In production you can't attach a debugger. You learn what's happening from the signals the application emits. <b>Logs</b> are timestamped event records. <b>Metrics</b> are numbers aggregated over time (requests per second, error rate, p99 latency) that you graph and alert on. <b>Traces</b> connect the work one request did across many services, with timings.</p>
<p>In Java, code logs via <b>SLF4J</b> (with Logback underneath), metrics go through <b>Micrometer</b>, and traces through <b>OpenTelemetry</b> / Micrometer Tracing. Spring Boot wires them together, including putting the trace id into every log line.</p>`,
[[`Log level`,`ERROR, WARN, INFO, DEBUG, TRACE.`],[`MDC`,`Per-thread key-values added to log lines.`],[`Counter / timer / gauge`,`Metric types: count, duration distribution, current value.`],[`Cardinality`,`Number of distinct tag values; keep it bounded.`],[`Span / trace`,`One timed operation / all spans of one request.`],[`SLO`,`Service-level objective, e.g. 99.9% of requests under 300 ms.`]],
[`Emit structured logs with context (traceId, ids).`,`Record metrics for key operations and expose them (/actuator/prometheus).`,`Propagate trace context across HTTP and messaging.`,`Build dashboards and alerts on what users feel: errors and latency.`],
[`One log line per meaningful event, not per loop iteration.`,`Correlate logs and traces with the trace id.`,`Use DEBUG temporarily, via Actuator's loggers endpoint.`],
[`String concatenation in log calls.`,`Logging secrets or personal data.`,`High-cardinality metric tags (user ids, URLs with ids).`]),
  quiz: [
    [`Why write <code>log.info("Order {} placed", id)</code> instead of <code>"Order " + id + " placed"</code>?`,[`SLF4J rejects string concatenation at compile time`,`Placeholders make the call thread-safe without locks`,`The id is masked in the output if it's sensitive`,`The message is only formatted if INFO is enabled`],3,`Placeholders avoid building strings for disabled levels.`,'E'],
    [`What's wrong with tagging a metric by userId?`,[`Tag values must be numeric, so ids are rejected`,`Unbounded cardinality creates millions of time series`,`Micrometer drops tags with more than 32 values`,`User ids leak into traces and break sampling`],1,`Keep tag values to a small, bounded set.`,'M'],
    [`How does one request's trace id reach the next service?`,[`Through a shared database table`,`In the JWT payload`,`It's propagated in request headers (e.g. traceparent)`,`Through MDC, which is shared between services`],2,`MDC is per thread, per process; headers carry context across the network.`,'H'],
    [`Which log level is typical in production?`,[`TRACE`,`DEBUG`,`INFO`,`OFF`],2,`DEBUG temporarily, when investigating.`,'E'],
    [`Which library is the logging facade most Java code uses?`,[`Log4j 1`,`SLF4J`,`System.out`,`JUL only`],1,`Logback or Log4j2 implement it.`,'E'],
    [`Which metric type measures request durations and percentiles?`,[`Counter`,`Timer`,`Gauge`,`Tag`],1,`Counters only count.`,'M'],
    [`What is a trace id?`,[`The id of the thread that handled the request`,`An id shared by all spans of one request across services`,`An id unique to each span within a service`,`An id the client sends to dedupe retries`],1,`Propagated in headers.`,'E'],
    [`Why is structured (JSON) logging useful?`,[`Log files are much smaller than plain text`,`Fields are searchable and filterable in log tools`,`Writes are faster since nothing is formatted`,`SLF4J needs JSON to attach MDC values`],1,`e.g. filter by orderId.`,'M'],
  ],
  quizAdv: [
    [`A service layer, controller and advice each log the same exception with stack trace. Problem?`,[`None: logging at every layer makes debugging safer`,`Only the controller's log is kept; the rest are dropped`,`Logging an exception three times changes the HTTP status`,`One error appears 3 times, hiding real counts and flooding logs`],3,`Log once, where it's handled.`,'M'],
    [`MDC values show up on the wrong requests' logs. Likely cause?`,[`MDC isn't cleared in finally, and pooled threads keep old values`,`MDC is a global map shared by every thread in the JVM`,`Logback copies MDC to all threads in the pool by design`,`The log pattern prints %X before the request id is set`],0,`It's ThreadLocal-based (4.12).`,'H'],
    [`What is an SLO?`,[`A service-level obligation, e.g. a refund if uptime drops`,`A service-level objective, e.g. 99.9% of requests under 300 ms`,`A service log output setting, e.g. JSON at INFO level`,`A system latency objective set per JVM, e.g. GC under 300 ms`],1,`Alert when you're burning the error budget.`,'H'],
    [`Why sample traces instead of recording 100%?`,[`Full tracing breaks the ordering of spans across services`,`Volume and cost; keep enough to diagnose (often all errors plus a sample)`,`Sampling keeps trace ids unique across services`,`Tracing every request makes span timestamps inaccurate`],1,`Tail-based sampling keeps interesting ones.`,'H'],
  ],
});
