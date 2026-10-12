# Java Concepts: Visual Guide

Core Java interview topics taught as **concept → picture → example → gotcha** instead of Q&A. Every section has an interactive step-by-step version in the [Java Visualizer](https://adityamalu.github.io/java-visualizer/).

- Part 1: Java platform, memory, types
- Part 2: Collections, generics, exceptions, Java 8+
- Part 3: OOP, SOLID, design patterns
- Part 4: Multithreading and concurrency
- Part 5: Spring Boot, JPA, microservices

How to read each concept: the **idea** in 1–2 lines → the **picture** (diagram) → the **example** (code) → **Gotcha** (what interviewers trip you on) → **Say it** (your 15-second answer).

---

# Part 1: Java platform, memory, types

## 1.1 JDK, JRE, JVM

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

| | add/remove | set | nulls | reflects source changes |
|---|---|---|---|---|
| `List.of(...)` | ✘ | ✘ | ✘ | no source |
| `Arrays.asList(arr)` | ✘ | ✔ | ✔ | yes (backed by the array) |
| `Collections.unmodifiableList(l)` | ✘ | ✘ | ✔ | yes (a read-only view) |
| `List.copyOf(l)` | ✘ | ✘ | ✘ | no (a copy) |

## 2.10 Generics and type erasure

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

```
 Interface = a CAPABILITY ("can do")          Abstract class = a PARTIAL BASE ("is a kind of")
 - many per class                             - one per class
 - no instance state                          - fields, constructors
 - default + static methods (Java 8)          - shared code + abstract steps
 e.g. Comparable, Runnable, PaymentGateway    e.g. AbstractReportGenerator (template method)
```

## 3.6 SOLID, each with a picture

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

```
  getInstance() ──► instance exists? ──yes──► return it
                          │ no
                          ▼
                    create once, store, return
```
Three thread-safe ways: double-checked locking with `volatile`, a static holder class, or `enum` (safest; survives reflection and serialization). Step-through: [Singleton](https://adityamalu.github.io/java-visualizer/#t3-7a).

### Factory: hide which class gets created

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

```
 CarFilter.builder()
     .city("Pune")        ─┐
     .maxPrice(600000)     ├─ set only what you need, in any order
     .minYear(2018)       ─┘
     .build()             → validate → new immutable CarFilter
 instead of new CarFilter("Pune", null, 600000, null, 2018, null)   ← telescoping constructor
```

### Strategy: swap an algorithm

```
 Checkout ──has──► «PaymentStrategy» pay()
                      ▲          ▲
                   UpiPay      CardPay       caller picks which one to plug in
```

### State: object changes behaviour as its state changes

```
 Auction:  [SCHEDULED] ──start──► [LIVE] ──end──► [SOLD]
                                   placeBid() ✔     placeBid() ✘ "auction closed"
 Each state is a class implementing placeBid(); the Auction delegates to its current state.
```
**Strategy vs State:** same shape; in Strategy the CALLER picks; in State the object switches ITSELF.

### Observer: publish an event to subscribers

```
                ┌──► SmsListener.onPlaced()
 OrderService ──┼──► EmailListener.onPlaced()      OrderService doesn't know who listens
  place(order)  └──► AnalyticsListener.onPlaced()
```
Real examples: Spring `ApplicationEvent`, Kafka consumers, UI event listeners.

### Decorator: add behaviour by wrapping

```
 new BufferedReader( new InputStreamReader( new FileInputStream("a.txt") ) )
     adds buffering    adds bytes→chars        reads bytes
 Each layer has the same interface and adds one thing.
```

### Proxy: control access with a stand-in

```
 caller ──► Proxy ──(check / start transaction / lazy load / cache)──► real object
 Spring @Transactional: the proxy opens a transaction, calls your method, commits or rolls back.
```
**Decorator vs Proxy:** both wrap with the same interface; Decorator ADDS features, Proxy CONTROLS access.

### Adapter: make an incompatible interface fit

```
 your code ──► «PaymentGateway».charge() ◄── StripeAdapter ──► Stripe SDK createCharge(...)
```

### Template method: fixed skeleton, one step varies

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

```
 big task ─split─► [half A] [half B] ─split─► [a1][a2][b1][b2] ... compute leaves, then join results

 Each worker has its own deque.  Busy worker:  [t1 t2 t3 t4]
                                 Idle worker steals from the OTHER end ─► takes t1
```
Used by parallel streams and CompletableFuture's default async methods.

## 4.16 Concurrent collections

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

```
 Platform threads: 1 Java thread = 1 OS thread (~1 MB stack) → thousands max
 Virtual threads:  millions of cheap JVM threads mounted on a few carrier (OS) threads

  VT1 VT2 VT3 VT4 VT5 ...
    \  |   |   |  /
   [carrier 1] [carrier 2]      VT blocks on I/O → unmounts → the carrier runs another VT
```
Good for thread-per-request servers doing blocking I/O. Not faster for CPU work. Watch for pinning inside `synchronized` (improved in JDK 24).

## 4.18 Classic coding problems: the pattern behind each

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

| Feature | One-liner |
|---|---|
| `@Async` | run a method on a thread pool (configure your own executor; same self-invocation proxy rule) |
| `@Scheduled(cron = ...)` | periodic jobs; on multiple pods add ShedLock so only one runs |
| `@Cacheable` | cache method results (Caffeine / Redis); `@CacheEvict` on updates |
| `@Retryable` | retry with backoff (spring-retry); only for idempotent operations |
| Events | `ApplicationEventPublisher` + `@EventListener`; `@TransactionalEventListener` fires after commit |

## 5.11 Spring Data JPA

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

---

*End of guide. To step through any topic visually, open the [Java Visualizer](https://adityamalu.github.io/java-visualizer/).*
