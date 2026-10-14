/* 4.17 Virtual threads (Java 21) */
topic('4', { no:'4.17', title:'Virtual threads (Java 21)', idea:`Millions of cheap threads mounted on a few carrier OS threads. Blocking I/O unmounts the virtual thread instead of blocking the OS thread.`,
codes:{a:`try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {
  for (int i = 0; i < 10_000; i++)
    ex.submit(() -> {
      var user = db.find(id);   // blocking I/O -> VT unmounts
      return render(user);      // CPU work on a carrier
    });
}                               // close() waits for all`,
b:`synchronized (cache) {         // ✘ pins the carrier (before JDK 24)
  var user = db.find(id);       // blocks the OS thread too
}
// fix: ReentrantLock, or upgrade to JDK 24+`},
steps:[
{cv:'a', hl:{VT1:[4],VT2:[4]}, th:[['VT1','RUN','on carrier-1'],['VT2','RUN','on carrier-2'],['VT3','READY',''],['VT4','READY','']], g:[G('Carriers (OS threads ≈ cores)',C('carrier-1',[['VT1','hot']]),C('carrier-2',[['VT2','hot']])), G('Ready queue',C('vts',['VT3','VT4','… 9,996 more'])), G('Parked on I/O (stacks on heap)',C('vts',[['none','dim']]))],
 say:`10,000 tasks, 10,000 <b>virtual threads</b>, but only a couple of <b>carrier</b> OS threads (a ForkJoinPool sized to the core count). A VT is a Java object with a small, growable stack on the heap. It costs about a KB, versus about 1 MB for a platform thread.`},
{hl:{VT1:[4],VT3:[4]}, th:[['VT1','WAITING','db.find() → unmounted'],['VT2','RUN','on carrier-2'],['VT3','RUN','mounted on carrier-1'],['VT4','READY','']], g:[G('Carriers (OS threads ≈ cores)',C('carrier-1',[['VT3','hot']]),C('carrier-2',['VT2'])), G('Ready queue',C('vts',['VT4','…'])), G('Parked on I/O (stacks on heap)',C('vts',[['VT1','hot']]))], log:['VT1 blocks on socket read → stack copied to heap, carrier-1 freed'],
 say:`VT1 makes a blocking DB call. The JDK's I/O code notices it's on a virtual thread: it <b>unmounts</b> VT1 (saves its stack frames to the heap) and registers the socket with the OS poller. carrier-1 is <b>immediately free</b> and mounts VT3. You write plain blocking code and get async-style efficiency.`},
{hl:{VT2:[4],VT4:[4]}, th:[['VT1','WAITING','parked'],['VT2','WAITING','parked'],['VT3','RUN','carrier-1'],['VT4','RUN','carrier-2']], g:[G('Carriers (OS threads ≈ cores)',C('carrier-1',['VT3']),C('carrier-2',[['VT4','hot']])), G('Ready queue',C('vts',['…'])), G('Parked on I/O (stacks on heap)',C('vts',['VT1',['VT2','hot']]))],
 say:`Same for VT2. Thousands of VTs can wait on I/O at once while only 2 OS threads exist. This is why thread-per-request servers (Tomcat with <code>spring.threads.virtual.enabled=true</code>) scale without reactive code.`},
{hl:{VT1:[5]}, th:[['VT1','RUN','I/O done → remounted on carrier-1'],['VT2','WAITING','parked'],['VT3','TERM','done'],['VT4','RUN','carrier-2']], g:[G('Carriers (OS threads ≈ cores)',C('carrier-1',[['VT1','ok']]),C('carrier-2',['VT4'])), G('Ready queue',C('vts',['…'])), G('Parked on I/O (stacks on heap)',C('vts',['VT2']))], log:['poller: VT1 socket readable → VT1 ready → mounted'],
 say:`The DB reply arrives, the poller marks VT1 ready, and it gets <b>remounted</b> (maybe on a different carrier) to continue at <code>render(user)</code>.`},
{cv:'b', hl:{VT5:[1,2]}, th:[['VT5','BLOCKED','pinned: blocking inside synchronized'],['VT6','READY','can\'t get a carrier']], g:[G('Carriers (OS threads ≈ cores)',C('carrier-1',[['VT5 (PINNED)','bad']]),C('carrier-2',[['VT6','dim']])), G('Pinning',['cause (JDK 21–23)','blocking inside synchronized, or native frame'],['effect','carrier OS thread blocked too','bad'],['fix','ReentrantLock, or JDK 24+ (JEP 491)','ok'])],
 say:`<b>Pinning.</b> Before JDK 24, a VT blocking <b>inside a synchronized block</b> couldn't unmount, so it held its carrier hostage. With few carriers, a handful of pinned VTs stall the whole app. Use ReentrantLock in hot paths, or upgrade (JDK 24 fixed synchronized pinning).`},
{th:[], g:[G('Use virtual threads for',['many concurrent blocking I/O tasks','✔','ok'],['thread-per-request servers','✔','ok']), G('Don\'t expect',['faster CPU-bound work','✘ same cores','bad'],['pooling VTs','✘ create one per task','bad'],['ThreadLocal-heavy code','✘ millions of copies','bad'],['unlimited downstream calls','use a Semaphore to cap DB load'])],
 say:`Virtual threads improve <b>throughput</b> for waiting-heavy workloads, not <b>speed</b> for computation. Don't pool them, since they're cheap and meant to be thrown away. They'll happily open 10,000 DB connections, so limit those with a Semaphore or the connection pool size.`}
],
keep:[`VT = cheap JVM thread; blocking I/O unmounts it and frees the carrier.`,`Great for I/O-bound thread-per-request; no gain for CPU-bound work.`,`Pinning inside synchronized (pre-JDK 24); don't pool VTs; cap downstream with a Semaphore.`]}, {
  imp: 'good',
  theory: TH(`Virtual threads (Java 21) are lightweight threads managed by the JVM, so you can have millions of them and write simple blocking code that still scales.`,
`<p>A classic (platform) thread maps to an OS thread: heavy, with a big stack, so you can have a few thousand at most. Web apps spend most of their time <i>waiting</i> on databases and HTTP calls, holding a thread that does nothing.</p>
<p>A <b>virtual thread</b> is a cheap Java object. It runs on a small pool of OS "carrier" threads. When it blocks on I/O, the JVM <b>unmounts</b> it and the carrier runs another virtual thread. When the I/O completes, it's mounted again. You write plain blocking code, and you get the scalability of async code.</p>`,
[[`Platform thread`,`A Java thread backed 1:1 by an OS thread.`],[`Virtual thread`,`A lightweight thread scheduled by the JVM onto carrier threads.`],[`Carrier thread`,`The platform thread a virtual thread is currently running on.`],[`Pinning`,`A virtual thread that can't unmount (e.g. blocking inside synchronized before JDK 24).`]],
[`Create one per task: <code>Executors.newVirtualThreadPerTaskExecutor()</code>, or Spring Boot's <code>spring.threads.virtual.enabled=true</code>.`,`Each request runs on its own virtual thread with ordinary blocking code.`,`On blocking I/O the virtual thread parks and frees the carrier.`],
[`Big win for I/O-heavy services; no gain for CPU-heavy work.`,`Still limit access to scarce resources (DB connections) with pools or semaphores.`],
[`Pooling virtual threads.`,`Expecting them to make CPU-bound code faster.`,`Long blocking calls inside synchronized on older JDKs (pinning).`]),
  quiz: [
    [`A virtual thread blocks on socket I/O. What happens to its carrier thread?`,[`It unmounts; the carrier runs other virtual threads`,`The carrier thread blocks along with it`,`The carrier is destroyed and later recreated`,`The carrier spins until the I/O completes`],0,`That's how millions of blocking virtual threads fit on a few carriers.`,'E'],
    [`A CPU-bound image resizer moves to virtual threads. Expected speedup?`,[`About 10×`,`Proportional to the number of virtual threads`,`It becomes 10× slower`,`About none: the cores are the bottleneck`],3,`Virtual threads help with waiting, not computing.`,'M'],
    [`10,000 virtual threads each call a database that allows 50 connections. What should you add?`,[`A fixed pool of 50 virtual threads to run the calls`,`Nothing: virtual threads queue up automatically`,`A Semaphore(50), or a bounded connection pool`,`A synchronized block around the database call`],2,`Don't pool virtual threads; limit the scarce resource. synchronized would also pin carriers before JDK 24.`,'H'],
    [`What's the main benefit of virtual threads?`,[`Faster CPU-bound work, since they run on more cores at once`,`Very cheap threads, so blocking I/O code can scale to many concurrent tasks`,`No need for locks, because each virtual thread is isolated`,`Less GC work, since their stacks never live on the heap`],1,`Thread-per-request without the cost.`,'E'],
    [`Which Java version made virtual threads final?`,[`17`,`19`,`21`,`25`],2,`JEP 444.`,'E'],
    [`How do you enable virtual threads for Spring Boot request handling?`,[`Switch to WebFlux, which runs on virtual threads by default`,`spring.threads.virtual.enabled=true (Boot 3.2+, Java 21+)`,`server.tomcat.threads.virtual=true (Boot 3.0+, Java 17+)`,`Add a Loom starter dependency; no configuration is needed`],1,`Tomcat then uses virtual threads.`,'M'],
    [`What is pinning?`,[`A virtual thread that can't unmount, blocking its carrier`,`A thread bound to one CPU core by affinity`,`A platform thread given the highest priority`,`A virtual thread stuck forever in a deadlock`],0,`Mostly synchronized blocks before JDK 24, and native calls.`,'M'],
    [`Should virtual threads be pooled?`,[`Yes, like platform threads`,`No: create one per task`,`Only for CPU work`,`Only in tests`],1,`Pooling defeats the purpose.`,'E'],
  ],
  quizAdv: [
    [`A virtual thread blocks on I/O inside <code>synchronized</code> on JDK 21. Effect?`,[`It stays pinned, blocking its carrier`,`It unmounts as usual`,`It throws IllegalStateException`,`The JVM turns synchronized into a lock`],0,`Pinning; use ReentrantLock. JDK 24 removed most synchronized pinning.`,'H'],
    [`Should you pool virtual threads?`,[`Yes, so they can be reused`,`Yes, sized to the core count`,`Only for CPU-bound work`,`No: create one per task`],3,`They're cheap to create; pooling defeats the model.`,'M'],
    [`Which still limits a virtual-thread service calling a database?`,[`Only the number of carrier threads`,`The DB connection pool and the database's capacity`,`Only the heap needed for thread stacks`,`The OS limit on native threads per process`],1,`Plan pool sizes and timeouts.`,'M'],
    [`What does structured concurrency (StructuredTaskScope) add?`,[`Runs subtasks on dedicated carrier threads so they finish faster`,`Treats related subtasks as one unit: they're started, joined, failed and cancelled together`,`Spreads subtasks across JVMs and coordinates them with distributed locks`,`Lets subtasks outlive their parent so failures don't propagate up`],1,`Still a preview API in Java 25.`,'H'],
  ],
});
