/* 4.3 Thread lifecycle */
topic('4', { no:'4.3', title:'Thread lifecycle', idea:`Follow one thread through every state: NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED.`,
codes:{a:`Object lock = new Object();
Thread t = new Thread(() -> {
  synchronized (lock) {        // lock taken? -> BLOCKED
    lock.wait();               // -> WAITING, releases lock
  }
  Thread.sleep(500);           // -> TIMED_WAITING
});                            // run() returns -> TERMINATED

synchronized (lock) {          // main grabs the lock first
  t.start();                   // NEW -> RUNNABLE
  doSomething();
}
// ... later, main:
synchronized (lock) { lock.notify(); }`},
steps:[
{hl:{main:[2]}, th:[['main','RUN',''],['t','NEW','object created']], g:[mon('lock',null)], d:{type:'life',s:'NEW'},
 say:`<b>NEW</b>: the Thread object exists but <code>start()</code> hasn't been called. (InterruptedException handling is left out to keep the code short.)`},
{hl:{main:[9]}, th:[['main','RUN','owns lock'],['t','NEW','']], g:[mon('lock','main')],
 say:`Main enters <code>synchronized (lock)</code> and becomes the <b>owner</b> of lock's monitor.`},
{hl:{main:[10]}, th:[['main','RUN','owns lock'],['t','READY','started']], d:{type:'life',s:'RUNNABLE',e:'NEW-RUNNABLE'},
 say:`<code>t.start()</code> → <b>RUNNABLE</b>. Java has no separate "running" state: RUNNABLE means either running on a CPU or ready and waiting for one.`},
{hl:{main:[11],t:[3]}, th:[['main','RUN','still owns lock'],['t','BLOCKED','wants lock, main has it']], g:[mon('lock','main',['t'])], d:{type:'life',s:'BLOCKED',e:'RUNNABLE-BLOCKED'},
 say:`t reaches <code>synchronized (lock)</code> while main still owns it, so t goes into the monitor's <b>entry set</b> as <b>BLOCKED</b>. BLOCKED only ever means "waiting to enter a synchronized block/method".`},
{hl:{main:[12],t:[3]}, th:[['main','RUN','left the block'],['t','RUN','now owns lock']], g:[mon('lock','t')], d:{type:'life',s:'RUNNABLE',e:'RUNNABLE-BLOCKED'},
 say:`Main leaves the block and releases the lock. t acquires it and is RUNNABLE again, running inside the synchronized block.`},
{hl:{t:[4]}, th:[['main','RUN','doing other work'],['t','WAITING','in wait set, lock released']], g:[mon('lock',null,[],['t'])], d:{type:'life',s:'WAITING',e:'RUNNABLE-WAITING'},
 say:`<code>lock.wait()</code> does three things in one go: it <b>releases the lock</b>, puts t into the <b>wait set</b>, and parks it as <b>WAITING</b> with no timeout. <code>join()</code> and <code>LockSupport.park()</code> also lead to WAITING.`},
{hl:{main:[14]}, th:[['main','RUN','owns lock, calling notify()'],['t','BLOCKED','woken, needs the lock back']], g:[mon('lock','main',['t'],[])], d:{type:'life',s:'BLOCKED',e:'WAITING-BLOCKED'}, log:['notify(): t moved wait set → entry set'],
 say:`Subtle point: <code>notify()</code> moves t from the wait set to the <b>entry set</b>. It can't continue yet because main still owns the lock, so t is <b>BLOCKED</b> until main leaves the block.`},
{hl:{t:[5]}, th:[['main','RUN','released lock'],['t','RUN','returned from wait()']], g:[mon('lock',null)], d:{type:'life',s:'RUNNABLE',e:'RUNNABLE-BLOCKED'},
 say:`Main exits, t gets the lock back, <code>wait()</code> returns, and t leaves the synchronized block, releasing the lock.`},
{hl:{t:[6]}, th:[['main','RUN',''],['t','TIMED','sleeping 500 ms, holds no lock']], d:{type:'life',s:'TIMED_WAITING',e:'RUNNABLE-TIMED_WAITING'},
 say:`<code>Thread.sleep(500)</code> → <b>TIMED_WAITING</b>. Same for <code>wait(ms)</code>, <code>join(ms)</code>, <code>parkNanos</code>. A sleeping thread keeps any lock it holds (here it holds none).`},
{hl:{t:[7]}, th:[['main','RUN',''],['t','RUN','time up, finishing']], d:{type:'life',s:'RUNNABLE',e:'RUNNABLE-TIMED_WAITING'},
 say:`500 ms later the timer fires and t is RUNNABLE again. (An <code>interrupt()</code> would have woken it early with InterruptedException.)`},
{th:[['main','RUN',''],['t','TERM','run() returned']], d:{type:'life',s:'TERMINATED',e:'RUNNABLE-TERMINATED'}, log:['t is TERMINATED; t.isAlive() = false'],
 say:`<code>run()</code> returns (or throws) → <b>TERMINATED</b>. Final state, it cannot be restarted. Any thread in <code>t.join()</code> wakes now.`}
],
keep:[`BLOCKED = waiting for a monitor. WAITING = waiting for a signal. TIMED_WAITING = waiting with a timeout.`,`<code>notify()</code> doesn't hand over the lock. The woken thread goes WAITING → BLOCKED → RUNNABLE.`,`<code>wait()</code> releases the lock; <code>sleep()</code> doesn't.`]}, {
  imp: 'must',
  theory: TH(`A Java thread moves through a few states (NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED), and knowing them is how you read a thread dump.`,
`<p>A thread is <b>NEW</b> until <code>start()</code>. Then it's <b>RUNNABLE</b>: running or ready to run. It becomes <b>BLOCKED</b> if it wants a <code>synchronized</code> lock another thread holds, <b>WAITING</b> if it's waiting for a signal with no time limit (wait, join, park), and <b>TIMED_WAITING</b> when there is a limit (sleep, wait(ms)). When run() ends, it's <b>TERMINATED</b>.</p>
<p>In a thread dump (from <code>jstack</code> or <code>jcmd Thread.print</code>), these states tell you what each thread is stuck on.</p>`,
[[`BLOCKED`,`Waiting to enter a synchronized block or method.`],[`WAITING`,`Waiting indefinitely for another thread's action.`],[`TIMED_WAITING`,`Waiting with a timeout.`],[`Thread dump`,`Snapshot of every thread's state and stack trace.`]],
[`start() → RUNNABLE.`,`Hits a held monitor → BLOCKED until it's free.`,`Calls wait() → releases the lock → WAITING. After notify, it must re-acquire the lock (BLOCKED) before running again.`,`sleep(ms) → TIMED_WAITING, keeping any locks it holds.`],
[`Many threads BLOCKED on one lock → lock contention. Many WAITING in a pool's getConnection → pool exhaustion.`,`A thread doing socket I/O shows as RUNNABLE even though it's waiting.`],
[`Confusing wait() (releases the lock) with sleep() (keeps it).`,`Using sleep() to "wait for" another thread instead of proper signalling.`]),
  quiz: [
    [`A thread is trying to enter a <code>synchronized</code> block another thread holds. Its state?`,[`WAITING`,`TIMED_WAITING`,`RUNNABLE`,`BLOCKED`],3,`BLOCKED means waiting for a monitor lock.`,'E'],
    [`<code>wait()</code> vs <code>sleep(ms)</code> with respect to locks?`,[`Both release the lock while they wait`,`Neither releases the lock while waiting`,`wait() releases the monitor; sleep() keeps it`,`sleep() releases the lock; wait() keeps it`],2,`That's why sleeping inside synchronized blocks other threads.`,'M'],
    [`After <code>notify()</code>, while the notifier still holds the lock, the woken thread's state is?`,[`RUNNABLE, ready to continue`,`BLOCKED: it must re-acquire the monitor`,`Still WAITING until the notifier exits`,`TIMED_WAITING`],1,`notify doesn't hand over the lock; the woken thread competes for it.`,'H'],
    [`A thread calls <code>Thread.sleep(1000)</code>. Its state?`,[`BLOCKED`,`WAITING`,`TIMED_WAITING`,`TERMINATED`],2,`Waiting with a timeout.`,'E'],
    [`A thread calls <code>otherThread.join()</code> (no timeout). Its state?`,[`RUNNABLE`,`WAITING`,`BLOCKED`,`NEW`],1,`Waits indefinitely for the other to end.`,'E'],
    [`Can a TERMINATED thread be restarted?`,[`Yes, call start()`,`No: create a new Thread`,`Yes, with run()`,`Only daemons`],1,`start() on it throws IllegalThreadStateException.`,'M'],
    [`What state is a thread in right after <code>new Thread(r)</code>?`,[`RUNNABLE`,`NEW`,`WAITING`,`READY`],1,`Until start() is called.`,'E'],
    [`What does <code>Thread.interrupt()</code> do to a thread that is just computing (not waiting)?`,[`Throws InterruptedException in it right away`,`Sets its interrupt flag; the code must check it`,`Stops it at the next safepoint automatically`,`Does nothing unless it's a daemon thread`],1,`Interruption is cooperative.`,'M'],
  ],
  quizAdv: [
    [`A thread blocked reading a socket shows which state in a thread dump?`,[`BLOCKED`,`WAITING`,`TIMED_WAITING`,`RUNNABLE`],3,`Native I/O waits aren't Java-level waits, so it looks busy but isn't.`,'H'],
    [`<code>interrupt()</code> on a thread that's in <code>sleep()</code>?`,[`InterruptedException; the flag is cleared`,`The flag is set; sleep runs to the end`,`The thread terminates immediately`,`Nothing happens until sleep ends`],0,`Restore the flag (Thread.currentThread().interrupt()) if you can't propagate it.`,'H'],
    [`A thread waiting to enter a ReentrantLock (not synchronized) shows as?`,[`BLOCKED`,`WAITING (parked)`,`RUNNABLE`,`TIMED_WAITING always`],1,`BLOCKED is only for monitor locks.`,'H'],
    [`What should code do after catching InterruptedException it can't propagate?`,[`Log it and continue, since the flag stays set`,`Restore the flag with Thread.currentThread().interrupt()`,`Call Thread.interrupted() to clear the flag again`,`Call Thread.yield() so the scheduler can handle it`],1,`So callers can still see the interruption.`,'M'],
  ],
});
