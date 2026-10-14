/* 6.2 Memory leak in production: from alert to fix */
topic('6', { no:'6.2', title:'Memory leak in production: from alert to fix', idea:`A "temporary" static cache grows until the pod dies every few days. Follow the on-call path: read GC behaviour, take a heap dump, find the retaining path, fix it with a bounded cache.`,
actors:'Who is involved', stateTitle:'Signals', dgTitle:'Path to GC root (from the heap dump)',
vb:'0 0 580 200',
nodes:{root:{x:65,y:100,label:'GC root\nclass loader',w:110,h:46}, cls:{x:205,y:100,label:'ReportService\n.class',w:120,h:46}, map:{x:350,y:100,label:'static CACHE\nHashMap',kind:'mem',w:120,h:46},
  e1:{x:510,y:35,label:'byte[] 12 KB',kind:'mem',w:120,h:32}, e2:{x:510,y:100,label:'byte[] 12 KB',kind:'mem',w:120,h:32}, e3:{x:510,y:165,label:'… × 131,000',kind:'mem',w:120,h:32}},
edges:[['root','cls'],['cls','map','static field'],['map','e1'],['map','e2'],['map','e3']],
codes:{a:`@Service
class ReportService {
  // "quick cache" added during an incident last year
  private static final Map<String, byte[]> CACHE = new HashMap<>();

  public byte[] render(String userId, LocalDate from, LocalDate to) {
    String key = userId + ":" + from + ":" + to + ":" + System.nanoTime();
    return CACHE.computeIfAbsent(key, k -> pdf.render(userId, from, to));
  }
}
// ~1,200 reports/hour, ~12 KB each, nothing ever removed`,
b:`@Service
class ReportService {
  private final Cache<ReportKey, byte[]> cache = Caffeine.newBuilder()
      .maximumWeight(200_000_000)                    // ~200 MB hard cap
      .weigher((ReportKey k, byte[] v) -> v.length)
      .expireAfterWrite(Duration.ofMinutes(30))
      .recordStats()                                 // hit rate → metrics
      .build();

  record ReportKey(String userId, LocalDate from, LocalDate to) {}

  public byte[] render(String userId, LocalDate from, LocalDate to) {
    return cache.get(new ReportKey(userId, from, to),
                     k -> pdf.render(k.userId(), k.from(), k.to()));
  }
}`},
steps:[
{th:[['app','RUN:ok','serving reports'],['GC','RUN:ok','young GC ~15 ms']], d:null,
 g:[G('Heap (Xmx 2 GB)',['used after full GC, day 0','300 MB'],['young GC pause','15 ms'],['full GCs / hour','0']), G('Report cache',['entries','0'],['hit rate','—'])],
 say:`Day 0 after a deploy. The heap is 2 GB, and after a full GC only <b>300 MB</b> is live. Young collections are quick. Nothing looks wrong.`},
{hl:{app:[7,8]}, th:[['app','RUN:ok','render(u17, Mar, Apr)'],['GC','RUN:ok','']],
 g:[G('Heap (Xmx 2 GB)',['used after full GC','300 MB → 700 MB','hot']), G('Report cache',['entries','+1,200 / hour','hot'],['hit rate','0%','bad'],['why','key contains System.nanoTime()','bad'])],
 say:`Look at the key: it ends with <code>System.nanoTime()</code>, so <b>every key is unique</b>. <code>computeIfAbsent</code> never finds a match and always adds a new 12 KB entry. The cache has a 0% hit rate and only grows. Nobody noticed because it was never measured.`},
{th:[['app','RUN:warn','p99 latency creeping up'],['GC','RUN:warn','more frequent full GCs']],
 g:[G('Heap floor after each full GC',C('day',[['0: 300 MB'],['1: 650 MB'],['2: 1.0 GB'],['3: 1.4 GB','hot']]),['shape','sawtooth with a rising floor','bad']), G('Report cache',['entries','~95,000'],['hit rate','0%','bad'])], log:['[GC (G1 Evacuation Pause) 1.7G->1.4G(2.0G) 210ms]','[Full GC 1.9G->1.4G(2.0G) 1.9s]'],
 say:`<b>The signature of a leak</b> is not "high memory". A healthy heap is a sawtooth that drops back to the same floor. Here the floor <b>after each full GC keeps rising</b>. Reachable objects are accumulating. Alert on "old gen used after GC", not raw heap usage.`},
{th:[['app','WAITING:bad','stopped by GC pauses'],['GC','RUN:bad','full GC 4 s, frees 1%']],
 g:[G('Heap (Xmx 2 GB)',['used after full GC','1.98 GB','bad'],['time spent in GC','92%','bad'],['p99 latency','8 s','bad'])], log:['[Full GC 2.0G->1.98G(2.0G) 4.2s]','java.lang.OutOfMemoryError: Java heap space','pod report-7f9c restarted (liveness probe failed)'],
 say:`Day 5. Every full GC frees almost nothing, so the JVM spends most of its time collecting (<b>GC thrashing</b>), latency explodes, and finally <code>OutOfMemoryError</code>. Kubernetes restarts the pod and memory is back to 300 MB. That "fixes" it for five days, which is why leaks like this survive for months.`},
{th:[['app','RUN:info','new pod'],['GC','RUN:ok',''],['oncall','RUN:ok','collecting evidence']],
 g:[G('Class histogram (jcmd GC.class_histogram)',['byte[]','1.62 GB','bad'],['java.util.HashMap$Node','131,540'],['java.lang.String','131,600']), G('Make the next one easy',['-XX:+HeapDumpOnOutOfMemoryError','dump written on OOM','ok'],['-XX:HeapDumpPath=/dumps','on a persistent volume','ok'])],
 log:['$ jcmd 1 GC.class_histogram | head','$ jcmd 1 GC.heap_dump /dumps/report.hprof','Dumped 1.9 GB heap in 6 s'],
 say:`On-call takes evidence <b>before</b> restarting. A <b>class histogram</b> is cheap and already suspicious: 1.6 GB of <code>byte[]</code> and 131k HashMap nodes. A <b>heap dump</b> is the full picture. Run with <code>-XX:+HeapDumpOnOutOfMemoryError</code> so the next OOM leaves a dump behind automatically.`},
{th:[['oncall','RUN:ok','Eclipse MAT: dominator tree']], d:{type:'graph',bad:['map','e1','e2','e3'],on:['root'],e:[['root','cls','','bad'],['cls','map','static field','bad'],['map','e1','','bad'],['map','e2','','bad'],['map','e3','','bad']]},
 g:[G('Dominator tree (retained size)',['ReportService.CACHE','1.58 GB (87%)','bad'],['  HashMap$Node[] table','131,540 entries'],['next biggest','Hibernate SessionFactory, 41 MB'])],
 say:`In Eclipse MAT (or IntelliJ's profiler), the <b>dominator tree</b> ranks objects by how much memory would be freed if they were gone. One object retains 87% of the heap. The <b>path to GC roots</b> explains why it's never freed: a <b>static field</b>, held by the class, held by its class loader. It's reachable but useless, which is the definition of a leak (1.4).`},
{hl:{app:[4,8]}, th:[['oncall','RUN:warn','second finding']],
 g:[G('Second bug in the same line',['static HashMap','shared by 200 request threads','bad'],['concurrent computeIfAbsent','can corrupt buckets / lose entries','bad'],['Java 7 HashMap','resize race could loop forever'],['fix','a thread-safe cache','ok'])],
 say:`Reading the code shows a second bug. A plain <code>HashMap</code> in a static field is mutated by every request thread at once. That's undefined behaviour: lost entries, corrupted buckets, and on old JDKs an infinite loop during resize. Shared mutable state needs a concurrent structure (4.16).`},
{cv:'b', hl:{app:[3,4,6,13,14]}, th:[['app','RUN:ok','serving'],['GC','RUN:ok','young GC ~15 ms']], d:null,
 g:[G('Heap floor after full GC',C('day',[['0: 300 MB'],['3: 480 MB','ok'],['10: 480 MB','ok']]),['shape','flat floor','ok']), G('Report cache',['max size','~200 MB, by weight','ok'],['entry lifetime','30 min','ok'],['hit rate','61%','ok'],['concurrent loads of same key','one load, others wait','ok'])],
 say:`<b>The fix.</b> A real cache: <b>bounded</b> by weight, <b>expiring</b>, thread-safe, and <b>measured</b>. The key is a record of only the inputs that define the report, so identical requests now hit. Caffeine's <code>get(key, loader)</code> also loads each key only once under concurrency. The heap floor is flat and the hit rate is a dashboard metric.`},
{th:[], g:[G('Common leak sources',['unbounded static Map / List','this topic'],['ThreadLocal in a pool, no remove()','4.12'],['listeners registered, never removed','3.7f'],['inner class holding Outer.this','1.9'],['unbounded executor queue','4.13'],['class loader leak on redeploy','Metaspace OOM (1.3)']), G('Runbook',['1. confirm','floor after GC rising'],['2. capture','histogram + heap dump'],['3. analyse','dominator tree → path to GC roots'],['4. fix + guard','bound it, add a metric + alert','ok'])],
 say:`<b>Interview answer:</b> "I'd confirm it's a leak by the rising floor after full GC, capture a heap dump before restarting, open the dominator tree and follow the path to GC roots. The usual suspects are unbounded static collections, ThreadLocals in pools and forgotten listeners. The fix is to bound and expire the structure, and add a metric so it can't happen silently again."`}
],
keep:[`Leak signature: the heap floor after full GC rises over time. Alert on that, not raw usage.`,`Evidence first: class histogram, heap dump (HeapDumpOnOutOfMemoryError), dominator tree, path to GC roots.`,`Caches must be bounded, expiring, thread-safe and measured. Use Caffeine, not a static HashMap.`]}, {
  imp: 'good',
  theory: TH(`A memory leak in Java is data that stays reachable but is never used again; you find it by watching GC behaviour and analysing a heap dump.`,
`<p>The GC frees only objects nothing points to. If a long-lived object (often a static collection or cache) keeps adding entries and never removes them, memory grows until the JVM spends all its time collecting and finally throws OutOfMemoryError.</p>
<p>The tell-tale sign is that the amount of memory still in use <i>right after a full GC</i> keeps rising over time. To find the cause, take a <b>heap dump</b> and look at the <b>dominator tree</b>: it shows which objects keep the most memory alive, and the path from GC roots shows why.</p>`,
[[`Leak`,`Reachable but useless objects accumulating.`],[`Heap dump`,`A snapshot of every object in the heap (.hprof).`],[`Dominator tree`,`Objects ranked by how much memory they keep alive.`],[`Retained size`,`Memory freed if that object were removed.`]],
[`Confirm: memory after full GC rises over hours or days.`,`Capture: <code>jcmd &lt;pid&gt; GC.heap_dump</code> (or HeapDumpOnOutOfMemoryError).`,`Analyse in Eclipse MAT or IntelliJ: dominator tree, then path to GC roots.`,`Fix: bound, expire or remove the data; add a metric and alert.`],
[`Common sources: unbounded caches, ThreadLocals in pools, listeners never removed, unbounded queues.`],
[`Restarting pods on a schedule instead of fixing the leak.`,`Taking no evidence before restarting.`]),
  quiz: [
    [`A cache key is <code>userId + ":" + System.nanoTime()</code>. Effect?`,[`Better spread across buckets`,`It never hits and grows forever`,`Fewer collisions, faster gets`,`Entries expire after a while`],1,`Keys must contain exactly the inputs that determine the value.`,'E'],
    [`Which GC pattern most strongly suggests a leak?`,[`Heap reaching 90% between collections`,`Many young GCs every minute`,`Memory after each full GC rising for days`,`One long pause right after a deploy`],2,`A healthy heap returns to a stable floor. A rising floor means reachable data is piling up.`,'M'],
    [`In a heap dump, what does the dominator tree tell you?`,[`Memory freed if an object became unreachable`,`Which thread allocated the most memory`,`The oldest objects still in the heap`,`Which classes were loaded most often`],0,`Combined with the path to GC roots, it shows what holds memory and why.`,'H'],
    [`What is a memory leak in Java?`,[`Objects the GC forgets to track after a full collection cycle`,`Objects still referenced but no longer needed, so the GC can't free them`,`Unreferenced objects the GC hasn't collected yet at that moment`,`Memory used by large arrays that the JVM can't compact`],1,`Reachable but useless.`,'E'],
    [`Which file format is a Java heap dump?`,[`.jfr`,`.hprof`,`.log`,`.class`],1,`Open it in Eclipse MAT or IntelliJ.`,'E'],
    [`Which tool gives a cheap overview of what's filling the heap?`,[`Thread dump`,`jcmd GC.class_histogram`,`top`,`EXPLAIN`],1,`Counts and bytes per class.`,'M'],
    [`What's wrong with a static <code>HashMap</code> cache with no eviction?`,[`Its entries are weakly held, so the GC may drop them`,`It grows forever and is shared across threads unsafely`,`Static maps are copied per thread, wasting memory`,`Lookups slow down as it rehashes on every put`],1,`Use a bounded concurrent cache.`,'E'],
    [`Restarting a leaking service every night is?`,[`A proper fix, since the heap starts clean each day`,`A workaround that hides the bug and loses evidence`,`Best practice recommended by the JVM documentation`,`A fix, as long as the restart is during low traffic`],1,`Capture a dump, find the root cause.`,'M'],
  ],
  quizAdv: [
    [`Container memory limit 2 GiB with <code>-Xmx2g</code>. The pod is OOMKilled without a Java OOM. Why?`,[`Non-heap memory pushes RSS over`,`The GC leaked native memory`,`Kubernetes counts the heap twice`,`-Xmx is ignored in containers`],0,`Metaspace, thread stacks, code cache and direct buffers add up. Leave headroom (e.g. MaxRAMPercentage=75).`,'H'],
    [`<code>-XX:+HeapDumpOnOutOfMemoryError</code> is set, but no dump appears after a crash. Likely?`,[`Dumps are disabled in Java 17+`,`The flag needs a full GC first`,`The heap was too small to dump`,`Ephemeral disk, or kernel kill`],3,`Point HeapDumpPath at a persistent volume and keep heap below the container limit.`,'H'],
    [`What does the "path to GC roots" in MAT show?`,[`The stack traces where the object was allocated`,`The chain of references keeping an object alive`,`The sequence of GC cycles the object survived`,`The threads that last read or wrote the object`],1,`Points straight at the culprit.`,'M'],
    [`Old gen usage looks like a sawtooth whose low points stay flat. Leak?`,[`Yes: every sawtooth peak means a growing heap`,`Probably not: memory is reclaimed back to a stable level`,`Yes: old gen should drop to near zero after each GC`,`Only if the collector in use is G1 rather than ZGC`],1,`A rising floor is the signal.`,'M'],
  ],
});
