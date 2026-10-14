/* 3.1 The four pillars and dynamic dispatch */
topic('3', { no:'3.1', title:'The four pillars and dynamic dispatch', idea:`One call, <code>v.describe()</code>, gives different behaviour per object. Follow the virtual method table lookup that makes polymorphism work.`,
actors:'Call', stateTitle:'Virtual method tables (vtables)',
codes:{a:`abstract class Vehicle {
  abstract int wheels();
  String describe() { return name() + ": " + wheels() + " wheels"; }
  String name() { return "vehicle"; }
}
class Car extends Vehicle {
  int wheels() { return 4; }
  String name() { return "car"; }
}
class Bike extends Vehicle { int wheels() { return 2; } }

for (Vehicle v : List.of(new Car(), new Bike()))
  System.out.println(v.describe());`,
b:`class Account {
  private long balance;                       // ENCAPSULATION: hidden state
  void withdraw(long amt) {
    if (amt <= 0 || amt > balance)            // the rule lives here, once
      throw new IllegalStateException("insufficient");
    balance -= amt;
  }
}
// acc.balance = -100;   ✘ won't compile

interface PaymentGateway { Receipt charge(long paise); }  // ABSTRACTION
// CheckoutService knows WHAT (charge), not HOW (Razorpay / PayU)`},
steps:[
{cv:'a', hl:{loop:[12,13]}, th:[['loop','v = Car@1:info','static type Vehicle, runtime type Car']], g:[G('Vehicle vtable',['wheels','abstract'],['describe','Vehicle.describe'],['name','Vehicle.name']), G('Car vtable',['wheels','Car.wheels','hot'],['describe','Vehicle.describe (inherited)'],['name','Car.name','hot']), G('Bike vtable',['wheels','Bike.wheels'],['describe','Vehicle.describe'],['name','Vehicle.name (inherited)'])],
 say:`The compiler only knows <code>v</code> is a <b>Vehicle</b>, which is enough to check that <code>describe()</code> exists. Each class has a <b>vtable</b>: one slot per overridable method, pointing to the implementation for that class. Subclasses copy the parent's table and overwrite the slots they override.`},
{hl:{loop:[13],Vehicle:[3]}, th:[['loop','invokevirtual describe:ok','Car@1 → class Car → slot "describe"']], g:[G('Car vtable',['wheels','Car.wheels'],['describe','Vehicle.describe','hot'],['name','Car.name'])],
 say:`<code>invokevirtual</code>: read the <b>object's</b> class pointer (from its header) → Car's vtable → slot "describe" → <code>Vehicle.describe</code> (Car didn't override it). The <b>object</b> decides at run time, not the variable's declared type. That's <b>dynamic dispatch</b>.`},
{hl:{Vehicle:[3],Car:[7,8]}, th:[['loop','this.name(), this.wheels():ok','dispatch again on this = Car@1']], log:['car: 4 wheels'],
 say:`Inside <code>describe</code>, the calls <code>name()</code> and <code>wheels()</code> are virtual calls on <code>this</code>, which is still Car@1. So they resolve to Car.name → "car" and Car.wheels → 4. Inherited code calls the subclass's overrides. That's the basis of the Template Method pattern (3.7j).`},
{hl:{loop:[12,13],Bike:[10],Vehicle:[3,4]}, th:[['loop','v = Bike@2:info','same call site']], g:[G('Bike vtable',['wheels','Bike.wheels','hot'],['describe','Vehicle.describe','hot'],['name','Vehicle.name','hot'])], log:['vehicle: 2 wheels'],
 say:`Same line of code, different object: Bike didn't override <code>name()</code>, so the inherited Vehicle.name runs, but wheels is Bike's. JIT note: if a call site only ever sees one class, C2 <b>inlines</b> it (monomorphic); two classes get an inline type check (bimorphic); more than that uses the full vtable lookup (megamorphic).`},
{cv:'b', hl:{acc:[1,2,3,4,5,6,7]}, th:[['acc','withdraw(900):bad','balance 500']], g:[G('Encapsulation',['state','private, only changed through methods'],['invariant','balance never negative','ok'],['benefit','one place to enforce rules / add audit / lock'])], log:['✘ IllegalStateException: insufficient'],
 say:`<b>Encapsulation</b>: hide the data and expose behaviour, so <b>no caller can put the object into an invalid state</b>. Getters and setters for every field are <i>not</i> encapsulation, just public fields with extra steps. Prefer intention-revealing methods (<code>withdraw</code>, not <code>setBalance</code>).`},
{hl:{acc:[11,12]}, th:[], g:[G('Four pillars',['Encapsulation','protect state + invariants (mechanism: private)'],['Abstraction','expose WHAT, hide HOW (interfaces)'],['Inheritance','reuse + is-a (extends)'],['Polymorphism','one call, many behaviours (overriding = runtime, overloading = compile time)']), G('Encapsulation vs abstraction',['encapsulation','about hiding DATA / implementation details'],['abstraction','about designing the right INTERFACE'])],
 say:`<b>Abstraction</b>: callers depend on <code>PaymentGateway.charge</code>, not on Razorpay's details, so you can swap or mock the implementation. Interviewers like the distinction: encapsulation is a <i>mechanism</i> that protects internals, abstraction is a <i>design choice</i> about what to expose.`}
],
keep:[`Dynamic dispatch: the object's class (vtable) picks the override at run time.`,`Inherited methods call the subclass's overrides through this.`,`Encapsulation = protect invariants; abstraction = depend on the "what".`]}, {
  imp: 'must',
  theory: TH(`Object-oriented programming bundles data with the code that uses it; the four pillars are encapsulation, abstraction, inheritance and polymorphism.`,
`<p>Instead of passing raw data to separate functions, OOP builds <b>objects</b> that hold their own data (fields) and know how to work with it (methods). An <code>Account</code> knows its balance and how to withdraw safely.</p>
<ul><li><b>Encapsulation</b>: hide the data and expose only safe operations, so nobody can set a negative balance directly.</li><li><b>Abstraction</b>: callers depend on <i>what</i> something does (an interface), not <i>how</i>.</li><li><b>Inheritance</b>: a class can extend another and reuse or specialise its behaviour.</li><li><b>Polymorphism</b>: one call, <code>v.describe()</code>, does the right thing for whatever object v really is.</li></ul>
<p>The mechanism behind polymorphism is <b>dynamic dispatch</b>: at run time the JVM looks at the object's actual class to choose which method to run.</p>`,
[[`Class / object`,`Blueprint / one instance built from it.`],[`Interface`,`A contract: a list of methods a class promises to provide.`],[`Override`,`A subclass providing its own version of an inherited method.`],[`Dynamic dispatch`,`Choosing the method at run time from the object's real class (via a vtable).`]],
[`<code>Vehicle v = new Car();</code>: the variable's type is Vehicle, the object is a Car.`,`<code>v.describe()</code> compiles because Vehicle declares describe().`,`At run time the JVM looks up describe() in Car's method table and runs Car's version.`,`Calls from inside Vehicle to overridable methods (this.wheels()) also go to Car's versions.`],
[`Program to interfaces (<code>PaymentGateway</code>), so implementations can be swapped and mocked.`,`Keep fields private; expose behaviour, not setters for everything.`],
[`Getter and setter for every field ("anaemic" objects with no behaviour).`,`Deep inheritance trees where behaviour is hard to follow.`]),
  quiz: [
    [`<code>Vehicle v = new Car(); v.describe();</code> Car overrides describe(). Which runs?`,[`Car's, chosen at run time from the object's class`,`Vehicle's, chosen at compile time from the declared type`,`Car's, chosen at compile time because new Car() is visible`,`Vehicle's, unless describe() is abstract`],0,`Overridden instance methods are dispatched on the runtime class, typically through a vtable.`,'E'],
    [`Vehicle.describe() calls <code>this.wheels()</code>, which Car overrides. Calling describe() on a Car uses which wheels()?`,[`Vehicle's, because the call is written inside Vehicle`,`Vehicle's, unless wheels() is protected`,`Car's, because this is a Car`,`It depends on whether describe() is final`],2,`Self-calls are dispatched dynamically too. That's what makes template methods work, and what makes fragile base classes fragile.`,'M'],
    [`<pre>class A { String n = "A"; String n() { return n; } }
class B extends A { String n = "B"; String n() { return n; } }
A a = new B();
System.out.println(a.n + a.n());</pre>`,[`BB`,`AB`,`AA`,`BA`],1,`Fields aren't polymorphic: a.n uses the declared type A. Methods are, so a.n() runs B's and returns B's field.`,'H'],
    [`Which pillar lets one variable of type Shape hold a Circle or a Square and call <code>area()</code> on either?`,[`Encapsulation`,`Polymorphism`,`Abstraction only`,`Composition`],1,`One interface, many behaviours.`,'E'],
    [`What is abstraction?`,[`Hiding fields behind private modifiers`,`Showing what it does, hiding how`,`Copying objects between layers`,`Using abstract classes only`],1,`Interfaces are the main tool.`,'E'],
    [`Which call is resolved by dynamic dispatch?`,[`A static method called via an instance`,`A private method called through this`,`An overridden instance method call`,`A super.method() call in a subclass`],2,`Static, private and final methods are bound statically.`,'M'],
    [`What is a vtable?`,[`A table of the JVM's threads`,`Per-class table of method entries`,`A table in the database schema`,`A GC bookkeeping structure`],1,`Overrides replace their parent's entries.`,'M'],
    [`Why is "a setter for every field" weak encapsulation?`,[`Setters are slow compared with fields`,`Callers can set any state, bypassing the rules`,`Setters can't be overridden later`,`It isn't weak; it's the right approach`],1,`Prefer meaningful methods like withdraw(amount).`,'M'],
  ],
  quizAdv: [
    [`Which best describes encapsulation?`,[`A getter and a setter for every field`,`Sharing code through inheritance`,`Making every class final by default`,`Only the class itself can change its state`],3,`Setters for everything leak control; encapsulation protects invariants.`,'M'],
    [`Parent has a <code>private void log()</code>; Child declares its own <code>log()</code>. Parent.run() calls log() on a Child. Which runs?`,[`Child's, by dynamic dispatch`,`Both of them, parent first`,`Parent's: private isn't overridden`,`It doesn't compile`],2,`Private methods are bound statically.`,'H'],
    [`Can the JIT avoid the virtual-call overhead?`,[`Never: virtual calls always cost a lookup`,`Yes: it inlines when a call site sees one class`,`Only for static methods`,`Only when classes are final`],1,`Monomorphic / bimorphic inline caches.`,'H'],
    [`Calling an overridable method from Parent's constructor on a Child: which version runs?`,[`Parent's version, since Parent is being built`,`Child's, before Child's fields are initialised`,`Neither: overridable calls are skipped`,`Compile error: not allowed in constructors`],1,`Dispatch already uses the runtime class.`,'H'],
  ],
});
