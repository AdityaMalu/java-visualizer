/* 4.6 volatile and the Java Memory Model */
topic('4', { no:'4.6', title:'volatile and the Java Memory Model', idea:`Without a happens-before edge, one thread may never see another's write. volatile adds that edge, but not atomicity.`,
codes:{a:`class Worker {
  boolean running = true;

  void loop() {               // Thread T1
    while (running) { work(); }
  }
  void stop() {               // Thread T2
    running = false;
  }
}`,
b:`class Worker {
  volatile boolean running = true;   // reads/writes go to memory

  void loop() {               // Thread T1
    while (running) { work(); }
  }
  void stop() {               // Thread T2
    running = false;
  }
}`,
c:`int data = 0;
volatile boolean ready = false;

// Writer thread W
data = 42;          // plain write
ready = true;       // volatile write: publishes everything above

// Reader thread R
if (ready) {        // volatile read
  print(data);      // guaranteed 42, never 0
}`,
d:`volatile int count = 5;

count++;   // still READ, ADD, WRITE
           // A and B both read 5, both write 6`},
steps:[
{cv:'a', th:[['T1','READY',''],['T2','READY','']], g:[G('Core 1 cache (T1)',['running','—']),G('Main memory',['running','true']),G('Core 2 cache (T2)',['running','—'])],
 say:`Each core has caches and store buffers, and the JIT can keep values in registers. The <b>Java Memory Model</b> only promises a thread sees another's write if there is a <b>happens-before</b> edge between them. A plain field has no such edge.`},
{hl:{T1:[5]}, th:[['T1','RUN','reads running = true'],['T2','READY','']], g:[G('Core 1 cache (T1)',['running','true','hot']),G('Main memory',['running','true']),G('Core 2 cache (T2)',['running','—'])],
 say:`T1 reads <code>running</code>. The value is now in core 1's cache. Worse, since the loop never writes it, the JIT may <b>hoist the read out of the loop</b>: <code>if (running) while (true) work();</code>.`},
{hl:{T2:[8]}, th:[['T1','RUN','looping…'],['T2','RUN','running = false']], g:[G('Core 1 cache (T1)',['running','true']),G('Main memory',['running','true']),G('Core 2 cache (T2)',['running','false','hot'])],
 say:`T2 calls <code>stop()</code>. The write may sit in core 2's store buffer or cache for a while.`},
{hl:{T1:[5]}, th:[['T1','RUN','still sees true, loops forever'],['T2','TERM','done']], g:[G('Core 1 cache (T1)',['running','true','bad']),G('Main memory',['running','false','hot']),G('Core 2 cache (T2)',['running','false'])], log:['✘ T1 never stops (stale value / hoisted read)'],
 say:`Even after the write reaches memory, nothing forces T1 to <b>re-read</b> it. With the hoisted read it never does. The program hangs, and only on some machines or JIT levels, which makes it hard to reproduce.`},
{cv:'b', hl:{T1:[2],T2:[2]}, th:[['T1','RUN','loop()'],['T2','READY','']], g:[G('Core 1 cache (T1)',['running','(not cached)','dim']),G('Main memory',['running','true']),G('Core 2 cache (T2)',['running','(not cached)','dim'])],
 say:`Mark it <code>volatile</code>. The JIT may no longer cache or hoist it. Every read sees the <b>latest write</b> by any thread, and writes are not reordered with the code around them.`},
{hl:{T2:[8]}, th:[['T1','RUN','loop()'],['T2','RUN','volatile write false']], g:[G('Core 1 cache (T1)',['running','invalidated','hot']),G('Main memory',['running','false','hot']),G('Core 2 cache (T2)',['running','false'])], log:['volatile write: store buffer flushed, other copies invalidated'],
 say:`A volatile write is followed by a memory barrier. The store becomes visible to all cores, and stale copies in other cores' caches are invalidated by the cache-coherence protocol.`},
{hl:{T1:[5]}, th:[['T1','TERM','read false, loop exits'],['T2','TERM','']], g:[G('Core 1 cache (T1)',['running','false','ok']),G('Main memory',['running','false']),G('Core 2 cache (T2)',['running','false'])], log:['✔ T1 stopped'],
 say:`T1's next read gets <code>false</code> and the loop exits. This is the canonical use of volatile: <b>a flag one thread writes and others read</b>.`},
{cv:'c', hl:{W:[5,6]}, th:[['W','RUN','data = 42; ready = true'],['R','READY','']], g:[G('Memory',['data','42','hot'],['ready (volatile)','true','hot'])],
 say:`volatile also <b>publishes</b> other data. Rule: <b>everything W did before writing a volatile</b> is visible to any thread that later <b>reads that volatile</b> and sees the new value. <code>data</code> isn't volatile but it is "carried along".`},
{hl:{R:[9,10]}, th:[['W','TERM',''],['R','RUN','sees ready → prints data']], log:['42'],
 g:[G('Happens-before edges',['unlock(m)','→ later lock(m)'],['write volatile v','→ later read of v','hot'],['t.start()','→ actions in t'],['actions in t','→ t.join() returns'],['final fields set in constructor','→ readers (if safely published)'])],
 say:`R reads <code>ready == true</code>, so it is <b>guaranteed</b> to see <code>data == 42</code>. If <code>ready</code> weren't volatile, R could see ready=true and data=0 because of reordering. The full list of happens-before edges is on the right.`},
{cv:'d', hl:{A:[3],B:[3]}, th:[['A','TERM','read 5, wrote 6'],['B','TERM','read 5, wrote 6']], g:[G('Memory',['count (volatile)','6','bad'],['expected','7'])], log:['✘ volatile does not make count++ atomic'],
 say:`<b>volatile ≠ atomic.</b> Both threads read the fresh value 5, both compute 6, both write 6. Visibility is guaranteed, but the read-modify-write still races. Use <code>AtomicInteger</code> or a lock.<br><br><b>Visibility / Atomicity / Blocks?</b> volatile: ✔ ✘ no · synchronized: ✔ ✔ yes · AtomicInteger: ✔ ✔ (one variable) no.`}
],
keep:[`volatile: visibility + ordering, no atomicity. Good for flags and safe publication (DCL singleton, 4.18).`,`"Happens-before" is the rule that says which writes a thread is guaranteed to see.`,`Classic bug: a stop flag without volatile → infinite loop.`]}, {
  imp: 'must',
  theory: TH(`Without synchronization, one thread may never see another's writes, or see them in a surprising order; volatile fixes visibility and ordering for a single variable, but not atomicity.`,
`<p>CPUs and the JIT reorder and cache memory operations for speed. Within one thread you can't tell, but across threads it shows: thread A sets <code>running = false</code> and thread B, looping on <code>while (running)</code>, may never notice, because its read was cached or hoisted out of the loop.</p>
<p>The <b>Java Memory Model</b> defines when a write is guaranteed visible: when there's a <b>happens-before</b> relationship between the write and the read. Unlocking then locking the same lock creates one. So does writing then reading a <code>volatile</code> field.</p>`,
[[`Visibility`,`Whether one thread sees another's write.`],[`Reordering`,`Compiler/CPU executing operations in a different order than written.`],[`Happens-before`,`The JMM rule guaranteeing that one action's effects are visible to another.`],[`volatile`,`Field modifier: reads and writes go to main memory in order; no atomic ++.`]],
[`Thread A writes data, then writes a volatile flag.`,`Thread B reads the volatile flag and sees it set.`,`Everything A wrote before the flag is now guaranteed visible to B.`,`Without volatile (or a lock) there's no such guarantee.`],
[`Use volatile for simple flags and for safely publishing an immutable object.`,`Use locks or atomics for compound updates.`,`Double-checked locking needs the instance field to be volatile.`],
[`A plain boolean stop flag: the loop may never stop.`,`Using volatile for counters.`]),
  quiz: [
    [`Is <code>volatile int count; count++;</code> safe with many writers?`,[`Yes, volatile makes ++ atomic`,`No: it gives visibility, not atomicity`,`Yes, on 64-bit JVMs`,`Only for long and double fields`],1,`Use AtomicInteger or a lock.`,'E'],
    [`<pre>boolean running = true;   // not volatile
// T1: while (running) { }
// T2: running = false;</pre>What can happen?`,[`T1 stops within one time slice`,`T1 throws IllegalMonitorStateException`,`T1 may loop forever: nothing forces it to see T2's write`,`The compiler rejects the unsynchronized access`],2,`Without happens-before, the JIT can hoist the read out of the loop.`,'M'],
    [`Why does double-checked locking need the field to be <code>volatile</code>?`,[`Others may see a non-null reference to a half-built object`,`It makes the lock fair, so threads don't starve`,`Without it, the JIT may cache the lock object itself`,`It forces the second null check to read main memory`],0,`volatile forbids publishing the reference before construction completes.`,'H'],
    [`What does volatile guarantee?`,[`Atomicity for compound operations like count++ on it`,`Visibility and ordering for reads/writes of that variable`,`Mutual exclusion for any code that touches that variable`,`Fair, first-come access to that variable across threads`],1,`Not atomicity of count++.`,'E'],
    [`Good use of volatile?`,[`A hit counter incremented by many request threads`,`A stop flag set by one thread and read by another`,`A shared list that several threads append to`,`An account balance debited by concurrent transfers`],1,`Single writes and reads.`,'E'],
    [`What is "happens-before"?`,[`A rule that one thread is scheduled before another`,`A guarantee that one action's effects are visible to another`,`A lock that orders threads by their start time`,`A GC phase that runs before objects are collected`],1,`Created by locks, volatile, thread start/join, etc.`,'M'],
    [`Does <code>Thread.start()</code> create a happens-before edge?`,[`No: the new thread may see stale values of all fields`,`Yes: everything before start() is visible to the new thread`,`Only for fields marked volatile before start()`,`Only on x86, which has a strong memory model`],1,`Same for join(): the thread's writes are visible afterwards.`,'M'],
    [`Why can a plain field update be invisible to another thread?`,[`Private fields are only visible to the thread that last wrote them`,`Caches, store buffers and JIT optimisations may keep it local without a happens-before edge`,`The GC may move the object before the other thread reads it`,`Each thread works on its own heap copy until it calls join()`],1,`The JMM only promises visibility with synchronization.`,'M'],
  ],
  quizAdv: [
    [`T1: <code>x = 1;</code> (plain) then <code>ready = true;</code> (volatile). T2 sees ready == true. Is x guaranteed to be 1?`,[`No: x isn't volatile`,`Only on x86`,`Yes: happens-before`,`Only if x is final`],2,`Writes before a volatile write are visible after a volatile read that sees it.`,'H'],
    [`<pre>x = y = 0;  // plain fields
T1: x = 1; r1 = y;
T2: y = 1; r2 = x;</pre>Can r1 == 0 and r2 == 0?`,[`No: at least one sees 1`,`Only on ARM CPUs`,`Only with the JIT off`,`Yes: reordering allows it`],3,`Even x86 allows store-load reordering. volatile on both fields forbids this outcome.`,'H'],
    [`Is publishing an immutable object (all final fields) through a plain field safe?`,[`No: other threads may see default values in its final fields`,`Its fields are seen correctly, but the reference itself may be seen late (or stale)`,`Yes, and the reference is guaranteed to be seen immediately`,`Only if it's a record; ordinary classes need volatile fields`],1,`Final-field semantics cover the fields, not when the reference becomes visible.`,'H'],
    [`What do VarHandle acquire/release modes offer?`,[`Stronger ordering than volatile, like a lock on each access`,`Weaker (cheaper) ordering than volatile for advanced lock-free code`,`Control over when the GC may move the referenced object`,`Automatic atomicity for compound updates such as x++`],1,`Used inside java.util.concurrent.`,'H'],
  ],
});
