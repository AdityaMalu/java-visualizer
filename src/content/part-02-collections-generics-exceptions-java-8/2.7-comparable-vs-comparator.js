/* 2.7 Comparable vs Comparator */
topic('2', { no:'2.7', title:'Comparable vs Comparator', idea:`Sort cars by city, then price descending. Then three traps: subtraction overflow, a TreeSet that "loses" elements, and contract violations.`,
actors:'Comparison', stateTitle:'List',
codes:{a:`record Car(String name, String city, long price) {}
List<Car> cars = new ArrayList<>(List.of(
  new Car("i20", "Pune", 6), new Car("Swift", "Delhi", 5),
  new Car("City", "Pune", 9), new Car("Alto", "Delhi", 3)));
cars.sort(Comparator.comparing(Car::city)
    .thenComparing(Car::price, Comparator.reverseOrder()));
Comparator<Integer> bad = (a, b) -> a - b;           // ✘ overflow
bad.compare(Integer.MIN_VALUE, 1);                   // positive!
Set<Car> byPrice = new TreeSet<>(Comparator.comparingLong(Car::price));
byPrice.add(new Car("A", "X", 5));
byPrice.add(new Car("B", "Y", 5));                   // size stays 1!`},
steps:[
{hl:{cmp:[2,3,4]}, th:[], g:[G('cars (unsorted)',C('',['i20 Pune 6','Swift Delhi 5','City Pune 9','Alto Delhi 3']))],
 say:`<b>Comparable</b> puts one "natural" order <i>inside</i> the class (<code>compareTo</code>), like String or Integer. <b>Comparator</b> puts the order <i>outside</i>, so you can have many orders chosen by the caller. compare(a, b) &lt; 0 means a goes first.`},
{hl:{cmp:[5,6]}, th:[['cmp','Swift vs Alto:info','city: Delhi = Delhi → tie']], g:[G('comparator chain',['1. comparing(city)','"Delhi".compareTo("Delhi") = 0 → tie','hot'],['2. thenComparing(price, reverse)','compare(3, 5) = -1 → Swift first','ok'])],
 say:`<code>comparing(Car::city)</code> extracts a key and compares it. On a tie (0), <code>thenComparing</code> breaks the tie with the next key, here <b>reversed</b> price, so 5 comes before 3.`},
{th:[['cmp','i20 vs Swift:info','"Pune" vs "Delhi" > 0 → Swift first']], g:[G('comparator chain',['1. comparing(city)','"Pune".compareTo("Delhi") = 12 > 0','hot'],['2. thenComparing','not needed'])],
 say:`Different cities, so the first key decides. The tie-breaker is never consulted.`},
{th:[['cmp','done:ok','TimSort, stable']], g:[G('cars (sorted)',C('',[['Swift Delhi 5','ok'],['Alto Delhi 3','ok'],['City Pune 9','ok'],['i20 Pune 6','ok']]))],
 say:`<code>List.sort</code> uses <b>TimSort</b>: O(n log n), adaptive (fast on partly sorted data), and <b>stable</b>, so equal elements keep their original order. Arrays of primitives use dual-pivot quicksort instead (not stable, but that doesn't matter for primitives).`},
{hl:{cmp:[7,8]}, th:[['cmp','MIN_VALUE - 1:bad','overflow → wraps to +2147483647']], g:[G('(a, b) -> a - b',['a = -2147483648, b = 1','a - b overflows','bad'],['result','2147483647 → "a is bigger"','bad'],['fix','Integer.compare(a, b) / Comparator.naturalOrder()','ok'])], log:['2147483647  ✘ says MIN_VALUE > 1'],
 say:`<b>Trap 1:</b> the subtraction shortcut overflows for large-magnitude ints and gives wrong orderings (and possibly <code>IllegalArgumentException: Comparison method violates its general contract</code> from TimSort). Always use <code>Integer.compare</code> / <code>Long.compare</code>.`},
{hl:{cmp:[9,10,11]}, th:[['cmp','compare(A, B) = 0:bad','TreeSet treats as duplicate']], g:[G('TreeSet by price',C('elements',['A X 5']),['add(B, price 5)','compare → 0 → "already present"','bad'],['size()','1','bad'])], log:['size = 1  (B silently dropped)'],
 say:`<b>Trap 2:</b> TreeSet/TreeMap use the <b>comparator, not equals</b>, to decide duplicates. Two different cars with the same price compare as 0, so the second is dropped. Make the comparator <b>consistent with equals</b> by adding a unique tie-breaker: <code>.thenComparing(Car::name)</code>.`},
{th:[], g:[G('Comparator toolkit',['comparing(key)','extract and compare'],['comparingInt / Long / Double','no boxing'],['thenComparing','tie-breakers'],['reversed()','flip whole chain (careful: applies to everything before it)'],['nullsFirst / nullsLast','handle null keys'],['naturalOrder / reverseOrder','for Comparable types'])],
 say:`<b>Trap 3:</b> <code>comparing(a).thenComparing(b).reversed()</code> reverses <b>both</b> keys. To reverse only b, pass <code>Comparator.reverseOrder()</code> as the second argument, as on line 6. The contract: sign(compare(a,b)) = −sign(compare(b,a)), transitive, and consistent.`}
],
keep:[`Comparable = natural order inside the class; Comparator = many orders outside.`,`Never a − b; use Integer.compare. TimSort is stable.`,`TreeSet/TreeMap dedupe by comparator == 0 → add a unique tie-breaker.`]}, {
  imp: 'must',
  theory: TH(`Sorting needs a rule for "which comes first". Comparable puts one natural rule inside the class; a Comparator is a separate rule you can pass in.`,
`<p>Sorting numbers is obvious; sorting Cars isn't. By price? By year? A class can implement <b>Comparable</b> to define its one <i>natural</i> order (<code>compareTo</code>), the way Strings sort alphabetically. When you need other orders, you write a <b>Comparator</b>, an external rule like "by price, highest first, then by id", and pass it to <code>sort</code>, a TreeMap, or a PriorityQueue.</p>
<p>A compare method returns a negative number if a comes first, zero if they're equal in this ordering, and positive if b comes first.</p>`,
[[`Comparable&lt;T&gt;`,`compareTo(other) inside the class: the natural order.`],[`Comparator&lt;T&gt;`,`compare(a, b) outside the class: any order.`],[`Stable sort`,`Equal elements keep their original relative order (Java's object sort is stable).`]],
[`Build comparators fluently: <code>Comparator.comparing(Car::price).reversed().thenComparing(Car::id)</code>.`,`Use <code>Integer.compare(a, b)</code> rather than <code>a - b</code>.`,`Pass the comparator to <code>list.sort(...)</code>, <code>new TreeMap&lt;&gt;(cmp)</code>, etc.`],
[`Add a unique tie-breaker (like id) when using comparators in TreeSet/TreeMap, or equal-ranked items will be treated as duplicates.`,`Keep compareTo consistent with equals where possible.`],
[`<code>return a.price - b.price;</code>: overflow for large values.`,`Comparators that aren't transitive, which can make sorting throw.`]),
  quiz: [
    [`Comparable vs Comparator?`,[`Comparable gives one natural order inside the class; Comparators give others outside`,`Comparable is used for sorting lists; Comparator is only used by TreeMap and TreeSet`,`Comparator must be implemented by the class being sorted, Comparable by a helper`,`Comparable supports several orders by overloading compareTo with different types`],0,`e.g. String implements Comparable; you pass Comparator.comparing(Car::price) for other orders.`,'E'],
    [`A comparator is <code>(a, b) -> a.price - b.price</code> with int prices. Risk?`,[`It sorts in descending order`,`Subtraction is slower than Integer.compare`,`Equal elements may be reordered, so the sort becomes unstable`,`Integer overflow can flip the sign and break the ordering`],3,`For large or negative values a − b overflows. Use Integer.compare or Comparator.comparingInt.`,'M'],
    [`A <code>TreeSet&lt;Car&gt;</code> uses a comparator on price only. Two different cars with the same price are added. Size?`,[`2, because the cars aren't equal by equals()`,`2, but contains() finds only one of them`,`1, because compare == 0 counts as a duplicate`,`It throws, because the comparator is inconsistent with equals`],2,`Sorted sets use the comparator for equality. Add a unique tie-breaker: thenComparing(Car::id).`,'H'],
    [`<code>a.compareTo(b)</code> returns a negative number means?`,[`a comes after b`,`a comes before b`,`a equals b`,`error`],1,`Negative: a < b in this ordering.`,'E'],
    [`Sort names case-insensitively?`,[`list.sort(null), which ignores case`,`list.sort(String.CASE_INSENSITIVE_ORDER)`,`Collections.reverse(list) after sorting`,`list.sort(String::compareTo)`],1,`A ready-made Comparator.`,'E'],
    [`Sort cars by price descending?`,[`Comparator.comparing(Car::price)`,`Comparator.comparing(Car::price).reversed()`,`Comparator.reverseOrder()`,`list.reverse()`],1,`reversed() flips the comparator.`,'M'],
    [`Is Java's <code>List.sort</code> (TimSort) stable?`,[`No: equal elements may be reordered`,`Yes: equal elements keep their relative order`,`Only when sorting primitive values`,`Only for lists below a size threshold`],1,`Lets you sort by secondary then primary key.`,'M'],
    [`How do you sort nulls last with a comparator?`,[`It's impossible with the standard API`,`Comparator.nullsLast(Comparator.naturalOrder())`,`list.removeNulls() before sorting`,`Comparator.reverseOrder() puts them last`],1,`Otherwise compareTo on null throws NPE.`,'M'],
  ],
  quizAdv: [
    [`<code>Comparator.comparing(Car::price).reversed().thenComparing(Car::id)</code> sorts by?`,[`price descending, then id ascending`,`price descending, then id descending`,`price ascending, then id descending`,`It doesn't compile`],0,`reversed() applies to the chain so far; thenComparing adds an ascending key.`,'H'],
    [`Your comparator isn't transitive. Sorting a large list with it?`,[`It sorts arbitrarily, but always finishes`,`It can loop forever on some inputs`,`It falls back to a slower merge sort`,`It may throw: "violates its general contract"`],3,`TimSort detects some contract violations and throws IllegalArgumentException.`,'H'],
    [`What does "consistent with equals" mean for compareTo?`,[`compareTo == 0 exactly when equals is true`,`compareTo must call equals internally`,`compareTo returns a boolean like equals`,`Nothing: it's only a naming convention`],0,`BigDecimal is a famous exception (2.0 vs 2.00).`,'H'],
    [`Arrays.sort on <code>int[]</code> vs on <code>Integer[]</code>?`,[`Both use the same stable algorithm`,`int[] dual-pivot quicksort; Integer[] TimSort`,`Both use unstable quicksort`,`int[] arrays can't be sorted directly`],1,`Stability only matters for objects.`,'H'],
  ],
});
