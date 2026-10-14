/* 0.5 Methods, recursion and the call stack */
topic('0', { no:'0.5', title:'Methods, recursion and the call stack', imp:'good', idea:`How a method call works: arguments in, a new stack frame, a return value out. Then follow <code>factorial(3)</code> as the stack grows and unwinds.`,
actors:'Thread', stateTitle:'Call stack (top = running now)',
codes:{a:`static int factorial(int n) {
  if (n <= 1) return 1;            // base case: stop here
  return n * factorial(n - 1);     // recursive case
}

static void greet(String name, int times) {   // parameters
  for (int i = 0; i < times; i++) System.out.println("Hi " + name);
}

public static void main(String[] args) {
  int r = factorial(3);            // 6
  greet("Ana", 2);
}`},
steps:[
{hl:{main:[6,7]}, th:[], g:[G('Anatomy',['static','no object needed to call it'],['void / int','return type (void = returns nothing)'],['greet','name'],['(String name, int times)','parameters'],['{ … }','body'])],
 say:`A <b>method</b> is a named block of code you can call with inputs (<b>parameters</b>) and that may give back a value (its <b>return type</b>, or <code>void</code>). Methods let you reuse logic and give it a name.`},
{hl:{main:[10,11]}, g:[G('main',['r','?','hot'])],
 say:`<code>main</code> calls <code>factorial(3)</code>. Each call gets its own <b>stack frame</b> holding its parameters and local variables. Frames pile up like a stack of plates: the top one is running.`},
{hl:{main:[1,3]}, g:[G('factorial(3)',['n','3'],['waiting for','factorial(2)','hot']), G('main',['r','?'])],
 say:`n = 3 isn't ≤ 1, so it needs <code>factorial(2)</code> first. This frame <b>pauses</b> in the middle of line 3, and a new frame is pushed on top.`},
{hl:{main:[1,3]}, g:[G('factorial(2)',['n','2'],['waiting for','factorial(1)','hot']), G('factorial(3)',['n','3'],['waiting for','factorial(2)']), G('main',['r','?'])],
 say:`Same again: <code>factorial(2)</code> calls <code>factorial(1)</code>. Three frames for the same method, each with its <b>own</b> <code>n</code>. That's why recursion works.`},
{hl:{main:[2]}, g:[G('factorial(1)',['n','1'],['returns','1','ok']), G('factorial(2)',['n','2']), G('factorial(3)',['n','3']), G('main',['r','?'])],
 say:`The <b>base case</b>: n = 1 returns 1 without another call. Without a base case, frames would pile up until <code>StackOverflowError</code>.`},
{hl:{main:[3]}, g:[G('factorial(2)',['n * result','2 × 1 = 2','ok']), G('factorial(3)',['n','3']), G('main',['r','?'])],
 say:`The stack <b>unwinds</b>. The top frame is popped, and <code>factorial(2)</code> resumes exactly where it paused, computing 2 × 1 = 2 and returning it.`},
{hl:{main:[3,10]}, g:[G('factorial(3)',['n * result','3 × 2 = 6','ok']), G('main',['r','6','ok'])],
 say:`<code>factorial(3)</code> resumes: 3 × 2 = 6, returned to main. All the factorial frames are gone, and so are their variables.`},
{hl:{main:[11,6,7]}, g:[G('greet("Ana", 2)',['name','"Ana"'],['times','2'],['i','0 → 1']), G('main',['r','6'])], log:['Hi Ana','Hi Ana'],
 say:`Arguments are matched to parameters by position. Java copies each argument's value into the parameter (always pass-by-value, see 1.6). Several methods may share a name with different parameter lists: that's <b>overloading</b> (3.2).`}
],
keep:[`Each call gets its own stack frame with its own parameters and locals; return pops it.`,`Recursion = a method calling itself; always needs a base case or you get StackOverflowError.`,`Arguments are copied into parameters (pass-by-value).`]}, {
  imp: 'good',
  theory: TH(`A method is a named, reusable block of code with inputs (parameters) and an optional output (return value); each call gets its own stack frame.`,
`<p>Methods let you split a program into small named steps: <code>calculateTax(order)</code> reads better than 30 lines of arithmetic. You define parameters (inputs) and a return type (output, or <code>void</code> for none).</p>
<p>When a method is called, Java creates a <b>stack frame</b> for it on the thread's call stack, holding its parameters and local variables. When it returns, the frame is removed. <b>Recursion</b> is a method calling itself to solve a smaller version of the same problem; it needs a <b>base case</b> that stops the chain.</p>`,
[[`Parameter / argument`,`The variable in the definition / the value passed in the call.`],[`Return type`,`The type of value the method gives back (void = nothing).`],[`Stack frame`,`Memory for one call: parameters and locals.`],[`Recursion`,`A method calling itself.`],[`Base case`,`The condition where recursion stops.`]],
[`The caller evaluates the arguments.`,`A new frame is pushed; argument values are copied into parameters.`,`The body runs; return sends a value back and pops the frame.`,`The caller continues from where it paused.`],
[`Keep methods short and named after what they do.`,`Prefer iteration for deep recursion in Java (no tail-call optimisation).`,`Many coding-interview problems (trees, backtracking) are naturally recursive.`],
[`Recursion without a correct base case → StackOverflowError.`,`Expecting a method to change the caller's variables by reassigning parameters.`]),
  quiz: [
    [`What does a method with return type <code>void</code> return?`,[`null`,`0`,`Nothing`,`An empty Optional`],2,`void means it returns no value.`,'E'],
    [`A recursive method has no base case. What happens?`,[`It returns 0`,`StackOverflowError`,`OutOfMemoryError: heap`,`The JIT turns it into a loop`],1,`Each call adds a frame until the thread's stack is full.`,'M'],
    [`<code>factorial(3)</code> calls itself down to factorial(1). How many factorial frames exist at the deepest point?`,[`1`,`2`,`4`,`3`],3,`factorial(3), (2) and (1) are all on the stack at once.`,'M'],
    [`Which keyword sends a value back from a method?`,[`yield`,`break`,`return`,`send`],2,`return value; ends the method and passes the value back.`,'E'],
    [`Two methods: <code>sum(int, int)</code> and <code>sum(int, int, int)</code>. What is this called?`,[`Overriding`,`Overloading`,`Recursion`,`Hiding`],1,`Same name, different parameter lists.`,'E'],
    [`A local variable declared inside a method is visible where?`,[`In the whole class`,`Only inside that method (its block)`,`In every method called from it`,`Everywhere`],1,`Locals live in the method's stack frame.`,'E'],
    [`What does this return: <code>int sumTo(int n) { return n == 0 ? 0 : n + sumTo(n - 1); }</code> for n = 4?`,[`4`,`10`,`24`,`StackOverflowError`],1,`4 + 3 + 2 + 1 + 0.`,'M'],
    [`A <code>void</code> method has <code>return;</code> in the middle. What happens?`,[`Compile error`,`It returns null`,`It ends the method early`,`It's ignored`],2,`return; exits a void method.`,'M'],
  ],
  quizAdv: [
    [`<code>void inc(int x) { x++; }</code> called as <code>inc(n)</code> with n = 5. What is n afterwards?`,[`6`,`0`,`Compile error`,`5`],3,`The value is copied into x; changing x doesn't touch n.`,'M'],
    [`Why does Java prefer loops over very deep recursion?`,[`Recursion isn't allowed in production Java code`,`No tail-call optimisation: each call uses a stack frame`,`Loops are always clearer than recursive code`,`Deep recursion switches off the JIT compiler`],1,`Deep recursion (e.g. 100,000 levels) can overflow the default stack.`,'H'],
    [`What is varargs: <code>int max(int... nums)</code>?`,[`A method whose return value is optional`,`A method accepting any number of ints, received as an array`,`A generic method that takes any type T`,`A method that calls itself a variable number of times`],1,`Callers write max(1, 5, 3); inside, nums is an int[].`,'M'],
    [`Method A calls B, B calls C. C throws an exception nobody catches. Which frames are removed?`,[`Only C's frame; B and A keep running normally`,`None: the JVM retries C's frame automatically`,`C's, B's and A's, unwinding until a catch or the thread ends`,`Only A's frame, since it started the chain`],2,`The exception propagates up the call stack.`,'H'],
  ],
});
