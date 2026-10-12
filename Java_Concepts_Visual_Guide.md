# Java Concepts: Visual Guide

Core Java interview topics taught as **concept → picture → example → gotcha** instead of Q&A. Every section has an interactive step-by-step version in the [Java Visualizer](https://adityamalu.github.io/java-visualizer/).

- Part 1: Java platform, memory, types
- Part 2: Collections, generics, exceptions, Java 8+
- Part 3: OOP, SOLID, design patterns
- Part 4: Multithreading and concurrency
- Part 5: Spring Boot, JPA, microservices
- Part 6: Real-world scenarios

New to a topic? Start with its **Theory: start here** section: the idea in one sentence, a plain-language explanation with an everyday analogy, key terms, how it works step by step, how it shows up in real projects, and common mistakes. No prior knowledge is assumed.

Then, how to read each concept's notes: the **idea** in 1–2 lines → the **picture** (diagram) → the **example** (code) → **Gotcha** (what interviewers trip you on) → **Say it** (your 15-second answer).

---

# Part 1: Java platform, memory, types

## 1.1 JDK, JRE, JVM

#### Theory: start here

**In one sentence:** Java code is compiled twice: once by you into portable bytecode, and again by the JVM into fast machine code for the parts that run most.

A computer's CPU only understands **machine code**, and every kind of CPU (Intel, ARM) has its own. If Java compiled straight to machine code, you'd need a different build for every machine. Instead, `javac` compiles your `.java` files into **bytecode**: instructions for an imaginary computer called the **Java Virtual Machine**. Each real machine runs a JVM that understands that bytecode. That's "write once, run anywhere".

Think of bytecode as a recipe written in a universal language, and the JVM as a local chef who reads it. At first the chef reads the recipe line by line (the **interpreter**): it works immediately, but slowly. The chef notices which recipes are cooked hundreds of times and memorises them as muscle memory: that's the **JIT (Just-In-Time) compiler** turning hot bytecode into native machine code while the program runs.

**Key terms**

- **JDK**: Java Development Kit: everything to build and run Java (javac, jar, debugging tools, the runtime).
- **JRE**: Java Runtime Environment: the JVM plus the standard library. Enough to run, not to compile. No longer shipped separately since Java 11.
- **JVM**: The program that loads bytecode, checks it, runs it, compiles hot parts and manages memory.
- **Bytecode**: Compact, CPU-independent instructions stored in .class files.
- **JIT**: The compiler inside the JVM that turns frequently used bytecode into machine code at run time. HotSpot has two: C1 (fast to compile) and C2 (slower, highly optimised).

**How it works**

1. You write `Hello.java`; `javac` produces `Hello.class` (bytecode).
2. `java Hello` starts a JVM, which loads and verifies the class.
3. The interpreter starts executing immediately and counts how often each method and loop runs.
4. Code that gets "hot" is compiled by C1, and later by C2 using the profile it collected (which types appear, which branches are taken).
5. If an assumption C2 made turns out wrong, the JVM throws that compiled code away (deoptimises) and recompiles later.

**In real projects**

- The first requests after a deploy are slower (warm-up). Some teams send warm-up traffic before putting a pod into the load balancer.
- Measure performance with JMH, not a hand-written loop with `System.nanoTime`.
- For fast startup (serverless, CLIs), look at CDS, GraalVM native image or Project Leyden.

**Common mistakes**

- Benchmarking cold code and concluding Java is slow.
- Thinking the JRE is a separate download you need in modern Java.
- Assuming javac does the heavy optimisation; almost all of it happens in the JIT at run time.

#### Notes and pictures

**Idea:** You write `.java` → `javac` compiles it to bytecode `.class` → the JVM on each OS runs that bytecode. That is "write once, run anywhere".

```
 ┌──────────────────────── JDK ─────────────────────────┐
 │  javac, jar, jdb, jcmd, jstack  (tools to BUILD)      │
 │  ┌──────────────────── JRE ───────────────────────┐   │
 │  │  Standard libraries (java.lang, java.util ...) │   │
 │  │  ┌──────────────── JVM ──────────────────────┐ │   │
 │  │  │ Class loader → Verifier → Interpreter     │ │   │
 │  │  │                    + JIT compiler + GC    │ │   │
 │  │  └───────────────────────────────────────────┘ │   │
 │  └────────────────────────────────────────────────┘   │
 └───────────────────────────────────────────────────────┘

 Hello.java ──javac──► Hello.class (bytecode) ──► JVM (Windows) ──► native code
                                              └─► JVM (Linux)   ──► native code
```

**JIT:** the JVM first interprets bytecode; methods that run often ("hot") get compiled to native machine code. That's why Java gets faster after warm-up.

**Say it:** "JVM runs bytecode, JRE is JVM plus libraries, JDK is JRE plus dev tools. The JIT compiles hot code to native."

## 1.2 Class loading

#### Theory: start here

**In one sentence:** Classes aren't all loaded at startup; the JVM finds and loads each one the first time it's needed, through a chain of class loaders.

Your program uses thousands of classes: yours, your libraries', and the JDK's. Loading all of them at startup would be slow, so the JVM loads a class **lazily**, the first time your code really uses it. The component that finds the `.class` bytes (in a JAR, a folder or even over the network) is a **class loader**.

There's a hierarchy of loaders, like a chain of command. When a loader is asked for a class it first asks its **parent**; only if the parent can't find it does it look itself. This **parent delegation** guarantees that `java.lang.String` always comes from the JDK and can't be replaced by a fake one on your classpath.

**Key terms**

- **Bootstrap loader**: Built into the JVM; loads core classes like java.lang.*.
- **Platform loader**: Loads other JDK modules (java.sql, …).
- **Application loader**: Loads your classes and libraries from the classpath.
- **Linking**: Verifying the bytecode is safe, preparing static fields with default values, and resolving references.
- **Initialisation**: Running static field initialisers and static { } blocks, exactly once, the first time the class is actively used.

**How it works**

1. Code mentions a class for the first time (e.g. `new Car()`).
2. The application loader delegates up to platform, then bootstrap; whoever can find it loads it.
3. The bytes are verified (no stack overflows, type-correct instructions).
4. Static fields get default values (0, null), then static initialisers run, once, in a thread-safe way.
5. The class's identity is its name **plus** the loader that defined it.

**In real projects**

- App servers and plugin systems use separate loaders per app, so two versions of a library can coexist.
- `ClassNotFoundException` = you asked by name and it isn't there. `NoClassDefFoundError` = it was there when compiling but missing (or failed to initialise) at run time: check your deployed JARs.
- Changing a `static final` constant in a library needs the callers recompiled, because constants are copied into them.

**Common mistakes**

- Doing heavy work or calling remote services in a static block; if it fails, the class is unusable for the rest of the JVM's life.
- Assuming two classes with the same name are the same type, even when different loaders loaded them.

#### Notes and pictures

**Idea:** Classes are loaded lazily, on first use, by a chain of loaders. Each loader **asks its parent first** (parent delegation), so nobody can sneak in a fake `java.lang.String`.

```
   request "com.app.Car"
          │
          ▼
   Application loader ──ask parent──► Platform loader ──ask parent──► Bootstrap loader
   (your classpath)                   (java.sql ...)                  (java.lang, java.util)
          ▲                                                                   │
          └──────────── not found up there, so load it myself ◄───────────────┘

   Phases:  LOAD (read bytes) → LINK (verify, prepare statics = defaults, resolve) → INITIALISE (static blocks run, once)
```

```java
class Config {
    static { System.out.println("loaded!"); }   // runs once, on first use of Config
    static int x = 5;
}
// Config.x  → prints "loaded!" the first time only
```

**Gotcha:** static blocks run at **initialisation**, not when the JVM starts.

## 1.3 JVM memory areas: stack vs heap

#### Theory: start here

**In one sentence:** Every thread gets its own stack for method calls and local variables; all objects live in one shared heap.

When a method runs, it needs scratch space for its parameters and local variables. Java gives each thread a **stack**: a pile of **frames**, one per method call in progress. Calling a method pushes a frame; returning pops it, instantly freeing its locals. It's like a stack of sticky notes: you only ever add or remove the top one.

Objects are different: they may need to outlive the method that created them, and several threads may use them. So every `new` object goes on the **heap**, a big shared area managed by the garbage collector. A local variable such as `Car c = new Car()` is a small **reference** on the stack pointing at the object on the heap.

**Key terms**

- **Stack frame**: Memory for one method call: its local variables and an operand stack for calculations.
- **Heap**: Shared memory where all objects and arrays live; cleaned by the GC.
- **Reference**: A pointer-like value that tells the JVM where an object is.
- **Metaspace**: Native memory (outside the heap) holding class metadata: method code, field layouts.
- **Escape analysis**: A JIT optimisation: if an object never leaves a method, it may not need a heap allocation at all.

**How it works**

1. `main` starts: one frame on the main thread's stack.
2. Each call pushes a frame with its own locals; primitives are stored directly in it.
3. `new` allocates the object on the heap and stores a reference in the frame.
4. Return pops the frame; the object stays on the heap until nothing references it.

**In real projects**

- Local variables are naturally thread-safe; shared objects on the heap need coordination.
- Deep or infinite recursion → `StackOverflowError`. Too many live objects → `OutOfMemoryError: Java heap space`. Too many generated classes → `OutOfMemoryError: Metaspace`.
- `-Xmx` sets the max heap; `-Xss` sets each thread's stack size.

**Common mistakes**

- Thinking "objects passed to methods are on the stack": only the reference is.
- Sizing a container's memory as just -Xmx: stacks, Metaspace and native buffers need room too.

#### Notes and pictures

**Idea:** Each thread gets its own **stack** (method frames with local variables). All **objects** live on one shared **heap**. Class metadata lives in **Metaspace**.

```
 Thread 1 stack        Thread 2 stack              HEAP (shared, GC-managed)
 ┌──────────────┐      ┌──────────────┐       ┌──────────────────────────────┐
 │ main()       │      │ run()        │       │  Car@1a  {price=500000}      │
 │  car ────────┼──────┼──────────────┼──────►│                              │
 │  int n = 5   │      │  car2 ───────┼──────►│  Car@2b  {price=700000}      │
 ├──────────────┤      └──────────────┘       │  String pool: "hi", "Pune"   │
 │ helper()     │                             └──────────────────────────────┘
 │  int i = 0   │      Metaspace: class definitions (Car.class methods, fields)
 └──────────────┘      PC register + native stack: per thread
```

```java
void main() {
    int n = 5;              // primitive: value sits in the stack frame
    Car car = new Car();    // reference on the stack, object on the heap
}
```

**Gotcha:** `StackOverflowError` = recursion too deep (stack full). `OutOfMemoryError` = heap full (or Metaspace full).

**Say it:** "Stack is per thread and holds frames and locals; heap is shared and holds objects; Metaspace holds class metadata."

## 1.4 Garbage collection

#### Theory: start here

**In one sentence:** The garbage collector finds objects your program can no longer reach and reclaims their memory, so you never call free().

In C you must free memory yourself; forget and you leak, free too early and you crash. Java does it for you. Periodically, the **garbage collector (GC)** starts from a set of **roots** (local variables on every thread's stack, static fields, and a few others) and follows every reference. Anything it can reach is alive; everything else is garbage, even if those garbage objects still point at each other.

Most objects die young (a temporary string, an iterator). So the heap is split into a **young generation**, collected often and cheaply, and an **old generation** for objects that survived several collections. It's like a desk inbox that's cleared daily, with only important papers moving to the filing cabinet.

**Key terms**

- **GC roots**: Starting points for reachability: thread stacks, static fields, JNI references.
- **Young generation**: Eden (where new objects are born) plus survivor spaces.
- **Old generation**: Long-lived objects, collected less often.
- **Stop-the-world pause**: A moment when application threads are paused so the GC can work safely.
- **G1 / ZGC**: G1 is the default collector (region-based, aims for a pause target). ZGC keeps pauses around a millisecond on huge heaps.

**How it works**

1. New objects are allocated in Eden (very fast, just bumping a pointer).
2. When Eden fills, a young GC copies the few live objects to a survivor space and wipes Eden.
3. Objects that survive several young GCs are promoted to the old generation.
4. When the old generation fills up, a concurrent or full collection reclaims it.

**In real projects**

- A "memory leak" in Java means objects that are still reachable but useless, such as entries in a static map that's never cleared.
- Diagnose with GC logs (`-Xlog:gc`), a heap dump, and the dominator tree in Eclipse MAT.
- Most services need no tuning beyond heap size; pick ZGC if long pauses hurt latency.

**Common mistakes**

- Calling `System.gc()` to "help".
- Raising -Xmx to hide a leak; it only delays the crash.
- Believing reference cycles leak in Java; they don't.

#### Notes and pictures

**Idea:** Most objects die young. So the heap is split into generations, and the young one is cleaned often and cheaply.

```
 YOUNG GENERATION                                    OLD GENERATION
 ┌─────────────────────┬────────┬────────┐          ┌───────────────────────┐
 │        Eden         │   S0   │   S1   │ ──age──► │  long-lived objects   │
 │  (new objects here) │survivor│survivor│ promote  │  (caches, singletons) │
 └─────────────────────┴────────┴────────┘          └───────────────────────┘
   Minor GC: frequent, fast                          Major/Full GC: rare, slower

 An object is garbage when NO chain of references from a GC root reaches it:
   GC roots (stack locals, static fields, active threads)
        │
        ▼
      [A] ──► [B]          [C] ──► [D]     ← C and D unreachable → collected
```

- **G1** (default): heap split into regions; collects the regions with the most garbage first; aims for a pause target.
- **ZGC / Shenandoah**: very short pauses even with huge heaps.

**Memory leak in Java** = objects still reachable but never needed again:

```java
static Map<String, User> cache = new HashMap<>();   // grows forever, never evicted → leak
```

**Say it:** "Generational: Eden → survivors → old gen. Unreachable from GC roots means collectable. A Java leak is an unwanted reference, like a static map that only grows."

## 1.5 Reference types: strong, soft, weak, phantom

#### Theory: start here

**In one sentence:** Besides normal (strong) references, Java has soft, weak and phantom references that let the GC reclaim an object even while you still point at it.

A normal variable is a **strong** reference: as long as it exists, the object stays alive. Sometimes you want to *remember* an object without *keeping it alive*, for example a cache entry or metadata attached to an object owned by someone else. The `java.lang.ref` classes wrap an object in a weaker kind of reference that the GC is allowed to break.

Analogy: a strong reference is holding someone's hand; a weak reference is knowing their phone number. If everyone else lets go, they can leave, and the number stops working.

**Key terms**

- **Strong**: Normal reference. Never cleared while reachable.
- **Soft**: Cleared when memory is tight, always before OutOfMemoryError.
- **Weak**: Cleared at the next GC once no strong or soft references remain.
- **Phantom**: Never returns the object; only tells you it has been collected, for cleanup.
- **WeakHashMap**: A map whose keys are weak: entries disappear once the key is otherwise unreachable.

**How it works**

1. Wrap the object: `new WeakReference<>(obj)`.
2. `ref.get()` returns the object, or null once it has been cleared.
3. Optionally register a ReferenceQueue to be told when a reference is cleared.
4. `Cleaner` (built on phantom references) runs cleanup code after an object dies.

**In real projects**

- Rarely needed directly; use a bounded cache like Caffeine instead of soft-reference caches.
- WeakHashMap is useful for attaching data to objects whose lifetime you don't control.
- ThreadLocal uses weak keys internally, which matters for its leak behaviour (4.12).

**Common mistakes**

- A WeakHashMap value that references its own key: the entry can never be cleared.
- Using soft references as a cache: under pressure many are cleared at once, causing GC churn.

#### Notes and pictures

```
 Strength:   STRONG  >  SOFT  >  WEAK  >  PHANTOM
 Collected:  never      only when   at next    already collected;
 (while      while      memory is   GC         used for cleanup hooks
 reachable)  reachable  low
 Use for:    normal     memory-     WeakHashMap,  Cleaner
             code       sensitive   listeners
                        caches
```

```java
WeakReference<Image> ref = new WeakReference<>(img);
img = null;          // now only weakly reachable
ref.get();           // may return null after the next GC
```

## 1.6 Pass-by-value (always)

#### Theory: start here

**In one sentence:** Java always passes a copy of the variable's value into a method; for objects that value is a reference, so the method can change the object but not the caller's variable.

When you call `m(x)`, Java copies whatever is in `x` into the parameter. For an `int` that's the number. For an object, the variable doesn't hold the object itself; it holds a **reference** (an address), so the address is copied.

Analogy: I give you a **photocopy of my house's address**. You can go to the house and repaint it (I'll see the new colour), but if you scribble a different address on your copy, my copy doesn't change.

**Key terms**

- **Pass-by-value**: The callee receives a copy of the argument's value.
- **Reference**: The value stored in an object variable: it says where the object is.
- **Mutation**: Changing the object's fields through a reference; visible to everyone holding that reference.
- **Reassignment**: Pointing a variable at a different object; only affects that variable.

**How it works**

1. Caller has `Car car` → object A.
2. Calling `m(car)` copies the reference: parameter `c` also → A.
3. `c.name = "x"` changes A, which the caller sees.
4. `c = new Car()` points only `c` at a new object B; the caller still sees A.

**In real projects**

- Methods that need to "return two things" should return a small result object or record.
- Defensive copies: if a method stores a list you pass in, it may want to copy it so your later changes don't affect it.

**Common mistakes**

- Saying "objects are passed by reference" in an interview: the precise answer is "references are passed by value".
- Expecting a `swap(a, b)` method to swap the caller's variables.

#### Notes and pictures

**Idea:** Java copies the value into the parameter. For objects, the value **is a reference**, so you get a copy of the arrow, not a copy of the object.

```
 caller:  car ──────────┐
                        ▼
                    Car{price=1}
                        ▲
 method:  c ────────────┘        c.price = 5     → changes the shared object ✔
                                  c = new Car()   → c now points elsewhere;
                                                    caller's car is untouched
```

```java
void change(Car c) { c.price = 5; c = new Car(); c.price = 9; }
Car car = new Car(); change(car);
System.out.println(car.price);   // 5
```

**Say it:** "Always pass-by-value. For objects the value is a reference, so you can mutate the object but can't reassign the caller's variable."

## 1.7 Primitives, wrappers, autoboxing, Integer cache

#### Theory: start here

**In one sentence:** Primitives (int, long…) are plain values; wrappers (Integer, Long…) are objects. Java converts between them automatically, which is convenient but has traps.

Collections and generics only work with objects, so Java has a wrapper class for every primitive: `Integer` for `int`, and so on. **Autoboxing** converts `int → Integer` for you, and **unboxing** converts back. It makes `List<Integer> list; list.add(5)` just work.

Because wrappers are objects, `==` compares **identities**, not numbers. To save memory, `Integer.valueOf` keeps a cache of the values -128 to 127, so small numbers happen to be the same object and `==` seems to work. Then 128 comes along and it stops working.

**Key terms**

- **Autoboxing**: Automatic int → Integer, using Integer.valueOf.
- **Unboxing**: Automatic Integer → int, using intValue(). Throws NPE if the Integer is null.
- **Integer cache**: Shared Integer objects for -128..127.
- **equals**: Compares the numeric values of two wrappers.

**How it works**

1. `Integer a = 100;` becomes `Integer.valueOf(100)`, a cached object.
2. `Integer b = 1000;` creates a new object each time.
3. Arithmetic (`a + b`) unboxes both to ints first.
4. Assigning a null Integer to an int (or using it in arithmetic) unboxes null → NullPointerException.

**In real projects**

- Compare wrappers with `equals` or `Objects.equals`, never ==.
- Use `map.getOrDefault(key, 0)` instead of unboxing a possibly-null `get`.
- Avoid boxing in hot loops (e.g. `Long sum`); it creates garbage.

**Common mistakes**

- `list.remove(1)` on a List&lt;Integer> removes index 1, not the value 1.
- A ternary mixing Integer and int unboxes and can throw NPE.

#### Notes and pictures

```
 primitive  int x = 5      →  [ 5 ]                  (value, no object, can't be null)
 wrapper    Integer y = 5  →  [ ref ] ──► Integer{5} (object, can be null, works in collections)

 Integer cache: -128 ... 127 are pre-created and reused
   Integer a = 127, b = 127   a ──► Integer{127} ◄── b      a == b  → true
   Integer c = 128, d = 128   c ──► Integer{128}             c == d  → false
                              d ──► Integer{128}  (another object)
```

```java
c.equals(d);              // true: always compare wrappers with equals
Integer n = null;
int x = n;                // NullPointerException (auto-unboxing null)
```

| Primitive | byte | short | int | long | float | double | char | boolean |
|---|---|---|---|---|---|---|---|---|
| Size | 1 B | 2 B | 4 B | 8 B | 4 B | 8 B | 2 B | JVM-dependent |

## 1.8 `==` vs `equals`, and the String pool

#### Theory: start here

**In one sentence:** Strings are immutable objects; identical literals are shared through a pool, and == compares references, not text.

A `String` can never change after it's created. Methods like `toUpperCase()` return a **new** String. Because of that, the JVM can safely share one copy of each literal: `"hello"` written in ten places points to the same object in the **String pool**.

That's why `==` sometimes "works" for strings (two literals are the same pooled object) and sometimes doesn't (a string built at run time is a new object). Always compare text with `equals`.

**Key terms**

- **Immutable**: Its contents can't change once created.
- **String pool**: A JVM-wide table of shared string instances for literals and interned strings.
- **intern()**: Returns the pooled copy of a string, adding it if needed.
- **StringBuilder**: A mutable buffer for building strings efficiently.

**How it works**

1. Literals and compile-time constants (`"a" + "b"`, final constants) are put in the pool.
2. Strings built at run time (`s + t`, `new String`, reading input) are new heap objects.
3. `s1 == s2` is true only if both point to the same object; `equals` compares characters.
4. Each `+=` creates a whole new String, copying the old contents.

**In real projects**

- Build strings in loops with `StringBuilder`.
- Immutability makes Strings safe as HashMap keys and safe to share between threads.
- Use `String.join`, `formatted()` or text blocks for readability.

**Common mistakes**

- Comparing user input with == to a literal.
- `s += x` inside a large loop: O(n²) copying.

#### Notes and pictures

```
 String a = "hi";               a ──┐
 String b = "hi";               b ──┴──► "hi"   (in String pool, stored once)
 String c = new String("hi");   c ─────► "hi"   (separate heap object)

 a == b          true   (same object)
 a == c          false  (different objects)
 a.equals(c)     true   (same characters)
 a == c.intern() true   (intern returns the pooled copy)
```

**Why is String immutable?** The pool can share one object safely; hash code is cached (fast HashMap keys); thread-safe for free; secure (a file path or URL can't change after a security check).

**String vs StringBuilder vs StringBuffer:**

```java
String s = "";
for (int i = 0; i < 1000; i++) s += i;     // creates ~1000 throwaway Strings: O(n²)

StringBuilder sb = new StringBuilder();
for (int i = 0; i < 1000; i++) sb.append(i);   // one growing buffer: O(n)
```
StringBuilder = fast, not synchronized. StringBuffer = synchronized, legacy.

**Gotcha:** `char[]` for passwords, because you can wipe it (`Arrays.fill(pw, '0')`); a String stays in memory until GC.

## 1.9 `static`, `final`, access modifiers

#### Theory: start here

**In one sentence:** static means "belongs to the class, not to an object", final means "can't be reassigned", and a class can be nested inside another, statically or not.

**static**: a static field has one copy shared by the whole class, instead of one per object, like a counter on the classroom wall rather than in each student's notebook. Static methods don't have a `this`, so they can't touch instance fields.

**final**: a final variable can be assigned only once. A final method can't be overridden; a final class can't be extended. Careful: a final *reference* to a list can't point to another list, but the list itself can still change.

**Nested classes**: a `static` nested class is just a class placed inside another for organisation. A non-static **inner** class secretly holds a reference to the outer object that created it.

**Key terms**

- **static field**: One value shared by all instances.
- **static method**: Called on the class; no this; can't be overridden (only hidden).
- **final**: Assign-once variable, non-overridable method, or non-extendable class.
- **Inner class**: Non-static nested class; each instance holds Outer.this.
- **Static nested class**: A nested class without a hidden outer reference.

**How it works**

1. Static fields are created and initialised when the class is initialised.
2. Calling a static method through a variable is resolved by the variable's declared type.
3. final instance fields get special memory-model guarantees: once constructed, other threads see their values.
4. Creating an inner class instance stores a reference to the outer instance inside it.

**In real projects**

- Use static for constants (`static final`) and pure utility methods.
- Prefer static nested classes for builders, nodes, DTOs.
- Make fields final by default; it documents intent and helps thread safety.

**Common mistakes**

- Mutable static state shared by all requests in a web app.
- Inner classes (or anonymous classes) captured by long-lived listeners, leaking the outer object.

#### Notes and pictures

```
 class Car {
     static int count;     ← ONE copy, shared by all Car objects (belongs to the class)
     int price;            ← one copy PER object
 }
         Car.count = 2
           ▲      ▲
   car1{price=5}  car2{price=9}
```

| Keyword | On a variable | On a method | On a class |
|---|---|---|---|
| `final` | can't reassign | can't override | can't extend (`String`) |
| `static` | one per class | no `this`; hidden, not overridden | only for nested classes |

**Access, from narrow to wide:**

```
 private  ⊂  default (package)  ⊂  protected (package + subclasses)  ⊂  public
```

**`final`, `finally`, `finalize`:** keyword / block that always runs after try / deprecated GC hook.

## 1.10 Immutable class and money

#### Theory: start here

**In one sentence:** An immutable object never changes after construction, which makes it simple and thread-safe; money must use exact decimal types, never double.

An **immutable** object, like `String` or `LocalDate`, is set up once in its constructor and never changes. "Changing" it gives you a new object. You never have to wonder who modified it, and you can share it between threads without locks.

**Money** needs exact decimals. `double` stores numbers in binary, which can't represent 0.1 exactly (like 1/3 in decimal), so `0.1 + 0.2` becomes 0.30000000000000004. Use `BigDecimal` created from a String, or store whole **minor units** (cents) in a `long`.

**Key terms**

- **Immutable class**: final class, private final fields, no setters, defensive copies in and out.
- **Defensive copy**: Copying a mutable argument so the caller can't change your internals later.
- **BigDecimal**: Arbitrary-precision decimal number with an explicit scale.
- **Scale / RoundingMode**: Number of decimal places, and how to round when dividing.

**How it works**

1. Make the class final and all fields private final.
2. In the constructor, copy any mutable inputs (lists, arrays, dates).
3. Don't expose mutable internals; return copies or unmodifiable views.
4. For changes, return a new instance ("withers": `withAmount(...)`).

**In real projects**

- Records are a concise way to write immutable data carriers.
- Store money as BigDecimal or long cents; always specify RoundingMode when dividing.
- Compare BigDecimals with compareTo, because equals also compares the scale (2.0 ≠ 2.00).

**Common mistakes**

- `new BigDecimal(0.1)`: it captures the double's error. Use `new BigDecimal("0.1")` or `BigDecimal.valueOf(0.1)`.
- Storing a caller's list directly in an "immutable" object.

#### Notes and pictures

**Recipe:** `final` class, `private final` fields, no setters, defensive copies in and out.

```java
public final class Price {
    private final long amount;
    private final List<String> tags;
    public Price(long amount, List<String> tags) {
        this.amount = amount;
        this.tags = List.copyOf(tags);      // copy in: caller can't change our list later
    }
    public List<String> tags() { return tags; }   // already unmodifiable
}
// Java 16+: public record Price(long amount, List<String> tags) {}
```

**Money:** never `double` (`0.1 + 0.2 = 0.30000000000000004`). Use `BigDecimal` (compare with `compareTo`, because `equals` also checks scale: `2.0 ≠ 2.00`) or a `long` in paise.

## 1.11 Shallow vs deep copy

#### Theory: start here

**In one sentence:** Copying an object can copy just the outer object (shallow) or everything it contains (deep); the difference decides whether changes leak between copies.

Imagine photocopying a folder's cover page but not the documents inside: both "copies" still share the same documents. That's a **shallow copy**: a new outer object whose fields point to the *same* inner objects. A **deep copy** also duplicates the inner mutable objects, so the copies are fully independent.

**Key terms**

- **Shallow copy**: New top-level object; nested objects shared.
- **Deep copy**: Nested mutable objects copied too.
- **clone()**: Object's built-in copy: shallow by default, skips constructors, awkward to use.
- **Copy constructor**: A constructor that takes another instance and copies it explicitly.

**How it works**

1. Decide which fields are mutable (lists, arrays, Dates, your own mutable classes).
2. Copy each mutable field: new list, and copies of its elements if they're mutable too.
3. Immutable fields (String, Integer, LocalDate, records of immutables) can be shared safely.
4. For object graphs with cycles, track already-copied objects to avoid infinite recursion.

**In real projects**

- Prefer copy constructors or static factories (`Order.copyOf(o)`) over Cloneable.
- The best fix is often immutability: if nothing can change, sharing is safe.

**Common mistakes**

- Assuming `new ArrayList<>(other)` is a deep copy: it copies references to the same elements.
- Using clone() on classes with mutable fields without overriding it.

#### Notes and pictures

```
 shallow copy:  orig ──► Car{ engine ──┐ }
                copy ──► Car{ engine ──┴──► Engine }   ← shared! changing engine affects both

 deep copy:     orig ──► Car{ engine ──► Engine }
                copy ──► Car{ engine ──► Engine' }     ← independent
```
Prefer a copy constructor `new Car(other)` over `clone()` (no constructor runs, shallow by default, awkward checked exception).

**Object's methods:** `equals`, `hashCode`, `toString`, `getClass`, `clone`, `wait`, `notify`, `notifyAll`, `finalize` (deprecated).

---

# Part 2: Collections, generics, exceptions, Java 8+

## 2.1 The collections map: what to pick

#### Theory: start here

**In one sentence:** The Collections Framework gives you ready-made containers: lists, sets, maps and queues. Picking the right one is mostly about how you'll access the data.

Programs constantly hold groups of things: orders, users, prices. Java provides interfaces describing *what* a container does and classes describing *how*:

- **List**: ordered, allows duplicates, access by position (a playlist).
- **Set**: no duplicates (a guest list).
- **Map**: key → value lookups (a phone book).
- **Queue / Deque**: take items from the front or back (a ticket line).

Each has several implementations with different speeds. Ask yourself: do I look things up by key? Need sorting? Need order of insertion? Will several threads touch it?

**Key terms**

- **ArrayList**: Resizable array. The default List.
- **HashMap / HashSet**: Hash table: O(1) average lookup, no order.
- **TreeMap / TreeSet**: Sorted (red-black tree): O(log n), range queries.
- **LinkedHashMap**: HashMap that remembers insertion or access order.
- **ArrayDeque**: Fast stack/queue.
- **PriorityQueue**: Always gives you the smallest (or best) element next.

**How it works**

1. Need lookup by key → Map. Need uniqueness → Set. Need order/position → List.
2. Need sorted order or ranges → Tree*. Need insertion order → LinkedHash*.
3. Need "best next" → PriorityQueue. Stack or queue → ArrayDeque.
4. Shared between threads → the java.util.concurrent versions (4.16).

**In real projects**

- Declare variables by interface (`List<Order> orders = new ArrayList<>()`) so you can swap the implementation.
- Default choices: ArrayList, HashMap, HashSet, ArrayDeque.
- Return immutable collections (`List.of`, `List.copyOf`) from APIs.

**Common mistakes**

- Using LinkedList by default "because inserts are O(1)".
- Using Vector/Hashtable/Stack (legacy, synchronized) in new code.

#### Notes and pictures

```
                          Iterable
                             │
                         Collection                                  Map (separate tree)
         ┌───────────────────┼────────────────────┐                ┌──────┼───────────┬──────────────┐
        List                Set               Queue / Deque     HashMap  LinkedHashMap TreeMap  ConcurrentHashMap
   ┌─────┴─────┐      ┌──────┼────────┐       ┌─────┴──────┐
 ArrayList LinkedList HashSet LinkedHashSet TreeSet  PriorityQueue  ArrayDeque
```

| Need | Use | Why |
|---|---|---|
| Ordered list, index access | `ArrayList` | O(1) get, cache-friendly |
| Unique items, fast lookup | `HashSet` | O(1) average |
| Unique + insertion order | `LinkedHashSet` | hash + linked list |
| Sorted unique / range queries | `TreeSet` / `TreeMap` | red-black tree, O(log n), `floor`, `ceiling` |
| Key → value, fast | `HashMap` | O(1) average |
| Stack or queue | `ArrayDeque` | faster than `Stack` and `LinkedList` |
| Smallest/largest first | `PriorityQueue` | binary heap |
| Shared between threads | `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue` | thread-safe |

## 2.2 HashMap internals (the #1 question)

#### Theory: start here

**In one sentence:** A HashMap turns each key into a number (its hash), uses that number to pick a bucket in an array, and so finds values in about constant time.

Looking for a name in an unsorted list means checking every entry. A **hash table** avoids that. It calls `key.hashCode()` to get an int, squeezes it into an array index, and stores the entry in that **bucket**. To find the key later it computes the same index and looks only there. Like a library where a book's title tells you exactly which shelf it's on.

Two different keys can land in the same bucket (a **collision**), so each bucket holds a small linked list, which becomes a tree if it grows large. When the map gets too full, it doubles its array (**resize**) and redistributes entries.

**Key terms**

- **hashCode()**: An int summarising the key. Equal keys must return equal hash codes.
- **Bucket**: One slot of the internal array.
- **Collision**: Different keys mapping to the same bucket.
- **Load factor**: How full the map may get before resizing (0.75 by default).
- **Treeify**: Turning a long bucket list (8+) into a red-black tree.

**How it works**

1. `put(k, v)`: compute hash, spread its bits, index = hash & (capacity − 1).
2. Empty bucket → store the entry. Otherwise walk the bucket comparing with `equals`; replace the value if the key exists, else append.
3. If size exceeds capacity × 0.75, double the array and move entries.
4. `get(k)`: same index, then equals to find the exact entry.

**In real projects**

- Keys must have correct, consistent `equals` and `hashCode` (2.3). Records and Strings do.
- Pre-size big maps (`HashMap.newHashMap(n)`) to avoid repeated resizes.
- HashMap is not thread-safe; use ConcurrentHashMap for shared maps.

**Common mistakes**

- Mutable keys: changing a key after inserting it loses the entry.
- Relying on iteration order; HashMap has none.

#### Notes and pictures

**Idea:** an array of buckets. The key's hash picks the bucket; keys that collide share the bucket as a linked list, which becomes a red-black tree if it gets long.

```
 put("Pune", 7)
   1. h = "Pune".hashCode()           e.g. 2499329
   2. h = h ^ (h >>> 16)              mix high bits into low bits (fewer collisions)
   3. index = h & (n - 1)             n = 16 → index between 0 and 15  (n is always a power of 2)

 table (n = 16)
 ┌───┐
 │ 0 │ → null
 │ 1 │ → [Delhi,3] → [Goa,1]                 ← collision: linked list
 │ 2 │ → null
 │ 3 │ → [Pune,7]
 │...│
 │ 9 │ → (red-black tree)                    ← > 8 entries in one bucket (and n ≥ 64) → treeify: O(log n)
 │15 │ → null
 └───┘

 size > n × 0.75 (load factor)  →  resize to 2n and redistribute
   (each entry either stays at index i or moves to i + oldN; one extra bit of the hash decides)
```

```java
Map<String, Integer> m = new HashMap<>();
m.put("Pune", 7);
m.merge("Pune", 1, Integer::sum);       // 8   (count pattern)
m.getOrDefault("Goa", 0);               // 0
m.computeIfAbsent("Delhi", k -> 0);     // insert if missing
```

**get(key):** same hash → same bucket → walk the list comparing with `equals`.

**Gotchas:**
- One `null` key allowed (always bucket 0). `TreeMap` and `ConcurrentHashMap` reject null keys.
- Java 7 inserted at the head of the list and could loop forever during a concurrent resize; Java 8 inserts at the tail and adds trees.
- Average O(1), worst O(log n) in Java 8 (was O(n)).

**Say it:** "Array of buckets, index = spread hash & (n−1), collisions chained, treeified past 8, resized ×2 at 0.75 load. Lookup uses hashCode to find the bucket and equals to find the key."

## 2.3 equals and hashCode contract

#### Theory: start here

**In one sentence:** equals decides whether two objects mean the same thing; hashCode must agree with it, or hash-based collections break.

By default, `equals` asks "are these the very same object in memory?". For value-like classes (Money, Email, a composite key) you usually want "do these have the same contents?", so you override `equals`.

Hash collections first use `hashCode` to pick a bucket and only then call `equals`. If two equal objects return different hash codes, the set looks in the wrong bucket and never finds the match. Hence the rule: **override both together, using the same fields**.

**Key terms**

- **equals contract**: Reflexive, symmetric, transitive, consistent, and x.equals(null) is false.
- **hashCode contract**: Equal objects ⇒ equal hash codes. (Unequal objects may still collide.)
- **Value object**: An object identified by its contents, not its identity.

**How it works**

1. Choose the fields that define identity (e.g. id, or email).
2. Implement equals comparing exactly those fields.
3. Implement hashCode from the same fields (`Objects.hash(...)`).
4. Or use a `record`, which generates both correctly.

**In real projects**

- Make key classes immutable so their hash can't change while in a map.
- JPA entities need care: generated ids are null before persist.
- IDEs and records generate correct implementations; prefer them to hand-written ones.

**Common mistakes**

- Overriding equals but not hashCode.
- Mutating a field used in hashCode while the object is a key in a HashMap or HashSet.
- Adding a field to equals in a subclass, which breaks symmetry.

#### Notes and pictures

```
 Rule: a.equals(b)  ⇒  a.hashCode() == b.hashCode()      (the reverse is NOT required)

 Override only equals, not hashCode:
   key1 = new Emp(1)  hash 111 → bucket 5    put(key1, "A")
   key2 = new Emp(1)  hash 987 → bucket 2    get(key2) looks in bucket 2 → null ✘
                      (equal objects, different buckets)
```

```java
class Emp {
    final int id; final String name;
    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Emp e)) return false;
        return id == e.id && Objects.equals(name, e.name);
    }
    @Override public int hashCode() { return Objects.hash(id, name); }
}
```

**Gotcha:** never mutate a field used in `hashCode` while the object is a key: its bucket no longer matches and the entry is "lost".

## 2.4 HashSet, LinkedHashMap, TreeMap

#### Theory: start here

**In one sentence:** LinkedHashMap keeps entries in a predictable order (insertion or recent access), which makes an LRU cache trivial; TreeMap keeps keys sorted and answers "nearest key" questions.

A plain HashMap has no order. **LinkedHashMap** adds a doubly linked list through its entries, so it remembers the order they were inserted, or, with `accessOrder = true`, the order they were last used. That second mode gives you an **LRU (least recently used) cache**: the head of the list is the entry nobody has touched for longest, so evict it.

**TreeMap** stores keys in a balanced binary tree, always sorted. It can answer questions a hash table can't: "the highest price ≤ 25k" (floor), "the next appointment after 10:00" (ceiling), "all keys between A and B" (subMap).

**Key terms**

- **LRU**: Evict the entry that was used least recently.
- **removeEldestEntry**: Hook LinkedHashMap calls after each insert; return true to evict the head.
- **floor / ceiling**: Greatest key ≤ x / smallest key ≥ x.
- **Red-black tree**: Self-balancing tree giving O(log n) operations.

**How it works**

1. LRU: `new LinkedHashMap<>(cap, 0.75f, true)` moves each accessed entry to the tail.
2. Override `removeEldestEntry` to return `size() > cap`.
3. TreeMap: put/get/remove walk the tree in O(log n); the tree rebalances itself.
4. Navigation methods (floorKey, headMap, tailMap) use the sorted structure.

**In real projects**

- For production caches use Caffeine (thread-safe, size/time limits, stats); LinkedHashMap LRU is fine for single-threaded or small cases.
- TreeMap is great for time-based or price-range lookups.

**Common mistakes**

- Sharing a LinkedHashMap LRU across threads without a lock: even get() modifies it.
- A TreeMap comparator that returns 0 for different keys merges them into one entry.

#### Notes and pictures

```
 HashSet<E>        = HashMap<E, PRESENT>     (elements are keys; value is a dummy object)

 LinkedHashMap     = HashMap + doubly linked list through the entries
   head ⇄ [A] ⇄ [B] ⇄ [C] ⇄ tail
   insertion order (default)  or  access order (accessOrder = true → basis of an LRU cache)

 TreeMap (red-black tree, sorted by key)
              [50]
             /    \
          [30]    [70]
          /  \       \
       [20] [40]    [80]
   firstKey() = 20   floorKey(45) = 40   ceilingKey(45) = 50   headMap(50) = {20,30,40}
```

```java
TreeMap<Integer, String> slots = new TreeMap<>();
slots.floorEntry(time);    // latest slot at or before time: great for schedulers, intervals
```

## 2.5 ArrayList vs LinkedList

#### Theory: start here

**In one sentence:** ArrayList stores elements in one array (fast access by index); LinkedList chains separate nodes (fast only at a position you already hold). In practice ArrayList wins almost always.

**ArrayList** is like seats in a row: seat 500 is found instantly by arithmetic. Inserting in the middle means shifting everyone after it, but the CPU does that very quickly with one memory copy. When the array is full, it allocates a bigger one (about 1.5×) and copies.

**LinkedList** is like a treasure hunt where each clue points to the next: to reach item 500 you follow 500 pointers. Inserting is cheap only once you're already there. Each node also costs extra memory and is scattered around the heap, which is slow for CPU caches.

**Key terms**

- **Random access**: Getting element i directly: O(1) for arrays.
- **Amortised O(1)**: Occasionally expensive (resize), cheap on average.
- **Cache locality**: Data stored together is read much faster by the CPU.

**How it works**

1. ArrayList.get(i): direct index into the array.
2. ArrayList.add at the end: write into spare capacity; grow and copy when full.
3. ArrayList.add(i, x): shift the tail one place right (System.arraycopy).
4. LinkedList.get(i): walk from the nearer end, node by node.

**In real projects**

- Default to ArrayList. For queues and stacks, use ArrayDeque.
- If you know the size, pass it to the constructor to avoid resizes.

**Common mistakes**

- Choosing LinkedList for "frequent inserts" without measuring.
- Calling `remove(0)` repeatedly on a big ArrayList (O(n²) overall); use a deque.

#### Notes and pictures

```
 ArrayList: one contiguous array
 ┌───┬───┬───┬───┬───┬───┬───┬───┐
 │ A │ B │ C │ D │ E │   │   │   │   capacity 8, size 5
 └───┴───┴───┴───┴───┴───┴───┴───┘
   get(3)    → O(1) direct jump
   add(end)  → amortised O(1); when full, copy to a new array 1.5× bigger
   add(1, X) → shift B..E right → O(n)

 LinkedList: nodes scattered in memory
 head ⇄ [A] ⇄ [B] ⇄ [C] ⇄ [D] ⇄ tail
   get(3) → walk 3 nodes → O(n)
   add/remove at a node you already hold → O(1)
   each node has 2 extra pointers; poor CPU cache use
```

**Say it:** "ArrayList almost always wins: O(1) access and cache-friendly. LinkedList only helps when you insert/remove at an iterator position a lot. For queues use ArrayDeque."

## 2.6 Fail-fast vs fail-safe iterators

#### Theory: start here

**In one sentence:** Most collection iterators detect if the collection is changed behind their back and throw ConcurrentModificationException, to avoid silently returning wrong results.

A for-each loop uses an **Iterator** under the hood. If you add or remove elements from the list directly while iterating, the iterator's position no longer matches the data. To catch this bug early, collections keep a counter, `modCount`, that increases on every structural change. The iterator remembers the value it started with and checks it on each `next()`. A mismatch throws **ConcurrentModificationException** (despite the name, it usually happens on a single thread).

**Key terms**

- **Iterator**: Object that walks a collection: hasNext(), next(), remove().
- **modCount**: Counter of structural modifications.
- **Fail-fast**: Throw as soon as a concurrent change is detected (best-effort, not guaranteed).
- **Weakly consistent**: Concurrent collections' iterators: never throw, may or may not show recent changes.

**How it works**

1. The for-each loop creates an iterator with expectedModCount = modCount.
2. `list.remove(x)` inside the loop increments modCount.
3. The next `next()` sees the mismatch and throws.
4. `iterator.remove()` updates both counters, so it's safe.

**In real projects**

- Remove with `list.removeIf(predicate)` or an explicit `Iterator.remove()`.
- Or collect results into a new list instead of modifying while iterating.

**Common mistakes**

- Catching ConcurrentModificationException instead of fixing the loop.
- Assuming fail-fast always triggers; removing the second-to-last element skips the last one silently.

#### Notes and pictures

```
 ArrayList keeps modCount (count of structural changes).
 iterator() remembers expectedModCount = modCount.
 Each next(): if (modCount != expectedModCount) throw ConcurrentModificationException

   for (String s : list)          modCount 3, expected 3
       list.remove(s);  ────────► modCount 4
   next()  ────────────────────►  4 != 3  → CME ✘
```

```java
list.removeIf(s -> s.startsWith("x"));                    // ✔ safe
Iterator<String> it = list.iterator();
while (it.hasNext()) if (bad(it.next())) it.remove();     // ✔ safe
```

Fail-safe / weakly consistent: `ConcurrentHashMap` (no exception, may or may not see new changes), `CopyOnWriteArrayList` (iterates a snapshot).

## 2.7 Comparable vs Comparator

#### Theory: start here

**In one sentence:** Sorting needs a rule for "which comes first". Comparable puts one natural rule inside the class; a Comparator is a separate rule you can pass in.

Sorting numbers is obvious; sorting Cars isn't. By price? By year? A class can implement **Comparable** to define its one *natural* order (`compareTo`), the way Strings sort alphabetically. When you need other orders, you write a **Comparator**, an external rule like "by price, highest first, then by id", and pass it to `sort`, a TreeMap, or a PriorityQueue.

A compare method returns a negative number if a comes first, zero if they're equal in this ordering, and positive if b comes first.

**Key terms**

- **Comparable&lt;T>**: compareTo(other) inside the class: the natural order.
- **Comparator&lt;T>**: compare(a, b) outside the class: any order.
- **Stable sort**: Equal elements keep their original relative order (Java's object sort is stable).

**How it works**

1. Build comparators fluently: `Comparator.comparing(Car::price).reversed().thenComparing(Car::id)`.
2. Use `Integer.compare(a, b)` rather than `a - b`.
3. Pass the comparator to `list.sort(...)`, `new TreeMap<>(cmp)`, etc.

**In real projects**

- Add a unique tie-breaker (like id) when using comparators in TreeSet/TreeMap, or equal-ranked items will be treated as duplicates.
- Keep compareTo consistent with equals where possible.

**Common mistakes**

- `return a.price - b.price;`: overflow for large values.
- Comparators that aren't transitive, which can make sorting throw.

#### Notes and pictures

```
 Comparable  → order lives INSIDE the class     class Car implements Comparable<Car>   (one natural order)
 Comparator  → order lives OUTSIDE the class    many orders, chosen by the caller
```

```java
class Car implements Comparable<Car> {
    public int compareTo(Car o) { return Long.compare(price, o.price); }   // natural: by price
}
cars.sort(Comparator.comparing(Car::city)
          .thenComparing(Car::price, Comparator.reverseOrder()));        // city A→Z, then price high→low
```

**Gotcha:** `(a, b) -> a - b` can overflow for large or negative ints; use `Integer.compare(a, b)`.

## 2.8 PriorityQueue (heap)

#### Theory: start here

**In one sentence:** A PriorityQueue always hands you the smallest (or highest-priority) element next, using a binary heap stored in an array.

Sometimes you don't need everything sorted; you just need "the next most important item", again and again: the next task by deadline, the cheapest route so far, the highest bid. A **heap** does exactly that cheaply. It's a tree where every parent is smaller than its children, so the root is always the minimum. It's stored compactly in an array: the children of index i are at 2i+1 and 2i+2.

**Key terms**

- **Min-heap**: Parent ≤ children; root is the smallest.
- **Sift up / sift down**: Moving an element up or down to restore heap order.
- **peek / poll / offer**: Look at the top / remove the top / add an element.

**How it works**

1. `offer(x)`: put x at the end of the array, then swap it upward while it's smaller than its parent.
2. `poll()`: take the root, move the last element to the root, swap it downward with its smaller child.
3. Both take O(log n); `peek()` is O(1).

**In real projects**

- Max-heap: `new PriorityQueue<>(Comparator.reverseOrder())`.
- Top-K largest of a big stream: keep a min-heap of size K and evict the smallest.
- Scheduling, Dijkstra's shortest path and merging sorted streams all use heaps.

**Common mistakes**

- Expecting `toString()` or iteration to be sorted.
- Changing an element's priority while it's in the queue; remove and re-add it instead.

#### Notes and pictures

```
 Min-heap stored in an array: parent at i, children at 2i+1 and 2i+2
            [1]
          /     \
        [3]     [2]
       /   \
     [7]   [4]          array: [1, 3, 2, 7, 4]
   peek() = 1  O(1)     offer() / poll() = O(log n) (sift up / sift down)
```

```java
PriorityQueue<Integer> min = new PriorityQueue<>();
PriorityQueue<Integer> max = new PriorityQueue<>(Comparator.reverseOrder());
PriorityQueue<int[]> byDist = new PriorityQueue<>((a, b) -> Integer.compare(a[1], b[1]));
```

**Gotcha:** iterating or printing a PriorityQueue is NOT sorted; only repeated `poll()` gives sorted order.

## 2.9 Immutable vs fixed-size vs view lists

#### Theory: start here

**In one sentence:** Java has several kinds of "read-only" lists that behave very differently: fixed-size views, unmodifiable views, and truly immutable copies.

`Arrays.asList(array)` gives a **fixed-size view** over an array: you can `set` elements (which writes to the array) but not add or remove. `Collections.unmodifiableList(list)` gives a **read-only view**: you can't change it through the view, but if someone changes the original list, the view shows it. `List.of(...)` and `List.copyOf(...)` give a **truly immutable** list that nothing can ever change.

Analogy: a view is a window onto someone else's room; an immutable copy is a photograph.

**Key terms**

- **View**: An object that presents another collection's data without copying it.
- **Unmodifiable**: Can't be changed through this reference.
- **Immutable**: Can't be changed by anyone, ever.
- **UnsupportedOperationException**: Thrown when you call a modifying method a collection doesn't support.

**How it works**

1. Arrays.asList: backed by the array, fixed size, allows nulls.
2. unmodifiableList: wraps the list; mutators throw; still reflects source changes.
3. List.of / copyOf: own storage, all mutators throw, nulls rejected.

**In real projects**

- Return `List.copyOf(internal)` from getters to keep internals safe.
- Use `new ArrayList<>(Arrays.asList(...))` if you need a growable list.

**Common mistakes**

- Assuming unmodifiableList is a snapshot.
- Putting null into List.of, or calling `contains(null)` on it (both throw).

#### Notes and pictures

| | add/remove | set | nulls | reflects source changes |
|---|---|---|---|---|
| `List.of(...)` | ✘ | ✘ | ✘ | no source |
| `Arrays.asList(arr)` | ✘ | ✔ | ✔ | yes (backed by the array) |
| `Collections.unmodifiableList(l)` | ✘ | ✘ | ✔ | yes (a read-only view) |
| `List.copyOf(l)` | ✘ | ✘ | ✘ | no (a copy) |

## 2.10 Generics and type erasure

#### Theory: start here

**In one sentence:** Generics let you write one class or method that works with many types while the compiler checks you don't mix them up; at run time the type information is erased.

Before generics, a List held plain Objects and you cast everything coming out, so mistakes appeared at run time. With `List<String>` the compiler knows what the list holds, rejects `add(42)`, and inserts the casts for you.

Java implements generics by **erasure**: after checking, the compiler removes the type arguments, so at run time a `List<String>` is just a List. That's why you can't do `new T()` or `instanceof List<String>`.

**Wildcards** make APIs flexible. `? extends Number` means "some list of a Number subtype: I'll read from it". `? super Integer` means "a list that can hold Integers: I'll write into it". Remember **PECS**: Producer Extends, Consumer Super.

**Key terms**

- **Type parameter**: A placeholder like T in class Box&lt;T>.
- **Erasure**: Generic types are removed after compilation; casts are inserted.
- **Invariance**: List&lt;Integer> is not a List&lt;Number>.
- **Wildcard**: ? extends X (read), ? super X (write), ? (unknown).
- **Raw type**: Using List without &lt;…>; disables checks.

**How it works**

1. You declare `class Box<T> { T value; }`.
2. The compiler checks every use (`Box<String>` only takes Strings).
3. It erases T to Object (or its bound) and adds casts where values come out.
4. Wildcards let a method accept a family of related generic types safely.

**In real projects**

- Use generics in your own utilities and APIs: `Result<T>`, `Page<T>`.
- Collections.copy, addAll and similar library methods use PECS in their signatures.

**Common mistakes**

- Raw types, which compile with warnings and fail later with ClassCastException.
- Expecting `List<Dog>` to be passable as `List<Animal>`.

#### Notes and pictures

**Idea:** catch type errors at compile time; the types are erased in the bytecode.

```
 Source:   List<String> names = new ArrayList<>();   String s = names.get(0);
 Bytecode: List names = new ArrayList();             String s = (String) names.get(0);
                                                      ▲ the compiler inserts the cast
```

So at run time you can't do `new T()`, `new T[]`, `x instanceof List<String>`, or overload `f(List<String>)` with `f(List<Integer>)` (same erased signature).

**PECS: Producer Extends, Consumer Super**

```
       Object
         ▲
       Number          List<? extends Number>  → you READ Numbers from it (a producer); can't add
       ▲    ▲
  Integer  Double      List<? super Integer>   → you WRITE Integers into it (a consumer); reads give Object
```

```java
double sum(List<? extends Number> xs) { double s = 0; for (Number n : xs) s += n.doubleValue(); return s; }
void fill(List<? super Integer> out)  { out.add(1); out.add(2); }
// sum(List<Integer>) ✔  sum(List<Double>) ✔   fill(List<Number>) ✔  fill(List<Object>) ✔
```

## 2.11 Exceptions

#### Theory: start here

**In one sentence:** Exceptions move control from where a problem happens to the code that can handle it; finally and try-with-resources make sure cleanup always runs.

When something goes wrong (a file is missing, input is invalid), the code that notices often can't decide what to do. It **throws** an exception, and Java unwinds the call stack until it finds a matching **catch**. A **finally** block runs whether or not an exception happened, which is ideal for cleanup.

**Checked** exceptions (like IOException) must be declared or caught, so the compiler forces you to think about them. **Unchecked** ones (RuntimeException and its subclasses, like NullPointerException) usually mean a programming bug or an unrecoverable condition.

**try-with-resources** (`try (var in = open()) { … }`) closes resources automatically, in reverse order, even if the body throws.

**Key terms**

- **throw / throws**: Raise an exception / declare that a method may raise it.
- **Checked exception**: Subclass of Exception (not RuntimeException); must be handled or declared.
- **Unchecked exception**: RuntimeException or Error; not enforced by the compiler.
- **Suppressed exception**: A close() failure attached to the main exception in try-with-resources.
- **Cause**: The original exception wrapped inside a new one.

**How it works**

1. An exception is thrown; the rest of the try block is skipped.
2. Java looks for a catch matching the exception type, in this method and then up the call stack.
3. finally blocks run on the way out, whether it was caught or not.
4. If nothing catches it, the thread ends and the stack trace is printed.

**In real projects**

- Catch where you can actually handle it (retry, fallback, translate to an HTTP status), not everywhere.
- When wrapping, keep the cause: `throw new ServiceException("msg", e)`.
- Always use try-with-resources for streams, connections, locks you wrap.

**Common mistakes**

- Empty catch blocks that hide failures.
- return or throw inside finally, which swallows the real exception.
- Catching Exception (or Throwable) broadly and continuing as if nothing happened.

#### Notes and pictures

```
                    Throwable
                 ┌──────┴──────────┐
               Error           Exception
       (OutOfMemoryError,    ┌──────┴────────────────┐
        StackOverflowError)  checked              RuntimeException (unchecked)
        don't catch          IOException,          NullPointerException,
                             SQLException          IllegalArgumentException,
                             must catch/declare    IndexOutOfBounds...  (programmer bugs)
```

**try / catch / finally flow:**

```
 try {  ──── exception? ──yes──► matching catch ──┐
   ...  │                                          ├──► finally (ALWAYS runs) ──► continue / rethrow
 }      └──── no ──────────────────────────────────┘
        (only System.exit() or a JVM crash skips finally)
```

```java
try (var in = new FileInputStream(f); var out = new FileOutputStream(g)) {   // try-with-resources
    in.transferTo(out);
}   // closes out, then in (reverse order), even if an exception is thrown
catch (IOException e) {
    throw new UploadException("copy failed for " + f, e);   // wrap WITH the cause
}
```

**Gotchas:** `return` in `finally` overrides the try's return and swallows exceptions. Catch the specific exception; never an empty `catch {}`. Spring's `@Transactional` rolls back only on unchecked exceptions by default.

## 2.12 Lambdas and functional interfaces

#### Theory: start here

**In one sentence:** A lambda is a short anonymous function you can pass around as a value; a method reference is an even shorter way to point at an existing method.

Many APIs need "a piece of behaviour": how to compare two items, what to do with each element, how to create something. Before Java 8 you wrote an anonymous class for that. A **lambda** (`(a, b) -> a.price() - b.price()`) expresses just the logic.

A lambda can be used wherever a **functional interface** is expected: an interface with exactly one abstract method, like `Comparator`, `Runnable` or `Function`. A **method reference** (`String::length`, `System.out::println`) is shorthand for a lambda that just calls one method.

**Key terms**

- **Functional interface**: An interface with one abstract method (Function, Predicate, Supplier, Consumer…).
- **Capture**: A lambda using a local variable from the enclosing method.
- **Effectively final**: A local that's never reassigned, which lambdas are allowed to capture.
- **Method reference**: Class::staticMethod, obj::method, Class::instanceMethod, Class::new.

**How it works**

1. The compiler checks the lambda's shape matches the interface's single method.
2. Captured locals are copied into the lambda, which is why they must not change.
3. `this` inside a lambda means the enclosing object (unlike an anonymous class).
4. At run time the JVM creates the lambda object via invokedynamic, often reusing one instance.

**In real projects**

- Use lambdas with streams, Optional, CompletableFuture, comparators and callbacks.
- Keep lambdas short; move complex logic into a named method and use a method reference.

**Common mistakes**

- Trying to modify a captured local (`count++`) inside a lambda.
- Long, multi-line lambdas that hide business logic.

#### Notes and pictures

**Idea:** a lambda is a short implementation of an interface with exactly ONE abstract method.

```
 Before Java 8:                                   Java 8:
 Comparator<Car> c = new Comparator<Car>() {      Comparator<Car> c = (a, b) -> Long.compare(a.price, b.price);
   public int compare(Car a, Car b) {             Comparator<Car> c = Comparator.comparingLong(Car::price);
     return Long.compare(a.price, b.price);                                         ▲ method reference
   }
 };
```

| Interface | Shape | Example |
|---|---|---|
| `Function<T,R>` | T → R | `s -> s.length()` |
| `Predicate<T>` | T → boolean | `c -> c.price > 5` |
| `Consumer<T>` | T → void | `System.out::println` |
| `Supplier<T>` | () → T | `ArrayList::new` |
| `BiFunction<T,U,R>` | (T,U) → R | `(a, b) -> a + b` |
| `UnaryOperator<T>` | T → T | `String::toUpperCase` |

**Gotcha:** local variables used inside a lambda must be effectively final.

## 2.13 Streams: a lazy pipeline

#### Theory: start here

**In one sentence:** A Stream is a pipeline for processing a sequence of elements declaratively (filter, map, collect), and it does no work until you ask for a result.

Instead of writing loops with temporary lists, you describe *what* you want: "from these orders, keep the paid ones, take their totals, sum them". `orders.stream().filter(Order::isPaid).mapToLong(Order::total).sum()`.

Streams are **lazy**: `filter` and `map` only build the pipeline. Nothing runs until a **terminal operation** like `collect`, `sum`, `findFirst` or `forEach`. Then elements flow through one at a time, like items on an assembly line, and operations like `findFirst` can stop early.

**Key terms**

- **Source**: Where elements come from: a collection, array, file lines, a generator.
- **Intermediate operation**: filter, map, sorted…: returns a new stream, lazy.
- **Terminal operation**: collect, count, forEach, reduce…: triggers processing.
- **Short-circuiting**: findFirst, anyMatch, limit: may stop before reading everything.
- **Stateful operation**: sorted, distinct: must see many or all elements before emitting.

**How it works**

1. Build the pipeline: source → zero or more intermediate operations → one terminal operation.
2. The terminal operation pulls elements through the pipeline one by one.
3. Short-circuiting operations stop pulling once they have their answer.
4. A stream can be consumed only once.

**In real projects**

- Great for transformations and aggregations: grouping (`Collectors.groupingBy`), summing, mapping to DTOs.
- Parallel streams use the shared ForkJoin common pool: only for CPU-heavy work on large data, never for I/O.

**Common mistakes**

- Side effects inside map/filter (e.g. adding to an external list).
- Reusing a stream after a terminal operation.
- Using streams where a simple loop is clearer.

#### Notes and pictures

```
 source ──► filter ──► map ──► sorted ──► limit ──► collect
            └──────── intermediate (lazy, return a Stream) ────┘   terminal (triggers everything)

 Laziness: nothing runs until the terminal op. Elements flow ONE AT A TIME (except sorted, which must see all):
   source.filter(...).map(...).limit(2).collect(...)
   c1 ─filter✘
   c2 ─filter✔─map─► collected
   c3 ─filter✔─map─► collected   ← limit(2) reached: c4, c5 are never touched
```

```java
Map<String, Double> avgByCity = cars.stream()
    .filter(c -> !c.sold())
    .collect(Collectors.groupingBy(Car::city, Collectors.averagingLong(Car::price)));

List<String> top3 = cars.stream()
    .sorted(Comparator.comparingLong(Car::price).reversed())
    .limit(3).map(Car::name).toList();
```

**map vs flatMap:**

```
 map:      [ [a,b], [c] ]  ─map(List::size)───────►  [2, 1]
 flatMap:  [ [a,b], [c] ]  ─flatMap(List::stream)─►  [a, b, c]
```

**Gotchas:** a stream can be consumed only once. Parallel streams use the shared `ForkJoinPool.commonPool()`: avoid them for I/O, small data, or shared mutable state.

## 2.14 Optional, records, sealed, pattern matching

#### Theory: start here

**In one sentence:** Modern Java (8–21) added tools that make intent explicit: Optional for "maybe no value", records for data classes, sealed types and pattern matching for closed sets of cases.

**Optional&lt;T>** is a box that's either empty or holds one value. A method returning Optional says "there may be no result", so callers handle that case instead of getting a surprise null.

**Records** (`record Money(long cents, String ccy) {}`) are compact immutable data classes: constructor, accessors, equals, hashCode and toString are generated.

**Sealed** interfaces list exactly which classes may implement them. Combined with **pattern matching** in `switch`, the compiler can check you handled every case.

**Key terms**

- **Optional**: Container for zero or one value; use map, orElse, orElseGet, orElseThrow.
- **Record**: Immutable data carrier with generated boilerplate.
- **Compact constructor**: Record constructor without parameters list, for validation.
- **Sealed / permits**: Restricts which classes can extend a type.
- **Pattern matching**: instanceof and switch that test a type and bind a variable at once.

**How it works**

1. Return `Optional.ofNullable(x)`; callers use `.map(...).orElse(default)`.
2. Declare a record; validate inputs in its compact constructor.
3. Declare `sealed interface Shape permits Circle, Square`.
4. `switch (shape) { case Circle c -> …; case Square s -> …; }` needs no default, and fails to compile if a case is missing.

**In real projects**

- Use Optional for return values, not for fields or parameters.
- Records are perfect for DTOs, events, value objects and composite keys.
- Sealed types fit domain states and results (Success / Failure).

**Common mistakes**

- `optional.get()` without checking: use orElseThrow with a clear message.
- `orElse(expensiveCall())`: it runs even when a value is present; use orElseGet.

#### Notes and pictures

```java
// Optional: a box that may be empty, for return types
Optional<Car> car = repo.findById(id);
String city = car.map(Car::city).orElse("unknown");
Car c = car.orElseThrow(() -> new NotFound(id));
// ✘ don't: car.get() without checking; Optional fields or parameters

// Record (16): immutable data class; constructor, accessors, equals, hashCode, toString generated
record Point(int x, int y) {}

// Sealed (17) + switch pattern matching (21): the compiler checks every case is handled
sealed interface Payment permits Upi, Card {}
record Upi(String vpa) implements Payment {}
record Card(String last4) implements Payment {}
String describe(Payment p) {
    return switch (p) {
        case Upi u  -> "UPI " + u.vpa();
        case Card c -> "Card " + c.last4();
    };
}
```

**Java versions to name:** 8 (lambdas, streams, Optional, CompletableFuture), 11 (HTTP client, `var` in lambdas), 17 (records, sealed, text blocks), 21 (virtual threads, switch patterns).

---

# Part 3: OOP, SOLID, design patterns

## 3.1 The four pillars

#### Theory: start here

**In one sentence:** Object-oriented programming bundles data with the code that uses it; the four pillars are encapsulation, abstraction, inheritance and polymorphism.

Instead of passing raw data to separate functions, OOP builds **objects** that hold their own data (fields) and know how to work with it (methods). An `Account` knows its balance and how to withdraw safely.

- **Encapsulation**: hide the data and expose only safe operations, so nobody can set a negative balance directly.
- **Abstraction**: callers depend on *what* something does (an interface), not *how*.
- **Inheritance**: a class can extend another and reuse or specialise its behaviour.
- **Polymorphism**: one call, `v.describe()`, does the right thing for whatever object v really is.

The mechanism behind polymorphism is **dynamic dispatch**: at run time the JVM looks at the object's actual class to choose which method to run.

**Key terms**

- **Class / object**: Blueprint / one instance built from it.
- **Interface**: A contract: a list of methods a class promises to provide.
- **Override**: A subclass providing its own version of an inherited method.
- **Dynamic dispatch**: Choosing the method at run time from the object's real class (via a vtable).

**How it works**

1. `Vehicle v = new Car();`: the variable's type is Vehicle, the object is a Car.
2. `v.describe()` compiles because Vehicle declares describe().
3. At run time the JVM looks up describe() in Car's method table and runs Car's version.
4. Calls from inside Vehicle to overridable methods (this.wheels()) also go to Car's versions.

**In real projects**

- Program to interfaces (`PaymentGateway`), so implementations can be swapped and mocked.
- Keep fields private; expose behaviour, not setters for everything.

**Common mistakes**

- Getter and setter for every field ("anaemic" objects with no behaviour).
- Deep inheritance trees where behaviour is hard to follow.

#### Notes and pictures

```
 ┌────────────────┬────────────────────┬───────────────────┬─────────────────────┐
 │ ENCAPSULATION  │ ABSTRACTION        │ INHERITANCE       │ POLYMORPHISM        │
 │ hide the data, │ show WHAT,         │ reuse a parent    │ one call, many      │
 │ guard the rules│ hide HOW           │ (is-a)            │ behaviours          │
 │ private fields │ interface /        │ extends /         │ overriding (run     │
 │ + methods      │ abstract class     │ implements        │ time), overloading  │
 │                │                    │                   │ (compile time)      │
 └────────────────┴────────────────────┴───────────────────┴─────────────────────┘
```

**Encapsulation:** nobody can put the object into an invalid state.

```java
class Account {
    private long balance;                       // hidden
    void withdraw(long amt) {
        if (amt > balance) throw new IllegalStateException("insufficient");   // rule enforced
        balance -= amt;
    }
}
// acc.balance = -100;   ✘ won't compile
```

**Abstraction:** callers depend on the "what".

```
  CheckoutService ──calls──► «interface» PaymentGateway.charge(amt)
                                   ▲                 ▲
                           RazorpayGateway     PayUGateway      ← "how" hidden behind the interface
```

**Inheritance + polymorphism:**

```
             Vehicle
            + wheels()
           ▲         ▲
        Car           Bike
   wheels()=4      wheels()=2

 List<Vehicle> vs = List.of(new Car(), new Bike());
 for (Vehicle v : vs) v.wheels();     // 4, 2  ← same call, the actual object decides
```

**Encapsulation vs abstraction (asked often):** encapsulation protects data and invariants (a mechanism: `private`). Abstraction exposes only what the caller needs (a design idea: interfaces).

## 3.2 Overloading vs overriding

#### Theory: start here

**In one sentence:** Overloading is several methods with the same name but different parameters, picked by the compiler; overriding is a subclass replacing a parent's method, picked at run time.

**Overloading** is a convenience: `print(int)`, `print(String)`, `print(Object)`. The **compiler** chooses one based on the *declared* types of the arguments. It never looks at the actual objects at run time.

**Overriding** is polymorphism: `Car` redefines `Vehicle.describe()`. The **JVM** chooses at run time based on the actual object.

**Key terms**

- **Signature**: Method name plus parameter types.
- **Overload resolution**: Compiler tries exact/widening matches, then boxing, then varargs.
- **Covariant return**: An override may return a subtype of the original return type.
- **Hiding**: Static methods with the same signature in a subclass hide, not override.

**How it works**

1. Compile time: collect methods with that name, pick the most specific match for the static argument types.
2. Run time: for an instance method, find the override in the object's class.
3. Static methods and private methods never use run-time dispatch.

**In real projects**

- Add `@Override` on every override: the compiler then catches typos that would silently create an overload.
- Avoid overloads that differ only by boxed vs primitive or by null-friendly types; they confuse callers.

**Common mistakes**

- Expecting an overload to be chosen by the run-time type of an argument.
- Override rules: you can't reduce visibility or throw broader checked exceptions.

#### Notes and pictures

```
 OVERLOADING (compile time)                 OVERRIDING (run time)
 same class, same name,                     subclass, SAME signature,
 DIFFERENT parameters                       new behaviour

 class Printer {                            class Animal { String sound() { return "..."; } }
   void print(int x)    {...}               class Dog extends Animal {
   void print(String s) {...}                 @Override String sound() { return "Woof"; }
 }                                          }
 compiler picks by argument types           JVM picks by the actual object (dynamic dispatch)
```

| | Overloading | Overriding |
|---|---|---|
| Decided | compile time | run time |
| Return type | can differ | same or a subtype (covariant) |
| Access | any | same or wider |
| Checked exceptions | any | no new or broader ones |
| static / private / final | can be overloaded | can NOT be overridden |

**Static methods are hidden, not overridden:**

```java
class Vehicle { String name() { return "vehicle"; } static String kind() { return "V"; } }
class Car extends Vehicle { String name() { return "car"; } static String kind() { return "C"; } }

Vehicle v = new Car();
v.name();   // "car" ← object decides (overriding)
v.kind();   // "V"   ← reference type decides (hiding)
```

**Upcast / downcast:**

```
 Vehicle v = new Car();     upcast: implicit, always safe
 Car c = (Car) v;           downcast: explicit; ClassCastException if v isn't really a Car
 if (v instanceof Car car)  safe check + cast in one step (Java 16)
```

## 3.3 Constructors and initialisation order

#### Theory: start here

**In one sentence:** Creating an object runs code in a fixed order: static setup once per class, then for each object the parent's fields and constructor before the child's.

When you write `new Child()`, a lot happens. First, if the classes haven't been initialised yet, their **static** initialisers run, parent first, then child, exactly once. Then the object's memory is allocated with every field zeroed (0, false, null). Then construction runs from the top of the hierarchy down: parent field initialisers, parent constructor body, child field initialisers, child constructor body.

A child is built like a house: foundation (parent) first, then the upper floors (child).

**Key terms**

- **Static initialiser**: static { … } and static field initialisers; run once per class.
- **Instance initialiser**: Field initialisers and { … } blocks; run for every object, after super().
- **super(...)**: Call to the parent constructor; always first, implicit if omitted.

**How it works**

1. Load and initialise Parent's statics, then Child's statics (first use only).
2. Allocate the object; all fields have default values.
3. Child's constructor calls super(); Parent's field initialisers and constructor body run.
4. Back in Child: its field initialisers run, then the rest of its constructor body.

**In real projects**

- Keep constructors simple: assign fields, validate, nothing more.
- Use static factories or builders when construction logic grows.

**Common mistakes**

- Calling an overridable method from a constructor: it runs in the child before the child's fields are set.
- Letting `this` escape from a constructor (registering a listener, starting a thread).

#### Notes and pictures

```
 new Child()
   │
   ├─ (first time only) Parent static block → Child static block
   │
   ├─ Parent field initialisers → Parent constructor     ← super() is always called first
   └─ Child field initialisers  → Child constructor
```

```java
class Parent { static { print("P-static"); }  Parent() { print("P-ctor"); } }
class Child extends Parent { static { print("C-static"); }  Child() { print("C-ctor"); } }
new Child(); new Child();
// P-static, C-static, P-ctor, C-ctor, P-ctor, C-ctor
```

**Gotcha:** never call an overridable method from a constructor: the child's override runs before the child's fields are set.

## 3.4 Inheritance vs composition

#### Theory: start here

**In one sentence:** Inheritance ("is-a") reuses a parent's code but couples you to its internals; composition ("has-a") builds behaviour by holding other objects, and is usually more flexible.

Inheritance looks like free reuse: extend `HashSet`, override `add`, done. But your subclass now depends on *how* the parent works internally, like which of its methods call which. If HashSet's `addAll` internally calls `add`, your counting is doubled. This is the **fragile base class** problem.

With **composition** your class *has* a Set field and forwards calls to it, adding its own behaviour around them. It depends only on the Set's public contract, and the inner object can be swapped, even for a fake in tests.

**Key terms**

- **is-a**: Inheritance relationship (Car is a Vehicle).
- **has-a**: Composition relationship (Car has an Engine).
- **Forwarding**: Passing a call on to a wrapped object.
- **Fragile base class**: Changes in a parent's internals breaking subclasses.

**How it works**

1. Ask "is it truly a subtype that can be used anywhere the parent is?" If not, compose.
2. Hold the collaborator in a private final field, injected through the constructor.
3. Implement the same interface and forward calls, adding behaviour where needed.

**In real projects**

- Spring services are composition: a service holds repositories and clients, injected by constructor.
- Use inheritance for genuine type hierarchies and frameworks designed for it (with documented hooks).

**Common mistakes**

- Extending a concrete library class to tweak one method.
- Creating a subclass for every combination of features (class explosion); compose features instead.

#### Notes and pictures

```
 INHERITANCE (is-a) explodes:            COMPOSITION (has-a) combines:
        Notifier                          Notifier
      ▲    ▲     ▲                        ├── has a Channel     (SMS | Email | Push)
   Sms  Email  Push                       └── has a RetryPolicy (Fixed | Exponential)
    ▲     ▲      ▲
 SmsRetry EmailRetry PushRetry ...        3 + 2 small classes cover all 6 combinations,
 (one class per combination)              swappable at run time, easy to mock
```

```java
class Notifier {
    private final Channel channel; private final RetryPolicy retry;
    Notifier(Channel c, RetryPolicy r) { channel = c; retry = r; }
    void send(Message m) { retry.run(() -> channel.deliver(m)); }
}
```

**Say it:** "Prefer composition: inheritance ties the child to the parent's internals (the fragile base class problem) and Java allows only one parent. Use inheritance only for a true is-a that passes Liskov."

**Association, aggregation, composition:**

```
 Association   Dealer ─── Auction         know each other
 Aggregation   Showroom ◇── Car           has-a; the Car lives on without the Showroom
 Composition   Car ◆── Engine             has-a; the Engine's life is owned by the Car
```

**Why no multiple class inheritance?** The diamond problem:

```
        A.hello()
       ▲        ▲
   B.hello()  C.hello()
       ▲        ▲
         D          → D.hello() = B's or C's?   Classes: not allowed.
 Interfaces with the same default method: D must override and can pick with B.super.hello().
```

## 3.5 Abstract class vs interface

#### Theory: start here

**In one sentence:** An interface describes what a type can do; an abstract class is a partial implementation that can hold shared state. Since Java 8 interfaces can have default methods, which brings rules for conflicts.

An **interface** is a contract: "anything that is `Comparable` has compareTo". A class can implement many interfaces. Interfaces can't hold instance fields.

An **abstract class** can't be instantiated; it provides shared fields and some implemented methods, leaving others abstract for subclasses. A class can extend only one.

**Default methods** let interfaces ship method bodies. If two interfaces give a class the same default method, Java needs rules to resolve the conflict.

**Key terms**

- **Abstract method**: Declared without a body; subclasses must implement it.
- **Default method**: An interface method with a body.
- **X.super.m()**: Syntax to call a specific interface's default implementation.

**How it works**

1. Rule 1: a method from a class (or superclass) beats any interface default.
2. Rule 2: a more specific interface (one that extends the other) wins.
3. Rule 3: otherwise the class must override the method and may call `A.super.m()`.

**In real projects**

- Prefer interfaces for public contracts; use abstract classes for shared skeletons inside a module.
- Default methods are mainly for evolving interfaces without breaking implementations.

**Common mistakes**

- Putting mutable shared state in constants on interfaces.
- Using abstract classes where an interface plus composition would do.

#### Notes and pictures

```
 Interface = a CAPABILITY ("can do")          Abstract class = a PARTIAL BASE ("is a kind of")
 - many per class                             - one per class
 - no instance state                          - fields, constructors
 - default + static methods (Java 8)          - shared code + abstract steps
 e.g. Comparable, Runnable, PaymentGateway    e.g. AbstractReportGenerator (template method)
```

## 3.6 SOLID, each with a picture

#### Theory: start here

**In one sentence:** SOLID is five design principles that keep code easy to change: single responsibility, open/closed, Liskov substitution, interface segregation and dependency inversion.

- **S – Single responsibility**: a class should have one reason to change. Pricing logic and PDF generation don't belong together.
- **O – Open/Closed**: add new behaviour by adding code (a new class), not by editing a growing if/switch.
- **L – Liskov substitution**: a subclass must work anywhere its parent is expected, without surprises.
- **I – Interface segregation**: many small, focused interfaces beat one big one that forces classes to implement methods they can't support.
- **D – Dependency inversion**: high-level code depends on abstractions (interfaces), and the concrete classes are plugged in from outside.

They aren't laws; they're warning lights. When a change ripples through many files, one of them is usually being broken.

**Key terms**

- **Responsibility**: A reason for a class to change (a business rule, a format, a storage).
- **Abstraction**: An interface that hides which implementation is used.
- **Dependency injection**: Passing collaborators in, usually through the constructor.

**How it works**

1. Spot the smell: a class that changes for unrelated reasons, a switch that grows, an override that throws, an interface with unused methods, a `new ConcreteThing()` deep in business code.
2. Apply the matching fix: split the class, introduce a strategy interface, rethink the hierarchy, split the interface, inject the dependency.

**In real projects**

- Spring's DI is dependency inversion in practice.
- A list of rule beans injected into a service is open/closed: new rule = new bean.

**Common mistakes**

- Applying every principle everywhere, which creates needless layers.
- Square extends Rectangle: the classic Liskov violation.

#### Notes and pictures

**S: Single responsibility.** One reason to change.

```
 ✘ InvoiceService { calculate(); save(); email(); }        3 reasons to change
 ✔ InvoiceCalculator   InvoiceRepository   InvoiceMailer    1 each
```

**O: Open/closed.** Add behaviour by adding code, not editing it.

```java
interface FeeRule { long apply(Booking b); }
class WeekendFee implements FeeRule { public long apply(Booking b) { return b.isWeekend() ? 500 : 0; } }
class CityFee    implements FeeRule { public long apply(Booking b) { return b.city().equals("Mumbai") ? 300 : 0; } }
long total = rules.stream().mapToLong(r -> r.apply(booking)).sum();   // new rule = new class, no if-else edits
```

**L: Liskov substitution.** A child must work everywhere the parent works.

```
 Rectangle r = new Square();  r.setWidth(5); r.setHeight(4);  area() expected 20 → Square gives 16 ✘
 A Square is not a behavioural Rectangle; model them separately (e.g. both implement Shape).
```

**I: Interface segregation.** Small, focused interfaces.

```
 ✘ interface Vehicle { drive(); fly(); openSunroof(); }    Bike forced to implement fly()
 ✔ Drivable { drive(); }   Flyable { fly(); }   HasSunroof { openSunroof(); }
```

**D: Dependency inversion.** Depend on interfaces; get the concrete class injected.

```
 ✘ CheckoutService ──new──► RazorpayClient          (hard-wired, can't test)
 ✔ CheckoutService ──► «PaymentGateway» ◄── RazorpayGateway   (injected by Spring / constructor)
```

## 3.7 Design patterns: the ones they ask

```
 CREATIONAL (how objects are made)   STRUCTURAL (how they're wrapped)   BEHAVIOURAL (how they talk)
 Singleton, Factory, Abstract        Adapter, Decorator, Proxy,         Strategy, Observer, State,
 Factory, Builder, Prototype         Facade, Composite                  Template method, Command, Chain of resp.
```

### Singleton: one instance

#### Theory: start here

**In one sentence:** A Singleton guarantees exactly one instance of a class and gives global access to it.

Some things should exist once: a configuration registry, a connection pool. The Singleton pattern makes the constructor private and exposes one shared instance. The challenge is creating it **once** even when several threads ask at the same moment, and preventing tricks (reflection, serialization) from creating a second one.

**Key terms**

- **Eager singleton**: Instance created when the class loads.
- **Lazy singleton**: Created on first use.
- **Holder idiom**: A nested static class holds the instance; the JVM creates it lazily and thread-safely.
- **Enum singleton**: enum X { INSTANCE }: the simplest, safest form.

**How it works**

1. Make the constructor private.
2. Provide a static accessor returning the single instance.
3. For laziness plus thread-safety, use the holder idiom or an enum (double-checked locking needs volatile).
4. Guard against serialization creating a copy (readResolve), or use an enum.

**In real projects**

- In Spring apps you rarely write singletons: beans are singletons by default, and DI makes them easy to replace in tests.

**Common mistakes**

- Global mutable state hidden in a singleton.
- Singletons that are hard to replace in tests.

#### Notes and pictures

```
  getInstance() ──► instance exists? ──yes──► return it
                          │ no
                          ▼
                    create once, store, return
```
Three thread-safe ways: double-checked locking with `volatile`, a static holder class, or `enum` (safest; survives reflection and serialization). Step-through: [Singleton](https://adityamalu.github.io/java-visualizer/#t3-7a).

### Factory: hide which class gets created

#### Theory: start here

**In one sentence:** A Factory hides which concrete class gets created, so callers only depend on an interface.

If code does `new StripeProcessor()` everywhere, switching providers means editing all of it. A **factory** centralises creation: callers ask `factory.forType("stripe")` and receive a `PaymentProcessor`. They don't know or care which class it is.

An **Abstract Factory** goes further: it creates a whole family of objects that must match, like a UI theme producing buttons and checkboxes that look alike.

**Key terms**

- **Factory method**: A method that returns an object of some interface type.
- **Abstract factory**: An object that creates a family of related objects.
- **Registry**: A map from keys to implementations, used to look up the right one.

**How it works**

1. Define the product interface (PaymentProcessor).
2. Implement concrete products.
3. Give the factory one method that picks and returns the right implementation.
4. In Spring, inject `Map<String, PaymentProcessor>` to get every implementation keyed by bean name.

**In real projects**

- Static factory methods (`List.of`, `Integer.valueOf`) can cache instances and have meaningful names.

**Common mistakes**

- A factory switch that grows with every new type (that breaks open/closed); prefer a registry.

#### Notes and pictures

```
 client ──"UPI"──► PaymentFactory.of(type) ──► new UpiPay()   (client only knows PaymentStrategy)
                                         └──► new CardPay()
```
```java
static PaymentStrategy of(String type) {
    return switch (type) { case "UPI" -> new UpiPay(); case "CARD" -> new CardPay();
                           default -> throw new IllegalArgumentException(type); };
}
```
**Abstract factory:** a factory for a FAMILY: `AwsFactory` creates an AWS disk + network + VM that fit together; `AzureFactory` creates the Azure set.

### Builder: many optional fields, immutable result

#### Theory: start here

**In one sentence:** A Builder constructs a complex object step by step with readable, named calls, then validates and creates it in one go.

Constructors with many parameters are hard to read and easy to get wrong: `new Car("VW", "Golf", 2020, 5, true, false, "red")`. Which boolean is which? A **builder** lets you write `Car.builder().make("VW").model("Golf").year(2020).color("red").build()`. Optional values can be skipped, and `build()` checks the combination is valid before creating an immutable object.

**Key terms**

- **Telescoping constructors**: Many overloaded constructors with growing parameter lists.
- **Fluent interface**: Methods returning this, so calls can be chained.
- **build()**: Validates all values and creates the final object.

**How it works**

1. A static nested Builder class holds the same fields, all mutable.
2. Each setter-like method sets a field and returns this.
3. `build()` validates cross-field rules and calls the target's private constructor.
4. The result has final fields and no setters.

**In real projects**

- Lombok's `@Builder` generates builders; `toBuilder()` makes modified copies.
- Test data builders make tests readable.

**Common mistakes**

- Builders for classes with two or three fields; a constructor or record is clearer.
- Skipping validation in build().

#### Notes and pictures

```
 CarFilter.builder()
     .city("Pune")        ─┐
     .maxPrice(600000)     ├─ set only what you need, in any order
     .minYear(2018)       ─┘
     .build()             → validate → new immutable CarFilter
 instead of new CarFilter("Pune", null, 600000, null, 2018, null)   ← telescoping constructor
```

### Strategy: swap an algorithm

#### Theory: start here

**In one sentence:** Strategy puts interchangeable algorithms behind one interface, so you can choose or swap them at run time.

Pricing might be "regular", "festival discount" or "surge". Instead of an if/else inside the pricing service, each rule becomes its own class implementing `PricingStrategy`. The service just calls `strategy.price(order)` on whichever strategy it was given.

Any functional interface is a strategy slot: the `Comparator` you pass to `sort` is a strategy, and a lambda is the lightest way to write one.

**Key terms**

- **Strategy**: An interface for an algorithm, with several implementations.
- **Context**: The class that uses a strategy without knowing which one.

**How it works**

1. Define the strategy interface.
2. Write one implementation per algorithm.
3. The context receives a strategy (constructor, parameter, or lookup map) and delegates to it.

**In real projects**

- Spring: inject all strategy beans as a Map and pick by key, e.g. per country or customer tier.
- Keep strategies stateless so a single bean can serve every thread.

**Common mistakes**

- Mutable fields in a strategy bean shared by all requests.
- Confusing with State: in Strategy the caller chooses; in State the object switches itself.

#### Notes and pictures

```
 Checkout ──has──► «PaymentStrategy» pay()
                      ▲          ▲
                   UpiPay      CardPay       caller picks which one to plug in
```

### State: object changes behaviour as its state changes

#### Theory: start here

**In one sentence:** State turns each status of an object (scheduled, live, closed) into a class that knows which actions are allowed and what the next state is.

An auction behaves differently depending on its status: you can bid when it's LIVE but not when it's CLOSED. Writing `if (status == …)` in every method gets messy fast. In the **State** pattern each status is a class implementing all the events (`placeBid`, `close`). The auction delegates to its current state object, and the state decides whether the action is legal and which state comes next.

**Key terms**

- **State machine**: A set of states and allowed transitions between them.
- **Transition**: Moving from one state to another in response to an event.
- **Context**: The object whose behaviour depends on its current state.

**How it works**

1. List the states and events; draw the allowed transitions.
2. Create a state class per state; each implements every event, rejecting illegal ones.
3. The context delegates events to the current state and replaces it on transitions.
4. Persist the state (e.g. a status column) and guard transitions in the DB.

**In real projects**

- Orders, payments, auctions and tickets are all state machines.
- In the database, make transitions atomic with `UPDATE … WHERE status = 'LIVE'` (a compare-and-set).

**Common mistakes**

- Transitions checked in Java but not guarded in the DB, which races across pods.
- State logic scattered across services instead of one place.

#### Notes and pictures

```
 Auction:  [SCHEDULED] ──start──► [LIVE] ──end──► [SOLD]
                                   placeBid() ✔     placeBid() ✘ "auction closed"
 Each state is a class implementing placeBid(); the Auction delegates to its current state.
```
**Strategy vs State:** same shape; in Strategy the CALLER picks; in State the object switches ITSELF.

### Observer: publish an event to subscribers

#### Theory: start here

**In one sentence:** Observer lets one object announce events while any number of listeners react, without the publisher knowing who they are.

When an order is placed, many things should happen: send an email, update analytics, notify the warehouse. If OrderService called each of them directly, it would grow with every new feature. Instead it **publishes** an "OrderPlaced" event, and each interested component **subscribes**. Adding a reaction means adding a listener; the publisher never changes.

**Key terms**

- **Publisher / subject**: The object that emits events.
- **Listener / observer**: Code that reacts to an event.
- **Synchronous vs asynchronous**: Listeners run in the publisher's thread, or later on another thread.

**How it works**

1. Define an event (a small immutable record).
2. Listeners register interest (in Spring: `@EventListener` methods).
3. The publisher calls `publishEvent(event)`; the framework calls every matching listener.

**In real projects**

- Use `@TransactionalEventListener(phase = AFTER_COMMIT)` for side effects that should only happen once the data is saved.
- Across services, publish events to a broker (Kafka) using the Outbox pattern.

**Common mistakes**

- Slow or failing synchronous listeners that slow down or break the publisher.
- Sending emails before the transaction commits.

#### Notes and pictures

```
                ┌──► SmsListener.onPlaced()
 OrderService ──┼──► EmailListener.onPlaced()      OrderService doesn't know who listens
  place(order)  └──► AnalyticsListener.onPlaced()
```
Real examples: Spring `ApplicationEvent`, Kafka consumers, UI event listeners.

### Decorator: add behaviour by wrapping

#### Theory: start here

**In one sentence:** A Decorator wraps an object with the same interface and adds one extra behaviour around it; decorators can be stacked.

You want a client that logs, retries and caches. Rather than one huge class, wrap the basic client in a `RetryingClient`, wrap that in a `LoggingClient`, and so on. Each wrapper implements the same interface, does its bit, and passes the call inward. Like layers of clothing, they can be added or removed independently, and their order matters.

**Key terms**

- **Wrapper**: An object that holds another of the same type and delegates to it.
- **Delegation**: Forwarding a call to the wrapped object.

**How it works**

1. Implement the same interface as the object you wrap.
2. Take the wrapped object in the constructor.
3. In each method, add behaviour before or after calling the inner object.

**In real projects**

- Java I/O is decorators: `new BufferedReader(new InputStreamReader(in))`.
- Collections.unmodifiableList and synchronizedList are decorators.
- HTTP client interceptors and filters follow the same idea.

**Common mistakes**

- Forgetting that wrapping order changes behaviour (logging each retry vs once).
- Closing only the inner stream and losing buffered data.

#### Notes and pictures

```
 new BufferedReader( new InputStreamReader( new FileInputStream("a.txt") ) )
     adds buffering    adds bytes→chars        reads bytes
 Each layer has the same interface and adds one thing.
```

### Proxy: control access with a stand-in

#### Theory: start here

**In one sentence:** A Proxy stands in for another object with the same interface and controls access to it: lazily, with caching, security, or by adding transactions.

A proxy looks exactly like the real object to callers, but intercepts calls. It might delay creating an expensive object until it's needed, check permissions, cache results, or call a remote server. Java can even generate proxies at run time (**dynamic proxies**) that send every method call to one handler, and that's how Spring adds `@Transactional`, `@Cacheable` and `@Async` behaviour to your beans.

**Key terms**

- **Dynamic proxy**: A class generated at run time that implements interfaces and routes calls to an InvocationHandler.
- **CGLIB proxy**: A generated subclass that overrides methods (for proxying classes).
- **Self-invocation**: A bean calling its own method via this, which skips the proxy.

**How it works**

1. Spring creates your bean, then wraps it in a proxy if it has annotations needing interception.
2. Other beans get the proxy injected.
3. A call goes through the proxy: start transaction → call your method → commit/rollback.
4. Calls from inside the bean (`this.method()`) go straight to the object, skipping that logic.

**In real projects**

- To make an annotation apply on an internal call, move the method to another bean.
- Proxies can't intercept private, final or static methods.

**Common mistakes**

- Expecting @Transactional to work on a private method or through this.save().

#### Notes and pictures

```
 caller ──► Proxy ──(check / start transaction / lazy load / cache)──► real object
 Spring @Transactional: the proxy opens a transaction, calls your method, commits or rolls back.
```
**Decorator vs Proxy:** both wrap with the same interface; Decorator ADDS features, Proxy CONTROLS access.

### Adapter: make an incompatible interface fit

#### Theory: start here

**In one sentence:** An Adapter makes an existing class with the wrong interface usable where your code expects a different one, by translating calls.

Your code expects `PaymentGateway.charge(Money)`; the vendor's SDK offers `pay(int cents, String currency)` and throws its own exceptions. An **adapter** implements your interface, holds the SDK object, and translates arguments, results and errors in both directions. Like a travel plug adapter: neither the socket nor the device changes.

**Key terms**

- **Target interface**: The interface your code wants to use.
- **Adaptee**: The existing class with an incompatible interface.
- **Anti-corruption layer**: A boundary of adapters that keeps external models out of your domain.

**How it works**

1. Define the interface your domain needs.
2. Implement it in an adapter class that wraps the vendor client.
3. Convert inputs, call the vendor, convert outputs, and map vendor exceptions to your own.

**In real projects**

- Switching vendors means writing a new adapter, with no domain changes.
- Treat timeouts as "unknown outcome", not "failed", in payment adapters.

**Common mistakes**

- Letting vendor types and exceptions leak into business code.

#### Notes and pictures

```
 your code ──► «PaymentGateway».charge() ◄── StripeAdapter ──► Stripe SDK createCharge(...)
```

### Template method: fixed skeleton, one step varies

#### Theory: start here

**In one sentence:** Template Method fixes the steps of an algorithm in a base class and lets subclasses fill in specific steps.

Many processes share the same outline with small variations: every report is "load data → format → export". The base class has a `final` method that runs the steps in order, calling abstract methods (required steps) and hooks (optional steps with defaults). Subclasses supply only what differs. The base class calls the subclass, not the other way round: "don't call us, we'll call you".

**Key terms**

- **Template method**: The final method that defines the sequence of steps.
- **Abstract step**: A step subclasses must implement.
- **Hook**: A step with a default implementation subclasses may override.

**How it works**

1. Write the skeleton method in an abstract base class and mark it final.
2. Make varying steps abstract or hooks.
3. Subclasses implement the steps; callers just call the template method.

**In real projects**

- Spring's JdbcTemplate and RestTemplate use a callback variant: you pass the varying part as a lambda instead of subclassing.

**Common mistakes**

- Deep hierarchies of templates; prefer passing a strategy when possible.

#### Notes and pictures

```java
abstract class ReportGenerator {
    final void generate() { fetch(); format(); export(); }   // skeleton fixed (final)
    abstract void format();                                    // subclasses fill this in: PdfReport, CsvReport
}
```
Spring examples: `JdbcTemplate`, `RestTemplate`.

---

# Part 4: Multithreading and concurrency

## 4.1 Process vs thread

#### Theory: start here

**In one sentence:** A process is a running program with its own memory; threads are independent paths of execution inside one process that share that memory.

When you start a Java application, the OS creates a **process**: it gets its own memory space, isolated from other programs. Inside it, work is done by **threads**. Each thread has its own call stack and its own "where am I in the code" pointer, but all threads in the process share the same heap.

Analogy: a process is a restaurant kitchen; threads are the cooks. Each cook follows their own recipe (stack), but they share the fridge and the counters (heap). Sharing makes cooperation fast, and it's also why two cooks can grab the same ingredient at once.

**Key terms**

- **Process**: An isolated running program with its own address space.
- **Thread**: A unit of execution with its own stack and program counter, sharing the process's heap.
- **Context switch**: The OS pausing one thread and resuming another.
- **Concurrency vs parallelism**: Dealing with many tasks interleaved / actually running them at the same time on several cores.

**How it works**

1. The JVM starts a main thread plus helper threads (GC, JIT).
2. You create more threads (or use pools) to do work concurrently.
3. The OS scheduler gives each thread CPU time slices, possibly in parallel on several cores.
4. Threads read and write shared objects on the heap; local variables stay private to each thread.

**In real projects**

- A web server handles each request on a thread, so request handling code must be safe when run concurrently.
- CPU-bound work: about one thread per core. I/O-bound work: many threads, or virtual threads (4.17).

**Common mistakes**

- Assuming code runs in the order you see it across threads.
- Sharing mutable objects between threads without synchronization.

#### Notes and pictures

```
 PROCESS (a running JVM)
 ┌───────────────────────────────────────────────────────┐
 │  HEAP (shared by all threads): objects, statics        │
 │                                                        │
 │  Thread 1          Thread 2          Thread 3          │
 │  ┌────────┐        ┌────────┐        ┌────────┐        │
 │  │ stack  │        │ stack  │        │ stack  │        │  each thread: own stack + program counter
 │  │ PC     │        │ PC     │        │ PC     │        │
 │  └────────┘        └────────┘        └────────┘        │
 └───────────────────────────────────────────────────────┘
 Processes don't share memory (talk via OS / network). Threads share the heap → fast, but RACES.
```

**Concurrency vs parallelism:** concurrency = many tasks in progress, interleaved (even on 1 core). Parallelism = literally at the same instant on multiple cores.

## 4.2 Creating threads

#### Theory: start here

**In one sentence:** You give a thread work by passing it a Runnable (no result) or Callable (returns a result), and in real code you submit that work to an executor rather than creating threads by hand.

A `Thread` object represents an OS thread. Calling `start()` asks the OS to create it, and the new thread runs your task's `run()` method. Calling `run()` directly just runs the code on *your* thread, which is a common mistake.

**Runnable** is "do this" (no return value). **Callable&lt;V>** is "compute this and give me a V" (may throw). Executors manage a pool of reusable threads; you submit tasks and get back a **Future** to collect the result.

**Key terms**

- **Runnable**: void run(); no result, no checked exceptions.
- **Callable&lt;V>**: V call() throws Exception.
- **ExecutorService**: A pool of threads that runs submitted tasks.
- **Future&lt;V>**: Handle to a result that will be available later.
- **Daemon thread**: A background thread that doesn't keep the JVM alive.

**How it works**

1. Write the task as a lambda: `() -> work()`.
2. Submit it: `Future<R> f = executor.submit(task)`.
3. Do other work, then `f.get()` to wait for the result.
4. Shut the executor down when the application stops.

**In real projects**

- In Spring, define executors as beans; don't create threads ad hoc.
- Name your threads (ThreadFactory) so thread dumps are readable.

**Common mistakes**

- Calling run() instead of start().
- Starting a thread twice (IllegalThreadStateException).
- Unbounded `new Thread` per request.

#### Notes and pictures

```java
// 1. Runnable (preferred: your class can still extend something else)
Thread t = new Thread(() -> System.out.println("hi"));
t.start();                      // new thread runs run()
// t.run();                     // ✘ runs on the CURRENT thread, no new thread

// 2. Callable + executor: returns a value, can throw
ExecutorService pool = Executors.newFixedThreadPool(4);
Future<Integer> f = pool.submit(() -> 6 * 7);
int x = f.get();                // blocks until done → 42

// 3. CompletableFuture (async pipelines), 4. virtual threads (Java 21)
Thread.ofVirtual().start(() -> callApi());
```

**Gotcha:** calling `start()` twice → `IllegalThreadStateException`.

## 4.3 Thread lifecycle

#### Theory: start here

**In one sentence:** A Java thread moves through a few states (NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED), and knowing them is how you read a thread dump.

A thread is **NEW** until `start()`. Then it's **RUNNABLE**: running or ready to run. It becomes **BLOCKED** if it wants a `synchronized` lock another thread holds, **WAITING** if it's waiting for a signal with no time limit (wait, join, park), and **TIMED_WAITING** when there is a limit (sleep, wait(ms)). When run() ends, it's **TERMINATED**.

In a thread dump (from `jstack` or `jcmd Thread.print`), these states tell you what each thread is stuck on.

**Key terms**

- **BLOCKED**: Waiting to enter a synchronized block or method.
- **WAITING**: Waiting indefinitely for another thread's action.
- **TIMED_WAITING**: Waiting with a timeout.
- **Thread dump**: Snapshot of every thread's state and stack trace.

**How it works**

1. start() → RUNNABLE.
2. Hits a held monitor → BLOCKED until it's free.
3. Calls wait() → releases the lock → WAITING. After notify, it must re-acquire the lock (BLOCKED) before running again.
4. sleep(ms) → TIMED_WAITING, keeping any locks it holds.

**In real projects**

- Many threads BLOCKED on one lock → lock contention. Many WAITING in a pool's getConnection → pool exhaustion.
- A thread doing socket I/O shows as RUNNABLE even though it's waiting.

**Common mistakes**

- Confusing wait() (releases the lock) with sleep() (keeps it).
- Using sleep() to "wait for" another thread instead of proper signalling.

#### Notes and pictures

```
                    start()
   NEW ───────────────────────────► RUNNABLE  (ready or running; the OS scheduler decides)
                                    │   ▲  ▲  ▲
            wants a locked monitor  │   │  │  │  got the lock
                     ┌──────────────┘   │  │  └──────────── BLOCKED
                     ▼                  │  │
                  BLOCKED ──────────────┘  │
                                           │  notify / unpark / join target ends
       wait() / join() / park() ──────► WAITING
       sleep(ms) / wait(ms) / join(ms) ► TIMED_WAITING ── time up / notify ──┘
                                    │
                         run() ends ▼
                               TERMINATED
```

## 4.4 The race condition (why we need all this)

#### Theory: start here

**In one sentence:** A race condition happens when the result depends on the timing of threads; the classic example is two threads incrementing the same counter and losing updates.

`count++` looks like one step, but it's three: **read** the value, **add** one, **write** it back. If two threads both read 5 before either writes, both write 6, and one increment is lost. Nothing crashes, the number is just wrong, sometimes.

The other common shape is **check-then-act**: "if the seat is free, book it". Two threads can both see "free" and both book. Any time a decision is made from a value another thread might change before you act on it, you have a race.

**Key terms**

- **Race condition**: Correctness depends on thread interleaving.
- **Atomic**: Happens as one indivisible step; no one sees it half done.
- **Critical section**: Code that must not run in two threads at once.
- **Thread-safe**: Behaves correctly when used from many threads.

**How it works**

1. Identify shared mutable state.
2. Identify compound actions on it (read-modify-write, check-then-act).
3. Make each compound action atomic (lock, atomic class, or a single atomic operation like putIfAbsent), or stop sharing.

**In real projects**

- Prefer immutable objects and thread confinement (each thread has its own data).
- Across multiple servers, the same races happen in the database; use conditional updates or optimistic locking (6.1).

**Common mistakes**

- Believing a race is unlikely because tests pass; it's rare per run and certain at scale.
- "Fixing" a race with volatile, which doesn't make ++ atomic.

#### Notes and pictures

```
 count = 0;  two threads each do count++ once.   count++ is really 3 steps: READ, ADD, WRITE

 Thread A            Thread B            count in memory
 READ  0                                   0
                     READ  0               0
 ADD → 1                                   0
                     ADD → 1               0
 WRITE 1                                   1
                     WRITE 1               1      ← expected 2, got 1 (lost update)
```

**Fixes:** `synchronized`, a `Lock`, or `AtomicInteger.incrementAndGet()`.

## 4.5 synchronized: the monitor lock

#### Theory: start here

**In one sentence:** synchronized lets only one thread at a time run a block of code guarded by a given object's lock, and guarantees that thread sees the previous holder's writes.

Every Java object has a built-in lock called a **monitor**. Wrapping code in `synchronized (obj) { … }` means "acquire obj's lock, run this, release it". If another thread holds it, you wait (BLOCKED). Like a single-occupancy bathroom with one key: only the person holding the key is inside.

A synchronized instance method locks `this`; a static synchronized method locks the Class object. Releasing a lock also **publishes** all writes made inside it to the next thread that takes the same lock.

**Key terms**

- **Monitor**: The lock every object has.
- **Re-entrant**: A thread already holding a lock can take it again (nested calls) without deadlocking.
- **Entry set**: Threads blocked waiting to acquire the monitor.
- **Contention**: Many threads competing for the same lock.

**How it works**

1. Thread reaches synchronized: if the monitor is free it takes it, otherwise it blocks.
2. It runs the critical section; nested synchronized calls on the same lock just increase a counter.
3. On exit (even via exception) the lock is released and writes are made visible.
4. One of the blocked threads (in no guaranteed order) gets the lock next.

**In real projects**

- Keep critical sections small; never do I/O while holding a lock.
- Lock on a private final object, not on `this` or a String literal.

**Common mistakes**

- Static and instance synchronized methods guarding the same data with different locks.
- Locking on a field that gets reassigned.

#### Notes and pictures

**Idea:** every object has one lock (monitor). Only one thread can hold it; others BLOCK.

```
            ┌───────────── object's monitor ─────────────┐
 Thread A ─►│  owner: A     (running inside the method)  │
 Thread B ─►│  entry set: B, C   (BLOCKED, waiting)      │
 Thread C ─►│  wait set:  D      (called wait(), sleeping)│
            └────────────────────────────────────────────┘
```

```java
class Counter {
    private int count;
    synchronized void inc() { count++; }              // locks `this`
    static synchronized void s() {}                   // locks Counter.class
    void inc2() { synchronized (this) { count++; } }  // block: lock only the critical part
}
```

- **Re-entrant:** a thread holding a lock can enter another `synchronized` method on the same object.
- It also gives **visibility:** everything written before unlock is seen by the next thread that locks.

## 4.6 volatile and the Java Memory Model

#### Theory: start here

**In one sentence:** Without synchronization, one thread may never see another's writes, or see them in a surprising order; volatile fixes visibility and ordering for a single variable, but not atomicity.

CPUs and the JIT reorder and cache memory operations for speed. Within one thread you can't tell, but across threads it shows: thread A sets `running = false` and thread B, looping on `while (running)`, may never notice, because its read was cached or hoisted out of the loop.

The **Java Memory Model** defines when a write is guaranteed visible: when there's a **happens-before** relationship between the write and the read. Unlocking then locking the same lock creates one. So does writing then reading a `volatile` field.

**Key terms**

- **Visibility**: Whether one thread sees another's write.
- **Reordering**: Compiler/CPU executing operations in a different order than written.
- **Happens-before**: The JMM rule guaranteeing that one action's effects are visible to another.
- **volatile**: Field modifier: reads and writes go to main memory in order; no atomic ++.

**How it works**

1. Thread A writes data, then writes a volatile flag.
2. Thread B reads the volatile flag and sees it set.
3. Everything A wrote before the flag is now guaranteed visible to B.
4. Without volatile (or a lock) there's no such guarantee.

**In real projects**

- Use volatile for simple flags and for safely publishing an immutable object.
- Use locks or atomics for compound updates.
- Double-checked locking needs the instance field to be volatile.

**Common mistakes**

- A plain boolean stop flag: the loop may never stop.
- Using volatile for counters.

#### Notes and pictures

**Idea:** each core may cache variables. Without rules, one thread may NEVER see another's write.

```
   Core 1 cache            MAIN MEMORY            Core 2 cache
   running = true   ◄──     running = false  ──►  running = false   (Thread 2 set it)
   Thread 1 loops forever because it keeps reading its stale cached copy
```

```java
private volatile boolean running = true;     // volatile: every read goes to main memory
void stop() { running = false; }
void loop() { while (running) { work(); } }  // now sees the update
```

| | Visibility | Atomicity | Blocking |
|---|---|---|---|
| `volatile` | ✔ | ✘ (`count++` still races) | no |
| `synchronized` | ✔ | ✔ | yes |
| `AtomicInteger` | ✔ | ✔ (single variable, CAS) | no |

**Happens-before rules (the guarantees):**

```
 unlock(m)                ──hb──► later lock(m)
 write volatile v         ──hb──► later read of v
 t.start()                ──hb──► everything in t
 everything in t          ──hb──► t.join() returning
 constructor sets final   ──hb──► other threads (if the object is published safely)
```

## 4.7 CAS and atomics

#### Theory: start here

**In one sentence:** Atomic classes update a value without locks using compare-and-swap (CAS): "set it to X only if it's still what I last saw".

Locks make other threads wait. For a single variable there's a faster way. The CPU offers a **compare-and-swap** instruction: "if this memory still holds 5, change it to 6; otherwise tell me it failed". A thread reads the value, computes the new one, and tries CAS. If someone else changed it in between, the CAS fails and the thread simply retries with the fresh value. No thread is ever blocked.

**Key terms**

- **CAS**: Atomic compare-and-set instruction.
- **AtomicInteger / AtomicLong / AtomicReference**: Classes wrapping a value with atomic operations.
- **LongAdder**: A counter split across cells to reduce contention.
- **ABA problem**: A value changes and changes back, fooling a CAS.

**How it works**

1. Read the current value.
2. Compute the new value.
3. compareAndSet(old, new): succeeds only if nobody changed it.
4. On failure, loop and try again (incrementAndGet does this for you).

**In real projects**

- `AtomicInteger.incrementAndGet()` for counters and ids; `LongAdder` for hot metrics counters.
- `AtomicReference.updateAndGet` to swap immutable state objects.

**Common mistakes**

- Combining two atomic variables and expecting the pair to be atomic.
- Heavy contention on one AtomicLong; use LongAdder.

#### Notes and pictures

**Idea:** Compare-And-Swap is one CPU instruction: "set to NEW only if it's still EXPECTED". Retry on failure. No locks.

```
 incrementAndGet():
   loop:
     cur = value            (read 5)
     next = cur + 1         (6)
     if CAS(value, 5 → 6) succeeds → return 6
     else someone changed it → retry with the fresh value
```

**ABA problem:** value goes A → B → A; your CAS succeeds though things changed. Fix: a version stamp (`AtomicStampedReference`), the same idea as a DB `version` column for optimistic locking.

**LongAdder:** under heavy contention, many threads spinning on one `AtomicLong` slow down; `LongAdder` keeps several cells and sums them on read. Use it for hot counters (metrics).

## 4.8 wait / notify

#### Theory: start here

**In one sentence:** wait/notify lets a thread sleep until some condition becomes true and another thread wakes it, all while sharing one object's lock.

A consumer wants to take from a buffer, but it's empty. Spinning in a loop wastes CPU. Instead, while holding the buffer's lock, it calls `wait()`: it releases the lock and sleeps. A producer later adds an item and calls `notifyAll()` to wake the sleepers. A woken thread must re-acquire the lock and **re-check** the condition, because another consumer may have taken the item first.

**Key terms**

- **wait()**: Release the monitor and sleep until notified.
- **notify() / notifyAll()**: Wake one / all threads waiting on this monitor.
- **Spurious wakeup**: Waking up without a notify; another reason to re-check.
- **Condition**: Lock-based equivalent with separate wait sets.

**How it works**

1. Acquire the lock (synchronized).
2. `while (!condition) wait();`
3. Act on the state.
4. The other side changes the state and calls notifyAll() while holding the lock.

**In real projects**

- In real code use higher-level tools: BlockingQueue for producer/consumer, CountDownLatch, CompletableFuture.

**Common mistakes**

- Calling wait/notify without holding the lock (IllegalMonitorStateException).
- Using if instead of while around wait().
- notify() waking the wrong kind of waiter.

#### Notes and pictures

**Idea:** a thread that can't proceed releases the lock and sleeps in the wait set until another thread signals.

```
 Consumer                               Producer
 synchronized (q) {                     synchronized (q) {
   while (q.isEmpty())                    q.add(x);
       q.wait();   ── releases lock ──►   q.notifyAll();  ── wakes consumers
   take();         ◄── re-acquires lock ─ }  (lock released at end of block)
 }
```

- Must be called while holding the lock, else `IllegalMonitorStateException`.
- Always `while`, never `if`: spurious wakeups happen, and another thread may have taken the item first.
- `notifyAll` is safer than `notify` (`notify` may wake the wrong kind of thread → stall).

**sleep vs wait:**

| | `Thread.sleep(ms)` | `obj.wait()` |
|---|---|---|
| Releases the lock | ✘ | ✔ |
| Needs synchronized | ✘ | ✔ |
| Woken by | time, interrupt | notify/notifyAll, interrupt, timeout |
| Belongs to | Thread (static) | Object |

**Others:** `join()` = wait for that thread to finish. Daemon thread = background thread that doesn't keep the JVM alive. Stop a thread with `interrupt()` and let it exit cooperatively; never `stop()`.

## 4.9 Deadlock, livelock, starvation

#### Theory: start here

**In one sentence:** A deadlock is threads waiting on each other forever; livelock is threads busy reacting to each other without progress; starvation is one thread never getting a turn.

Thread 1 holds lock A and waits for B. Thread 2 holds B and waits for A. Neither will ever let go: a **deadlock**. Like two cars meeting on a one-lane bridge, each waiting for the other to back up.

A deadlock needs four conditions: mutual exclusion, hold-and-wait, no preemption, and **circular wait**. Break any one and it can't happen. The practical fix is breaking circular wait: always take locks in the same global order.

**Key terms**

- **Deadlock**: A cycle of threads, each holding a lock the next needs.
- **Livelock**: Threads keep changing state in response to each other, making no progress.
- **Starvation**: A thread never gets the resource because others always win.
- **Lock ordering**: Always acquiring multiple locks in a consistent order.

**How it works**

1. Spot code that takes more than one lock.
2. Define an order (e.g. lower account id first) and always follow it.
3. Or use tryLock with a timeout and back off on failure.
4. Diagnose a hang with a thread dump: the JVM reports Java-level deadlocks.

**In real projects**

- Databases have the same problem with row locks; they detect it and abort one transaction, so retry.
- Avoid calling external code (listeners, callbacks) while holding a lock.

**Common mistakes**

- Nested synchronized blocks in different orders in different methods.
- Adding random sleeps instead of fixing the ordering.

#### Notes and pictures

```
 DEADLOCK: each holds what the other needs
   Thread A: holds lock1, wants lock2 ──┐
                       ▲                │
                       │                ▼
   Thread B: holds lock2, wants lock1 ──┘    → both wait forever

 Needs ALL 4: mutual exclusion, hold-and-wait, no preemption, circular wait.
 Break circular wait: always lock in a fixed global order (e.g. by account id).
```

```java
void transfer(Account a, Account b, long amt) {
    Account first = a.id() < b.id() ? a : b, second = (first == a) ? b : a;
    synchronized (first) { synchronized (second) { a.debit(amt); b.credit(amt); } }
}
```

- **Livelock:** both keep politely stepping aside, no progress (two people in a corridor). Fix: random backoff.
- **Starvation:** a thread never gets the CPU or lock. Fix: fair locks, bounded work.
- **Find it:** a thread dump (`jstack <pid>`) prints "Found one Java-level deadlock".

## 4.10 ReentrantLock, ReadWriteLock, StampedLock

#### Theory: start here

**In one sentence:** The java.util.concurrent locks do what synchronized does plus more: timeouts, interruptibility, fairness, read/write separation and optimistic reads.

**ReentrantLock** is an explicit lock object: `lock()` ... `unlock()` in a finally block. Unlike synchronized, you can `tryLock(1, SECONDS)` and give up, be interrupted while waiting, or ask for fairness.

**ReadWriteLock** lets many readers in at once but only one writer, which suits data that's read constantly and changed rarely. **StampedLock** adds an optimistic read: read without locking, then check whether a write happened in between.

**Key terms**

- **ReentrantLock**: Explicit, re-entrant mutual-exclusion lock.
- **tryLock**: Acquire if possible (optionally within a timeout), else return false.
- **ReadWriteLock**: Shared read lock, exclusive write lock.
- **StampedLock**: Lock with optimistic reads validated by a stamp.
- **Condition**: A wait set attached to a lock (await/signal).

**How it works**

1. `lock.lock(); try { … } finally { lock.unlock(); }`
2. For timeouts: `if (lock.tryLock(1, SECONDS)) { try { … } finally { lock.unlock(); } } else { fallback }`
3. For read-mostly data: readers take readLock(), writers take writeLock().

**In real projects**

- Use synchronized for simple cases; reach for these when you need their extra features.
- Virtual threads (pre-JDK 24) prefer ReentrantLock over synchronized to avoid pinning.

**Common mistakes**

- Forgetting unlock() in finally.
- Trying to upgrade a read lock to a write lock (deadlock).

#### Notes and pictures

```java
ReentrantLock lock = new ReentrantLock(true);    // fair
if (lock.tryLock(1, TimeUnit.SECONDS)) {          // don't wait forever
    try { work(); } finally { lock.unlock(); }    // ALWAYS unlock in finally
}
```

| Feature | synchronized | ReentrantLock |
|---|---|---|
| tryLock / timeout | ✘ | ✔ |
| Interruptible wait | ✘ | ✔ |
| Fairness | ✘ | ✔ |
| Multiple conditions | ✘ (one wait set) | ✔ (`newCondition()`) |
| Auto release | ✔ | ✘ (finally) |

```
 ReadWriteLock (read-heavy data, e.g. a config map):
   readers:  R R R R   ← many at once
   writer:   W         ← alone; blocks all readers
 StampedLock: optimistic read = read with no lock, then validate(stamp); retry with a real lock if a write happened.
```

## 4.11 Synchronizers: latch, barrier, semaphore

#### Theory: start here

**In one sentence:** Synchronizers coordinate groups of threads: a latch waits for N events, a barrier waits for N threads to meet, and a semaphore limits how many can be inside at once.

- **CountDownLatch(N)**: a gate that opens once `countDown()` has been called N times. One-shot. "Wait until all 3 services have started."
- **CyclicBarrier(N)**: N threads each call `await()`; all are released together when the last one arrives. Reusable. "Everyone finish phase 1 before phase 2."
- **Semaphore(N)**: N permits; `acquire()` takes one (waiting if none), `release()` gives it back. "At most 10 concurrent calls to this API."

**Key terms**

- **Latch**: One-time countdown gate.
- **Barrier**: Rendezvous point for a fixed group of threads.
- **Semaphore**: Counter of permits limiting concurrent access.
- **Permit**: A token you must hold to proceed; not tied to a thread.

**How it works**

1. Create the synchronizer with N.
2. Workers call countDown / await / acquire.
3. Waiting threads block until the condition is met.
4. Always countDown/release in a finally block.

**In real projects**

- Semaphores are a simple bulkhead for fragile downstream services.
- Latches are handy in tests to wait for async work.

**Common mistakes**

- Forgetting release() on an exception path, so permits leak until everything blocks.
- Using a latch where you need a reusable barrier.

#### Notes and pictures

```
 CountDownLatch(3): main waits until 3 tasks count down (one-shot)
   main ── await() ───────────────────────────────► continues
   T1 ──work── countDown()  (2)                     ▲
   T2 ──work──────── countDown()  (1)               │
   T3 ──work──────────────── countDown()  (0) ──────┘

 CyclicBarrier(3): 3 threads wait FOR EACH OTHER, then all go; reusable
   T1 ──► |barrier| ──►
   T2 ──► |barrier| ──►    nobody passes until all 3 arrive
   T3 ──► |barrier| ──►

 Semaphore(2): at most 2 threads inside at once
   T1 ✔ T2 ✔  T3 ⏳ T4 ⏳     → when T1 releases, T3 gets in
   use: limit concurrent calls to a payment gateway or DB
```

```java
CountDownLatch done = new CountDownLatch(3);
for (int i = 0; i < 3; i++) pool.submit(() -> { try { callService(); } finally { done.countDown(); } });
done.await();                                 // wait for all 3

Semaphore permits = new Semaphore(10);
permits.acquire(); try { callGateway(); } finally { permits.release(); }
```

**Phaser:** a reusable barrier where parties can join and leave between phases.

## 4.12 ThreadLocal

#### Theory: start here

**In one sentence:** ThreadLocal gives each thread its own private copy of a variable, which is handy for per-request context, and dangerous in thread pools if not cleaned up.

Sometimes many methods need the same contextual value (the current user, a transaction, a request id) and passing it as a parameter everywhere is clumsy. A **ThreadLocal** is like a locker with each thread's name on it: `set()` puts a value in your thread's locker, `get()` reads only yours.

The value is actually stored in a map inside the Thread object. In a thread pool, threads are reused for the next request, so a value you forget to remove is still there for the next user.

**Key terms**

- **ThreadLocal&lt;T>**: A per-thread variable.
- **remove()**: Clears the value for the current thread.
- **InheritableThreadLocal**: Copied to child threads when they're created.
- **MDC**: Logging context (e.g. request id) built on ThreadLocal.

**How it works**

1. At the start of a request: `CTX.set(value)`.
2. Anywhere in that thread: `CTX.get()`.
3. At the end, in finally: `CTX.remove()`.
4. Work handed to another thread (async, pools) doesn't see the value unless you pass it.

**In real projects**

- Spring Security's SecurityContext and @Transactional's current transaction use ThreadLocals.
- For async work, copy context explicitly (TaskDecorator) or use Scoped Values (final since JDK 25).

**Common mistakes**

- Not calling remove() in pooled threads: data leaks between users, and memory leaks.
- Expecting values to appear in CompletableFuture or @Async code.

#### Notes and pictures

```
 ThreadLocal<String> tenant
   Thread-1 ──► "tenant-A"
   Thread-2 ──► "tenant-B"       one variable, a separate value per thread
   Thread-3 ──► "tenant-C"
```

```java
static final ThreadLocal<String> TENANT = new ThreadLocal<>();
try { TENANT.set(req.tenant()); handle(req); }
finally { TENANT.remove(); }     // ✔ pools REUSE threads: leftovers leak into the next request
```
Uses: request/tenant context, trace IDs, `SimpleDateFormat` (not thread-safe). Values don't flow to `@Async` / CompletableFuture threads automatically.

## 4.13 Thread pools (ExecutorService)

#### Theory: start here

**In one sentence:** A thread pool keeps a fixed set of reusable threads and a queue of tasks, so you don't pay for creating threads and can limit how much runs at once.

Creating a thread is expensive, and creating one per request can exhaust the machine. A **thread pool** (ExecutorService) starts some worker threads and keeps them alive. You submit tasks; idle workers take them from a **queue**. Like a restaurant with a fixed number of waiters and a waiting list at the door.

`ThreadPoolExecutor` has a core size, a max size, a queue and a rejection policy. A new task first goes to a core thread, then into the queue, and only when the queue is full are extra threads (up to max) created. After that, tasks are rejected.

**Key terms**

- **Core pool size**: Threads kept alive even when idle.
- **Max pool size**: Upper limit, used only when the queue is full.
- **Work queue**: Where tasks wait; should be bounded.
- **Rejection policy**: What happens when everything is full (throw, run on caller, discard…).

**How it works**

1. Task submitted → if fewer than core threads, start one for it.
2. Otherwise put it in the queue.
3. Queue full → start an extra thread if under max.
4. At max with a full queue → reject.

**In real projects**

- Use bounded queues and CallerRunsPolicy for natural back-pressure.
- Separate pools for CPU work and for blocking I/O.
- Always shut pools down on application stop.

**Common mistakes**

- `Executors.newFixedThreadPool` in servers: its queue is unbounded, so overload becomes memory growth.
- Exceptions from `submit()` silently stored in a Future nobody reads.

#### Notes and pictures

**Idea:** reuse a fixed set of threads that pull tasks from a queue; creating a thread per task is expensive.

```
 submit(task)
     │
     ▼
 ┌─ core threads busy? ──no──► run on a new core thread
 │        │ yes
 │        ▼
 │   queue full? ──no──► put in the queue ─────────► [t5][t6][t7]  ◄── idle workers take()
 │        │ yes
 │        ▼
 │   threads < max? ──yes──► create an extra thread
 │        │ no
 │        ▼
 └── REJECT (AbortPolicy throws, CallerRunsPolicy runs it on the caller → natural back-pressure)

 new ThreadPoolExecutor(core=4, max=8, keepAlive=60s, new ArrayBlockingQueue<>(100), new CallerRunsPolicy())
```

| Factory | What it is | Danger |
|---|---|---|
| `newFixedThreadPool(n)` | n threads, unbounded queue | queue grows → OOM |
| `newCachedThreadPool()` | unbounded threads | thread explosion |
| `newSingleThreadExecutor()` | 1 thread, ordered | unbounded queue |
| `newScheduledThreadPool(n)` | delayed / periodic tasks | |
| `newVirtualThreadPerTaskExecutor()` | Java 21, one virtual thread per task | pinning in synchronized |

**Pool size:** CPU-bound ≈ number of cores. I/O-bound ≈ cores × (1 + wait/compute), or use virtual threads.

**execute vs submit:** `execute` → exception goes to the uncaught handler (you see it). `submit` → exception hidden inside the Future until `get()`.

**shutdown vs shutdownNow:** `shutdown` finishes queued tasks, accepts no new ones; `shutdownNow` interrupts running tasks and returns the queued ones.

## 4.14 Future vs CompletableFuture

#### Theory: start here

**In one sentence:** A Future is a placeholder for a result that isn't ready yet; CompletableFuture adds the ability to chain, combine and recover without blocking.

When you start an asynchronous task you get a **Future**: an IOU for the result. A plain Future only offers `get()`, which blocks until the result arrives.

**CompletableFuture** lets you describe what to do *when* the result arrives: `thenApply` (transform), `thenCompose` (start another async step), `thenCombine` (join two results), `exceptionally` (fallback on error). You can fire off several independent calls at once and combine them, so the total time is roughly that of the slowest call.

**Key terms**

- **supplyAsync**: Start an async task that returns a value.
- **thenApply / thenCompose**: Transform a result / chain another async call.
- **thenCombine / allOf**: Combine two / wait for many futures.
- **exceptionally / handle**: Recover from errors.
- **orTimeout**: Fail the future if it doesn't complete in time.

**How it works**

1. Start independent calls with supplyAsync(…, ioExecutor).
2. Combine them (thenCombine / allOf).
3. Add timeouts and fallbacks.
4. Only at the very edge, join() to get the value (or return the future to the framework).

**In real projects**

- Fan-out to several services for one page, then combine.
- Always pass your own executor for blocking calls; the default common pool is small and shared.

**Common mistakes**

- Calling get()/join() inside tasks running on the same pool (starvation, 6.3).
- Forgetting that orTimeout doesn't stop the underlying work.

#### Notes and pictures

```
 Future:             submit ──► ... ──► get()  ← blocks your thread; no chaining

 CompletableFuture:  supplyAsync(price) ──┐
                     supplyAsync(report) ─┼──► allOf ──► thenApply(combine) ──► page
                     supplyAsync(loan) ───┘
                     total time ≈ slowest call, not the sum
```

```java
CompletableFuture<Price>  p = CompletableFuture.supplyAsync(() -> pricing.get(id), io)
                                .completeOnTimeout(Price.unknown(), 800, MILLISECONDS);
CompletableFuture<Report> r = CompletableFuture.supplyAsync(() -> inspection.get(id), io)
                                .exceptionally(ex -> Report.unavailable());
CarPage page = p.thenCombine(r, CarPage::new).join();
```

| Method | Meaning | Stream analogy |
|---|---|---|
| `thenApply` | transform the result | map |
| `thenCompose` | chain another async call | flatMap |
| `thenCombine` | merge two futures | zip |
| `exceptionally` / `handle` | recover from an error | |
| `allOf` / `anyOf` | wait for all / first | |

**Gotcha:** without an executor argument, async methods run on `ForkJoinPool.commonPool()`; pass your own pool for blocking I/O.

## 4.15 ForkJoinPool and work stealing

#### Theory: start here

**In one sentence:** ForkJoinPool runs divide-and-conquer tasks on all cores and keeps them busy by letting idle threads steal work from busy ones.

Big problems (sum a huge array, process a tree) can be split in half, and each half split again, until pieces are small enough to do directly. Each worker thread in a **ForkJoinPool** has its own deque of tasks. It pushes the halves it forks and pops them itself; when a worker runs out, it **steals** a task from the other end of someone else's deque, typically a big, old one.

**Key terms**

- **RecursiveTask / RecursiveAction**: Fork/join task with / without a result.
- **fork()**: Push a subtask to be run asynchronously.
- **join()**: Wait for a subtask's result (while helping with other work).
- **Work stealing**: Idle threads taking tasks from busy threads' queues.
- **Common pool**: A JVM-wide ForkJoinPool used by parallel streams and async defaults.

**How it works**

1. If the task is small enough, compute directly.
2. Otherwise split: fork() the left half, compute() the right half yourself.
3. join() the left half and combine the results.

**In real projects**

- Parallel streams use this under the hood.
- Keep the common pool CPU-only: no blocking I/O.

**Common mistakes**

- Splitting too finely, so overhead dominates.
- Blocking calls inside parallel streams.

#### Notes and pictures

```
 big task ─split─► [half A] [half B] ─split─► [a1][a2][b1][b2] ... compute leaves, then join results

 Each worker has its own deque.  Busy worker:  [t1 t2 t3 t4]
                                 Idle worker steals from the OTHER end ─► takes t1
```
Used by parallel streams and CompletableFuture's default async methods.

## 4.16 Concurrent collections

#### Theory: start here

**In one sentence:** Concurrent collections are built to be used from many threads at once, without one big lock and without ConcurrentModificationException.

Wrapping a HashMap in `synchronized` makes every operation wait for one lock. **ConcurrentHashMap** instead locks only the bucket being changed (and uses lock-free CAS for empty buckets), and reads don't lock at all. It also offers **atomic compound operations** (`merge`, `compute`, `putIfAbsent`) so you don't have to combine get and put yourself.

Other tools: **CopyOnWriteArrayList** (reads are free, every write copies the array, great for rarely changed listener lists) and **BlockingQueue** (put waits when full, take waits when empty, perfect for producer/consumer).

**Key terms**

- **ConcurrentHashMap**: Thread-safe hash map with fine-grained locking.
- **Atomic compound operation**: merge/compute/putIfAbsent: the check and the update happen as one step.
- **CopyOnWriteArrayList**: Read-optimised list that copies on write.
- **BlockingQueue**: Queue with blocking put/take and optional capacity.
- **Weakly consistent iterator**: Never throws CME; may or may not reflect concurrent changes.

**How it works**

1. Choose by access pattern: map → CHM; read-mostly list → COW; hand-off between threads → BlockingQueue.
2. Use the atomic methods for compound updates (`map.merge(word, 1, Integer::sum)`).

**In real projects**

- Caches, counters per key, registries and work queues.

**Common mistakes**

- `if (!map.containsKey(k)) map.put(k, v)` on a CHM: still a race.
- Putting null in a CHM (not allowed).
- Slow functions inside computeIfAbsent (they hold the bucket lock).

#### Notes and pictures

```
 ConcurrentHashMap (Java 8)
 ┌───┐
 │ 0 │ → empty      → put uses CAS (no lock)
 │ 1 │ → [A]→[B]    → put locks ONLY this bucket's head node (synchronized)
 │ 2 │ → [C]        → threads writing other buckets run in parallel
 └───┘   reads: no lock (volatile)       Java 7 used 16 locked "segments" instead
 Atomic helpers: putIfAbsent, computeIfAbsent, merge   (map.merge(word, 1, Integer::sum) is a thread-safe counter)
```

| Class | How it's safe | Best for |
|---|---|---|
| `ConcurrentHashMap` | CAS + per-bucket lock | shared maps, caches, counters |
| `CopyOnWriteArrayList` | copies the array on every write | many reads, rare writes (listener lists) |
| `ArrayBlockingQueue` | one lock, bounded | producer-consumer with back-pressure |
| `LinkedBlockingQueue` | two locks (put/take) | higher throughput queues |
| `PriorityBlockingQueue` / `DelayQueue` | heap / delay-ordered | scheduled jobs |
| `SynchronousQueue` | no storage, direct hand-off | cached thread pool |
| `ConcurrentSkipListMap` | lock-free skip list | sorted concurrent map |

**Why not `Collections.synchronizedMap` or `Hashtable`?** One lock for the whole map: only one thread at a time.

## 4.17 Virtual threads (Java 21)

#### Theory: start here

**In one sentence:** Virtual threads (Java 21) are lightweight threads managed by the JVM, so you can have millions of them and write simple blocking code that still scales.

A classic (platform) thread maps to an OS thread: heavy, with a big stack, so you can have a few thousand at most. Web apps spend most of their time *waiting* on databases and HTTP calls, holding a thread that does nothing.

A **virtual thread** is a cheap Java object. It runs on a small pool of OS "carrier" threads. When it blocks on I/O, the JVM **unmounts** it and the carrier runs another virtual thread. When the I/O completes, it's mounted again. You write plain blocking code, and you get the scalability of async code.

**Key terms**

- **Platform thread**: A Java thread backed 1:1 by an OS thread.
- **Virtual thread**: A lightweight thread scheduled by the JVM onto carrier threads.
- **Carrier thread**: The platform thread a virtual thread is currently running on.
- **Pinning**: A virtual thread that can't unmount (e.g. blocking inside synchronized before JDK 24).

**How it works**

1. Create one per task: `Executors.newVirtualThreadPerTaskExecutor()`, or Spring Boot's `spring.threads.virtual.enabled=true`.
2. Each request runs on its own virtual thread with ordinary blocking code.
3. On blocking I/O the virtual thread parks and frees the carrier.

**In real projects**

- Big win for I/O-heavy services; no gain for CPU-heavy work.
- Still limit access to scarce resources (DB connections) with pools or semaphores.

**Common mistakes**

- Pooling virtual threads.
- Expecting them to make CPU-bound code faster.
- Long blocking calls inside synchronized on older JDKs (pinning).

#### Notes and pictures

```
 Platform threads: 1 Java thread = 1 OS thread (~1 MB stack) → thousands max
 Virtual threads:  millions of cheap JVM threads mounted on a few carrier (OS) threads

  VT1 VT2 VT3 VT4 VT5 ...
    \  |   |   |  /
   [carrier 1] [carrier 2]      VT blocks on I/O → unmounts → the carrier runs another VT
```
Good for thread-per-request servers doing blocking I/O. Not faster for CPU work. Watch for pinning inside `synchronized` (improved in JDK 24).

## 4.18 Classic coding problems: the pattern behind each

#### Theory: start here

**In one sentence:** Classic interview puzzles (alternating odd/even printing, a thread-safe lazy singleton) test whether you can combine locks, conditions and visibility correctly.

**Odd/even**: two threads must print 1, 2, 3… in turn. They share a counter and a lock; each waits until it's its turn, prints, increments, and wakes the other. The tricky bits are the loop condition and the final exit (the last thread must still wake the other, or it waits forever).

**Lazy singleton**: create the instance only when first needed, exactly once, even with many threads. Double-checked locking works only with a volatile field; the holder idiom and enums are simpler.

**Key terms**

- **Turn-taking**: Threads alternating based on shared state.
- **Double-checked locking**: Check, lock, check again, create; needs volatile.
- **Holder idiom**: Lazy init through a nested class.

**How it works**

1. Shared state (counter, whose turn), one lock.
2. Each thread: `while (notMyTurn) wait();` then act, update state, notifyAll().
3. Make sure both threads exit cleanly at the end.

**In real projects**

- Real code would use a SynchronousQueue, semaphores or CompletableFuture rather than wait/notify.
- When something hangs, take several thread dumps and compare them.

**Common mistakes**

- Missing the final notifyAll.
- Double-checked locking without volatile.

#### Notes and pictures

| Problem | Pattern |
|---|---|
| Odd/even with 2 threads; 1..N with K threads | shared counter + `while (not my turn) wait(); print; notifyAll()`. Step-through: [4.18](https://adityamalu.github.io/java-visualizer/#t4-18) |
| Producer-consumer | `BlockingQueue`, or wait/notify with `while` loops, or Lock + 2 Conditions |
| Thread-safe singleton | `volatile` + double-checked locking, holder class, or enum |
| Bank transfer without deadlock | lock ordering by id |
| Wait for N tasks | `CountDownLatch` or `CompletableFuture.allOf` |
| Limit concurrency to K | `Semaphore(K)` |
| Thread-safe counter | `AtomicInteger` / `LongAdder` |
| Dining philosophers | lock ordering, or a `Semaphore(n-1)` |

**Debugging a hung service:** take 2–3 thread dumps a few seconds apart (`jcmd <pid> Thread.print`), look for BLOCKED threads on the same lock, reported deadlocks, or every pool thread stuck on the same I/O call.

---

# Part 5: Spring Boot, JPA, microservices

## 5.1 IoC and dependency injection

#### Theory: start here

**In one sentence:** Instead of your classes creating their own collaborators, Spring creates them and hands them in: that's Inversion of Control, and the handing-in is Dependency Injection.

Without a framework, `OrderService` would do `new PaymentClient(new HttpClient(...))`, deciding and building everything it needs. That ties it to specific classes and makes testing hard.

With **Inversion of Control**, a container (Spring's ApplicationContext) is in charge of creating objects, called **beans**. Your class just declares what it needs in its constructor, and Spring **injects** matching beans. Like a hotel: you don't bring your own bed, you state what you need and the hotel provides it.

**Key terms**

- **Bean**: An object created and managed by Spring.
- **ApplicationContext**: Spring's container that holds all beans.
- **@Component / @Service / @Repository**: Mark a class to be discovered and created as a bean.
- **@Bean**: A method in a @Configuration class that creates a bean (for third-party classes).
- **@Qualifier / @Primary**: Choose between several beans of the same type.

**How it works**

1. At startup Spring scans packages for annotated classes and reads @Bean methods.
2. It builds a definition for each bean and works out who depends on whom.
3. It creates beans in dependency order, passing dependencies into constructors.
4. Your code receives ready-to-use objects; in tests you pass fakes instead.

**In real projects**

- Use constructor injection with final fields (no @Autowired needed with one constructor).
- Depend on interfaces so implementations can change.
- Inject `List<X>` or `Map<String, X>` to get all implementations.

**Common mistakes**

- Field injection, which hides dependencies and needs reflection in tests.
- Circular dependencies, a sign two classes should be redesigned.

#### Notes and pictures

**Idea:** you don't `new` your dependencies; the Spring container creates the objects (beans) and passes them in. Control is inverted.

```
 WITHOUT DI                                  WITH DI
 class OrderService {                        @Service
   repo = new JdbcOrderRepo();   ✘ hard-wired class OrderService {
 }                                             private final OrderRepo repo;
                                               OrderService(OrderRepo repo) { this.repo = repo; }  ← container injects
                                             }

 ApplicationContext (the container)
 ┌──────────────────────────────────────────────┐
 │ scans @Component/@Service/@Repository/@Bean   │
 │ OrderRepo bean ──injected into──► OrderService│
 │ OrderService  ──injected into──► OrderController
 └──────────────────────────────────────────────┘
```

**Constructor vs field injection:** prefer constructor: fields can be `final`, easy to unit test with `new OrderService(mockRepo)`, and circular dependencies fail fast at startup.

**Two beans of the same type?** `@Primary` on one, or `@Qualifier("razorpay")` at the injection point.

## 5.2 Bean scopes and lifecycle

#### Theory: start here

**In one sentence:** Every Spring bean goes through a lifecycle (created, wired, initialised, possibly proxied, used, destroyed), and its scope decides how many instances exist.

Spring doesn't just call `new`. It instantiates the bean, injects dependencies, calls initialisation callbacks (`@PostConstruct`), lets **BeanPostProcessors** wrap it (that's where proxies for @Transactional are created), and later calls `@PreDestroy` on shutdown.

**Scope** decides sharing. The default **singleton** means one instance for the whole application, used by every thread, so it must not keep per-request data in fields. **prototype** means a new instance each time it's requested; **request** and **session** scopes give one per HTTP request or session.

**Key terms**

- **@PostConstruct**: Runs after injection, before the bean is used.
- **@PreDestroy**: Runs on context shutdown (singletons only).
- **BeanPostProcessor**: Hook that can modify or wrap beans; creates AOP proxies.
- **Scope**: singleton, prototype, request, session…

**How it works**

1. Instantiate (constructor) → inject → Aware callbacks → @PostConstruct.
2. BeanPostProcessors run; the bean may be replaced by a proxy.
3. The bean is ready and shared (singleton).
4. On shutdown: @PreDestroy, then destroy.

**In real projects**

- Keep singletons stateless; put per-request data in method parameters.
- Need a fresh prototype each call from a singleton? Inject `ObjectProvider<T>`.
- Warm caches after startup with an ApplicationReadyEvent listener.

**Common mistakes**

- Calling @Transactional methods from @PostConstruct (the proxy doesn't exist yet).
- Storing the current user in a singleton's field.

#### Notes and pictures

| Scope | Instances |
|---|---|
| singleton (default) | one per container: must be stateless / thread-safe |
| prototype | new one every time it's requested |
| request / session | one per HTTP request / session |

```
 instantiate ──► inject dependencies ──► Aware callbacks ──► BeanPostProcessor (before)
   ──► @PostConstruct ──► BeanPostProcessor (after; PROXIES are created here) ──► READY
   ...app runs...
   ──► @PreDestroy ──► destroyed
```

**Gotcha:** a prototype bean injected into a singleton is created only ONCE. Use `ObjectProvider<T>` to get a fresh one each time.

## 5.3 AOP and proxies

#### Theory: start here

**In one sentence:** AOP (aspect-oriented programming) adds cross-cutting behaviour (transactions, caching, security, logging) around your methods without changing them, using proxies.

Many concerns cut across every service: open a transaction, check permissions, log timing. Copying that code into every method is messy. With **AOP** you write it once as an **aspect** and say *where* it applies (a **pointcut**, e.g. "methods annotated @Transactional"). Spring then wraps matching beans in **proxies** that run the aspect's code (**advice**) before and after your method.

Because it's done by a proxy, it only applies to calls that **go through the proxy**, meaning calls from other beans.

**Key terms**

- **Aspect**: A module of cross-cutting behaviour.
- **Advice**: The code that runs: @Before, @After, @Around.
- **Pointcut**: Expression choosing which methods are affected.
- **Join point**: A point where advice can run (a method call in Spring AOP).
- **Proxy**: The wrapper object Spring injects in place of your bean.

**How it works**

1. Spring sees a bean matches a pointcut.
2. It creates a proxy (CGLIB subclass by default in Boot) around the bean.
3. Other beans receive the proxy.
4. A call enters the proxy → interceptor chain (transaction, cache…) → your method → back out.

**In real projects**

- Use built-in aspects via annotations (@Transactional, @Cacheable, @Async, @PreAuthorize).
- Write custom @Around aspects for timing, auditing, rate limiting.

**Common mistakes**

- Self-invocation (`this.method()`) bypasses the proxy and the annotation.
- Annotations on private, final or static methods do nothing.

#### Notes and pictures

**Idea:** cross-cutting code (transactions, logging, security, retries) is woven around your methods by a proxy, without editing them.

```
 controller ──calls──► [ PROXY of OrderService ] ──► real OrderService.place()
                         before: begin tx / log / check auth
                         after:  commit / rollback / log time
```

- JDK dynamic proxy if the bean implements an interface; otherwise CGLIB (a generated subclass).
- AOP terms: **aspect** (the module), **advice** (`@Before`, `@After`, `@Around`), **pointcut** (which methods), **join point** (a method call).

**Self-invocation gotcha:**

```
 place() ──this.audit()──► audit() marked @Transactional
         └─ a direct call on `this` skips the proxy → NO transaction
 Fix: move audit() to another bean, or inject the proxy of self.
```
Also: `@Transactional` on a `private` (or `final`) method does nothing because the proxy can't intercept it.

## 5.4 @Transactional

#### Theory: start here

**In one sentence:** @Transactional makes a method run inside a database transaction (all its changes commit together or roll back together), and propagation decides what happens when transactional methods call each other.

A **transaction** groups database operations so they're all-or-nothing: debit one account and credit another, or neither. `@Transactional` tells Spring's proxy to begin a transaction before your method, commit if it returns normally, and roll back if it throws an unchecked exception.

**Propagation** answers "what if a transaction is already running?". **REQUIRED** (default) joins it. **REQUIRES_NEW** pauses it and starts an independent one (on a separate connection). **NESTED** uses a savepoint inside the same one.

**Key terms**

- **Commit / rollback**: Make changes permanent / undo them.
- **Propagation**: How a method's transaction relates to an existing one.
- **Rollback-only**: A shared transaction marked to roll back because an inner part failed.
- **Isolation**: How much concurrent transactions see of each other (READ COMMITTED…).

**How it works**

1. Proxy gets a connection from the pool and turns off auto-commit.
2. Your method runs; repositories use the same connection (bound to the thread).
3. Normal return → commit. RuntimeException → rollback. Checked exception → commit (by default).
4. The connection goes back to the pool.

**In real projects**

- Put @Transactional on service methods, keep transactions short, and never call slow remote services inside them (6.4).
- Use `rollbackFor = Exception.class` if checked exceptions should roll back.
- Use REQUIRES_NEW for audit logs that must survive a rollback.

**Common mistakes**

- Catching an inner exception and expecting the outer transaction to commit (UnexpectedRollbackException).
- @Transactional on private methods or self-invoked methods.

#### Notes and pictures

```
 @Transactional
 placeOrder() ─► proxy: BEGIN
                   save order
                   reduce stock
                   charge payment ── RuntimeException ──► ROLLBACK everything
                 COMMIT (if no exception)
```

| Setting | Meaning |
|---|---|
| `propagation = REQUIRED` (default) | join the existing tx, or start one |
| `REQUIRES_NEW` | suspend the outer tx, run in a new one (e.g. audit log that must survive a rollback) |
| `NESTED` | savepoint inside the outer tx |
| `rollbackFor = Exception.class` | also roll back on checked exceptions (default: unchecked only) |
| `readOnly = true` | hint: skip dirty checking, may route to a replica |
| `isolation` | READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE |

**Gotchas:** catching the exception inside the method → no rollback. Self-invocation and private methods → no transaction. Don't make slow network calls inside a transaction (holds DB locks and connections).

## 5.5 JPA and Hibernate

#### Theory: start here

**In one sentence:** JPA maps Java objects to database tables; Hibernate tracks the objects you load and automatically writes changes back, which is powerful but has traps like N+1 queries.

With JPA you annotate classes as **entities** (`@Entity`), and Hibernate turns `find`, `persist` and queries into SQL. Within a transaction, loaded entities are **managed**: Hibernate keeps a snapshot, and at **flush** time (before commit or before a query) it compares and issues UPDATEs for anything you changed. That's **dirty checking**: you never call update().

Relationships can be loaded **lazily** (when first accessed). Loading 100 orders and touching each one's items triggers 1 + 100 queries: the **N+1 problem**.

**Key terms**

- **Entity**: A class mapped to a table.
- **Persistence context**: The set of managed entities in the current transaction (first-level cache).
- **Entity states**: transient (new), managed, detached, removed.
- **Flush**: Sending pending changes to the database as SQL.
- **Lazy / eager**: Load a relationship on first access / immediately.
- **@Version**: Optimistic locking column.

**How it works**

1. `find(id)` → SELECT; the entity becomes managed and a snapshot is taken.
2. You change fields with setters.
3. At flush, Hibernate diffs against the snapshot and runs UPDATEs (inserts, then updates, then deletes).
4. After the transaction ends, entities become detached.

**In real projects**

- Fix N+1 with JOIN FETCH, @EntityGraph or batch fetching; watch SQL logs in development.
- Make @ManyToOne LAZY explicitly (it's eager by default).
- Use @Version to detect concurrent edits.

**Common mistakes**

- LazyInitializationException from touching lazy fields after the transaction.
- Returning entities from controllers (lazy loading during JSON serialisation).

#### Notes and pictures

```
 Entity states
   new Car() ─persist()─► MANAGED (in the persistence context) ─commit/flush─► INSERT/UPDATE
      TRANSIENT              │  dirty checking: change a field → auto UPDATE at flush
                             ├─ tx ends / detach() ─► DETACHED (merge() to reattach)
                             └─ remove() ─► REMOVED ─flush─► DELETE

 Persistence context = first-level cache: find(Car, 1) twice in one tx → one SELECT
```

**The N+1 problem:**

```
 List<Order> orders = repo.findAll();          1 query
 for (Order o : orders) o.getItems().size();   + N queries (one per order, items are LAZY)
 Fix: JOIN FETCH, @EntityGraph, or batch fetching (hibernate.default_batch_fetch_size)
```

```java
@Query("select o from Order o join fetch o.items where o.status = :s")
List<Order> findWithItems(@Param("s") Status s);
```

- **Fetch types:** `@ManyToOne` is EAGER by default → set it LAZY. `@OneToMany` is LAZY.
- **LazyInitializationException:** a lazy field accessed after the session is closed. Fix: fetch what you need inside the transaction, or return DTOs.
- **Optimistic locking:** a `@Version` column. `UPDATE ... WHERE id=? AND version=?`; 0 rows → `OptimisticLockException`. **Pessimistic:** `@Lock(PESSIMISTIC_WRITE)` → `SELECT ... FOR UPDATE`.

## 5.6 Spring Boot internals

#### Theory: start here

**In one sentence:** Spring Boot starts your app from one main method and configures common infrastructure automatically based on what's on the classpath, while letting your own beans win.

Plain Spring needs lots of configuration. **Spring Boot** looks at your dependencies and properties and creates sensible beans for you: add the web starter and you get an embedded Tomcat and JSON support; add the JPA starter and a datasource URL and you get a DataSource, EntityManager and transaction manager.

Each auto-configuration is guarded by **conditions**, like "only if this class is on the classpath" or "only if the user hasn't defined their own bean". So you can override anything just by declaring your own bean.

**Key terms**

- **@SpringBootApplication**: @Configuration + @EnableAutoConfiguration + @ComponentScan.
- **Starter**: A dependency bundle (spring-boot-starter-web…).
- **Auto-configuration**: Boot's conditional @Configuration classes.
- **@ConditionalOnMissingBean**: Apply only if you haven't defined that bean.

**How it works**

1. main() calls SpringApplication.run.
2. Boot prepares the environment (properties, profiles).
3. It scans your packages from the main class's package downward.
4. It evaluates auto-configurations and applies those whose conditions match.
5. It creates beans, starts the web server and publishes ApplicationReadyEvent.

**In real projects**

- Keep the main class in the root package.
- Run with `--debug` to see which auto-configurations applied and why.

**Common mistakes**

- Main class in a sub-package, so components aren't found.
- Fighting auto-configuration instead of defining your own bean or setting a property.

#### Notes and pictures

```
 @SpringBootApplication = @Configuration + @EnableAutoConfiguration + @ComponentScan

 SpringApplication.run()
   ├─ create ApplicationContext
   ├─ component scan your package
   ├─ auto-configuration: read AutoConfiguration.imports from the starters
   │     @ConditionalOnClass(DataSource)     → classpath has a JDBC driver?
   │     @ConditionalOnMissingBean            → you didn't define your own?
   │     → then create a DataSource, JdbcTemplate, ... for you
   ├─ start the embedded Tomcat
   └─ run CommandLineRunner / ApplicationRunner beans
```

**Starters** = curated dependency bundles (`spring-boot-starter-web` brings Spring MVC + Jackson + Tomcat). **Actuator** = `/actuator/health`, `/metrics`, `/info`.

## 5.7 Configuration and profiles

#### Theory: start here

**In one sentence:** Spring Boot reads configuration from many sources (files, environment variables, command line) in a fixed priority order, and profiles switch sets of settings per environment.

The same JAR runs in dev, test and prod with different database URLs and timeouts. Boot collects properties from `application.yml`, profile files like `application-prod.yml`, environment variables, command-line arguments and more. When the same key appears in several places, the higher-priority source wins: command line beats environment variables, which beat profile files, which beat the base file.

**Profiles** (`spring.profiles.active=prod`) activate extra files and beans for an environment.

**Key terms**

- **Property source**: A place properties come from.
- **Profile**: A named set of configuration (dev, prod…).
- **Relaxed binding**: PAYMENT_TIMEOUT_MS env var → payment.timeout-ms.
- **@ConfigurationProperties**: Binds a group of properties to a typed class.

**How it works**

1. Boot loads every property source in order of precedence.
2. For each key the first (highest-priority) value wins.
3. Values are bound to @Value fields and @ConfigurationProperties classes at startup.
4. Missing required values fail startup.

**In real projects**

- Use @ConfigurationProperties records with @Validated for grouped, checked settings.
- Keep secrets out of files: environment variables, Vault, or Kubernetes secrets.

**Common mistakes**

- Hard-coding environment-specific values.
- A property defined only in a profile file, so startup fails without that profile.

#### Notes and pictures

```
 Highest priority wins:
   command-line args  >  environment variables  >  application-{profile}.yml  >  application.yml
```

```java
@ConfigurationProperties(prefix = "payment")      // type-safe, grouped (preferred over many @Value)
record PaymentProps(String url, Duration timeout, int retries) {}

@Profile("dev") @Bean DataSource h2() { ... }      // only when spring.profiles.active=dev
```
Secrets: environment variables or a vault, never committed in yml.

## 5.8 Web layer: request flow

#### Theory: start here

**In one sentence:** An HTTP request travels through servlet filters, Spring's DispatcherServlet, interceptors, argument binding and validation to your controller, and the result is converted to JSON on the way back.

When a request like `POST /cars` arrives, the embedded server hands it to a chain of **filters** (security, logging, CORS). Then Spring's **DispatcherServlet** finds the controller method matching the URL and HTTP method, runs **interceptors**, converts the JSON body into a Java object, validates it (`@Valid`), and calls your method. The return value is converted back to JSON by a message converter (Jackson).

Exceptions anywhere in the controller layer can be turned into proper HTTP error responses in one place with `@RestControllerAdvice`.

**Key terms**

- **Filter**: Servlet-level component that sees every request.
- **DispatcherServlet**: Spring MVC's front controller that routes requests.
- **HandlerInterceptor**: Runs around controller handlers.
- **@Valid**: Triggers Bean Validation on a request body.
- **@RestControllerAdvice**: Global exception-to-response mapping.

**How it works**

1. Filters (security first) → DispatcherServlet.
2. Handler mapping finds the controller method.
3. Interceptors' preHandle → argument resolution and validation → controller.
4. Return value → JSON via Jackson → response.
5. Errors → @ExceptionHandler → error JSON with the right status.

**In real projects**

- Return DTOs (records), not JPA entities.
- Validate input with annotations (@NotNull, @Size) on DTOs.
- Return correct status codes (201 Created, 400, 404, 409).

**Common mistakes**

- Business logic in controllers.
- try/catch in every controller instead of central error handling.

#### Notes and pictures

```
 HTTP request
   ▼
 Filter chain (servlet level: security, CORS, logging, tenant ThreadLocal)
   ▼
 DispatcherServlet ──► HandlerMapping (which controller method?)
   ▼
 HandlerInterceptor.preHandle
   ▼
 @RestController method ← @PathVariable, @RequestParam, @RequestBody (Jackson JSON → object), @Valid
   ▼
 return object ──► HttpMessageConverter (Jackson object → JSON) ──► response
 exception anywhere ──► @RestControllerAdvice / @ExceptionHandler ──► clean error JSON + status code
```

```java
@RestController @RequestMapping("/cars")
class CarController {
    @GetMapping("/{id}") CarDto get(@PathVariable long id) { return svc.get(id); }
    @PostMapping ResponseEntity<CarDto> create(@Valid @RequestBody CreateCar req) {
        return ResponseEntity.status(201).body(svc.create(req));
    }
}
@RestControllerAdvice
class Errors {
    @ExceptionHandler(NotFound.class) @ResponseStatus(HttpStatus.NOT_FOUND)
    Map<String, String> nf(NotFound e) { return Map.of("error", e.getMessage()); }
}
```

**Filter vs interceptor:** a filter is servlet-level and sees every request (even static files); an interceptor is Spring MVC-level and knows which handler will run.

## 5.9 Security (Spring Security + JWT)

#### Theory: start here

**In one sentence:** Spring Security is a chain of filters that authenticates who you are and authorises what you can do; with JWT, the client sends a signed token on every request.

**Authentication** answers "who are you?"; **authorisation** answers "are you allowed?". With **JWT**, after login the server issues a token containing claims (user id, roles, expiry) and signs it. The client sends it in the `Authorization: Bearer …` header. On each request a filter verifies the signature and expiry, builds an `Authentication` object, and stores it in the SecurityContext for the rest of the request.

The server doesn't need to store sessions (stateless), but it also can't easily revoke a token before it expires.

**Key terms**

- **JWT**: Base64URL-encoded header.payload.signature; signed, not encrypted.
- **SecurityFilterChain**: The ordered filters that process security.
- **SecurityContext**: Holds the current user's Authentication (thread-bound).
- **401 vs 403**: Not authenticated vs authenticated but forbidden.
- **Refresh token**: Long-lived token used to get new short-lived access tokens.

**How it works**

1. Request arrives → the JWT filter reads the header.
2. Verify signature and expiry with the expected algorithm and key.
3. Create an Authentication with the user's authorities.
4. Authorisation rules (URL rules, @PreAuthorize) check roles.
5. Missing/invalid token → 401; insufficient role → 403.

**In real projects**

- Keep access tokens short-lived (minutes) and use refresh tokens.
- Never put secrets in the payload; anyone can decode it.
- Prefer a standard resource-server setup (spring-boot-starter-oauth2-resource-server) to hand-written filters.

**Common mistakes**

- Accepting tokens without checking the algorithm.
- Long-lived tokens with no revocation plan.

#### Notes and pictures

```
 request ─► SecurityFilterChain
              ├─ JwtAuthFilter: read "Authorization: Bearer <jwt>", verify signature + expiry
              │      ok → put Authentication in SecurityContext (a ThreadLocal)
              ├─ authorization: .requestMatchers("/admin/**").hasRole("ADMIN")
              └─ fail → 401 (who are you?) / 403 (you can't do this)
            ─► controller (@PreAuthorize("hasRole('ADMIN')") for method level)

 JWT = header.payload.signature   (base64; signed, NOT encrypted: don't put secrets inside)
```

**Authentication vs authorization:** who you are vs what you may do. Passwords: store a BCrypt hash, never plain text. CSRF: needed for cookie sessions, disabled for stateless JWT APIs.

## 5.10 Other Boot features

#### Theory: start here

**In one sentence:** Spring adds common production features with annotations: caching results, running scheduled jobs, running methods asynchronously, and retrying failures.

- **@Cacheable**: the first call runs the method and stores the result; later calls with the same arguments return it from the cache.
- **@Scheduled**: runs a method on a timer or cron expression.
- **@Async**: runs the method on another thread and returns immediately.
- **@Retryable** (Spring Retry): re-runs a failed call with backoff.

All are implemented with proxies, so they share the proxy rules (5.3), and each has a multi-instance pitfall once you run several pods.

**Key terms**

- **Cache provider**: Caffeine (in-memory, per pod) or Redis (shared).
- **TTL**: Time-to-live before a cache entry expires.
- **Distributed lock**: A lock shared by all pods (e.g. ShedLock).
- **Backoff + jitter**: Growing, randomised delays between retries.

**How it works**

1. Enable features with @EnableCaching / @EnableScheduling / @EnableAsync.
2. Annotate methods; configure a cache provider and executors.
3. Set TTLs and sizes for caches; bounded executors for @Async.
4. Make retried operations idempotent.

**In real projects**

- A @Scheduled job runs on every pod; use ShedLock if it must run once.
- Local caches differ per pod; choose short TTLs or a shared cache.

**Common mistakes**

- @Async with the default executor and no error handling.
- Retrying non-idempotent operations like payments without an idempotency key.

#### Notes and pictures

| Feature | One-liner |
|---|---|
| `@Async` | run a method on a thread pool (configure your own executor; same self-invocation proxy rule) |
| `@Scheduled(cron = ...)` | periodic jobs; on multiple pods add ShedLock so only one runs |
| `@Cacheable` | cache method results (Caffeine / Redis); `@CacheEvict` on updates |
| `@Retryable` | retry with backoff (spring-retry); only for idempotent operations |
| Events | `ApplicationEventPublisher` + `@EventListener`; `@TransactionalEventListener` fires after commit |

## 5.11 Spring Data JPA

#### Theory: start here

**In one sentence:** Spring Data JPA generates repository implementations for you: you declare an interface, and query methods are derived from their names.

Instead of writing DAO classes, you write `interface CarRepository extends JpaRepository<Car, Long>` and get save, findById, findAll, delete and paging for free. A method like `findByMakeAndYearGreaterThan(String make, int year)` is parsed at startup into a query. For anything complex you write `@Query` with JPQL or SQL.

**Key terms**

- **Repository**: Interface for data access to one entity type.
- **Derived query**: Query generated from a method name.
- **Pageable / Page / Slice**: Paging request; page with total count; page without count.
- **@Modifying**: Marks an update/delete @Query.
- **Specification**: Composable dynamic filters.

**How it works**

1. At startup Spring creates a proxy implementation for each repository interface.
2. Method names are parsed into queries (a typo fails startup).
3. Calls run inside the current transaction using the EntityManager.

**In real projects**

- Use Page for UIs that need totals, Slice for infinite scroll; keyset pagination for deep pages.
- Projections (interfaces or records) to fetch only needed columns.

**Common mistakes**

- Very long derived method names; switch to @Query.
- Bulk @Modifying updates leaving stale entities in the persistence context.

#### Notes and pictures

```java
interface CarRepo extends JpaRepository<Car, Long> {
    List<Car> findByCityAndPriceLessThan(String city, long price);          // query derived from the name
    Page<Car> findByCity(String city, Pageable p);                           // pagination
    @Query("select c from Car c where c.year >= :y") List<Car> newer(@Param("y") int y);
    @Modifying @Query("update Car c set c.sold = true where c.id = :id") int markSold(@Param("id") long id);
}
// Dynamic filters: Specification<Car> (the Specification pattern) or Querydsl
```

## 5.12 Testing Spring apps

#### Theory: start here

**In one sentence:** Test a Spring app at several levels: fast plain unit tests for logic, "slice" tests for one layer, and a few full-context integration tests.

Most tests should be plain JUnit tests of your classes with dependencies passed in (constructor injection makes this easy). For a single layer, Spring offers **slice** tests that load only part of the app: `@WebMvcTest` for controllers (with MockMvc), `@DataJpaTest` for repositories. `@SpringBootTest` loads everything and is the slowest. Testcontainers runs a real database in Docker for realistic tests.

**Key terms**

- **Unit test**: Tests one class in isolation, no Spring.
- **Slice test**: Loads only one layer's beans.
- **MockMvc**: Calls controllers through the MVC pipeline without a server.
- **@MockBean / @MockitoBean**: Replaces a bean in the Spring context with a mock.
- **Testcontainers**: Throwaway Docker containers (PostgreSQL, Kafka) for tests.

**How it works**

1. Write unit tests for services with mocks or fakes.
2. Write @WebMvcTest tests for status codes, validation and JSON.
3. Write @DataJpaTest + Testcontainers tests for queries.
4. A few @SpringBootTest tests for end-to-end wiring.

**In real projects**

- Keep test configuration consistent so Spring can reuse cached contexts.
- Test against the same database engine as production.

**Common mistakes**

- Everything as @SpringBootTest (slow suites).
- H2 passing tests that fail on PostgreSQL.

#### Notes and pictures

```
            ▲  few, slow      @SpringBootTest + Testcontainers (real Postgres)  ← full context
           ▲▲▲                @WebMvcTest (controller + MockMvc)  @DataJpaTest (repo + DB)  ← slices
         ▲▲▲▲▲▲▲  many, fast  plain JUnit + Mockito: new Service(mockRepo)  ← no Spring at all
```

```java
@WebMvcTest(CarController.class)
class CarControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean CarService svc;          // @MockBean before Boot 3.4
    @Test void get() throws Exception {
        when(svc.get(1)).thenReturn(new CarDto(1, "Swift"));
        mvc.perform(get("/cars/1")).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Swift"));
    }
}
```

## 5.13 Microservices

### Circuit breaker, timeouts, retries

#### Theory: start here

**In one sentence:** When a downstream service is slow or failing, timeouts stop you waiting forever, retries handle brief glitches, and a circuit breaker stops calling it for a while so failures don't cascade.

In microservices, your service calls others over the network, and they *will* sometimes be slow or down. Without protection, your threads pile up waiting, and you go down too: a **cascading failure**.

A **circuit breaker** works like the one in your house. While calls succeed it's **CLOSED** (current flows). If too many fail, it trips **OPEN** and fails calls immediately without trying, giving the other service time to recover. After a wait it goes **HALF_OPEN** and lets a few test calls through; if they succeed, it closes again.

**Key terms**

- **Timeout**: Maximum time to wait for a call.
- **Retry with backoff**: Try again after increasing, randomised delays.
- **Circuit breaker**: Stops calls to a failing dependency for a while.
- **Fallback**: What to return when the call can't be made (cached value, default).
- **Bulkhead**: Limits concurrent calls to one dependency.

**How it works**

1. Every remote call gets a timeout.
2. A few retries with backoff and jitter, only for idempotent calls.
3. The breaker tracks failures in a sliding window and trips at a threshold.
4. While OPEN, return the fallback immediately; probe in HALF_OPEN.

**In real projects**

- Resilience4j with Spring Boot annotations (@CircuitBreaker, @Retry, @TimeLimiter, @Bulkhead).
- Monitor breaker state changes; they're early warnings.

**Common mistakes**

- Retries at every layer, multiplying load.
- No timeouts (some HTTP clients wait forever by default).

### Saga and the Outbox pattern

#### Theory: start here

**In one sentence:** A saga replaces one big distributed transaction with a series of local transactions plus "undo" steps; the outbox pattern makes saving data and publishing an event reliable.

An order touches several services, each with its own database: create order, charge payment, reserve stock. There's no single transaction across them. A **saga** runs each step as a local transaction. If a later step fails, it runs **compensations** for the earlier ones in reverse: refund the payment, cancel the order.

Services usually communicate through events. But "save to my DB" and "publish to Kafka" are two systems, so one can succeed while the other fails. The **outbox pattern** writes the event into an `outbox` table *in the same DB transaction* as the data; a separate relay reads that table and publishes to the broker.

**Key terms**

- **Saga**: Sequence of local transactions with compensating actions.
- **Compensation**: A business "undo" (refund, release stock).
- **Orchestration / choreography**: A central coordinator / services reacting to each other's events.
- **Outbox**: Table of events written in the same transaction as business data.
- **At-least-once**: Messages may be delivered more than once, never lost.

**How it works**

1. Step 1 commits locally and emits an event (via the outbox).
2. The next service reacts, does its local transaction, emits its event.
3. A failure triggers compensations for completed steps, in reverse order.
4. Consumers deduplicate by event id because delivery is at-least-once.

**In real projects**

- Expose intermediate states to users (PENDING, CONFIRMED).
- Make compensations idempotent and retryable.

**Common mistakes**

- Publishing to Kafka inside a DB transaction and assuming both happen.
- Consumers that can't handle duplicate events.

### Idempotency keys (no double charge)

#### Theory: start here

**In one sentence:** An idempotency key lets a client safely retry a request (like a payment) without the server doing it twice.

A client sends "charge $50", the network times out, and the client doesn't know whether it worked. Retrying might charge twice. The fix: the client generates a unique **idempotency key** per logical operation and sends it with the request. The server records the key with the result. If the same key arrives again, it returns the stored result instead of charging again.

**Key terms**

- **Idempotent**: Doing it once or many times has the same effect.
- **Idempotency key**: Client-generated unique id for one logical operation.
- **Unique constraint**: Database rule that rejects duplicate keys atomically.

**How it works**

1. Client creates a key (UUID) and sends it in a header.
2. Server inserts the key (status IN_PROGRESS); a unique constraint means only one request wins.
3. Server performs the operation, stores the response with the key.
4. A retry with the same key gets the stored response; a concurrent duplicate waits or gets 409.

**In real projects**

- Stripe and most payment APIs work this way; pass the key on to downstream providers.
- Store a hash of the request body to reject the same key used with different data.
- Expire keys after a retention period, and reconcile any stuck IN_PROGRESS ones.

**Common mistakes**

- Checking for the key and then inserting it (a race), instead of relying on the unique constraint.
- Keeping keys in one pod's memory.

### Overview: notes and pictures

```
               client
                 │
            API Gateway  (auth, rate limit, routing)
          ┌──────┼───────────┐
          ▼      ▼           ▼
       Order   Payment    Inventory        each: own DB, deployed independently
        │ DB     │ DB        │ DB
        └── events via Kafka ┘              async: loose coupling, retries, replay
```

| Concept | Picture / one-liner |
|---|---|
| Service discovery | services register (Eureka / Kubernetes DNS); callers look them up by name |
| Circuit breaker | `CLOSED ─failures─► OPEN (fail fast) ─wait─► HALF_OPEN (try one) ─ok─► CLOSED` (Resilience4j) |
| Timeouts + retries | every remote call has a timeout; retry only idempotent calls, with backoff + jitter |
| Saga | a distributed transaction as local steps + compensations: `order ✔ → payment ✔ → stock ✘ → refund payment → cancel order` |
| Outbox pattern | write the business row + an event row in ONE DB tx; a relay publishes the event to Kafka → no lost or phantom events |
| Idempotency key | the client sends a key; the server stores it and returns the same result on a retry → no double charge |
| Observability | logs + metrics + traces (trace ID passed in headers across services) |
| Monolith vs microservices | microservices give independent deploy/scale and team ownership, at the cost of network failures, distributed data and ops overhead |

# Part 6: Real-world scenarios

Production incidents that combine several topics above. Each one has a step-by-step walkthrough in the visualizer.

| # | Scenario | What goes wrong | Fix |
|---|---|---|---|
| 6.1 | Flash sale, 2 pods, stock 1 | both pods `SELECT stock = 1`, both pass the check, both commit → 2 orders. `synchronized` only locks one JVM | `UPDATE … SET stock = stock - :q WHERE id = :id AND stock >= :q` and check rows affected; `@Version`; CHECK constraint |
| 6.2 | Memory leak | `static HashMap` cache whose key includes `nanoTime()` → 0% hits, grows forever; heap floor after full GC rises until OOM | heap dump → dominator tree → path to GC roots; bounded, expiring Caffeine cache with metrics |
| 6.3 | Batch never finishes | pool tasks `join()` on subtasks queued to the **same** fixed pool → every thread waits, nothing runs, no deadlock reported | compose with `thenCombine`, separate bounded I/O pool, `orTimeout` |
| 6.4 | Checkout outage | HTTP + SMTP inside `@Transactional` hold DB connections; slow provider → pool exhausted (Little's law: rate × hold time) → every endpoint and the health check fail; email sent before a failed commit | short transactions, remote calls outside, `@TransactionalEventListener(AFTER_COMMIT)` / outbox, timeouts, breaker, `open-in-view: false` |
| 6.5 | Cache stampede | hot key expires; rate × reload time requests all miss and run the same query → DB overload feeds itself | single-flight per key (`putIfAbsent` of a future), TTL jitter, refresh-ahead, negative caching |
| 6.6 | Shared `SimpleDateFormat` | its parse state lives in fields → concurrent parses return each other's dates, no exception | immutable `DateTimeFormatter` / `LocalDate`; audit singletons and statics for mutable state |

## 6.1 Flash sale: overselling the last unit

### Theory: start here

**In one sentence:** When several app instances update the same database row, Java locks can't protect it; the database must make "check and update" one atomic step.

In production you run several copies of your service (pods) for scale and resilience. Each is a separate JVM, so `synchronized` in one doesn't affect the others. If two pods both read "stock = 1", both decide there's enough, and both write, you sell the item twice.

The shared state lives in the database, so the guarantee must come from the database: a conditional UPDATE (`WHERE stock >= 1`), optimistic locking (`@Version`), or a row lock (`SELECT … FOR UPDATE`).

**Key terms**

- **Horizontal scaling**: Running several instances of the same service.
- **Conditional update**: UPDATE … WHERE (condition); rows affected tells you if it applied.
- **Optimistic locking**: Detect conflicts with a version column; retry on failure.
- **Pessimistic locking**: Lock the row while you work on it.

**How it works**

1. Replace "read, check in Java, write" with one SQL statement that checks and writes.
2. Check rows affected: 1 = success, 0 = condition failed (sold out).
3. Add a CHECK constraint as a safety net.

**In real projects**

- Inventory, seat booking, coupon redemption, account balances.

**Common mistakes**

- Assuming one pod forever; autoscaling will add a second.
- Using JPA read-modify-write for counters without @Version.

## 6.2 Memory leak in production: from alert to fix

### Theory: start here

**In one sentence:** A memory leak in Java is data that stays reachable but is never used again; you find it by watching GC behaviour and analysing a heap dump.

The GC frees only objects nothing points to. If a long-lived object (often a static collection or cache) keeps adding entries and never removes them, memory grows until the JVM spends all its time collecting and finally throws OutOfMemoryError.

The tell-tale sign is that the amount of memory still in use *right after a full GC* keeps rising over time. To find the cause, take a **heap dump** and look at the **dominator tree**: it shows which objects keep the most memory alive, and the path from GC roots shows why.

**Key terms**

- **Leak**: Reachable but useless objects accumulating.
- **Heap dump**: A snapshot of every object in the heap (.hprof).
- **Dominator tree**: Objects ranked by how much memory they keep alive.
- **Retained size**: Memory freed if that object were removed.

**How it works**

1. Confirm: memory after full GC rises over hours or days.
2. Capture: `jcmd <pid> GC.heap_dump` (or HeapDumpOnOutOfMemoryError).
3. Analyse in Eclipse MAT or IntelliJ: dominator tree, then path to GC roots.
4. Fix: bound, expire or remove the data; add a metric and alert.

**In real projects**

- Common sources: unbounded caches, ThreadLocals in pools, listeners never removed, unbounded queues.

**Common mistakes**

- Restarting pods on a schedule instead of fixing the leak.
- Taking no evidence before restarting.

## 6.3 Thread-pool starvation: the batch that never finishes

### Theory: start here

**In one sentence:** If tasks in a thread pool block waiting for other tasks queued in the same pool, every thread can end up waiting and nothing runs: thread-pool starvation.

A pool has a fixed number of threads. Suppose each task submits a subtask to the *same* pool and then blocks waiting for it. If all threads are busy doing that, the subtasks sit in the queue forever: there's no free thread to run them, and no thread will free up until they run. Unlike a lock deadlock, the JVM can't detect this; you just see a hang with idle CPUs.

**Key terms**

- **Starvation deadlock**: Tasks waiting for work that can't get a thread.
- **Non-blocking composition**: Chaining futures (thenCombine) instead of waiting with join/get.
- **Bulkhead**: Separate pools so one kind of work can't starve another.

**How it works**

1. Never call join()/get() inside a pool task on work queued to the same pool.
2. Compose futures so no thread waits.
3. Use separate, bounded pools for blocking I/O and CPU work.
4. Add timeouts so a stuck dependency fails instead of hanging.

**In real projects**

- Watch for nested parallel streams, nested @Async calls with .get(), and supplyAsync without an executor.

**Common mistakes**

- Increasing the pool size as the "fix"; it only raises the threshold.

## 6.4 Checkout outage: a long @Transactional drains the connection pool

### Theory: start here

**In one sentence:** A database transaction holds a connection from the pool until it commits; doing slow remote calls inside it can use up every connection and take down the whole service.

Connection pools (HikariCP) hold a small number of DB connections, often 10. `@Transactional` takes one at the first query and keeps it until commit. If the method then calls a slow payment API, the connection sits idle but unavailable. Under load, all connections get held this way, and every other request that needs the database, even simple reads and health checks, waits and times out.

**Little's law** tells you how many you need: connections in use = requests per second × seconds each one holds a connection.

**Key terms**

- **Connection pool**: A reusable set of DB connections (HikariCP).
- **Little's law**: L = λ × W: items in the system = arrival rate × time each spends.
- **Open-in-view**: Spring setting that keeps the persistence context open for the whole web request.
- **After-commit side effect**: An action (email, message) done only once the transaction succeeds.

**How it works**

1. Keep transactions to the database work only (milliseconds).
2. Do remote calls outside transactions.
3. Send emails and messages after commit (@TransactionalEventListener or the outbox).
4. Set HTTP timeouts and circuit breakers; set `spring.jpa.open-in-view=false`.

**In real projects**

- Monitor hikaricp_connections_active, pending, and usage time.
- Size pools from the database's connection limit across all pods.

**Common mistakes**

- "Fixing" it by making the pool bigger.
- Sending emails inside the transaction.

## 6.5 Cache stampede on a hot key

### Theory: start here

**In one sentence:** When a popular cache entry expires, all the requests that arrive before it's reloaded go to the database at once: a cache stampede.

Caches protect the database by serving repeated reads from memory. But when a hot key expires, the next request misses and starts reloading. Until it finishes, every other request for that key also misses. With high traffic that's hundreds or thousands of identical expensive queries at once, which slow the database down, which makes the miss window even longer.

The fix is **request coalescing** ("single-flight"): only one request reloads the key; the others wait for its result.

**Key terms**

- **Cache hit / miss**: Value found / not found in the cache.
- **TTL**: How long an entry lives.
- **Single-flight**: One loader per key; everyone else waits on it.
- **Refresh-ahead**: Reload in the background while still serving the old value.
- **Cache penetration**: Requests for keys that don't exist, always missing.

**How it works**

1. On a miss, atomically register "I'm loading key K" (putIfAbsent of a future).
2. The winner loads and fills the cache; others wait on its future.
3. Add random jitter to TTLs so keys don't expire together.
4. For hot keys, refresh in the background before expiry.

**In real projects**

- Caffeine's `get(key, loader)` already coalesces within one JVM; refreshAfterWrite gives refresh-ahead.
- Cache "not found" results briefly.

**Common mistakes**

- Identical TTLs for everything warmed at the same time.
- Slow loaders inside ConcurrentHashMap.computeIfAbsent.

## 6.6 Shared SimpleDateFormat: wrong data, no errors

### Theory: start here

**In one sentence:** Some common classes keep internal state in fields and aren't safe to share between threads; sharing one in a singleton silently corrupts results.

Spring beans are singletons, so their fields are shared by every request thread. If a bean holds a `SimpleDateFormat`, a `HashMap` that's written to, or a `StringBuilder`, threads overwrite each other's work. `SimpleDateFormat` is a classic: `parse()` uses an internal Calendar, so two concurrent parses can return each other's dates, with no exception.

The fix is to use immutable, thread-safe replacements (`DateTimeFormatter`, java.time types), or not share the object at all.

**Key terms**

- **Thread-safe**: Correct when used from several threads at once.
- **Immutable**: Can't change, so it's always safe to share.
- **Thread confinement**: Each thread uses its own instance.

**How it works**

1. Review static fields and singleton bean fields.
2. For each mutable, non-thread-safe object, replace it with an immutable alternative or create it per use.
3. Test concurrency-sensitive code with many threads, not only single-threaded unit tests.

**In real projects**

- java.time (DateTimeFormatter, LocalDate) for dates; ConcurrentHashMap for shared maps; ThreadLocalRandom for random numbers.

**Common mistakes**

- Assuming a class is thread-safe because it's in the JDK.
- Trusting single-threaded unit tests for concurrency bugs.

---

*End of guide. To step through any topic visually, open the [Java Visualizer](https://adityamalu.github.io/java-visualizer/).*
