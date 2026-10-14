/* 2.10 Generics, type erasure, PECS */
topic('2', { no:'2.10', title:'Generics, type erasure, PECS', idea:`See the cast the compiler inserts, sneak an Integer into a List&lt;String&gt; through a raw type, then learn when to use extends vs super.`,
actors:'Compiler / JVM', stateTitle:'Types',
codes:{a:`List<String> names = new ArrayList<>();
names.add("Asha");
String s = names.get(0);           // compiler inserts (String) cast
List raw = names;                  // raw type: warning only
raw.add(42);                       // heap pollution: no error here
String t = names.get(1);           // ClassCastException HERE
// ✘ new T(), new T[n], x instanceof List<String>
// ✘ f(List<String>) + f(List<Integer>): same erasure`,
b:`List<Integer> ints = List.of(1, 2);
// List<Number> nums = ints;        // ✘ generics are INVARIANT
Object[] objs = new String[1];      // arrays are covariant
objs[0] = 42;                       // ✘ ArrayStoreException at run time

double sum(List<? extends Number> xs) {   // PRODUCER: you read
  double s = 0;
  for (Number n : xs) s += n.doubleValue();
  return s;                                // xs.add(..) ✘
}
void fill(List<? super Integer> out) {    // CONSUMER: you write
  out.add(1); out.add(2);
  Object o = out.get(0);                   // reads give Object
}`},
steps:[
{cv:'a', hl:{javac:[1,2,3]}, th:[['javac','RUN:ok','type-checks, then erases']], g:[G('Source',['List<String> names','names.get(0) : String']), G('Bytecode (erased)',['List names','(String) names.get(0)','hot'])],
 say:`Generics exist <b>at compile time only</b>. javac checks the types, then <b>erases</b> them: <code>List&lt;String&gt;</code> becomes a plain <code>List</code>, T becomes its bound (Object), and javac inserts <b>casts</b> where values come out. One <code>ArrayList</code> class serves every element type.`},
{hl:{javac:[4,5]}, th:[['javac','RUN:warn','unchecked warning'],['JVM','RUN:ok','sees List of Object']], g:[G('names (runtime)',C('elements',['"Asha"',['42','bad']]))],
 say:`A <b>raw type</b> switches off checking. At run time it's just a List of Objects, so 42 goes in without complaint. This is <b>heap pollution</b>.`},
{hl:{javac:[6]}, th:[['javac','TERM:dim',''],['JVM','RUN:bad','checkcast fails']], log:['✘ ClassCastException: Integer cannot be cast to String  (at line 6, not line 5)'],
 say:`The failure shows up <b>later</b>, at the compiler-inserted cast, far from the bug. That's why you treat unchecked warnings seriously. If you need a runtime type check, use <code>Collections.checkedList</code>.`},
{hl:{javac:[7,8]}, g:[G('Because types are erased',['new T()','✘ no T at run time → pass a Supplier<T> / Class<T>','bad'],['new T[n]','✘ → (T[]) new Object[n] or Array.newInstance','bad'],['instanceof List<String>','✘ → instanceof List<?>','bad'],['overload by type arg','✘ same erased signature','bad'],['Jackson List<Car>','needs TypeReference<List<Car>>(){}'])],
 say:`The consequences of erasure. Frameworks recover generic types from <b>class signatures</b> (a subclass's <code>extends Base&lt;Car&gt;</code> is kept in the class file), which is the "super type token" trick behind Jackson's <code>TypeReference</code> and Spring's <code>ParameterizedTypeReference</code>.`},
{cv:'b', hl:{javac:[1,2]}, th:[['javac','RUN:bad','incompatible types']], g:[G('If List<Integer> were a List<Number>…',['nums.add(3.14)','a Double inside a List<Integer>!','bad'],['so','List<Integer> is NOT a subtype of List<Number>','ok'])],
 say:`Generics are <b>invariant</b>: <code>List&lt;Integer&gt;</code> isn't a <code>List&lt;Number&gt;</code>, even though Integer is a Number. Otherwise you could add a Double through the Number view and break the Integer list.`},
{hl:{javac:[3,4]}, th:[['JVM','RUN:bad','ArrayStoreException']], log:['✘ java.lang.ArrayStoreException: java.lang.Integer'],
 say:`Arrays chose the other way: they're <b>covariant</b> (a String[] is an Object[]), and the JVM checks every store <b>at run time</b>. Generics catch the same mistake at <b>compile time</b>, which is one reason to prefer <code>List</code> over arrays in APIs.`},
{hl:{javac:[6,7,8,9,10]}, th:[['javac','RUN:ok','']], g:[G('? extends Number (producer)',['accepts','List<Integer>, List<Double>, List<Number>','ok'],['read element as','Number','ok'],['add(..)','✘ (which subtype is it really?)','bad'])],
 say:`<b>PECS: Producer Extends, Consumer Super.</b> If a parameter <b>gives you</b> values (you read from it), use <code>? extends T</code>. That makes it flexible for callers, but you can't add, because you don't know the exact element type.`},
{hl:{javac:[11,12,13,14]}, g:[G('? super Integer (consumer)',['accepts','List<Integer>, List<Number>, List<Object>','ok'],['add(Integer)','✔ safe in all of them','ok'],['read element as','Object only','bad'])],
 say:`If a parameter <b>takes</b> values from you (you write into it), use <code>? super T</code>: any list that can hold an Integer works. The JDK signature puts it together: <code>Collections.copy(List&lt;? super T&gt; dest, List&lt;? extends T&gt; src)</code>. Rule of thumb: wildcards in <b>parameters</b>, never in return types.`}
],
keep:[`Erasure: types checked at compile time, casts inserted, gone at run time.`,`Raw types → heap pollution → ClassCastException far from the bug.`,`Invariant generics; PECS: read from ? extends, write into ? super.`]}, {
  imp: 'must',
  theory: TH(`Generics let you write one class or method that works with many types while the compiler checks you don't mix them up; at run time the type information is erased.`,
`<p>Before generics, a List held plain Objects and you cast everything coming out, so mistakes appeared at run time. With <code>List&lt;String&gt;</code> the compiler knows what the list holds, rejects <code>add(42)</code>, and inserts the casts for you.</p>
<p>Java implements generics by <b>erasure</b>: after checking, the compiler removes the type arguments, so at run time a <code>List&lt;String&gt;</code> is just a List. That's why you can't do <code>new T()</code> or <code>instanceof List&lt;String&gt;</code>.</p>
<p><b>Wildcards</b> make APIs flexible. <code>? extends Number</code> means "some list of a Number subtype: I'll read from it". <code>? super Integer</code> means "a list that can hold Integers: I'll write into it". Remember <b>PECS</b>: Producer Extends, Consumer Super.</p>`,
[[`Type parameter`,`A placeholder like T in class Box&lt;T&gt;.`],[`Erasure`,`Generic types are removed after compilation; casts are inserted.`],[`Invariance`,`List&lt;Integer&gt; is not a List&lt;Number&gt;.`],[`Wildcard`,`? extends X (read), ? super X (write), ? (unknown).`],[`Raw type`,`Using List without &lt;…&gt;; disables checks.`]],
[`You declare <code>class Box&lt;T&gt; { T value; }</code>.`,`The compiler checks every use (<code>Box&lt;String&gt;</code> only takes Strings).`,`It erases T to Object (or its bound) and adds casts where values come out.`,`Wildcards let a method accept a family of related generic types safely.`],
[`Use generics in your own utilities and APIs: <code>Result&lt;T&gt;</code>, <code>Page&lt;T&gt;</code>.`,`Collections.copy, addAll and similar library methods use PECS in their signatures.`],
[`Raw types, which compile with warnings and fail later with ClassCastException.`,`Expecting <code>List&lt;Dog&gt;</code> to be passable as <code>List&lt;Animal&gt;</code>.`]),
  quiz: [
    [`Why can't you write <code>new T()</code> or <code>x instanceof List&lt;String&gt;</code>?`,[`T might be a primitive type`,`Generics only work with interfaces`,`The compiler can't check T without reflection`,`Type erasure: type arguments don't exist at run time`],3,`The compiler checks types and inserts casts; at run time List&lt;String&gt; is just List.`,'E'],
    [`A method adds Integers into a list that may be List&lt;Integer&gt;, List&lt;Number&gt; or List&lt;Object&gt;. Parameter type?`,[`List&lt;? super Integer&gt;`,`List&lt;? extends Number&gt;`,`List&lt;Integer&gt;`,`List&lt;?&gt;`],0,`PECS: Producer Extends, Consumer Super. You write into it, so it's a consumer.`,'M'],
    [`<pre>List&lt;Integer&gt; ints = new ArrayList&lt;&gt;();
List raw = ints;
raw.add("x");
Integer i = ints.get(0);</pre>Where does it fail?`,[`At raw.add: ArrayStoreException, like arrays`,`It doesn't compile at raw.add("x")`,`At ints.get(0): ClassCastException from an inserted cast`,`Nowhere: i simply ends up referring to "x"`],2,`Raw types only warn. The bad element sits in the list (heap pollution) until a cast fails far from the bug.`,'H'],
    [`What does the diamond <code>new ArrayList&lt;&gt;()</code> do?`,[`Creates a raw ArrayList without types`,`Lets the compiler infer the type argument`,`Makes the new list immutable`,`Nothing: it's only a style choice`],1,`Inferred from the target type.`,'E'],
    [`<code>List&lt;?&gt;</code> means?`,[`A list of Objects; you can add anything`,`Unknown element type: read only, no adds`,`A raw list with no type checks at all`,`A list that can only contain nulls`],1,`Unbounded wildcard.`,'M'],
    [`Generic method syntax?`,[`public T &lt;T&gt; first(List&lt;T&gt; l)`,`public &lt;T&gt; T first(List&lt;T&gt; l)`,`public T first&lt;T&gt;(List l)`,`public first(List&lt;T&gt; l)`],1,`Type parameters come before the return type.`,'M'],
    [`What does <code>&lt;T extends Comparable&lt;T&gt;&gt;</code> mean?`,[`T must be a subclass of the Comparable class`,`T must be comparable to itself, so compareTo can be called`,`T is any type at all; the bound is a hint`,`T must be a primitive such as int or long`],1,`A bounded type parameter.`,'M'],
    [`Can you create a <code>List&lt;int&gt;</code>?`,[`Yes: autoboxing makes primitive type arguments legal`,`No: needs a reference type, e.g. List&lt;Integer&gt;`,`Only since Java 21, via value classes`,`Yes, if the variable is declared with var`],1,`Primitives aren't allowed (until Valhalla).`,'E'],
  ],
  quizAdv: [
    [`Is <code>List&lt;Integer&gt;</code> a subtype of <code>List&lt;Number&gt;</code>?`,[`Yes, because Integer extends Number`,`Only for read operations`,`No: generics are invariant`,`Only through raw types`],2,`Otherwise you could add a Double to a List&lt;Integer&gt;. Use wildcards.`,'M'],
    [`Why is <code>new T[10]</code> illegal, while <code>List&lt;T&gt;</code> is fine?`,[`Arrays need their element type at run time`,`Arrays can't hold type-variable objects`,`T might be a primitive type like int`,`Generic arrays would waste memory`],0,`Arrays are reified and check stores (ArrayStoreException); generics aren't.`,'H'],
    [`What is a bridge method?`,[`A deprecated API kept for compatibility`,`A synthetic method javac adds after erasure`,`A method connecting two threads`,`A default method in an interface`],1,`e.g. compareTo(Object) calling compareTo(Car).`,'H'],
    [`Why does <code>Collections.copy(List&lt;? super T&gt; dest, List&lt;? extends T&gt; src)</code> use two wildcards?`,[`Only for style and readability`,`src produces (extends), dest consumes (super)`,`Type erasure requires two wildcards`,`It makes copying faster`],1,`Producer Extends, Consumer Super.`,'H'],
  ],
});
