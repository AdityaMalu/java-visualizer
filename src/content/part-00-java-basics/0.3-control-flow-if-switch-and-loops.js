/* 0.3 Control flow: if, switch and loops */
topic('0', { no:'0.3', title:'Control flow: if, switch and loops', imp:'extra', idea:`Make decisions with <code>if</code> and <code>switch</code>, repeat with loops, and steer them with <code>break</code> and <code>continue</code>. Then the classic switch fall-through bug.`,
actors:'Thread', stateTitle:'Variables',
codes:{a:`int score = 82;
String grade;
if (score >= 90)      grade = "A";
else if (score >= 75) grade = "B";
else                  grade = "C";

String msg = switch (grade) {        // switch expression (Java 14+)
  case "A" -> "Excellent";
  case "B", "C" -> "Good";
  default -> "Unknown";
};

int sum = 0;
for (int n = 1; n <= 10; n++) {
  if (n % 2 == 0) continue;          // skip even numbers
  if (n > 7) break;                  // leave the loop
  sum += n;
}`,
b:`String msg;
switch (grade) {                     // classic switch statement
  case "A": msg = "Excellent";
  case "B": msg = "Good";            // no break above: falls through!
            break;
  default:  msg = "Unknown";
}
// grade = "A" → msg ends up "Good"`},
steps:[
{hl:{main:[1,3,4]}, th:[], g:[G('Variables',['score','82'],['score >= 90','false'],['score >= 75','true','hot'],['grade','"B"','hot'])],
 say:`An <code>if / else if / else</code> chain checks conditions top to bottom and runs the <b>first</b> branch whose condition is true. 82 isn't ≥ 90, but it is ≥ 75, so grade = "B" and the rest is skipped.`},
{hl:{main:[7,9]}, g:[G('Variables',['grade','"B"'],['msg','"Good"','hot'])],
 say:`A <b>switch expression</b> picks a value by matching cases. Arrow cases (<code>-&gt;</code>) never fall through, several labels can share a case (<code>"B", "C"</code>), and the compiler requires every possibility to be covered (here via <code>default</code>).`},
{hl:{main:[13,14,17]}, g:[G('Loop',['n','1'],['n % 2 == 0','false'],['sum','1','hot'])],
 say:`A <code>for</code> loop has three parts: start (<code>n = 1</code>), condition checked before each pass (<code>n &lt;= 10</code>), and step after each pass (<code>n++</code>). First pass: 1 is odd and not > 7, so sum = 1.`},
{hl:{main:[14,15]}, g:[G('Loop',['n','2'],['n % 2 == 0','true → continue','hot'],['sum','1'])],
 say:`<code>continue</code> skips the <b>rest of this pass</b> and goes straight to the step (<code>n++</code>). Even numbers never reach <code>sum += n</code>.`},
{hl:{main:[17]}, g:[G('Loop',C('odd n added',[['1'],['3'],['5'],['7','hot']]),['sum','1 + 3 + 5 + 7 = 16','hot'])],
 say:`Passes for 3, 5 and 7 add to the sum; 4 and 6 are skipped by continue.`},
{hl:{main:[16]}, g:[G('Loop',['n','8 → continue, then 9'],['9 > 7','true → break','bad'],['sum (final)','16','ok'])],
 say:`At 8, continue. At 9, <code>break</code> exits the <b>whole loop</b> immediately, even though the condition <code>n &lt;= 10</code> is still true. Final sum: 16. (Other loops: <code>while (cond)</code> checks first; <code>do { } while (cond)</code> runs at least once; <code>for (x : list)</code> walks a collection.)`},
{cv:'b', hl:{main:[3,4,5]}, g:[G('Variables',['grade','"A"'],['case "A"','msg = "Excellent"'],['falls into case "B"','msg = "Good"','bad'],['break','leaves the switch'])], log:['msg = Good   (expected Excellent)'],
 say:`<b>The classic bug.</b> In an old-style <code>switch</code> statement with colons, execution <b>falls through</b> into the next case unless you write <code>break</code>. "A" sets "Excellent", then runs on into case "B" and overwrites it. Prefer arrow cases or switch expressions, which can't fall through.`}
],
keep:[`if/else if picks the first true branch; switch expressions (->) never fall through and must be exhaustive.`,`continue skips to the next pass; break leaves the loop.`,`Old colon-style switch falls through without break: a classic bug.`]}, {
  imp: 'good',
  theory: TH(`Control flow decides which statements run: if and switch choose between paths, loops repeat code, and break/continue change a loop's course.`,
`<p>By default statements run top to bottom. <b>if</b> runs a block only when a condition is true; add <b>else if</b> and <b>else</b> for alternatives. <b>switch</b> chooses among many cases based on one value; modern switch <i>expressions</i> with arrows are concise and safe.</p>
<p><b>Loops</b> repeat work: <code>for</code> when you know the count, <code>while</code> while a condition holds, <code>do-while</code> to run at least once, and the enhanced <code>for (item : collection)</code> to visit every element. <code>break</code> leaves a loop; <code>continue</code> jumps to its next pass.</p>`,
[[`Condition`,`An expression that's true or false.`],[`Block`,`Statements inside { }.`],[`Switch expression`,`switch that produces a value, with -> cases.`],[`Fall-through`,`Old switch behaviour: without break, execution continues into the next case.`],[`Enhanced for`,`for (T x : items): loops over every element.`]],
[`Evaluate the condition.`,`Run the matching branch (or skip it).`,`For loops: initialise, check the condition, run the body, update, repeat.`,`break exits the loop; continue jumps to the update step.`],
[`Prefer early returns over deeply nested ifs.`,`Use switch expressions with enums and sealed types so the compiler checks every case.`,`Prefer streams or enhanced for over manual index loops when you don't need the index.`],
[`Missing break in a classic switch.`,`Off-by-one loop bounds (<code>&lt;=</code> vs <code>&lt;</code>).`,`Infinite loops whose condition never changes.`]),
  quiz: [
    [`In a for loop, what does <code>continue</code> do?`,[`Exits the loop`,`Skips to the next iteration`,`Restarts the loop from the beginning`,`Pauses the thread`],1,`break exits; continue skips the rest of the current pass.`,'E'],
    [`Which loop always runs its body at least once?`,[`while`,`for`,`enhanced for`,`do-while`],3,`do-while checks the condition after the body.`,'E'],
    [`Classic switch: <code>case 1: x = "one"; case 2: x = "two"; break;</code>. With value 1, x is?`,[`"one"`,`"two"`,`null`,`Compile error`],1,`No break after case 1, so it falls through into case 2.`,'M'],
    [`How many times does <code>for (int i = 0; i &lt; 5; i++)</code> run its body?`,[`4`,`5`,`6`,`Forever`],1,`i = 0, 1, 2, 3, 4.`,'E'],
    [`<code>while (x &gt; 0) { x--; }</code> with x = 0 at the start. How many iterations?`,[`0`,`1`,`Infinite`,`-1`],0,`while checks the condition before the first pass.`,'E'],
    [`Which loop is best for visiting every element of a List when you don't need the index?`,[`A for loop with list.get(i)`,`do-while`,`The enhanced for: for (T x : list)`,`A switch`],2,`It uses the iterator and works for any Iterable.`,'E'],
    [`Inside nested loops, a plain <code>break</code> exits?`,[`Both loops`,`Only the innermost loop`,`The method`,`The outer loop only`],1,`Use a labelled break (outer: … break outer;) to exit both.`,'M'],
    [`A switch expression on a String has cases "A" and "B" but no default. What happens?`,[`Compile error: switch expressions must be exhaustive`,`It returns null for any value not listed`,`It compiles but throws only at run time`,`It falls through to the "B" case by default`],0,`Only enums/sealed types can be exhaustive without default.`,'H'],
  ],
  quizAdv: [
    [`Can a switch expression with <code>-&gt;</code> cases fall through?`,[`Yes, like classic switch`,`Only without default`,`No`,`Only for Strings`],2,`Arrow cases run exactly one branch.`,'M'],
    [`<code>for (int i = 0; i &lt; 3; i++) { }</code> What is i after the loop?`,[`Compile error if used: i is scoped to the loop`,`3, the value that ended the loop`,`2, the last value used in the body`,`0, because i is reset after the loop`],0,`A variable declared in the for header only exists inside the loop.`,'H'],
    [`What does <code>case "B", "C" -&gt; …</code> mean in a switch expression?`,[`It matches only "BC"`,`It's a syntax error`,`Either "B" or "C" runs this branch`,`It falls through from B to C`],2,`Multiple labels per case, no fall-through.`,'M'],
    [`In a switch expression with a block body, how do you produce the value?`,[`return value;`,`yield value;`,`break value;`,`The last expression is used`],1,`yield returns a value from a switch expression block.`,'H'],
  ],
});
