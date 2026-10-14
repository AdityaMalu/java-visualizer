/* 2.11 Exceptions: try / catch / finally flow */
topic('2', { no:'2.11', title:'Exceptions: try / catch / finally flow', idea:`Trace the exact order of try, catch and finally, how return values are saved, how finally can swallow an exception, and suppressed exceptions in try-with-resources.`,
actors:'Control flow', stateTitle:'Exception state',
codes:{a:`int f() {
  try {
    System.out.println("try");
    throw new IllegalStateException("boom");
  } catch (IllegalStateException e) {
    System.out.println("catch");
    return 1;                      // value 1 saved...
  } finally {
    System.out.println("finally"); // ...finally runs before returning
  }
}`,
b:`int g() {
  try {
    throw new RuntimeException("lost!");
  } finally {
    return 2;            // ✘ swallows the exception, returns 2
  }
}
int h() {
  int x = 1;
  try { return x; }      // return VALUE 1 is captured now
  finally { x = 99; }    // changing x doesn't change it
}`,
c:`try (var in = new Res("in"); var out = new Res("out")) {
  throw new IOException("body failed");
}                         // closes out, then in (reverse order)
// out.close() ALSO throws -> attached as SUPPRESSED
catch (IOException e) {
  e.getSuppressed();      // [IOException: close failed: out]
  throw new UploadException("copy failed for " + f, e);  // keep cause
}`},
steps:[
{cv:'a', hl:{flow:[2,3]}, th:[['flow','in try:ok','']], g:[G('Hierarchy',['Throwable','root'],['Error','OOM, StackOverflow: don\'t catch'],['Exception (checked)','IOException, SQLException: catch or declare'],['RuntimeException (unchecked)','NPE, IllegalArgument, IllegalState: bugs / contract violations'])], log:['try'],
 say:`The hierarchy first. <b>Checked</b> exceptions must be caught or declared, which the compiler enforces. <b>Unchecked</b> exceptions (RuntimeException and Error) don't have to be. Modern Java code (and Spring) mostly uses unchecked exceptions and translates checked ones at the boundaries.`},
{hl:{flow:[4]}, th:[['flow','throwing:bad','stack unwinds to nearest matching catch']], g:[G('in flight',['IllegalStateException("boom")','stack trace captured at construction','bad'])],
 say:`<code>throw</code> stops normal flow. The JVM looks for the nearest enclosing <code>catch</code> whose type matches, using the method's exception table. Creating an exception captures a <b>stack trace</b> (<code>fillInStackTrace</code>), the expensive part, which is why exceptions shouldn't be used for normal control flow.`},
{hl:{flow:[5,6,7]}, th:[['flow','in catch:warn','return 1 pending']], g:[G('in flight',['exception','handled']), G('pending',['return value','1 (saved in a hidden local)','hot'])], log:['catch'],
 say:`Caught. <code>return 1</code> evaluates the value and <b>saves it</b>, but before the method actually returns, <code>finally</code> must run.`},
{hl:{flow:[8,9]}, th:[['flow','finally → returns 1:ok','']], log:['finally','f() = 1'],
 say:`<code>finally</code> always runs: after normal completion, after a caught exception, after an uncaught one, after return/break/continue. Only <code>System.exit</code>, a JVM crash, or an infinite loop/hang in try skips it. Order printed: try, catch, finally.`},
{cv:'b', logReset:true, hl:{flow:[3,5]}, th:[['flow','finally returns 2:bad','exception discarded']], g:[G('in flight',['RuntimeException("lost!")','discarded','bad'],['result','g() returns 2','bad'])], log:['g() = 2   (no exception, no log: the error vanished)'],
 say:`<b>Never return from finally.</b> A return (or a throw) in finally <b>replaces</b> whatever was in flight, so the exception silently disappears. Most linters flag it.`},
{hl:{flow:[9,10,11]}, th:[['flow','h() returns 1:ok','']], log:['h() = 1'],
 say:`<code>return x</code> captures the <b>value</b> (1) when it runs. Changing <code>x</code> in finally has no effect. (If x were a mutable object, finally could still mutate that object.)`},
{cv:'c', logReset:true, hl:{flow:[1,2]}, th:[['flow','body throws:bad','']], g:[G('resources (opened in order)',C('stack',['in','out'])), G('primary exception',['IOException','body failed','bad'])],
 say:`<b>try-with-resources</b>: anything <code>AutoCloseable</code> declared in the parentheses is closed automatically. The body throws first, and that becomes the <b>primary</b> exception.`},
{hl:{flow:[3,4]}, th:[['flow','closing out, then in:warn','reverse order']], g:[G('closing (reverse order)',['out.close()','throws "close failed: out"','bad'],['in.close()','ok','ok']), G('primary exception',['IOException','body failed'],['suppressed','[close failed: out]','hot'])],
 say:`Resources close in <b>reverse order</b> (out, then in), even after an exception. If <code>close()</code> also throws, that exception is attached to the primary one as <b>suppressed</b> instead of replacing it. The old manual try/finally pattern lost the original error here.`},
{hl:{flow:[5,6,7]}, th:[['flow','wrap & rethrow:ok','cause preserved']], g:[G('UploadException',['message','copy failed for a.txt'],['cause','IOException: body failed','ok'],['cause.suppressed','close failed: out','ok'])],
 say:`When translating, <b>always pass the cause</b> (<code>new X(msg, e)</code>) so the log shows "Caused by: …". Rules: catch the most specific type, never leave an empty <code>catch {}</code>, log <i>or</i> rethrow (not both, or you get duplicate logs). Spring's <code>@Transactional</code> rolls back only on <b>unchecked</b> exceptions by default (5.4).`}
],
keep:[`finally always runs (except System.exit / crash); a return value is captured before finally.`,`return/throw in finally swallows the in-flight exception.`,`try-with-resources: reverse close order, close errors become suppressed. Wrap with the cause.`]}, {
  imp: 'must',
  theory: TH(`Exceptions move control from where a problem happens to the code that can handle it; finally and try-with-resources make sure cleanup always runs.`,
`<p>When something goes wrong (a file is missing, input is invalid), the code that notices often can't decide what to do. It <b>throws</b> an exception, and Java unwinds the call stack until it finds a matching <b>catch</b>. A <b>finally</b> block runs whether or not an exception happened, which is ideal for cleanup.</p>
<p><b>Checked</b> exceptions (like IOException) must be declared or caught, so the compiler forces you to think about them. <b>Unchecked</b> ones (RuntimeException and its subclasses, like NullPointerException) usually mean a programming bug or an unrecoverable condition.</p>
<p><b>try-with-resources</b> (<code>try (var in = open()) { … }</code>) closes resources automatically, in reverse order, even if the body throws.</p>`,
[[`throw / throws`,`Raise an exception / declare that a method may raise it.`],[`Checked exception`,`Subclass of Exception (not RuntimeException); must be handled or declared.`],[`Unchecked exception`,`RuntimeException or Error; not enforced by the compiler.`],[`Suppressed exception`,`A close() failure attached to the main exception in try-with-resources.`],[`Cause`,`The original exception wrapped inside a new one.`]],
[`An exception is thrown; the rest of the try block is skipped.`,`Java looks for a catch matching the exception type, in this method and then up the call stack.`,`finally blocks run on the way out, whether it was caught or not.`,`If nothing catches it, the thread ends and the stack trace is printed.`],
[`Catch where you can actually handle it (retry, fallback, translate to an HTTP status), not everywhere.`,`When wrapping, keep the cause: <code>throw new ServiceException("msg", e)</code>.`,`Always use try-with-resources for streams, connections, locks you wrap.`],
[`Empty catch blocks that hide failures.`,`return or throw inside finally, which swallows the real exception.`,`Catching Exception (or Throwable) broadly and continuing as if nothing happened.`]),
  quiz: [
    [`<pre>int f() { int x = 1;
  try { return x; } finally { x = 2; } }</pre>What does f() return?`,[`2, because finally runs last and overwrites it`,`1, because the value is captured before finally`,`Compile error: finally can't modify x`,`0, the default value of an int`],1,`The value is saved when the return executes. Changing the local in finally doesn't change it.`,'M'],
    [`In try-with-resources, the body throws E1 and <code>close()</code> throws E2. What does the caller get?`,[`E2, since it was thrown last`,`E1; E2 is silently lost`,`A wrapper exception holding both`,`E1, with E2 attached via getSuppressed()`],3,`The primary exception wins; close() failures are suppressed. Resources close in reverse order.`,'M'],
    [`What happens to an exception thrown in <code>try</code> when <code>finally</code> contains <code>return</code>?`,[`It's discarded and the method returns normally`,`It still propagates after finally completes`,`It's added as a suppressed exception`,`The JVM wraps it in an Error`],0,`return (or throw) in finally discards the in-flight exception, hiding bugs. Never return from finally.`,'H'],
    [`Which is a checked exception?`,[`NullPointerException`,`IllegalArgumentException`,`IOException`,`ArithmeticException`],2,`Checked exceptions must be caught or declared.`,'E'],
    [`When does a <code>finally</code> block NOT run?`,[`When an exception is thrown in try`,`When the try block executes return`,`When System.exit is called (or the JVM crashes)`,`When break or continue leaves the try`],2,`Otherwise it always runs.`,'M'],
    [`Catch order: <code>catch (Exception e)</code> before <code>catch (IOException e)</code>?`,[`Fine: both catches compile and run`,`Compile error: the second catch is unreachable`,`Runtime error when an IOException is thrown`,`The IOException catch is used first anyway`],1,`Catch more specific types first.`,'M'],
    [`What does a multi-catch <code>catch (IOException | SQLException e)</code> do?`,[`Catches both types in one block`,`It catches only the first listed type`,`Compile error: catch takes one type`,`It catches every exception type`],0,`e is effectively final there.`,'E'],
    [`What must a resource in try-with-resources implement?`,[`Closeable only`,`AutoCloseable`,`Serializable`,`Runnable`],1,`Closeable extends AutoCloseable.`,'M'],
  ],
  quizAdv: [
    [`<pre>try { throw new RuntimeException("A"); }
finally { throw new RuntimeException("B"); }</pre>The caller sees?`,[`A, with B suppressed`,`A only`,`A and B chained as cause`,`B; A is lost entirely`],3,`Only try-with-resources adds suppressed exceptions.`,'H'],
    [`<code>catch (Exception e) { throw new ServiceException("failed"); }</code> What's lost?`,[`Nothing important; the message stays`,`The original stack trace and cause`,`Only the original exception's message`,`Only the original exception's type`],1,`Always chain: new ServiceException("failed", e).`,'M'],
    [`Should you catch <code>Error</code> (e.g. OutOfMemoryError) in business code?`,[`Yes, always catch it and continue`,`No: the JVM may be broken; fail and restart`,`Only inside unit tests`,`Only StackOverflowError should be caught`],1,`Errors aren't meant for normal recovery.`,'H'],
    [`Why prefer unchecked exceptions in many modern APIs (Spring, JPA)?`,[`Unchecked exceptions are faster to throw`,`Layers needn't declare them; handle centrally`,`Checked exceptions are deprecated`,`Unchecked exceptions can't be caught`],1,`Spring translates SQLExceptions into unchecked DataAccessExceptions.`,'M'],
  ],
});
