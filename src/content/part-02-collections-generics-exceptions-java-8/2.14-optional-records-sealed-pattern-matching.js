/* 2.14 Optional, records, sealed, pattern matching */
topic('2', { no:'2.14', title:'Optional, records, sealed, pattern matching', idea:`See where <code>orElse</code> wastes work, how a record's compact constructor validates, and how sealed types make a switch exhaustive.`,
actors:'Values', stateTitle:'Evaluation',
codes:{a:`Optional<Car> car = repo.findById(7);          // Optional[Car] or empty
String city = car.map(Car::city).orElse("unknown");
Car c1 = car.orElse(createDefault());          // ✘ createDefault() ALWAYS runs
Car c2 = car.orElseGet(() -> createDefault()); // ✔ only when empty
Car c3 = car.orElseThrow(() -> new NotFound(7));
// ✘ car.get() unchecked;  ✘ Optional fields / params / collections`,
b:`sealed interface Payment permits Upi, Card {}
record Upi(String vpa) implements Payment {}
record Card(String last4) implements Payment {
  Card { if (last4.length() != 4) throw new IllegalArgumentException(); }
}
String describe(Payment p) {
  return switch (p) {
    case Upi u  -> "UPI " + u.vpa();
    case Card c -> "Card " + c.last4();
  };                    // no default: the compiler knows it's exhaustive
}`},
steps:[
{cv:'a', hl:{car:[1,2]}, th:[['car','Optional[Car]:ok','found']], g:[G('map → orElse',['car.map(Car::city)','Optional["Pune"]'],['orElse("unknown")','"Pune"','ok'])], log:['city = Pune'],
 say:`<code>Optional</code> is a box for a <b>return value that may be absent</b>. It makes "might be missing" visible in the type. <code>map</code> transforms the contents if present; an empty Optional stays empty.`},
{hl:{car:[3]}, th:[['car','Optional[Car]:ok','present']], g:[G('car.orElse(createDefault())',['argument evaluated first','createDefault() RUNS (DB insert?)','bad'],['then','value discarded, Car returned'])], log:['createDefault() called ✘ (wasted, maybe harmful)'],
 say:`<b>Gotcha:</b> <code>orElse(x)</code> is an ordinary method call, so Java evaluates <code>x</code> <b>before</b> calling it, even when the Optional is full. If <code>createDefault()</code> is expensive or has side effects (it saves a row), that's a bug.`},
{hl:{car:[4]}, g:[G('car.orElseGet(supplier)',['supplier called?','only if empty','ok'],['present here','no call','ok'])],
 say:`<code>orElseGet(Supplier)</code> is <b>lazy</b>: the supplier runs only when the Optional is empty. Rule: <code>orElse</code> for constants, <code>orElseGet</code> for anything computed.`},
{hl:{car:[5,6]}, th:[['car','Optional.empty:warn','id 7 missing']], log:['✘ NotFound: 7  → 404'],
 g:[G('Optional rules',['return types','✔ that\'s what it\'s for','ok'],['fields / parameters','✘ not Serializable; use null or overloads','bad'],['Optional<List>','✘ return an empty list','bad'],['get() unchecked','✘ NoSuchElementException','bad'],['flatMap','when the mapper itself returns Optional'])],
 say:`<code>orElseThrow</code> turns absence into a domain exception (mapped to 404 by your controller advice). Don't use Optional for fields, parameters or collections, and don't call <code>isPresent()</code> + <code>get()</code>; chain instead.`},
{cv:'b', hl:{p:[2,3,4]}, th:[['p','new Card("12345"):bad','compact ctor rejects']], g:[G('record Card generates',['private final field','last4'],['canonical constructor','(+ your compact validation)','hot'],['accessor','last4()  (no "get")'],['equals / hashCode / toString','from all components','ok'])], log:['✘ IllegalArgumentException'],
 say:`A <b>record</b> (Java 16) is a transparent, immutable data carrier: final fields, constructor, accessors, equals/hashCode/toString, all generated. The <b>compact constructor</b> validates or normalises inputs (copy lists here, see 1.10). Records can implement interfaces but can't extend classes.`},
{hl:{p:[1]}, g:[G('sealed interface Payment',['permits','Upi, Card ONLY'],['other classes implementing it','compile error','ok'],['subclasses must be','final, sealed, or non-sealed'])],
 say:`<b>sealed</b> (Java 17) limits which classes may implement or extend a type. The set of cases is <b>closed and known</b> to the compiler, which models "a Payment is either UPI or Card" (an algebraic data type).`},
{hl:{p:[6,7,8,9,10]}, th:[['p','Upi("a@okbank"):ok','case Upi u matched']], log:['UPI a@okbank'],
 say:`<b>Pattern matching for switch</b> (Java 21) tests the type and binds a variable in one step. Since Payment is sealed and both cases are covered, <b>no default is needed</b>. Add a <code>Wallet</code> permit later and every such switch <b>fails to compile</b> until you handle it. Also: <code>case Card c when c.last4().startsWith("4")</code> guards, and record deconstruction <code>case Upi(String vpa)</code>.`},
{th:[], g:[G('Java versions to name',['8','lambdas, streams, Optional, CompletableFuture, java.time'],['11','HttpClient, var in lambdas, String::isBlank'],['17 (LTS)','records, sealed, text blocks, switch expressions'],['21 (LTS)','virtual threads, pattern switch, record patterns, sequenced collections'])],
 say:`A good answer to "what's new in Java?" names one or two features per LTS release and says <b>why you used them</b>. For example: "records for DTOs, sealed + switch for payment types, virtual threads for our I/O-bound fan-out."`}
],
keep:[`Optional for return types; orElse evaluates eagerly, orElseGet lazily.`,`Records: immutable carriers; compact constructor for validation.`,`Sealed + pattern switch = compiler-checked exhaustive cases.`]}, {
  imp: 'good',
  theory: TH(`Modern Java (8–21) added tools that make intent explicit: Optional for "maybe no value", records for data classes, sealed types and pattern matching for closed sets of cases.`,
`<p><b>Optional&lt;T&gt;</b> is a box that's either empty or holds one value. A method returning Optional says "there may be no result", so callers handle that case instead of getting a surprise null.</p>
<p><b>Records</b> (<code>record Money(long cents, String ccy) {}</code>) are compact immutable data classes: constructor, accessors, equals, hashCode and toString are generated.</p>
<p><b>Sealed</b> interfaces list exactly which classes may implement them. Combined with <b>pattern matching</b> in <code>switch</code>, the compiler can check you handled every case.</p>`,
[[`Optional`,`Container for zero or one value; use map, orElse, orElseGet, orElseThrow.`],[`Record`,`Immutable data carrier with generated boilerplate.`],[`Compact constructor`,`Record constructor without parameters list, for validation.`],[`Sealed / permits`,`Restricts which classes can extend a type.`],[`Pattern matching`,`instanceof and switch that test a type and bind a variable at once.`]],
[`Return <code>Optional.ofNullable(x)</code>; callers use <code>.map(...).orElse(default)</code>.`,`Declare a record; validate inputs in its compact constructor.`,`Declare <code>sealed interface Shape permits Circle, Square</code>.`,`<code>switch (shape) { case Circle c -&gt; …; case Square s -&gt; …; }</code> needs no default, and fails to compile if a case is missing.`],
[`Use Optional for return values, not for fields or parameters.`,`Records are perfect for DTOs, events, value objects and composite keys.`,`Sealed types fit domain states and results (Success / Failure).`],
[`<code>optional.get()</code> without checking: use orElseThrow with a clear message.`,`<code>orElse(expensiveCall())</code>: it runs even when a value is present; use orElseGet.`]),
  quiz: [
    [`Where do you validate fields of <code>record Money(long cents, String ccy)</code>?`,[`In a setter, since record components are mutable`,`In a compact constructor: Money { if (cents &lt; 0) throw … }`,`In equals(), which runs on every comparison`,`Nowhere: records can't validate, so use a class`],1,`The compact canonical constructor runs before the fields are assigned.`,'E'],
    [`<code>opt.orElse(loadDefault())</code> vs <code>opt.orElseGet(this::loadDefault)</code> when opt is present?`,[`Both skip loadDefault when a value is present`,`orElseGet calls it too but discards the result`,`orElse still calls loadDefault; orElseGet doesn't`,`orElse caches the result, so it's the cheaper one`],2,`The argument to orElse is evaluated before the call. Use orElseGet for expensive defaults.`,'M'],
    [`What do you get from <code>sealed interface Shape permits Circle, Square</code> plus a pattern-matching switch?`,[`Faster dispatch, because the JVM uses a jump table for sealed types`,`Permitted subclasses become implicitly final and immutable`,`Only classes declared in the same file are allowed to implement it`,`Exhaustiveness checks: a new permitted type breaks unhandled switches`],3,`Sealed hierarchies plus switch patterns turn "forgot a case" into a compile error. Permitted subclasses can live in other files of the same package or module.`,'H'],
    [`Which Optional method throws if empty?`,[`orElse`,`orElseThrow`,`isPresent`,`ofNullable`],1,`Prefer orElseThrow with a clear exception.`,'E'],
    [`<code>Optional.of(null)</code>?`,[`Returns empty`,`Throws NullPointerException`,`Returns Optional[null]`,`Compile error`],1,`Use ofNullable for maybe-null values.`,'M'],
    [`What do records generate?`,[`Private fields, getters, setters, equals/hashCode`,`Final fields, constructor, accessors, equals/hashCode`,`Final fields, no-arg constructor, getX() getters`,`Static fields, a builder, accessors and toString`],1,`Accessors are named like the components: name().`,'E'],
    [`Can a record extend another class?`,[`Yes: any non-final class, like a normal class`,`No: records extend Record; interfaces only`,`Only abstract classes with a no-arg constructor`,`Only other records, forming record hierarchies`],1,`Records are final too.`,'M'],
    [`Pattern matching: <code>if (obj instanceof String s &amp;&amp; s.length() &gt; 3)</code> — is s usable in the second condition?`,[`No: s is only in scope inside the if body`,`Yes: s is in scope once the instanceof is true`,`Only after an explicit cast to String`,`Only in Java 25 and later`],1,`Flow scoping.`,'M'],
  ],
  quizAdv: [
    [`Optional as a field or method parameter?`,[`Recommended everywhere instead of null`,`Required by JPA for nullable columns`,`Discouraged: meant for return types`,`Faster than writing null checks`],2,`Use it to signal "maybe no result" from methods.`,'M'],
    [`<code>record Bytes(byte[] data)</code>. Two records with equal byte contents: <code>equals</code>?`,[`false: it compares array references`,`true: records compare contents`,`Compile error: arrays aren't allowed`,`It throws`],0,`Override equals/hashCode with Arrays.equals/hashCode, or use List&lt;Byte&gt;.`,'H'],
    [`What is a record pattern: <code>if (o instanceof Point(int x, int y))</code>?`,[`Invalid syntax in current Java`,`Deconstructs the record and binds x and y`,`Creates a new Point from x and y`,`Checks equality against Point(x, y)`],1,`Also works in switch cases.`,'H'],
    [`Why shouldn't you call <code>optional.get()</code> without checking?`,[`get() is slow compared with orElse`,`It throws NoSuchElementException when empty`,`get() is deprecated since Java 10`,`It silently returns null when empty`],1,`Use map/orElse/orElseThrow instead.`,'M'],
  ],
});
