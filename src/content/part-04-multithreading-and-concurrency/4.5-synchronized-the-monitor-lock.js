/* 4.5 synchronized: the monitor lock */
topic('4', { no:'4.5', title:'synchronized: the monitor lock', idea:`Every object has one monitor. One owner at a time; the rest BLOCK in the entry set.`,
codes:{a:`class Counter {
  private int count;
  synchronized void inc() {        // lock = this
    count++;
    log();                         // re-entrant: same lock again
  }
  synchronized void log() { print(count); }
  static synchronized void reset() {}   // lock = Counter.class
}
// threads A, B, C all call counter.inc() on ONE Counter`},
steps:[
{th:[['A','READY','calling inc()'],['B','READY','calling inc()'],['C','READY','calling inc()']], g:[mon('counter',null,[],[],[['hold count','0']]), G('Heap',['counter.count','0'])],
 say:`Three threads call <code>inc()</code> on the same Counter. A synchronized instance method locks <code>this</code>, the counter object's monitor. Each monitor has an <b>owner</b>, an <b>entry set</b> (BLOCKED threads) and a <b>wait set</b> (threads that called wait).`},
{hl:{A:[3]}, th:[['A','RUN','owns monitor'],['B','READY',''],['C','READY','']], g:[mon('counter','A',[],[],[['hold count','1','hot']]), G('Heap',['counter.count','0'])],
 say:`A gets there first and acquires the monitor. Hold count = 1.`},
{hl:{A:[4],B:[3],C:[3]}, th:[['A','RUN','count++'],['B','BLOCKED','entry set'],['C','BLOCKED','entry set']], g:[mon('counter','A',['B','C'],[],[['hold count','1']]), G('Heap',['counter.count','1','hot'])],
 say:`B and C hit the method while A owns the lock, so both are <b>BLOCKED</b>. A runs <code>count++</code> with no interference.`},
{hl:{A:[5,7]}, th:[['A','RUN','inside log(), same lock'],['B','BLOCKED',''],['C','BLOCKED','']], g:[mon('counter','A',['B','C'],[],[['hold count','2','hot']]), G('Heap',['counter.count','1'])], log:['A: 1'],
 say:`<b>Re-entrancy.</b> <code>log()</code> is also synchronized on <code>this</code>. A already owns the lock, so the JVM just bumps the hold count to 2. If locks weren't re-entrant, a thread would deadlock with itself here.`},
{hl:{A:[6]}, th:[['A','TERM','left inc()'],['B','READY','competing'],['C','READY','competing']], g:[mon('counter',null,[],[],[['hold count','0','hot']]), G('Heap',['counter.count','1'],['flushed to memory?','yes, at unlock','ok'])],
 say:`A returns from log() (hold 1) and from inc() (hold 0) → monitor released. Unlocking also <b>publishes A's writes</b>: whoever locks next is guaranteed to see <code>count = 1</code>. This visibility guarantee is a happens-before edge (4.6).`},
{hl:{B:[4]}, th:[['A','TERM',''],['B','RUN','owns monitor'],['C','BLOCKED','lost the race']], g:[mon('counter','B',['C'],[],[['hold count','1']]), G('Heap',['counter.count','2','hot'])],
 say:`B wins. With <code>synchronized</code> there is <b>no fairness</b>: C could have won, and a thread that just arrived could even jump ahead. B sees 1 and makes it 2.`},
{hl:{C:[4]}, th:[['A','TERM',''],['B','TERM',''],['C','RUN','owns monitor']], g:[mon('counter','C',[],[],[['hold count','1']]), G('Heap',['counter.count','3','ok'])], log:['B: 2','C: 3'],
 say:`B releases and C runs. Final 3, correct. The cost is that the three increments ran <b>one after another</b>. Keep critical sections small. <code>synchronized (this) { ... }</code> around only the shared part helps.`},
{hl:{A:[8],B:[3]}, th:[['A','RUN','in static reset()'],['B','RUN','in inc()']], g:[mon('Counter.class','A'), mon('counter (this)','B')],
 say:`<code>static synchronized</code> locks the <b>Class object</b>, a different monitor. A in <code>reset()</code> and B in <code>inc()</code> <b>don't block each other</b>. That's a common bug when static and instance methods touch the same static field.`}
],
keep:[`Instance method locks <code>this</code>; static locks <code>X.class</code>; a block locks the object you name.`,`Re-entrant, unfair, can't time out, can't be interrupted while BLOCKED.`,`Gives atomicity <b>and</b> visibility (unlock → lock is happens-before).`]}, {
  imp: 'must',
  theory: TH(`synchronized lets only one thread at a time run a block of code guarded by a given object's lock, and guarantees that thread sees the previous holder's writes.`,
`<p>Every Java object has a built-in lock called a <b>monitor</b>. Wrapping code in <code>synchronized (obj) { … }</code> means "acquire obj's lock, run this, release it". If another thread holds it, you wait (BLOCKED). Like a single-occupancy bathroom with one key: only the person holding the key is inside.</p>
<p>A synchronized instance method locks <code>this</code>; a static synchronized method locks the Class object. Releasing a lock also <b>publishes</b> all writes made inside it to the next thread that takes the same lock.</p>`,
[[`Monitor`,`The lock every object has.`],[`Re-entrant`,`A thread already holding a lock can take it again (nested calls) without deadlocking.`],[`Entry set`,`Threads blocked waiting to acquire the monitor.`],[`Contention`,`Many threads competing for the same lock.`]],
[`Thread reaches synchronized: if the monitor is free it takes it, otherwise it blocks.`,`It runs the critical section; nested synchronized calls on the same lock just increase a counter.`,`On exit (even via exception) the lock is released and writes are made visible.`,`One of the blocked threads (in no guaranteed order) gets the lock next.`],
[`Keep critical sections small; never do I/O while holding a lock.`,`Lock on a private final object, not on <code>this</code> or a String literal.`],
[`Static and instance synchronized methods guarding the same data with different locks.`,`Locking on a field that gets reassigned.`]),
  quiz: [
    [`A synchronized method calls another synchronized method on the same object. What happens?`,[`It deadlocks on itself`,`IllegalMonitorStateException`,`The hold count goes up (re-entrant)`,`The second method runs unsynchronized`],2,`The owning thread can re-enter the monitor it already holds.`,'E'],
    [`Besides mutual exclusion, what does synchronized guarantee?`,[`Visibility: earlier writes are seen by the next locker`,`Fairness: threads get the lock in arrival order`,`Timeouts: blocked threads eventually give up`,`Nothing beyond mutual exclusion`],0,`Unlock → lock on the same monitor is a happens-before edge.`,'M'],
    [`<code>static synchronized void reset()</code> and <code>synchronized void inc()</code> both modify a static field. Mutually exclusive?`,[`Yes: both lock the class's monitor`,`Yes, if the field is volatile`,`Yes: static synchronized locks every instance too`,`No: one locks Counter.class, the other locks this`],3,`Different monitors mean no mutual exclusion.`,'H'],
    [`A synchronized block <code>synchronized (lock) { … }</code> locks?`,[`The current method for all callers`,`The monitor of the lock object`,`The Class object of the lock's type`,`Every field of the enclosing object`],1,`Pick a private final lock object.`,'E'],
    [`Thread A holds a monitor. Thread B tries to enter a block on the same monitor. B's state?`,[`WAITING`,`BLOCKED`,`RUNNABLE`,`TERMINATED`],1,`Waiting for the monitor.`,'E'],
    [`Is synchronized fair (first come, first served)?`,[`Yes: waiters are queued and served in order`,`No: any waiting thread may get the lock next`,`Yes, but only for static synchronized methods`,`Only when the JVM is started in fair-lock mode`],1,`ReentrantLock(true) offers fairness.`,'M'],
    [`An exception is thrown inside a synchronized block. Is the lock released?`,[`No, deadlock`,`Yes, automatically`,`Only with finally`,`Only for RuntimeException`],1,`Monitors are released on any exit.`,'M'],
    [`Why keep synchronized blocks small?`,[`The JIT can't optimize code inside large synchronized blocks`,`Other threads wait while you hold the lock; long sections kill throughput`,`Locked objects can't be GC'd, so big blocks hold more memory`,`Long blocks trip the JVM's deadlock detector and get aborted`],1,`Never do I/O while holding a lock.`,'E'],
  ],
  quizAdv: [
    [`<code>synchronized ("lock") { … }</code> on a String literal. Problem?`,[`All code locking that literal shares one lock`,`Nothing: each block gets its own lock`,`Compile error: Strings can't be locked`,`Each call creates a new lock object`],0,`Unrelated libraries can contend or deadlock. Lock a private final Object.`,'H'],
    [`<code>synchronized (count) { count++; }</code> with an Integer field. Problem?`,[`None: Integer is immutable, so it's safe`,`Threads end up locking different objects`,`Compile error: wrappers can't be locked`,`It deadlocks on the second call`],1,`Never lock on a field you reassign.`,'H'],
    [`Why lock on a private final object instead of <code>this</code>?`,[`The JMM requires lock objects to be final fields for visibility`,`Outside code can also lock on this, causing unexpected contention or deadlock`,`Locking on this is slower because it inflates the object header`,`Locking this blocks every method of the class, even unsynchronized ones`],1,`Encapsulate your lock.`,'M'],
    [`Since Java 15, biased locking was...`,[`Enabled by default for all synchronized blocks`,`Disabled and later removed; uncontended locking is already cheap`,`Made mandatory to support virtual threads`,`Replaced by fair locking for every monitor`],1,`JEP 374.`,'H'],
  ],
});
