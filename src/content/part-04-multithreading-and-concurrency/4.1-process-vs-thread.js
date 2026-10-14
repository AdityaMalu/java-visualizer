/* 4.1 Process vs thread */
topic('4', { no:'4.1', title:'Process vs thread', idea:`A process owns memory. Threads inside it each get a private stack and program counter but share one heap.`,
codes:{a:`class Server {
  static Map<String, User> cache = new HashMap<>(); // heap: shared

  public static void main(String[] args) {
    Thread t1 = new Thread(() -> handle("u1"));
    Thread t2 = new Thread(() -> handle("u2"));
    t1.start();
    t2.start();
  }

  static void handle(String id) {
    int hits = 0;            // local primitive: own stack
    User u = load(id);       // object on heap, ref on stack
    cache.put(id, u);        // shared map: race risk
  }
}`},
steps:[
{hl:{main:[4]}, th:[['main','RUN','inside main()']],
 g:[G('main · stack',['frame','main(args)']), G('Heap · shared by all threads',['Server.cache','HashMap {}'])],
 say:`The running JVM is one OS <b>process</b>. It starts with a single thread called <code>main</code>. The process has <b>one heap</b>; the static field <code>cache</code> points to a HashMap that lives there.`},
{hl:{main:[5,6]}, th:[['main','RUN','creating Thread objects'],['t1','NEW','not started'],['t2','NEW','not started']],
 g:[G('main · stack',['frame','main(args)'],['t1','→ Thread@1a','hot'],['t2','→ Thread@2b','hot']), G('Heap · shared by all threads',['Server.cache','HashMap {}'],['Thread@1a','state NEW','hot'],['Thread@2b','state NEW','hot'])],
 say:`<code>new Thread(...)</code> only creates a normal Java object on the heap. There is <b>no OS thread and no stack yet</b>. Both are in state <b>NEW</b>.`},
{hl:{main:[7,8]}, th:[['main','RUN','about to return'],['t1','READY','has a stack, waiting for CPU'],['t2','READY','has a stack, waiting for CPU']],
 g:[G('main · stack',['frame','main(args)']), G('t1 · stack (new)',['PC','handle line 12','hot']), G('t2 · stack (new)',['PC','handle line 12','hot']), G('Heap · shared by all threads',['Server.cache','HashMap {}'],['Thread@1a','RUNNABLE'],['Thread@2b','RUNNABLE'])],
 log:['t1.start() → OS thread created','t2.start() → OS thread created'],
 say:`<code>start()</code> asks the OS for a real thread. Each new thread gets <b>its own stack</b> (about 1 MB reserved) and its own <b>program counter</b> (PC), which records the instruction it is on. Now they are RUNNABLE, and the OS scheduler decides when each one actually runs.`},
{hl:{t1:[12],t2:[12]}, th:[['main','TERM','main() returned'],['t1','RUN','hits = 0'],['t2','RUN','hits = 0']],
 g:[G('t1 · stack',['frame','handle("u1")'],['hits','0','hot']), G('t2 · stack',['frame','handle("u2")'],['hits','0','hot']), G('Heap · shared by all threads',['Server.cache','HashMap {}'])],
 log:['main ended, JVM stays alive: t1, t2 are non-daemon'],
 say:`Both threads run <b>the same line of the same method</b> at the same time, but each pushes its own frame on its own stack. <code>hits</code> in t1 and <code>hits</code> in t2 are two different variables. <b>Local variables are thread-safe by construction.</b> Note that the JVM keeps running after <code>main</code> ends because t1 and t2 are non-daemon threads.`},
{hl:{t1:[13],t2:[13]},
 g:[G('t1 · stack',['frame','handle("u1")'],['hits','0'],['u','→ User@77','hot']), G('t2 · stack',['frame','handle("u2")'],['hits','0'],['u','→ User@88','hot']), G('Heap · shared by all threads',['Server.cache','HashMap {}'],['User@77','{id:"u1"}','hot'],['User@88','{id:"u2"}','hot'])],
 say:`Objects are always created on the <b>heap</b>. The stack only holds the <b>reference</b>. While only t1 knows about User@77 it is effectively private. Once the reference <b>escapes</b> (stored in a static, a field, or passed to another thread) any thread can reach it.`},
{hl:{t1:[14],t2:[14]}, th:[['main','TERM',''],['t1','RUN','cache.put("u1")'],['t2','RUN','cache.put("u2")']],
 g:[G('Heap · shared by all threads',['Server.cache','{u1?, u2?}','bad'],['User@77','{id:"u1"}'],['User@88','{id:"u2"}'])],
 log:['⚠ two threads writing one HashMap at the same time'],
 say:`Both threads write to <b>the same HashMap</b> at once. HashMap is not thread-safe. Two puts into the same bucket can overwrite each other and lose an entry, and a put that triggers a resize can leave the table broken. Sharing the heap is what makes threads fast, because nothing is copied, and also what makes them dangerous. Fix: <code>ConcurrentHashMap</code> (see 4.16).`},
{th:[['t1','TERM',''],['t2','TERM','']],
 g:[G('Process A · JVM',['heap','heap A'],['threads','main, t1, t2']), G('Process B · another JVM',['heap','heap B'],['read heap A directly?','no','bad'],['talk to A via','socket, HTTP, pipe, file','ok'])],
 say:`<b>Processes are isolated.</b> Each has its own address space, so a crash in one doesn't kill the other. They talk through the OS: sockets, pipes, files. Threads in one process share memory, so they communicate cheaply but must coordinate. A new process is expensive to create. A platform thread is cheaper, but still costs about 1 MB of stack and an OS thread.`},
{th:[],
 g:[G('Concurrency · 1 core', C('core 1',['t1','t2','t1','t2','t1'])), G('Parallelism · 2 cores', C('core 1',['t1','t1','t1']), C('core 2',['t2','t2','t2']))],
 say:`<b>Concurrency</b>: several tasks are in progress and the scheduler interleaves them. A <b>context switch</b> saves one thread's PC and registers and loads another's. <b>Parallelism</b>: tasks run at the same instant on different cores. Races happen in both cases. Even on one core a switch can land between a READ and a WRITE (see 4.4).`}
],
keep:[`Thread = own stack + PC. Process = own heap/address space.`,`Locals live on the stack → safe. Objects and statics live on the heap → shared → need coordination.`,`Concurrency is about structure (interleaving); parallelism is about execution (multiple cores).`]}, {
  imp: 'must',
  theory: TH(`A process is a running program with its own memory; threads are independent paths of execution inside one process that share that memory.`,
`<p>When you start a Java application, the OS creates a <b>process</b>: it gets its own memory space, isolated from other programs. Inside it, work is done by <b>threads</b>. Each thread has its own call stack and its own "where am I in the code" pointer, but all threads in the process share the same heap.</p>
<p>Analogy: a process is a restaurant kitchen; threads are the cooks. Each cook follows their own recipe (stack), but they share the fridge and the counters (heap). Sharing makes cooperation fast, and it's also why two cooks can grab the same ingredient at once.</p>`,
[[`Process`,`An isolated running program with its own address space.`],[`Thread`,`A unit of execution with its own stack and program counter, sharing the process's heap.`],[`Context switch`,`The OS pausing one thread and resuming another.`],[`Concurrency vs parallelism`,`Dealing with many tasks interleaved / actually running them at the same time on several cores.`]],
[`The JVM starts a main thread plus helper threads (GC, JIT).`,`You create more threads (or use pools) to do work concurrently.`,`The OS scheduler gives each thread CPU time slices, possibly in parallel on several cores.`,`Threads read and write shared objects on the heap; local variables stay private to each thread.`],
[`A web server handles each request on a thread, so request handling code must be safe when run concurrently.`,`CPU-bound work: about one thread per core. I/O-bound work: many threads, or virtual threads (4.17).`],
[`Assuming code runs in the order you see it across threads.`,`Sharing mutable objects between threads without synchronization.`]),
  quiz: [
    [`Two threads in one process. What do they share?`,[`Their stacks`,`Their program counters`,`The heap: objects and static fields`,`Nothing, unless they use shared memory`],2,`Each thread has its own stack and PC; heap objects and statics are shared, hence the need for coordination.`,'E'],
    [`A local <code>int</code> in a method called by many threads. Thread-safe?`,[`Yes: each call has its own copy in its own stack frame`,`No: it needs volatile`,`Only if it's declared final`,`No: the JIT may keep it in a shared register`],0,`Locals are thread-confined. Objects they point to may still be shared.`,'M'],
    [`A method creates <code>new ArrayList&lt;&gt;()</code> in a local, submits a task that adds to it, and keeps adding itself. Thread-safe?`,[`Yes: the variable is a local`,`Yes: submit() publishes all later writes too`,`No: locals can't be passed to other threads`,`No: the list object itself is now shared`],3,`Confinement is about the object, not the variable. submit() only publishes writes made before the call.`,'H'],
    [`What does each thread have its own copy of?`,[`Its heap and loaded classes`,`Its stack and program counter`,`Its static fields and constants`,`Its String pool and metaspace`],1,`The heap is shared.`,'E'],
    [`Why are threads cheaper to switch between than processes?`,[`They share an address space, so no memory map switch is needed`,`They skip saving registers because they share one stack`,`The JVM switches them itself without involving the OS kernel`,`Each thread is pinned to its own core, so caches never go cold`],0,`Processes are isolated.`,'M'],
    [`Two threads read and write the same object field without coordination. Risk?`,[`A guaranteed deadlock at runtime`,`Races and visibility problems`,`Only slower performance, not bugs`,`A ConcurrentModificationException`],1,`Shared mutable state needs coordination.`,'E'],
    [`What is a context switch?`,[`The JVM moving a thread's objects to another heap region`,`The OS pausing one thread and resuming another on a CPU`,`A method call switching from one stack frame to another`,`The compiler changing which variables are in scope`],1,`It has a cost (saving registers, cache effects).`,'E'],
    [`A JVM process with 10 threads crashes from an uncaught Error in one thread. What happens to the others?`,[`The JVM terminates every thread immediately`,`Only that thread ends; the rest keep running`,`All other threads pause until it's handled`,`The JVM restarts the failed thread automatically`],1,`Uncaught exceptions end only the thread (unless it's fatal to the JVM).`,'M'],
  ],
  quizAdv: [
    [`Concurrency vs parallelism?`,[`They're the same thing`,`Parallelism needs a single core`,`Concurrency only applies to I/O`,`Interleaving vs running at once`],3,`You can have concurrency on one core.`,'M'],
    [`8 cores, purely CPU-bound work. Pool size?`,[`About 8, one per core`,`About 200, like Tomcat`,`1, to avoid contention`,`Cores × 100`],0,`For blocking work, size by wait/compute ratio or use virtual threads.`,'M'],
    [`Hyper-threading shows 16 logical CPUs on 8 cores. Do CPU-bound tasks get 16× parallel speedup?`,[`Yes: each logical CPU runs a thread at full core speed`,`No: logical CPUs share core resources; gains are much less than 2× per core`,`Yes, as long as the pool has exactly 16 worker threads`,`Yes, but only when using virtual threads instead of platform ones`],1,`Size CPU pools around available processors, then measure.`,'H'],
    [`Amdahl's law says...`,[`Speedup grows linearly with the number of threads you add`,`Speedup is limited by the part of the work that must run sequentially`,`Speedup is limited mainly by garbage collection pause time`,`Speedup is capped by memory bandwidth, not by sequential code`],1,`10% serial work caps speedup at 10×.`,'H'],
  ],
});
