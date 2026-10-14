/* 3.7a Singleton (and how to break it) */
topic('3', { no:'3.7a', title:'Singleton (and how to break it)', idea:`Eager, holder idiom and enum singletons. Then break one with reflection and serialization, and see why the enum survives both.`,
actors:'Instances', stateTitle:'Singleton state',
codes:{a:`class Eager { static final Eager I = new Eager(); private Eager() {} }

class Lazy {
  private Lazy() {}
  private static class Holder { static final Lazy I = new Lazy(); }
  static Lazy get() { return Holder.I; }      // Holder inits on first call
}

enum Registry { INSTANCE; void register(String s) { /* ... */ } }`,
b:`Constructor<Lazy> k = Lazy.class.getDeclaredConstructor();
k.setAccessible(true);
Lazy second = k.newInstance();             // ✘ a 2nd instance

// serialization: readObject builds a NEW object unless you add:
private Object readResolve() { return Holder.I; }

Constructor<Registry> e = Registry.class.getDeclaredConstructor(String.class, int.class);
e.setAccessible(true);
e.newInstance("X", 1);   // ✘ IllegalArgumentException: Cannot reflectively create enum objects`},
steps:[
{cv:'a', hl:{JVM:[1]}, th:[['Eager.I','created:ok','at class init']], g:[G('Eager',['created when','Eager class is initialised (first use)'],['thread-safe','yes (class init lock)','ok'],['lazy','only as lazy as class loading'])],
 say:`<b>Eager:</b> a <code>static final</code> field created during class initialisation. The JVM's class-init lock (1.2) makes it thread-safe with no code. It's fine whenever creating the instance is cheap.`},
{hl:{JVM:[3,4,6]}, th:[['Lazy','class loaded:info','Holder NOT initialised yet']], g:[G('Lazy',['Lazy class initialised','yes'],['Holder class initialised','no','dim'],['instance','none yet','dim'])],
 say:`<b>Holder idiom:</b> loading <code>Lazy</code> doesn't initialise the nested <code>Holder</code> class. A nested class is initialised only on first use.`},
{hl:{JVM:[5,6]}, th:[['Lazy','get() called:info',''],['Holder.I','created:ok','exactly once']], g:[G('Lazy',['Holder class initialised','yes','ok'],['instance','Lazy@1','ok'],['locking cost on later calls','none','ok'])],
 say:`The first <code>get()</code> touches <code>Holder.I</code>, which triggers Holder's initialisation and creates the instance, guarded by the JVM. Later calls are just a field read, with no <code>volatile</code> and no <code>synchronized</code>. It's lazier and simpler than double-checked locking (4.18).`},
{cv:'b', hl:{attacker:[1,2,3]}, th:[['Holder.I','Lazy@1:ok',''],['second','Lazy@2:bad','via reflection']], g:[G('Lazy',['instances','2 ✘','bad'])],
 say:`<b>Breaking it, part 1:</b> <code>setAccessible(true)</code> ignores <code>private</code> and calls the constructor again. Defence: throw from the constructor if an instance already exists (clunky).`},
{hl:{attacker:[5,6]}, th:[['Holder.I','Lazy@1:ok',''],['deserialized','Lazy@1:ok','readResolve swapped it']], g:[G('Serialization',['readObject','creates a fresh object (no constructor call)','bad'],['readResolve()','replaces it with the real instance','ok'])],
 say:`<b>Breaking it, part 2:</b> if the class is <code>Serializable</code>, deserialising creates a <b>new</b> object without calling the constructor. <code>readResolve</code> swaps in the real instance (and you should mark the fields transient).`},
{hl:{attacker:[8,9,10]}, th:[['Registry.INSTANCE','safe:ok','']], g:[G('enum singleton',['reflection','blocked by the JVM','ok'],['serialization','by name → same constant','ok'],['thread-safe','class init','ok'],['downside','can\'t extend a class; eager'])], log:['✘ IllegalArgumentException: Cannot reflectively create enum objects'],
 say:`<b>Enum</b> singletons are safe against both attacks for free: the JVM refuses to create enum constants reflectively, and enum serialization works by name. That's why Effective Java calls it the best approach.`},
{th:[], g:[G('Why singletons get criticised',['global mutable state','hidden coupling','bad'],['testing','hard to replace with a fake','bad'],['multiple class loaders','one instance PER loader']), G('In Spring',['@Service beans','singleton SCOPE: one per container','ok'],['injected','via constructor, so replaceable in tests','ok'],['must be','stateless or thread-safe (5.2)'])],
 say:`In application code you rarely hand-write singletons. A Spring bean in <b>singleton scope</b> gives you "one instance" with dependency injection, so tests can still pass a fake. Hand-written singletons are for library code and infrastructure.`}
],
keep:[`Holder idiom: lazy + thread-safe via class init, no locks.`,`Reflection and serialization can create a second instance (readResolve fixes serialization).`,`Enum singleton resists both; Spring singleton scope + DI is usually better.`]}, {
  imp: 'must',
  theory: TH(`A Singleton guarantees exactly one instance of a class and gives global access to it.`,
`<p>Some things should exist once: a configuration registry, a connection pool. The Singleton pattern makes the constructor private and exposes one shared instance. The challenge is creating it <b>once</b> even when several threads ask at the same moment, and preventing tricks (reflection, serialization) from creating a second one.</p>`,
[[`Eager singleton`,`Instance created when the class loads.`],[`Lazy singleton`,`Created on first use.`],[`Holder idiom`,`A nested static class holds the instance; the JVM creates it lazily and thread-safely.`],[`Enum singleton`,`enum X { INSTANCE }: the simplest, safest form.`]],
[`Make the constructor private.`,`Provide a static accessor returning the single instance.`,`For laziness plus thread-safety, use the holder idiom or an enum (double-checked locking needs volatile).`,`Guard against serialization creating a copy (readResolve), or use an enum.`],
[`In Spring apps you rarely write singletons: beans are singletons by default, and DI makes them easy to replace in tests.`],
[`Global mutable state hidden in a singleton.`,`Singletons that are hard to replace in tests.`]),
  quiz: [
    [`Which singleton implementation resists reflection and serialization by default?`,[`Double-checked locking`,`An eager static final field`,`An enum with a single INSTANCE`,`The holder idiom`],2,`Enums can't be instantiated reflectively and serialise by name.`,'E'],
    [`Why is the holder idiom (<code>private static class Holder { static final X I = new X(); }</code>) lazy and thread-safe?`,[`The JVM initialises Holder once, under a lock, on first use`,`The INSTANCE field is implicitly volatile inside Holder`,`All static fields are created when the JVM starts up`,`It isn't, unless getInstance() is also synchronized`],0,`Class initialisation is lazy and guarded by the JVM.`,'M'],
    [`Which breaks a holder-idiom singleton but not an enum singleton?`,[`Two threads calling getInstance() at the same moment`,`Calling getInstance() from another class's static block`,`Class unloading during a GC`,`Reflection calling the private constructor with setAccessible(true)`],3,`Reflection (and serialization without readResolve) can create a second instance. Enums are protected against both.`,'H'],
    [`How do you stop other code from creating a second instance of a singleton class?`,[`Make the class abstract`,`Make the constructor private`,`Make fields static`,`Use final fields`],1,`And expose one instance.`,'E'],
    [`Eager singleton <code>static final X INSTANCE = new X();</code> is created when?`,[`When the JVM starts`,`When the class is first initialised`,`Never, until getInstance() runs twice`,`On each call to INSTANCE`],1,`Class init is lazy in Java.`,'M'],
    [`Why is double-checked locking easy to get wrong?`,[`The outer check is slow under contention`,`Without volatile, a half-built object leaks`,`The inner synchronized block can deadlock`,`Static fields can't be read outside the lock`],1,`See 4.6.`,'M'],
    [`Why are singletons often criticised?`,[`They're slow because every call is synchronized`,`Hidden global state, hard to replace in tests`,`They can't implement interfaces or be mocked`,`They force all their methods to be static`],1,`DI singletons avoid most problems.`,'E'],
    [`How many instances does a Spring singleton bean have?`,[`One per thread using it`,`One per application context`,`One per JVM, globally`,`One per injection point`],1,`Two contexts would create two.`,'M'],
  ],
  quizAdv: [
    [`In a Spring app, what's usually better than a hand-rolled singleton?`,[`A static utility class holding state`,`A singleton-scoped bean, injected`,`A ThreadLocal instance`,`A prototype bean`],1,`One instance per context, with DI and easy test substitution.`,'M'],
    [`You serialise and deserialise a holder-idiom singleton that has no readResolve. Result?`,[`The same instance comes back`,`NotSerializableException`,`A second instance`,`The fields come back as null`],2,`Deserialisation creates a new object. Add readResolve() returning INSTANCE, or use an enum.`,'H'],
    [`What does <code>readResolve()</code> fix?`,[`Reflection calling the private constructor twice`,`Deserialization creating a second singleton instance`,`Cloning producing a second singleton instance`,`Two threads racing to create the first instance`],1,`Return INSTANCE from it.`,'M'],
    [`Two class loaders load the same singleton class. How many instances?`,[`One: static state is shared across the whole JVM`,`Two: each loader has its own class and static state`,`One: the second loader reuses the first's class`,`None: the second load throws a LinkageError`],1,`Singleton is per class per loader.`,'H'],
  ],
});
