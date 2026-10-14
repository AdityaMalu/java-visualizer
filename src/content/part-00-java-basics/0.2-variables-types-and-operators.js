/* 0.2 Variables, types and operators */
topic('0', { no:'0.2', title:'Variables, types and operators', imp:'good', idea:`The eight primitive types, and the arithmetic surprises every interviewer loves: integer division, overflow, <code>i++</code> vs <code>++i</code>, casts and short-circuiting.`,
actors:'Thread', stateTitle:'Variables',
codes:{a:`int apples = 7, people = 2;
int each = apples / people;            // integer division
int left = apples % people;            // remainder
double exact = apples / 2.0;           // one double → double math
long big = Integer.MAX_VALUE + 1;      // overflow happens in int first!
long fixed = Integer.MAX_VALUE + 1L;   // 1L makes it long math
int i = 5;
int a = i++;                           // use, then add
int b = ++i;                           // add, then use
byte small = (byte) 200;               // narrowing cast wraps around
boolean ok = people != 0 && apples / people > 1;  // && short-circuits
char c = 'A' + 1;                      // chars are numbers`},
steps:[
{th:[], g:[G('8 primitive types',['byte / short','8 / 16-bit whole numbers'],['int','32-bit, ±2.1 billion (default choice)'],['long','64-bit, add L: 10_000_000_000L'],['float / double','decimals (double is the default)'],['char','one UTF-16 character'],['boolean','true / false'])],
 say:`A <b>variable</b> is a named box with a <b>type</b>. Java has 8 <b>primitive</b> types holding plain values; everything else (String, arrays, your classes) is an <b>object</b> reached through a reference. The type fixes what a variable can hold and how big it is.`},
{hl:{main:[1,2]}, g:[G('Variables',['apples','7'],['people','2'],['each','3','hot'])],
 say:`<code>7 / 2</code> is <b>3</b>, not 3.5. When both sides are integers, Java does <b>integer division</b> and drops the fraction (it doesn't round).`},
{hl:{main:[3,4]}, g:[G('Variables',['each','3'],['left','1','hot'],['exact','3.5','hot'])],
 say:`<code>%</code> gives the <b>remainder</b> (handy for "is it even?": <code>n % 2 == 0</code>). If either side is a double, the math is done in double: <code>7 / 2.0</code> is 3.5.`},
{hl:{main:[5]}, g:[G('Variables',['Integer.MAX_VALUE','2147483647'],['big','-2147483648','bad'])], log:['MAX_VALUE + 1 computed as int → wraps to MIN_VALUE, then widened to long'],
 say:`<b>Overflow.</b> The right side is computed as <code>int</code> first. One past the maximum <b>wraps around</b> to the most negative int, silently, and only then is it stored in the long. The target type doesn't help.`},
{hl:{main:[6]}, g:[G('Variables',['big','-2147483648'],['fixed','2147483648','ok'])],
 say:`Make one operand long (<code>1L</code>) and the whole expression is computed in long. For money or counters that can grow, use long, or <code>Math.addExact</code>, which throws instead of wrapping.`},
{hl:{main:[7,8,9]}, g:[G('Variables',['i (start)','5'],['a = i++','5, then i becomes 6','hot'],['b = ++i','i becomes 7, then b = 7','hot'])],
 say:`<code>i++</code> (post-increment) gives you the <b>old</b> value, then adds one. <code>++i</code> (pre-increment) adds first and gives you the <b>new</b> value. On a line by itself, both just add one.`},
{hl:{main:[10]}, g:[G('Variables',['200 in binary','1100 1000'],['as a byte (-128..127)','-56','bad'])],
 say:`Converting to a <b>smaller</b> type needs an explicit <b>cast</b>, and it keeps only the low bits: 200 doesn't fit in a byte and becomes -56. Widening (int → long, int → double) is automatic and safe.`},
{hl:{main:[11]}, g:[G('Variables',['people != 0','true'],['apples / people > 1','true (only evaluated because left was true)'],['ok','true','ok'])],
 say:`<code>&&</code> and <code>||</code> <b>short-circuit</b>: if the left side already decides the answer, the right side never runs. That's what makes <code>people != 0 && apples / people > 1</code> safe from division by zero. The single <code>&</code> and <code>|</code> always evaluate both sides.`},
{hl:{main:[12]}, g:[G('Variables',["'A'",'65'],["'A' + 1",'66 → \'B\'','ok'])],
 say:`A <code>char</code> is a number (its Unicode code). <code>'A' + 1</code> is 66, which is 'B'. Also remember: <code>==</code> on primitives compares values; on objects it compares references (1.8).`}
],
keep:[`int / int drops the fraction; % is the remainder; one double makes it double math.`,`int arithmetic overflows silently before widening: use 1L, long, or Math.addExact.`,`i++ returns the old value, ++i the new; && / || short-circuit; narrowing casts wrap.`]}, {
  imp: 'good',
  theory: TH(`Variables are named, typed boxes for values; Java's eight primitive types hold plain numbers, characters and booleans, and operators combine them with some surprising rules.`,
`<p>A variable has a <b>type</b>, a <b>name</b> and a <b>value</b>: <code>int age = 30;</code>. Java is <b>statically typed</b>: the type is fixed when you write the code, and the compiler stops you putting a String into an int.</p>
<p>The eight <b>primitive</b> types are byte, short, int, long (whole numbers), float, double (decimals), char (a character) and boolean (true/false). Everything else is an object. Operators (<code>+ - * / %</code>, comparisons, <code>&& ||</code>) work on them, but integer math has rules that catch people out: division drops the fraction, and results that don't fit wrap around silently.</p>`,
[[`Primitive`,`A built-in value type (int, double, boolean…), not an object.`],[`Literal`,`A value written directly in code: 42, 3.5, 'A', "text", 10L.`],[`Integer division`,`int / int discards the remainder.`],[`Overflow`,`A result too big for its type wraps around.`],[`Cast`,`Explicit conversion, e.g. (int) 3.9 → 3.`],[`Short-circuit`,`&& and || skip the right side when the left decides.`]],
[`Declare a variable with a type, optionally with a starting value.`,`Expressions are evaluated using the operand types (int math if both are ints).`,`Widening (int → long → double) happens automatically; narrowing needs a cast.`,`<code>var</code> (Java 10+) lets the compiler infer a local variable's type.`],
[`Use int by default, long for ids, timestamps and counters that can grow, BigDecimal or long cents for money (1.10).`,`Use <code>Math.addExact</code> / <code>multiplyExact</code> where overflow must never go unnoticed.`],
[`Expecting <code>7 / 2</code> to be 3.5.`,`Computing large values in int before storing in long.`,`Confusing <code>=</code> (assign) with <code>==</code> (compare).`]),
  quiz: [
    [`<code>int x = 7 / 2;</code> What is x?`,[`3.5`,`4`,`3`,`Compile error`],2,`Integer division drops the fraction (it doesn't round).`,'E'],
    [`<code>int i = 5; int a = i++; int b = ++i;</code> What are a and b?`,[`a = 6, b = 7`,`a = 5, b = 6`,`a = 6, b = 6`,`a = 5, b = 7`],3,`i++ yields 5 (i becomes 6); ++i makes i 7 and yields 7.`,'M'],
    [`<code>long big = Integer.MAX_VALUE + 1;</code> What is big?`,[`-2147483648`,`2147483648`,`Compile error`,`ArithmeticException`],0,`The addition happens in int and overflows before the result is widened to long.`,'H'],
    [`Which type would you use for a whole number that may exceed 2.1 billion?`,[`int`,`short`,`long`,`float`],2,`int tops out at 2,147,483,647.`,'E'],
    [`<code>int r = 17 % 5;</code> What is r?`,[`3`,`2`,`3.4`,`12`],1,`17 = 3 × 5 + 2.`,'E'],
    [`<code>boolean b = (5 > 3) || (1 / 0 > 0);</code> What happens?`,[`ArithmeticException: / by zero`,`b is false`,`b is true; the right side never runs`,`Compile error`],2,`|| short-circuits once the left side is true.`,'M'],
    [`<code>int x = 3; x += 2.7;</code> What is x?`,[`5.7`,`5`,`6`,`Compile error`],1,`Compound assignment includes an implicit cast back to int (truncation).`,'H'],
    [`<code>var count = 10;</code> What type is count?`,[`Object`,`dynamic, it can change later`,`int, inferred at compile time`,`Integer`],2,`var is local type inference; the type is fixed.`,'M'],
  ],
  quizAdv: [
    [`<code>double d = 10 / 4;</code> What is d?`,[`2.5`,`2.0`,`3.0`,`Compile error`],1,`10 / 4 is int division (2), then widened to 2.0.`,'H'],
    [`<code>(int) 3.99</code> and <code>Math.round(3.5)</code>?`,[`4 and 4`,`3 and 3`,`4 and 3`,`3 and 4`],3,`Casting truncates toward zero; Math.round rounds half up.`,'M'],
    [`<code>0.1 + 0.2 == 0.3</code> with doubles?`,[`true: double math is exact for one-digit decimals`,`false: binary floating point can't represent these exactly`,`Compile error: doubles can't be compared with ==`,`It depends on the CPU's floating point unit`],1,`Compare with a tolerance or use BigDecimal for exact decimals.`,'M'],
    [`<code>Math.abs(Integer.MIN_VALUE)</code> returns?`,[`2147483648, the positive value`,`0, because the sign bit is cleared`,`Integer.MIN_VALUE (still negative)`,`ArithmeticException on overflow`],2,`+2147483648 doesn't fit in int, so it overflows back. Math.absExact throws instead.`,'H'],
  ],
});
