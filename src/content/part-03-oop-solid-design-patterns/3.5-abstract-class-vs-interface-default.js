/* 3.5 Abstract class vs interface, default-method conflicts */
topic('3', { no:'3.5', title:'Abstract class vs interface, default-method conflicts', idea:`When to use which, and the three rules Java uses when two default methods collide.`,
actors:'Compiler', stateTitle:'Resolution',
codes:{a:`interface Flyer   { default String hello() { return "flyer"; } }
interface Swimmer { default String hello() { return "swimmer"; } }
class Duck implements Flyer, Swimmer {
  public String hello() {                     // MUST override: conflict
    return Flyer.super.hello() + "+" + Swimmer.super.hello();
  }
}
abstract class Animal { public String hello() { return "animal"; } }
class Dog extends Animal implements Flyer {}  // rule 1: class wins
interface A { default String hi() { return "A"; } }
interface B extends A { default String hi() { return "B"; } }
class C implements A, B {}                    // rule 2: B is more specific`},
steps:[
{hl:{javac:[1,2,3]}, th:[['javac','conflict:bad','Duck inherits two hello() defaults']], g:[G('Duck without an override',['Flyer.hello','"flyer"'],['Swimmer.hello','"swimmer"'],['result','compile error: inherits unrelated defaults','bad'])],
 say:`Java 8 default methods put behaviour in interfaces, which reopens the diamond problem. When two <b>unrelated</b> interfaces provide the same default, the class <b>must override</b> it. Java refuses to guess.`},
{hl:{javac:[4,5]}, th:[['javac','resolved:ok','explicit choice']], log:['flyer+swimmer'],
 say:`Inside the override you can call either parent's version with <code>X.super.method()</code>, here both of them.`},
{hl:{javac:[8,9]}, th:[['javac','rule 1:ok','class method beats interface default']], log:['Dog.hello() → "animal"'],
 say:`<b>Rule 1, classes win:</b> a method from the superclass chain (even an inherited one) beats any interface default. That's how adding a default to an interface can't silently change the behaviour of existing classes that already have the method.`},
{hl:{javac:[10,11,12]}, th:[['javac','rule 2:ok','sub-interface beats super-interface']], log:['C.hi() → "B"'],
 say:`<b>Rule 2, most specific interface wins:</b> B extends A and overrides <code>hi</code>, so B's version is more specific. <b>Rule 3:</b> otherwise it's ambiguous and you must override (the Duck case).`},
{th:[], g:[G('Interface = a capability',['many per class','✔'],['state','constants only'],['constructors','✘'],['methods','abstract, default, static, private (9+)'],['examples','Comparable, Runnable, PaymentGateway']), G('Abstract class = a partial base',['one per class','single inheritance'],['state','fields ✔'],['constructors','✔ (for subclasses)'],['methods','any access level, shared code + abstract steps'],['examples','AbstractList, a Template Method base'])],
 say:`<b>Choose an interface</b> to define a role many unrelated classes can play, and as the type in your APIs. <b>Choose an abstract class</b> when subclasses share real state or code and you want to control the skeleton (Template Method). Common combo: an interface for the contract plus an <code>AbstractX</code> skeleton implementation (like <code>List</code> + <code>AbstractList</code>).`}
],
keep:[`Two unrelated defaults → must override; call X.super.m().`,`Class beats interface; more specific interface beats its parent.`,`Interface = capability/contract; abstract class = shared state + skeleton.`]}, {
  imp: 'must',
  theory: TH(`An interface describes what a type can do; an abstract class is a partial implementation that can hold shared state. Since Java 8 interfaces can have default methods, which brings rules for conflicts.`,
`<p>An <b>interface</b> is a contract: "anything that is <code>Comparable</code> has compareTo". A class can implement many interfaces. Interfaces can't hold instance fields.</p>
<p>An <b>abstract class</b> can't be instantiated; it provides shared fields and some implemented methods, leaving others abstract for subclasses. A class can extend only one.</p>
<p><b>Default methods</b> let interfaces ship method bodies. If two interfaces give a class the same default method, Java needs rules to resolve the conflict.</p>`,
[[`Abstract method`,`Declared without a body; subclasses must implement it.`],[`Default method`,`An interface method with a body.`],[`X.super.m()`,`Syntax to call a specific interface's default implementation.`]],
[`Rule 1: a method from a class (or superclass) beats any interface default.`,`Rule 2: a more specific interface (one that extends the other) wins.`,`Rule 3: otherwise the class must override the method and may call <code>A.super.m()</code>.`],
[`Prefer interfaces for public contracts; use abstract classes for shared skeletons inside a module.`,`Default methods are mainly for evolving interfaces without breaking implementations.`],
[`Putting mutable shared state in constants on interfaces.`,`Using abstract classes where an interface plus composition would do.`]),
  quiz: [
    [`When is an abstract class a better fit than an interface?`,[`When the type needs multiple parents`,`When subclasses share instance state and a skeleton with protected helpers`,`When you need static methods, since interfaces can't have them`,`When you want to implement it with a lambda`],1,`Interfaces can't hold instance state. (They can have static and private methods since Java 8/9.)`,'E'],
    [`Class C implements interfaces A and B, and both declare <code>default void hello()</code>. What must C do?`,[`Nothing: the first interface listed wins`,`Nothing: A wins because it was compiled first`,`C must be declared abstract`,`Override hello(); it may call A.super.hello()`],3,`Two unrelated defaults conflict and must be resolved explicitly.`,'M'],
    [`<code>interface I { default void m(){} }</code>, <code>interface J extends I { default void m(){} }</code>, <code>class C implements I, J</code>. Which m() does C get?`,[`J's: the more specific interface wins`,`I's: it's listed first`,`Compile error: C must override m()`,`AbstractMethodError at run time`],0,`Rules: classes win; then the most specific interface wins; otherwise you must override.`,'H'],
    [`Can an interface have instance fields?`,[`Yes, like any class`,`No: only public static final constants`,`Only private instance fields`,`Only from Java 21`],1,`State belongs in classes.`,'E'],
    [`How many abstract classes can a class extend?`,[`One`,`Two`,`Any number`,`None`],0,`But it can implement many interfaces.`,'E'],
    [`Can interfaces have static methods?`,[`No`,`Yes, since Java 8`,`Only private`,`Only in records`],1,`e.g. List.of, Comparator.comparing.`,'E'],
    [`Can an abstract class have a constructor?`,[`No, they can't be instantiated`,`Yes: subclasses call it via super(...)`,`Only private constructors`,`Only static constructors`],1,`It initialises shared state.`,'M'],
    [`Private methods in interfaces (Java 9+) are for?`,[`Nothing: they can't be called`,`Sharing code between default methods`,`Making default methods final`,`Making the interface thread-safe`],1,`Not visible to implementers.`,'M'],
  ],
  quizAdv: [
    [`Superclass P has a concrete <code>hello()</code>; interface I has a default <code>hello()</code>. <code>class C extends P implements I</code> uses?`,[`I's default, the newer one`,`P's: classes beat defaults`,`Compile error: conflict`,`Whichever loaded first`],1,`Rule 1: classes win.`,'M'],
    [`Can an interface declare <code>default boolean equals(Object o)</code>?`,[`Yes, and it overrides Object's`,`Yes, but it's ignored`,`No: compile error`,`Only for toString`],2,`A default method can't override a public Object method.`,'H'],
    [`Why were default methods added in Java 8?`,[`To allow multiple inheritance of state`,`To evolve interfaces without breaking code`,`To make interface calls faster`,`To support records`],1,`Interface evolution.`,'M'],
    [`A sealed interface vs an abstract class for a closed set of types?`,[`They're the same thing`,`Sealed limits implementers; enables exhaustive switch`,`Abstract classes give exhaustive switches`,`Sealed interfaces can't have methods`],1,`Sealed + records model sum types.`,'H'],
  ],
});
