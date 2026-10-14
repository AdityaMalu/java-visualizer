/* 2.4 LinkedHashMap LRU and TreeMap navigation */
topic('2', { no:'2.4', title:'LinkedHashMap LRU and TreeMap navigation', idea:`Build an LRU cache in about 5 lines and watch the access order move entries. Then walk a red-black tree for floorKey and ceilingKey.`,
actors:'Operation', stateTitle:'Structure', dgTitle:'TreeMap (red-black tree)',
vb:'0 0 460 200',
nodes:{n50:{x:230,y:35,label:'50',kind:'circle',w:50,h:36}, n30:{x:130,y:105,label:'30',kind:'circle',w:50,h:36}, n70:{x:330,y:105,label:'70',kind:'circle',w:50,h:36}, n20:{x:80,y:170,label:'20',kind:'circle',w:50,h:36}, n40:{x:180,y:170,label:'40',kind:'circle',w:50,h:36}, n80:{x:380,y:170,label:'80',kind:'circle',w:50,h:36}},
edges:[['n50','n30','','line'],['n50','n70','','line'],['n30','n20','','line'],['n30','n40','','line'],['n70','n80','','line']],
codes:{a:`class LRU<K, V> extends LinkedHashMap<K, V> {
  private final int cap;
  LRU(int cap) { super(16, 0.75f, true); this.cap = cap; }  // accessOrder
  @Override protected boolean removeEldestEntry(Map.Entry<K, V> e) {
    return size() > cap;                 // evict the head after a put
  }
}
LRU<String, Integer> c = new LRU<>(3);
c.put("A", 1); c.put("B", 2); c.put("C", 3);
c.get("A");          // A moves to the tail (most recent)
c.put("D", 4);       // over capacity -> evict head (B)`,
b:`TreeMap<Integer, String> t = new TreeMap<>();   // keys 20,30,40,50,70,80
t.floorKey(45);      // greatest key <= 45  -> 40
t.ceilingKey(45);    // least key >= 45     -> 50
t.headMap(50);       // keys < 50           -> {20, 30, 40}
t.firstKey();        // leftmost            -> 20
// HashSet<E> is literally a HashMap<E, PRESENT> under the hood`},
steps:[
{cv:'a', hl:{op:[8,9]}, th:[['op','put A, B, C:info','']], d:null, g:[G('hash table',['A, B, C','O(1) lookup by key']), G('doubly linked list (LRU → MRU)',C('head … tail',['A','B',['C','hot']]))],
 say:`<b>LinkedHashMap</b> = a HashMap plus a <b>doubly linked list</b> running through all the entries (each entry has before/after pointers). The default is insertion order. Passing <code>true</code> as the third constructor argument switches to <b>access order</b>.`},
{hl:{op:[10]}, th:[['op','get("A"):info','A becomes most recent']], g:[G('doubly linked list (LRU → MRU)',C('head … tail',['B','C',['A','hot']]))],
 say:`With access order, <code>get</code> unlinks A and re-links it at the <b>tail</b>: O(1) pointer surgery. The head is now the <b>least recently used</b> entry (B).`},
{hl:{op:[11],LRU:[5]}, th:[['op','put("D"):warn','size 4 > cap 3']], g:[G('doubly linked list (LRU → MRU)',C('head … tail',['C','A',['D','hot']])), G('evicted',C('removeEldestEntry → true',[['B','bad']]))], log:['evicted B (least recently used)'],
 say:`After inserting D, <code>afterNodeInsertion</code> calls <code>removeEldestEntry(head)</code>, which returns true because size 4 &gt; 3, so the head (B) is removed. Every operation is O(1). In an interview they may ask you to build it by hand: a <b>HashMap&lt;K, Node&gt;</b> plus your own doubly linked list with dummy head/tail nodes. Not thread-safe; use Caffeine in production.`},
{cv:'b', hl:{op:[2]}, th:[['op','floorKey(45):info','start at root']], d:{type:'graph',on:['n50']}, g:[G('floor walk',['at 50','45 < 50 → go left (50 too big)'],['best so far','none'])],
 say:`<b>TreeMap</b> is a <b>red-black tree</b> (a self-balancing BST, height ≤ 2·log n). <code>floorKey(45)</code> = the greatest key ≤ 45. At 50: too big, go left.`},
{th:[['op','floorKey(45):info','']], d:{type:'graph',on:['n30'],e:[['n50','n30','','hot line']]}, g:[G('floor walk',['at 30','30 ≤ 45 → candidate, go right for a closer one','hot'],['best so far','30'])],
 say:`30 ≤ 45, so it's a candidate. Then go right to look for something bigger but still ≤ 45.`},
{th:[['op','floorKey(45):ok','= 40']], d:{type:'graph',on:['n40'],ok:['n40'],e:[['n50','n30','','hot line'],['n30','n40','','hot line']]}, g:[G('floor walk',['at 40','40 ≤ 45 → candidate, go right → null'],['answer','40','ok'])], log:['floorKey(45) = 40'],
 say:`40 is a better candidate. Right child is null, so stop: <b>40</b>. One root-to-leaf path: <b>O(log n)</b>.`},
{hl:{op:[3]}, th:[['op','ceilingKey(45):ok','= 50']], d:{type:'graph',ok:['n50'],e:[['n50','n30','','hot line'],['n30','n40','','hot line']]}, g:[G('ceiling walk',['at 50','≥ 45 → candidate 50, go left'],['at 30','< 45 → go right'],['at 40','< 45 → go right → null'],['answer','50','ok'])], log:['ceilingKey(45) = 50'],
 say:`<code>ceilingKey</code> mirrors it: the least key ≥ 45. 50 is a candidate; nothing smaller-but-still-≥45 exists below it, so the answer is <b>50</b>. Also: <code>lowerKey</code> (&lt;) and <code>higherKey</code> (&gt;).`},
{hl:{op:[4,5]}, th:[['op','range views:info','']], d:{type:'graph',on:['n20','n30','n40']}, g:[G('NavigableMap',['headMap(50)','{20, 30, 40} (live view)','ok'],['tailMap(50)','{50, 70, 80}'],['subMap(30, 70)','{30, 40, 50}'],['firstKey / lastKey','20 / 80'],['pollFirstEntry','remove + return min'])],
 say:`Range views are <b>live</b>: they reflect later changes to the map. Use cases: interval scheduling, "find the slot", rate-limit windows, a leaderboard by score, consistent hashing ring (<code>ceilingEntry(hash)</code>, wrapping to <code>firstEntry</code>). TreeMap needs Comparable keys or a Comparator, and rejects null keys.`},
{hl:{op:[6]}, th:[], d:null, g:[G('HashSet<E>',['add(e)','map.put(e, PRESENT) == null'],['contains(e)','map.containsKey(e)'],['memory','a whole HashMap.Node per element']), G('Family',['HashSet','HashMap'],['LinkedHashSet','LinkedHashMap'],['TreeSet','TreeMap'])],
 say:`The Set classes are thin wrappers over the matching Map. <code>add</code> returns false when the element was already present, which is a handy dedupe check.`}
],
keep:[`LinkedHashMap(…, true) + removeEldestEntry = LRU in O(1).`,`TreeMap = red-black tree: floor/ceiling/higher/lower, range views, O(log n).`,`HashSet = HashMap keys with a dummy value.`]}, {
  imp: 'good',
  theory: TH(`LinkedHashMap keeps entries in a predictable order (insertion or recent access), which makes an LRU cache trivial; TreeMap keeps keys sorted and answers "nearest key" questions.`,
`<p>A plain HashMap has no order. <b>LinkedHashMap</b> adds a doubly linked list through its entries, so it remembers the order they were inserted, or, with <code>accessOrder = true</code>, the order they were last used. That second mode gives you an <b>LRU (least recently used) cache</b>: the head of the list is the entry nobody has touched for longest, so evict it.</p>
<p><b>TreeMap</b> stores keys in a balanced binary tree, always sorted. It can answer questions a hash table can't: "the highest price ≤ 25k" (floor), "the next appointment after 10:00" (ceiling), "all keys between A and B" (subMap).</p>`,
[[`LRU`,`Evict the entry that was used least recently.`],[`removeEldestEntry`,`Hook LinkedHashMap calls after each insert; return true to evict the head.`],[`floor / ceiling`,`Greatest key ≤ x / smallest key ≥ x.`],[`Red-black tree`,`Self-balancing tree giving O(log n) operations.`]],
[`LRU: <code>new LinkedHashMap&lt;&gt;(cap, 0.75f, true)</code> moves each accessed entry to the tail.`,`Override <code>removeEldestEntry</code> to return <code>size() &gt; cap</code>.`,`TreeMap: put/get/remove walk the tree in O(log n); the tree rebalances itself.`,`Navigation methods (floorKey, headMap, tailMap) use the sorted structure.`],
[`For production caches use Caffeine (thread-safe, size/time limits, stats); LinkedHashMap LRU is fine for single-threaded or small cases.`,`TreeMap is great for time-based or price-range lookups.`],
[`Sharing a LinkedHashMap LRU across threads without a lock: even get() modifies it.`,`A TreeMap comparator that returns 0 for different keys merges them into one entry.`]),
  quiz: [
    [`A <code>TreeMap&lt;Integer,String&gt;</code> has keys 10, 20, 30. What do <code>floorKey(25)</code> and <code>ceilingKey(25)</code> return?`,[`10 and 30`,`20 and 30`,`30 and 20`,`20 and 20`],1,`floor = greatest key ≤ 25; ceiling = smallest key ≥ 25.`,'E'],
    [`How do you build an LRU cache with LinkedHashMap?`,[`new LinkedHashMap&lt;&gt;(cap) and override removeEldestEntry; insertion order is LRU order`,`new LinkedHashMap&lt;&gt;(cap, 0.75f, true) and removeEldestEntry returning size() &gt; cap`,`LinkedHashMap is LRU by default; just cap it in the constructor`,`A TreeMap keyed by last-access timestamp`],1,`accessOrder = true moves an entry to the end on every get; without it you get FIFO, not LRU.`,'M'],
    [`<code>TreeSet&lt;String&gt;</code> created with <code>String.CASE_INSENSITIVE_ORDER</code>. Add "Java", then "java". What are <code>size()</code> and <code>contains("JAVA")</code>?`,[`2 and false`,`2 and true`,`1 and true`,`1 and false`],2,`Sorted sets use the comparator, not equals: compare == 0 means duplicate, and lookups use the comparator too.`,'H'],
    [`TreeMap keys must be...`,[`Strings, since TreeMap sorts alphabetically`,`Comparable, or a Comparator must be supplied`,`Objects with unique hashCode values`,`Integers or other numeric wrapper types`],1,`It orders keys with compareTo / compare.`,'E'],
    [`<code>treeMap.firstKey()</code> returns?`,[`The first inserted key`,`The smallest key`,`A random key`,`The largest key`],1,`lastKey gives the largest.`,'E'],
    [`<code>headMap(30)</code> on keys 10, 20, 30, 40?`,[`{10, 20}`,`{10, 20, 30}`,`{30, 40}`,`{40}`],0,`headMap(toKey) excludes toKey by default.`,'M'],
    [`What is the cost of TreeMap get/put?`,[`O(1)`,`O(log n)`,`O(n)`,`O(n log n)`],1,`Red-black tree.`,'E'],
    [`LinkedHashMap with accessOrder = false iterates in which order?`,[`Sorted`,`Insertion order`,`Most recently used last`,`Random`],1,`accessOrder = true gives access order.`,'M'],
  ],
  quizAdv: [
    [`Is <code>get()</code> on an access-ordered LinkedHashMap a structural modification?`,[`No: get is always read-only`,`Only if removeEldestEntry is overridden`,`Yes: get() relinks the entry, so CME is possible`,`Only on Java 8, fixed later`],2,`In access order, get moves the entry to the end of the list.`,'H'],
    [`Can a LinkedHashMap-based LRU cache be shared across threads?`,[`Yes: concurrent reads are thread-safe`,`No: even get() changes the links`,`Yes, if wrapped in unmodifiableMap`,`Yes, if the field is volatile`],1,`Concurrent get/put can corrupt the linked list.`,'M'],
    [`<code>removeEldestEntry</code> is called when?`,[`Before every get, to check expiry`,`After each put/putAll, with the eldest entry`,`On every iteration of the map`,`Never automatically: you call it yourself`],1,`Return true to evict it.`,'M'],
    [`Why might a TreeMap be preferred to a HashMap for an order book (prices)?`,[`Faster lookups than any hash-based map`,`Sorted keys: best bid/ask and price ranges in O(log n)`,`It uses noticeably less memory per entry`,`It's thread-safe for concurrent traders`],1,`firstKey / lastKey / subMap.`,'M'],
  ],
});
