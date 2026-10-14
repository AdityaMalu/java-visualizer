/* 6.6 Shared SimpleDateFormat: wrong data, no errors */
topic('6', { no:'6.6', title:'Shared SimpleDateFormat: wrong data, no errors', idea:`A singleton parser shares one <code>SimpleDateFormat</code> across consumer threads. Under load, two parses interleave inside its shared Calendar and invoices get the wrong due date. Then the immutable fix.`,
actors:'Kafka consumer threads', stateTitle:'Shared object', dgTitle:'Ownership',
codes:{a:`@Component
class InvoiceParser {
  // "creating one per call is slow", so share one
  private static final SimpleDateFormat FMT = new SimpleDateFormat("yyyy-MM-dd");

  Date dueDate(String s) throws ParseException {
    return FMT.parse(s);    // resets + fills FMT's shared Calendar, then reads it
  }
}
// 8 consumer threads call dueDate() in parallel`,
b:`@Component
class InvoiceParser {
  // immutable and thread-safe: share freely
  private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_LOCAL_DATE;

  LocalDate dueDate(String s) {
    return LocalDate.parse(s, FMT);   // no shared mutable state
  }
}`},
steps:[
{hl:{A:[7]}, th:[['A','RUN','parse("2024-03-31")'],['B','READY','about to parse("2025-12-05")']],
 g:[G('FMT.calendar (one object, shared)',['year','2024','hot'],['month','MARCH','hot'],['day','31','hot'])],
 say:`<code>SimpleDateFormat</code> looks like a pure function, but it isn't. It keeps an internal <code>Calendar</code>, and <code>parse()</code> works by <b>clearing it, setting fields, then reading the date back</b>. Thread A has set 2024-03-31 and is about to read it.`},
{hl:{B:[7]}, th:[['A','READY','preempted before reading'],['B','RUN','parse("2025-12-05")']],
 g:[G('FMT.calendar (one object, shared)',['year','2025','bad'],['month','DECEMBER','bad'],['day','5','bad'])], log:['context switch A → B'],
 say:`Context switch. Thread B parses another invoice on the <b>same</b> formatter. It clears the shared Calendar and writes its own fields over A's.`},
{hl:{A:[7]}, th:[['A','TERM:bad','returned 2025-12-05'],['B','TERM','returned 2025-12-05']],
 g:[G('Results',['invoice A due date','2025-12-05 (expected 2024-03-31)','bad'],['invoice B due date','2025-12-05','ok'],['exception','none','bad'])], log:['✘ invoice INV-1043 dueDate = 2025-12-05 (expected 2024-03-31)'],
 say:`A resumes and reads the Calendar: it gets <b>B's date</b>. No exception, no log line, just <b>wrong data</b>. Depending on the timing you can also get a mix of both dates or an odd exception from the shared number parser.`},
{th:[['A','done:dim',''],['B','done:dim','']],
 g:[G('What production saw',['NumberFormatException: multiple points','rare, random','bad'],['ArrayIndexOutOfBoundsException in DigitList','rare, random','bad'],['invoices with wrong due dates','silent','bad'],['late fees charged early','support tickets','bad'])], log:['java.lang.NumberFormatException: multiple points','  at java.text.DecimalFormat.parse','  at java.text.SimpleDateFormat.parse','  at InvoiceParser.dueDate(InvoiceParser.java:7)'],
 say:`In production the visible symptoms were <b>rare, random exceptions</b> that nobody could reproduce, and the invisible one was worse: some invoices got wrong due dates, and customers were charged late fees early. Unit tests pass because they're single-threaded. The error rate grows with load.`},
{cv:'b', hl:{A:[7],B:[7]}, th:[['A','TERM:ok','2024-03-31'],['B','TERM:ok','2025-12-05']],
 g:[G('DateTimeFormatter',['mutable state','none','ok'],['thread-safe','yes, share one instance','ok'],['returns','LocalDate (immutable)','ok'])], logReset:true, log:['✔ 10M parses on 8 threads, 0 mismatches'],
 say:`<b>The fix:</b> <code>java.time.DateTimeFormatter</code> is <b>immutable</b>, so one shared instance is safe. Each parse keeps its working state in local variables on its own thread's stack (4.1). It returns an immutable <code>LocalDate</code> instead of a mutable <code>Date</code>.`},
{th:[], g:[G('If you must keep SimpleDateFormat',['new instance per call','simple, a bit of garbage','ok'],['ThreadLocal<SimpleDateFormat>','works; mind 4.12 caveats'],['synchronized parse','correct, but serialises all threads']), G('Not thread-safe (don\'t share mutably)',['SimpleDateFormat, DecimalFormat','✘'],['HashMap, ArrayList, StringBuilder','✘'],['MessageDigest, Cipher','✘'],['JDBC Connection','✘']), G('Safe to share',['DateTimeFormatter, String, records','✔'],['ConcurrentHashMap, AtomicLong','✔'],['Jackson ObjectMapper (after configuration)','✔'])],
 say:`<b>Interview answer:</b> "Spring beans are singletons (5.2), so any mutable field in a bean is shared by every request thread. SimpleDateFormat keeps parse state in fields, so concurrent use corrupts results. I'd replace it with the immutable DateTimeFormatter, and in reviews I'd look for non-thread-safe objects stored in static or singleton fields."`}
],
keep:[`SimpleDateFormat keeps state in fields → sharing it across threads corrupts results, often silently.`,`Use immutable java.time (DateTimeFormatter, LocalDate); share them freely.`,`Singleton beans and static fields are shared by all threads: audit them for mutable, non-thread-safe objects.`]}, {
  imp: 'good',
  theory: TH(`Some common classes keep internal state in fields and aren't safe to share between threads; sharing one in a singleton silently corrupts results.`,
`<p>Spring beans are singletons, so their fields are shared by every request thread. If a bean holds a <code>SimpleDateFormat</code>, a <code>HashMap</code> that's written to, or a <code>StringBuilder</code>, threads overwrite each other's work. <code>SimpleDateFormat</code> is a classic: <code>parse()</code> uses an internal Calendar, so two concurrent parses can return each other's dates, with no exception.</p>
<p>The fix is to use immutable, thread-safe replacements (<code>DateTimeFormatter</code>, java.time types), or not share the object at all.</p>`,
[[`Thread-safe`,`Correct when used from several threads at once.`],[`Immutable`,`Can't change, so it's always safe to share.`],[`Thread confinement`,`Each thread uses its own instance.`]],
[`Review static fields and singleton bean fields.`,`For each mutable, non-thread-safe object, replace it with an immutable alternative or create it per use.`,`Test concurrency-sensitive code with many threads, not only single-threaded unit tests.`],
[`java.time (DateTimeFormatter, LocalDate) for dates; ConcurrentHashMap for shared maps; ThreadLocalRandom for random numbers.`],
[`Assuming a class is thread-safe because it's in the JDK.`,`Trusting single-threaded unit tests for concurrency bugs.`]),
  quiz: [
    [`Which is safe to keep in a <code>static final</code> field and use from many threads?`,[`new SimpleDateFormat("yyyy-MM-dd")`,`new StringBuilder()`,`DateTimeFormatter.ofPattern("yyyy-MM-dd")`,`new DecimalFormat("#.00")`],2,`java.time formatters are immutable. SimpleDateFormat and DecimalFormat keep parse/format state in fields.`,'E'],
    [`Why is sharing one SimpleDateFormat across threads unsafe?`,[`Its methods keep state in shared fields (a Calendar)`,`Only format() is unsafe; parse() is fine`,`It holds a lock that serialises all callers`,`It caches and returns the last parsed date`],0,`Both parse and format use the shared Calendar and number format.`,'M'],
    [`Every unit test of the parser passes. Why didn't they catch it?`,[`The bug is in the JDK, so tests can't see it`,`Tests run with a different default locale`,`Tests mock every date they use`,`They're single-threaded; it needs interleaving`],3,`Concurrency bugs are timing-dependent; they need concurrent tests or code review.`,'H'],
    [`Why are Spring singleton beans' fields risky?`,[`They're recreated per request, so field values get lost`,`All request threads share them, so mutable fields can race`,`Their fields live on each thread's stack and aren't shared`,`Spring makes their fields final, so they can't be updated`],1,`Keep beans stateless.`,'E'],
    [`Is <code>java.time.DateTimeFormatter</code> thread-safe?`,[`No`,`Yes: it's immutable`,`Only with ThreadLocal`,`Only in Java 21`],1,`Share one instance.`,'E'],
    [`Is <code>StringBuilder</code> thread-safe?`,[`Yes (its append is synchronized)`,`No (StringBuffer is synchronized)`,`No (but StringBuffer isn't either)`,`Yes, since Java 9's compact strings`],1,`Keep StringBuilders local.`,'M'],
    [`Why do concurrency bugs like this pass unit tests?`,[`JUnit runs each test in a lock, which hides races`,`Tests are single-threaded; the bug only appears under interleaving`,`The JIT removes races in short-running test methods`,`Mockito proxies synchronize every call on a mocked bean`],1,`Use stress tests and code review.`,'E'],
    [`Fix for a shared SimpleDateFormat if you can't switch to java.time?`,[`Make it a static final field so all threads share it safely`,`Create one per call, use a ThreadLocal, or synchronize access`,`Declare it volatile so every thread sees its latest state`,`Call clone() on it once at startup and share the copy`],1,`DateTimeFormatter is still the best fix.`,'M'],
  ],
  quizAdv: [
    [`A shared Jackson <code>ObjectMapper</code> singleton. Safe?`,[`Yes, once configured`,`No: one per request`,`Only with synchronized`,`Only with ThreadLocal`],0,`Creating mappers per call is expensive.`,'M'],
    [`One <code>java.util.Random</code> shared across many threads?`,[`Unsafe: it returns duplicate values`,`Unsafe: it corrupts its seed`,`Safe and fast under contention`,`Safe but contended; use ThreadLocalRandom`],3,`Random uses CAS on a shared seed.`,'H'],
    [`Is <code>HashMap</code> safe if threads only read it after it was fully built and safely published?`,[`No: get() may still rehash the table and corrupt it on reads`,`Yes: concurrent reads of an unchanging, safely published map are fine`,`Only if the values are volatile, so updates become visible`,`No: even reads need ConcurrentHashMap to avoid infinite loops`],1,`Publish via final field, volatile, or before starting threads.`,'H'],
    [`Jackson's ObjectMapper: create per request or share?`,[`Create one per request, since its internal caches aren't thread-safe`,`Share one configured instance; it's thread-safe and expensive to create`,`Use one per thread via ThreadLocal, as its config isn't synchronized`,`Create one per call; construction is cheap and avoids shared state`],1,`Don't reconfigure it while in use.`,'M'],
  ],
});
