/* 6.3 Thread-pool starvation: the batch that never finishes */
topic('6', { no:'6.3', title:'Thread-pool starvation: the batch that never finishes', idea:`Tasks on a pool block waiting for subtasks queued on the <b>same</b> pool. Every thread waits, nothing runs, and a thread dump shows no deadlock. Fix it with separate pools and non-blocking composition.`,
actors:'Pool threads (fixed pool of 4)', stateTitle:'Executor', dgTitle:'Wait-for cycle',
vb:'0 0 520 230',
nodes:{pool:{x:260,y:40,label:'pool threads\np1 p2 p3 p4',w:170,h:56}, q:{x:260,y:190,label:'work queue\ntax#1-4, fx#1-4',kind:'mem',w:170,h:56}},
edges:[['pool','q','join() waits for'],['q','pool','needs a free thread']],
codes:{a:`ExecutorService pool = Executors.newFixedThreadPool(4);

// nightly invoicing: invoice(order) for every order
CompletableFuture<Invoice> invoice(Order o) {
  return CompletableFuture.supplyAsync(() -> {
    CompletableFuture<Tax> tax =
        CompletableFuture.supplyAsync(() -> taxApi.calc(o), pool);
    CompletableFuture<Fx> fx =
        CompletableFuture.supplyAsync(() -> fxApi.rate(o.ccy()), pool);
    return build(o, tax.join(), fx.join());     // blocks a pool thread
  }, pool);
}`,
b:`ExecutorService io = new ThreadPoolExecutor(16, 16, 0, SECONDS,
    new ArrayBlockingQueue<>(500), new ThreadPoolExecutor.CallerRunsPolicy());

CompletableFuture<Invoice> invoice(Order o) {
  CompletableFuture<Tax> tax =
      CompletableFuture.supplyAsync(() -> taxApi.calc(o), io);
  CompletableFuture<Fx> fx =
      CompletableFuture.supplyAsync(() -> fxApi.rate(o.ccy()), io);
  return tax.thenCombine(fx, (t, r) -> build(o, t, r))  // no thread waits
            .orTimeout(2, SECONDS);
}`},
steps:[
{hl:{p1:[5],p2:[5],p3:[5],p4:[5]}, th:[['p1','RUN','invoice(order 1)'],['p2','RUN','invoice(order 2)'],['p3','RUN','invoice(order 3)'],['p4','RUN','invoice(order 4)']], d:null,
 g:[G('pool (fixed, 4 threads)',['busy threads','4 / 4','hot'],C('queue',[['empty','dim']]))],
 say:`The nightly job calls <code>invoice()</code> for many orders. The first four outer tasks take all <b>four</b> pool threads. In dev the job had 3 orders and always worked.`},
{hl:{p1:[7,9],p2:[7,9],p3:[7,9],p4:[7,9]}, th:[['p1','RUN','submitted tax#1, fx#1'],['p2','RUN','submitted tax#2, fx#2'],['p3','RUN','submitted tax#3, fx#3'],['p4','RUN','submitted tax#4, fx#4']],
 g:[G('pool (fixed, 4 threads)',['busy threads','4 / 4'],C('queue',['tax#1','fx#1','tax#2','fx#2','tax#3','fx#3','tax#4','fx#4'],'hot'))],
 say:`Each outer task submits two <b>inner</b> tasks to the <b>same pool</b>. There's no free thread, so all eight go into the queue. That alone is fine: they'd run as soon as a thread frees up.`},
{hl:{p1:[10],p2:[10],p3:[10],p4:[10]}, th:[['p1','WAITING','join() on tax#1'],['p2','WAITING','join() on tax#2'],['p3','WAITING','join() on tax#3'],['p4','WAITING','join() on tax#4']], d:{type:'graph',bad:['pool','q'],e:[['pool','q','join() waits for','bad'],['q','pool','needs a free thread','bad']]},
 g:[G('pool (fixed, 4 threads)',['busy threads','4 / 4 (all waiting)','bad'],C('queue',['tax#1','fx#1','tax#2','fx#2','tax#3','fx#3','tax#4','fx#4'],'bad'),['completed tasks / min','0','bad'])],
 say:`Then each outer task calls <code>tax.join()</code> and <b>parks</b>, still holding its pool thread. The inner tasks need a free thread to run, and the threads are waiting for the inner tasks. <b>A cycle with no lock in it</b>: thread-pool starvation deadlock. CPU drops to 0% and the batch never finishes.`},
{th:[['p1','WAITING','parked'],['p2','WAITING','parked'],['p3','WAITING','parked'],['p4','WAITING','parked'],['oncall','RUN:ok','jstack']],
 log:['"pool-1-thread-1" WAITING (parking)','   at java.util.concurrent.CompletableFuture.join','   at InvoiceJob.lambda$invoice$2(InvoiceJob.java:10)','… same for thread-2, -3, -4','(no "Found one Java-level deadlock")'],
 say:`On-call takes a thread dump (4.18). All four pool threads are <b>WAITING in CompletableFuture.join</b> at the same line, and the JVM reports <b>no deadlock</b> because no monitor is involved. The tell is "every pool thread waits on work that's queued in that same pool".`},
{th:[],
 g:[G('Why it passed in tests',['orders in test','3 < 4 threads','ok'],['orders in prod','2,000 ≥ 4 threads','bad'],['rule','hangs when concurrent outer tasks ≥ pool size']), G('Same bug, other shapes',['parallel stream inside a parallel stream task','commonPool'],['@Async method calling another @Async and .get()','same executor'],['nested supplyAsync without an executor','commonPool (cores − 1 threads)'])],
 say:`It's load-dependent, which is why it escapes testing: it only hangs once the number of <b>concurrent outer tasks reaches the pool size</b>. The same shape shows up with nested parallel streams on the common pool and with <code>@Async</code> methods that block on other <code>@Async</code> calls on the same executor.`},
{cv:'b', hl:{p1:[6],p2:[8]}, th:[['p1','RUN','io: tax for order 1'],['p2','RUN','io: fx for order 1'],['p3','RUN','io: tax for order 2'],['p4','RUN','io: fx for order 2']], d:{type:'graph',ok:['pool','q'],e:[['q','pool','runs on io pool','ok']],labels:{pool:'io threads\n16 for HTTP',q:'queue (bounded)\n500 + CallerRuns'}},
 g:[G('io pool (16 threads, bounded queue)',['blocked waiting on subtasks','0','ok'],['completed tasks / min','~4,800','ok'])], log:['batch finished: 2,000 invoices in 51 s'],
 say:`<b>Fix part 1:</b> never block a pool thread on work submitted to the same pool. Here nobody blocks at all: <code>thenCombine</code> registers a callback that runs when both results are ready. <b>Fix part 2:</b> blocking HTTP calls get their own <b>bounded</b> I/O pool (4.13), sized for the downstream, not for the CPU.`},
{hl:{p1:[9,10]}, th:[],
 g:[G('Rules',['no join()/get() inside a pool task on the same pool','compose: thenCompose / thenCombine','ok'],['separate pools','CPU work vs blocking I/O','ok'],['always a timeout','orTimeout / completeOnTimeout','ok'],['bounded queues + rejection policy','back-pressure, not silent piling up','ok']), G('Java 21 alternative',['virtual threads','blocking join() is cheap','ok'],['still cap the downstream','Semaphore (4.17)'])],
 say:`<b>Interview answer:</b> "All pool threads were blocked in join() waiting for tasks queued behind them in the same pool. I'd compose with thenCombine instead of blocking, put I/O on its own bounded pool, and add <code>orTimeout</code> so a stuck dependency fails instead of hanging. With virtual threads, blocking is cheap, but I'd still bound concurrency to the downstream."`}
],
keep:[`Blocking (join/get) inside a pool task on work queued to the same pool can starve the pool: all threads wait, nothing runs.`,`Thread dump: every pool thread WAITING in join at one line, and no deadlock reported.`,`Compose without blocking, separate CPU and I/O pools, bounded queues, timeouts everywhere.`]}, {
  imp: 'good',
  theory: TH(`If tasks in a thread pool block waiting for other tasks queued in the same pool, every thread can end up waiting and nothing runs: thread-pool starvation.`,
`<p>A pool has a fixed number of threads. Suppose each task submits a subtask to the <i>same</i> pool and then blocks waiting for it. If all threads are busy doing that, the subtasks sit in the queue forever: there's no free thread to run them, and no thread will free up until they run. Unlike a lock deadlock, the JVM can't detect this; you just see a hang with idle CPUs.</p>`,
[[`Starvation deadlock`,`Tasks waiting for work that can't get a thread.`],[`Non-blocking composition`,`Chaining futures (thenCombine) instead of waiting with join/get.`],[`Bulkhead`,`Separate pools so one kind of work can't starve another.`]],
[`Never call join()/get() inside a pool task on work queued to the same pool.`,`Compose futures so no thread waits.`,`Use separate, bounded pools for blocking I/O and CPU work.`,`Add timeouts so a stuck dependency fails instead of hanging.`],
[`Watch for nested parallel streams, nested @Async calls with .get(), and supplyAsync without an executor.`],
[`Increasing the pool size as the "fix"; it only raises the threshold.`]),
  quiz: [
    [`Which change removes the blocking wait?`,[`Replace join() with get()`,`Double the pool size`,`Add Thread.sleep before join()`,`Compose with thenCombine`],3,`A bigger pool only moves the threshold. Composition doesn't hold a thread while waiting.`,'E'],
    [`Fixed pool of 4. Each task submits a subtask to the same pool and calls <code>join()</code>. 4 tasks start at once. What happens?`,[`Subtasks run on temporary extra threads`,`The JVM detects the deadlock and throws`,`All 4 threads wait on queued subtasks`,`It finishes, just slowly`],2,`Thread-pool starvation deadlock. With no lock cycle, nothing detects it.`,'M'],
    [`Why did it never hang in tests with 3 orders?`,[`3 tasks leave a thread free for subtasks`,`Tests run on virtual threads`,`The JIT optimised the join away`,`Tests mock CompletableFuture`],0,`It hangs only once concurrent outer tasks ≥ pool size.`,'H'],
    [`What is thread-pool starvation?`,[`Two pool threads each hold a lock the other needs, forever`,`Pool threads all block waiting on queued work that can never run`,`The pool's queue fills up, so new tasks get rejected by policy`,`Idle pool threads time out and are never recreated again`],1,`Nothing makes progress.`,'E'],
    [`What does a thread dump typically show in this case?`,[`Found one Java-level deadlock between two pool threads`,`All pool threads WAITING in join/get at the same place`,`A few RUNNABLE threads burning CPU in a tight loop`,`All pool threads BLOCKED on one synchronized monitor`],1,`No lock cycle is reported.`,'M'],
    [`Why doesn't simply enlarging the pool fix it?`,[`Bigger pools trigger more GC, which slows the waiting threads`,`It only raises the threshold; enough concurrent outer tasks still fill it`,`The common pool's size is fixed and can't be changed at all`,`New threads only pick up new tasks, never the queued ones`],1,`Remove the blocking dependency.`,'M'],
    [`Best way to wait for two async results without blocking a pool thread?`,[`join() both futures inside thenApply`,`thenCombine and return the combined future`,`allOf(…).get() on the calling pool thread`,`supplyAsync a task that calls get() on each`],1,`Composition.`,'E'],
    [`What should blocking HTTP calls run on?`,[`The common ForkJoinPool, via parallel streams`,`A dedicated bounded I/O executor (or virtual threads)`,`A single-thread executor so calls stay ordered`,`An unbounded cached pool so calls never queue`],1,`Separate from CPU work.`,'M'],
  ],
  quizAdv: [
    [`4-CPU container, <code>supplyAsync</code> with no executor for blocking calls. Concurrency?`,[`Unlimited: a thread per task`,`At most 3 at once`,`Exactly 4`,`200, like Tomcat`],1,`commonPool parallelism is cores − 1, shared by the whole JVM.`,'H'],
    [`<code>orTimeout(2, SECONDS)</code> fires while the task is in a blocking HTTP call. That call?`,[`It's interrupted and closed`,`It's cancelled at the socket`,`It keeps running`,`It throws inside the task`],2,`Completing the future doesn't stop the work.`,'H'],
    [`@Async method A calls @Async method B on the same executor and calls .get(). Risk?`,[`B's result is lost because futures can't cross executors`,`Starvation when all executor threads are A's waiting on B's queued tasks`,`A deadlock reported by the JVM between A's and B's locks`,`Only extra latency, since get() frees the thread while waiting`],1,`Same pattern as nested supplyAsync.`,'H'],
    [`Why add timeouts even after fixing starvation?`,[`CompletableFuture requires a timeout on each stage to complete`,`A stuck dependency then fails fast instead of hanging the batch`,`Timeouts clear the pool's queue, so starvation can't come back`,`Timeouts make the HTTP calls idempotent, so retries are safe`],1,`Defence in depth.`,'M'],
  ],
});
