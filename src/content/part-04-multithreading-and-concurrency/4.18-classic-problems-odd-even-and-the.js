/* 4.18 Classic problems: odd/even and the singleton */
topic('4', { no:'4.18', title:'Classic problems: odd/even and the singleton', idea:`Two interview favourites stepped through: two threads printing 1..6 in turn, and double-checked locking.`,
codes:{a:`int n = 1; final int MAX = 6;

synchronized void print(boolean odd) throws InterruptedException {
  while (n <= MAX) {
    while (n <= MAX && (n % 2 == 1) != odd) wait();  // not my turn
    if (n > MAX) break;
    System.out.println(name() + " " + n);
    n++;
    notifyAll();                                       // hand over
  }
}
// thread ODD: print(true)   thread EVEN: print(false)`,
b:`class Config {
  private static volatile Config inst;
  static Config get() {
    if (inst == null) {                   // 1st check: no lock (fast)
      synchronized (Config.class) {
        if (inst == null)                 // 2nd check: under lock
          inst = new Config();            // volatile: no half-built obj
      }
    }
    return inst;
  }
}`},
steps:[
{cv:'a', hl:{EVEN:[3,5]}, th:[['ODD','READY',''],['EVEN','WAITING','n=1 is odd → not my turn']], g:[mon('printer',null,[],['EVEN']), G('Shared',['n','1'])],
 say:`EVEN happens to get the lock first. n = 1 is odd, so it's not EVEN's turn and it calls <code>wait()</code>, releasing the lock. The pattern for "take turns": <b>shared state + while(not my turn) wait() + do + notifyAll()</b>.`},
{hl:{ODD:[7,8]}, th:[['ODD','RUN','prints 1, n → 2'],['EVEN','WAITING','']], g:[mon('printer','ODD',[],['EVEN']), G('Shared',['n','2','hot'])], log:['ODD 1'],
 say:`ODD gets the lock: its turn. It prints 1 and sets n = 2.`},
{hl:{ODD:[9,5]}, th:[['ODD','WAITING','n=2 → not my turn → wait()'],['EVEN','BLOCKED → RUN','woken, gets lock']], g:[mon('printer','EVEN',[],['ODD']), G('Shared',['n','2'])],
 say:`<code>notifyAll()</code> moves EVEN to the entry set. ODD loops, sees n = 2 is not its turn, and waits, which <b>releases the lock</b>. EVEN acquires it.`},
{hl:{EVEN:[7,8,9]}, th:[['ODD','BLOCKED','woken, needs lock'],['EVEN','RUN','prints 2, n → 3']], g:[mon('printer','EVEN',['ODD']), G('Shared',['n','3','hot'])], log:['EVEN 2'],
 say:`EVEN re-checks its while loop (it's EVEN's turn), prints 2, n = 3, and notifies ODD. They <b>ping-pong</b> like this.`},
{th:[['ODD','RUN',''],['EVEN','WAITING','']], g:[mon('printer','ODD',[],['EVEN']), G('Shared',['n','6'])], log:['ODD 3','EVEN 4','ODD 5'],
 say:`… the same hand-off repeats for 3, 4, 5. Without the lock, both could print at once. Without wait/notify, they would busy-spin and burn CPU.`},
{hl:{EVEN:[7,8,9]}, th:[['ODD','BLOCKED','woken'],['EVEN','RUN','prints 6, n → 7']], g:[mon('printer','EVEN',['ODD']), G('Shared',['n','7','hot'])], log:['EVEN 6'],
 say:`EVEN prints 6 and n = 7. The final <code>notifyAll()</code> matters: without it ODD would wait forever and the program would never exit.`},
{hl:{ODD:[5,6],EVEN:[4]}, th:[['ODD','TERM','n > MAX → break'],['EVEN','TERM','loop ends']], g:[mon('printer',null), G('Shared',['n','7'])], log:['✔ both threads exit'],
 say:`Both see n &gt; MAX and exit. The <code>n &lt;= MAX</code> check in the inner while is what stops ODD from waiting forever. Generalize to K threads printing 1..N: thread i's turn is <code>n % K == i</code>.`},
{cv:'b', logReset:true, hl:{A:[4],B:[4]}, th:[['A','RUN','inst == null'],['B','RUN','inst == null']], g:[G('Static',['Config.inst','null']), mon('Config.class',null)],
 say:`<b>Double-checked locking singleton.</b> A and B both call <code>get()</code> for the first time and both pass the 1st check, which has no lock so it's cheap.`},
{hl:{A:[5,6,7],B:[5]}, th:[['A','RUN','2nd check null → new Config()'],['B','BLOCKED','waiting for Config.class']], g:[G('Static',['Config.inst','→ Config@9f','hot']), mon('Config.class','A',['B'])],
 say:`A gets the lock, the 2nd check is still null, and A creates the instance. B is blocked.`},
{hl:{B:[6,10]}, th:[['A','TERM','returns Config@9f'],['B','RUN','2nd check: NOT null → skip']], g:[G('Static',['Config.inst','→ Config@9f']), mon('Config.class','B')], log:['B: reuses Config@9f ✔ only one instance'],
 say:`B gets the lock and the <b>2nd check</b> sees the instance, so it doesn't create a second one. Without the 2nd check, B would create another instance. That's why both checks are needed.`},
{hl:{C:[4,10]}, th:[['A','TERM',''],['B','TERM',''],['C','RUN','1st check not null → no lock']], g:[G('Static',['Config.inst','→ Config@9f']), mon('Config.class',null)],
 say:`Every later call takes the fast path: no lock at all.`},
{hl:{C:[7]}, th:[['A','RUN','new Config() reordered'],['C','RUN','sees non-null, fields = 0 / null']], g:[G('Without volatile',['1. allocate memory','Config@9f'],['2. inst = ref (moved earlier!)','visible to C','bad'],['3. run constructor','not done yet'],['C reads inst.url','null → NPE','bad'])],
 say:`<b>Why volatile.</b> <code>inst = new Config()</code> is allocate, construct, assign, and the JIT/CPU may <b>reorder</b> it to assign before construct. Without volatile, C could see a non-null <b>half-built</b> object. volatile forbids that reorder. Simpler options: the <b>holder idiom</b> (<code>static class Holder { static final Config I = new Config(); }</code>, lazy and thread-safe through class loading) or an <b>enum</b> singleton.`},
{th:[], g:[G('Problem → pattern',['odd/even, 1..N with K threads','shared n + while(!turn) wait + notifyAll'],['producer-consumer','BlockingQueue (or Lock + 2 Conditions)'],['thread-safe singleton','volatile DCL / holder / enum'],['bank transfer','lock ordering by id'],['wait for N tasks','CountDownLatch / allOf'],['limit concurrency to K','Semaphore(K)'],['thread-safe counter','AtomicInteger / LongAdder'],['dining philosophers','lock ordering or Semaphore(n−1)'])],
 say:`The whole of Part 4 maps to these patterns. Debugging a hung service: take 2–3 thread dumps a few seconds apart (<code>jcmd &lt;pid&gt; Thread.print</code>). Look for many threads BLOCKED on the same lock, a reported deadlock, or every pool thread stuck in the same I/O call.`}
],
keep:[`Turn-taking = shared state + while-wait + notifyAll; always handle the final exit.`,`DCL needs both checks and volatile; holder idiom / enum are simpler.`,`Hung app → several thread dumps, compare.`]}, {
  imp: 'good',
  theory: TH(`Classic interview puzzles (alternating odd/even printing, a thread-safe lazy singleton) test whether you can combine locks, conditions and visibility correctly.`,
`<p><b>Odd/even</b>: two threads must print 1, 2, 3… in turn. They share a counter and a lock; each waits until it's its turn, prints, increments, and wakes the other. The tricky bits are the loop condition and the final exit (the last thread must still wake the other, or it waits forever).</p>
<p><b>Lazy singleton</b>: create the instance only when first needed, exactly once, even with many threads. Double-checked locking works only with a volatile field; the holder idiom and enums are simpler.</p>`,
[[`Turn-taking`,`Threads alternating based on shared state.`],[`Double-checked locking`,`Check, lock, check again, create; needs volatile.`],[`Holder idiom`,`Lazy init through a nested class.`]],
[`Shared state (counter, whose turn), one lock.`,`Each thread: <code>while (notMyTurn) wait();</code> then act, update state, notifyAll().`,`Make sure both threads exit cleanly at the end.`],
[`Real code would use a SynchronousQueue, semaphores or CompletableFuture rather than wait/notify.`,`When something hangs, take several thread dumps and compare them.`],
[`Missing the final notifyAll.`,`Double-checked locking without volatile.`]),
  quiz: [
    [`An app hangs. Best first diagnostic?`,[`Several thread dumps a few seconds apart`,`Increase the number of threads`,`Restart it with more heap`,`Add log statements and redeploy`],0,`Repeated dumps show which threads are stuck and which progress, and who owns which lock.`,'E'],
    [`Odd/even threads alternate with wait/notify. One thread hangs at the very end. Typical cause?`,[`There are too many threads for the CPU count`,`The last thread exits without waking the other`,`The shared counter isn't declared volatile`,`The Integer cache hands both threads one object`],1,`Always handle the termination case and wake the other side.`,'M'],
    [`In double-checked locking, why is the second null check (inside synchronized) needed?`,[`It's only there to make it faster`,`It avoids a NullPointerException on return`,`It isn't needed if the field is volatile`,`Two threads can pass the first check together`],3,`The outer check avoids locking; the inner one ensures one creation.`,'H'],
    [`Two threads must print alternately. What shared state do they need?`,[`Two separate locks, one held by each thread`,`A lock plus a variable saying whose turn it is`,`A static final flag fixed at startup`,`Nothing, if both threads call Thread.yield()`],1,`Each waits until it's their turn.`,'E'],
    [`Simplest thread-safe lazy singleton in Java?`,[`DCL without volatile`,`The holder idiom or an enum`,`synchronized on every line`,`A static block with sleep`],1,`The JVM handles the safety.`,'E'],
    [`Producer-consumer interview question: best modern answer?`,[`wait/notify guarded by an if check`,`A BlockingQueue with put/take`,`Polling a list with Thread.sleep`,`A volatile ArrayList shared by both`],1,`Mention wait/notify as the low-level alternative.`,'M'],
    [`How would you print numbers 1–10 with 3 threads in round-robin order?`,[`Three independent loops, each printing its own numbers`,`A shared counter plus lock/condition; each waits for its turn`,`One volatile int that all three threads increment freely`,`Start the threads in order; the OS keeps them in sequence`],1,`Generalises odd/even.`,'M'],
    [`What makes a classic "bank transfer" concurrency answer correct?`,[`Marking both balances volatile so updates are visible`,`Locking both accounts in a consistent order (by id) to avoid deadlock`,`Synchronizing on the source account for the whole transfer`,`Locking the source, then the target, in the order of the call`],1,`Plus checks inside the locked section.`,'M'],
  ],
  quizAdv: [
    [`Which singleton needs a <code>volatile</code> field?`,[`The enum singleton`,`Double-checked locking`,`The holder idiom`,`An eager static final field`],1,`The others rely on class initialisation guarantees.`,'M'],
    [`Odd/even printing with semaphores. Usual setup?`,[`One semaphore with 2 permits`,`One semaphore per number`,`Two semaphores: (1) and (0)`,`A CountDownLatch per turn`],2,`Each thread acquires its own and releases the other's after printing.`,'M'],
    [`Implement a thread-safe bounded cache with LRU eviction quickly?`,[`A ConcurrentHashMap alone, relying on its built-in LRU`,`LinkedHashMap LRU wrapped in a lock, or (better) Caffeine`,`A HashMap with a volatile field for each entry`,`A WeakHashMap, letting the GC handle eviction`],1,`CHM has no eviction order.`,'H'],
    [`A rate limiter allowing N requests per second across threads. A simple approach?`,[`Thread.sleep(1000 / N) before each request in every caller thread`,`A token bucket (AtomicLong + timestamps) or a Semaphore refilled on a schedule`,`A synchronized counter that rejects all calls after N in total`,`A volatile boolean that a timer flips back on once per second`],1,`Libraries: Resilience4j RateLimiter, Bucket4j.`,'H'],
  ],
});
