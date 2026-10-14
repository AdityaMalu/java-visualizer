/* 11.1 Big-O and the cost of Java collection operations */
topic('11', { no:'11.1', title:'Big-O and the cost of Java collection operations', imp:'must', idea:`How to estimate an algorithm's cost as the input grows, why a nested loop that's fine for 100 items dies at 100,000, and what each common Java collection operation costs.`,
actors:'Algorithm', stateTitle:'Cost', logTitle:'Rough timings',
codes:{a:`int sumAll(int[] a) { int s = 0; for (int x : a) s += x; return s; }   // O(n)

boolean hasDuplicate(int[] a) {                     // O(n²)
  for (int i = 0; i < a.length; i++)
    for (int j = i + 1; j < a.length; j++)
      if (a[i] == a[j]) return true;
  return false;
}

boolean hasDuplicateFast(int[] a) {                 // O(n) time, O(n) extra space
  Set<Integer> seen = new HashSet<>();
  for (int x : a) if (!seen.add(x)) return true;
  return false;
}
// list.contains(x) O(n) · set.contains(x) O(1) · treeSet.contains(x) O(log n)`},
steps:[
{th:[], g:[G('Growth for n = 1,000,000',['O(1)','1 step: array index, HashMap get','ok'],['O(log n)','~20 steps: binary search, TreeMap','ok'],['O(n)','1,000,000: one loop','ok'],['O(n log n)','~20,000,000: sorting'],['O(n²)','10¹²: nested loops','bad'],['O(2ⁿ)','impossible: naive recursion (11.6)','bad'])],
 say:`<b>Big-O</b> describes how an algorithm's work grows as the input grows, ignoring constants. It answers "what happens when n is 1,000 times bigger?". Assume a machine does roughly 10⁸ simple operations per second: O(n log n) on a million items takes a fraction of a second, O(n²) takes hours.`},
{hl:{algo:[1]}, th:[['algo','RUN:ok','sumAll']], g:[G('sumAll',['loop runs','n times'],['time','O(n)','ok'],['extra space','O(1): one variable','ok'])],
 say:`One loop over n elements, constant work per element: <b>O(n)</b> time. It uses only one extra variable regardless of n: <b>O(1) space</b>. Always state both time and space.`},
{hl:{algo:[3,4,5,6]}, th:[['algo','RUN:bad','hasDuplicate']], g:[G('hasDuplicate (nested loops)',['comparisons','n(n−1)/2'],['n = 1,000','~500,000: instant'],['n = 100,000','~5,000,000,000: ~50 s','bad'],['time','O(n²)','bad'])], log:['n=1,000      → 1 ms','n=100,000    → 48,000 ms'],
 say:`Comparing every pair is <b>O(n²)</b>. It passes every test with small data and becomes unusable in production: 100× more data means 10,000× more work. Nested loops over the same input are the most common hidden O(n²).`},
{hl:{algo:[10,11,12,13]}, th:[['algo','RUN:ok','hasDuplicateFast']], g:[G('hasDuplicateFast (HashSet)',['per element','one O(1) add'],['time','O(n)','ok'],['extra space','O(n): the set','hot'],['n = 100,000','~3 ms','ok'])], log:['n=100,000    → 3 ms'],
 say:`Trade <b>memory for time</b>: remember what you've seen in a HashSet. <code>add</code> returns false if the element was already there. One pass, O(n) time, at the cost of O(n) extra space. This trade is the heart of most interview optimisations.`},
{hl:{algo:[15]}, th:[], g:[G('Java collection costs',['ArrayList get(i) / add at end','O(1) / amortised O(1)','ok'],['ArrayList add(0, x) / remove(0) / contains','O(n)','bad'],['HashMap / HashSet get, put, contains','O(1) average','ok'],['TreeMap / TreeSet get, put, floor','O(log n)'],['PriorityQueue offer / poll / peek','O(log n) / O(log n) / O(1)'],['LinkedList get(i)','O(n)','bad'],['Collections.sort / List.sort','O(n log n)'])],
 say:`Know these by heart (2.1–2.8). The classic hidden cost: <code>list.contains(x)</code> inside a loop is O(n) per call, so the loop becomes O(n²). Convert the list to a HashSet first.`},
{th:[], g:[G('Hidden costs to spot',['string += in a loop','O(n²) copying (1.8)','bad'],['list.remove(0) repeatedly','O(n²) (2.5)','bad'],['recursion depth','O(depth) stack space'],['streams','same complexity as the loop they replace'])],
 say:`<b>In interviews:</b> state the brute-force solution and its complexity first, then improve it ("can a HashSet/HashMap remove the inner loop? can sorting help? can I use two pointers?"), and always give final time and space complexity.`}
],
keep:[`O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ); state time and space.`,`Nested loops over the input = O(n²); a HashSet/HashMap often brings it to O(n) using O(n) memory.`,`Know collection costs: HashMap O(1), TreeMap O(log n), list.contains / remove(0) O(n).`]}, {
  imp: 'good',
  theory: TH(`Big-O notation describes how the time or memory an algorithm needs grows as its input grows, which lets you predict whether it will survive real data sizes.`,
`<p>Code that is instant on 100 items can take hours on a million. <b>Big-O</b> captures the growth rate, ignoring constant factors: O(n) means "doubling the input roughly doubles the work", O(n²) means "doubling the input quadruples it", O(log n) means "doubling the input adds one step".</p>
<p>Most interview optimisations swap a slow pattern for a faster one: a nested loop (O(n²)) for a single pass with a HashSet (O(n)), or a linear search (O(n)) for binary search on sorted data (O(log n)). Knowing what each Java collection operation costs is essential.</p>`,
[[`Time complexity`,`How the number of steps grows with input size n.`],[`Space complexity`,`How extra memory grows with n.`],[`Amortised`,`Average cost over many operations (ArrayList add).`],[`Worst / average case`,`HashMap get is O(1) on average, worse with many collisions.`],[`Brute force`,`The straightforward, usually slow, solution.`]],
[`Count how many times the innermost work runs in terms of n.`,`Keep the fastest-growing term and drop constants (3n² + 5n → O(n²)).`,`Add costs of the library calls you use (contains, sort, remove).`,`State both time and space.`],
[`Back-of-envelope: ~10⁸ simple steps per second; check n × complexity against your time budget.`,`Profile real code too: constants and memory access patterns matter in practice.`],
[`Calling list.contains or list.remove(0) inside loops.`,`Forgetting recursion stack space.`,`Optimising before checking the input size.`]),
  quiz: [
    [`Two nested loops over the same array of n elements. Time complexity?`,[`O(n)`,`O(n²)`,`O(log n)`,`O(2n)`],1,`Each of n iterations runs up to n inner iterations.`,'E'],
    [`What does replacing a nested-loop duplicate check with a HashSet cost?`,[`Nothing: it's strictly better`,`O(n) extra memory`,`O(n²) memory`,`It only works on sorted data`],1,`Time drops to O(n); space rises to O(n).`,'M'],
    [`<code>for (x : list) if (otherList.contains(x)) …</code> with both lists of size n. Complexity, and fix?`,[`O(n): contains is O(1)`,`O(n log n): contains uses binary search`,`O(n²); put otherList into a HashSet first`,`O(1)`],2,`List.contains scans the list.`,'H'],
    [`What's the time complexity of accessing <code>array[i]</code>?`,[`O(n)`,`O(1)`,`O(log n)`,`O(n²)`],1,`Direct address calculation.`,'E'],
    [`Binary search on n sorted items is?`,[`O(n)`,`O(log n)`,`O(1)`,`O(n log n)`],1,`Halving each step.`,'E'],
    [`Sorting n items with a comparison sort is at best?`,[`O(n)`,`O(n log n)`,`O(log n)`,`O(n²)`],1,`Merge/TimSort.`,'E'],
    [`What's the space complexity of a HashSet holding n items?`,[`O(1)`,`O(n)`,`O(log n)`,`O(n²)`],1,`Memory grows with the input.`,'E'],
    [`Two separate (not nested) loops over n items?`,[`O(n²)`,`O(n)`,`O(2ⁿ)`,`O(log n)`],1,`O(n) + O(n) = O(n).`,'M'],
  ],
  quizAdv: [
    [`HashMap get is O(1) on average. When can it degrade?`,[`When keys are Strings, since their hashCode is recomputed on every get`,`When the map is small, because it scans the table instead of hashing`,`When many keys collide (bad hashCode); Java 8 trees keep it O(log n) per bucket`,`When the load factor passes 0.75, since resizing makes every get O(n)`],2,`Treeified bins (2.2) bound the worst case.`,'H'],
    [`Recursive DFS on a path-shaped graph of n nodes: extra space?`,[`O(n): the call stack depth`,`O(1): recursion reuses one frame`,`O(log n): the stack is balanced`,`O(n²): each frame copies the path`],0,`Recursion depth counts as space.`,'M'],
    [`Amortised O(1) for ArrayList.add means?`,[`Every single add is guaranteed O(1) by preallocation`,`Occasional O(n) resizes average out to O(1) per add`,`Each add is O(log n) because the array grows by half`,`Adds are O(1) except at the end, where they're O(n)`],1,`Doubling-style growth.`,'M'],
    [`Recursion that splits the problem in half and does O(n) work per level (merge sort)?`,[`O(n)`,`O(n log n)`,`O(n²)`,`O(log n)`],1,`log n levels × n work.`,'H'],
  ],
});
