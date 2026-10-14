/* 11.6 Dynamic programming basics */
topic('11', { no:'11.6', title:'Dynamic programming basics', imp:'good', idea:`When a recursive solution keeps solving the same subproblems, store the answers. See Fibonacci go from 331 million calls to 79, then fill a table for the minimum number of coins.`,
actors:'Computation', stateTitle:'Memo / table', logTitle:'Call counts',
codes:{a:`// Naive recursion: recomputes the same values again and again
long fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

// Memoised (top-down): each n computed once → O(n)
Map<Integer, Long> memo = new HashMap<>();
long fibMemo(int n) {
  if (n < 2) return n;
  Long cached = memo.get(n);
  if (cached != null) return cached;
  long v = fibMemo(n - 1) + fibMemo(n - 2);
  memo.put(n, v);
  return v;
}

// Bottom-up table: fewest coins that make an amount
int minCoins(int[] coins, int amount) {
  int[] dp = new int[amount + 1];                   // dp[x] = fewest coins for x
  Arrays.fill(dp, Integer.MAX_VALUE); dp[0] = 0;
  for (int x = 1; x <= amount; x++)
    for (int c : coins)
      if (c <= x && dp[x - c] != Integer.MAX_VALUE)
        dp[x] = Math.min(dp[x], dp[x - c] + 1);
  return dp[amount] == Integer.MAX_VALUE ? -1 : dp[amount];
}`},
steps:[
{hl:{dp:[2]}, th:[['dp','RUN:bad','fib(40), naive']], g:[G('Call tree of fib(5)',['fib(5)','fib(4) + fib(3)'],['fib(4)','fib(3) + fib(2)'],['fib(3) computed','2 times','bad'],['fib(2) computed','3 times','bad'])], log:['fib(40): 331,160,281 calls, ~1.2 s'],
 say:`Naive recursive Fibonacci recomputes the same values over and over: fib(3) twice inside fib(5), and it gets exponentially worse. fib(40) makes over <b>331 million</b> calls: <b>O(2ⁿ)</b>. The subproblems <b>overlap</b>, which is the signal for dynamic programming.`},
{hl:{dp:[5,6,7,8,9,10,11,12]}, th:[['dp','RUN:ok','fibMemo(40)']], g:[G('memo after fibMemo(10)',C('n → value',[['2:1'],['3:2'],['4:3'],['5:5'],['6:8'],['7:13'],['8:21'],['9:34'],['10:55','hot']]))], log:['fibMemo(40): 79 calls, < 1 ms'],
 say:`<b>Memoisation</b> (top-down DP): same recursion, but store each answer the first time and return it from the map afterwards. Each n is computed once: <b>O(n)</b> time and space. (Don't use <code>memo.computeIfAbsent</code> with a recursive function here: HashMap throws ConcurrentModificationException when the mapping function modifies the map.)`},
{hl:{dp:[16,17,18]}, th:[['dp','RUN','minCoins([1,3,4], 6)']], g:[G('dp table',C('amount 0…6',[['0:0','ok'],['1:∞'],['2:∞'],['3:∞'],['4:∞'],['5:∞'],['6:∞']]))],
 say:`<b>Bottom-up</b> DP fills a table from small problems to big ones. <code>dp[x]</code> = fewest coins that make amount x, using coins 1, 3, 4. Start: 0 coins make 0; everything else "unknown" (∞).`},
{hl:{dp:[19,20,21,22]}, g:[G('dp table',C('amount 0…6',[['0:0'],['1:1','ok'],['2:2','ok'],['3:1','ok'],['4:1','ok'],['5:?','hot'],['6:∞']])), G('rule',['dp[x]','min over coins c of dp[x − c] + 1'])],
 say:`For each amount, try each coin as the last coin: <code>dp[x] = min(dp[x − c] + 1)</code>. dp[3] = 1 (one 3-coin), dp[4] = 1 (one 4-coin). Each answer is built from already-solved smaller amounts.`},
{hl:{dp:[22]}, g:[G('dp table',C('amount 0…6',[['0:0'],['1:1'],['2:2'],['3:1'],['4:1'],['5:2','ok'],['6:2','ok']])), G('amount 6',['last coin 1','dp[5] + 1 = 3'],['last coin 3','dp[3] + 1 = 2','ok'],['last coin 4','dp[2] + 1 = 3'])], log:['minCoins([1,3,4], 6) → 2  (3 + 3)'],
 say:`dp[5] = 2 (4 + 1), dp[6] = 2 (3 + 3). Note the <b>greedy</b> approach (take the biggest coin first) gives 4 + 1 + 1 = 3 coins, which is wrong; DP checks every option once. O(amount × coins) time.`},
{th:[], g:[G('Recognise DP',['optimal / count / possible?','"minimum", "number of ways", "can we"'],['choices at each step','take a coin, include an item, move right/down'],['overlapping subproblems','same state reached many ways','hot']), G('Recipe',['1. define the state','dp[x] means …'],['2. recurrence','dp[x] from smaller states'],['3. base cases','dp[0] = 0'],['4. order','fill so dependencies are ready'],['5. answer','dp[amount]'])],
 say:`<b>Recipe:</b> define what a state means, write the recurrence from smaller states, set base cases, fill in a valid order (or memoise the recursion), read the answer. Classic problems: climbing stairs, coin change, longest common subsequence, knapsack, edit distance, unique paths in a grid.`}
],
keep:[`DP = optimal substructure + overlapping subproblems → store answers instead of recomputing.`,`Top-down: recursion + memo map; bottom-up: fill a table from base cases.`,`Recipe: state, recurrence, base cases, order, answer. Greedy can fail where DP is correct.`]}, {
  imp: 'good',
  theory: TH(`Dynamic programming solves a problem by combining answers to smaller overlapping subproblems, computing each one only once.`,
`<p>Some recursive solutions explode because they solve the same subproblem again and again: naive Fibonacci recomputes fib(3) thousands of times. <b>Dynamic programming</b> stores each subproblem's answer and reuses it.</p>
<p>There are two styles: <b>top-down</b> (keep the recursion, add a memo map) and <b>bottom-up</b> (fill a table from the smallest cases upward). The hard part is choosing the <b>state</b>: what dp[x] means. Once that's clear, the recurrence usually follows.</p>`,
[[`Overlapping subproblems`,`The same smaller problem is needed many times.`],[`Optimal substructure`,`The best answer is built from best answers to subproblems.`],[`Memoisation`,`Caching results of recursive calls.`],[`Tabulation`,`Filling a dp table iteratively.`],[`State / recurrence`,`What dp[i] means / how it's computed from smaller states.`]],
[`Write the brute-force recursion and spot repeated calls.`,`Define the state and the recurrence.`,`Add memoisation, or fill a table bottom-up.`,`Optimise space if only recent rows are needed.`],
[`Pricing combinations, diffing text (edit distance, LCS), scheduling and resource allocation.`,`Interview classics: climbing stairs, coin change, knapsack, longest increasing subsequence.`],
[`Greedy choices where DP is required.`,`Wrong base cases.`,`Recursive memo with HashMap.computeIfAbsent (throws ConcurrentModificationException).`]),
  quiz: [
    [`What makes a problem a good fit for dynamic programming?`,[`Inputs that are sorted and searchable`,`Overlapping subproblems and optimal substructure`,`Choices that are always locally optimal`,`A recursion that splits into disjoint halves`],1,`Same subproblems recur, and answers combine.`,'E'],
    [`Naive recursive fib(n) runs in?`,[`O(n): each call runs once`,`O(n log n): calls split in two`,`O(n²): n levels of n calls`,`Exponential time, about O(2ⁿ)`],3,`Memoisation brings it to O(n).`,'M'],
    [`Coins {1, 3, 4}, amount 6. Greedy (largest first) vs optimal?`,[`Both give 2 coins (3+3)`,`Greedy 3 coins (4+1+1), optimal 2 (3+3)`,`Greedy 2 coins (4+2), optimal 3 (4+1+1)`,`Both give 3 coins (4+1+1)`],1,`Greedy isn't always optimal; DP checks every last-coin option.`,'H'],
    [`What's memoisation?`,[`Storing a loop's state so it can be resumed later`,`Caching results of function calls to reuse them`,`Converting a recursive function into an iterative loop`,`Sorting inputs so repeated calls are found faster`],1,`Top-down DP.`,'E'],
    [`Climbing stairs (1 or 2 steps): ways(n) = ?`,[`ways(n−1) × ways(n−2)`,`ways(n−1) + ways(n−2)`,`n²`,`2n`],1,`Like Fibonacci.`,'E'],
    [`Bottom-up DP fills the table in which order?`,[`Random`,`From base cases towards the answer`,`From the answer backwards`,`Alphabetical`],1,`So dependencies are ready.`,'E'],
    [`Why does greedy fail for coins {1, 3, 4} and amount 6?`,[`Greedy needs the coins sorted ascending; descending makes it pick 4+1+1`,`Taking 4 first leads to 4+1+1 (3 coins), but 3+3 (2 coins) is better`,`Greedy only works when the amount is a multiple of the largest coin, here 4`,`Taking 3 first leads to 3+1+1+1 (4 coins), while 4+1+1 is better`],1,`DP checks every choice.`,'M'],
    [`Space for the climbing-stairs DP can be reduced to?`,[`O(n): the dp array can't shrink`,`O(1): keep only the last two values`,`O(log n): by halving the steps`,`O(√n): keeping a block of values`],1,`Rolling variables.`,'M'],
  ],
  quizAdv: [
    [`Bottom-up DP for climbing stairs only needs dp[i-1] and dp[i-2]. Space optimisation?`,[`Keep two variables instead of an array: O(1) space`,`None possible: the table must keep every step`,`Use a HashMap so only visited steps are stored`,`Use recursion so the call stack holds the values`],0,`Many 1-D DPs only need the last few states.`,'M'],
    [`Why can <code>memo.computeIfAbsent(n, k -> fib(k-1) + fib(k-2))</code> fail on a HashMap?`,[`computeIfAbsent isn't supported on HashMap and throws UnsupportedOperationException at once`,`It returns null for the base cases, which HashMap rejects with a NullPointerException`,`The mapping function modifies the map, which HashMap detects and throws ConcurrentModificationException`,`The recursion depth always overflows the stack for n above 50, throwing StackOverflowError`],2,`Use explicit get/put for recursive memoisation.`,'H'],
    [`Longest common subsequence of strings of length n and m: table size and time?`,[`O(n + m)`,`O(n × m) for both`,`O(log n)`,`O(2ⁿ)`],1,`dp[i][j] from dp[i−1][j−1], dp[i−1][j], dp[i][j−1].`,'H'],
    [`0/1 knapsack: why iterate capacity backwards in the 1-D DP version?`,[`Iterating backwards visits fewer cells, so it's faster`,`So each item is used at most once (values from this item's round aren't reused)`,`So each item can be reused as many times as it fits`,`Forward iteration reads indexes below 0 and throws`],1,`Forwards would allow unlimited copies.`,'H'],
  ],
});
