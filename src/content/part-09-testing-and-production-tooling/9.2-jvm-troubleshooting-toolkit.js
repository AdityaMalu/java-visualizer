/* 9.2 JVM troubleshooting toolkit */
topic('9', { no:'9.2', title:'JVM troubleshooting toolkit', imp:'good', idea:`Which tool for which symptom: jcmd for flags, thread dumps and heap dumps, Java Flight Recorder for "where does the time go", and GC logs. Follow one high-CPU incident from top to the guilty line of code.`,
actors:'On-call', stateTitle:'What each tool tells you', logTitle:'Terminal',
codes:{a:`$ jcmd                                    # list running JVMs and their pids
$ jcmd 4242 VM.flags                      # effective heap size, GC, flags
$ top -H -p 4242                          # which THREAD burns CPU?
$ jcmd 4242 Thread.print > dump1.txt      # thread dump (same as jstack)
$ jcmd 4242 GC.class_histogram | head     # what fills the heap (cheap)
$ jcmd 4242 GC.heap_dump /dumps/app.hprof # full heap dump (pauses the app)
$ jcmd 4242 JFR.start duration=60s filename=/dumps/rec.jfr
$ jstat -gcutil 4242 1000                 # GC stats every second
$ java -Xlog:gc*:file=gc.log -XX:+HeapDumpOnOutOfMemoryError -jar app.jar`},
steps:[
{hl:{oncall:[1]}, th:[['oncall','RUN:ok','paged: CPU 100%, p99 3 s']], g:[G('Symptom → tool',['hang / slow / deadlock','thread dumps (several, a few seconds apart)'],['high CPU','top -H + thread dump, or JFR'],['memory growing / OOM','GC logs, class histogram, heap dump (6.2)'],['"where does time go?"','JFR / async-profiler'])],
 say:`Production problems come in a few shapes, and each has a go-to tool. Almost everything is reachable with <b>jcmd</b>, the Swiss-army knife that ships with the JDK. Step one: find the JVM's process id.`},
{hl:{oncall:[2]}, g:[G('VM.flags (excerpt)',['-XX:MaxHeapSize','1.5 GB (75% of a 2 GB container)'],['-XX:+UseG1GC','yes'],['-XX:ActiveProcessorCount','2'])], log:['$ jcmd 4242 VM.flags','-XX:MaxHeapSize=1610612736 -XX:+UseG1GC …'],
 say:`<code>VM.flags</code> shows what the JVM is <i>actually</i> running with, which in containers often differs from what you assumed (heap sized from the container limit, CPU count from cgroups).`},
{hl:{oncall:[3]}, g:[G('top -H (threads)',['tid 4311','98% CPU','bad'],['tid 4312','2%'],['4311 in hex','0x10d7','hot'])], log:['  PID USER   %CPU COMMAND','4311 app    98.0 java','4312 app     2.0 java'],
 say:`<code>top -H</code> shows CPU per <b>thread</b>. Thread 4311 is burning a whole core. Thread dumps label native thread ids in hex as <code>nid=0x10d7</code>, so convert 4311 → 0x10d7.`},
{hl:{oncall:[4]}, g:[G('Thread dump: nid=0x10d7',['name','"http-nio-8080-exec-7"'],['state','RUNNABLE'],['top frame','java.util.regex.Pattern$Loop.match','bad'],['our code','OrderValidator.validateEmail(OrderValidator.java:58)','hot'])], log:['"http-nio-8080-exec-7" #57 nid=0x10d7 runnable','   at java.util.regex.Pattern$Loop.match(…)','   at com.shop.OrderValidator.validateEmail(OrderValidator.java:58)'],
 say:`The thread dump shows that thread stuck in a regex inside <code>validateEmail</code>: a <b>catastrophic backtracking</b> regex on a long input. Two or three dumps a few seconds apart confirm it's the same place every time, not a coincidence.`},
{hl:{oncall:[5,6]}, g:[G('Memory tools',['GC.class_histogram','counts and bytes per class; cheap, no pause'],['GC.heap_dump','every object; large file; pauses the JVM','hot'],['analyse with','Eclipse MAT / IntelliJ (dominator tree)'])],
 say:`For memory problems, start with the cheap <b>class histogram</b>; take a full <b>heap dump</b> only when needed, because it pauses the app and can be gigabytes. Analysis is covered in 6.2.`},
{hl:{oncall:[7]}, g:[G('Java Flight Recorder',['overhead','~1–2%: safe in production','ok'],['records','hot methods, allocations, locks, I/O, GC, exceptions'],['open with','JDK Mission Control (JMC)'])], log:['$ jcmd 4242 JFR.start duration=60s filename=/dumps/rec.jfr','Started recording 1.'],
 say:`<b>JFR</b> is a low-overhead recorder built into the JVM. A 60-second recording answers "where does CPU time go, who allocates, which locks are contended" without guessing. async-profiler's flame graphs answer similar questions.`},
{hl:{oncall:[8,9]}, g:[G('GC visibility',['jstat -gcutil','live % of each generation, GC counts and times'],['-Xlog:gc*','full GC log to a file: always on in production','ok'],['HeapDumpOnOutOfMemoryError','dump automatically on OOM','ok'])],
 say:`Turn on <b>GC logging</b> and <b>heap dump on OOM</b> from day one; they cost almost nothing and are invaluable after an incident. <code>jstat</code> gives a live view of GC activity.`},
{th:[['oncall','TERM:ok','fixed: bounded regex + input length limit']], g:[G('In Kubernetes / Spring',['kubectl exec … jcmd 1 Thread.print','PID is often 1 in a container'],['Actuator','/actuator/threaddump, /heapdump, /metrics'],['keep dumps','write to a mounted volume, not the pod\'s disk'])],
 say:`<b>Say it:</b> "For a hang I take several thread dumps; for high CPU I map the hot thread from top -H to the dump, or record JFR; for memory I check GC logs and the class histogram, then take a heap dump. GC logs and heap-dump-on-OOM are always enabled."`}
],
keep:[`jcmd: VM.flags, Thread.print, GC.class_histogram, GC.heap_dump, JFR.start.`,`High CPU: top -H → thread id in hex → nid in the thread dump. Hang: several dumps compared.`,`Always on: GC logs + HeapDumpOnOutOfMemoryError; JFR is safe in production.`]}, {
  imp: 'good',
  theory: TH(`The JDK ships tools to look inside a running JVM: jcmd for flags, thread and heap dumps, Java Flight Recorder for profiling, and GC logs for memory behaviour.`,
`<p>When a production service is slow, stuck or running out of memory, guessing is expensive. The JVM can tell you what it's doing. A <b>thread dump</b> shows what every thread is executing right now; a <b>heap dump</b> shows every object in memory; <b>JFR</b> (Java Flight Recorder) records CPU, allocation, lock and I/O events over time with tiny overhead; <b>GC logs</b> show how memory is collected.</p>
<p><b>jcmd</b> is the single command that triggers most of these on a running process.</p>`,
[[`jcmd`,`Sends diagnostic commands to a running JVM.`],[`Thread dump`,`Stack trace of every thread at one moment.`],[`Heap dump`,`Snapshot of all objects (.hprof).`],[`JFR / JMC`,`Flight Recorder (low-overhead events) / Mission Control (viewer).`],[`GC log`,`Record of every garbage collection.`]],
[`Identify the symptom: hang, high CPU, memory growth, slowness.`,`Collect the matching evidence before restarting (dumps, JFR, logs).`,`Correlate: hot thread id → dump; dominator tree → leak; JFR hot methods → code.`,`Fix, then add metrics or alerts so it's caught earlier next time.`],
[`Enable GC logging and HeapDumpOnOutOfMemoryError by default.`,`In Kubernetes, write dumps to a persistent volume.`,`Spring Boot Actuator exposes thread and heap dumps (secure them!).`],
[`Restarting before collecting evidence.`,`Taking a single thread dump and over-interpreting it.`,`Heap dumps on a live, latency-critical instance without warning (they pause the JVM).`]),
  quiz: [
    [`An app is hung but CPU is idle. First evidence to collect?`,[`A heap dump to find leaked objects`,`GC logs covering the last few minutes`,`Several thread dumps a few seconds apart`,`A JFR recording of CPU hot methods`],2,`Dumps show what each thread is waiting on, and comparing them shows what's stuck.`,'E'],
    [`top -H shows thread id 4311 at 98% CPU. How do you find it in a thread dump?`,[`Search for "4311" in the thread names`,`Convert 4311 to hex (0x10d7) and find nid=0x10d7`,`It's always the main thread`,`Take a heap dump instead`],1,`Thread dumps list native thread ids in hex.`,'M'],
    [`Which is safe to run continuously in production with ~1–2% overhead?`,[`Java Flight Recorder`,`A heap dump every minute`,`-verbose:class`,`A debugger attached to the JVM`],0,`JFR was designed for always-on production use.`,'H'],
    [`Which command lists running JVMs?`,[`java -list or java --running`,`jcmd (with no arguments) or jps`,`javap with no arguments`,`jstat -list or jmap -list`],1,`Then target a pid.`,'E'],
    [`What does a thread dump contain?`,[`Every live object and its size`,`Each thread's state and stack trace`,`The GC log since the JVM started`,`Each thread's CPU time and heap usage`],1,`Plus locks held and waited for.`,'E'],
    [`Which file format does Java Flight Recorder produce?`,[`.hprof`,`.jfr`,`.log`,`.class`],1,`Open with JDK Mission Control.`,'E'],
    [`Why take several thread dumps instead of one?`,[`Each dump only shows a random subset of the threads`,`To tell stuck threads (same frame every time) from busy ones`,`Tools like fastThread need at least three to parse`,`A single dump pauses threads and hides their real state`],1,`A few seconds apart.`,'M'],
    [`What's the first thing to check for "OutOfMemoryError: Metaspace"?`,[`Heap size: Metaspace is carved out of -Xmx`,`Class loading: generated classes or class loader leaks`,`Thread count: each thread stack uses Metaspace`,`String interning filling the Metaspace pool`],1,`See 1.3 and 1.2.`,'M'],
  ],
  quizAdv: [
    [`A heap dump on a 16 GB heap in production. What's the main risk?`,[`It can corrupt live objects that are being moved`,`It requires attaching a debugger and suspending threads`,`It triggers a full GC that frees all soft references`,`It pauses the JVM (seconds or more) and writes a huge file`],3,`Take it from an instance pulled out of the load balancer if possible.`,'H'],
    [`Why check <code>jcmd VM.flags</code> in a container?`,[`To see the real heap size and CPU count the JVM derived from container limits`,`To change heap and GC flags on the running JVM without a restart`,`To see which container image and base JDK the JVM was started from`,`To list all live threads and the flags each of them was started with`],0,`Container-aware defaults (MaxRAMPercentage, ActiveProcessorCount) often surprise people.`,'M'],
    [`async-profiler flame graphs show?`,[`How objects are laid out in memory, grouped by class`,`Where CPU time (or allocations) is spent, stacked by call path`,`Where wall-clock time goes, but only for blocked threads`,`Which threads were running, stacked on a timeline by start`],1,`Wide bars = hot code paths.`,'H'],
    [`<code>-XX:+ExitOnOutOfMemoryError</code> is useful in containers because?`,[`It frees soft references first, so OOM rarely happens at all`,`The JVM exits immediately so the orchestrator restarts a clean instance`,`It doubles the heap size once, before giving up on recovery`,`It writes a heap dump and then keeps serving the requests`],1,`Pair with HeapDumpOnOutOfMemoryError.`,'H'],
  ],
});
