/* 2.12 Lambdas and method references */
topic('2', { no:'2.12', title:'Lambdas and method references', idea:`What a lambda captures, why captured locals must be effectively final, what <code>this</code> means inside one, and the four kinds of method reference.`,
actors:'Objects', stateTitle:'Under the hood',
codes:{a:`int base = 10;
Function<Integer, Integer> add = x -> x + base;   // captures base (a copy)
// base++;              // ✘ base must be effectively final
add.apply(5);           // 15
Runnable r1 = () -> System.out.println(this);       // 'this' = enclosing object
Runnable r2 = new Runnable() {
  public void run() { System.out.println(this); }   // the anonymous object
};
Function<String, Integer> len = String::length;     // unbound instance
Supplier<List<String>> mk = ArrayList::new;         // constructor
Predicate<String> blank = String::isBlank;
Predicate<String> ok = blank.negate().and(s -> s.length() < 20);`},
steps:[
{hl:{add:[1,2]}, th:[['add','created:ok','captured base = 10']], g:[G('first execution of line 2',['bytecode','invokedynamic'],['bootstrap','LambdaMetafactory spins a hidden class','hot'],['later executions','reuse the same call site']), G('lambda object',['captured','base = 10 (copied into a field)','hot'])],
 say:`A lambda is an implementation of a <b>functional interface</b> (exactly one abstract method). It's not compiled to an anonymous inner class file. javac emits <code>invokedynamic</code>, and on first use <b>LambdaMetafactory</b> generates a small hidden class. A lambda that <b>captures</b> variables copies their values into the new object.`},
{hl:{add:[3]}, th:[['add','RUN:bad','compile error if base changes']], g:[G('why effectively final',['captured','a COPY of the value'],['if base could change','lambda and method would disagree','bad'],['plus','lambda may run later, on another thread','bad'])],
 say:`Captured locals must be <b>effectively final</b> (never reassigned). The lambda holds a <b>copy</b>, so allowing changes would make the two copies silently diverge, and the lambda might run later on another thread. Fields and array elements can still change, which is a common source of races in parallel streams.`},
{hl:{add:[4]}, log:['15'],
 say:`<code>apply(5)</code> runs the body with x = 5 and the captured base = 10. Non-capturing lambdas (like <code>x -&gt; x * 2</code>) are usually <b>singletons</b>, so creating them costs nothing.`},
{hl:{r1:[5],r2:[6,7,8]}, th:[['r1','lambda:info','this = OrderService@1'],['r2','anonymous class:info','this = OrderService$1@2']], log:['OrderService@1','OrderService$1@2'],
 say:`<b><code>this</code> differs.</b> Inside a lambda, <code>this</code> is the <b>enclosing</b> instance (a lambda doesn't introduce a new scope). Inside an anonymous class, <code>this</code> is the anonymous object itself. A lambda that uses <code>this</code> captures the outer object, which can leak like an inner class (1.9).`},
{hl:{len:[9],mk:[10],blank:[11]}, th:[['len','method ref:ok',''],['mk','ctor ref:ok','']], g:[G('Method reference kinds',['static','Integer::parseInt  ≡ s -> Integer.parseInt(s)'],['bound instance','System.out::println  ≡ x -> System.out.println(x)'],['unbound instance','String::length  ≡ s -> s.length()','hot'],['constructor','ArrayList::new  ≡ () -> new ArrayList<>()'])],
 say:`Method references are shorthand for lambdas that just call one method. Know the four kinds. <code>String::length</code> is "unbound": the first argument becomes the receiver.`},
{hl:{ok:[12]}, th:[], g:[G('Core functional interfaces',['Function<T,R>','T → R  (andThen, compose)'],['Predicate<T>','T → boolean  (and, or, negate)'],['Consumer<T>','T → void'],['Supplier<T>','() → T  (lazy, factories)'],['BiFunction<T,U,R>','(T, U) → R'],['UnaryOperator<T>','T → T'],['IntFunction, ToLongFunction…','primitive versions: no boxing','ok'])],
 say:`Default methods like <code>negate</code>, <code>and</code> and <code>andThen</code> let you compose behaviour. Gotcha: the standard interfaces can't throw <b>checked</b> exceptions, so wrap them, or define your own <code>@FunctionalInterface</code> with <code>throws</code>.`}
],
keep:[`Lambda = functional interface instance; invokedynamic + LambdaMetafactory.`,`Captured locals are copied → must be effectively final.`,`this = enclosing object (not the lambda); 4 method-ref kinds.`]}, {
  imp: 'must',
  theory: TH(`A lambda is a short anonymous function you can pass around as a value; a method reference is an even shorter way to point at an existing method.`,
`<p>Many APIs need "a piece of behaviour": how to compare two items, what to do with each element, how to create something. Before Java 8 you wrote an anonymous class for that. A <b>lambda</b> (<code>(a, b) -&gt; a.price() - b.price()</code>) expresses just the logic.</p>
<p>A lambda can be used wherever a <b>functional interface</b> is expected: an interface with exactly one abstract method, like <code>Comparator</code>, <code>Runnable</code> or <code>Function</code>. A <b>method reference</b> (<code>String::length</code>, <code>System.out::println</code>) is shorthand for a lambda that just calls one method.</p>`,
[[`Functional interface`,`An interface with one abstract method (Function, Predicate, Supplier, Consumer…).`],[`Capture`,`A lambda using a local variable from the enclosing method.`],[`Effectively final`,`A local that's never reassigned, which lambdas are allowed to capture.`],[`Method reference`,`Class::staticMethod, obj::method, Class::instanceMethod, Class::new.`]],
[`The compiler checks the lambda's shape matches the interface's single method.`,`Captured locals are copied into the lambda, which is why they must not change.`,`<code>this</code> inside a lambda means the enclosing object (unlike an anonymous class).`,`At run time the JVM creates the lambda object via invokedynamic, often reusing one instance.`],
[`Use lambdas with streams, Optional, CompletableFuture, comparators and callbacks.`,`Keep lambdas short; move complex logic into a named method and use a method reference.`],
[`Trying to modify a captured local (<code>count++</code>) inside a lambda.`,`Long, multi-line lambdas that hide business logic.`]),
  quiz: [
    [`<pre>int count = 0;
list.forEach(x -> count++);</pre>Why doesn't this compile?`,[`forEach can't change any state outside the lambda`,`count would need to be declared volatile`,`Captured locals must be effectively final (copied in)`,`Lambdas can capture fields, but never local variables`],2,`Use a stream count(), or an AtomicInteger if you really need a side effect.`,'E'],
    [`Inside a lambda in an instance method, <code>this</code> refers to?`,[`The lambda object itself`,`The enclosing instance`,`The generated functional-interface class`,`Nothing: lambdas are static, so this doesn't compile`],1,`Unlike anonymous classes, lambdas don't introduce a new scope for this.`,'M'],
    [`<pre>String str = null;
Supplier&lt;Integer&gt; s = str::length;</pre>When does it fail?`,[`Later, when s.get() is first called`,`Compile error: str might be null`,`Never: s.get() simply returns 0`,`At creation: bound receivers are null-checked`],3,`A bound reference evaluates and null-checks the receiver when the reference is created, unlike the lambda () -> str.length().`,'H'],
    [`What is a functional interface?`,[`Any interface`,`An interface with exactly one abstract method`,`An interface with only default methods`,`A class with lambdas`],1,`@FunctionalInterface documents and checks it.`,'E'],
    [`Which functional interface takes a T and returns a boolean?`,[`Function`,`Supplier`,`Predicate`,`Consumer`],2,`Predicate&lt;T&gt;.test(T).`,'E'],
    [`Which takes nothing and returns a value?`,[`Supplier`,`Consumer`,`Runnable`,`Predicate`],0,`Supplier&lt;T&gt;.get().`,'E'],
    [`<code>ArrayList::new</code> is which kind of method reference?`,[`Static`,`Bound`,`Unbound`,`Constructor`],3,`Used as Supplier&lt;List&lt;T&gt;&gt; for example.`,'M'],
    [`Can a lambda throw a checked exception with <code>Function&lt;T,R&gt;</code>?`,[`Yes, any lambda can throw checked exceptions`,`No: apply() declares none, so wrap it`,`Only IOException is allowed`,`Only inside stream pipelines`],1,`A common annoyance with streams.`,'M'],
  ],
  quizAdv: [
    [`<code>String::length</code> used as a <code>Function&lt;String,Integer&gt;</code> is which kind of method reference?`,[`A static method reference`,`A bound instance method reference`,`Unbound: the argument becomes the receiver`,`A constructor reference`],2,`The four kinds: static, bound (str::length), unbound (String::length), constructor (ArrayList::new).`,'M'],
    [`Does a non-capturing lambda allocate a new object on each evaluation?`,[`Usually no: one cached instance is reused`,`Yes: a new anonymous class instance each time`,`Yes, and a whole new class each time`,`No: lambdas aren't objects at all`],0,`Capturing lambdas allocate (they hold the captured values); non-capturing ones are typically cached.`,'H'],
    [`How are lambdas compiled?`,[`As anonymous inner classes, one .class file each`,`Via invokedynamic, classes generated at run time`,`They're only ever interpreted`,`As static fields of the enclosing class`],1,`No extra .class file per lambda on disk.`,'H'],
    [`<code>Function&lt;Integer,Integer&gt; f = x -&gt; x + 1; f.andThen(x -&gt; x * 2).apply(3)</code>?`,[`7`,`8`,`6`,`4`],1,`(3 + 1) × 2.`,'M'],
  ],
});
