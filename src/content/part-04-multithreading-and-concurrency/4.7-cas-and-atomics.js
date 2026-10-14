/* 4.7 CAS and atomics */
topic('4', { no:'4.7', title:'CAS and atomics', idea:`Compare-And-Swap: "set to NEW only if it's still EXPECTED", in one CPU instruction. On failure, retry. No locks, no blocking.`,
codes:{a:`AtomicInteger value = new AtomicInteger(5);

int incrementAndGet() {
  while (true) {
    int cur = value.get();               // read
    int next = cur + 1;
    if (value.compareAndSet(cur, next))  // one CPU instruction
      return next;                       // won
    // lost: someone changed it, loop again
  }
}`,
b:`// lock-free stack, top = A -> B -> C
AtomicStampedReference<Node> top =
    new AtomicStampedReference<>(A, 0);
int[] st = new int[1];
Node cur = top.get(st);              // (A, stamp 0)
// paused... others: pop A, pop B, push A  -> (A, stamp 3)
top.compareAndSet(cur, cur.next, st[0], st[0] + 1);
// stamp 0 != 3  -> fails, no corruption`,
c:`LongAdder hits = new LongAdder();

hits.increment();         // thread updates ITS cell
long total = hits.sum();  // adds all cells together`},
steps:[
{cv:'a', th:[['A','READY','incrementAndGet()'],['B','READY','incrementAndGet()']], g:[G('Memory',['value','5']),G('A · locals',['cur','—'],['next','—']),G('B · locals',['cur','—'],['next','—'])],
 say:`<code>compareAndSet(expected, new)</code> is one hardware instruction (<code>LOCK CMPXCHG</code> on x86). It sets the value only if it still equals <code>expected</code>, and reports whether it did. Two threads will increment from 5.`},
{hl:{A:[5],B:[5]}, th:[['A','RUN','cur = 5'],['B','RUN','cur = 5']], g:[G('Memory',['value','5']),G('A · locals',['cur','5','hot'],['next','—']),G('B · locals',['cur','5','hot'],['next','—'])],
 say:`Both read 5. Without CAS this is the start of a lost update.`},
{hl:{A:[6],B:[6]}, g:[G('Memory',['value','5']),G('A · locals',['cur','5'],['next','6','hot']),G('B · locals',['cur','5'],['next','6','hot'])], th:[['A','RUN','next = 6'],['B','RUN','next = 6']],
 say:`Both compute 6 privately.`},
{hl:{A:[7,8]}, th:[['A','TERM','CAS(5→6) ✔ returns 6'],['B','RUN','']], g:[G('Memory',['value','6','ok']),G('A · locals',['cur','5'],['next','6']),G('B · locals',['cur','5'],['next','6'])], log:['A: CAS(expect 5, set 6) → true'],
 say:`A's CAS: memory holds 5, which equals A's expected 5, so it is swapped to 6 atomically. A returns.`},
{hl:{B:[7,9]}, th:[['A','TERM',''],['B','RUN','CAS failed, not blocked']], g:[G('Memory',['value','6']),G('A · locals',['cur','5'],['next','6']),G('B · locals',['cur','5','bad'],['next','6','bad'])], log:['B: CAS(expect 5, set 6) → false (memory is 6)'],
 say:`B's CAS: memory is 6, B expected 5 → <b>fails</b>. Nothing was overwritten. B was <b>never blocked</b> and no OS call happened. It just learned it lost and loops again.`},
{hl:{B:[5,6]}, g:[G('Memory',['value','6']),G('A · locals',['cur','5'],['next','6']),G('B · locals',['cur','6','hot'],['next','7','hot'])], th:[['A','TERM',''],['B','RUN','retry: cur = 6, next = 7']],
 say:`Retry with the fresh value: cur = 6, next = 7.`},
{hl:{B:[7,8]}, th:[['A','TERM',''],['B','TERM','CAS(6→7) ✔ returns 7']], g:[G('Memory',['value','7','ok'])], log:['B: CAS(expect 6, set 7) → true','✔ final 7: no lost update'],
 say:`Success: 7. This is <b>optimistic concurrency</b>: assume no conflict, detect it, retry. It's very fast under low contention. Under heavy contention many threads spin and waste CPU (see LongAdder below).`},
{cv:'b', hl:{T1:[5]}, th:[['T1','RUN','read (A, stamp 0)'],['T2','READY','']], g:[G('Stack top',['ref','A → B → C'],['stamp','0'])],
 say:`<b>The ABA problem.</b> T1 wants to pop from a lock-free stack. It reads top = A and plans <code>CAS(top, A → A.next = B)</code>.`},
{hl:{T2:[6]}, th:[['T1','READY','paused'],['T2','RUN','pop A, pop B, push A']], g:[G('Stack top',['ref','A → C','hot'],['stamp','3','hot'],['B','freed / reused','bad'])],
 say:`While T1 is paused, T2 pops A, pops B, and pushes A back. The top is <b>A again</b>, but the stack underneath changed and B is gone. A plain reference CAS would see "A == A" and succeed, setting top = B, a node that's no longer in the stack.`},
{hl:{T1:[7,8]}, th:[['T1','RUN','CAS fails, re-reads'],['T2','TERM','']], g:[G('Stack top',['ref','A → C'],['stamp','3'],['T1 expected stamp','0','bad'])], log:['stamped CAS: ref matches but stamp 0 ≠ 3 → false'],
 say:`With <code>AtomicStampedReference</code> every change bumps a <b>version stamp</b>. T1 expected stamp 0, finds 3, and fails safely. This is the same idea as a <code>@Version</code> column for optimistic locking in a DB.`},
{cv:'c', hl:{A:[3],B:[3],C:[3]}, th:[['A','RUN','cell[0]++'],['B','RUN','cell[1]++'],['C','RUN','cell[2]++']], g:[G('LongAdder', C('base',['0']), C('cells',[['c0 = 3','hot'],['c1 = 1','hot'],['c2 = 4','hot']]), ['sum()','8'])],
 say:`<b>LongAdder</b>: under contention, threads are spread across several cells so they rarely CAS the same memory. <code>sum()</code> adds them up (a moment-in-time value, not a snapshot). Use it for hot counters like metrics and request counts. Use AtomicLong when you need exact compare-and-set semantics.`}
],
keep:[`CAS = compare, then swap only if unchanged; loop on failure. Lock-free, non-blocking.`,`ABA: value changed and changed back. Fix: version stamp (<code>AtomicStampedReference</code>).`,`Hot counter under contention → <code>LongAdder</code>.`]}, {
  imp: 'must',
  theory: TH(`Atomic classes update a value without locks using compare-and-swap (CAS): "set it to X only if it's still what I last saw".`,
`<p>Locks make other threads wait. For a single variable there's a faster way. The CPU offers a <b>compare-and-swap</b> instruction: "if this memory still holds 5, change it to 6; otherwise tell me it failed". A thread reads the value, computes the new one, and tries CAS. If someone else changed it in between, the CAS fails and the thread simply retries with the fresh value. No thread is ever blocked.</p>`,
[[`CAS`,`Atomic compare-and-set instruction.`],[`AtomicInteger / AtomicLong / AtomicReference`,`Classes wrapping a value with atomic operations.`],[`LongAdder`,`A counter split across cells to reduce contention.`],[`ABA problem`,`A value changes and changes back, fooling a CAS.`]],
[`Read the current value.`,`Compute the new value.`,`compareAndSet(old, new): succeeds only if nobody changed it.`,`On failure, loop and try again (incrementAndGet does this for you).`],
[`<code>AtomicInteger.incrementAndGet()</code> for counters and ids; <code>LongAdder</code> for hot metrics counters.`,`<code>AtomicReference.updateAndGet</code> to swap immutable state objects.`],
[`Combining two atomic variables and expecting the pair to be atomic.`,`Heavy contention on one AtomicLong; use LongAdder.`]),
  quiz: [
    [`What does compareAndSet do?`,[`Locks the variable until you release it`,`Sets the value and returns the old one`,`Blocks until the value changes`,`Sets it only if it still equals the expected value`],3,`A single CPU instruction used in retry loops: lock-free and non-blocking.`,'E'],
    [`A metrics counter is hammered by 64 threads. Which scales best?`,[`AtomicLong`,`LongAdder`,`A synchronized long`,`A volatile long`],1,`LongAdder spreads updates across cells to avoid CAS contention; sum() adds them up.`,'M'],
    [`The ABA problem?`,[`Two threads write the same value A at once`,`The CPU reorders writes A and B across cores`,`A → B → A lets a CAS pass though state changed`,`A CAS loop that retries forever under contention`],2,`AtomicStampedReference pairs the value with a version.`,'H'],
    [`Which class offers atomic increments?`,[`Integer`,`AtomicInteger`,`int`,`volatile int`],1,`incrementAndGet uses CAS.`,'E'],
    [`What does <code>getAndIncrement()</code> return?`,[`The new value`,`The old value`,`void`,`true/false`],1,`incrementAndGet returns the new value.`,'E'],
    [`What does "lock-free" mean?`,[`No thread ever retries, so every thread always progresses`,`Threads never block on a lock; at least one always makes progress`,`It's always faster than locking in every workload`,`The code runs on one thread, so no locks are needed`],1,`CAS loops retry instead of waiting.`,'M'],
    [`Atomically set a value only if it's currently 5?`,[`if (get() == 5) set(newValue)`,`compareAndSet(5, newValue)`,`getAndSet(newValue)`,`compareAndSet(newValue, 5)`],1,`Returns false if it wasn't 5.`,'M'],
    [`<code>AtomicInteger.updateAndGet(x -&gt; x * 2)</code> with contention: the lambda may run?`,[`Exactly once, since updates are serialized by a lock`,`More than once, so it must be side-effect free`,`At most once; contended updates are dropped`,`Once, but on a separate pool thread`],1,`CAS retries re-apply it.`,'H'],
  ],
  quizAdv: [
    [`A CAS retry loop is...?`,[`Lock-free, not wait-free: one thread may retry forever`,`Wait-free: every thread finishes in bounded steps`,`Blocking, like a spin lock`,`Obstruction-free only`],0,`System-wide progress is guaranteed, not per-thread.`,'H'],
    [`Why does <code>AtomicLong.incrementAndGet</code> scale badly under heavy contention?`,[`It takes a lock internally`,`All cores CAS one cache line`,`It creates garbage to collect`,`volatile reads are slow`],1,`LongAdder stripes the counter across cells.`,'H'],
    [`What does <code>AtomicReference&lt;State&gt;</code> enable?`,[`Atomic updates of a reference, e.g. swapping an immutable state object`,`A reference the GC can clear when memory runs low`,`Locking the referenced State object during each update`,`Atomic updates to every field inside the State object`],0,`Combine with immutable objects for lock-free updates.`,'M'],
    [`LongAdder.sum() under concurrent updates is?`,[`An exact snapshot, since it locks all cells while summing`,`Not an atomic snapshot: concurrent updates may or may not be included`,`A blocking call that waits for pending updates to finish`,`A stale value cached from the last call to reset()`],1,`Great for metrics, not for exact sequencing.`,'H'],
  ],
});
