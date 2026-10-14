/* 7.3 Collectors in depth: grouping, partitioning, toMap */
topic('7', { no:'7.3', title:'Collectors in depth: grouping, partitioning, toMap', imp:'must', idea:`The stream collectors interviewers actually ask about, run on one small data set: groupingBy with downstream collectors, partitioningBy, the toMap duplicate-key trap, joining, and sorted results.`,
actors:'Thread', stateTitle:'Results',
codes:{a:`record Order(String customer, String city, long amount, boolean paid) {}

Map<String, List<Order>> byCity =
    orders.stream().collect(groupingBy(Order::city));
Map<String, Long> totalByCity =
    orders.stream().collect(groupingBy(Order::city, summingLong(Order::amount)));
Map<Boolean, Long> paidCount =
    orders.stream().collect(partitioningBy(Order::paid, counting()));
Map<String, Long> byCustomer =
    orders.stream().collect(toMap(Order::customer, Order::amount));
Map<String, Long> merged =
    orders.stream().collect(toMap(Order::customer, Order::amount, Long::sum));
String names = orders.stream().map(Order::customer).distinct()
    .sorted().collect(joining(", ", "[", "]"));
TreeMap<String, Long> countByCity = orders.stream()
    .collect(groupingBy(Order::city, TreeMap::new, counting()));`},
steps:[
{hl:{main:[1]}, th:[], g:[G('orders',['Ana · Pune · 300','paid'],['Raj · Delhi · 200','unpaid'],['Ana · Delhi · 500','paid'],['Mia · Pune · 100','paid'])],
 say:`Four orders. A <b>collector</b> is the recipe a terminal <code>collect(...)</code> uses to build the result: a list, a map, a string, a number. The static methods come from <code>java.util.stream.Collectors</code>.`},
{hl:{main:[3,4]}, g:[G('byCity (HashMap)',['Pune','[Ana 300, Mia 100]','hot'],['Delhi','[Raj 200, Ana 500]','hot'])],
 say:`<code>groupingBy(classifier)</code> puts each element in a bucket keyed by the classifier's result. By default the values are Lists and the map is a HashMap (no guaranteed key order).`},
{hl:{main:[5,6]}, g:[G('totalByCity',['Pune','400','hot'],['Delhi','700','hot'])],
 say:`The second argument is a <b>downstream collector</b>: what to do with each bucket. <code>summingLong</code> totals amounts per city. Others: <code>counting()</code>, <code>averagingLong</code>, <code>mapping(fn, toList())</code>, <code>maxBy</code>, <code>toSet()</code>.`},
{hl:{main:[7,8]}, g:[G('paidCount',['true','3','ok'],['false','1','bad'])],
 say:`<code>partitioningBy</code> is grouping by a yes/no predicate. The result always has <b>both</b> keys, true and false, even if one group is empty.`},
{hl:{main:[9,10]}, g:[G('toMap(customer, amount)',['Ana','300'],['Raj','200'],['Ana (again)','500 → conflict','bad'])], log:['java.lang.IllegalStateException: Duplicate key Ana (attempted merging values 300 and 500)'],
 say:`<b>The classic trap.</b> <code>toMap(keyFn, valueFn)</code> assumes keys are unique. Ana has two orders, so it <b>throws IllegalStateException</b>. It works in testing with clean data and fails in production. toMap also throws NullPointerException on null values.`},
{hl:{main:[11,12]}, g:[G('merged',['Ana','300 + 500 = 800','ok'],['Raj','200'],['Mia','100'])],
 say:`Pass a <b>merge function</b> as the third argument to say what to do on duplicate keys: sum, keep first <code>(a, b) -&gt; a</code>, keep latest, and so on. Add a fourth argument (<code>LinkedHashMap::new</code>) to choose the map type.`},
{hl:{main:[13,14]}, g:[G('names',['distinct + sorted','Ana, Mia, Raj'],['joining(", ", "[", "]")','"[Ana, Mia, Raj]"','ok'])],
 say:`<code>joining(separator, prefix, suffix)</code> builds a string. <code>distinct()</code> removes duplicates using equals/hashCode, and <code>sorted()</code> uses natural order (or pass a Comparator).`},
{hl:{main:[15,16]}, g:[G('countByCity (TreeMap)',['Delhi','2'],['Pune','2'],['key order','sorted: Delhi, Pune','ok'])],
 say:`<code>groupingBy(classifier, mapFactory, downstream)</code> lets you choose the map: TreeMap for sorted keys, LinkedHashMap for first-seen order. Also handy: <code>collectingAndThen(toList(), List::copyOf)</code>, and <code>stream.toList()</code> (Java 16, unmodifiable) vs <code>Collectors.toList()</code> (no guarantees about mutability).`}
],
keep:[`groupingBy(key[, mapFactory][, downstream]) — downstream: counting, summingLong, mapping, toSet…`,`partitioningBy always has both true and false keys.`,`toMap throws on duplicate keys (and null values): pass a merge function.`]}, {
  imp: 'good',
  theory: TH(`Collectors describe how a stream's elements are gathered into a final result, such as a list, a grouped map, a count or a joined string.`,
`<p>A stream pipeline ends with a terminal operation. <code>collect(collector)</code> is the most flexible one: the collector decides what to build. Simple ones: <code>toList()</code>, <code>toSet()</code>, <code>joining()</code>. Powerful ones build maps: <code>groupingBy</code> groups elements by a key, <code>partitioningBy</code> splits them into true/false, and <code>toMap</code> creates one entry per element.</p>
<p>Grouping collectors take a second, <b>downstream</b> collector that decides what each group becomes: a count, a sum, a set of names. This is the Java equivalent of SQL's GROUP BY.</p>`,
[[`Collector`,`A recipe for accumulating elements into a result.`],[`groupingBy`,`Map from key → elements (or a downstream result).`],[`Downstream collector`,`What to do with each group (counting, summing, mapping…).`],[`partitioningBy`,`Map with exactly two keys: true and false.`],[`Merge function`,`toMap's rule for combining values with the same key.`]],
[`Pick the shape you want: list, map, string, number.`,`For maps: choose key function, then downstream or value function.`,`Handle duplicates (toMap merge function) and choose the map type if order matters.`,`Collect.`],
[`Reports and dashboards: totals per customer, counts per status.`,`Index a list by id: <code>toMap(User::id, identity())</code> when ids are unique.`],
[`toMap without a merge function on data that may contain duplicate keys.`,`Assuming groupingBy's map is sorted.`,`Building huge in-memory groupings that belong in a SQL query.`]),
  quiz: [
    [`<code>toMap(Order::customer, Order::amount)</code> and two orders share a customer. Result?`,[`The later value silently replaces the earlier one`,`The amounts are summed under that customer's key`,`IllegalStateException: Duplicate key`,`A Map whose value is a List of both amounts`],2,`Pass a merge function as the third argument.`,'E'],
    [`What does <code>partitioningBy(Order::paid)</code> return when every order is paid?`,[`A map with only the true key, since no order was unpaid`,`A map with true → all orders and false → empty list`,`A Map of true and false to the number of matching orders`,`A List of two lists: paid orders first, then unpaid ones`],1,`partitioningBy always contains both keys.`,'M'],
    [`You need total amount per city, with cities in alphabetical order. Which?`,[`groupingBy(Order::city, TreeMap::new, summingLong(Order::amount))`,`groupingBy(Order::city, summingLong(Order::amount))`,`toMap(Order::city, Order::amount)`,`partitioningBy(Order::city)`],0,`The map factory chooses TreeMap; the downstream sums.`,'H'],
    [`<code>Collectors.groupingBy(Order::city)</code> produces?`,[`List&lt;Order&gt;`,`Map&lt;String, List&lt;Order&gt;&gt;`,`Set&lt;String&gt;`,`Map&lt;String, Order&gt;`],1,`Values are lists by default.`,'E'],
    [`Count orders per city?`,[`groupingBy(Order::city)`,`groupingBy(Order::city, counting())`,`toMap(Order::city, 1)`,`partitioningBy(Order::city)`],1,`Downstream counting.`,'E'],
    [`<code>joining(", ")</code> on [a, b, c]?`,[`abc`,`a, b, c`,`[a, b, c]`,`a,b,c,`],1,`Separator between elements.`,'E'],
    [`Names of customers per city?`,[`groupingBy(Order::city, mapping(Order::customer, toList()))`,`groupingBy(Order::customer, mapping(Order::city, toList()))`,`toMap(Order::city, Order::customer)`,`groupingBy(Order::city, counting())`],0,`mapping transforms before collecting.`,'M'],
    [`Which collector keeps the first value on duplicate keys?`,[`toMap(k, v)`,`toMap(k, v, (a, b) -&gt; a)`,`toMap(k, v, (a, b) -&gt; b)`,`groupingBy(k)`],1,`The merge function decides.`,'M'],
  ],
  quizAdv: [
    [`<code>toMap(User::id, User::email)</code> and one user's email is null?`,[`The entry maps to null`,`The entry is skipped`,`NullPointerException`,`IllegalStateException`],2,`Collectors.toMap uses HashMap.merge, which rejects null values.`,'H'],
    [`<code>stream.toList()</code> (Java 16) vs <code>collect(Collectors.toList())</code>?`,[`toList() returns an unmodifiable list; Collectors.toList() makes no such guarantee`,`They're identical: both return an ArrayList you can freely modify`,`toList() returns a LinkedList, while Collectors.toList() returns an ArrayList`,`Collectors.toList() is unmodifiable, while toList() returns a mutable copy`],0,`Calling add on stream.toList()'s result throws UnsupportedOperationException.`,'M'],
    [`<code>teeing(c1, c2, merger)</code> (Java 12) does?`,[`Runs two collectors on the same elements and merges their results`,`Splits a stream into two streams based on a predicate`,`Runs the two collectors one after another, feeding c1's result to c2`,`Zips two streams together element by element using the merger`],0,`e.g. min and max in one pass.`,'H'],
    [`Why might <code>groupingByConcurrent</code> be used with parallel streams?`,[`It guarantees the groups come out sorted in encounter order`,`It builds a ConcurrentMap directly, avoiding expensive map merging`,`Plain groupingBy throws when used on a parallel stream`,`It removes duplicate keys before grouping, so there are fewer keys`],1,`Order of values isn't preserved.`,'H'],
  ],
});
