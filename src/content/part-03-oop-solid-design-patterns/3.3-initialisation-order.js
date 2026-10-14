/* 3.3 Initialisation order */
topic('3', { no:'3.3', title:'Initialisation order', idea:`Trace <code>new Child()</code> twice: static blocks once, then parent fields, parent constructor, child fields, child constructor. Then the trap of calling an overridable method from a constructor.`,
actors:'Object', stateTitle:'Child object fields',
codes:{a:`class Parent {
  static { print("1 P-static"); }
  int a = log("3 P-field");
  { print("4 P-instance-block"); }
  Parent() { print("5 P-ctor"); hook(); }     // ✘ calls an overridable
  void hook() {}
}
class Child extends Parent {
  static { print("2 C-static"); }
  String name = "child";
  Child() { super(); print("7 C-ctor name=" + name); }
  @Override void hook() { print("6 hook sees name=" + name); }
}
new Child();
new Child();`},
steps:[
{hl:{JVM:[14,2]}, th:[['JVM','init Parent class:info','first use of Child → Parent first']], g:[G('class init',['Parent','initialising','hot'],['Child','waiting (superclass first)'])], log:['1 P-static'],
 say:`<code>new Child()</code> is the first use of Child, which triggers class initialisation (1.2). A class's <b>superclass is initialised first</b>, so Parent's static block runs.`},
{hl:{JVM:[9]}, g:[G('class init',['Parent','done','ok'],['Child','done','ok'])], log:['2 C-static'],
 say:`Then Child's static block. Static init runs <b>once per class</b>, never again in this JVM (per class loader).`},
{hl:{JVM:[14,11]}, th:[['obj','allocated:info','all fields = default']], g:[G('Child object fields',['a (Parent)','0','hot'],['name (Child)','null','hot'])],
 say:`Memory for the whole object, Parent's and Child's fields, is allocated at once and <b>zeroed</b>: <code>a = 0</code>, <code>name = null</code>. Then <code>Child()</code> runs, and its first act is <code>super()</code> (implicit if you don't write it).`},
{hl:{obj:[3,4]}, g:[G('Child object fields',['a (Parent)','3 (from log)','hot'],['name (Child)','null'])], log:['3 P-field','4 P-instance-block'],
 say:`Inside Parent's constructor, after its own <code>super()</code> (Object), Parent's <b>field initialisers and instance blocks</b> run in textual order. javac actually copies them into the start of every constructor.`},
{hl:{obj:[5]}, log:['5 P-ctor'],
 say:`Then the rest of Parent's constructor body runs.`},
{hl:{obj:[5,12]}, th:[['obj','hook() → Child.hook:bad','dynamic dispatch, even here']], g:[G('Child object fields',['a (Parent)','3'],['name (Child)','null (not set yet!)','bad'])], log:['6 hook sees name=null'],
 say:`<b>The trap:</b> <code>hook()</code> is virtual, so it dispatches to <b>Child.hook</b> even from Parent's constructor. But Child's fields haven't been initialised yet, so <code>name</code> is <b>null</b>. If the override did <code>name.length()</code>, you'd get an NPE. Rule: <b>never call overridable methods from a constructor</b>; make them <code>private</code> or <code>final</code>.`},
{hl:{obj:[10,11]}, g:[G('Child object fields',['a (Parent)','3'],['name (Child)','"child"','ok'])], log:['7 C-ctor name=child'],
 say:`Back in Child(): now Child's field initialisers run (<code>name = "child"</code>), then the rest of the Child constructor body.`},
{hl:{JVM:[15]}, th:[['obj2','second object:info','no static blocks']], g:[G('class init',['Parent / Child','already initialised','dim'])], log:['3 P-field','4 P-instance-block','5 P-ctor','6 hook sees name=null','7 C-ctor name=child'],
 say:`The second <code>new Child()</code> skips the static blocks and repeats only the instance part. Full order: <b>parent static → child static</b> (once), then per object: <b>parent fields/blocks → parent ctor → child fields/blocks → child ctor</b>. The same reasoning explains why a <code>this</code> reference leaked from a constructor (registering a listener) can expose a half-built object to other threads.`}
],
keep:[`Statics once: parent then child. Per object: parent fields → parent ctor → child fields → child ctor.`,`Fields start at defaults (0/null) before any initialiser.`,`Never call overridable methods (or leak this) from a constructor.`]}, {
  imp: 'good',
  theory: TH(`Creating an object runs code in a fixed order: static setup once per class, then for each object the parent's fields and constructor before the child's.`,
`<p>When you write <code>new Child()</code>, a lot happens. First, if the classes haven't been initialised yet, their <b>static</b> initialisers run, parent first, then child, exactly once. Then the object's memory is allocated with every field zeroed (0, false, null). Then construction runs from the top of the hierarchy down: parent field initialisers, parent constructor body, child field initialisers, child constructor body.</p>
<p>A child is built like a house: foundation (parent) first, then the upper floors (child).</p>`,
[[`Static initialiser`,`static { … } and static field initialisers; run once per class.`],[`Instance initialiser`,`Field initialisers and { … } blocks; run for every object, after super().`],[`super(...)`,`Call to the parent constructor; always first, implicit if omitted.`]],
[`Load and initialise Parent's statics, then Child's statics (first use only).`,`Allocate the object; all fields have default values.`,`Child's constructor calls super(); Parent's field initialisers and constructor body run.`,`Back in Child: its field initialisers run, then the rest of its constructor body.`],
[`Keep constructors simple: assign fields, validate, nothing more.`,`Use static factories or builders when construction logic grows.`],
[`Calling an overridable method from a constructor: it runs in the child before the child's fields are set.`,`Letting <code>this</code> escape from a constructor (registering a listener, starting a thread).`]),
  quiz: [
    [`<code>new Child()</code> for the first time. Which runs first?`,[`Child's static block`,`Parent's constructor`,`Parent's static block`,`Child's field initialisers`],2,`Static init: parent then child (once). Then per object: parent fields, parent constructor, child fields, child constructor.`,'E'],
    [`Parent's constructor calls overridable <code>init()</code>. Child overrides it to print its field <code>String name = "x"</code>. What prints?`,[`x`,`null: the child's field initialiser hasn't run yet`,`Compile error: constructors can't call overridable methods`,`Parent's init() runs instead, because the object isn't a Child yet`],1,`The object is already a Child, so the override runs, but before the child's fields are initialised. Don't call overridable methods from constructors.`,'M'],
    [`<pre>class C {
  static { System.out.print("S "); }
  static final int K = 5;
}
System.out.println(C.K);</pre>What prints?`,[`S 5`,`5 S`,`S`,`5`],3,`C.K is a compile-time constant inlined at the call site, so C isn't initialised and its static block never runs.`,'H'],
    [`How many times does a static initialiser run?`,[`Once per object created`,`Once per class (per class loader)`,`Every time a method is called`,`Never, unless called explicitly`],1,`On class initialisation.`,'E'],
    [`What is the first statement of every constructor (explicit or implicit)?`,[`return`,`super(...) or this(...)`,`static`,`new`],1,`The compiler inserts super() if missing.`,'E'],
    [`Parent field initialisers run before or after Child's?`,[`After`,`Before`,`At the same time`,`Only if static`],1,`Parent part is built first.`,'E'],
    [`The parent has only <code>Parent(String name)</code>. Child has no explicit super call. Result?`,[`It works: Java adds super() with null`,`Compile error: no default constructor in Parent`,`Runtime error when Child is created`,`It compiles; name is simply null`],1,`Child must call super(name).`,'M'],
    [`Where do instance initialiser blocks <code>{ … }</code> run?`,[`Before super(), at the very start`,`After super(), with field initialisers`,`After the constructor body finishes`,`Only once per class`],1,`They're copied into each constructor.`,'M'],
  ],
  quizAdv: [
    [`What value does an int field hold before its initialiser runs?`,[`Undefined memory contents`,`-1`,`0`,`It can't be read yet`],2,`Memory is zeroed (0, false, null) on allocation.`,'M'],
    [`When do instance initializer blocks run?`,[`After super() returns, in order with fields`,`Before the superclass constructor runs`,`After the constructor body finishes`,`Once per class, like static blocks`],0,`They're copied into each constructor right after the super() call.`,'H'],
    [`Java 25 flexible constructor bodies allow what before <code>super(...)</code>?`,[`Any statements, including calls on this`,`Statements not touching this (e.g. checks)`,`Only calls to static helper methods`,`Only local variable declarations`],1,`JEP 513.`,'H'],
    [`Static fields of Child depend on Parent's static fields. Order guaranteed?`,[`No: the JVM may initialise them in any order`,`Yes: initialising Child first initialises Parent`,`Only if both share the same class loader`,`Only for static final compile-time constants`],1,`Superclass initialisation precedes subclass.`,'M'],
  ],
});
