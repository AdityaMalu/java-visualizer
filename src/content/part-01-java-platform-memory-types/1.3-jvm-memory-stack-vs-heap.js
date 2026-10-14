/* 1.3 JVM memory: stack vs heap */
topic('1', { no:'1.3', title:'JVM memory: stack vs heap', idea:`Watch frames push and pop during recursion while objects sit on the heap. Then see the two ways to run out: StackOverflowError and OutOfMemoryError.`,
actors:'Thread', stateTitle:'Memory',
codes:{a:`void main() {
  int n = 3;
  Car car = new Car("Swift");      // ref on stack, object on heap
  long f = fact(n);
}
long fact(int k) {
  if (k <= 1) return 1;
  return k * fact(k - 1);          // each call = a new frame
}
// fact(100_000) -> StackOverflowError (-Xss default ~1 MB)`},
steps:[
{hl:{main:[2]}, th:[['main','RUN','frame: main']], g:[G('main thread stack (top first)',['main()','n = 3','hot']), G('Heap (shared)',['—','empty']), G('Metaspace',['Car.class','fields, methods, bytecode'])],
 say:`Calling <code>main</code> pushes a <b>frame</b>: its local variable slots, an operand stack, and a return address. <code>n</code> is a primitive, so the value 3 sits <b>in the frame</b>. Class metadata (Car's methods and field layout) lives in <b>Metaspace</b>, native memory outside the heap.`},
{hl:{main:[3]}, g:[G('main thread stack (top first)',['main()','n = 3, car → Car@1a','hot']), G('Heap (shared)',['Car@1a','{model:"Swift"}','hot'],['"Swift"','String in pool']), G('Metaspace',['Car.class','fields, methods, bytecode'])],
 say:`<code>new Car</code> allocates the <b>object on the heap</b>. The frame holds only a 4–8 byte <b>reference</b>. Every object has a header (mark word for hash/lock/GC age + class pointer, ~12–16 bytes) before its fields.`},
{hl:{main:[4],fact:[7]}, g:[G('main thread stack (top first)',['fact(3)','k = 3','hot'],['main()','n = 3, car → Car@1a']), G('Heap (shared)',['Car@1a','{model:"Swift"}'])],
 say:`<code>fact(3)</code> pushes a new frame on top. Each frame is private to this thread, which is why locals never need locks.`},
{hl:{fact:[8]}, g:[G('main thread stack (top first)',['fact(1)','k = 1','hot'],['fact(2)','k = 2, waiting'],['fact(3)','k = 3, waiting'],['main()','n = 3, car → Car@1a']), G('Heap (shared)',['Car@1a','{model:"Swift"}'])],
 say:`Recursion keeps pushing: fact(2), fact(1). The lower frames are suspended in the middle of <code>k * fact(k-1)</code>, waiting for a return value.`},
{hl:{fact:[7]}, g:[G('main thread stack (top first)',['fact(2)','2 * 1 = 2','hot'],['fact(3)','k = 3, waiting'],['main()','n = 3, car → Car@1a']), G('Heap (shared)',['Car@1a','{model:"Swift"}'])], log:['fact(1) returns 1'],
 say:`<code>fact(1)</code> returns 1 and its frame is <b>popped</b>. Freeing stack memory costs nothing: the stack pointer just moves. fact(2) resumes and computes 2.`},
{g:[G('main thread stack (top first)',['main()','n = 3, car → Car@1a, f = 6','ok']), G('Heap (shared)',['Car@1a','{model:"Swift"}'])], log:['fact(2) returns 2','fact(3) returns 6'],
 say:`Unwinding finishes and f = 6. The stack is <b>LIFO</b>, sized per thread with <code>-Xss</code> (default about 1 MB on 64-bit Linux, reserved virtual memory).`},
{hl:{main:[5]}, th:[['main','TERM','returned']], g:[G('main thread stack (top first)',['(empty)','']), G('Heap (shared)',['Car@1a','no references → garbage','bad'])],
 say:`<code>main</code> returns and its frame disappears, and so does the only reference to Car@1a. The object stays on the heap until the <b>GC</b> notices it's unreachable (1.4). The stack is freed instantly; the heap is freed lazily by the GC.`},
{th:[['main','TERM','crashed']], g:[G('main thread stack',['fact(1)…fact(~10,000)','frames fill -Xss','bad'],['result','StackOverflowError','bad']), G('Heap',['full of live objects','OutOfMemoryError: Java heap space','bad']), G('Metaspace',['too many classes (proxies, redeploys)','OutOfMemoryError: Metaspace','bad'])], log:['✘ java.lang.StackOverflowError at fact(App.java:8)'],
 say:`<b>StackOverflowError</b>: recursion too deep (or infinite), usually a missing base case or a deep recursive DFS. Fix it with iteration plus an explicit <code>ArrayDeque</code> stack. <b>OOM: Java heap space</b>: too many live objects. <b>OOM: Metaspace</b>: class leaks. Both StackOverflowError and OutOfMemoryError are <code>Error</code>s, not exceptions you should catch.`},
{th:[], g:[G('Escape analysis (C2)',['Point p = new Point(x, y); return p.x + p.y;',''],['p escapes the method?','no','ok'],['result','scalar replaced: fields kept in registers, no heap object','ok']), G('Per thread vs shared',['stack, PC register, native stack','per thread'],['heap, Metaspace, code cache','shared'])],
 say:`SDE-2 nuance: "objects always go on the heap" is the language model. In practice, if C2 proves an object <b>never escapes</b> a method, it can <b>scalar-replace</b> it (keep the fields in registers) and skip allocation entirely. That's one reason short-lived small objects are so cheap in Java.`}
],
keep:[`Stack: per-thread frames (locals, operand stack); freed instantly on return.`,`Heap: all objects, shared, GC-managed. Metaspace: class metadata (native memory).`,`StackOverflowError = deep recursion; OOM heap vs Metaspace; escape analysis can remove allocations.`]}, {
  imp: 'must',
  theory: TH(`Every thread gets its own stack for method calls and local variables; all objects live in one shared heap.`,
`<p>When a method runs, it needs scratch space for its parameters and local variables. Java gives each thread a <b>stack</b>: a pile of <b>frames</b>, one per method call in progress. Calling a method pushes a frame; returning pops it, instantly freeing its locals. It's like a stack of sticky notes: you only ever add or remove the top one.</p>
<p>Objects are different: they may need to outlive the method that created them, and several threads may use them. So every <code>new</code> object goes on the <b>heap</b>, a big shared area managed by the garbage collector. A local variable such as <code>Car c = new Car()</code> is a small <b>reference</b> on the stack pointing at the object on the heap.</p>`,
[[`Stack frame`,`Memory for one method call: its local variables and an operand stack for calculations.`],[`Heap`,`Shared memory where all objects and arrays live; cleaned by the GC.`],[`Reference`,`A pointer-like value that tells the JVM where an object is.`],[`Metaspace`,`Native memory (outside the heap) holding class metadata: method code, field layouts.`],[`Escape analysis`,`A JIT optimisation: if an object never leaves a method, it may not need a heap allocation at all.`]],
[`<code>main</code> starts: one frame on the main thread's stack.`,`Each call pushes a frame with its own locals; primitives are stored directly in it.`,`<code>new</code> allocates the object on the heap and stores a reference in the frame.`,`Return pops the frame; the object stays on the heap until nothing references it.`],
[`Local variables are naturally thread-safe; shared objects on the heap need coordination.`,`Deep or infinite recursion → <code>StackOverflowError</code>. Too many live objects → <code>OutOfMemoryError: Java heap space</code>. Too many generated classes → <code>OutOfMemoryError: Metaspace</code>.`,`<code>-Xmx</code> sets the max heap; <code>-Xss</code> sets each thread's stack size.`],
[`Thinking "objects passed to methods are on the stack": only the reference is.`,`Sizing a container's memory as just -Xmx: stacks, Metaspace and native buffers need room too.`]),
  quiz: [
    [`Inside a method, <code>Car c = new Car();</code>. Where do the object and the variable live?`,[`Object on the heap, the reference in the method's stack frame`,`Both on the stack, since the object never leaves the method`,`Object in the thread's stack, the reference in Metaspace`,`Both on the heap, because Java variables are all objects`],0,`Objects live on the shared heap; locals (including references) live in the thread's stack frame. Escape analysis can optimise this, but that's the model.`,'E'],
    [`A recursive method with no base case runs. What is thrown?`,[`OutOfMemoryError: Java heap space, as each frame is allocated on the heap`,`OutOfMemoryError: unable to create native thread`,`StackOverflowError`,`Nothing: the JIT turns tail calls into a loop, so it runs forever`],2,`Each call pushes a frame on the thread's fixed-size stack. Java has no tail-call optimisation.`,'M'],
    [`An app generates many classes at run time (dynamic proxies, script engines) and eventually dies. Which space is most likely exhausted?`,[`PermGen, which still holds class data in Java 17`,`The code cache, which stores generated classes`,`The old generation, where Class objects live forever`,`Metaspace, which holds class metadata in native memory`],3,`Class metadata lives in Metaspace since Java 8 (PermGen is gone). Unbounded class generation or class loader leaks give OutOfMemoryError: Metaspace.`,'H'],
    [`Where do static fields' values live?`,[`On the stack of the thread that set them`,`On the heap, with the Class object`,`In CPU registers for faster access`,`In the JIT's code cache with the methods`],1,`Since Java 8, static fields live with the Class mirror on the heap.`,'H'],
    [`Each thread has its own...`,[`heap`,`stack`,`Metaspace`,`String pool`],1,`The heap is shared by all threads.`,'E'],
    [`When is a method's local variable memory freed?`,[`At the next garbage collection run`,`When the method returns and its frame pops`,`When the owning thread itself ends`,`Never, locals stay until JVM exit`],1,`Stack frames are freed instantly.`,'E'],
    [`What does <code>-Xmx2g</code> set?`,[`Stack size`,`Maximum heap size`,`Metaspace size`,`Thread count`],1,`-Xms sets the initial heap.`,'E'],
    [`Which error means the JVM couldn't create a new thread?`,[`StackOverflowError: thread stack exhausted`,`OutOfMemoryError: unable to create native thread`,`OutOfMemoryError: Java heap space`,`IllegalThreadStateException on start()`],1,`OS limits or native memory ran out, often from unbounded thread creation.`,'M'],
  ],
  quizAdv: [
    [`Escape analysis proves a short-lived <code>Point</code> never leaves the method. What can C2 do?`,[`Scalar-replace it: keep its fields in registers, no allocation`,`Allocate it as a real object on the thread's stack`,`Allocate it in Metaspace, where GC doesn't scan`,`Pool it in a per-thread cache for reuse`],0,`HotSpot doesn't stack-allocate objects; it eliminates them through scalar replacement.`,'H'],
    [`What does <code>-Xss</code> control?`,[`The size of each survivor space`,`The maximum size of Metaspace`,`The maximum number of threads`,`Each thread's stack size`],3,`Bigger stacks allow deeper recursion but cost memory per thread.`,'M'],
    [`A container has a 2 GB limit and the JVM uses default settings. Roughly what max heap does it pick?`,[`The full 2 GB container limit`,`About 25% of container memory (512 MB)`,`Unlimited until the kernel stops it`,`A fixed 64 MB, regardless of limits`],1,`MaxRAMPercentage defaults to 25%; services often raise it to ~75%.`,'H'],
    [`Where do DirectByteBuffers (used by Netty, NIO) allocate memory?`,[`On the Java heap with other objects`,`Off-heap native memory`,`On the calling thread's stack`,`In Metaspace next to class data`],1,`Another reason RSS exceeds -Xmx.`,'H'],
  ],
});
