/* 2.9 Immutable vs fixed-size vs view lists */
topic('2', { no:'2.9', title:'Immutable vs fixed-size vs view lists', idea:`Four "unmodifiable-ish" lists behave differently on add, set, null and source changes. Try each operation.`,
actors:'Operation', stateTitle:'Lists',
codes:{a:`String[] arr = {"a", "b"};
List<String> fixed = Arrays.asList(arr);           // view over arr
fixed.set(0, "z");             // ✔ writes through: arr[0] = "z"
fixed.add("c");                // ✘ UnsupportedOperationException
List<String> src = new ArrayList<>(List.of("a"));
List<String> view = Collections.unmodifiableList(src);
src.add("b");                  // view now shows [a, b]!
List<String> copy = List.copyOf(src);              // real snapshot
List.of("a", null);            // ✘ NullPointerException
List.of("a").contains(null);   // ✘ NPE as well`},
steps:[
{hl:{op:[1,2,3]}, th:[['op','set(0, "z"):ok','writes through']], g:[G('Arrays.asList(arr)',['backing','the array itself (no copy)'],['contents','[z, b]','hot']), G('arr',['contents','{z, b}','hot'])],
 say:`<code>Arrays.asList</code> is a <b>fixed-size view</b> over the array. <code>set</code> works and writes into the array; changes to the array show in the list.`},
{hl:{op:[4]}, th:[['op','add("c"):bad','size is fixed']], log:['✘ UnsupportedOperationException'],
 say:`<code>add</code>/<code>remove</code> would change the size, which an array can't do → <b>UnsupportedOperationException</b>. Also: <code>Arrays.asList(intArray)</code> gives a <code>List&lt;int[]&gt;</code> with one element. Use <code>IntStream</code> or boxed arrays.`},
{hl:{op:[5,6,7]}, th:[['op','src.add("b"):warn','view changes too']], g:[G('Collections.unmodifiableList(src)',['view.add(..)','✘ UOE'],['contents','[a, b]  (follows src)','hot'])],
 say:`<code>unmodifiableList</code> is a <b>read-only view</b>. <i>You</i> can't modify it through the view, but whoever holds <code>src</code> still can, and the view shows those changes. It's not a snapshot, so it's not safe to treat as immutable.`},
{hl:{op:[8]}, th:[['op','List.copyOf:ok','snapshot']], g:[G('List.copyOf(src)',['independent of src','yes','ok'],['mutators','all throw UOE'],['nulls','rejected'],['already immutable input','returns it as-is (no copy)'])],
 say:`<code>List.copyOf</code> / <code>List.of</code> are truly <b>immutable</b>: a new structure, unaffected by the source, safe to share between threads. Use them for defensive copies (1.10). <code>stream.toList()</code> (Java 16) also returns an unmodifiable list.`},
{hl:{op:[9,10]}, th:[['op','nulls:bad','']], log:['✘ NullPointerException','✘ NullPointerException'],
 g:[G('Summary',['List.of / copyOf','no add, no set, no null, no source'],['Arrays.asList','no add, set ✔, null ✔, backed by array'],['unmodifiableList','no add, no set, null ✔, reflects source'],['new ArrayList<>(x)','everything ✔, independent'])],
 say:`<code>List.of</code> rejects null elements, and even <code>contains(null)</code> throws. Keep this table in mind when an API returns a list and you try to modify it.`}
],
keep:[`Arrays.asList: fixed-size view, set writes through to the array.`,`unmodifiableList: read-only view, still changes with its source.`,`List.of / copyOf: truly immutable, no nulls.`]}, {
  imp: 'good',
  theory: TH(`Java has several kinds of "read-only" lists that behave very differently: fixed-size views, unmodifiable views, and truly immutable copies.`,
`<p><code>Arrays.asList(array)</code> gives a <b>fixed-size view</b> over an array: you can <code>set</code> elements (which writes to the array) but not add or remove. <code>Collections.unmodifiableList(list)</code> gives a <b>read-only view</b>: you can't change it through the view, but if someone changes the original list, the view shows it. <code>List.of(...)</code> and <code>List.copyOf(...)</code> give a <b>truly immutable</b> list that nothing can ever change.</p>
<p>Analogy: a view is a window onto someone else's room; an immutable copy is a photograph.</p>`,
[[`View`,`An object that presents another collection's data without copying it.`],[`Unmodifiable`,`Can't be changed through this reference.`],[`Immutable`,`Can't be changed by anyone, ever.`],[`UnsupportedOperationException`,`Thrown when you call a modifying method a collection doesn't support.`]],
[`Arrays.asList: backed by the array, fixed size, allows nulls.`,`unmodifiableList: wraps the list; mutators throw; still reflects source changes.`,`List.of / copyOf: own storage, all mutators throw, nulls rejected.`],
[`Return <code>List.copyOf(internal)</code> from getters to keep internals safe.`,`Use <code>new ArrayList&lt;&gt;(Arrays.asList(...))</code> if you need a growable list.`],
[`Assuming unmodifiableList is a snapshot.`,`Putting null into List.of, or calling <code>contains(null)</code> on it (both throw).`]),
  quiz: [
    [`<code>List&lt;String&gt; l = Arrays.asList("a", "b"); l.add("c");</code> What happens?`,[`UnsupportedOperationException: the list is fixed-size`,`l becomes [a, b, c]`,`Compile error: asList returns an immutable type`,`ArrayIndexOutOfBoundsException from the backing array`],0,`Arrays.asList is a fixed-size view over the array. set() works and writes through; add/remove don't.`,'E'],
    [`<code>List&lt;String&gt; view = Collections.unmodifiableList(src); src.add("x");</code> Does <code>view</code> contain "x"?`,[`No: unmodifiableList takes a snapshot`,`src.add throws UnsupportedOperationException`,`Yes: it's a read-only view of src`,`Only after view is created again`],2,`unmodifiableList blocks writes through the view, but reflects changes to the source. Use List.copyOf for a snapshot.`,'M'],
    [`<pre>String[] arr = {"a", "b"};
List&lt;String&gt; l = Arrays.asList(arr);
l.set(0, "z");
arr[1] = "y";</pre>What are <code>l</code> and <code>arr</code>?`,[`l = [z, b], arr = [a, y]`,`l = [z, y], arr = [z, y]`,`l = [z, b], arr = [z, y]`,`set throws UnsupportedOperationException`],1,`The list is a view over the same array, so writes go both ways.`,'H'],
    [`Which creates a truly immutable list?`,[`Arrays.asList(...)`,`List.of(...)`,`new ArrayList<>(...)`,`Collections.synchronizedList(...)`],1,`No add, set or remove.`,'E'],
    [`<code>Arrays.asList(1, 2, 3).set(0, 9)</code>?`,[`Throws UnsupportedOperationException`,`Works: fixed-size lists allow set`,`Compile error`,`Adds 9`],1,`Only size-changing operations are unsupported.`,'M'],
    [`<code>List.of(1, 2, 3).set(0, 9)</code>?`,[`It works, setting the first element to 9`,`Throws UnsupportedOperationException`,`It returns a new list with 9 at index 0`,`Compile error: List.of returns a read-only type`],1,`Fully immutable.`,'E'],
    [`<code>List.copyOf(list)</code> when list is already unmodifiable (from List.of)?`,[`It always makes a fresh copy`,`May return the same instance`,`It throws: the list is already immutable`,`It returns null for immutable input`],1,`No need to copy an immutable list.`,'H'],
    [`Which allows null elements?`,[`List.of`,`List.copyOf`,`Arrays.asList`,`Set.of`],2,`The of/copyOf factories reject nulls.`,'M'],
  ],
  quizAdv: [
    [`<code>List.of("a", null)</code>?`,[`Creates [a, null]`,`Silently drops the null`,`Creates an empty list`,`NullPointerException`],3,`List.of / Set.of / Map.of reject nulls.`,'M'],
    [`<code>List.of(1, 2, 3).contains(null)</code>?`,[`false`,`NullPointerException`,`true`,`UnsupportedOperationException`],1,`Immutable collections from List.of throw NPE even when queried with null.`,'H'],
    [`<code>Collections.unmodifiableList(src)</code>: who can still change the contents?`,[`Nobody`,`Anyone holding src`,`Only subclasses`,`The GC`],1,`It's a view, not a copy.`,'M'],
    [`<code>Set.of("a", "a")</code>?`,[`A set containing a single "a"`,`IllegalArgumentException: duplicate element`,`A set with two equal elements`,`Compile error: duplicate literal`],1,`Set.of rejects duplicates at creation.`,'H'],
  ],
});
