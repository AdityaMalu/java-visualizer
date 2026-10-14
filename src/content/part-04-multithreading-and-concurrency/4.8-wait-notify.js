/* 4.8 wait / notify */
topic('4', { no:'4.8', title:'wait / notify', idea:`A thread that can't proceed releases the lock and sleeps in the wait set until someone signals. Watch why it must be <code>while</code>, not <code>if</code>.`,
codes:{a:`synchronized void put(int x) throws InterruptedException {
  while (q.size() == CAP) wait();   // full -> sleep, release lock
  q.add(x);
  notifyAll();                       // wake waiting takers
}
synchronized int take() throws InterruptedException {
  while (q.isEmpty()) wait();        // empty -> sleep, release lock
  int x = q.poll();
  notifyAll();                       // wake waiting putters
  return x;
}`},
steps:[
{th:[['C1','READY','will take()'],['C2','READY','will take()'],['P','READY','will put(7)']], g:[mon('buffer',null), G('Queue (CAP 2)', C('items',[['empty','dim']]))],
 say:`A bounded buffer. Two consumers want items, one producer will add one. All methods synchronize on the same buffer object.`},
{hl:{C1:[6,7]}, th:[['C1','WAITING','queue empty → wait()'],['C2','READY',''],['P','READY','']], g:[mon('buffer',null,[],['C1'])], log:['C1: empty, waiting'],
 say:`C1 takes the lock, sees the queue empty, calls <code>wait()</code>. <code>wait()</code> <b>releases the lock</b> and parks C1 in the <b>wait set</b>. If it kept the lock, the producer could never get in.`},
{hl:{C2:[7]}, th:[['C1','WAITING',''],['C2','WAITING','queue empty → wait()'],['P','READY','']], g:[mon('buffer',null,[],['C1','C2'])], log:['C2: empty, waiting'],
 say:`Same for C2. Both consumers are now waiting for a signal.`},
{hl:{P:[1,2,3]}, th:[['C1','WAITING',''],['C2','WAITING',''],['P','RUN','owns lock, add(7)']], g:[mon('buffer','P',[],['C1','C2']), G('Queue (CAP 2)', C('items',[['7','hot']]))],
 say:`P takes the lock. Not full, so it adds 7.`},
{hl:{P:[4]}, th:[['C1','BLOCKED','woken, needs lock'],['C2','BLOCKED','woken, needs lock'],['P','RUN','still owns lock']], g:[mon('buffer','P',['C1','C2'],[]), G('Queue (CAP 2)', C('items',['7']))], log:['P: notifyAll() → C1, C2 to entry set'],
 say:`<code>notifyAll()</code> moves <b>both</b> waiters to the entry set. They're BLOCKED because P still holds the lock until it leaves <code>put()</code>.`},
{hl:{C1:[7,8]}, th:[['C1','RUN','re-checks: not empty → poll 7'],['C2','BLOCKED',''],['P','TERM','left put()']], g:[mon('buffer','C1',['C2']), G('Queue (CAP 2)', C('items',[['empty','dim']]))], log:['C1 took 7'],
 say:`P leaves. C1 wins the lock, <code>wait()</code> returns, and the <code>while</code> <b>re-checks</b> the condition: not empty, so it polls 7.`},
{hl:{C1:[9,10],C2:[7]}, th:[['C1','TERM','returned 7'],['C2','WAITING','re-check: EMPTY again → wait()'],['P','TERM','']], g:[mon('buffer',null,[],['C2']), G('Queue (CAP 2)', C('items',[['empty','dim']]))], log:['C2: woke up, but item already gone → waits again'],
 say:`<b>Why <code>while</code>, not <code>if</code>.</b> C2 was woken too, but by the time it gets the lock the item is gone. The <code>while</code> sees "empty" and waits again. With <code>if</code>, C2 would go on to <code>poll()</code> and get <b>null</b>. <b>Spurious wakeups</b> (waking with no notify at all) are also allowed by the spec. Always loop.`},
{th:[['C1','TERM',''],['C2','WAITING','still waiting'],['P','TERM','']], g:[G('notify() vs notifyAll()',['notify()','wakes ONE random waiter'],['risk','wakes another consumer while a producer waits → everyone sleeps','bad'],['notifyAll()','wakes all; each re-checks its while','ok'],['better tool','Lock + 2 Conditions (notFull, notEmpty)','ok'])],
 say:`With <code>notify()</code> the JVM picks <b>one</b> waiter. If producers and consumers share one wait set, a consumer might wake another consumer instead of a producer. Then nobody makes progress, a "missed signal" stall. <code>notifyAll()</code> is safe. <code>ReentrantLock</code> with two <code>Condition</code>s wakes only the right kind, and <code>BlockingQueue</code> does all of this for you.`},
{g:[G('sleep(ms) vs wait()',['releases the lock?','sleep ✘ · wait ✔'],['needs synchronized?','sleep ✘ · wait ✔ (else IllegalMonitorStateException)'],['woken by','sleep: time, interrupt · wait: notify, interrupt, timeout'],['defined on','sleep: Thread (static) · wait: Object'])],
 say:`Interview table. Also: <code>join()</code> waits for another thread to end (implemented with wait). Stop a thread with <code>interrupt()</code> and have it exit cleanly. Never use the deprecated <code>stop()</code>.`}
],
keep:[`Call wait/notify only while holding that object's lock.`,`<code>while (!condition) wait();</code> always a loop.`,`Prefer notifyAll, or better: Condition objects / BlockingQueue.`]}, {
  imp: 'good',
  theory: TH(`wait/notify lets a thread sleep until some condition becomes true and another thread wakes it, all while sharing one object's lock.`,
`<p>A consumer wants to take from a buffer, but it's empty. Spinning in a loop wastes CPU. Instead, while holding the buffer's lock, it calls <code>wait()</code>: it releases the lock and sleeps. A producer later adds an item and calls <code>notifyAll()</code> to wake the sleepers. A woken thread must re-acquire the lock and <b>re-check</b> the condition, because another consumer may have taken the item first.</p>`,
[[`wait()`,`Release the monitor and sleep until notified.`],[`notify() / notifyAll()`,`Wake one / all threads waiting on this monitor.`],[`Spurious wakeup`,`Waking up without a notify; another reason to re-check.`],[`Condition`,`Lock-based equivalent with separate wait sets.`]],
[`Acquire the lock (synchronized).`,`<code>while (!condition) wait();</code>`,`Act on the state.`,`The other side changes the state and calls notifyAll() while holding the lock.`],
[`In real code use higher-level tools: BlockingQueue for producer/consumer, CountDownLatch, CompletableFuture.`],
[`Calling wait/notify without holding the lock (IllegalMonitorStateException).`,`Using if instead of while around wait().`,`notify() waking the wrong kind of waiter.`]),
  quiz: [
    [`Calling <code>obj.wait()</code> without holding obj's lock?`,[`IllegalMonitorStateException`,`It works normally`,`The thread waits forever`,`It deadlocks`],0,`wait/notify must be called while holding that object's monitor.`,'E'],
    [`Why check the condition in a <code>while</code> loop around wait()?`,[`An if is enough as long as you use notifyAll`,`Otherwise wait() would return immediately`,`To avoid ConcurrentModificationException`,`Spurious wakeups, or the condition changed again`],3,`Always: while (!ready) wait();`,'M'],
    [`Producers and consumers share one monitor; a producer calls <code>notify()</code>. Risk?`,[`None: notify wakes the longest waiter, which is a consumer`,`It may wake another producer, and then everyone ends up waiting`,`notify releases the lock immediately`,`notify throws if nobody is waiting`],1,`One wait set holds both kinds of waiters. Use notifyAll, separate Conditions, or a BlockingQueue.`,'H'],
    [`What does <code>notifyAll()</code> do?`,[`Wakes every thread waiting on that object's monitor`,`Releases the monitor immediately so waiters can run`,`Interrupts every thread blocked on that monitor`,`Wakes every waiting thread in the JVM, on any object`],0,`They then compete for the lock.`,'E'],
    [`Does <code>wait()</code> release the monitor?`,[`No: it keeps holding the monitor while it waits`,`Yes, while waiting; it's re-acquired before returning`,`Only when called with a timeout argument`,`Yes, and it returns without re-acquiring it`],1,`Unlike sleep().`,'E'],
    [`What is a spurious wakeup?`,[`A notify() sent when no thread is waiting yet`,`A thread returning from wait() without being notified`,`A thread woken by an interrupt during sleep()`,`A GC pause that briefly wakes all threads`],1,`Hence while loops.`,'M'],
    [`Higher-level replacement for wait/notify producer-consumer?`,[`Thread.sleep`,`BlockingQueue`,`HashMap`,`volatile`],1,`put/take block as needed.`,'E'],
    [`Which object should you call wait() on?`,[`Thread.currentThread(), since the current thread waits`,`The object whose lock you hold and that guards the condition`,`Any object, as long as some thread will notify it`,`The Thread object of the thread that will notify you`],1,`Lock, condition and wait must be on the same monitor.`,'M'],
  ],
  quizAdv: [
    [`A wait/notify producer-consumer keeps hanging. Simplest robust replacement?`,[`Thread.sleep polling`,`volatile flags`,`More notify() calls`,`A BlockingQueue`],3,`It handles waiting, signalling and back-pressure.`,'M'],
    [`Condition objects vs wait/notify: main benefit?`,[`They don't need a lock at all`,`They never wake up spuriously`,`Several wait sets per lock`,`They're faster in every case`],2,`You signal only the waiters who can proceed.`,'H'],
    [`What is a "lost wakeup"?`,[`A notify that happens before the other thread starts waiting, so it waits forever`,`Two threads each holding a lock the other needs, waiting forever`,`A notifyAll() that wakes threads waiting on a different object`,`A GC pause that drops pending notifications from the wait set`],0,`Checking the condition under the lock prevents it.`,'H'],
    [`<code>Condition.await()</code> belongs to?`,[`Object (every object has one)`,`A Lock (from lock.newCondition())`,`Thread (from currentThread())`,`An ExecutorService (from submit())`],1,`Lock + Conditions = explicit monitors.`,'M'],
  ],
});
