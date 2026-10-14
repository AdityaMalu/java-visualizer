/* 11.2 Two pointers and sliding window */
topic('11', { no:'11.2', title:'Two pointers and sliding window', imp:'must', idea:`Two patterns that turn O(n²) array and string problems into O(n): two pointers moving towards each other on a sorted array, and a window that grows and shrinks along a string.`,
actors:'Pointers', stateTitle:'Array / window',
codes:{a:`// sorted input: find two numbers that add up to target
int[] pairSum(int[] a, int target) {
  int left = 0, right = a.length - 1;
  while (left < right) {
    int sum = a[left] + a[right];
    if (sum == target) return new int[]{left, right};
    if (sum < target) left++;      // need a bigger sum: move left up
    else right--;                  // need a smaller sum: move right down
  }
  return null;
}`,
b:`// longest substring without repeating characters
int longestUnique(String s) {
  Map<Character, Integer> lastSeen = new HashMap<>();
  int best = 0, start = 0;
  for (int end = 0; end < s.length(); end++) {
    char c = s.charAt(end);
    if (lastSeen.containsKey(c) && lastSeen.get(c) >= start)
      start = lastSeen.get(c) + 1;           // shrink: jump past the repeat
    lastSeen.put(c, end);
    best = Math.max(best, end - start + 1);
  }
  return best;
}`},
steps:[
{hl:{L:[3],R:[3]}, th:[['L','RUN','index 0'],['R','RUN','index 5']], g:[G('a (sorted), target 10',C('',[['1','hot'],['3'],['4'],['6'],['8'],['11','hot']]),['sum','1 + 11 = 12 > 10'])],
 say:`<b>Two pointers.</b> The array is sorted and we want a pair summing to 10. Brute force checks all pairs: O(n²). Instead, start with one pointer at each end. Sum = 12, too big.`},
{hl:{R:[8]}, th:[['L','RUN','index 0'],['R','RUN','index 4']], g:[G('a (sorted), target 10',C('',[['1','hot'],['3'],['4'],['6'],['8','hot'],['11','dim']]),['sum','1 + 8 = 9 < 10'])],
 say:`Too big, so move <b>right</b> down: no pair using 11 can work, because 11 plus even the smallest number (1) is already too big. Every move safely discards one element. Now 9: too small.`},
{hl:{L:[7]}, th:[['L','RUN','index 1'],['R','RUN','index 4']], g:[G('a (sorted), target 10',C('',[['1','dim'],['3','hot'],['4'],['6'],['8','hot'],['11','dim']]),['sum','3 + 8 = 11 > 10'])],
 say:`Too small, so move <b>left</b> up: 1 plus the largest remaining number is too small, so 1 can't be in any answer. 3 + 8 = 11, too big again.`},
{hl:{L:[7],R:[8]}, th:[['L','RUN','index 2'],['R','RUN','index 3']], g:[G('a (sorted), target 10',C('',[['1','dim'],['3','dim'],['4','ok'],['6','ok'],['8','dim'],['11','dim']]),['sum','4 + 6 = 10','ok'])], log:['pairSum → [2, 3]'],
 say:`Right moves to 6 (3 + 6 = 9), then left moves to 4: 4 + 6 = 10. Found it. Each step moved one pointer inward, so it's at most n steps: <b>O(n) time, O(1) space</b>. Same idea: reversing an array, palindrome checks, merging two sorted lists, 3-sum (sort + two pointers).`},
{cv:'b', hl:{end:[5,6,9,10]}, th:[['start','RUN','0'],['end','RUN','0 → 2']], g:[G('s = "abcabcbb"',C('window',[['a','ok'],['b','ok'],['c','ok'],['a'],['b'],['c'],['b'],['b']]),['best','3'])],
 say:`<b>Sliding window</b> for "longest substring without repeats". A window [start, end] grows to the right one character at a time while it has no repeats: "abc", length 3. A map remembers the last index of each character.`},
{hl:{end:[7,8]}, th:[['start','RUN','0 → 1'],['end','RUN','3 (a)']], g:[G('s = "abcabcbb"',C('window',[['a','dim'],['b','ok'],['c','ok'],['a','ok'],['b'],['c'],['b'],['b']]),['repeat','a last seen at 0 → start = 1','hot'],['best','3'])],
 say:`At index 3 we meet 'a' again, last seen at 0, inside the window. <b>Shrink</b> by moving start just past it, to 1. The window "bca" is valid again. The start pointer only moves forward, never back.`},
{hl:{end:[5,10]}, th:[['start','RUN','… → 7'],['end','TERM','7']], g:[G('s = "abcabcbb"',C('window',[['a','dim'],['b','dim'],['c','dim'],['a','dim'],['b','dim'],['c','dim'],['b','dim'],['b','ok']]),['best','3','ok'])], log:['longestUnique("abcabcbb") → 3'],
 say:`Each index enters the window once and leaves at most once, so the whole scan is <b>O(n)</b> instead of checking every substring (O(n²) or worse). The pattern fits "longest/shortest subarray or substring with property X": max sum of k consecutive items, smallest window containing all letters, and so on.`}
],
keep:[`Two pointers (sorted input): move the pointer that can't be part of an answer; O(n), O(1) space.`,`Sliding window: extend end, shrink start when the window breaks the rule; each index enters/leaves once → O(n).`,`Signals: "pair/triplet in a sorted array", "longest/shortest contiguous subarray/substring".`]}, {
  imp: 'good',
  theory: TH(`Two pointers and sliding windows scan an array or string with two moving indexes, avoiding nested loops by using order or a window invariant.`,
`<p>Many problems ask about pairs or contiguous ranges: "two numbers that sum to X", "longest substring with no repeats", "max sum of k consecutive elements". Checking every pair or range is O(n²) or worse.</p>
<p>With <b>two pointers</b> on sorted input, you start at both ends and move one pointer inward based on a comparison, discarding an element each step. With a <b>sliding window</b>, you keep a range [start, end] that satisfies a rule, extending the end and shrinking the start, so each element enters and leaves once.</p>`,
[[`Two pointers`,`Two indexes moving through the data, often from both ends.`],[`Sliding window`,`A contiguous range that grows and shrinks.`],[`Invariant`,`A condition the window always keeps (no duplicates, sum ≤ k).`],[`Monotonic move`,`Pointers only move forward, guaranteeing O(n).`]],
[`Decide what the pointers or window represent.`,`Define when to move which pointer (or when to shrink).`,`Update the answer at each valid state.`,`Argue that each index moves at most n times → O(n).`],
[`Pairs/triplets in sorted arrays, merging sorted lists, palindromes.`,`Rate limiting over a time window uses the same sliding-window idea.`],
[`Using two pointers on unsorted data where order matters.`,`Moving the start pointer backwards.`,`Off-by-one window lengths (end − start + 1).`]),
  quiz: [
    [`Two pointers to find a pair with a given sum works directly on which input?`,[`Any array`,`Linked lists only`,`Arrays with no duplicates`,`Sorted arrays`],3,`Order tells you which pointer to move.`,'E'],
    [`Sorted array, sum of a[left] + a[right] is too small. Which pointer moves?`,[`left moves right`,`right moves left`,`both move`,`restart`],0,`Only a bigger left value can increase the sum.`,'M'],
    [`Why is the sliding window solution for "longest substring without repeats" O(n)?`,[`A HashMap makes each repeat check O(1), so the scan is O(n)`,`The alphabet is bounded, so the window never exceeds 26 chars`,`Each index is added once and removed at most once; start never moves back`,`It stops as soon as the window covers every distinct character`],2,`Both pointers only move forward.`,'H'],
    [`Reverse an array in place with two pointers: where do they start?`,[`Both at index 0, one moving twice as fast`,`One at each end, swapping and moving inward`,`Both at the middle, moving outward and swapping`,`One at the start, one at the middle, both moving right`],1,`O(n) time, O(1) space.`,'E'],
    [`Check if a string is a palindrome efficiently?`,[`Reverse it with a StringBuilder and compare with equals`,`Two pointers from both ends comparing characters`,`Push half onto a stack, then pop while scanning the rest`,`Compare the hashCode of the string and of its reverse`],1,`O(1) extra space.`,'E'],
    [`Fixed-size window sum: when moving the window by one, you?`,[`Recompute the sum of the window from scratch`,`Add the new element and subtract the one leaving`,`Add the new element and subtract the window's minimum`,`Replace the oldest element and re-sort the window`],1,`O(1) per move.`,'E'],
    [`Remove duplicates from a sorted array in place?`,[`Nested loops: shift the rest left on each duplicate`,`Slow/fast pointers: copy each new value forward`,`Copy everything into a HashSet, then back to the array`,`Two pointers from both ends, swapping duplicates out`],1,`O(n), O(1) space.`,'M'],
    [`Merge two sorted arrays?`,[`Concatenate them, then sort the result: O((n + m) log(n + m))`,`Two pointers taking the smaller head each time: O(n + m)`,`Binary search each element of one into the other: O(n log m)`,`Insert both into a TreeSet and copy them back out in order`],1,`Merge step of merge sort.`,'M'],
  ],
  quizAdv: [
    [`Max sum of any 3 consecutive elements in an array. Efficient approach?`,[`Check all triples with three nested loops, O(n³)`,`Sort the array and sum the three largest values, O(n log n)`,`Fixed-size window: add the new element, subtract the one leaving, O(n)`,`Use prefix sums and binary search for each start, O(n log n)`],2,`A fixed window updates in O(1) per step.`,'M'],
    [`3-sum (triplets summing to 0) typical complexity with sort + two pointers?`,[`O(n)`,`O(n log n)`,`O(n³)`,`O(n²)`],3,`Fix one element, two-pointer the rest: n × n.`,'H'],
    [`Smallest subarray with sum ≥ target (positive numbers). Approach?`,[`Check all subarrays with prefix sums for O(1) sums, O(n²) overall`,`Variable sliding window: expand right, shrink left while sum ≥ target`,`Sort the numbers and take the largest ones until the sum is reached`,`Fixed-size window, trying every length from 1 to n until one works`],1,`O(n).`,'H'],
    [`Why does the sliding window fail for "subarray sum = k" with negative numbers?`,[`It works if you take absolute values before summing the window`,`Shrinking no longer reliably decreases the sum; use prefix sums + HashMap`,`Negative numbers overflow the running sum; use long and a window`,`Sorting the array first restores the monotonic window property`],1,`Monotonicity is lost.`,'H'],
  ],
});
