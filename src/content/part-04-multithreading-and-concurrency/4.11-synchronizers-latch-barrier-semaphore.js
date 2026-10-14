/* 4.11 Synchronizers: latch, barrier, semaphore */
topic('4', { no:'4.11', title:'Synchronizers: latch, barrier, semaphore', idea:`Three coordination tools: wait for N events (latch), wait for each other (barrier), cap concurrency (semaphore).`,
codes:{a:`CountDownLatch done = new CountDownLatch(3);
for (int i = 0; i < 3; i++)
  pool.submit(() -> {
    try { callService(); }
    finally { done.countDown(); }   // always, even on error
  });
done.await();                       // main waits for 0
buildResponse();`,
b:`CyclicBarrier barrier = new CyclicBarrier(3,
    () -> print("all arrived, merge"));   // barrier action
// each of T1, T2, T3 runs:
for (int phase = 0; phase < 2; phase++) {
  computeChunk(phase);
  barrier.await();                        // wait for the others
}`,
c:`Semaphore permits = new Semaphore(2);

void call() throws InterruptedException {
  permits.acquire();          // take a permit or wait
  try { callGateway(); }
  finally { permits.release(); }
}`},
steps:[
{cv:'a', hl:{main:[1,2,3]}, th:[['main','RUN','submitted 3 tasks'],['T1','RUN','callService()'],['T2','RUN','callService()'],['T3','RUN','callService()']], g:[G('CountDownLatch',['count','3'],C('awaiting',[['none','dim']]))],
 say:`<b>CountDownLatch(3)</b>: a counter that only goes down. Main fans out 3 service calls.`},
{hl:{main:[7]}, th:[['main','WAITING','await() until count = 0'],['T1','RUN',''],['T2','RUN',''],['T3','RUN','']], g:[G('CountDownLatch',['count','3'],C('awaiting',['main']))],
 say:`<code>await()</code> parks main until the count reaches 0.`},
{hl:{T1:[5]}, th:[['main','WAITING',''],['T1','TERM','countDown()'],['T2','RUN',''],['T3','RUN','']], g:[G('CountDownLatch',['count','2','hot'],C('awaiting',['main']))],
 say:`T1 finishes: 3 → 2. Note <code>countDown()</code> is in <code>finally</code>. If a task threw before counting down, main would wait forever.`},
{hl:{T2:[5]}, th:[['main','WAITING',''],['T1','TERM',''],['T2','TERM','countDown()'],['T3','RUN','']], g:[G('CountDownLatch',['count','1','hot'],C('awaiting',['main']))],
 say:`T2: 2 → 1. Threads that count down don't wait. Only <code>await()</code> waits.`},
{hl:{T3:[5],main:[8]}, th:[['main','RUN','released → buildResponse()'],['T1','TERM',''],['T2','TERM',''],['T3','TERM','countDown()']], g:[G('CountDownLatch',['count','0','ok'],['reusable?','no: one-shot','bad'])], log:['latch reached 0 → main continues'],
 say:`0 → main wakes. A latch is <b>one-shot</b>: it can't be reset, and further <code>await()</code> calls return immediately. Modern alternative: <code>CompletableFuture.allOf(...)</code>.`},
{cv:'b', hl:{T1:[6]}, logReset:true, th:[['T1','WAITING','arrived (1/3)'],['T2','RUN','computeChunk(0)'],['T3','RUN','computeChunk(0)']], g:[G('CyclicBarrier(3) · phase 0',['arrived','1 / 3'],C('waiting',['T1']))],
 say:`<b>CyclicBarrier(3)</b>: threads wait <b>for each other</b>. T1 finishes phase 0 first and waits at the barrier.`},
{hl:{T2:[6]}, th:[['T1','WAITING',''],['T2','WAITING','arrived (2/3)'],['T3','RUN','still computing']], g:[G('CyclicBarrier(3) · phase 0',['arrived','2 / 3','hot'],C('waiting',['T1','T2']))],
 say:`T2 arrives. Still waiting for T3, the slowest thread, which sets the pace.`},
{hl:{T3:[6],T1:[5],T2:[5]}, th:[['T1','RUN','phase 1'],['T2','RUN','phase 1'],['T3','RUN','ran barrier action, phase 1']], g:[G('CyclicBarrier(3) · phase 1',['arrived','0 / 3 (reset)','ok'],C('waiting',[['none','dim']]))], log:['T3: all arrived, merge','barrier tripped → all 3 released, barrier reset'],
 say:`The last thread to arrive (T3) runs the <b>barrier action</b>, then <b>all three go together</b> and the barrier <b>resets</b> for phase 1. That reset is the "cyclic" part. If one thread is interrupted or times out, the barrier <b>breaks</b> and the others get <code>BrokenBarrierException</code>. <b>Phaser</b> is a more flexible version where parties can join and leave.`},
{cv:'c', hl:{T1:[4],T2:[4]}, logReset:true, th:[['T1','RUN','calling gateway'],['T2','RUN','calling gateway'],['T3','READY',''],['T4','READY','']], g:[G('Semaphore(2)',['permits left','0','hot'],C('inside',['T1','T2']),C('waiting',[['none','dim']]))],
 say:`<b>Semaphore(2)</b>: a pool of 2 permits. At most 2 threads may call the payment gateway at once. T1 and T2 take the two permits.`},
{hl:{T3:[4],T4:[4]}, th:[['T1','RUN',''],['T2','RUN',''],['T3','WAITING','acquire() blocks'],['T4','WAITING','acquire() blocks']], g:[G('Semaphore(2)',['permits left','0'],C('inside',['T1','T2']),C('waiting',['T3','T4']))],
 say:`No permits left, so T3 and T4 wait. <code>tryAcquire(timeout)</code> would let them give up instead, for example to return HTTP 429.`},
{hl:{T1:[6],T3:[5]}, th:[['T1','TERM','release()'],['T2','RUN',''],['T3','RUN','got the permit'],['T4','WAITING','']], g:[G('Semaphore(2)',['permits left','0'],C('inside',['T2','T3']),C('waiting',['T4']))], log:['T1 released → T3 acquired'],
 say:`T1 releases and T3 takes the permit. Unlike a lock, a semaphore has <b>no owner</b>: any thread can call release. <code>Semaphore(1)</code> is a mutex that isn't re-entrant. Uses: bulkheads, connection limits, rate limiting, dining philosophers with <code>Semaphore(n-1)</code>.`}
],
keep:[`Latch: one-shot, "wait until N things happened". Barrier: reusable, "wait until all N arrive". Semaphore: "at most N inside".`,`countDown / release always in finally.`,`Semaphore permits have no owner; a lock does.`]}, {
  imp: 'good',
  theory: TH(`Synchronizers coordinate groups of threads: a latch waits for N events, a barrier waits for N threads to meet, and a semaphore limits how many can be inside at once.`,
`<ul><li><b>CountDownLatch(N)</b>: a gate that opens once <code>countDown()</code> has been called N times. One-shot. "Wait until all 3 services have started."</li><li><b>CyclicBarrier(N)</b>: N threads each call <code>await()</code>; all are released together when the last one arrives. Reusable. "Everyone finish phase 1 before phase 2."</li><li><b>Semaphore(N)</b>: N permits; <code>acquire()</code> takes one (waiting if none), <code>release()</code> gives it back. "At most 10 concurrent calls to this API."</li></ul>`,
[[`Latch`,`One-time countdown gate.`],[`Barrier`,`Rendezvous point for a fixed group of threads.`],[`Semaphore`,`Counter of permits limiting concurrent access.`],[`Permit`,`A token you must hold to proceed; not tied to a thread.`]],
[`Create the synchronizer with N.`,`Workers call countDown / await / acquire.`,`Waiting threads block until the condition is met.`,`Always countDown/release in a finally block.`],
[`Semaphores are a simple bulkhead for fragile downstream services.`,`Latches are handy in tests to wait for async work.`],
[`Forgetting release() on an exception path, so permits leak until everything blocks.`,`Using a latch where you need a reusable barrier.`]),
  quiz: [
    [`Main must wait until 3 services finish initialising, once. Which tool?`,[`CyclicBarrier(3)`,`Semaphore(3)`,`CountDownLatch(3)`,`Thread.yield in a loop`],2,`Each service calls countDown(); main calls await(). One-shot.`,'E'],
    [`Limit concurrent calls to a fragile API to 10. Which tool?`,[`Semaphore(10)`,`CountDownLatch(10)`,`CyclicBarrier(10)`,`A ReentrantLock`],0,`A semaphore bounds "at most N inside".`,'M'],
    [`A worker calls <code>semaphore.acquire()</code>, then throws before <code>release()</code>, with no finally. Effect?`,[`The permit is released when the thread dies`,`Semaphore releases automatically on exceptions`,`Another thread gets IllegalMonitorStateException`,`That permit is lost; capacity shrinks until callers block`],3,`Permits have no owner and aren't tied to threads. Always release in finally.`,'H'],
    [`What does <code>latch.countDown()</code> do?`,[`Blocks the caller until the count reaches zero`,`Decrements the count; at zero, waiting threads are released`,`Resets the count back to its initial value`,`Releases one waiting thread per call to it`],1,`await() waits for zero.`,'E'],
    [`Can a CountDownLatch be reset?`,[`Yes: call reset() once the count hits zero`,`No: it's one-shot; use CyclicBarrier or a new latch`,`Yes: await() resets it automatically after release`,`Only if it was created with a count of one`],1,`CyclicBarrier is reusable.`,'M'],
    [`<code>Semaphore(3)</code> means?`,[`At most 3 threads in the whole JVM`,`At most 3 holders of a permit at once`,`A 3-second timeout on each acquire()`,`At most 3 acquires over its lifetime`],1,`acquire / release.`,'E'],
    [`What happens to <code>semaphore.tryAcquire()</code> when no permits are left?`,[`Blocks forever`,`Returns false immediately`,`Throws`,`Creates a permit`],1,`tryAcquire(timeout) waits up to the timeout.`,'M'],
    [`CyclicBarrier's barrier action runs?`,[`On every await() call, by each arriving thread`,`Once per generation, when the last thread arrives`,`Once only, the first time the barrier trips`,`On a new thread after all parties are released`],1,`Useful to merge partial results.`,'M'],
  ],
  quizAdv: [
    [`4 workers must all finish step k before any starts step k+1, repeatedly. Which?`,[`CyclicBarrier(4)`,`CountDownLatch(4)`,`Semaphore(4)`,`Thread.join in a loop`],0,`A barrier is reusable across generations.`,'M'],
    [`Do Semaphore permits have owners?`,[`Yes, like a lock`,`Only when fair`,`Yes; others can't release`,`No: anyone can release`],3,`That's why release must be paired carefully, in finally.`,'H'],
    [`What is a Phaser?`,[`A lock that switches between read and write phases`,`A flexible barrier where parties can register and deregister across phases`,`A pool that runs tasks in fixed phases of equal size`,`A one-shot latch whose count can only go down to zero`],1,`Generalises latch and barrier.`,'H'],
    [`Using a Semaphore as a simple bulkhead for an API client means?`,[`Retrying failed calls a fixed number of times`,`Limiting concurrent calls to protect the dependency and your threads`,`Limiting calls per second within a fixed time window`,`Opening a circuit to stop calls after repeated errors`],1,`Resilience4j's Bulkhead works similarly.`,'M'],
  ],
});
