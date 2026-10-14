/* 1.1 JDK, JRE, JVM and the JIT */
topic('1', { no:'1.1', title:'JDK, JRE, JVM and the JIT', idea:`Follow <code>Hello.java</code> from source to bytecode to interpreted code to C1 and C2 machine code. This is why Java gets faster after warm-up.`,
actors:'JVM components', stateTitle:'Runtime data', dgTitle:'Pipeline',
vb:'0 0 620 200',
nodes:{src:{x:60,y:50,label:'Hello.java',kind:'mem',w:100}, javac:{x:180,y:50,label:'javac',w:80}, cls:{x:300,y:50,label:'Hello.class\nbytecode',kind:'mem',w:110,h:46},
  load:{x:440,y:50,label:'class loader\n+ verifier',w:120,h:46}, interp:{x:560,y:50,label:'interpreter',w:100},
  c1:{x:440,y:150,label:'C1 (tier 3)\nquick + profile',w:130,h:46}, c2:{x:270,y:150,label:'C2 (tier 4)\noptimised',w:130,h:46}, cache:{x:90,y:150,label:'code cache\nnative code',kind:'mem',w:130,h:46}},
edges:[['src','javac'],['javac','cls'],['cls','load'],['load','interp'],['interp','c1','hot'],['c1','c2','hotter'],['c2','cache']],
codes:{a:`public class Hello {
  public static void main(String[] args) {
    long sum = 0;
    for (int i = 0; i < 1_000_000; i++)
      sum += square(i);            // hot call site
    System.out.println(sum);
  }
  static long square(int x) { return (long) x * x; }
}
// $ javac Hello.java   -> Hello.class (bytecode)
// $ java Hello         -> JVM loads, verifies, runs`,
b:`static long square(int);      // javap -c Hello
  Code:
    0: iload_0      // push local 0 (x)
    1: i2l          // int -> long
    2: iload_0      // push x again
    3: i2l
    4: lmul         // pop two longs, push product
    5: lreturn      // return top of stack`},
steps:[
{hl:{javac:[10]}, th:[['javac','RUN:ok','compiling']], d:{type:'graph',on:['src','javac','cls']},
 g:[G('JDK (build + run)',['tools','javac, jar, javap, jcmd, jstack, jfr'],['contains','the runtime below']), G('Runtime (the old "JRE")',['libraries','java.base, java.sql, …'],['JVM','loader, interpreter, JIT, GC'])],
 say:`<code>javac</code> turns source into <b>bytecode</b>: compact, platform-neutral instructions for a <b>stack machine</b>. The same <code>.class</code> runs on any OS that has a JVM. That's "write once, run anywhere". SDE-2 detail: since Java 11 there's no separate JRE download. You ship the JDK, or a trimmed runtime built with <code>jlink</code>.`},
{cv:'b', hl:{frame:[3,4]}, th:[['frame','RUN:ok','square(3)']], d:{type:'graph',on:['cls']},
 g:[G('square(3) frame',C('locals',['x = 3']),C('operand stack',[['3L','hot']]))],
 say:`Inside <code>square</code>. Every frame has a <b>local variable array</b> and an <b>operand stack</b>. <code>iload_0</code> pushes x, <code>i2l</code> widens it to a long. Bytecode has no registers; everything goes through this stack.`},
{hl:{frame:[5,6,7]}, g:[G('square(3) frame',C('locals',['x = 3']),C('operand stack',[['3L'],['3L','hot']]),['after lmul','9L','hot'])],
 say:`Push x again, widen, then <code>lmul</code> pops both and pushes 9. <code>lreturn</code> hands the top of the stack back to the caller's operand stack. You'll rarely read bytecode at work, but <code>javap -c</code> settles questions like "what does <code>count++</code> really do?" (see 4.4).`},
{cv:'a', hl:{loader:[11]}, th:[['loader','RUN:ok','loading Hello'],['verifier','RUN:ok','checking bytecode']], d:{type:'graph',on:['load']},
 g:[G('Verifier checks',['stack never under/overflows','✔'],['types match each instruction','✔'],['no jumps into the middle of an instruction','✔'],['final / private access respected','✔'])],
 say:`<code>java Hello</code> starts the JVM. The class loader reads the bytes (1.2), then the <b>verifier</b> proves they're safe: type-correct, balanced stack, legal jumps. That's why a hand-crafted <code>.class</code> can't corrupt memory the way bad native code can.`},
{hl:{interp:[3,4,5]}, th:[['interpreter','RUN:ok','executing main()'],['JIT','WAITING:warn','watching counters']], d:{type:'graph',on:['interp']},
 g:[G('Profiling counters',['square() invocations','150','hot'],['main() loop back-edges','150'],['square tier','0 · interpreted'])],
 say:`The <b>interpreter</b> starts running bytecode immediately: no compile delay, but slow (roughly 10–50× slower than compiled code). While it runs, it counts <b>method invocations</b> and <b>loop back-edges</b> to find hot code.`},
{hl:{interp:[5]}, th:[['interpreter','RUN:ok',''],['C1','RUN:ok','compiling square()']], d:{type:'graph',on:['c1'],e:[['interp','c1','hot','hot']]},
 g:[G('Profiling counters',['square() invocations','~200+','hot'],['square tier','3 · C1 + profiling','hot'],['profile collected','arg types, branch counts, call targets'])],
 say:`<b>Tiered compilation.</b> After a few hundred calls, <b>C1</b> (the client compiler) compiles <code>square</code> quickly into native code with <b>profiling hooks</b>. It records which branches are taken and which classes really show up at each call.`},
{th:[['interpreter','WAITING:warn','idle for this code'],['C2','RUN:ok','optimising with the profile']], d:{type:'graph',on:['c2','cache'],e:[['c1','c2','hotter','hot'],['c2','cache','','hot']]},
 g:[G('C2 optimisations',['inlining','square() body pasted into the loop','ok'],['loop unrolling','4 iterations per jump','ok'],['escape analysis','no heap alloc for local objects','ok'],['intrinsics','Math, String, arraycopy → CPU instructions'])],
 say:`Thousands of calls later, <b>C2</b> recompiles using the profile. It inlines <code>square</code> into the loop, unrolls the loop, removes bounds checks, and keeps values in registers. The result lands in the <b>code cache</b>. This is why the first requests after a deploy are slow: <b>JIT warm-up</b>.`},
{hl:{interp:[4]}, th:[['OSR','RUN:ok','swap frame mid-loop']], d:{type:'graph',on:['c2']},
 g:[G('On-Stack Replacement',['main() invocations','1 (never hot by calls)'],['loop back-edges','≫ threshold','hot'],['action','jump from interpreted frame into compiled loop','ok'])],
 say:`<code>main</code> is called once, so the invocation counter never triggers. But its loop runs a million times, and the back-edge counter triggers <b>OSR</b> (On-Stack Replacement): the JVM compiles the loop and switches the running frame over <b>in the middle of the loop</b>.`},
{th:[['C2','TERM:dim','code discarded'],['interpreter','RUN:ok','running again']], d:{type:'graph',on:['interp'],bad:['c2']},
 g:[G('Deoptimisation',['C2 assumed','call site only ever sees Car'],['new class loaded','Truck extends Car','bad'],['result','compiled code invalid → back to interpreter','bad'])],
 log:['made not entrant: Hello::process (assumption broken)'],
 say:`C2 makes <b>speculative</b> assumptions, like "this virtual call only ever hits Car, so inline it". If a new subclass appears or a "never taken" branch is taken, the JVM <b>deoptimises</b> back to the interpreter and may recompile later. Benchmark with <b>JMH</b> (it handles warm-up and dead-code elimination). Reduce startup cost with CDS, GraalVM native image, or Project Leyden AOT.`},
{th:[], d:null, g:[G('JDK',['= runtime + dev tools','javac, jlink, jcmd, jfr, jstack']), G('JRE (concept)',['= JVM + standard library','enough to run, not build']), G('JVM',['= loader + verifier + interpreter + JIT + GC','one per OS/CPU'])],
 say:`<b>Say it:</b> "The JVM runs bytecode. The JRE is the JVM plus the class libraries. The JDK adds dev tools. Execution starts interpreted, and the hot methods get compiled by C1 and then C2 using runtime profiles. OSR handles hot loops, and deoptimisation undoes speculation."`}
],
keep:[`javac → bytecode (stack machine) → JVM verifies → interprets → C1 → C2 (tiered).`,`OSR for hot loops; deoptimisation when speculative assumptions break.`,`Warm-up matters: benchmark with JMH, expect slow first requests after deploy.`]}, {
  imp: 'good',
  theory: TH(`Java code is compiled twice: once by you into portable bytecode, and again by the JVM into fast machine code for the parts that run most.`,
`<p>A computer's CPU only understands <b>machine code</b>, and every kind of CPU (Intel, ARM) has its own. If Java compiled straight to machine code, you'd need a different build for every machine. Instead, <code>javac</code> compiles your <code>.java</code> files into <b>bytecode</b>: instructions for an imaginary computer called the <b>Java Virtual Machine</b>. Each real machine runs a JVM that understands that bytecode. That's "write once, run anywhere".</p>
<p>Think of bytecode as a recipe written in a universal language, and the JVM as a local chef who reads it. At first the chef reads the recipe line by line (the <b>interpreter</b>): it works immediately, but slowly. The chef notices which recipes are cooked hundreds of times and memorises them as muscle memory: that's the <b>JIT (Just-In-Time) compiler</b> turning hot bytecode into native machine code while the program runs.</p>`,
[[`JDK`,`Java Development Kit: everything to build and run Java (javac, jar, debugging tools, the runtime).`],[`JRE`,`Java Runtime Environment: the JVM plus the standard library. Enough to run, not to compile. No longer shipped separately since Java 11.`],[`JVM`,`The program that loads bytecode, checks it, runs it, compiles hot parts and manages memory.`],[`Bytecode`,`Compact, CPU-independent instructions stored in .class files.`],[`JIT`,`The compiler inside the JVM that turns frequently used bytecode into machine code at run time. HotSpot has two: C1 (fast to compile) and C2 (slower, highly optimised).`]],
[`You write <code>Hello.java</code>; <code>javac</code> produces <code>Hello.class</code> (bytecode).`,`<code>java Hello</code> starts a JVM, which loads and verifies the class.`,`The interpreter starts executing immediately and counts how often each method and loop runs.`,`Code that gets "hot" is compiled by C1, and later by C2 using the profile it collected (which types appear, which branches are taken).`,`If an assumption C2 made turns out wrong, the JVM throws that compiled code away (deoptimises) and recompiles later.`],
[`The first requests after a deploy are slower (warm-up). Some teams send warm-up traffic before putting a pod into the load balancer.`,`Measure performance with JMH, not a hand-written loop with <code>System.nanoTime</code>.`,`For fast startup (serverless, CLIs), look at CDS, GraalVM native image or Project Leyden.`],
[`Benchmarking cold code and concluding Java is slow.`,`Thinking the JRE is a separate download you need in modern Java.`,`Assuming javac does the heavy optimisation; almost all of it happens in the JIT at run time.`]),
  quiz: [
    [`A service is fast in steady state, but the first requests after each deploy are slow. Most likely cause?`,[`The young generation starts small and only grows after the first full GC`,`Hot code still runs interpreted or in C1 until the JIT has profiled and compiled it`,`Bytecode is re-verified on each request until the class is marked trusted`,`String literals are interned on first use, which locks the String pool`],1,`Execution starts in the interpreter. C1, then C2, compile hot code once invocation and back-edge counters cross their thresholds: that's JIT warm-up.`,'E'],
    [`<code>main()</code> is called once but contains a loop that runs 10 million times. How does that loop get compiled?`,[`It doesn't: only methods with a high invocation count are ever compiled`,`C1 compiles main() as soon as the loop's first back-edge is seen`,`On-Stack Replacement compiles the loop and switches the running frame into it`,`javac unrolls loops with constant bounds, so no JIT step is needed`],2,`Back-edge counters trigger OSR, which swaps the interpreted frame for a compiled one while the loop is still running.`,'M'],
    [`C2 inlined a virtual call because only <code>Car</code> was ever seen there. Later <code>Truck extends Car</code> is loaded and reaches that call. What happens?`,[`The compiled code is deoptimised back to the interpreter and may be recompiled`,`Truck keeps running Car's inlined body until the code cache is flushed`,`Loading Truck fails with IncompatibleClassChangeError at that call site`,`The JIT adds a type guard to the compiled code without ever leaving it`],0,`C2 optimisations are speculative. When an assumption (class hierarchy, branch never taken) breaks, the code is made not entrant and execution falls back to the interpreter.`,'H'],
    [`Which part of the JVM checks that bytecode won't break memory safety before it runs?`,[`The garbage collector`,`The bytecode verifier`,`javac`,`The JIT`],1,`Verification checks types, stack use and jumps.`,'E'],
    [`What is a "stack machine" in the context of bytecode?`,[`Bytecode pushes and pops values on an operand stack`,`A machine designed to run recursive code fast`,`The thread's call stack that holds the frames`,`A CPU that executes bytecode natively`],0,`e.g. iload, iadd, istore.`,'M'],
    [`What's the main job of C1 vs C2 in HotSpot?`,[`C1 interprets bytecode while C2 compiles it`,`C1 compiles fast; C2 optimises the hottest code`,`C1 targets desktops, C2 targets large servers`,`C2 compiles first and C1 cleans up afterwards`],1,`Tiered compilation.`,'M'],
    [`Which JIT optimisation copies a small method's body into its caller?`,[`Escape analysis`,`Inlining`,`Loop unrolling`,`Deoptimisation`],1,`Inlining enables further optimisations.`,'E'],
    [`Why does a JMH benchmark run warm-up iterations first?`,[`To warm the disk cache with the class files`,`To let the JIT compile hot code before measuring`,`To load test data into memory first`,`To trigger a full GC before measuring`],1,`Measuring cold code measures the interpreter.`,'M'],
  ],
  quizAdv: [
    [`What does <code>-XX:TieredStopAtLevel=1</code> do?`,[`Stops at C1: faster startup, lower peak throughput`,`Disables the interpreter, so code is compiled first`,`Skips C1 and sends hot code straight to C2`,`Turns off OSR so loops stay interpreted`],0,`Common for short-lived CLIs and tests where warm-up never pays off.`,'M'],
    [`A hand-written benchmark computes a value it never uses and reports 0.3 ns/op. Most likely?`,[`The CPU cached the result in L1 between iterations`,`OSR-compiled loops really are that fast`,`System.nanoTime is too coarse to measure it`,`C2 removed the unused work as dead code`],3,`Use JMH and consume results with a Blackhole; it also handles warm-up and constant folding.`,'H'],
    [`What does "intrinsic" mean for methods like <code>Math.sqrt</code> or <code>System.arraycopy</code>?`,[`They're written in plain Java like other methods`,`The JIT swaps in hand-tuned machine code`,`They can't be called from application code`,`They're deprecated, kept for compatibility`],1,`The JVM knows these methods specially.`,'H'],
    [`What does CDS (Class Data Sharing) improve?`,[`GC pause times, by shrinking the young generation`,`Startup time, by reusing pre-parsed class metadata`,`Peak throughput, by compiling everything at startup`,`Network latency, by caching DNS lookups`],1,`AppCDS archives your app's classes too.`,'H'],
  ],
});
