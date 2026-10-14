/* 3.2 Overloading vs overriding */
topic('3', { no:'3.2', title:'Overloading vs overriding', idea:`The compiler picks an overload from <b>static</b> types in three phases. The JVM picks an override from the <b>runtime</b> object. Static methods are hidden, not overridden.`,
actors:'Who decides', stateTitle:'Resolution',
codes:{a:`class Printer {
  void print(long x)    { System.out.println("long"); }
  void print(Integer x) { System.out.println("Integer"); }
  void print(Object x)  { System.out.println("Object"); }
  void print(int... xs) { System.out.println("varargs"); }
}
p.print(5);          // int argument: which one?
// delete print(long)    -> ?
// delete print(Integer) -> ?
// delete print(Object)  -> ?`,
b:`void greet(Vehicle v) { System.out.println("vehicle"); }
void greet(Car c)     { System.out.println("car"); }
Vehicle v = new Car();
greet(v);            // "vehicle": overloads use the STATIC type`,
c:`class Vehicle {
  String name() { return "vehicle"; }
  static String kind() { return "V"; }
}
class Car extends Vehicle {
  @Override String name() { return "car"; }
  static String kind() { return "C"; }      // HIDES, doesn't override
}
Vehicle v = new Car();
v.name();            // "car": runtime object decides
v.kind();            // "V": compile-time type decides
Vehicle b = new Vehicle();
Car x = (Car) b;                       // ✘ ClassCastException
if (b instanceof Car car) car.name();  // ✔ pattern: check + cast`},
steps:[
{cv:'a', hl:{javac:[7]}, th:[['javac','phase 1:info','no boxing, no varargs']], g:[G('Phase 1: exact + widening only',['print(long)','int → long widening ✔','ok'],['print(Integer)','needs boxing ✘'],['print(Object)','needs boxing ✘'],['print(int...)','needs varargs ✘'])], log:['long'],
 say:`Overload resolution happens <b>at compile time</b> in 3 phases, and stops at the first phase that finds a match. <b>Phase 1</b> allows only identity and primitive <b>widening</b>. int → long qualifies, so <b>"long"</b> wins even though <code>Integer</code> looks like the "closer" type. (Interviewers love this one.)`},
{hl:{javac:[8]}, th:[['javac','phase 2:info','boxing allowed']], g:[G('Phase 2: + boxing / unboxing',['print(Integer)','box int → Integer ✔ (most specific)','ok'],['print(Object)','box then widen ✔ (less specific)'])], log:['Integer'],
 say:`Remove <code>print(long)</code>: phase 1 finds nothing, so <b>phase 2</b> allows boxing. Both Integer and Object are applicable; the <b>most specific</b> one wins → <b>Integer</b>.`},
{hl:{javac:[9,10]}, th:[['javac','phase 2 → 3:info','']], g:[G('Then',['without Integer','Object (box → widen)'],['without Object too','phase 3: varargs → "varargs"'])], log:['Object','varargs'],
 say:`Remove Integer → <b>Object</b>. Remove that too → only <b>phase 3</b> (varargs) matches. Varargs is always the last resort. Practical rule: avoid overloads that differ only in boxed vs primitive or varargs. <code>List.remove(int)</code> vs <code>remove(Object)</code> is the famous accident (1.7).`},
{cv:'b', hl:{javac:[1,2,3,4]}, th:[['javac','static type = Vehicle:warn','picks greet(Vehicle)']], log:['vehicle'],
 say:`<b>Overloads ignore the runtime type of arguments.</b> <code>v</code> holds a Car, but its declared type is Vehicle, so javac binds <code>greet(Vehicle)</code>. Java is <b>single dispatch</b>: only the receiver is dynamic. To dispatch on argument types too, use the <b>Visitor</b> pattern (double dispatch), or a sealed type + pattern switch (2.14).`},
{cv:'c', hl:{JVM:[9,10]}, th:[['JVM','invokevirtual:ok','object is Car']], log:['car'],
 say:`<b>Overriding</b> = same signature in a subclass, resolved by the <b>runtime object</b> (3.1). <code>@Override</code> makes the compiler confirm you really override something, which catches typos like <code>equals(Car o)</code> (an overload, not an override).`},
{hl:{javac:[11]}, th:[['javac','invokestatic:warn','static type Vehicle']], log:['V'],
 say:`<b>Static methods don't take part in dispatch.</b> <code>v.kind()</code> compiles to <code>Vehicle.kind()</code> from the declared type, giving "V". Car's <code>kind()</code> merely <b>hides</b> the parent's. Calling statics through an instance is legal but misleading; always write <code>Car.kind()</code>.`},
{hl:{JVM:[12,13,14]}, th:[['JVM','checkcast:bad','Vehicle is not a Car']], log:['✘ ClassCastException: Vehicle cannot be cast to Car'],
 g:[G('Override rules',['signature','same name + parameter types'],['return type','same or a subtype (covariant)'],['access','same or WIDER'],['checked exceptions','none new or broader'],['static / private / final','can\'t be overridden']), G('Casting',['upcast Car → Vehicle','implicit, always safe','ok'],['downcast Vehicle → Car','explicit; checked at run time','bad'],['instanceof pattern','test + bind in one step','ok'])],
 say:`An upcast always succeeds. A downcast is checked <b>at run time</b> and throws ClassCastException if the object isn't really that type. Use <code>if (b instanceof Car car)</code> (Java 16), or better, design so you don't need downcasts (polymorphism or sealed types).`}
],
keep:[`Overloading: compile time, static types, phases: widening → boxing → varargs.`,`Overriding: run time, the object decides. Statics are hidden by declared type.`,`Override rules: covariant return, wider access, no broader checked exceptions.`]}, {
  imp: 'must',
  theory: TH(`Overloading is several methods with the same name but different parameters, picked by the compiler; overriding is a subclass replacing a parent's method, picked at run time.`,
`<p><b>Overloading</b> is a convenience: <code>print(int)</code>, <code>print(String)</code>, <code>print(Object)</code>. The <b>compiler</b> chooses one based on the <i>declared</i> types of the arguments. It never looks at the actual objects at run time.</p>
<p><b>Overriding</b> is polymorphism: <code>Car</code> redefines <code>Vehicle.describe()</code>. The <b>JVM</b> chooses at run time based on the actual object.</p>`,
[[`Signature`,`Method name plus parameter types.`],[`Overload resolution`,`Compiler tries exact/widening matches, then boxing, then varargs.`],[`Covariant return`,`An override may return a subtype of the original return type.`],[`Hiding`,`Static methods with the same signature in a subclass hide, not override.`]],
[`Compile time: collect methods with that name, pick the most specific match for the static argument types.`,`Run time: for an instance method, find the override in the object's class.`,`Static methods and private methods never use run-time dispatch.`],
[`Add <code>@Override</code> on every override: the compiler then catches typos that would silently create an overload.`,`Avoid overloads that differ only by boxed vs primitive or by null-friendly types; they confuse callers.`],
[`Expecting an overload to be chosen by the run-time type of an argument.`,`Override rules: you can't reduce visibility or throw broader checked exceptions.`]),
  quiz: [
    [`<code>Object o = "hi"; print(o);</code> with overloads print(Object) and print(String). Which runs?`,[`print(String), because the object is a String`,`print(Object), because overloads use static types`,`Both, in the order they're declared`,`Ambiguous call, so it's a compile error`],1,`Overloading is resolved at compile time from declared types. Only overriding is dynamic.`,'E'],
    [`Overloads <code>m(long)</code> and <code>m(Integer)</code>. Which does <code>m(5)</code> call?`,[`m(Integer), since boxing gives an exact type match`,`Ambiguous: compile error`,`Decided at run time from the value`,`m(long), because widening is tried before boxing`],3,`Overload resolution phases: widening first, then boxing, then varargs.`,'M'],
    [`An overriding method in a subclass may...`,[`return a subtype of the parent's return type`,`reduce visibility from public to protected`,`declare a broader checked exception`,`change a parameter from int to long`],0,`Covariant returns are allowed. Narrower access and broader checked exceptions aren't, and different parameters make it an overload.`,'H'],
    [`Overloading is decided...`,[`At run time, from the object's class`,`At compile time, from argument types`,`By the JIT after profiling`,`By the class loader`],1,`Overriding is decided at run time.`,'E'],
    [`Which is NOT a valid overload of <code>void log(String s)</code>?`,[`void log(String s, int level)`,`void log(Object o)`,`int log(String s)`,`void log(int code)`],2,`Return type alone doesn't distinguish overloads.`,'M'],
    [`What does <code>@Override</code> do?`,[`Tells the JVM to dispatch the call dynamically`,`Asks the compiler to verify it overrides`,`Forces subclasses to override the method too`,`Hides the parent method instead of overriding`],1,`Catches typos that would create a new overload.`,'E'],
    [`Overloads <code>m(int...)</code> and <code>m(int, int)</code>. <code>m(1, 2)</code> calls?`,[`m(int...)`,`m(int, int)`,`Ambiguous`,`Neither`],1,`Varargs is the last resort.`,'M'],
    [`Can an override throw a new checked exception the parent method didn't declare?`,[`Yes`,`No`,`Only RuntimeException subclasses (which aren't checked)`,`Only if final`],1,`It may throw fewer or narrower checked exceptions.`,'M'],
  ],
  quizAdv: [
    [`Overloads <code>m(Object)</code> and <code>m(String)</code>. <code>m(null)</code> calls?`,[`m(String): it's more specific`,`m(Object): it's the widest`,`Ambiguous: compile error`,`NullPointerException`],0,`null fits both; the most specific overload wins.`,'H'],
    [`Overloads <code>m(String)</code> and <code>m(Integer)</code>. <code>m(null)</code>?`,[`m(String)`,`m(Integer)`,`NullPointerException`,`Ambiguous: compile error`],3,`Neither is more specific than the other. Cast null to pick one.`,'H'],
    [`<code>void m(long x)</code> and <code>void m(Integer x)</code>; call <code>m(5)</code>. Which wins and why?`,[`m(Integer): boxing gives an exact match`,`m(long): widening is tried before boxing`,`Ambiguous: compile error`,`Chosen at run time by the value`],1,`Phase 1 (no boxing) finds m(long).`,'M'],
    [`A subclass defines <code>equals(Car other)</code> instead of <code>equals(Object o)</code>. Effect in a HashSet?`,[`It works: HashSet calls equals(Car)`,`It's an overload; HashSet uses identity`,`Compile error: equals must take Object`,`HashSet calls both versions`],1,`@Override would have flagged it.`,'H'],
  ],
});
