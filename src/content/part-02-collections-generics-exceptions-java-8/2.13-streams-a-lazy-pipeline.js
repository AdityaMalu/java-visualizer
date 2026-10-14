/* 2.13 Streams: a lazy pipeline */
topic('2', { no:'2.13', title:'Streams: a lazy pipeline', idea:`Push five elements through filter, map and limit one at a time. Watch short-circuiting skip work, and see why sorted() is a barrier.`,
actors:'Element in flight', stateTitle:'Pipeline', logTitle:'Execution log',
codes:{a:`List<String> out = Stream.of("c1", "c2", "c3", "c4", "c5")
    .filter(c -> { log("filter " + c); return !c.equals("c1"); })
    .map(c -> { log("map " + c); return c.toUpperCase(); })
    .limit(2)
    .collect(Collectors.toList());     // terminal: starts the flow`,
b:`Stream.of("b", "c", "a")
    .peek(x -> log("before " + x))
    .sorted()                          // stateful: must see ALL first
    .forEach(x -> log("after " + x));`,
c:`Map<String, Double> avg = cars.stream()
    .filter(c -> !c.sold())
    .collect(Collectors.groupingBy(Car::city,
             Collectors.averagingLong(Car::price)));
// stream reused?  -> IllegalStateException
// parallelStream() -> ForkJoinPool.commonPool (CPU work only)`},
steps:[
{cv:'a', hl:{pipe:[1,2,3,4]}, th:[], g:[G('pipeline (built, not run)',C('stages',['source','filter','map','limit(2)'])), G('result',C('collected',[['empty','dim']]))],
 say:`Intermediate operations (<code>filter</code>, <code>map</code>, <code>limit</code>) just <b>build a chain</b> of stage objects. <b>Nothing has run yet</b>, so the log is empty. A stream does no work until a <b>terminal</b> operation is called.`},
{hl:{pipe:[5,2]}, th:[['c1','RUN:bad','filter ✘ dropped']], log:['filter c1'],
 say:`<code>collect</code> starts pulling elements, <b>one at a time, through the whole chain</b> (vertical processing, not stage by stage). c1 fails the filter and stops there; map never sees it.`},
{hl:{pipe:[2,3,4]}, th:[['c2','RUN:ok','filter ✔ → map → collected']], g:[G('result',C('collected',[['C2','hot']]))], log:['filter c2','map c2'],
 say:`c2 passes filter, goes through map → "C2", and limit lets it through (1 of 2).`},
{th:[['c3','RUN:ok','filter ✔ → map → collected']], g:[G('result',C('collected',['C2',['C3','hot']]))], log:['filter c3','map c3'],
 say:`c3 likewise. limit has now reached 2.`},
{th:[['c4','NEW:dim','never pulled'],['c5','NEW:dim','never pulled']], g:[G('result',C('collected',[['C2','ok'],['C3','ok']])), G('short-circuit',['limit reached','stop asking the source','ok'],['filter calls','3 of 5'],['map calls','2 of 5'])], log:['(c4 and c5 never touched)'],
 say:`<b>Short-circuit:</b> limit is satisfied, so the pipeline stops pulling and c4, c5 are never evaluated. <code>findFirst</code>, <code>anyMatch</code> and <code>takeWhile</code> short-circuit the same way. This is how <code>Stream.iterate(1, x -&gt; x + 1).filter(...).limit(10)</code> works on an infinite source.`},
{cv:'b', logReset:true, hl:{pipe:[2,3]}, th:[['sorted','RUN:warn','buffering everything']], g:[G('sorted() buffer',C('collected',['b','c','a']))], log:['before b','before c','before a'],
 say:`<code>sorted()</code> is a <b>stateful</b> operation: it can't emit anything until it has seen <b>every</b> element, so the flow becomes stage-by-stage here. Same for <code>distinct()</code> (it keeps a set). Avoid them on huge or infinite streams.`},
{hl:{pipe:[4]}, th:[['sorted','TERM:ok','emitting in order']], log:['after a','after b','after c'],
 say:`Only after the upstream is exhausted does sorted emit a, b, c. Compare the log orders between the two examples: interleaved versus all "before"s first.`},
{cv:'c', logReset:true, hl:{pipe:[1,2,3,4]}, th:[], g:[G('groupingBy(city, averagingLong(price))',C('Pune',['6L','9L → avg 7.5L']),C('Delhi',['5L','3L → avg 4.0L']))], log:['{Delhi=4.0, Pune=7.5}'],
 say:`Collectors do the "reduce into a structure" work: <code>groupingBy</code> (+ a downstream collector like counting, averaging, mapping, toSet), <code>partitioningBy</code>, <code>toMap</code> (throws on duplicate keys unless you pass a merge function!), <code>joining</code>.`},
{hl:{pipe:[5,6]}, g:[G('Gotchas',['reuse a stream','IllegalStateException: already operated upon','bad'],['side effects in map/filter','hard to reason about; races if parallel','bad'],['parallelStream','shared commonPool; only for big CPU-bound work','bad'],['boxing','use mapToInt / IntStream.sum()','ok']), G('map vs flatMap',['[[a,b],[c]] map(List::size)','[2, 1]'],['[[a,b],[c]] flatMap(List::stream)','[a, b, c]'])],
 say:`A stream can be consumed <b>once</b>. Keep lambdas side-effect free. Parallel streams split the work with ForkJoin (4.15). They help only for large, CPU-heavy, easily splittable data (ArrayList, arrays) and hurt for I/O or small lists.`}
],
keep:[`Lazy: nothing runs until the terminal op. Elements flow one at a time.`,`Short-circuit ops (limit, findFirst, anyMatch) stop pulling early.`,`sorted/distinct are stateful barriers. One use per stream; careful with parallel.`]}, {
  imp: 'must',
  theory: TH(`A Stream is a pipeline for processing a sequence of elements declaratively (filter, map, collect), and it does no work until you ask for a result.`,
`<p>Instead of writing loops with temporary lists, you describe <i>what</i> you want: "from these orders, keep the paid ones, take their totals, sum them". <code>orders.stream().filter(Order::isPaid).mapToLong(Order::total).sum()</code>.</p>
<p>Streams are <b>lazy</b>: <code>filter</code> and <code>map</code> only build the pipeline. Nothing runs until a <b>terminal operation</b> like <code>collect</code>, <code>sum</code>, <code>findFirst</code> or <code>forEach</code>. Then elements flow through one at a time, like items on an assembly line, and operations like <code>findFirst</code> can stop early.</p>`,
[[`Source`,`Where elements come from: a collection, array, file lines, a generator.`],[`Intermediate operation`,`filter, map, sorted…: returns a new stream, lazy.`],[`Terminal operation`,`collect, count, forEach, reduce…: triggers processing.`],[`Short-circuiting`,`findFirst, anyMatch, limit: may stop before reading everything.`],[`Stateful operation`,`sorted, distinct: must see many or all elements before emitting.`]],
[`Build the pipeline: source → zero or more intermediate operations → one terminal operation.`,`The terminal operation pulls elements through the pipeline one by one.`,`Short-circuiting operations stop pulling once they have their answer.`,`A stream can be consumed only once.`],
[`Great for transformations and aggregations: grouping (<code>Collectors.groupingBy</code>), summing, mapping to DTOs.`,`Parallel streams use the shared ForkJoin common pool: only for CPU-heavy work on large data, never for I/O.`],
[`Side effects inside map/filter (e.g. adding to an external list).`,`Reusing a stream after a terminal operation.`,`Using streams where a simple loop is clearer.`]),
  quiz: [
    [`<pre>Stream.of(1, 2, 3).peek(System.out::println).map(x -> x * 2);</pre>What's printed?`,[`Nothing: there's no terminal operation`,`1 2 3`,`2 4 6`,`1 2 3, because peek runs eagerly`],0,`Streams are lazy. Intermediate operations just build the pipeline.`,'E'],
    [`<code>list.stream().filter(p).map(f).findFirst()</code> on 1 million elements; the 3rd matches. How many elements reach map?`,[`1,000,000`,`3`,`1`,`All matching elements`],2,`Elements flow one at a time and findFirst short-circuits, so only the first match reaches map.`,'M'],
    [`<pre>Stream.of(3, 1, 2)
  .peek(x -> System.out.print("p" + x + " "))
  .sorted().findFirst();</pre>What's printed?`,[`p3`,`p3 p1`,`p1`,`p3 p1 p2`],3,`sorted() is a stateful barrier: it must consume every element before it can emit the smallest.`,'H'],
    [`What does <code>map</code> do in a stream?`,[`It filters elements by a condition`,`It transforms each element`,`It sorts the elements`,`It collects them into a Map`],1,`One in, one out.`,'E'],
    [`What does <code>flatMap</code> do?`,[`It maps each element to a boolean`,`Maps each to a stream, then flattens`,`It sorts nested lists flat`,`Nothing: it's an alias for map`],1,`e.g. orders → their line items.`,'M'],
    [`<code>IntStream.range(0, 5).sum()</code>?`,[`15`,`10`,`5`,`0`],1,`0 + 1 + 2 + 3 + 4.`,'E'],
    [`Which is a terminal operation?`,[`filter`,`map`,`collect`,`peek`],2,`Terminal operations trigger processing.`,'E'],
    [`<code>Stream.of(1,2,3,4).filter(x -&gt; x % 2 == 0).count()</code>?`,[`2`,`4`,`3`,`1`],0,`2 and 4.`,'E'],
  ],
  quizAdv: [
    [`<code>list.parallelStream().forEach(results::add)</code> where results is an ArrayList?`,[`It works, since forEach is synchronized`,`Every element arrives, just out of order`,`It doesn't compile with a method reference`,`Elements can be lost, or an index exception`],3,`ArrayList isn't thread-safe. Use collect(toList()).`,'H'],
    [`<code>Stream.iterate(1, x -> x * 2).filter(x -> x &lt; 100).count()</code>?`,[`7, since 2⁰ … 2⁶ are below 100`,`It never finishes: the stream is infinite`,`6, since 1 itself isn't counted`,`IllegalStateException on count()`],1,`Use takeWhile or the three-argument iterate.`,'H'],
    [`When is a parallel stream likely to help?`,[`Small lists where splitting is cheap`,`Big CPU-bound work on splittable sources`,`Blocking I/O calls such as HTTP`,`LinkedList pipelines with sorted()`],1,`Measure; it uses the shared common pool.`,'H'],
    [`<code>reduce(0, Integer::sum)</code> vs <code>mapToInt(x -&gt; x).sum()</code>?`,[`reduce is always faster than sum`,`Same result; mapToInt avoids boxing`,`Different results for large values`,`sum() doesn't exist on IntStream`],1,`Primitive streams avoid Integer allocation.`,'M'],
  ],
});
