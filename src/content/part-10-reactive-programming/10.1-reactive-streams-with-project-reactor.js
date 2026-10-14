/* 10.1 Reactive streams with Project Reactor */
topic('10', { no:'10.1', title:'Reactive streams with Project Reactor', imp:'extra', idea:`Mono and Flux are lazy, asynchronous streams that push values to a subscriber. Follow signals (onNext, onError, onComplete), operators, a non-blocking HTTP call with timeout and fallback, and backpressure.`,
actors:'Threads', stateTitle:'Signals', logTitle:'Console',
codes:{a:`Flux<Order> orders = orderRepo.findByCustomer(42)   // nothing happens yet
    .filter(Order::isPaid)
    .map(o -> o.withTax(0.19))
    .take(10);

orders.subscribe(
    o   -> System.out.println("got " + o.id()),      // onNext
    err -> log.error("failed", err),                // onError
    ()  -> System.out.println("done"));             // onComplete

Mono<Price> price = webClient.get().uri("/price/{id}", 7)
    .retrieve().bodyToMono(Price.class)
    .timeout(Duration.ofSeconds(2))
    .onErrorReturn(Price.UNKNOWN);

Flux.range(1, 1_000_000)
    .publishOn(Schedulers.parallel())
    .subscribe(new SlowSubscriber());               // requests 32 at a time`},
steps:[
{hl:{main:[1,2,3,4]}, th:[['main','RUN','built a pipeline']], g:[G('Types',['Mono<T>','0 or 1 value, then complete (or error)'],['Flux<T>','0 … N values, then complete (or error)']), G('State',['database query sent?','no: nothing subscribed yet','hot'])],
 say:`<b>Reactive</b> code describes a pipeline of values that arrive <i>over time</i>, asynchronously. Project Reactor (used by Spring WebFlux) has two types: <b>Mono</b> for zero or one value, <b>Flux</b> for many. Like Java streams (2.13), building the pipeline does <b>nothing</b>: no query runs until someone subscribes.`},
{hl:{main:[6,7,8,9]}, th:[['main','TERM','returned immediately'],['db-io','RUN:ok','rows arriving']], g:[G('Signals to the subscriber',C('onNext',[['order 1001'],['order 1007'],['order 1012','hot']]),['onComplete / onError','exactly one, at the end'])], log:['got 1001','got 1007','got 1012'],
 say:`<code>subscribe</code> starts the flow. Values are <b>pushed</b> to the subscriber as <code>onNext</code> signals, on whatever thread produced them, while the calling thread has already moved on. The stream ends with exactly one terminal signal: <code>onComplete</code> or <code>onError</code>.`},
{hl:{main:[2,3,4]}, th:[['db-io','RUN:ok','']], g:[G('Operators',['filter','drops unpaid orders'],['map','transforms each order'],['take(10)','after 10 items: cancel upstream','ok'])], log:['done'],
 say:`Operators transform the stream, just like stream operations. <code>take(10)</code> is special: after the 10th item it <b>cancels</b> the upstream, so the database stops sending rows. Errors travel downstream as a signal instead of being thrown up a call stack.`},
{hl:{main:[11,12,13,14]}, th:[['netty','RUN:ok','HTTP request in flight, no thread blocked']], g:[G('Non-blocking call',['while waiting','no thread is blocked','ok'],['timeout(2 s)','emits TimeoutException as onError'],['onErrorReturn','replaces any error with a fallback value','ok'])],
 say:`A <b>WebClient</b> call returns a Mono immediately. While the HTTP response is pending, <b>no thread waits</b>: the network layer (Netty) will push the result when it arrives. <code>timeout</code> and <code>onErrorReturn</code> add resilience declaratively (compare with 5.13a).`},
{hl:{main:[16,17,18]}, th:[['producer','RUN:ok','emits only what was requested'],['parallel-1','RUN:warn','slow subscriber']], g:[G('Backpressure',['subscriber requests','32'],['producer emits','≤ 32, then waits for the next request','ok'],['without it','a fast producer floods memory','bad'])],
 say:`<b>Backpressure</b>: the subscriber says how many items it can handle (<code>request(n)</code>), and the producer never sends more. A slow consumer can't be overwhelmed by a fast producer. Strategies like <code>onBackpressureBuffer</code> or <code>onBackpressureDrop</code> handle producers that can't slow down.`},
{hl:{main:[17]}, th:[['producer','RUN:ok',''],['parallel-1','RUN:ok','']], g:[G('Schedulers',['publishOn(s)','downstream operators run on s'],['subscribeOn(s)','the subscription (source) runs on s'],['Schedulers.parallel()','CPU work, one thread per core'],['Schedulers.boundedElastic()','for wrapping blocking calls'])],
 say:`Reactor doesn't create threads per request; operators run on whichever thread delivers the signal, and <b>Schedulers</b> let you move work: <code>publishOn</code> for what follows, <code>subscribeOn</code> for the source. Stack traces span threads, which is why reactive code is harder to debug (Reactor offers checkpoint() and debug agents).`},
{th:[], g:[G('Reactive in one line each',['lazy','nothing runs until subscribe'],['push','values arrive as signals'],['non-blocking','threads never wait for I/O'],['backpressure','consumers control the rate'])],
 say:`<b>Say it:</b> "Reactor's Mono and Flux are lazy, asynchronous streams. Nothing happens until subscription; values are pushed as onNext, ending in onComplete or onError. I/O is non-blocking, so a few threads handle many concurrent requests, and backpressure lets consumers control the rate. The cost is a different programming model that's harder to read and debug."`}
],
keep:[`Mono = 0..1, Flux = 0..N; lazy until subscribe; signals onNext*, then onComplete | onError.`,`Non-blocking I/O: threads never wait; errors are signals (timeout, onErrorReturn, retry).`,`Backpressure: subscriber requests n; publishOn/subscribeOn move work between schedulers.`]}, {
  imp: 'good',
  theory: TH(`Reactive programming models data as asynchronous streams that are pushed to subscribers; Reactor's Mono and Flux are lazy, non-blocking and support backpressure.`,
`<p>In ordinary code you <i>call</i> a method and <i>wait</i> for its result. In reactive code you describe what should happen to values <i>when they arrive</i>, and the framework pushes them to you as they become available, without any thread sitting and waiting for I/O.</p>
<p><b>Project Reactor</b> provides <b>Mono</b> (at most one value) and <b>Flux</b> (many values). You chain operators (map, filter, flatMap, zip, timeout, retry), then <b>subscribe</b>. The subscriber also controls how fast data comes, through <b>backpressure</b>.</p>`,
[[`Publisher / Subscriber`,`Source of values / consumer of values (Reactive Streams spec).`],[`Mono / Flux`,`0..1 / 0..N asynchronous values.`],[`Signal`,`onNext (a value), onError, onComplete.`],[`Operator`,`A step that transforms the stream.`],[`Backpressure`,`The subscriber requests only as many items as it can handle.`],[`Scheduler`,`The thread pool operators run on.`]],
[`Build a pipeline from a source and operators (nothing runs yet).`,`subscribe() starts it; the subscriber requests n items.`,`The source pushes up to n onNext signals, then waits for more requests.`,`It ends with onComplete or onError; cancellation stops it early.`],
[`Used by Spring WebFlux, WebClient, R2DBC, reactive Kafka and Redis clients.`,`flatMap for async calls per item; zip to combine results; timeout/retry/onErrorResume for resilience.`],
[`Calling block() inside reactive code.`,`Forgetting to subscribe (nothing happens).`,`Blocking calls on event-loop threads.`]),
  quiz: [
    [`You build a Flux pipeline but never call subscribe. What happens?`,[`It runs once eagerly when the Flux is assembled`,`Nothing: reactive pipelines are lazy`,`It runs on a background scheduler by default`,`An IllegalStateException is thrown at assembly`],1,`Like streams, nothing happens until there's a subscriber.`,'E'],
    [`How many terminal signals can a Flux emit?`,[`At most one: onComplete or onError`,`One onComplete per item`,`Any number of onError`,`Both onComplete and onError`],0,`onNext* then a single terminal signal (or none if infinite/cancelled).`,'M'],
    [`What is backpressure?`,[`The publisher retrying failed items with growing delays`,`The server compressing large responses to save bandwidth`,`The subscriber limiting how many items the publisher may send`,`The scheduler throttling threads when CPU usage is high`],2,`Via request(n) in the Reactive Streams protocol.`,'H'],
    [`Mono emits how many values at most?`,[`Many`,`One`,`Zero always`,`Two`],1,`Flux emits many.`,'E'],
    [`What starts a Reactor pipeline?`,[`Creating it`,`Subscribing to it`,`Calling map`,`Logging it`],1,`Lazy until subscribe.`,'E'],
    [`What does <code>block()</code> do on a Mono?`,[`Subscribes asynchronously and returns the Mono itself`,`Waits for and returns the value, blocking the current thread`,`Cancels the Mono if it hasn't emitted within a timeout`,`Waits for the value, but only on the event loop thread`],1,`Avoid it on event-loop threads.`,'M'],
    [`Combine two Monos' results when both complete?`,[`flatMap`,`zip / zipWith`,`take`,`filter`],1,`Runs them concurrently.`,'M'],
    [`Recover from an error with another publisher?`,[`onErrorResume`,`map`,`doOnNext`,`subscribe`],0,`onErrorReturn for a plain value.`,'M'],
  ],
  quizAdv: [
    [`<code>map</code> vs <code>flatMap</code> in Reactor?`,[`map is for Mono and flatMap is for Flux; otherwise they behave identically`,`map transforms synchronously; flatMap maps each item to a Publisher (async call) and merges the results`,`map runs each transform on a new thread; flatMap keeps work on the caller's`,`flatMap flattens nested lists into items; map can only return one Publisher`],1,`flatMap may interleave results; concatMap keeps order.`,'H'],
    [`Where do operators run if you use no publishOn/subscribeOn?`,[`On the thread that emits the signal`,`Always on the main thread`,`On a new thread per operator`,`On the common ForkJoinPool`],0,`Reactor is concurrency-agnostic; schedulers move work explicitly.`,'M'],
    [`concatMap vs flatMap?`,[`They're the same, but concatMap subscribes to all inner publishers eagerly`,`concatMap preserves order and runs inner publishers one at a time; flatMap may interleave`,`flatMap preserves order and runs one at a time; concatMap may interleave`,`concatMap is always faster because it runs all inner publishers in parallel`],1,`Choose by whether order matters.`,'H'],
    [`What does <code>Flux.interval(Duration.ofSeconds(1))</code> run on?`,[`The caller's thread that subscribed`,`Schedulers.parallel() by default`,`Schedulers.boundedElastic() by default`,`A new platform thread for each tick`],1,`Time-based operators use the parallel scheduler.`,'H'],
  ],
});
