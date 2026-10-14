/* 2.1 Picking a collection */
topic('2', { no:'2.1', title:'Picking a collection', idea:`One requirement per step: say the requirement, pick the structure, and know the complexity that justifies it.`,
actors:'Requirement', stateTitle:'Why this one',
codes:{a:`List<Car> listing = new ArrayList<>();          // ordered, index access
Set<String> seenVins = new HashSet<>();         // dedupe, O(1) contains
Map<String, Car> byVin = new HashMap<>();       // lookup by key
Map<String, Car> recent = new LinkedHashMap<>(16, 0.75f, true); // LRU order
TreeMap<Long, Car> byPrice = new TreeMap<>();   // range: cars <= 5L
Deque<Task> work = new ArrayDeque<>();          // stack or queue
PriorityQueue<Bid> bids = new PriorityQueue<>(comparing(Bid::amt).reversed());
Map<String, Long> hits = new ConcurrentHashMap<>();   // shared by threads`},
steps:[
{hl:{need:[1]}, th:[['need','ordered, by index:info','show cars page by page']], g:[G('ArrayList',['get(i)','O(1)','ok'],['add at end','amortised O(1)','ok'],['insert/remove middle','O(n) shift'],['memory','compact array, cache-friendly','ok'])],
 say:`Default list: <b>ArrayList</b>. It's backed by an array, so <code>get(i)</code> is one memory jump and iteration is cache-friendly. You'll almost never need LinkedList (2.5).`},
{hl:{need:[2]}, th:[['need','uniqueness:info','skip VINs we already saw']], g:[G('HashSet',['add / contains / remove','O(1) average','ok'],['order','none (don\'t rely on it)'],['internally','a HashMap with a dummy value'])],
 say:`<b>HashSet</b> for "have I seen this?" checks. Need insertion order too? <code>LinkedHashSet</code>. Need sorted order? <code>TreeSet</code> (O(log n)).`},
{hl:{need:[3]}, th:[['need','key → value:info','car by VIN']], g:[G('HashMap',['get / put','O(1) average, O(log n) worst (Java 8 trees)','ok'],['null key','one allowed'],['thread-safe','no','bad'])],
 say:`<b>HashMap</b> for key lookups. The internals are the #1 interview question (2.2).`},
{hl:{need:[4]}, th:[['need','recency order:info','recently viewed cars, evict oldest']], g:[G('LinkedHashMap (accessOrder)',['get moves entry to tail','O(1)','ok'],['removeEldestEntry','evict head → LRU cache','ok'])],
 say:`<b>LinkedHashMap</b> with <code>accessOrder = true</code> keeps entries in least-recently-used order. Override <code>removeEldestEntry</code> and you have an LRU cache in about 5 lines (2.4).`},
{hl:{need:[5]}, th:[['need','sorted + ranges:info','cars priced ≤ ₹5L, next price above X']], g:[G('TreeMap (red-black tree)',['get / put','O(log n)'],['floorKey / ceilingKey','O(log n)','ok'],['headMap / tailMap / subMap','range views','ok'])],
 say:`<b>TreeMap</b> when you need <b>sorted keys</b> or <b>range queries</b>: "latest slot before 3pm", "all prices between X and Y". A hash map can't answer those.`},
{hl:{need:[6]}, th:[['need','stack / queue:info','BFS queue, DFS stack, undo']], g:[G('ArrayDeque',['push/pop/offer/poll at both ends','O(1)','ok'],['vs Stack','Stack is synchronized + extends Vector (legacy)','bad'],['vs LinkedList','fewer allocations, faster','ok'],['nulls','not allowed'])],
 say:`<b>ArrayDeque</b> is the go-to stack <i>and</i> queue: a circular array with no per-node objects. Use <code>push/pop</code> for a stack, <code>offer/poll</code> for a queue.`},
{hl:{need:[7]}, th:[['need','best first:info','highest bid, nearest node, top-K']], g:[G('PriorityQueue (binary heap)',['peek','O(1)','ok'],['offer / poll','O(log n)','ok'],['contains / remove(x)','O(n)','bad'],['iteration order','NOT sorted','bad'])],
 say:`<b>PriorityQueue</b> for "always give me the min (or max) next": Dijkstra, schedulers, merge-K-lists, top-K (2.8).`},
{hl:{need:[8]}, th:[['need','many threads:info','request counters across threads']], g:[G('Concurrent choices',['map','ConcurrentHashMap','ok'],['read-mostly list','CopyOnWriteArrayList'],['producer/consumer','ArrayBlockingQueue / LinkedBlockingQueue'],['sorted + concurrent','ConcurrentSkipListMap'],['avoid','Hashtable, Vector, synchronizedMap (one big lock)','bad'])],
 say:`Shared between threads → <code>java.util.concurrent</code> (4.16). In an interview, say the requirement first ("I need O(1) lookup and recency order"), then the structure. That order shows you're reasoning, not reciting.`}
],
keep:[`Default: ArrayList, HashMap, HashSet, ArrayDeque.`,`Sorted / ranges → TreeMap/TreeSet. Recency → LinkedHashMap. Best-first → PriorityQueue.`,`Threads → ConcurrentHashMap & friends, never Hashtable/Vector.`]}, {
  imp: 'must',
  theory: TH(`The Collections Framework gives you ready-made containers: lists, sets, maps and queues. Picking the right one is mostly about how you'll access the data.`,
`<p>Programs constantly hold groups of things: orders, users, prices. Java provides interfaces describing <i>what</i> a container does and classes describing <i>how</i>:</p>
<ul><li><b>List</b>: ordered, allows duplicates, access by position (a playlist).</li><li><b>Set</b>: no duplicates (a guest list).</li><li><b>Map</b>: key → value lookups (a phone book).</li><li><b>Queue / Deque</b>: take items from the front or back (a ticket line).</li></ul>
<p>Each has several implementations with different speeds. Ask yourself: do I look things up by key? Need sorting? Need order of insertion? Will several threads touch it?</p>`,
[[`ArrayList`,`Resizable array. The default List.`],[`HashMap / HashSet`,`Hash table: O(1) average lookup, no order.`],[`TreeMap / TreeSet`,`Sorted (red-black tree): O(log n), range queries.`],[`LinkedHashMap`,`HashMap that remembers insertion or access order.`],[`ArrayDeque`,`Fast stack/queue.`],[`PriorityQueue`,`Always gives you the smallest (or best) element next.`]],
[`Need lookup by key → Map. Need uniqueness → Set. Need order/position → List.`,`Need sorted order or ranges → Tree*. Need insertion order → LinkedHash*.`,`Need "best next" → PriorityQueue. Stack or queue → ArrayDeque.`,`Shared between threads → the java.util.concurrent versions (4.16).`],
[`Declare variables by interface (<code>List&lt;Order&gt; orders = new ArrayList&lt;&gt;()</code>) so you can swap the implementation.`,`Default choices: ArrayList, HashMap, HashSet, ArrayDeque.`,`Return immutable collections (<code>List.of</code>, <code>List.copyOf</code>) from APIs.`],
[`Using LinkedList by default "because inserts are O(1)".`,`Using Vector/Hashtable/Stack (legacy, synchronized) in new code.`]),
  quiz: [
    [`Bids stream in and you repeatedly need the current highest bid. Best structure?`,[`PriorityQueue ordered by amount, highest first`,`ArrayList, re-sorted with Collections.sort after each insert`,`LinkedHashMap, which keeps entries in insertion order`,`HashMap keyed by amount, then max() over keySet()`],0,`A heap gives O(log n) insert and O(1) peek at the best element.`,'E'],
    [`You need all cars priced between 10k and 20k, in price order. Best choice?`,[`HashMap, filtering entries by price`,`PriorityQueue, polling until the price passes 20k`,`LinkedHashMap, if entries are inserted in price order`,`TreeMap, using subMap(10_000, true, 20_000, true)`],3,`TreeMap keeps keys sorted and supports range views in O(log n + k). Polling a PriorityQueue destroys it.`,'M'],
    [`A legacy service uses <code>Hashtable</code> and <code>Vector</code> for thread safety. What should modern code use?`,[`Keep Hashtable: full synchronization makes check-then-put atomic`,`Collections.synchronizedMap, which locks per bucket like CHM`,`ConcurrentHashMap / CopyOnWriteArrayList / BlockingQueue by access pattern`,`A plain HashMap stored in a volatile field`],2,`Hashtable/Vector lock every call on one monitor, yet compound operations (check-then-put) still race. synchronizedMap is one lock too.`,'H'],
    [`You need unique user ids with fast "contains" checks. Best choice?`,[`ArrayList`,`HashSet`,`LinkedList`,`ArrayDeque`],1,`O(1) average contains, no duplicates.`,'E'],
    [`You need a map that iterates in insertion order. Which?`,[`HashMap`,`TreeMap`,`LinkedHashMap`,`EnumMap`],2,`HashMap has no order; TreeMap sorts by key.`,'E'],
    [`Which should you use as a stack in new code?`,[`Stack`,`Vector`,`ArrayDeque (push/pop)`,`LinkedList only`],2,`Stack is a legacy synchronized class.`,'E'],
    [`A list is read by many threads and changed rarely (listener registry). Which?`,[`ArrayList`,`CopyOnWriteArrayList`,`LinkedList`,`Vector`],1,`Reads need no locking; writes copy.`,'M'],
    [`Why declare <code>List&lt;Order&gt; orders = new ArrayList&lt;&gt;()</code> instead of <code>ArrayList&lt;Order&gt;</code>?`,[`Interface-typed variables run faster`,`Code depends on the interface, not the class`,`ArrayList can't be used as a variable type`,`Generics require the interface type there`],1,`Program to interfaces.`,'M'],
  ],
  quizAdv: [
    [`One producer thread, one consumer thread, and you need back-pressure. Which queue?`,[`ArrayDeque`,`ConcurrentLinkedQueue`,`ArrayBlockingQueue`,`A synchronized LinkedList`],2,`Bounded and blocking: put waits when full. ConcurrentLinkedQueue is unbounded and never blocks.`,'M'],
    [`EnumMap vs HashMap for enum keys?`,[`EnumMap: an array by ordinal, faster`,`HashMap: hashing beats array lookup`,`EnumMap can't be serialised at all`,`They share the same implementation`],0,`EnumMap and EnumSet are compact and iterate in declaration order.`,'M'],
    [`You need the k smallest elements from a stream that never ends, keeping memory bounded. Which structure?`,[`A sorted ArrayList of everything`,`A max-heap (PriorityQueue) of size k`,`A HashSet`,`A LinkedList`],1,`Evict the largest when size exceeds k.`,'H'],
    [`What does <code>Collections.synchronizedList</code> NOT protect?`,[`Single get and add calls from many threads`,`Iteration and compound check-then-act actions`,`Memory visibility of the list's elements`,`Nothing: every use is fully thread-safe`],1,`Iterate inside synchronized(list) { … }, or use a concurrent collection.`,'H'],
  ],
});
