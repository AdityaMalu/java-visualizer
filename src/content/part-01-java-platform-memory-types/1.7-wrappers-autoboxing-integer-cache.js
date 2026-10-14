/* 1.7 Wrappers, autoboxing, Integer cache */
topic('1', { no:'1.7', title:'Wrappers, autoboxing, Integer cache', idea:`<code>Integer.valueOf</code> reuses objects from -128 to 127, so <code>==</code> works by accident there and fails at 128. Then the unboxing NPE traps.`,
actors:'Variables', stateTitle:'Heap', dgTitle:'Which object each variable points to',
vb:'0 0 460 230',
nodes:{a:{x:60,y:40,label:'a',kind:'mem',w:60,h:34}, b:{x:60,y:95,label:'b',kind:'mem',w:60,h:34}, c:{x:60,y:150,label:'c',kind:'mem',w:60,h:34}, d:{x:60,y:205,label:'d',kind:'mem',w:60,h:34},
  i127:{x:330,y:68,label:'Integer{127}\n(IntegerCache)',w:150,h:46}, i128a:{x:330,y:150,label:'Integer{128} #1',w:150,h:34}, i128b:{x:330,y:205,label:'Integer{128} #2',w:150,h:34}},
codes:{a:`Integer a = 127, b = 127;   // Integer.valueOf(127): cached
Integer c = 128, d = 128;   // valueOf(128): two new objects
System.out.println(a == b);       // true  (same object)
System.out.println(c == d);       // false (different objects)
System.out.println(c.equals(d));  // true  (same value)
Integer n = null;
int x = n;                        // n.intValue() -> NPE
Integer v = flag ? 1 : n;         // NPE when flag is false!
Long sum = 0L;
for (long i = 0; i < 1_000_000; i++) sum += i;   // 1M boxings
List<Integer> list = new ArrayList<>(List.of(10, 1, 20));
list.remove(1);                   // removes INDEX 1 -> [10, 20]`},
steps:[
{hl:{main:[1]}, d:{type:'graph',hide:['c','d','i128a','i128b'],e:[['a','i127','','hot'],['b','i127','','hot']]},
 g:[G('IntegerCache',['range','-128 … 127 (pre-created at startup)'],['raise upper bound','-XX:AutoBoxCacheMax=1000'])],
 say:`<code>Integer a = 127</code> compiles to <code>Integer.valueOf(127)</code>, which returns the <b>shared, pre-built</b> object from IntegerCache. Both a and b point to the <b>same</b> object. Byte, Short, Long and Character cache the same range; Boolean caches TRUE and FALSE.`},
{hl:{main:[2]}, d:{type:'graph',e:[['a','i127','',''],['b','i127','',''],['c','i128a','','hot'],['d','i128b','','hot']]},
 say:`128 is outside the cache, so <code>valueOf(128)</code> creates a <b>new object each time</b>: c and d point to different objects.`},
{hl:{main:[3,4,5]}, log:['true','false','true'],
 say:`<code>==</code> on objects compares <b>references</b>. So it's true for 127 (same cached object) and false for 128. Code that compares wrappers with <code>==</code> passes small test values and fails in production with real IDs. <b>Always use <code>equals</code></b> (or unbox first). Float and Double have no cache at all.`},
{hl:{main:[6,7]}, d:null, g:[G('Auto-unboxing',['int x = n','compiles to n.intValue()'],['n','null','bad'])], log:['✘ NullPointerException'],
 say:`Assigning a wrapper to a primitive calls <code>intValue()</code>. On null that's an <b>NPE</b>. A classic case: <code>int count = map.get(key);</code> when the key is missing.`},
{hl:{main:[8]}, log:['✘ NullPointerException (flag == false)'],
 say:`<b>Sneakier:</b> in <code>flag ? 1 : n</code>, one branch is a primitive <code>int</code>, so Java's typing rules <b>unbox</b> <code>n</code> to int, and that throws NPE when n is null, even though the result is assigned to an Integer. Fix: <code>flag ? Integer.valueOf(1) : n</code>.`},
{hl:{main:[9,10]}, g:[G('sum += i with Long',['each iteration','unbox, add, box a NEW Long'],['objects created','~1,000,000 garbage Longs','bad'],['time vs long','several × slower','bad'])],
 say:`<code>Long sum</code> instead of <code>long sum</code> means unbox, add, and box a new object on every iteration: a million throwaway objects and GC churn. Use primitives in hot loops, and use <code>IntStream</code> / <code>mapToLong</code> to avoid boxing in streams.`},
{hl:{main:[11,12]}, g:[G('List<Integer> [10, 1, 20]',['remove(1)','remove(int index) wins → [10, 20]','bad'],['remove value 1','list.remove(Integer.valueOf(1)) → [10, 20]','ok'])], log:['[10, 20]  (removed the element at index 1, which happened to be 1)'],
 say:`Overload resolution prefers the exact primitive match <code>remove(int index)</code> over boxing to <code>remove(Object)</code> (see 3.2). To remove by value, pass an Integer: <code>list.remove(Integer.valueOf(1))</code>. Sizes for reference: byte 1, short 2, int 4, long 8, float 4, double 8, char 2 bytes. An Integer object is about 16 bytes.`}
],
keep:[`valueOf caches -128..127 → <code>==</code> "works" there, fails at 128. Use equals.`,`Unboxing null → NPE, including inside a ternary with a primitive branch.`,`Boxing in hot loops = garbage; list.remove(int) vs remove(Object).`]}, {
  imp: 'must',
  theory: TH(`Primitives (int, long…) are plain values; wrappers (Integer, Long…) are objects. Java converts between them automatically, which is convenient but has traps.`,
`<p>Collections and generics only work with objects, so Java has a wrapper class for every primitive: <code>Integer</code> for <code>int</code>, and so on. <b>Autoboxing</b> converts <code>int → Integer</code> for you, and <b>unboxing</b> converts back. It makes <code>List&lt;Integer&gt; list; list.add(5)</code> just work.</p>
<p>Because wrappers are objects, <code>==</code> compares <b>identities</b>, not numbers. To save memory, <code>Integer.valueOf</code> keeps a cache of the values -128 to 127, so small numbers happen to be the same object and <code>==</code> seems to work. Then 128 comes along and it stops working.</p>`,
[[`Autoboxing`,`Automatic int → Integer, using Integer.valueOf.`],[`Unboxing`,`Automatic Integer → int, using intValue(). Throws NPE if the Integer is null.`],[`Integer cache`,`Shared Integer objects for -128..127.`],[`equals`,`Compares the numeric values of two wrappers.`]],
[`<code>Integer a = 100;</code> becomes <code>Integer.valueOf(100)</code>, a cached object.`,`<code>Integer b = 1000;</code> creates a new object each time.`,`Arithmetic (<code>a + b</code>) unboxes both to ints first.`,`Assigning a null Integer to an int (or using it in arithmetic) unboxes null → NullPointerException.`],
[`Compare wrappers with <code>equals</code> or <code>Objects.equals</code>, never ==.`,`Use <code>map.getOrDefault(key, 0)</code> instead of unboxing a possibly-null <code>get</code>.`,`Avoid boxing in hot loops (e.g. <code>Long sum</code>); it creates garbage.`],
[`<code>list.remove(1)</code> on a List&lt;Integer&gt; removes index 1, not the value 1.`,`A ternary mixing Integer and int unboxes and can throw NPE.`]),
  quiz: [
    [`<pre>Integer a = 127, b = 127, c = 128, d = 128;
System.out.println((a == b) + " " + (c == d));</pre>`,[`true true`,`false false`,`false true`,`true false`],3,`Integer.valueOf caches -128..127 by default, so a and b are the same object; 128 creates two objects. Always compare with equals.`,'M'],
    [`<pre>Integer x = null;
int y = flag ? x : 0;</pre>When <code>flag</code> is true, what happens?`,[`y is 0, because a null Integer converts to 0`,`NullPointerException from unboxing x`,`Compile error: Integer and int can't be mixed in a ternary`,`The result is boxed, so y becomes null`],1,`The ternary has a primitive branch, so its type is int and x is unboxed. Unboxing null throws NPE.`,'H'],
    [`<code>List&lt;Integer&gt; list = new ArrayList&lt;&gt;(List.of(10, 20, 30)); list.remove(1);</code> What's the list now?`,[`[10, 30]`,`[20, 30]`,`[10, 20, 30], since the value 1 isn't in the list`,`Compile error: the call is ambiguous`],0,`remove(int index) is chosen over remove(Object), so index 1 (the value 20) goes. Use remove(Integer.valueOf(20)) to remove by value.`,'M'],
    [`What is autoboxing?`,[`Converting an Integer into its String form`,`Automatic primitive → wrapper conversion`,`Packing several objects into one JAR entry`,`Sorting boxed values automatically`],1,`Unboxing is the reverse.`,'E'],
    [`How should two Integer objects be compared for equal values?`,[`a == b, since both are Integers`,`a.equals(b) or Objects.equals(a, b)`,`a.compareTo(b) == 1`,`a.hashCode() == b.hashCode() only`],1,`== compares references.`,'E'],
    [`<code>Map&lt;String,Integer&gt; m = new HashMap&lt;&gt;(); int n = m.get("x");</code> Result?`,[`n = 0`,`NullPointerException`,`n = -1`,`Compile error`],1,`get returns null, unboxing null throws. Use getOrDefault.`,'M'],
    [`Why is <code>Long sum = 0L; for (...) sum += i;</code> slow in a hot loop?`,[`Long arithmetic is slower than int on every CPU`,`Each += unboxes and creates a new Long object`,`The sum overflows after a few iterations`,`It isn't slower than using a primitive long`],1,`Use the primitive long.`,'M'],
    [`<code>Integer a = 1000, b = 1000; a.equals(b)</code>?`,[`true`,`false`,`NullPointerException`,`Compile error`],0,`equals compares values regardless of caching.`,'E'],
  ],
  quizAdv: [
    [`<code>Long l = 127L; l.equals(127)</code>?`,[`false`,`true`,`Compile error`,`NullPointerException`],0,`127 boxes to an Integer, and Long.equals requires a Long. Also why map.get(127) misses on a Map&lt;Long,...&gt;.`,'H'],
    [`<code>Map&lt;String,Integer&gt; m</code>; <code>int n = m.get("missing");</code>?`,[`n is 0, the default for a missing int`,`n is -1, the not-found marker`,`Compile error: get returns Integer`,`NullPointerException when unboxing`],3,`get returns null, and unboxing null throws. Use getOrDefault.`,'M'],
    [`What does <code>Integer.valueOf(127) == Integer.valueOf(127)</code> rely on?`,[`The Integer cache for -128..127`,`The String pool sharing equal values`,`The JIT merging equal objects`,`Escape analysis removing the allocation`],0,`Never rely on it; use equals.`,'M'],
    [`<code>Character c = 'a'; c == 'a'</code>?`,[`true: c is unboxed to a char`,`false: they're different types`,`Compile error: char vs Character`,`NullPointerException on compare`],0,`Mixed wrapper/primitive == unboxes the wrapper.`,'H'],
  ],
});
