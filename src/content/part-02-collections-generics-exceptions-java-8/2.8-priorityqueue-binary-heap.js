/* 2.8 PriorityQueue (binary heap) */
topic('2', { no:'2.8', title:'PriorityQueue (binary heap)', idea:`Offer 5, 3, 8, 1 and watch sift-up swaps. Poll and watch sift-down. Then the top-K pattern with a size-K min-heap.`,
actors:'Operation', stateTitle:'Backing array', dgTitle:'Heap as a tree (parent i, children 2i+1, 2i+2)',
vb:'0 0 460 210',
nodes:{h0:{x:230,y:35,label:'',kind:'circle',w:50,h:36,sub:'[0]'}, h1:{x:130,y:105,label:'',kind:'circle',w:50,h:36,sub:'[1]'}, h2:{x:330,y:105,label:'',kind:'circle',w:50,h:36,sub:'[2]'}, h3:{x:80,y:170,label:'',kind:'circle',w:50,h:36,sub:'[3]'}, h4:{x:180,y:170,label:'',kind:'circle',w:50,h:36,sub:'[4]'}},
edges:[['h0','h1','','line'],['h0','h2','','line'],['h1','h3','','line'],['h1','h4','','line']],
codes:{a:`PriorityQueue<Integer> pq = new PriorityQueue<>();   // min-heap
pq.offer(5); pq.offer(3);       // 3 sifts up past 5
pq.offer(8); pq.offer(1);       // 1 sifts up to the root
System.out.println(pq);         // [1, 3, 8, 5]  <- NOT sorted
pq.peek();                      // 1, O(1)
pq.poll();                      // remove root, move last to root, sift down
// top-K largest: keep a MIN-heap of size K
PriorityQueue<Integer> top = new PriorityQueue<>();
for (int x : List.of(4, 9, 1, 7)) {
  top.offer(x);
  if (top.size() > 2) top.poll();   // drop the smallest
}`},
steps:[
{hl:{op:[2]}, th:[['op','offer(5), offer(3):info','3 at [1], parent [0]=5']], d:{type:'graph',labels:{h0:'5',h1:'3'},hide:['h2','h3','h4'],on:['h1'],e:[['h1','h0','swap?','hot']]}, g:[G('array',C('',['5',['3','hot']]))],
 say:`A heap is a <b>complete binary tree stored in an array</b>: no pointers, children of i at 2i+1 and 2i+2, parent at (i−1)/2. Min-heap rule: <b>every parent ≤ its children</b>. A new element goes at the end (index 1), then <b>sifts up</b>.`},
{th:[['op','sift up:ok','3 < 5 → swap']], d:{type:'graph',labels:{h0:'3',h1:'5'},hide:['h2','h3','h4'],ok:['h0']}, g:[G('array',C('',[['3','ok'],'5']))],
 say:`3 &lt; parent 5, so swap. 3 is at the root and stops. Each sift-up step moves one level, so at most log n swaps.`},
{hl:{op:[3]}, th:[['op','offer(8):info','8 > 3, stays']], d:{type:'graph',labels:{h0:'3',h1:'5',h2:'8'},hide:['h3','h4'],on:['h2']}, g:[G('array',C('',['3','5',['8','hot']]))],
 say:`8 goes to index 2. Parent 3 ≤ 8, so no swap.`},
{th:[['op','offer(1):info','1 at [3], parent [1]=5']], d:{type:'graph',labels:{h0:'3',h1:'5',h2:'8',h3:'1'},hide:['h4'],on:['h3'],e:[['h3','h1','1 < 5 swap','hot']]}, g:[G('array',C('',['3','5','8',['1','hot']]))],
 say:`1 goes to index 3. Its parent at index 1 is 5, and 1 &lt; 5, so swap.`},
{th:[['op','sift up:ok','1 < 3 → swap again']], d:{type:'graph',labels:{h0:'1',h1:'3',h2:'8',h3:'5'},hide:['h4'],ok:['h0'],e:[['h1','h0','1 < 3 swap','ok']]}, g:[G('array',C('',[['1','ok'],'3','8','5']))],
 say:`Then 1 &lt; 3 (root), so swap again. 1 becomes the new root. Two swaps = log₂(4).`},
{hl:{op:[4,5]}, th:[['op','print / peek:warn','']], g:[G('array',C('',['1','3','8','5']),['toString / iterator','[1, 3, 8, 5]  array order','bad'],['peek()','array[0] = 1','ok'])], log:['[1, 3, 8, 5]','1'],
 say:`<b>Gotcha:</b> printing or iterating a PriorityQueue shows <b>array order</b>, not sorted order. Only repeated <code>poll()</code> gives elements in sorted order. <code>peek()</code> is O(1).`},
{hl:{op:[6]}, th:[['op','poll():info','remove 1, last (5) → root']], d:{type:'graph',labels:{h0:'5',h1:'3',h2:'8'},hide:['h3','h4'],on:['h0'],e:[['h0','h1','smaller child 3','hot']]}, g:[G('array',C('',[['5','hot'],'3','8']))], log:['poll() → 1'],
 say:`<code>poll()</code> takes the root, moves the <b>last element</b> (5) to the root, and <b>sifts down</b>: compare with the smaller child (3).`},
{th:[['op','sift down:ok','5 > 3 → swap']], d:{type:'graph',labels:{h0:'3',h1:'5',h2:'8'},hide:['h3','h4'],ok:['h0','h1']}, g:[G('array',C('',[['3','ok'],['5','ok'],'8']))],
 say:`Swap with 3. 5 has no children now, so it stops. Heap restored in O(log n). Building a heap from n items with <code>new PriorityQueue&lt;&gt;(collection)</code> takes O(n) (heapify), not O(n log n).`},
{hl:{op:[8,9,10,11]}, th:[['op','top-2 of 4,9,1,7:info','']], d:null, g:[G('min-heap size ≤ 2',C('after 4',['4']),C('after 9',['4','9']),C('after 1',[['1 → polled','bad'],'4','9']),C('after 7',[['4 → polled','bad'],'7','9']))], log:['top-2 = [7, 9]'],
 say:`<b>Top-K largest</b>: keep a <b>min</b>-heap of size K. Its root is the smallest of the current top K, so any newcomer that beats it pushes it out. O(n log K) time, O(K) memory, and it works on an endless stream. For K smallest, use a max-heap (<code>Comparator.reverseOrder()</code>).`},
{th:[], g:[G('Complexity',['offer / poll','O(log n)'],['peek','O(1)'],['remove(Object) / contains','O(n)','bad'],['heapify','O(n)']), G('Custom order',['max-heap','new PriorityQueue<>(Comparator.reverseOrder())'],['by distance','(a, b) -> Integer.compare(a[1], b[1])'],['thread-safe?','no → PriorityBlockingQueue'])],
 say:`Pattern list: Dijkstra / A* (by distance), merge K sorted lists (heap of list heads), scheduling (by time), median of a stream (max-heap + min-heap). Mutating an element's priority while it's in the heap breaks the order: remove it, change it, and re-insert.`}
],
keep:[`Array-backed complete tree; parent ≤ children (min-heap). offer = sift up, poll = sift down: O(log n).`,`Iteration/print order is NOT sorted.`,`Top-K largest = min-heap of size K: O(n log K).`]}, {
  imp: 'good',
  theory: TH(`A PriorityQueue always hands you the smallest (or highest-priority) element next, using a binary heap stored in an array.`,
`<p>Sometimes you don't need everything sorted; you just need "the next most important item", again and again: the next task by deadline, the cheapest route so far, the highest bid. A <b>heap</b> does exactly that cheaply. It's a tree where every parent is smaller than its children, so the root is always the minimum. It's stored compactly in an array: the children of index i are at 2i+1 and 2i+2.</p>`,
[[`Min-heap`,`Parent ≤ children; root is the smallest.`],[`Sift up / sift down`,`Moving an element up or down to restore heap order.`],[`peek / poll / offer`,`Look at the top / remove the top / add an element.`]],
[`<code>offer(x)</code>: put x at the end of the array, then swap it upward while it's smaller than its parent.`,`<code>poll()</code>: take the root, move the last element to the root, swap it downward with its smaller child.`,`Both take O(log n); <code>peek()</code> is O(1).`],
[`Max-heap: <code>new PriorityQueue&lt;&gt;(Comparator.reverseOrder())</code>.`,`Top-K largest of a big stream: keep a min-heap of size K and evict the smallest.`,`Scheduling, Dijkstra's shortest path and merging sorted streams all use heaps.`],
[`Expecting <code>toString()</code> or iteration to be sorted.`,`Changing an element's priority while it's in the queue; remove and re-add it instead.`]),
  quiz: [
    [`You print a <code>PriorityQueue</code> holding 5, 1, 3, 2. Is the output sorted?`,[`Yes, in ascending order, since it's a min-heap`,`Yes, in the order the elements were inserted`,`Not necessarily: only poll() returns elements in order`,`Yes, in descending order, since the head is the max`],2,`A heap only guarantees parent ≤ children. Iteration and toString follow the array layout.`,'E'],
    [`Top 10 largest of 10 million numbers with little memory. Best approach?`,[`A max-heap of all numbers, then poll 10 times`,`A min-heap capped at 10, evicting the smallest when it exceeds 10`,`A max-heap capped at 10, evicting the largest when it exceeds 10`,`Sort the array and take the last 10`],1,`O(n log K) time and O(K) memory. The min-heap's root is the smallest of the current top 10, so it's the one to evict.`,'M'],
    [`Cost of <code>pq.remove(someObject)</code> where the object isn't the head?`,[`O(log n), the same as poll()`,`O(1), because elements know their heap index`,`O(n log n), because the heap is rebuilt`,`O(n): a linear search, then an O(log n) sift`],3,`PriorityQueue has no index map. For frequent removals, use a TreeSet or an indexed heap.`,'H'],
    [`What does <code>peek()</code> on a PriorityQueue return?`,[`The element that was added last`,`The head, without removing it`,`A random element from the heap`,`A sorted copy of all elements`],1,`poll() removes it.`,'E'],
    [`How do you make a max-heap of Integers?`,[`new PriorityQueue&lt;&gt;() with no arguments`,`new PriorityQueue<>(Comparator.reverseOrder())`,`new MaxHeap&lt;&gt;() from java.util`,`new TreeSet&lt;&gt;() used as a heap`],1,`Default is a min-heap.`,'E'],
    [`Where are a node's children in an array-based binary heap (index i, 0-based)?`,[`i+1 and i+2`,`2i+1 and 2i+2`,`i/2`,`i*i`],1,`Parent is (i−1)/2.`,'M'],
    [`Is PriorityQueue thread-safe?`,[`Yes, all methods are synchronized`,`No; use PriorityBlockingQueue`,`Only poll() is thread-safe`,`Only when it holds Integers`],1,`Concurrent version exists.`,'M'],
    [`Building a heap from n elements at once (heapify) costs?`,[`O(n log n)`,`O(n)`,`O(log n)`,`O(n²)`],1,`new PriorityQueue<>(collection) heapifies in O(n).`,'H'],
  ],
  quizAdv: [
    [`You change a field used by the comparator of an element already in a PriorityQueue. Effect?`,[`The queue re-sifts that element itself`,`It throws ConcurrentModificationException`,`Heap order silently breaks; re-insert it`,`Only peek() returns the wrong element`],2,`The heap only re-orders on offer/poll/remove.`,'H'],
    [`Default order of <code>new PriorityQueue&lt;Integer&gt;()</code>?`,[`Smallest first (min-heap)`,`Largest first (max-heap)`,`Insertion order`,`Random`],0,`Use Comparator.reverseOrder() for a max-heap.`,'M'],
    [`Merge k sorted lists of total n elements efficiently?`,[`Concatenate and sort: O(n log n)`,`A min-heap of the k list heads: O(n log k)`,`Binary search each`,`Nested loops`],1,`Poll the smallest head, push that list's next element.`,'H'],
    [`Why use PriorityQueue for Dijkstra's algorithm?`,[`To store which nodes were already visited`,`To always expand the closest unvisited node next`,`To sort all the edges once at the start`,`To make the algorithm thread-safe`],1,`Each poll gives the current minimum distance.`,'M'],
  ],
});
