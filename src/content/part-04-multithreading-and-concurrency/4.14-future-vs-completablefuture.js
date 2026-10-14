/* 4.14 Future vs CompletableFuture */
topic('4', { no:'4.14', title:'Future vs CompletableFuture', idea:`Load a car page from a price service (300 ms) and an inspection service (500 ms). Sequential blocking vs a non-blocking pipeline.`,
codes:{a:`Future<Price> f = pool.submit(() -> pricing.get(id));     // 300ms
Price p = f.get();                // main blocks here
Report r = pool.submit(() -> inspection.get(id)).get();   // 500ms
return new CarPage(p, r);         // total ≈ 800ms`,
b:`var p = CompletableFuture.supplyAsync(() -> pricing.get(id), io)      // 300ms
          .completeOnTimeout(Price.unknown(), 800, MILLISECONDS);
var r = CompletableFuture.supplyAsync(() -> inspection.get(id), io)   // 500ms
          .exceptionally(ex -> Report.unavailable());
var page = p.thenCombine(r, CarPage::new)     // when BOTH done
            .thenApply(this::render);
return page.join();                           // ≈ 500ms total`},
steps:[
{cv:'a', hl:{main:[1],io1:[1]}, th:[['main','RUN','t = 0 ms'],['io1','RUN','pricing.get()']], g:[G('Timeline (ms)',C('io1',[['price 0–300','hot']]),C('io2',[['—','dim']]))],
 say:`<b>Plain Future.</b> Submit the price call at t = 0.`},
{hl:{main:[2]}, th:[['main','WAITING','f.get() blocks until 300'],['io1','RUN','']],
 say:`We need the price, so we call <code>get()</code> and main <b>blocks</b>. We also forgot to start the inspection call first. With plain Futures that's easy to do, and even when you do start both, you still block a thread waiting.`},
{hl:{main:[3],io2:[3]}, th:[['main','WAITING','get() again, until 800'],['io1','WAITING','idle'],['io2','RUN','inspection.get()']], g:[G('Timeline (ms)',C('io1',['price 0–300']),C('io2',[['inspection 300–800','hot']]))],
 say:`Only now does the inspection call start. Main blocks again.`},
{hl:{main:[4]}, th:[['main','RUN','t = 800 ms'],['io1','WAITING',''],['io2','WAITING','']], log:['page ready after ≈ 800 ms (sum)'], g:[G('Timeline (ms)',C('io1',['price 0–300']),C('io2',['inspection 300–800']),['total','800 ms','bad'])],
 say:`Total = <b>sum</b> of the calls. Future has no callbacks, no chaining, no combining, and no error handling except a try/catch around <code>get()</code>.`},
{cv:'b', logReset:true, hl:{main:[1,2,3,4,5,6],io1:[1],io2:[3]}, th:[['main','RUN','pipeline built at t = 0'],['io1','RUN','pricing.get()'],['io2','RUN','inspection.get()']], g:[G('Timeline (ms)',C('io1',[['price 0–300','hot']]),C('io2',[['inspection 0–500','hot']])), G('Futures',['p','PENDING'],['r','PENDING'],['page','PENDING'])],
 say:`<b>CompletableFuture.</b> Both calls start immediately on our own <code>io</code> pool. Lines 5–6 don't run anything yet. They <b>register callbacks</b> to run when results arrive. Main isn't blocked while building the pipeline.`},
{th:[['main','WAITING','join()'],['io1','WAITING','free for other work'],['io2','RUN','']], g:[G('Timeline (ms)',C('io1',['price 0–300']),C('io2',['inspection 0–500'])), G('Futures',['p','DONE Price(₹6.2L)','ok'],['r','PENDING'],['page','PENDING (needs r)'])], log:['t=300 p completed'],
 say:`t = 300: price done. <code>thenCombine</code> needs <b>both</b>, so nothing fires yet. io1 is already free to serve other requests.`},
{hl:{io2:[5,6]}, th:[['main','RUN','join() returns'],['io1','WAITING',''],['io2','RUN','ran thenCombine + thenApply']], g:[G('Timeline (ms)',C('io1',['price 0–300']),C('io2',['inspection 0–500']),['total','≈ 500 ms','ok']), G('Futures',['p','DONE','ok'],['r','DONE Report(ok)','ok'],['page','DONE (rendered)','ok'])], log:['t=500 r completed → combine → render','page ready after ≈ 500 ms (slowest call)'],
 say:`t = 500: inspection done. The callback runs <b>on the thread that completed the last input</b> (io2), combines, renders, and <code>join()</code> returns. Total ≈ <b>the slowest call</b>, not the sum.`},
{hl:{io2:[3,4]}, th:[['main','RUN',''],['io1','WAITING',''],['io2','TERM','threw TimeoutException']], g:[G('Futures',['r','exceptionally → Report.unavailable()','hot'],['page','DONE with partial data','ok'])], log:['inspection failed → fallback used, page still renders'],
 say:`<b>Failure path.</b> If inspection throws, the exception moves down the chain until a handler catches it. <code>exceptionally</code> swaps in a fallback, so the page shows "report unavailable" instead of an error 500. <code>completeOnTimeout</code> handles a slow pricing service the same way.`},
{g:[G('Cheat sheet',['thenApply','transform result (map)'],['thenCompose','chain another async call (flatMap)'],['thenCombine','merge two futures (zip)'],['thenAccept / thenRun','consume / side effect'],['exceptionally / handle','recover from errors'],['allOf / anyOf','wait for all / first'],['orTimeout / completeOnTimeout','fail / default after a delay'])],
 say:`<b>Gotcha:</b> without the executor argument, <code>supplyAsync</code> runs on <code>ForkJoinPool.commonPool()</code>, which has only (cores − 1) threads and is shared by the whole JVM, including parallel streams. Blocking I/O there starves everything else. Always pass your own pool for I/O. Use <code>thenCompose</code>, not <code>thenApply</code>, when the next step itself returns a future, or you'll get <code>CF&lt;CF&lt;T&gt;&gt;</code>.`}
],
keep:[`Future: get() blocks, no chaining. CompletableFuture: callbacks, combine, error recovery.`,`Fan-out then combine → total ≈ slowest call.`,`Pass your own executor for blocking I/O.`]}, {
  imp: 'must',
  theory: TH(`A Future is a placeholder for a result that isn't ready yet; CompletableFuture adds the ability to chain, combine and recover without blocking.`,
`<p>When you start an asynchronous task you get a <b>Future</b>: an IOU for the result. A plain Future only offers <code>get()</code>, which blocks until the result arrives.</p>
<p><b>CompletableFuture</b> lets you describe what to do <i>when</i> the result arrives: <code>thenApply</code> (transform), <code>thenCompose</code> (start another async step), <code>thenCombine</code> (join two results), <code>exceptionally</code> (fallback on error). You can fire off several independent calls at once and combine them, so the total time is roughly that of the slowest call.</p>`,
[[`supplyAsync`,`Start an async task that returns a value.`],[`thenApply / thenCompose`,`Transform a result / chain another async call.`],[`thenCombine / allOf`,`Combine two / wait for many futures.`],[`exceptionally / handle`,`Recover from errors.`],[`orTimeout`,`Fail the future if it doesn't complete in time.`]],
[`Start independent calls with supplyAsync(…, ioExecutor).`,`Combine them (thenCombine / allOf).`,`Add timeouts and fallbacks.`,`Only at the very edge, join() to get the value (or return the future to the framework).`],
[`Fan-out to several services for one page, then combine.`,`Always pass your own executor for blocking calls; the default common pool is small and shared.`],
[`Calling get()/join() inside tasks running on the same pool (starvation, 6.3).`,`Forgetting that orTimeout doesn't stop the underlying work.`]),
  quiz: [
    [`Price (300 ms), reviews (500 ms) and stock (200 ms) are independent. Fan-out + allOf takes about?`,[`~500 ms`,`~1000 ms`,`~300 ms`,`~200 ms`],0,`Parallel calls finish when the slowest does.`,'E'],
    [`Why pass your own executor to <code>supplyAsync</code> for blocking HTTP calls?`,[`The default executor is single-threaded`,`It's required for exceptions to reach the caller`,`supplyAsync won't compile without an executor`,`The shared commonPool is small; blocking starves it`],3,`Size an I/O pool for the downstream.`,'M'],
    [`With no executor given, where does the function in <code>thenApply</code> run?`,[`Always on the ForkJoin commonPool`,`Always on the thread that called thenApply`,`On whichever thread completed the previous stage`,`On a brand-new thread each time`],2,`Non-async stages run inline. Use thenApplyAsync(fn, executor) to control it.`,'H'],
    [`What does <code>supplyAsync</code> return?`,[`The value, after blocking until it's computed`,`A CompletableFuture that completes with the value later`,`A new Thread that has already started running`,`A Supplier wrapping the computation for later`],1,`Non-blocking start.`,'E'],
    [`Chain another async call that returns a CompletableFuture?`,[`thenApply`,`thenCompose`,`thenAccept`,`join`],1,`thenApply would nest futures.`,'M'],
    [`Combine two independent futures' results?`,[`thenCompose`,`thenCombine`,`exceptionally`,`orTimeout`],1,`Runs the combiner when both are done.`,'E'],
    [`Wait for many futures to finish?`,[`anyOf`,`allOf`,`join each in parallel streams`,`thenRun`],1,`anyOf completes with the first.`,'E'],
    [`What does <code>join()</code> do differently from <code>get()</code>?`,[`Returns null immediately if the future isn't complete yet`,`Throws unchecked CompletionException instead of checked exceptions`,`Cancels the future if it hasn't completed by the call`,`Waits with a default timeout, whereas get() waits forever`],1,`Convenient in lambdas.`,'M'],
  ],
  quizAdv: [
    [`<code>allOf(f1, f2, f3)</code>, where f2 fails quickly. The allOf future?`,[`Fails right away and cancels the others`,`Completes exceptionally once all three are done`,`Completes normally`,`Never completes`],1,`allOf waits for every future. Implement fail-fast yourself if you need it.`,'H'],
    [`Which recovers from a failed stage with a fallback value?`,[`thenAccept(…)`,`join()`,`exceptionally(…)`,`thenCompose(…)`],2,`Or handle((v, ex) -> …) for both outcomes.`,'M'],
    [`<code>completeOnTimeout(fallback, 1, SECONDS)</code> vs <code>orTimeout(1, SECONDS)</code>?`,[`Both cancel the task and interrupt its thread after one second`,`completeOnTimeout yields the fallback; orTimeout fails with TimeoutException`,`orTimeout completes with null; completeOnTimeout throws TimeoutException`,`Both complete with the fallback, but orTimeout also logs a warning`],1,`Neither stops the underlying work.`,'H'],
    [`Does <code>future.cancel(true)</code> on a CompletableFuture interrupt the running task?`,[`Yes: it interrupts the thread running the supplier`,`No: CompletableFuture's cancel doesn't interrupt the computation`,`Only when the future runs on a virtual thread`,`Only if it was created with an explicit executor`],1,`It just completes the future with CancellationException.`,'H'],
  ],
});
