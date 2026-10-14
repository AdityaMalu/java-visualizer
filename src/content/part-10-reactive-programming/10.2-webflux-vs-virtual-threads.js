/* 10.2 WebFlux vs virtual threads */
topic('10', { no:'10.2', title:'WebFlux vs virtual threads', imp:'good', idea:`Two ways to serve thousands of concurrent requests that mostly wait on I/O. Watch one blocking call freeze a WebFlux event loop, then see the same endpoint as plain blocking code on virtual threads.`,
actors:'Threads', stateTitle:'Server', logTitle:'Events',
codes:{a:`@GetMapping("/orders/{id}")
Mono<OrderView> order(@PathVariable long id) {
  return orderRepo.findById(id)                       // R2DBC: non-blocking
      .zipWith(priceClient.price(id))                 // WebClient: non-blocking
      .map(t -> OrderView.of(t.getT1(), t.getT2()));
}

@GetMapping("/reports/{id}")
Mono<Report> report(@PathVariable long id) {
  return Mono.just(jdbcTemplate.queryForObject(SQL, mapper, id));  // BLOCKS!
}`,
b:`# application.properties
spring.threads.virtual.enabled=true

@GetMapping("/orders/{id}")
OrderView order(@PathVariable long id) {
  Order o = orderRepo.findById(id).orElseThrow();     // plain blocking JDBC
  Price p = priceClient.price(id);                    // plain blocking HTTP
  return OrderView.of(o, p);                          // own virtual thread per request
}`},
steps:[
{th:[['tomcat-1','WAITING','waiting on DB'],['tomcat-2','WAITING','waiting on HTTP'],['…','WAITING:warn','200 threads, all waiting'],['request 201','BLOCKED:bad','queued']], g:[G('Classic thread-per-request',['threads','200 (each ~1 MB stack)'],['work per request','5 ms CPU, 200 ms waiting'],['limit','~200 concurrent requests','bad'])],
 say:`The classic model gives each request a platform thread, and the thread <b>waits</b> during database and HTTP calls. With 200 threads you serve at most 200 requests at once, even though the CPU is mostly idle. There are two modern answers: <b>reactive (WebFlux)</b> and <b>virtual threads</b>.`},
{hl:{loop:[1,2,3,4,5]}, th:[['loop-1','RUN:ok','handles requests 1, 5, 9 …'],['loop-2','RUN:ok','handles requests 2, 6, 10 …'],['loop-3','RUN:ok',''],['loop-4','RUN:ok','']], g:[G('WebFlux (Netty event loop)',['threads','4 (one per core)'],['while I/O is pending','thread moves on to other requests','ok'],['concurrent requests','thousands','ok'])],
 say:`<b>WebFlux</b> runs on a few <b>event-loop</b> threads, one per core. A handler returns a Mono describing the work; the database (R2DBC) and HTTP (WebClient) calls are non-blocking, so while they're pending the thread serves other requests. <code>zipWith</code> runs both calls concurrently and combines the results.`},
{hl:{loop:[8,9,10]}, th:[['loop-1','BLOCKED:bad','stuck in JDBC call (2 s)'],['loop-2','RUN:ok',''],['loop-3','RUN:ok',''],['loop-4','RUN:ok','']], g:[G('One blocking call',['JDBC on loop-1','blocks the thread for 2 s','bad'],['other requests on loop-1','frozen too','bad'],['capacity lost','25% of the whole server','bad'])], log:['p99 latency on all endpoints: 40 ms → 2,100 ms'],
 say:`<b>The classic WebFlux bug.</b> <code>Mono.just(jdbcTemplate…)</code> runs the blocking JDBC call <b>on the event loop</b>, right away. That thread can't serve anyone else for 2 seconds: with 4 loops, one slow report freezes a quarter of the server. Wrap blocking calls with <code>Mono.fromCallable(…).subscribeOn(Schedulers.boundedElastic())</code>, or avoid them; tools like BlockHound detect them in tests.`},
{cv:'b', hl:{vt:[2,5,6,7,8]}, logReset:true, log:['10,000 concurrent requests on 4 carrier threads; p99 latency 45 ms'], th:[['vt-1','WAITING:ok','JDBC (unmounted, carrier free)'],['vt-2','WAITING:ok','HTTP (unmounted)'],['vt-…','RUN:ok','10,000 virtual threads'],['carriers','RUN:ok','4 OS threads']], g:[G('Spring MVC + virtual threads',['threads','one virtual thread per request (cheap)'],['blocking call','unmounts; carrier serves others (4.17)','ok'],['code style','plain, sequential, debuggable','ok'])],
 say:`With <b>virtual threads</b> (Java 21+, one property in Spring Boot 3.2+), you keep ordinary Spring MVC code. Each request gets its own virtual thread; when it blocks on JDBC or HTTP, it unmounts and the carrier thread serves others. You get similar scalability for I/O-bound services with plain blocking code and normal stack traces.`},
{th:[], g:[G('WebFlux (reactive)',['model','async streams, non-blocking end to end'],['strengths','streaming, backpressure, SSE/WebSockets, gateways'],['costs','learning curve, harder debugging, reactive drivers everywhere','bad']), G('MVC + virtual threads',['model','blocking code, cheap threads'],['strengths','simple code, existing JDBC/JPA libraries','ok'],['watch out for','pinning (pre-24), unbounded load on the DB: use pools/semaphores'])],
 say:`Both solve "too many threads waiting on I/O". Reactive also gives backpressure and streaming, but requires non-blocking drivers everywhere and a different style. Virtual threads keep familiar code and libraries; you still need to limit load on scarce resources like DB connections.`},
{th:[], g:[G('Choosing',['typical CRUD / business service','MVC + virtual threads','ok'],['streaming data, backpressure, many long-lived connections','WebFlux'],['already reactive (gateway, R2DBC stack)','stay reactive'],['CPU-bound work','neither helps: add cores'])],
 say:`<b>Say it:</b> "WebFlux uses a few event-loop threads and non-blocking I/O, so one blocking call can freeze many requests. Virtual threads let ordinary blocking Spring MVC code scale similarly for I/O-bound work. For most new CRUD services I'd use MVC with virtual threads; I'd pick WebFlux for streaming, backpressure or an already reactive stack."`}
],
keep:[`Thread-per-request with platform threads caps concurrency at the pool size.`,`WebFlux: few event-loop threads, non-blocking end to end; never block the loop (use boundedElastic or avoid).`,`Virtual threads: blocking code scales for I/O; default choice for most CRUD services on Java 21+.`]}, {
  imp: 'good',
  theory: TH(`WebFlux scales with a few event-loop threads and non-blocking I/O; virtual threads scale ordinary blocking code by making threads cheap. Both target I/O-bound services.`,
`<p>A typical web request spends most of its time waiting for a database or another service. With one platform thread per request, the number of threads limits how many requests you can serve, even though the CPU is idle.</p>
<p><b>WebFlux</b> removes the waiting: handlers return Monos, and I/O is non-blocking, so a handful of event-loop threads juggle thousands of requests. But a single blocking call on an event loop stalls everything on that thread. <b>Virtual threads</b> (Java 21) take the opposite route: keep blocking code, but make each thread so cheap that you can have one per request and the JVM parks it during I/O.</p>`,
[[`Event loop`,`A thread that processes many connections' events, never blocking.`],[`R2DBC`,`Reactive (non-blocking) database driver API.`],[`boundedElastic`,`Reactor scheduler for wrapping blocking calls.`],[`Virtual thread`,`Cheap JVM-managed thread that unmounts while blocked.`],[`BlockHound`,`Tool that detects blocking calls on non-blocking threads.`]],
[`Reactive: request → handler returns a Mono → non-blocking calls → response when the Mono completes.`,`Virtual threads: request → its own virtual thread → blocking calls park it → response.`,`Either way, limit pressure on scarce resources (connection pools, rate limits).`],
[`Default choice for new CRUD services on Java 21+: Spring MVC + virtual threads.`,`Choose WebFlux for streaming, SSE/WebSockets, gateways and backpressure-heavy pipelines.`],
[`Mixing blocking JDBC into WebFlux handlers.`,`Expecting either approach to speed up CPU-bound work.`]),
  quiz: [
    [`How many event-loop threads does WebFlux typically use?`,[`One per request`,`200, like Tomcat`,`Unlimited`,`About one per CPU core`],3,`Few threads, never blocking.`,'E'],
    [`A WebFlux handler calls blocking JDBC directly. Effect?`,[`It blocks an event-loop thread, stalling every request on it`,`WebFlux detects it and offloads it to another thread pool`,`The app fails at startup when JDBC is on the classpath`,`Nothing: R2DBC wraps the JDBC driver as non-blocking`],0,`Wrap with subscribeOn(boundedElastic) or use R2DBC.`,'M'],
    [`For a typical new CRUD service on Java 21, the simplest scalable choice is usually?`,[`WebFlux with R2DBC everywhere`,`Bigger Tomcat thread pool (2,000 threads)`,`Spring MVC with virtual threads enabled`,`A single-threaded server`],2,`Plain blocking code that scales for I/O-bound work.`,'H'],
    [`What is an event loop?`,[`A loop that polls the database for new rows`,`A thread that handles many connections' events without blocking`,`A thread pool that gives each connection a thread`,`A GC phase that reclaims short-lived objects`],1,`Netty powers WebFlux.`,'E'],
    [`Non-blocking database access for WebFlux?`,[`JDBC`,`R2DBC`,`JPA`,`JdbcTemplate`],1,`JDBC is blocking.`,'E'],
    [`Which Spring property enables virtual threads in MVC?`,[`spring.mvc.virtual-threads=true`,`spring.threads.virtual.enabled=true`,`server.tomcat.threads.virtual=on`,`spring.task.execution.virtual=true`],1,`Java 21+, Boot 3.2+.`,'M'],
    [`Who benefits from virtual threads most?`,[`CPU-heavy number crunching`,`I/O-heavy request handling`,`GC tuning`,`Startup time`],1,`Waiting is cheap.`,'E'],
    [`Detect blocking calls in reactive code during tests?`,[`jstack`,`BlockHound`,`JFR only`,`EXPLAIN`],1,`Fails tests that block event loops.`,'M'],
  ],
  quizAdv: [
    [`How do you safely call a blocking API from WebFlux?`,[`Call block() on the event loop so the result is ready`,`Mono.fromCallable(...).publishOn(Schedulers.parallel())`,`Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())`,`Wrap it in Mono.just(...) so the call becomes lazy`],2,`Mono.just evaluates eagerly on the current (event-loop) thread.`,'H'],
    [`What do virtual threads NOT give you that reactive streams do?`,[`High concurrency for I/O-bound work`,`Simple sequential, blocking-style code`,`Normal stack traces through your code`,`Built-in backpressure between producer and consumer`],3,`You'd add bounded queues or semaphores yourself.`,'H'],
    [`Why can a reactive stack trace be hard to read?`,[`Reactor strips all user frames to keep traces short for performance reasons`,`Work hops threads and operators, so the stack shows framework frames, not your call chain`,`Operators run in a separate JVM, so the trace stops at the network boundary`,`Errors are wrapped in a Mono, so the trace only shows the outermost operator`],1,`Use checkpoint() or Reactor debug tooling.`,'M'],
    [`Server-Sent Events streaming 10,000 updates per second to clients: which fits better?`,[`Blocking MVC with platform threads`,`WebFlux with Flux and backpressure`,`JDBC`,`@Scheduled`],1,`Streaming is reactive's strength.`,'H'],
  ],
});
