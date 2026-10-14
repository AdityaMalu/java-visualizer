/* 4.4 The race condition */
topic('4', { no:'4.4', title:'The race condition', idea:`<code>count++</code> looks atomic but is three steps. Interleave two threads and an update disappears.`,
codes:{a:`static int count = 0;

void inc() {
  int tmp = count;   // READ   (getstatic)
  tmp = tmp + 1;     // ADD    (iadd)
  count = tmp;       // WRITE  (putstatic)
}                    // this is what count++ really does`},
steps:[
{th:[['A','READY','about to call inc()'],['B','READY','about to call inc()']], g:[G('Heap',['count','0']),G('A · register',['tmp','—']),G('B · register',['tmp','—'])],
 say:`Two threads each call <code>inc()</code> once. We expect <b>2</b>. In bytecode, <code>count++</code> is three separate instructions, and the scheduler can switch threads <b>between any two of them</b>.`},
{hl:{A:[4]}, th:[['A','RUN','READ count → 0'],['B','READY','']], g:[G('Heap',['count','0']),G('A · register',['tmp','0','hot']),G('B · register',['tmp','—'])],
 say:`A reads count (0) into its register.`},
{hl:{B:[4]}, th:[['A','READY','preempted after READ'],['B','RUN','READ count → 0']], g:[G('Heap',['count','0']),G('A · register',['tmp','0']),G('B · register',['tmp','0','hot'])], log:['context switch A → B'],
 say:`<b>Context switch.</b> A is paused before it could write. B reads count, which is <b>still 0</b>.`},
{hl:{B:[5]}, th:[['A','READY',''],['B','RUN','ADD → 1']], g:[G('Heap',['count','0']),G('A · register',['tmp','0']),G('B · register',['tmp','1','hot'])],
 say:`B adds 1 in its own register. Memory is untouched.`},
{hl:{A:[5]}, th:[['A','RUN','ADD → 1'],['B','READY','preempted']], g:[G('Heap',['count','0']),G('A · register',['tmp','1','hot']),G('B · register',['tmp','1'])], log:['context switch B → A'],
 say:`Switch back to A. A adds 1 to the stale 0 it read earlier.`},
{hl:{A:[6]}, th:[['A','TERM','WRITE 1'],['B','READY','']], g:[G('Heap',['count','1','hot']),G('A · register',['tmp','1']),G('B · register',['tmp','1'])],
 say:`A writes 1. So far it looks correct.`},
{hl:{B:[6]}, th:[['A','TERM',''],['B','TERM','WRITE 1']], g:[G('Heap',['count','1','bad'],['expected','2']),G('A · register',['tmp','1']),G('B · register',['tmp','1'])], log:['✘ final count = 1, expected 2 (lost update)'],
 say:`B writes <b>its</b> 1 over A's 1. One increment is <b>lost</b>. This is a <b>race condition</b>: the result depends on timing. It is rare in a single run and certain over millions of runs.`},
{th:[['A','TERM',''],['B','TERM','']], g:[G('With synchronized / AtomicInteger', C('time →',[['A READ 0','hot'],['A ADD 1','hot'],['A WRITE 1','hot'],['B READ 1','ok'],['B ADD 2','ok'],['B WRITE 2','ok']]), ['count','2','ok'])], log:['✔ with a lock: count = 2'],
 say:`<b>The fix</b> makes READ-ADD-WRITE indivisible. With <code>synchronized</code> (4.5) B is BLOCKED until A has written. <code>AtomicInteger.incrementAndGet()</code> (4.7) does it with one CPU instruction. A <code>ReentrantLock</code> (4.10) works too.`},
{g:[G('Real run: 2 threads × 100,000 inc()', ['expected','200000'],['typical result','137412','bad'],['changes every run?','yes','bad']), G('Same bug, other shape: check-then-act', ['if (!map.containsKey(k))','both see false'],['  map.put(k, v)','both put','bad'],['fix','putIfAbsent / computeIfAbsent','ok'])],
 say:`Two common race shapes. <b>Read-modify-write</b> (<code>count++</code>) and <b>check-then-act</b> (<code>if (absent) put</code>, lazy init, "if balance ≥ amt then debit"). Both need the check and the action to happen as <b>one atomic unit</b>.`}
],
keep:[`<code>count++</code> = READ, ADD, WRITE. Not atomic.`,`Race = correctness depends on interleaving. Lost update and check-then-act are the two classic shapes.`,`Fixes: synchronized, Lock, Atomic*, or don't share (confinement, immutability).`]}, {
  imp: 'must',
  theory: TH(`A race condition happens when the result depends on the timing of threads; the classic example is two threads incrementing the same counter and losing updates.`,
`<p><code>count++</code> looks like one step, but it's three: <b>read</b> the value, <b>add</b> one, <b>write</b> it back. If two threads both read 5 before either writes, both write 6, and one increment is lost. Nothing crashes, the number is just wrong, sometimes.</p>
<p>The other common shape is <b>check-then-act</b>: "if the seat is free, book it". Two threads can both see "free" and both book. Any time a decision is made from a value another thread might change before you act on it, you have a race.</p>`,
[[`Race condition`,`Correctness depends on thread interleaving.`],[`Atomic`,`Happens as one indivisible step; no one sees it half done.`],[`Critical section`,`Code that must not run in two threads at once.`],[`Thread-safe`,`Behaves correctly when used from many threads.`]],
[`Identify shared mutable state.`,`Identify compound actions on it (read-modify-write, check-then-act).`,`Make each compound action atomic (lock, atomic class, or a single atomic operation like putIfAbsent), or stop sharing.`],
[`Prefer immutable objects and thread confinement (each thread has its own data).`,`Across multiple servers, the same races happen in the database; use conditional updates or optimistic locking (6.1).`],
[`Believing a race is unlikely because tests pass; it's rare per run and certain at scale.`,`"Fixing" a race with volatile, which doesn't make ++ atomic.`]),
  quiz: [
    [`Two threads each run <code>count++</code> 100,000 times on a shared int. Typical result?`,[`Often less than 200,000: increments are lost`,`Always 200,000, since int writes are atomic`,`Exactly 100,000`,`Always 200,000 on a multi-core CPU`],0,`count++ is read, add, write. Interleavings lose updates.`,'E'],
    [`<pre>if (!map.containsKey(k)) map.put(k, v);</pre>on a ConcurrentHashMap from many threads. Safe?`,[`Yes: ConcurrentHashMap makes it thread-safe`,`Yes, as long as the key is immutable`,`Only if the map field is declared volatile`,`No: the pair isn't atomic; use putIfAbsent`],3,`Check-then-act needs the check and the action to be one atomic operation.`,'M'],
    [`Which does NOT fix a lost-update race on a counter?`,[`AtomicInteger.incrementAndGet()`,`Making the field volatile`,`synchronized around the increment`,`LongAdder.increment()`],1,`volatile gives visibility, not atomicity of read-modify-write.`,'H'],
    [`What is a race condition?`,[`Two threads waiting on each other's locks`,`A result that depends on the timing of threads`,`A loop that spins until another thread ends`,`Threads competing to start first in a pool`],1,`Correctness depends on interleaving.`,'E'],
    [`Which pattern is a check-then-act race?`,[`count++ on a shared int field from many threads`,`if (!map.containsKey(k)) map.put(k, v) from many threads`,`map.computeIfAbsent(k, f) on a ConcurrentHashMap`,`Reading a final field set in the constructor from many threads`],1,`Two threads can both see "absent".`,'E'],
    [`Simplest way to avoid races on shared data?`,[`Mark every shared field volatile to make it safe`,`Don't share mutable state: immutability or confinement`,`Add Thread.sleep() calls to space out accesses`,`Run more threads so each touches less data`],1,`No sharing, no race.`,'M'],
    [`Lazy initialisation <code>if (instance == null) instance = new X();</code> from many threads. Problem?`,[`Threads deadlock on the null check forever`,`Several instances may be created (and published unsafely)`,`None: reference assignment is atomic, so it's safe`,`The JIT removes the null check, so X is never built`],1,`Use a holder class or proper locking.`,'M'],
    [`Why do race bugs often pass tests?`,[`Tests are single-threaded or the bad interleaving is rare`,`Races only show up in optimized production builds`,`JUnit runs tests under a global lock that hides races`,`The JVM serializes threads when assertions are on`],0,`Stress tests and reasoning are needed.`,'M'],
  ],
  quizAdv: [
    [`On a 32-bit JVM, is writing a non-volatile <code>long</code> atomic?`,[`Yes, always`,`Only on x86`,`Not guaranteed`,`Never, even if volatile`],2,`JLS §17.7: non-volatile long/double writes may tear. volatile makes them atomic.`,'H'],
    [`<code>if (cache == null) cache = load();</code> (a HashMap) from many threads, no sync. Worst case?`,[`Just a few extra load() calls`,`Deadlock between the loaders`,`Nothing: reference writes are atomic`,`A reader may see a half-built map`],3,`Without safe publication, writes inside load() may be reordered after the reference write.`,'H'],
    [`A "read-modify-write" on a database row from two app instances is...`,[`Safe, because each DB statement is atomic on its own`,`The same race at a different layer; needs a DB-level guarantee`,`Fixed by marking the service method synchronized`,`Fixed by @Transactional at default isolation alone`],1,`See 6.1.`,'M'],
    [`What does jcstress test?`,[`Throughput and latency of concurrent code under heavy load`,`Concurrency correctness under many interleavings and memory-model effects`,`Thread-pool sizing under stress with simulated traffic`,`GC pause behaviour when many threads allocate at once`],1,`An OpenJDK tool for concurrency tests.`,'H'],
  ],
});
