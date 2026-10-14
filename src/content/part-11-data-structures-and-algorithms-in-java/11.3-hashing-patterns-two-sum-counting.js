/* 11.3 Hashing patterns: two-sum, counting, grouping */
topic('11', { no:'11.3', title:'Hashing patterns: two-sum, counting, grouping', imp:'must', idea:`Three HashMap patterns that solve a huge share of interview problems in one pass: remember complements (two-sum), count frequencies, and group by a computed key (anagrams).`,
actors:'Loop', stateTitle:'Map contents',
codes:{a:`// 1. Two-sum (unsorted): one pass, remembering value → index
int[] twoSum(int[] a, int target) {
  Map<Integer, Integer> seen = new HashMap<>();
  for (int i = 0; i < a.length; i++) {
    Integer j = seen.get(target - a[i]);       // seen the complement already?
    if (j != null) return new int[]{j, i};
    seen.put(a[i], i);
  }
  return null;
}
// 2. Frequency count
Map<String, Integer> freq = new HashMap<>();
for (String w : words) freq.merge(w, 1, Integer::sum);
// 3. Group anagrams: same sorted letters → same key
Map<String, List<String>> groups = new HashMap<>();
for (String w : words) {
  char[] k = w.toCharArray(); Arrays.sort(k);
  groups.computeIfAbsent(new String(k), x -> new ArrayList<>()).add(w);
}`},
steps:[
{hl:{i:[2,3,4,5,7]}, th:[['i','RUN','0 → 7']], g:[G('a = [7, 2, 11, 15], target 9',C('',[['7','hot'],['2'],['11'],['15']]),['need','9 − 7 = 2: not seen']), G('seen',['7','→ index 0','hot'])],
 say:`<b>Two-sum, unsorted.</b> For each number, the partner we need is <code>target − a[i]</code>. Instead of searching for it (O(n) each time), look it up in a map of numbers seen so far: O(1). 7 needs 2, which hasn't appeared yet, so remember 7 → 0.`},
{hl:{i:[5,6]}, th:[['i','TERM:ok','1 → 2']], g:[G('a = [7, 2, 11, 15], target 9',C('',[['7','ok'],['2','ok'],['11'],['15']]),['need','9 − 2 = 7: seen at 0','ok']), G('seen',['7','→ index 0'])], log:['twoSum → [0, 1]'],
 say:`2 needs 7, and the map says 7 was at index 0: answer [0, 1]. <b>One pass, O(n) time, O(n) space</b>, versus O(n²) for checking all pairs. Checking before inserting also avoids pairing an element with itself.`},
{hl:{i:[11,12,13]}, th:[['i','TERM:ok','6 words']], g:[G('words',C('',[['to'],['be'],['or'],['not'],['to'],['be']])), G('freq',['to','2','hot'],['be','2','hot'],['or','1'],['not','1'])],
 say:`<b>Counting.</b> <code>merge(w, 1, Integer::sum)</code> inserts 1 for a new key or adds 1 to the existing count, in one call. Counting underlies "most frequent element", "first unique character", "is it a permutation?" and top-K (combine with a heap, 2.8).`},
{hl:{i:[15,16,17,18,19]}, th:[['i','RUN','eat, tea, tan …']], g:[G('words',C('',[['eat'],['tea'],['tan'],['ate'],['nat'],['bat']])), G('key = sorted letters',['eat → "aet"',''],['tea → "aet"','same key','hot'],['tan → "ant"',''])],
 say:`<b>Grouping by a computed key.</b> Two words are anagrams if their sorted letters match, so the sorted letters make a perfect map key. <code>computeIfAbsent</code> creates the list the first time a key appears.`},
{hl:{i:[18]}, th:[['i','TERM:ok','done']], g:[G('groups',['"aet"','[eat, tea, ate]','ok'],['"ant"','[tan, nat]','ok'],['"abt"','[bat]','ok'])],
 say:`One pass: O(n · k log k) for n words of length k. The same pattern groups transactions by day, logs by user, points by grid cell. The key must have correct equals/hashCode (2.3): Strings and records are safe; arrays are not.`},
{th:[], g:[G('Recognise it',['"find pair/complement"','map of value → index'],['"count / most frequent / duplicates"','frequency map or set'],['"group things that are equivalent"','map of canonical key → list'],['"seen this state before?"','HashSet of states'])],
 say:`<b>Rule of thumb:</b> when a brute force searches the input again for each element, ask whether a HashMap or HashSet can remember what you need in one pass. Mention the trade-off: O(n) extra memory, and worst-case behaviour if many keys collide.`}
],
keep:[`Two-sum: map value → index, look up target − x before inserting: O(n).`,`Count with merge(key, 1, Integer::sum); group with computeIfAbsent(key, k -> new ArrayList<>()).add(x).`,`Keys need proper equals/hashCode: use String or records, not arrays.`]}, {
  imp: 'good',
  theory: TH(`A HashMap or HashSet can remember what you've already seen in O(1), turning many "search again for each element" problems into a single pass.`,
`<p>When a brute-force solution loops over the data again for every element ("is the partner of this number somewhere?"), the fix is often to remember things as you go. A <b>HashMap</b> stores value → info (like index or count); a <b>HashSet</b> stores just "seen".</p>
<p>Three patterns cover a lot: <b>complement lookup</b> (two-sum), <b>frequency counting</b> (most common word, duplicates, anagram check) and <b>grouping by a canonical key</b> (anagrams, events per day).</p>`,
[[`Complement`,`The value you need to complete a pair (target − x).`],[`Frequency map`,`Map from item → count.`],[`Canonical key`,`A normalised form shared by equivalent items (sorted letters).`],[`merge / computeIfAbsent`,`Map methods for counting and grouping in one call.`]],
[`Ask what you'd need to know about earlier elements.`,`Store exactly that in a map or set as you scan.`,`Look up before inserting (to avoid matching an element with itself).`,`Return as soon as the answer is found.`],
[`Deduplicating events, counting by status, grouping orders by customer: everyday backend code, not just interviews.`],
[`Using arrays as map keys (identity hashCode).`,`Forgetting the O(n) memory cost.`]),
  quiz: [
    [`In one-pass two-sum, what do you store in the map?`,[`Each value → its index`,`Each pair of values`,`The running sum`,`Only the target`],0,`Then look up target − a[i] in O(1).`,'E'],
    [`Best way to count word frequencies in a HashMap?`,[`map.put(w, map.get(w) + 1)`,`map.putIfAbsent(w, 1)`,`map.replace(w, 1)`,`map.merge(w, 1, Integer::sum)`],3,`get + 1 throws NPE for new words; merge handles both cases.`,'M'],
    [`Grouping anagrams: why sort each word's letters?`,[`To make the final output come out in alphabetical order`,`Anagrams share the same sorted letters, giving a common key`,`HashMap keys must be sorted strings for lookups to work`,`Sorting removes duplicate letters, giving shorter keys`],1,`A canonical key maps equivalent items together.`,'M'],
    [`Check if two strings are anagrams in O(n)?`,[`Sort both and compare: sorting is linear for strings`,`Count letters with a map or int[26] and compare`,`Compare the sum of the character codes of both`,`Check each char of one with indexOf in the other`],1,`Sorting is O(n log n).`,'E'],
    [`First duplicate in an array?`,[`Sort it, then return the first equal neighbours`,`Scan with a HashSet; the first failed add is the answer`,`Nested loops, comparing each item with later ones`,`Two pointers from both ends moving toward each other`],1,`O(n).`,'E'],
    [`What does <code>map.getOrDefault(k, 0)</code> return for a missing key?`,[`null`,`0`,`Throws`,`k`],1,`Handy for counting.`,'E'],
    [`Most frequent element?`,[`Sort, then take the middle element`,`Frequency map, then the max entry`,`A max-heap of the raw values`,`A Set, then the largest element`],1,`O(n).`,'M'],
    [`Longest consecutive sequence (e.g. 100, 4, 200, 1, 3, 2 → 4) in O(n)?`,[`Sort the numbers, then count the longest run of +1 steps`,`Put all in a HashSet; start counting only from numbers whose n−1 is absent`,`Put all in a HashSet; count up from every number in the set`,`Use a min-heap and pop numbers while each is one larger`],1,`Each number is visited a constant number of times.`,'H'],
  ],
  quizAdv: [
    [`Why check the map before inserting in two-sum?`,[`To avoid pairing an element with itself`,`Inserting first makes the lookup O(n) for duplicates`,`HashMap.put throws if the key already exists`,`To keep the pairs in their original index order`],0,`e.g. target 10 with a single 5 must not match itself.`,'M'],
    [`Find the first non-repeating character in a string efficiently?`,[`Nested loops, checking each char against the rest`,`Sort the string, then find a char with no neighbour`,`A TreeSet of seen chars, then take the first() one`,`Count frequencies (LinkedHashMap or array), then scan in order`],3,`Two passes, O(n).`,'H'],
    [`Subarray sum equals k (with negatives) in O(n)?`,[`Sliding window that shrinks the left side while sum is over k`,`Prefix sums with a HashMap of prefix → count`,`Sort the array, then use two pointers to find sums equal to k`,`Binary search on prefix sums for each end index to find k`],1,`Count prefixes equal to current − k.`,'H'],
    [`Why use int[26] instead of a HashMap for lowercase letter counts?`,[`HashMap can't store char keys without converting them first`,`Faster and smaller: direct indexing, no boxing or hashing`,`int[26] is thread-safe, while HashMap needs synchronization`,`HashMap has a fixed capacity of 16, so it rehashes often`],1,`When the alphabet is small and known.`,'M'],
  ],
});
