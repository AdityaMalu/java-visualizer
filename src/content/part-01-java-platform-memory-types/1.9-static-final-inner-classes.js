/* 1.9 static, final, inner classes */
topic('1', { no:'1.9', title:'static, final, inner classes', idea:`One static field shared by all objects, final references to mutable objects, and the hidden <code>Outer.this</code> that makes inner classes leak.`,
actors:'Objects', stateTitle:'Memory',
codes:{a:`class Car {
  static int count = 0;              // ONE copy, belongs to the class
  final String vin;                  // set once, per object
  final List<String> tags = new ArrayList<>();
  int price;
  Car(String vin) { this.vin = vin; count++; }
  static int total() { return count; }   // no 'this' here
}
Car c1 = new Car("V1");
Car c2 = new Car("V2");
c1.tags.add("sunroof");            // ✔ final ref, mutable object
// c1.tags = new ArrayList<>();    // ✘ compile error
class Outer { byte[] big = new byte[10_000_000];
  class Inner {}                    // holds hidden Outer.this
  static class Nested {} }          // no outer reference`},
steps:[
{hl:{Car:[2]}, th:[], g:[G('Car.class (static storage)',['count','0','hot'])],
 say:`<code>static</code> fields belong to the <b>class</b>, not to any object. There's exactly one <code>count</code>, created when Car is initialised (1.2), whether you make 0 or 1,000 cars.`},
{hl:{main:[9]}, th:[['c1','RUN:ok','vin = V1']], g:[G('Car.class (static storage)',['count','1','hot']), G('c1 (heap)',['vin','"V1" (final)'],['tags','→ []'],['price','0'])],
 say:`Each object gets its own instance fields. The constructor increments the <b>shared</b> counter. (In multithreaded code, that <code>count++</code> is a race, see 4.4; use AtomicInteger.)`},
{hl:{main:[10]}, th:[['c1','RUN:ok','vin = V1'],['c2','RUN:ok','vin = V2']], g:[G('Car.class (static storage)',['count','2','hot']), G('c1 (heap)',['vin','"V1"'],['tags','→ []']), G('c2 (heap)',['vin','"V2"'],['tags','→ []'])],
 say:`Two objects, two vins, one count. <code>Car.total()</code> is static: no <code>this</code>, so it can't read <code>vin</code> or <code>price</code>. Static methods are <b>hidden</b>, not overridden (3.2).`},
{hl:{main:[11,12]}, g:[G('c1 (heap)',['tags (final ref)','→ ["sunroof"]','ok'],['reassign tags?','compile error','bad'])],
 say:`<code>final</code> on a reference means "this <b>arrow</b> can't be re-pointed". It does <b>not</b> make the object immutable. You can still add to a final list. For real immutability you need unmodifiable contents too (1.10).`},
{g:[G('final field + JMM',['after constructor finishes','other threads see final fields correctly','ok'],['without final','might see default (null / 0) if published unsafely','bad']), G('final on…',['variable','can\'t reassign'],['method','can\'t override'],['class','can\'t extend (String, Integer)']), G('Access (narrow → wide)',['private','class only'],['(default)','same package'],['protected','package + subclasses'],['public','everyone'])],
 say:`An SDE-2 point: <code>final</code> fields get a special <b>memory-model guarantee</b> (JLS 17.5). Once the constructor completes, any thread that sees the object sees its final fields fully initialised, even without synchronisation. That's why immutable objects are thread-safe for free.`},
{hl:{main:[13,14,15]}, th:[['inner','RUN:ok','holds Outer.this'],['nested','RUN:ok','independent']], g:[G('Outer@1',['big','10 MB array']), G('Inner@2',['this$0','→ Outer@1 (hidden)','bad']), G('Nested@3',['outer ref','none','ok'])],
 say:`A non-static <b>inner class</b> stores a hidden reference to its enclosing instance (<code>this$0</code>). If you hand an Inner to a long-lived cache or listener, it keeps the whole 10 MB Outer alive: a memory leak. Anonymous classes and lambdas that use <code>this</code> do the same. Default to <b>static nested</b> classes.`}
],
keep:[`static = one per class; static methods have no this and are hidden, not overridden.`,`final ref ≠ immutable object; final fields are safely published after construction.`,`Inner classes hold Outer.this → prefer static nested classes.`]}, {
  imp: 'must',
  theory: TH(`static means "belongs to the class, not to an object", final means "can't be reassigned", and a class can be nested inside another, statically or not.`,
`<p><b>static</b>: a static field has one copy shared by the whole class, instead of one per object, like a counter on the classroom wall rather than in each student's notebook. Static methods don't have a <code>this</code>, so they can't touch instance fields.</p>
<p><b>final</b>: a final variable can be assigned only once. A final method can't be overridden; a final class can't be extended. Careful: a final <i>reference</i> to a list can't point to another list, but the list itself can still change.</p>
<p><b>Nested classes</b>: a <code>static</code> nested class is just a class placed inside another for organisation. A non-static <b>inner</b> class secretly holds a reference to the outer object that created it.</p>`,
[[`static field`,`One value shared by all instances.`],[`static method`,`Called on the class; no this; can't be overridden (only hidden).`],[`final`,`Assign-once variable, non-overridable method, or non-extendable class.`],[`Inner class`,`Non-static nested class; each instance holds Outer.this.`],[`Static nested class`,`A nested class without a hidden outer reference.`]],
[`Static fields are created and initialised when the class is initialised.`,`Calling a static method through a variable is resolved by the variable's declared type.`,`final instance fields get special memory-model guarantees: once constructed, other threads see their values.`,`Creating an inner class instance stores a reference to the outer instance inside it.`],
[`Use static for constants (<code>static final</code>) and pure utility methods.`,`Prefer static nested classes for builders, nodes, DTOs.`,`Make fields final by default; it documents intent and helps thread safety.`],
[`Mutable static state shared by all requests in a web app.`,`Inner classes (or anonymous classes) captured by long-lived listeners, leaking the outer object.`]),
  quiz: [
    [`<code>final List&lt;String&gt; names = new ArrayList&lt;&gt;();</code> Which is true?`,[`names.add("x") won't compile, because the list is final`,`names can't point to another list, but the list's contents can change`,`The list becomes immutable, so add throws UnsupportedOperationException`,`final makes the list safe to share between threads`],1,`final applies to the reference, not to the object it points to.`,'E'],
    [`A <code>static</code> method <code>describe()</code> exists in both Parent and Child. <code>Parent p = new Child(); p.describe();</code> runs which?`,[`Child's, by dynamic dispatch on the object`,`Child's, but only if it's annotated @Override`,`Compile error: a static method can't be redeclared in a subclass`,`Parent's, because static methods are bound to the declared type`],3,`Static methods are hidden, not overridden. (@Override on a static method doesn't even compile.)`,'M'],
    [`What does the Java Memory Model guarantee about <code>final</code> instance fields?`,[`After the constructor finishes (without leaking this), other threads see their values with no synchronization`,`They behave like volatile fields, so every read goes straight to main memory`,`They are stored once in Metaspace and shared by every instance of the class`,`Reflection can never change them, so the JIT may cache them in registers forever`],0,`Final-field semantics give safe publication of immutable objects, as long as this doesn't escape during construction.`,'H'],
    [`Can a static method use instance fields directly?`,[`Yes, any static method can read them`,`No: there's no this in a static method`,`Only if the fields are declared public`,`Only inside records, not classes`],1,`It needs an object reference to reach them.`,'E'],
    [`What does a <code>final</code> method mean?`,[`It can't be called`,`It can't be overridden`,`It runs once`,`It's static`],1,`final class = can't be extended.`,'E'],
    [`How many copies of a static field exist with 100 objects?`,[`100`,`1`,`0`,`Depends on the GC`],1,`Static belongs to the class.`,'E'],
    [`<code>final int[] a = {1}; a[0] = 2;</code> Allowed?`,[`No: the array is final, so it can't change`,`Yes: only the reference a is final`,`Only inside a static initialiser block`,`It compiles but fails at run time`],1,`final is about the reference.`,'M'],
    [`When must a <code>final</code> instance field be assigned?`,[`Any time before the field is first read`,`Exactly once, by the end of every constructor`,`Before main starts, in a static block`,`Never: final fields keep their defaults`],1,`Otherwise compile error.`,'M'],
  ],
  quizAdv: [
    [`Why prefer a <code>static</code> nested class over an inner class for a Node or Builder?`,[`Static nested classes are faster to load`,`Inner classes can't declare fields`,`Inner instances hold Outer.this and can leak it`,`Only static nested classes can be serialised`],2,`If the inner object outlives the outer one (cache, listener, thread), it keeps the outer alive.`,'M'],
    [`<code>static final List&lt;String&gt; NAMES = new ArrayList&lt;&gt;();</code> Is NAMES a constant?`,[`No: the reference is fixed, but the list is mutable`,`Yes: it's inlined at call sites like an int`,`Yes: final makes the list read-only`,`It doesn't compile without List.of`],0,`Only primitives and Strings with constant initialisers are compile-time constants.`,'M'],
    [`Why should inner classes in long-lived callbacks be avoided?`,[`Inner classes are slower to instantiate`,`They hold Outer.this and leak it`,`They can't read the outer class's fields`,`They're deprecated in recent Java versions`],1,`Use static nested classes or lambdas that don't capture this.`,'M'],
    [`Can you override a static method?`,[`Yes, exactly like instance methods`,`No: a subclass's static method only hides it`,`Only when the static method is final`,`Only for static methods in interfaces`],1,`No dynamic dispatch for statics.`,'H'],
  ],
});
