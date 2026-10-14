/* 7.6 What changed from Java 8 to Java 25 */
topic('7', { no:'7.6', title:'What changed from Java 8 to Java 25', imp:'must', idea:`The features interviewers ask about, version by version, and the same code written in Java 8 style versus modern Java.`,
actors:'Thread', stateTitle:'Release timeline',
codes:{a:`// Java 8 style
List<String> names = Arrays.asList("Ana", "Raj");
if (obj instanceof Order) { Order o = (Order) obj; total += o.amount(); }
String sql = "SELECT *\\n" + "FROM orders\\n";

// Modern Java
var names2 = List.of("Ana", "Raj");                   // Java 9 / 10
record Order(String id, long amount) {}               // Java 16
if (obj instanceof Order o) total += o.amount();      // Java 16
String sql2 = """
    SELECT *
    FROM orders
    """;                                              // Java 15
String label = switch (shape) {                       // Java 21
  case Circle c -> "circle r=" + c.r();
  case Square s -> "square " + s.side();
};
names2.getFirst();                                    // Java 21
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) { }  // Java 21`},
steps:[
{hl:{main:[1,2,3,4]}, th:[], g:[G('Release model',['LTS versions','8, 11, 17, 21, 25'],['cadence','a release every 6 months, LTS every 2 years'],['in production today','mostly 17 and 21, moving to 25'])],
 say:`Java ships a new version every <b>six months</b>, and every two years one is a <b>Long-Term Support</b> (LTS) release that companies standardise on: 8, 11, 17, 21 and 25. Interviewers usually ask "what did 8 bring?" and "what's new in 17/21?".`},
{hl:{main:[2,3]}, g:[G('Java 8 (2014, LTS)',['lambdas + method refs','2.12','ok'],['Stream API','2.13','ok'],['Optional','2.14'],['java.time','7.4'],['default methods','3.5'],['CompletableFuture','4.14'])],
 say:`<b>Java 8</b> was the big shift to functional style: lambdas, streams, Optional, the new date/time API, default methods in interfaces, and CompletableFuture.`},
{hl:{main:[7]}, g:[G('Java 9 – 11',['9: modules (JPMS), List.of / Set.of / Map.of, jshell','ok'],['10: var for local variables','ok'],['11 (LTS): HttpClient, String.isBlank / lines / strip / repeat, Files.readString, run a .java file directly'])],
 say:`<b>9</b> added modules and immutable collection factories; <b>10</b> added <code>var</code>; <b>11</b> (LTS) added the standard HttpClient and handy String and Files methods.`},
{hl:{main:[8,9,10,11,12,13]}, g:[G('Java 12 – 17',['14: switch expressions, helpful NullPointerException messages','ok'],['15: text blocks (""")','ok'],['16: records, pattern matching for instanceof, Stream.toList()','ok'],['17 (LTS): sealed classes; JDK internals strongly encapsulated'])],
 say:`Up to <b>17</b>: switch expressions, text blocks for multi-line strings, records, <code>instanceof</code> with a binding variable, and sealed classes. 17 also locked down reflective access to JDK internals, which broke some old libraries.`},
{hl:{main:[14,15,16,17,18,19]}, g:[G('Java 21 (LTS)',['virtual threads','4.17','ok'],['pattern matching for switch + record patterns','2.14','ok'],['sequenced collections','getFirst / getLast / reversed()','ok'],['generational ZGC','low pauses, better throughput'])],
 say:`<b>21</b> is the headline LTS for modern backends: <b>virtual threads</b>, pattern matching in switch (with record deconstruction), sequenced collections with <code>getFirst()</code>/<code>reversed()</code>, and generational ZGC.`},
{hl:{main:[19]}, g:[G('Java 22 – 25',['22: unnamed variables _ , foreign function & memory API'],['24: stream gatherers; synchronized no longer pins virtual threads'],['25 (LTS): scoped values, compact source files + instance main, flexible constructor bodies, module import declarations, compact object headers','ok'])],
 say:`Since 21: unnamed variables (<code>_</code>), the FFM API for calling native code, stream gatherers, virtual threads no longer pinned by <code>synchronized</code> (24), and in <b>25 (LTS)</b> scoped values (a safer ThreadLocal), simpler <code>void main()</code> programs, statements before <code>super(...)</code> in constructors, and smaller object headers.`},
{th:[], g:[G('Upgrading 8 → 17/21',['removed APIs','javax.* EE modules (JAXB, javax.annotation) → jakarta.*'],['illegal reflective access','now an error: upgrade libraries'],['Spring Boot 3','requires Java 17+ and jakarta namespace','hot'],['payoff','faster GC, lower memory, virtual threads','ok'])],
 say:`<b>Say it:</b> "8 brought lambdas, streams, Optional and java.time. 11 added var, HttpClient and List.of. 17 brought records, sealed classes, switch expressions and text blocks. 21 added virtual threads and pattern matching for switch. Spring Boot 3 needs Java 17+, and moving there mostly means jakarta packages and newer library versions."`}
],
keep:[`LTS: 8, 11, 17, 21, 25; a new release every 6 months.`,`8: lambdas/streams/Optional/java.time · 11: var, HttpClient · 17: records, sealed, switch expr, text blocks · 21: virtual threads, pattern switch, sequenced collections.`,`25: scoped values, compact source files, flexible constructor bodies. Spring Boot 3 needs Java 17+.`]}, {
  imp: 'good',
  theory: TH(`Java evolves every six months, with a long-term-support release every two years; knowing the headline features of 8, 11, 17, 21 and 25 shows you write modern Java.`,
`<p>Java 8 (2014) introduced lambdas and streams and stayed dominant for years. Since 2017 Java has released a new version every six months, which made features arrive steadily instead of in huge jumps. Companies mostly run <b>LTS</b> versions: 11, 17, 21 and now 25.</p>
<p>Modern Java code looks noticeably different from Java 8: records instead of boilerplate classes, <code>var</code>, text blocks, switch expressions, pattern matching, sealed types and virtual threads.</p>`,
[[`LTS`,`Long-Term Support release, maintained for years.`],[`Preview feature`,`Included but not final; must be enabled with --enable-preview.`],[`JEP`,`JDK Enhancement Proposal: the document describing a feature.`],[`jakarta.*`,`New package names for Java EE APIs, required by Spring Boot 3.`]],
[`Know the headline features of each LTS.`,`Know which version your framework needs (Spring Boot 3 → Java 17+).`,`When upgrading: update build plugins and libraries, move javax.* to jakarta.*, fix illegal reflective access.`],
[`Use records, switch expressions, text blocks and pattern matching in new code.`,`Enable virtual threads in Spring Boot on Java 21+.`],
[`Claiming a feature from a preview version as standard.`,`Staying on Java 8 and missing years of GC and performance improvements.`]),
  quiz: [
    [`Which version introduced lambdas and the Stream API?`,[`Java 7`,`Java 8`,`Java 11`,`Java 17`],1,`Java 8 (2014).`,'E'],
    [`Records, sealed classes and switch expressions are all standard by which LTS?`,[`Java 11`,`Java 17`,`Java 21`,`Java 25`],1,`Switch expressions (14), records (16), sealed classes (17).`,'M'],
    [`Spring Boot 3 requires at least?`,[`Java 8`,`Java 11`,`Java 21`,`Java 17`],3,`Boot 3 is built on Spring 6, which needs Java 17 and the jakarta.* namespace.`,'M'],
    [`Which version added <code>var</code> for local variables?`,[`8`,`10`,`14`,`17`],1,`Local variable type inference.`,'E'],
    [`Which LTS is the minimum for Spring Boot 3?`,[`8`,`11`,`17`,`21`],2,`And jakarta.* packages.`,'E'],
    [`Text blocks (""") became standard in?`,[`11`,`15`,`17`,`21`],1,`Multi-line strings.`,'M'],
    [`Records became standard in?`,[`14`,`16`,`17`,`21`],1,`Previewed in 14 and 15.`,'M'],
    [`Virtual threads became standard in?`,[`17`,`19`,`21`,`25`],2,`JEP 444.`,'E'],
  ],
  quizAdv: [
    [`Which Java 21 feature lets you write <code>list.getFirst()</code> and <code>list.reversed()</code>?`,[`Sequenced collections`,`Stream gatherers`,`Record patterns`,`Scoped values`],0,`SequencedCollection adds first/last/reversed to ordered collections.`,'M'],
    [`What do scoped values (final in Java 25) replace in many cases?`,[`synchronized, for guarding shared mutable state across threads`,`ThreadLocal, for sharing mutable per-request state between threads`,`ThreadLocal, for passing immutable context to callees and child tasks`,`CompletableFuture, for passing async results to child tasks`],2,`They're immutable, bounded to a scope, and cheap with virtual threads.`,'H'],
    [`What does "helpful NullPointerExceptions" (Java 14+) add?`,[`An automatic null check on every method parameter`,`Messages naming exactly which variable or call was null`,`Stack traces that show the full value of every local`,`A compile-time warning listing variables that may be null`],1,`e.g. Cannot invoke "String.length()" because "name" is null.`,'M'],
    [`Moving from javax.* to jakarta.* matters for which upgrade?`,[`Java 8 → 11 (removal of the Java EE modules)`,`Spring Boot 2 → 3 (Jakarta EE 9+)`,`Spring Boot 1 → 2 (Jakarta EE 8)`,`Java 17 → 21 (virtual threads)`],1,`Imports like javax.persistence become jakarta.persistence.`,'M'],
  ],
});
