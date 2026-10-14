/* 2.5 ArrayList vs LinkedList */
topic('2', { no:'2.5', title:'ArrayList vs LinkedList', idea:`Watch an ArrayList grow by 1.5×, shift elements on insert, and compare that with walking LinkedList nodes.`,
actors:'Operation', stateTitle:'Memory layout',
codes:{a:`List<String> a = new ArrayList<>();        // elementData = {} (lazy)
for (String s : "ABCDEFGHIJ".split("")) a.add(s);   // capacity 10
a.add("K");              // full -> grow to 15, copy
a.get(3);                // O(1): elementData[3]
a.add(1, "X");           // shift everything after index 1 right
a.remove(0);             // shift everything left: O(n)
List<String> l = new LinkedList<>(List.of("A","B","C","D","E","F"));
l.get(4);                // walk node by node: O(n)
ListIterator<String> it = l.listIterator(2);
it.add("X");             // O(1) at the iterator position`},
steps:[
{hl:{op:[1,2]}, th:[['op','add ×10:info','']], g:[G('ArrayList elementData (capacity 10)',C('[0..9]',['A','B','C','D','E','F','G','H','I','J']),['size','10'])],
 say:`A new ArrayList shares an empty array until the first add, then allocates <b>capacity 10</b>. Elements sit in <b>one contiguous array</b> (of references).`},
{hl:{op:[3]}, th:[['op','add("K"):warn','full → grow']], g:[G('old array (10)',C('',[['A…J','dim']])), G('new array (15 = 10 + 10>>1)',C('[0..14]',['A','B','C','D','E','F','G','H','I','J',['K','hot'],['_','dim'],['_','dim'],['_','dim'],['_','dim']]),['size','11'])],
 say:`Full, so grow to <b>old + old/2 = 15</b> and <code>Arrays.copyOf</code> everything over. Each copy is O(n), but it happens rarely enough that appends are <b>amortised O(1)</b>. If you know the size, use <code>new ArrayList&lt;&gt;(n)</code> or <code>ensureCapacity</code>.`},
{hl:{op:[4]}, th:[['op','get(3):ok','one jump']], g:[G('ArrayList elementData (capacity 15)',C('[0..10]',['A','B','C',['D','ok'],'E','F','G','H','I','J','K']),['address','base + 3 × refSize','ok'])],
 say:`<code>get(3)</code> is just address arithmetic: <b>O(1)</b>. Iterating walks memory sequentially, so the CPU prefetcher loads the next cache line before you ask. That's very fast in practice.`},
{hl:{op:[5]}, th:[['op','add(1, "X"):warn','shift 10 elements']], g:[G('ArrayList elementData (capacity 15)',C('[0..11]',['A',['X','hot'],['B','hot'],['C','hot'],['D','hot'],['E','hot'],['F','hot'],['G','hot'],['H','hot'],['I','hot'],['J','hot'],['K','hot']]),['moved','10 refs via System.arraycopy'])],
 say:`Insert in the middle: <code>System.arraycopy</code> shifts everything after index 1 one slot right, which is <b>O(n)</b>. It's a highly optimised memory move, so for thousands of elements it's still fast. <code>remove(0)</code> shifts everything left the same way.`},
{hl:{op:[7,8]}, th:[['op','LinkedList get(4):warn','walk']], g:[G('LinkedList nodes (scattered in memory)',C('head →',['A','B','C','D',['E','hot'],'F']),['steps','from tail: F → E (index ≥ size/2)'],['each node','item + prev + next ≈ 24 B + header','bad'])],
 say:`<b>LinkedList</b> is a doubly linked list of separate Node objects. <code>get(i)</code> must <b>walk</b> from the nearer end: O(n). Nodes are scattered across the heap, so every hop can be a cache miss.`},
{hl:{op:[9,10]}, th:[['op','iterator add:ok','relink 2 pointers']], g:[G('LinkedList nodes',C('head →',['A','B',['X','ok'],'C','D','E','F']),['cost at iterator','O(1)','ok'],['cost to GET there','O(n) walk','bad'])],
 say:`LinkedList's one real advantage: insert/remove <b>at a position you're already at</b> (through an iterator) is O(1). But you usually had to walk there first.`},
{th:[], g:[G('Memory per element (64-bit, compressed oops)',['ArrayList','~4 bytes (one reference)','ok'],['LinkedList','~24 bytes (Node object)','bad']), G('Verdict',['random access / iteration','ArrayList','ok'],['queue / deque','ArrayDeque','ok'],['LinkedList','almost never (even its author says so)'])],
 say:`<b>Say it:</b> "ArrayList almost always wins: O(1) access, cache-friendly, about a sixth of the memory. LinkedList only helps when you insert or remove at an iterator position a lot. For a queue or stack I use ArrayDeque."`}
],
keep:[`ArrayList: grows ×1.5 (amortised O(1) append), O(1) get, O(n) middle insert.`,`LinkedList: O(n) get, O(1) at iterator, ~6× memory, cache-unfriendly.`,`Queue/stack → ArrayDeque.`]}, {
  imp: 'must',
  theory: TH(`ArrayList stores elements in one array (fast access by index); LinkedList chains separate nodes (fast only at a position you already hold). In practice ArrayList wins almost always.`,
`<p><b>ArrayList</b> is like seats in a row: seat 500 is found instantly by arithmetic. Inserting in the middle means shifting everyone after it, but the CPU does that very quickly with one memory copy. When the array is full, it allocates a bigger one (about 1.5×) and copies.</p>
<p><b>LinkedList</b> is like a treasure hunt where each clue points to the next: to reach item 500 you follow 500 pointers. Inserting is cheap only once you're already there. Each node also costs extra memory and is scattered around the heap, which is slow for CPU caches.</p>`,
[[`Random access`,`Getting element i directly: O(1) for arrays.`],[`Amortised O(1)`,`Occasionally expensive (resize), cheap on average.`],[`Cache locality`,`Data stored together is read much faster by the CPU.`]],
[`ArrayList.get(i): direct index into the array.`,`ArrayList.add at the end: write into spare capacity; grow and copy when full.`,`ArrayList.add(i, x): shift the tail one place right (System.arraycopy).`,`LinkedList.get(i): walk from the nearer end, node by node.`],
[`Default to ArrayList. For queues and stacks, use ArrayDeque.`,`If you know the size, pass it to the constructor to avoid resizes.`],
[`Choosing LinkedList for "frequent inserts" without measuring.`,`Calling <code>remove(0)</code> repeatedly on a big ArrayList (O(n²) overall); use a deque.`]),
  quiz: [
    [`You need fast <code>get(i)</code> on a large list. Which and why?`,[`LinkedList, because it caches the last index it visited`,`Either one: both implement the RandomAccess interface`,`ArrayList: get(i) is an array index; LinkedList walks nodes`,`LinkedList, because its nodes avoid array copying on get`],2,`Only ArrayList implements RandomAccess. LinkedList traverses from the nearer end.`,'E'],
    [`What's the amortised cost of <code>ArrayList.add(x)</code> at the end?`,[`O(n), because every add copies the array`,`O(log n), because the array doubles each time`,`O(1) only if ensureCapacity was called first`,`O(1): capacity grows ~1.5×, so copies are rare`],3,`Occasional O(n) copies spread over many cheap appends average O(1).`,'M'],
    [`Inserting at index <code>size()/2</code> into a 1M-element list. Which is usually faster in practice?`,[`ArrayList: one arraycopy shift beats walking 500k nodes`,`LinkedList: inserting a node is always O(1)`,`LinkedList, because it can start walking from the tail`,`Neither: both are O(n) with the same constant factor`],0,`LinkedList insertion is O(1) only once you're at the position; getting there is O(n) pointer chasing, which is far slower than a memmove.`,'H'],
    [`What happens when an ArrayList's internal array is full and you add?`,[`It throws IllegalStateException`,`It allocates a bigger array (~1.5×) and copies`,`It links a new array chunk to the old one`,`It overwrites the oldest element`],1,`That's why add is amortised O(1).`,'E'],
    [`<code>new ArrayList&lt;&gt;(1000)</code> sets what?`,[`Size 1000, all elements null`,`Initial capacity 1000; size is 0`,`A maximum size of 1000 elements`,`Nothing: the argument is ignored`],1,`Capacity ≠ size.`,'M'],
    [`Which is O(1) on a LinkedList?`,[`get(i)`,`addFirst / removeFirst`,`contains`,`indexOf`],1,`Operations at the ends are cheap.`,'E'],
    [`Iterating a 1M-element LinkedList vs ArrayList: which is typically faster?`,[`LinkedList, since it never has to resize`,`ArrayList: contiguous memory suits CPU caches`,`Same: both are O(n) so they're equally fast`,`It depends only on the GC settings`],1,`Pointer chasing is cache-unfriendly.`,'M'],
    [`<code>for (int i = 0; i &lt; linkedList.size(); i++) linkedList.get(i)</code> costs?`,[`O(n)`,`O(n²)`,`O(log n)`,`O(1)`],1,`Each get(i) walks the list.`,'H'],
  ],
  quizAdv: [
    [`You need a stack or FIFO queue in single-threaded code. Recommended class?`,[`ArrayDeque`,`Stack`,`LinkedList`,`Vector`],0,`ArrayDeque is faster and more cache-friendly than LinkedList; Stack is a legacy synchronized Vector.`,'M'],
    [`You drain a 1M-element ArrayList with repeated <code>remove(0)</code>. Total cost?`,[`O(n)`,`O(n log n)`,`O(1) per call`,`O(n²)`],3,`Each remove(0) shifts the rest. Remove from the end, use ArrayDeque, or clear().`,'M'],
    [`Does <code>ArrayList.remove</code> shrink the internal array?`,[`Yes, it shrinks after every removal`,`No; call trimToSize() to shrink capacity`,`Only once below 10 elements`,`Only in Java 21 and later`],1,`Capacity stays to avoid re-growing.`,'H'],
    [`Why does ArrayList implement RandomAccess while LinkedList doesn't?`,[`For licensing reasons inside the JDK`,`It marks that get(i) is O(1)`,`Because ArrayList is synchronized`,`Because serialization needs it`],1,`Collections utilities check it.`,'M'],
  ],
});
