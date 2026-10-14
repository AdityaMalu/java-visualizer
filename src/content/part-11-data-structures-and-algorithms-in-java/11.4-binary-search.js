/* 11.4 Binary search */
topic('11', { no:'11.4', title:'Binary search', imp:'must', idea:`Halve a sorted search space each step: 1,000,000 items in 20 comparisons. Trace a hit and a miss, avoid the midpoint overflow bug, and see "binary search on the answer".`,
actors:'Search', stateTitle:'Search space',
codes:{a:`int search(int[] a, int target) {          // a must be sorted
  int lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    int mid = lo + (hi - lo) / 2;          // not (lo + hi) / 2: can overflow
    if (a[mid] == target) return mid;
    if (a[mid] < target) lo = mid + 1;     // answer is to the right
    else hi = mid - 1;                     // answer is to the left
  }
  return -1;                               // not found
}
// Built in: Arrays.binarySearch(a, key), Collections.binarySearch(list, key)`},
steps:[
{hl:{s:[2,3,4]}, th:[['s','RUN','lo 0, hi 9, mid 4']], g:[G('a, target 61',C('',[['3'],['8'],['15'],['21'],['27','hot'],['34'],['42'],['56'],['61'],['77']]),['a[mid] = 27','< 61 → go right'])],
 say:`<b>Binary search</b> works on sorted data, like looking up a word in a dictionary by opening it in the middle. Compare the middle element with the target: 27 is less than 61, so the target can only be in the right half.`},
{hl:{s:[6,4]}, th:[['s','RUN','lo 5, hi 9, mid 7']], g:[G('a, target 61',C('',[['3','dim'],['8','dim'],['15','dim'],['21','dim'],['27','dim'],['34'],['42'],['56','hot'],['61'],['77']]),['a[mid] = 56','< 61 → go right'])],
 say:`Half the array is gone after one comparison. New middle: 56, still too small, so discard the left part again.`},
{hl:{s:[5]}, th:[['s','TERM:ok','found at 8']], g:[G('a, target 61',C('',[['3','dim'],['8','dim'],['15','dim'],['21','dim'],['27','dim'],['34','dim'],['42','dim'],['56','dim'],['61','ok'],['77']]),['comparisons','3'])], log:['search(a, 61) → 8'],
 say:`lo = 8, hi = 9, mid = 8: found. Each step halves the range, so it takes at most about log₂(n) steps: 20 for a million items, 30 for a billion. That's <b>O(log n)</b>.`},
{hl:{s:[7,9]}, th:[['s','TERM:warn','not found']], g:[G('a, target 50',['mid 4 → 27','go right'],['mid 7 → 56','go left'],['mid 5 → 34','go right'],['mid 6 → 42','go right'],['lo 7 > hi 6','stop → -1','bad'])], log:['search(a, 50) → -1'],
 say:`For a missing value the range shrinks until <code>lo &gt; hi</code>, which means "not here". Note where lo ended: index 7 is where 50 <i>would</i> be inserted. <code>Arrays.binarySearch</code> returns <code>-(insertion point) - 1</code> for that reason.`},
{hl:{s:[4]}, th:[], g:[G('Midpoint overflow',['lo + hi','can exceed Integer.MAX_VALUE for huge arrays','bad'],['(lo + hi) / 2','negative index → crash','bad'],['lo + (hi − lo) / 2','always safe','ok'],['or','(lo + hi) >>> 1'])],
 say:`A famous bug, present in the JDK's own binary search for years: <code>(lo + hi) / 2</code> overflows when both are large. Use <code>lo + (hi - lo) / 2</code>. Off-by-one errors (<code>&lt;</code> vs <code>&lt;=</code>, <code>mid</code> vs <code>mid ± 1</code>) are the other classic trap.`},
{th:[], g:[G('Binary search on the answer',['question','smallest ship capacity to deliver all packages in 5 days'],['observation','if capacity C works, any C\' > C works (monotonic)','ok'],['search space','capacity from max(weight) to sum(weights)'],['each step','simulate: O(n)'],['total','O(n log(sum))','ok'])],
 say:`Binary search isn't only for arrays. Whenever the answer has a <b>yes/no test that flips once</b> ("does capacity C work?"), you can binary-search the answer range: minimum capacity, smallest time, largest feasible value. Also: first/last occurrence of a value, and search in a rotated sorted array.`}
],
keep:[`Sorted input → halve the range each step: O(log n).`,`mid = lo + (hi − lo) / 2; loop while lo <= hi; move lo = mid + 1 or hi = mid − 1.`,`Monotonic yes/no condition → binary search on the answer range.`]}, {
  imp: 'good',
  theory: TH(`Binary search finds a value in sorted data by repeatedly halving the search range, taking O(log n) steps.`,
`<p>To find a word in a dictionary you don't read every page: you open the middle, see whether your word comes before or after, and repeat on that half. That's <b>binary search</b>. Each comparison discards half of what's left, so a million items need about 20 comparisons.</p>
<p>It only works when the data is <b>sorted</b>, or more generally when there's a yes/no condition that flips exactly once across the range. That generalisation, "binary search on the answer", solves many optimisation problems.</p>`,
[[`lo / hi / mid`,`Bounds of the remaining range and its middle.`],[`O(log n)`,`Steps grow with the logarithm of n.`],[`Insertion point`,`Where a missing value would go to keep the order.`],[`Monotonic predicate`,`A condition that is false then true (or vice versa) exactly once.`]],
[`Set lo and hi to the range ends.`,`Compute mid safely: lo + (hi − lo) / 2.`,`Compare and discard the half that can't contain the answer.`,`Stop when found, or when lo > hi (not found).`],
[`Arrays.binarySearch, Collections.binarySearch, TreeMap.floorKey all rely on sorted order.`,`Binary search on the answer: minimum capacity, smallest time limit, git bisect.`],
[`Binary searching unsorted data.`,`(lo + hi) / 2 overflow.`,`Infinite loops from lo = mid instead of mid + 1.`]),
  quiz: [
    [`About how many comparisons does binary search need for 1,000,000 sorted items?`,[`1,000,000`,`1,000`,`20`,`500,000`],2,`log₂(1,000,000) ≈ 20.`,'E'],
    [`Why write <code>mid = lo + (hi - lo) / 2</code>?`,[`It avoids a division, so it's faster`,`lo + hi can overflow int for very large arrays`,`lo + hi rounds the wrong way for odd sums`,`(lo + hi) / 2 breaks when lo is negative`],1,`The overflow bug lived in the JDK for years.`,'M'],
    [`"Minimum ship capacity to deliver all packages in D days" can use binary search because...`,[`the packages are already sorted by weight`,`capacities are integers, so the range is finite`,`D is small enough to try every split of days`,`if a capacity works, every larger one works too (monotonic)`],3,`Binary search the answer range with a feasibility check.`,'H'],
    [`Binary search requires the data to be?`,[`Unique`,`Sorted (or monotonic)`,`Small`,`In a HashMap`],1,`Otherwise halving is meaningless.`,'E'],
    [`What's the loop condition in the standard version?`,[`lo &lt; hi - 1`,`lo &lt;= hi`,`lo != hi`,`true`],1,`With hi = length − 1.`,'E'],
    [`What does <code>Collections.binarySearch(list, key)</code> need?`,[`A RandomAccess list, sorted or not`,`A list sorted in ascending order (by the same comparator)`,`A list sorted in descending order`,`A list with no duplicate elements`],1,`Otherwise results are undefined.`,'E'],
    [`On a LinkedList, is binary search O(log n)?`,[`Yes, the iterator jumps to the middle in O(1) each step`,`No: reaching the middle is O(n), so overall it's O(n)`,`Yes, LinkedList caches node positions after the first pass`,`No: it falls back to a linear scan, so it's O(n log n)`],1,`Random access matters.`,'M'],
    [`Find the square root (floor) of n without Math.sqrt?`,[`Linear scan from n downward until x*x ≤ n`,`Binary search on the answer: largest x with x*x ≤ n`,`Newton's method on the smallest x with x*x ≥ n`,`Binary search for the smallest x with x*x &gt; n, then return it`],1,`O(log n).`,'M'],
  ],
  quizAdv: [
    [`<code>Arrays.binarySearch(a, 50)</code> returns -8. What does that mean?`,[`Found at index 8 after counting from the end`,`Not found; insertion point is 7`,`Not found; insertion point is 8`,`Not found; the array has 8 elements smaller`],1,`-(insertion point) - 1 = -8 → insertion point 7.`,'H'],
    [`Find the first occurrence of a value with duplicates. Change from plain binary search?`,[`On a match, record it and keep searching left (hi = mid − 1)`,`Return on the first match, since it's always leftmost`,`On a match, record it and keep searching right (lo = mid + 1)`,`On a match, set hi = mid and stop when lo == mid`],0,`Lower-bound variant.`,'M'],
    [`Search in a rotated sorted array (e.g. 4 5 6 7 0 1 2)?`,[`Impossible in O(log n): find the pivot with a linear scan first`,`Binary search: at each step one half is sorted; check if target lies in it`,`Sort it back in O(n log n), then run plain binary search`,`Binary search on the left half only, since it stays sorted`],1,`Still O(log n).`,'H'],
    [`Lower bound (first index with a[i] ≥ x) loop typically uses?`,[`lo &lt;= hi with hi = mid - 1 on match, returning mid on equality`,`lo &lt; hi with hi = mid when a[mid] ≥ x, else lo = mid + 1`,`lo &lt; hi with lo = mid when a[mid] &lt; x, else hi = mid - 1`,`lo &lt;= hi with lo = mid + 1 when a[mid] ≥ x, else hi = mid`],1,`Half-open interval variant.`,'H'],
  ],
});
