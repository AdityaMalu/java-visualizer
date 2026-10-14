/* 4.2 Creating threads */
topic('4', { no:'4.2', title:'Creating threads', idea:`Runnable, Callable with an executor, CompletableFuture, virtual threads. And the classic run() vs start() trap.`,
codes:{a:`Runnable job = () -> print(Thread.currentThread().getName());

Thread t = new Thread(job, "worker-1");
t.run();     // ✘ plain method call, runs on main
t.start();   // ✔ new thread runs job
t.start();   // ✘ IllegalThreadStateException

ExecutorService pool = Executors.newFixedThreadPool(2);
Future<Integer> f = pool.submit(() -> 6 * 7);   // Callable
int x = f.get();                               // blocks until done

Thread.ofVirtual().start(() -> callApi());      // Java 21
// avoid: class MyThread extends Thread { ... }`},
steps:[
{hl:{main:[1]}, th:[['main','RUN','line 1']], g:[G('Heap',['job','Runnable (lambda)','hot'])],
 say:`A <code>Runnable</code> is just an object with a <code>run()</code> method. Creating it <b>runs nothing</b>. Prefer Runnable over <code>extends Thread</code>: your class can still extend something else, and the task stays separate from the thread that runs it.`},
{hl:{main:[3]}, th:[['main','RUN','line 3'],['worker-1','NEW','Thread object only']], g:[G('Heap',['job','Runnable (lambda)'],['t','Thread "worker-1" · NEW','hot'])],
 say:`A Thread object wrapping the job. It is still <b>NEW</b>: no OS thread exists yet.`},
{hl:{main:[4]}, log:['main'], th:[['main','RUN','executing job.run() itself'],['worker-1','NEW','still not started']],
 say:`<b>Trap:</b> <code>t.run()</code> is an ordinary method call. The job runs <b>on the main thread</b> and prints <code>main</code>. No new thread was created and worker-1 is still NEW.`},
{hl:{main:[5],'worker-1':[1]}, log:['worker-1'], th:[['main','RUN','continues to line 6 immediately'],['worker-1','RUN','executing job']], g:[G('Heap',['t','Thread "worker-1" · RUNNABLE','hot'])],
 say:`<code>start()</code> makes the JVM create a native thread, and that new thread calls <code>run()</code>. It prints <code>worker-1</code>. <code>start()</code> returns immediately, so main keeps going and the order of the two threads' output is <b>not guaranteed</b>.`},
{hl:{main:[6]}, log:['✘ java.lang.IllegalThreadStateException'], th:[['main','RUN','exception thrown'],['worker-1','TERM','job finished']], g:[G('Heap',['t','Thread "worker-1" · TERMINATED','dim'])],
 say:`A Thread object can be started <b>only once</b>, even after it has finished. A second <code>start()</code> throws <code>IllegalThreadStateException</code>. To run the job again, create a new Thread or, better, use a pool.`},
{hl:{main:[8]}, th:[['main','RUN','pool created'],['worker-1','TERM','']], g:[G('Pool (fixed, 2)', C('workers',[['none yet','dim']]), C('task queue',[['empty','dim']]))],
 say:`<code>newFixedThreadPool(2)</code> sets up the machinery. Worker threads are created <b>as tasks arrive</b>, up to 2, and then they are reused forever.`},
{hl:{main:[9],'pool-1':[9]}, th:[['main','RUN','got Future f'],['pool-1','RUN','computing 6 * 7']], g:[G('Pool (fixed, 2)', C('workers',['pool-1'])), G('Future f',['state','PENDING','hot'],['value','—'])],
 say:`<code>submit(Callable)</code> wraps the lambda in a <code>FutureTask</code>, starts worker pool-1, and returns a <b>Future right away</b>. A <code>Callable</code> can return a value and throw checked exceptions. A Runnable can do neither.`},
{hl:{main:[10]}, th:[['main','WAITING','parked in f.get()'],['pool-1','RUN','computing 6 * 7']],
 say:`<code>f.get()</code> <b>blocks</b> main (state WAITING) until the task finishes. This is the main weakness of Future: you can't attach "do this next" and you can't combine futures without blocking. CompletableFuture fixes that (4.14).`},
{th:[['main','RUN','x = 42'],['pool-1','WAITING','idle, waiting on queue.take()']], g:[G('Pool (fixed, 2)', C('workers',['pool-1'])), G('Future f',['state','DONE','ok'],['value','42','ok'])], log:['x = 42'],
 say:`The worker finishes, the Future completes, and main wakes with 42. The pool thread <b>does not die</b>. It waits for the next task. Pool threads are non-daemon, so call <code>shutdown()</code> or the JVM may never exit.`},
{hl:{main:[12],'virtual#21':[12]}, th:[['main','RUN',''],['pool-1','WAITING','idle'],['virtual#21','RUN','mounted on a carrier thread']], g:[G('Virtual thread',['carrier','ForkJoinPool-1-worker-1'],['cost','~ few hundred bytes to start','ok'])],
 say:`Java 21 <b>virtual threads</b> are cheap JVM-managed threads that run on a few carrier OS threads. Use them for blocking I/O at large scale (4.17). The fourth option, <code>extends Thread</code>, works but ties your task to one thread mechanism and uses up your single superclass.`}
],
keep:[`<code>run()</code> = same thread; <code>start()</code> = new thread. Start twice → <code>IllegalThreadStateException</code>.`,`Runnable: no result, no checked exception. Callable: returns V, can throw.`,`In real code use an ExecutorService, not raw <code>new Thread</code>.`]}, {
  imp: 'must',
  theory: TH(`You give a thread work by passing it a Runnable (no result) or Callable (returns a result), and in real code you submit that work to an executor rather than creating threads by hand.`,
`<p>A <code>Thread</code> object represents an OS thread. Calling <code>start()</code> asks the OS to create it, and the new thread runs your task's <code>run()</code> method. Calling <code>run()</code> directly just runs the code on <i>your</i> thread, which is a common mistake.</p>
<p><b>Runnable</b> is "do this" (no return value). <b>Callable&lt;V&gt;</b> is "compute this and give me a V" (may throw). Executors manage a pool of reusable threads; you submit tasks and get back a <b>Future</b> to collect the result.</p>`,
[[`Runnable`,`void run(); no result, no checked exceptions.`],[`Callable&lt;V&gt;`,`V call() throws Exception.`],[`ExecutorService`,`A pool of threads that runs submitted tasks.`],[`Future&lt;V&gt;`,`Handle to a result that will be available later.`],[`Daemon thread`,`A background thread that doesn't keep the JVM alive.`]],
[`Write the task as a lambda: <code>() -&gt; work()</code>.`,`Submit it: <code>Future&lt;R&gt; f = executor.submit(task)</code>.`,`Do other work, then <code>f.get()</code> to wait for the result.`,`Shut the executor down when the application stops.`],
[`In Spring, define executors as beans; don't create threads ad hoc.`,`Name your threads (ThreadFactory) so thread dumps are readable.`],
[`Calling run() instead of start().`,`Starting a thread twice (IllegalThreadStateException).`,`Unbounded <code>new Thread</code> per request.`]),
  quiz: [
    [`<code>Thread t = new Thread(task); t.run();</code> Where does the task run?`,[`On a new thread`,`On the calling thread`,`Always on the main thread`,`On a pool thread`],1,`start() creates a new thread that then calls run().`,'E'],
    [`Calling <code>start()</code> twice on the same Thread?`,[`Runs the task twice`,`The second call is ignored`,`IllegalThreadStateException`,`Restarts it from the beginning`],2,`A Thread can be started only once.`,'M'],
    [`main() starts a non-daemon thread <code>t</code> and returns immediately. Does the JVM exit?`,[`No: it waits until all non-daemon threads finish`,`Yes: main returning stops every other thread`,`Yes, unless main called t.join() first`,`Only once System.exit() is called`],0,`The JVM exits when only daemon threads remain (or on System.exit).`,'H'],
    [`Which interface returns a result from a task?`,[`Runnable`,`Callable`,`Thread`,`Executor`],1,`call() returns V.`,'E'],
    [`What does <code>future.get()</code> do?`,[`Returns null immediately if the task isn't done`,`Blocks until the result (or exception) is ready`,`Starts the task and returns its result directly`,`Cancels the task if it hasn't finished yet`],1,`Use get(timeout, unit) to bound the wait.`,'E'],
    [`What does <code>thread.join()</code> do?`,[`Starts that thread right away`,`Waits for that thread to finish`,`Merges it into the current thread`,`Waits for that thread to start`],1,`join(ms) waits at most ms.`,'E'],
    [`What is a daemon thread?`,[`A high-priority thread the scheduler runs first`,`A background thread that doesn't keep the JVM alive`,`A thread that keeps running after the JVM exits`,`A system thread reserved only for the GC`],1,`setDaemon(true) before start().`,'M'],
    [`An exception thrown inside a Callable submitted to an executor appears where?`,[`Thrown directly to the thread that called submit()`,`Wrapped in ExecutionException when you call future.get()`,`Passed to the pool's handler, killing the worker`,`Swallowed entirely, so future.get() returns null`],1,`getCause() gives the original.`,'M'],
  ],
  quizAdv: [
    [`You need a result and checked exceptions from background work. Which?`,[`A Runnable passed to new Thread`,`A Callable submitted to an ExecutorService`,`A Thread subclass overriding run()`,`A TimerTask`],1,`Callable&lt;V&gt;.call() returns V and may throw; you get a Future.`,'M'],
    [`Why is <code>Thread.stop()</code> deprecated (and now removed)?`,[`It's far too slow`,`It leaks native memory`,`It releases locks abruptly`,`It only works on daemons`],2,`Use interruption and cooperative cancellation.`,'H'],
    [`How do you name threads created by an executor?`,[`Call setName() on the executor before submitting`,`Pass a custom ThreadFactory that sets the names`,`Pass a name prefix string to newFixedThreadPool`,`Set a JVM system property for the pool's prefix`],1,`Readable names make thread dumps useful.`,'M'],
    [`What does <code>Thread.ofVirtual().start(task)</code> create (Java 21)?`,[`A platform thread running task`,`A virtual thread running task`,`A new pool of virtual threads`,`A carrier thread for task`],1,`Cheap, JVM-scheduled threads.`,'M'],
  ],
});
