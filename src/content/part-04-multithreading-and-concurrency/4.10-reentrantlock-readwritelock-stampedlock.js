/* 4.10 ReentrantLock, ReadWriteLock, StampedLock */
topic('4', { no:'4.10', title:'ReentrantLock, ReadWriteLock, StampedLock', idea:`Explicit locks add timeouts, fairness, interruptibility, and read/write separation.`,
codes:{a:`ReentrantLock lock = new ReentrantLock(true);   // fair: FIFO

void work() throws InterruptedException {
  if (lock.tryLock(1, TimeUnit.SECONDS)) {       // wait at most 1s
    try {
      update();
    } finally {
      lock.unlock();                             // ALWAYS in finally
    }
  } else {
    fallback();                                  // gave up: no deadlock
  }
}`,
b:`ReadWriteLock rw = new ReentrantReadWriteLock();

String get(String k) {
  rw.readLock().lock();
  try { return map.get(k); } finally { rw.readLock().unlock(); }
}
void put(String k, String v) {
  rw.writeLock().lock();
  try { map.put(k, v); } finally { rw.writeLock().unlock(); }
}`,
c:`StampedLock sl = new StampedLock();

double distance() {
  long stamp = sl.tryOptimisticRead();   // no lock, just a version
  double cx = x, cy = y;                 // read the fields
  if (!sl.validate(stamp)) {             // did a write happen?
    stamp = sl.readLock();               // fallback: real read lock
    try { cx = x; cy = y; } finally { sl.unlockRead(stamp); }
  }
  return Math.hypot(cx, cy);
}`},
steps:[
{cv:'a', hl:{A:[4,6]}, th:[['A','RUN','holds lock, update()'],['B','READY',''],['C','READY','']], g:[G('ReentrantLock (fair)',['owner','A','hot'],['hold count','1']), G('Wait queue (AQS, FIFO)', C('queue',[['empty','dim']]))],
 say:`A gets the lock. Internally <code>ReentrantLock</code> uses <b>AQS</b> (AbstractQueuedSynchronizer): a CAS on a <code>state</code> int plus a FIFO queue of parked threads.`},
{hl:{B:[4],C:[4]}, th:[['A','RUN','update()'],['B','TIMED','in tryLock, up to 1s'],['C','TIMED','in tryLock, up to 1s']], g:[G('ReentrantLock (fair)',['owner','A'],['hold count','1']), G('Wait queue (AQS, FIFO)', C('queue',['B','C']))],
 say:`B and C call <code>tryLock(1, SECONDS)</code>. They queue in arrival order and park (TIMED_WAITING, not BLOCKED, because explicit locks park the thread). <code>synchronized</code> can't do a timed wait at all.`},
{hl:{A:[8],D:[4]}, th:[['A','TERM','unlock()'],['B','RUN','head of queue → owns lock'],['C','TIMED','still queued'],['D','TIMED','just arrived → back of queue']], g:[G('ReentrantLock (fair)',['owner','B','hot'],['hold count','1']), G('Wait queue (AQS, FIFO)', C('queue',['C','D']))],
 say:`A unlocks in <code>finally</code>. With <b>fair = true</b> the lock goes to the head of the queue (B). D, who just arrived, can't jump ahead. With an unfair lock (the default) D could barge in: better throughput, but possible starvation.`},
{hl:{C:[11]}, th:[['A','TERM',''],['B','RUN','long update()…'],['C','RUN','timed out → fallback()'],['D','TIMED','queued']], g:[G('ReentrantLock (fair)',['owner','B'],['hold count','1']), G('Wait queue (AQS, FIFO)', C('queue',['D']))], log:['C: tryLock returned false after 1s → fallback'],
 say:`B is slow. C's 1 second runs out, <code>tryLock</code> returns false and C runs <code>fallback()</code>. A thread that gives up can't be stuck in a deadlock. <code>lockInterruptibly()</code> also lets another thread cancel the wait.`},
{g:[G('synchronized vs ReentrantLock',['tryLock / timeout','✘ · ✔'],['interruptible wait','✘ · ✔'],['fairness option','✘ · ✔'],['multiple conditions','✘ one wait set · ✔ newCondition()'],['auto release','✔ · ✘ must unlock in finally','bad'])], th:[['B','TERM',''],['D','TERM','']],
 say:`Forgetting <code>unlock()</code>, or not putting it in <code>finally</code>, leaves the lock held forever. That's the price of the extra features. Use <code>synchronized</code> by default and <code>ReentrantLock</code> when you need one of these features.`},
{cv:'b', hl:{R1:[4,5],R2:[4,5],R3:[4,5]}, th:[['R1','RUN','reading'],['R2','RUN','reading'],['R3','RUN','reading'],['W','READY','']], g:[G('ReadWriteLock',C('readers inside',['R1','R2','R3']),['writer','none'])],
 say:`<b>ReadWriteLock</b> for read-heavy data (a config or cache map): <b>many readers at once</b>, because reads don't conflict with each other.`},
{hl:{W:[8]}, th:[['R1','RUN','reading'],['R2','RUN','reading'],['R3','TERM','done'],['W','WAITING','needs readers = 0']], g:[G('ReadWriteLock',C('readers inside',['R1','R2']),C('writer waiting',['W']))],
 say:`W wants to write. A write lock is <b>exclusive</b>, so W waits until every reader has left.`},
{hl:{W:[9],R4:[4]}, th:[['R1','TERM',''],['R2','TERM',''],['W','RUN','alone, map.put'],['R4','WAITING','new reader waits for W']], g:[G('ReadWriteLock',C('readers inside',[['none','dim']]),['writer','W','hot'],C('readers waiting',['R4']))],
 say:`Readers gone, so W writes alone. New readers (R4) wait. Note: you can't upgrade a read lock to a write lock (it deadlocks). Downgrading write → read is allowed.`},
{cv:'c', hl:{R:[4,5]}, th:[['R','RUN','optimistic read: stamp 256'],['W','READY','']], g:[G('StampedLock',['version','256'],['R has stamp','256','hot'],['fields','x=3, y=4'])],
 say:`<b>StampedLock</b> optimistic read: no lock at all, just remember the current version (stamp) and read the fields. Readers never block writers this way.`},
{hl:{W:[1]}, th:[['R','READY','preempted mid-read'],['W','RUN','writeLock: x=6, y=8']], g:[G('StampedLock',['version','384','hot'],['R has stamp','256'],['fields','x=6, y=8 (R may have mixed values)','bad'])],
 say:`A writer slips in and changes x and y, bumping the version. R may now hold a mix of old and new values.`},
{hl:{R:[6,7,8]}, th:[['R','RUN','validate(256) ✘ → readLock → re-read'],['W','TERM','']], g:[G('StampedLock',['version','384'],['validate(256)','false','bad'],['re-read under lock','x=6, y=8','ok'])], log:['distance = 10.0'],
 say:`<code>validate(256)</code> fails, so R falls back to a real read lock and reads again. It's very fast when writes are rare. StampedLock is <b>not re-entrant</b> and has no Conditions.`}
],
keep:[`ReentrantLock: tryLock(timeout), lockInterruptibly, fairness, Conditions. Always unlock in finally.`,`ReadWriteLock: many readers OR one writer. Good for read-mostly data.`,`StampedLock: optimistic read + validate; retry under a real lock.`]}, {
  imp: 'good',
  theory: TH(`The java.util.concurrent locks do what synchronized does plus more: timeouts, interruptibility, fairness, read/write separation and optimistic reads.`,
`<p><b>ReentrantLock</b> is an explicit lock object: <code>lock()</code> ... <code>unlock()</code> in a finally block. Unlike synchronized, you can <code>tryLock(1, SECONDS)</code> and give up, be interrupted while waiting, or ask for fairness.</p>
<p><b>ReadWriteLock</b> lets many readers in at once but only one writer, which suits data that's read constantly and changed rarely. <b>StampedLock</b> adds an optimistic read: read without locking, then check whether a write happened in between.</p>`,
[[`ReentrantLock`,`Explicit, re-entrant mutual-exclusion lock.`],[`tryLock`,`Acquire if possible (optionally within a timeout), else return false.`],[`ReadWriteLock`,`Shared read lock, exclusive write lock.`],[`StampedLock`,`Lock with optimistic reads validated by a stamp.`],[`Condition`,`A wait set attached to a lock (await/signal).`]],
[`<code>lock.lock(); try { … } finally { lock.unlock(); }</code>`,`For timeouts: <code>if (lock.tryLock(1, SECONDS)) { try { … } finally { lock.unlock(); } } else { fallback }</code>`,`For read-mostly data: readers take readLock(), writers take writeLock().`],
[`Use synchronized for simple cases; reach for these when you need their extra features.`,`Virtual threads (pre-JDK 24) prefer ReentrantLock over synchronized to avoid pinning.`],
[`Forgetting unlock() in finally.`,`Trying to upgrade a read lock to a write lock (deadlock).`]),
  quiz: [
    [`Why must <code>lock.unlock()</code> go in a <code>finally</code> block?`,[`Style convention only`,`Otherwise a throw skips it`,`For fairness`,`unlock() throws otherwise`],1,`Explicit locks aren't released automatically like synchronized.`,'E'],
    [`Which ReentrantLock feature does synchronized lack?`,[`Re-entrancy`,`Visibility guarantees`,`Mutual exclusion`,`tryLock with a timeout`],3,`Also lockInterruptibly, fairness and multiple Conditions.`,'M'],
    [`With StampedLock you read x and y after <code>tryOptimisticRead()</code>, and <code>validate(stamp)</code> returns false. Now?`,[`Discard the values and re-read under a real read lock`,`Use them: validate only matters for writes`,`Call unlockRead(stamp)`,`Keep calling validate until it returns true`],0,`False means a write happened; the values may be inconsistent.`,'H'],
    [`What does <code>lock.lockInterruptibly()</code> allow?`,[`Acquiring the lock again without blocking`,`Giving up waiting if the thread is interrupted`,`Waiting for the lock with a fixed timeout`,`Granting the lock in fair arrival order`],1,`synchronized can't be interrupted while blocked.`,'M'],
    [`Is ReentrantLock re-entrant?`,[`No: a second lock() from the same thread deadlocks`,`Yes: the same thread can lock it again; unlock as many times`,`Only when created in fair mode with new ReentrantLock(true)`,`Yes, and a single unlock() releases all nested holds`],1,`Hence the name.`,'E'],
    [`ReadWriteLock allows?`,[`Many writers at once`,`Many readers at once, or one writer`,`Readers and writers at once`,`One reader only`],1,`Good for read-mostly data.`,'E'],
    [`What does a fair ReentrantLock do?`,[`Prevents deadlock by ordering how threads acquire the lock`,`Grants the lock roughly in arrival order, reducing starvation but lowering throughput`,`Runs faster by letting the newest waiter barge in first`,`Gives each thread an equal time slice while holding it`],1,`Fairness has a cost.`,'M'],
    [`Where must unlock() go?`,[`At the end of the method, after the last statement`,`In a finally block right after the try that follows lock()`,`In a catch block so it runs only when errors occur`,`Inside the try block, as its last statement`],1,`Otherwise an exception leaks the lock.`,'E'],
  ],
  quizAdv: [
    [`A config map is read thousands of times a second, written hourly. Which approach?`,[`synchronized on every access`,`A ReadWriteLock or volatile swap`,`A Semaphore with one permit`,`No locking at all`],1,`Readers don't block each other.`,'M'],
    [`Holding a ReentrantReadWriteLock read lock, can a thread take the write lock?`,[`Yes: it's upgraded`,`It throws IllegalMonitorStateException`,`No: it deadlocks waiting on its own read lock`,`Only if the lock is fair`],2,`Upgrading isn't supported. (Downgrading write → read is.)`,'H'],
    [`StampedLock: is it re-entrant?`,[`Yes: it tracks the owner like ReentrantLock`,`No: re-acquiring in the same thread can deadlock`,`Only for read locks, not for write locks`,`Only in optimistic read mode`],1,`Use it carefully, in small sections.`,'H'],
    [`Why might ReentrantReadWriteLock perform worse than a simple lock?`,[`It's deprecated in favour of StampedLock`,`Extra bookkeeping; short sections or many writes erase its gains`,`Readers block each other just like with a plain lock`,`Every read lock forces a full memory barrier on all cores`],1,`Measure before choosing.`,'H'],
  ],
});
