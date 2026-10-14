/* 4.16 Concurrent collections */
topic('4', { no:'4.16', title:'Concurrent collections', idea:`ConcurrentHashMap locks one bucket, not the whole map. Plus copy-on-write lists and blocking queues.`,
codes:{a:`ConcurrentHashMap<String, Integer> m = new ConcurrentHashMap<>();

m.put("cat", 1);                  // empty bucket: CAS, no lock
m.put("dog", 1);                  // same bucket: lock ONLY its head
m.put("owl", 1);                  // other bucket: runs in parallel
m.get("cat");                     // no lock: volatile read
m.merge("cat", 1, Integer::sum);  // atomic read-modify-write`,
b:`CopyOnWriteArrayList<Listener> ls = new CopyOnWriteArrayList<>();

for (Listener l : ls) l.onEvent(e);   // iterates a snapshot
ls.add(newListener);                   // copies the whole array`,
c:`BlockingQueue<Order> q = new ArrayBlockingQueue<>(2);

q.put(order);          // full  -> producer waits
Order o = q.take();    // empty -> consumer waits`},
steps:[
{cv:'a', hl:{A:[3]}, th:[['A','RUN','put cat → bucket 1 empty → CAS'],['B','READY',''],['C','READY',''],['D','READY','']], g:[G('table (Node[] , volatile)',['[0]','empty'],['[1]','cat=1','hot'],['[2]','empty'],['[3]','empty'])],
 say:`Java 8+ <b>ConcurrentHashMap</b>. "cat" hashes to bucket 1, which is empty. A single <b>CAS</b> installs the node, with <b>no lock at all</b>.`},
{hl:{B:[4],C:[5]}, th:[['A','TERM',''],['B','RUN','dog → bucket 1: synchronized(head "cat")'],['C','RUN','owl → bucket 3: CAS, in parallel'],['D','READY','']], g:[G('table (Node[] , volatile)',['[0]','empty'],['[1]','🔒 cat=1 → dog=1','hot'],['[2]','empty'],['[3]','owl=1','hot'])],
 say:`"dog" also lands in bucket 1, which is occupied. B locks <b>only that bucket's head node</b> and appends. At the same time C writes bucket 3 with no waiting. Writers to different buckets never block each other. (Java 7 used 16 locked "segments" instead.)`},
{hl:{D:[6]}, th:[['A','TERM',''],['B','RUN','still holding bucket 1'],['C','TERM',''],['D','RUN','get cat → 1, no lock']], log:['D: get("cat") → 1 (read while B holds bucket lock)'],
 say:`<b>Reads never lock.</b> Node values and next pointers are volatile, so D can read bucket 1 even while B holds its lock. The trade-off: <code>size()</code> and iteration are only <b>weakly consistent</b> (they may miss a concurrent update) but never throw ConcurrentModificationException.`},
{hl:{A:[7],D:[7]}, th:[['A','RUN','merge cat +1'],['B','TERM',''],['C','TERM',''],['D','RUN','merge cat +1']], g:[G('table (Node[] , volatile)',['[0]','empty'],['[1]','cat=3 → dog=1','ok'],['[2]','empty'],['[3]','owl=1'])], log:['✔ merge is atomic: cat = 3','✘ get() then put() would race → could be 2'],
 say:`Each single call is atomic, but <code>m.put(k, m.get(k) + 1)</code> is <b>two</b> calls, so it's check-then-act again. Use the atomic helpers: <code>merge</code>, <code>compute</code>, <code>computeIfAbsent</code>, <code>putIfAbsent</code>. <code>map.merge(word, 1, Integer::sum)</code> is the thread-safe word counter. Also: CHM forbids <b>null</b> keys and values, because null would be ambiguous with "absent".`},
{th:[['A','BLOCKED','waiting for table lock'],['B','BLOCKED',''],['C','RUN','owns the ONE lock'],['D','BLOCKED','even a get() waits']], g:[G('Hashtable / Collections.synchronizedMap',['lock','one, for the whole map','bad'],C('blocked',['A','B','D']))], logReset:true,
 say:`Compare <b>Hashtable / synchronizedMap</b>: every method, reads included, uses one lock, so only one thread at a time. That's why CHM is the default answer for a shared map.`},
{cv:'b', hl:{R:[3]}, th:[['R','RUN','iterating snapshot v1'],['W','READY','']], g:[G('CopyOnWriteArrayList',['array ref','→ v1 [L1, L2]'],['R iterating','v1','hot'])],
 say:`<b>CopyOnWriteArrayList</b>: the reader iterates over the current array with no lock.`},
{hl:{W:[4]}, th:[['R','RUN','still on v1, unaffected'],['W','TERM','copied → v2, swapped ref']], g:[G('CopyOnWriteArrayList',['array ref','→ v2 [L1, L2, L3]','hot'],['R iterating','v1 [L1, L2] (old snapshot)'],['cost of add','O(n) copy','bad'])],
 say:`<code>add()</code> copies the whole array to v2, adds L3, and swaps the volatile reference. R keeps iterating v1: no exception, no lock, but it doesn't see L3. Great for <b>many reads, rare writes</b> (listener lists). Bad for frequent writes.`},
{cv:'c', hl:{P:[3]}, th:[['P','WAITING','put: queue full'],['Cn','READY','']], g:[G('ArrayBlockingQueue(2)',C('items',['o1','o2']),['state','FULL','bad'])],
 say:`<b>BlockingQueue</b> handles producer-consumer for you. The queue is full, so <code>put()</code> parks the producer. That's built-in back-pressure.`},
{hl:{Cn:[4],P:[3]}, th:[['P','RUN','put o3 succeeded'],['Cn','RUN','took o1']], g:[G('ArrayBlockingQueue(2)',C('items',['o2',['o3','hot']]))],
 say:`The consumer takes o1, which signals <code>notFull</code>, so the producer wakes and adds o3. Variants: <code>LinkedBlockingQueue</code> (separate put and take locks, higher throughput), <code>PriorityBlockingQueue</code> / <code>DelayQueue</code> (scheduling), <code>SynchronousQueue</code> (zero capacity, direct hand-off, used by the cached pool), <code>ConcurrentSkipListMap</code> (sorted, lock-free).`}
],
keep:[`CHM: CAS into an empty bucket, synchronized on the head of a used bucket, lock-free reads.`,`Compound ops → merge / compute / putIfAbsent. No nulls.`,`COW list: reads free, writes copy. BlockingQueue: put/take with back-pressure.`]}, {
  imp: 'must',
  theory: TH(`Concurrent collections are built to be used from many threads at once, without one big lock and without ConcurrentModificationException.`,
`<p>Wrapping a HashMap in <code>synchronized</code> makes every operation wait for one lock. <b>ConcurrentHashMap</b> instead locks only the bucket being changed (and uses lock-free CAS for empty buckets), and reads don't lock at all. It also offers <b>atomic compound operations</b> (<code>merge</code>, <code>compute</code>, <code>putIfAbsent</code>) so you don't have to combine get and put yourself.</p>
<p>Other tools: <b>CopyOnWriteArrayList</b> (reads are free, every write copies the array, great for rarely changed listener lists) and <b>BlockingQueue</b> (put waits when full, take waits when empty, perfect for producer/consumer).</p>`,
[[`ConcurrentHashMap`,`Thread-safe hash map with fine-grained locking.`],[`Atomic compound operation`,`merge/compute/putIfAbsent: the check and the update happen as one step.`],[`CopyOnWriteArrayList`,`Read-optimised list that copies on write.`],[`BlockingQueue`,`Queue with blocking put/take and optional capacity.`],[`Weakly consistent iterator`,`Never throws CME; may or may not reflect concurrent changes.`]],
[`Choose by access pattern: map → CHM; read-mostly list → COW; hand-off between threads → BlockingQueue.`,`Use the atomic methods for compound updates (<code>map.merge(word, 1, Integer::sum)</code>).`],
[`Caches, counters per key, registries and work queues.`],
[`<code>if (!map.containsKey(k)) map.put(k, v)</code> on a CHM: still a race.`,`Putting null in a CHM (not allowed).`,`Slow functions inside computeIfAbsent (they hold the bucket lock).`]),
  quiz: [
    [`Count word frequencies safely in a ConcurrentHashMap. Which call?`,[`map.put(w, map.get(w) + 1)`,`map.putIfAbsent(w, 1)`,`map.merge(w, 1, Integer::sum)`,`map.replace(w, map.get(w) + 1)`],2,`merge is atomic per key. get-then-put races.`,'E'],
    [`ConcurrentHashMap (Java 8+) puts into an empty bucket how?`,[`It locks the segment that owns the bucket`,`It CASes the new node in with no lock`,`It locks the whole table`,`It copies the table`],1,`Segments were Java 7. Now: CAS for an empty bin, synchronized on the head node otherwise, lock-free reads.`,'M'],
    [`Thread A iterates a ConcurrentHashMap while thread B inserts keys. A will...`,[`throw ConcurrentModificationException`,`see a consistent snapshot from when iteration started`,`block until B finishes`,`not throw, and may or may not see B's new keys`],3,`CHM iterators are weakly consistent.`,'H'],
    [`Does ConcurrentHashMap allow null keys or values?`,[`Both allowed`,`Neither`,`Null keys only`,`Null values only`],1,`null would be ambiguous with "absent".`,'E'],
    [`Atomic "insert if absent" in ConcurrentHashMap?`,[`containsKey followed by put`,`putIfAbsent or computeIfAbsent`,`get, then put if it was null`,`putAll with a single-entry map`],1,`Single atomic operation.`,'E'],
    [`Which queue blocks producers when it's full?`,[`ConcurrentLinkedQueue`,`ArrayBlockingQueue`,`PriorityQueue`,`ArrayDeque`],1,`Bounded blocking queue.`,'E'],
    [`What is ConcurrentSkipListMap?`,[`A concurrent hash map with linked buckets`,`A concurrent sorted map (like a thread-safe TreeMap)`,`A lock-free FIFO queue of key-value pairs`,`A size-bounded cache with LRU eviction`],1,`O(log n), lock-free.`,'M'],
    [`<code>size()</code> on a ConcurrentHashMap under updates is?`,[`Exact, since it locks every bin`,`An estimate that may be stale`,`Blocking until updates finish`,`The count at the last resize`],1,`Don't base logic on it.`,'M'],
  ],
  quizAdv: [
    [`When is CopyOnWriteArrayList a good fit?`,[`Large lists, frequent writes`,`Read-mostly listener lists`,`Queues between threads`,`Caches with eviction`],1,`Every write copies the array.`,'M'],
    [`A <code>computeIfAbsent</code> mapping function updates the same ConcurrentHashMap. Result?`,[`It works normally`,`The inner update is dropped`,`IllegalStateException`,`It always returns null`],2,`Mapping functions must be short and must not touch the map.`,'H'],
    [`Why did ConcurrentHashMap drop segment locks in Java 8?`,[`Segments caused data loss during heavy concurrent resizing`,`Finer-grained CAS + per-bin locks scale better and use less memory`,`To let the map finally accept null keys and values`,`Segment locks were incompatible with lambdas and streams`],1,`Reads are lock-free.`,'H'],
    [`SynchronousQueue has what capacity?`,[`1: it holds one element until it's taken`,`0: each put waits for a matching take`,`Unbounded, growing as producers add`,`16, the default like other queues`],1,`Used by cached thread pools for direct hand-off.`,'H'],
  ],
});
