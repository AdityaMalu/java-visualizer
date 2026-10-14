/* 4.12 ThreadLocal */
topic('4', { no:'4.12', title:'ThreadLocal', idea:`One variable, a separate value per thread. Pools reuse threads, so a missing <code>remove()</code> leaks data into the next request.`,
codes:{a:`static final ThreadLocal<String> TENANT = new ThreadLocal<>();

void handle(Request req) {
  TENANT.set(req.tenant());
  try {
    service.process();       // deep inside: TENANT.get()
  } finally {
    TENANT.remove();         // pool threads are reused!
  }
}`,
b:`void handle(Request req) {
  if (req.tenant() != null) TENANT.set(req.tenant());
  service.process();         // TENANT.get()
  // ✘ no remove()
}`},
steps:[
{cv:'a', hl:{'pool-1':[4],'pool-2':[4]}, th:[['pool-1','RUN','request from tenant A'],['pool-2','RUN','request from tenant B']], g:[G('pool-1 · Thread.threadLocals',['TENANT','"A"','hot']), G('pool-2 · Thread.threadLocals',['TENANT','"B"','hot'])],
 say:`Each <code>Thread</code> object has its own map, <code>threadLocals</code>. <code>TENANT.set("A")</code> writes into the <b>current thread's</b> map, with the ThreadLocal as the key. Same static field, two separate values.`},
{hl:{'pool-1':[6],'pool-2':[6]}, log:['pool-1: TENANT.get() → "A"','pool-2: TENANT.get() → "B"'],
 say:`Deep in the call stack, <code>TENANT.get()</code> returns that thread's own value, so you don't have to pass a tenant parameter through 10 layers. No locking needed, because nothing is shared. Uses: request/tenant context, trace ID (MDC), Spring's transaction and security context, per-thread <code>SimpleDateFormat</code>.`},
{hl:{'pool-1':[8],'pool-2':[8]}, th:[['pool-1','WAITING','back in pool, clean'],['pool-2','WAITING','back in pool, clean']], g:[G('pool-1 · Thread.threadLocals',['TENANT','(removed)','ok']), G('pool-2 · Thread.threadLocals',['TENANT','(removed)','ok'])],
 say:`<code>remove()</code> in <code>finally</code> clears the entry before the thread goes back to the pool. The thread lives on and gets reused for the next request.`},
{cv:'b', hl:{'pool-1':[2,3]}, logReset:true, th:[['pool-1','RUN','request A, no remove()'],['pool-2','WAITING','']], g:[G('pool-1 · Thread.threadLocals',['TENANT','"A"','hot']), G('pool-2 · Thread.threadLocals',['TENANT','—'])],
 say:`Now the buggy version: it sets only when a header is present, and <b>never removes</b>.`},
{hl:{'pool-1':[2,3]}, th:[['pool-1','RUN','next request: anonymous user'],['pool-2','WAITING','']], g:[G('pool-1 · Thread.threadLocals',['TENANT','"A" (left over!)','bad']), G('pool-2 · Thread.threadLocals',['TENANT','—'])], log:['✘ anonymous request reads TENANT = "A" → sees tenant A\'s data'],
 say:`The pool hands the <b>same thread</b> a request with no tenant. <code>get()</code> returns <b>"A"</b> from the previous request, a cross-tenant <b>data leak</b>. The leftover entry also keeps big values alive as long as the pool thread lives, a memory leak (and a classloader leak on app redeploys).`},
{cv:'a', logReset:true, th:[['http-1','RUN','TENANT = "A"'],['async-7','RUN','@Async / supplyAsync task']], g:[G('http-1 · threadLocals',['TENANT','"A"']), G('async-7 · threadLocals',['TENANT','null','bad'])], log:['async-7: TENANT.get() → null'],
 say:`ThreadLocal values <b>don't follow work to other threads</b>. Code running in <code>@Async</code>, <code>CompletableFuture.supplyAsync</code>, or a parallel stream sees null. Copy the value explicitly (a TaskDecorator, or capture it in the lambda). <code>InheritableThreadLocal</code> copies only when a thread is <i>created</i>, which doesn't help with pools. Java 21+ has <b>ScopedValue</b> as the safer alternative.`}
],
keep:[`Value is stored in the Thread's own map; the ThreadLocal is just the key.`,`Always <code>remove()</code> in finally when using thread pools.`,`Doesn't propagate to async/pool threads automatically.`]}, {
  imp: 'good',
  theory: TH(`ThreadLocal gives each thread its own private copy of a variable, which is handy for per-request context, and dangerous in thread pools if not cleaned up.`,
`<p>Sometimes many methods need the same contextual value (the current user, a transaction, a request id) and passing it as a parameter everywhere is clumsy. A <b>ThreadLocal</b> is like a locker with each thread's name on it: <code>set()</code> puts a value in your thread's locker, <code>get()</code> reads only yours.</p>
<p>The value is actually stored in a map inside the Thread object. In a thread pool, threads are reused for the next request, so a value you forget to remove is still there for the next user.</p>`,
[[`ThreadLocal&lt;T&gt;`,`A per-thread variable.`],[`remove()`,`Clears the value for the current thread.`],[`InheritableThreadLocal`,`Copied to child threads when they're created.`],[`MDC`,`Logging context (e.g. request id) built on ThreadLocal.`]],
[`At the start of a request: <code>CTX.set(value)</code>.`,`Anywhere in that thread: <code>CTX.get()</code>.`,`At the end, in finally: <code>CTX.remove()</code>.`,`Work handed to another thread (async, pools) doesn't see the value unless you pass it.`],
[`Spring Security's SecurityContext and @Transactional's current transaction use ThreadLocals.`,`For async work, copy context explicitly (TaskDecorator) or use Scoped Values (final since JDK 25).`],
[`Not calling remove() in pooled threads: data leaks between users, and memory leaks.`,`Expecting values to appear in CompletableFuture or @Async code.`]),
  quiz: [
    [`Where is a ThreadLocal's value stored?`,[`In a static map inside ThreadLocal, keyed by thread id`,`In the current Thread's own map, keyed by the ThreadLocal`,`On the thread's stack, in a hidden frame`,`In Metaspace, next to the ThreadLocal class`],1,`That's why each thread sees its own value.`,'E'],
    [`A web app sets a user id in a ThreadLocal per request on a thread pool and never calls remove(). Bug?`,[`None: Spring clears it when the request ends`,`ConcurrentModificationException on reuse`,`The next request on that thread sees the old id`,`OutOfMemoryError straight away`],2,`Pool threads live forever. Always remove() in finally.`,'M'],
    [`You set a ThreadLocal, then call <code>CompletableFuture.supplyAsync(...)</code>. Does the async code see the value?`,[`No: it runs on another thread`,`Yes: async tasks inherit ThreadLocals`,`Only on virtual threads`,`Yes, if the ThreadLocal is static`],0,`The same applies to @Async and MDC logging context.`,'H'],
    [`What does ThreadLocal give each thread?`,[`A shared value`,`Its own independent value`,`A lock`,`A stack`],1,`get/set act on the current thread's copy.`,'E'],
    [`Common legitimate uses of ThreadLocal?`,[`Shared counters updated by all request threads`,`Per-request context: user, transaction, logging MDC`,`Caches meant to be shared across all threads`,`Locks that coordinate several worker threads`],1,`Clean up afterwards.`,'E'],
    [`Why call remove() in a finally block?`,[`Values stay after the thread dies, leaking until the JVM exits`,`Pooled threads are reused; leftover values leak into later tasks and memory`,`Without it, other threads can read your stale per-thread value`,`The compiler requires ThreadLocals to be cleared before reuse`],1,`Classic production bug.`,'M'],
    [`<code>ThreadLocal.withInitial(() -&gt; new SimpleDateFormat(...))</code> does what?`,[`Shares one formatter instance across all threads`,`Gives each thread its own formatter, created on first get()`,`Creates a new formatter on every call to get()`,`Eagerly creates formatters for all threads up front`],1,`A fix for non-thread-safe objects (prefer DateTimeFormatter).`,'M'],
    [`Does <code>@Async</code> code see the caller's ThreadLocal values?`,[`Yes`,`No: it runs on another thread`,`Only static ThreadLocals`,`Only in tests`],1,`Propagate explicitly.`,'E'],
  ],
  quizAdv: [
    [`<code>InheritableThreadLocal</code> with a thread pool?`,[`Values propagate to every task`,`Copied once, so pool threads go stale`,`It throws inside thread pools`,`It behaves just like ThreadLocal`],1,`Pool threads are created once.`,'H'],
    [`MDC values are missing from <code>@Async</code> logs. Fix?`,[`Make the MDC map static`,`Wrap logging in synchronized`,`Copy MDC in a TaskDecorator`,`Use InheritableThreadLocal`],2,`Propagate context explicitly at the task boundary.`,'H'],
    [`With millions of virtual threads, why can heavy ThreadLocal use hurt?`,[`Virtual threads share one copy, so values clash`,`Each virtual thread gets its own copy, multiplying memory`,`ThreadLocal throws when used on a virtual thread`,`Values live on the carrier, leaking between tasks`],1,`Scoped values are designed for this.`,'H'],
    [`How does Spring keep the current transaction for a thread?`,[`A static field holding the current Connection`,`TransactionSynchronizationManager, built on ThreadLocals`,`A request-scoped bean stored in the session`,`A ConcurrentHashMap keyed by request ID`],1,`That's why @Transactional work must stay on one thread.`,'H'],
  ],
});
