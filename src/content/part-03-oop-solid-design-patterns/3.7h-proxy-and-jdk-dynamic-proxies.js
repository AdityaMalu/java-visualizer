/* 3.7h Proxy (and JDK dynamic proxies) */
topic('3', { no:'3.7h', title:'Proxy (and JDK dynamic proxies)', idea:`A stand-in with the same interface decides whether and how to reach the real object: cache, lazy load, security, timing. This is how Spring's @Transactional works.`,
actors:'Call path', stateTitle:'Proxy state',
codes:{a:`interface CarService { Car get(long id); }
class RealCarService implements CarService {
  public Car get(long id) { return db.load(id); }        // 40 ms
}
class CachingProxy implements CarService {
  private final CarService real;
  private final Map<Long, Car> cache = new ConcurrentHashMap<>();
  CachingProxy(CarService real) { this.real = real; }
  public Car get(long id) { return cache.computeIfAbsent(id, real::get); }
}`,
b:`CarService timed = (CarService) Proxy.newProxyInstance(
    loader, new Class<?>[]{ CarService.class },
    (proxy, method, args) -> {                       // ONE handler, ALL methods
      long t = System.nanoTime();
      try { return method.invoke(real, args); }
      finally { log(method.getName() + " took " + (System.nanoTime() - t) / 1_000_000 + " ms"); }
    });
timed.get(7);`},
steps:[
{cv:'a', hl:{proxy:[9],real:[3]}, th:[['caller','RUN','get(7)'],['CachingProxy','RUN:warn','miss → forward'],['RealCarService','RUN:ok','db.load(7)']], g:[G('cache',['7','Car(7) stored','hot'])], log:['get(7) → 40 ms (DB)'],
 say:`The caller holds a <code>CarService</code>. It doesn't know it's talking to a <b>proxy</b>. On a miss, the proxy forwards to the real service and remembers the result.`},
{hl:{proxy:[9]}, th:[['caller','RUN','get(7)'],['CachingProxy','RUN:ok','hit'],['RealCarService','NEW:dim','not called']], log:['get(7) → 0.01 ms (cache)'],
 say:`Second call: served by the proxy, and the real object is never touched. The proxy <b>controls access</b> to the real object. Kinds: caching, <b>virtual/lazy</b> (Hibernate's lazy entities are proxies, 5.5), <b>protection</b> (an auth check), <b>remote</b> (a gRPC/Feign client stub looks local).`},
{cv:'b', logReset:true, hl:{proxy:[1,2,3,4,5,6],caller:[8]}, th:[['caller','RUN','timed.get(7)'],['$Proxy12','RUN:ok','InvocationHandler.invoke'],['RealCarService','RUN:ok','']], log:['get took 41 ms'],
 say:`Writing a proxy class per interface is tedious. A <b>JDK dynamic proxy</b> generates the class at run time, and <b>every</b> method call lands in one <code>InvocationHandler</code>. This is the core of AOP: write "timing", "transaction" or "retry" once and apply it to any interface.`},
{th:[['caller','RUN','orderService.place()'],['Spring proxy','RUN:ok','BEGIN tx → call → COMMIT'],['OrderService (real)','RUN:ok','your code']], g:[G('How Spring builds proxies',['bean implements an interface','JDK dynamic proxy (or CGLIB by default in Boot)'],['no interface','CGLIB subclass that overrides methods'],['therefore','final / private methods can\'t be intercepted','bad'],['and','this.method() bypasses the proxy (5.3)','bad'])],
 say:`Spring's <code>@Transactional</code>, <code>@Cacheable</code>, <code>@Async</code> and <code>@PreAuthorize</code> all work by wrapping your bean in a <b>proxy</b> created after the bean starts up (a BeanPostProcessor, 5.2). Knowing that it's a proxy explains the famous gotchas: self-invocation and private methods get no transaction.`},
{th:[], g:[G('Proxy vs Decorator',['structure','identical: same interface + wraps the real one'],['Proxy intent','control access (lazy, cache, auth, remote, tx)'],['Decorator intent','add features the client composes'],['who creates it','proxy: usually a framework; decorator: the client'])],
 say:`If asked "Proxy vs Decorator": same shape, different intent. A good one-liner: "a decorator adds responsibilities; a proxy controls access to the real subject, often transparently and created by a framework."`}
],
keep:[`Proxy: same interface, controls access (cache, lazy, auth, remote).`,`JDK dynamic proxy: one InvocationHandler for all methods → AOP.`,`Spring @Transactional = proxy → self-invocation and private/final methods bypass it.`]}, {
  imp: 'must',
  theory: TH(`A Proxy stands in for another object with the same interface and controls access to it: lazily, with caching, security, or by adding transactions.`,
`<p>A proxy looks exactly like the real object to callers, but intercepts calls. It might delay creating an expensive object until it's needed, check permissions, cache results, or call a remote server. Java can even generate proxies at run time (<b>dynamic proxies</b>) that send every method call to one handler, and that's how Spring adds <code>@Transactional</code>, <code>@Cacheable</code> and <code>@Async</code> behaviour to your beans.</p>`,
[[`Dynamic proxy`,`A class generated at run time that implements interfaces and routes calls to an InvocationHandler.`],[`CGLIB proxy`,`A generated subclass that overrides methods (for proxying classes).`],[`Self-invocation`,`A bean calling its own method via this, which skips the proxy.`]],
[`Spring creates your bean, then wraps it in a proxy if it has annotations needing interception.`,`Other beans get the proxy injected.`,`A call goes through the proxy: start transaction → call your method → commit/rollback.`,`Calls from inside the bean (<code>this.method()</code>) go straight to the object, skipping that logic.`],
[`To make an annotation apply on an internal call, move the method to another bean.`,`Proxies can't intercept private, final or static methods.`],
[`Expecting @Transactional to work on a private method or through this.save().`]),
  quiz: [
    [`A JDK dynamic proxy can proxy...`,[`Any class with a public constructor`,`Only interfaces; Spring uses CGLIB for classes`,`Only final classes`,`Only classes with a no-arg constructor`],1,`java.lang.reflect.Proxy implements interfaces at run time and routes every call to one InvocationHandler.`,'E'],
    [`<code>@Transactional save()</code> is called as <code>this.save()</code> from another method of the same bean. What happens?`,[`Ignored: the call bypasses the proxy`,`A transaction starts as usual`,`A nested transaction starts`,`Spring fails at startup`],0,`Spring AOP wraps the bean in a proxy; internal calls go straight to the target.`,'M'],
    [`Why can't Spring's CGLIB proxy intercept a <code>final</code> or <code>private</code> method?`,[`Spring deliberately skips final methods for performance`,`javac inlines final methods, so the proxy never sees the call`,`It can: @Transactional works fine on final methods`,`The proxy is a subclass, which can't override those methods`],3,`CGLIB proxies work by overriding. Final/private calls go straight to the target code.`,'H'],
    [`A proxy has...`,[`A different interface from the real object`,`The same interface as the real object`,`No methods`,`Only static methods`],1,`Callers can't tell the difference.`,'E'],
    [`A virtual (lazy) proxy is used to?`,[`Encrypt data before passing it to the real object`,`Delay creating an expensive object until it's needed`,`Log every call made to the real object`,`Cache results of the real object's method calls`],1,`Hibernate's lazy-loaded entities are proxies.`,'M'],
    [`What does a JDK dynamic proxy route every call to?`,[`A generated subclass of the target class`,`An InvocationHandler.invoke method`,`A MethodInterceptor.intercept method`,`The target's method via a MethodHandle`],1,`One handler for all methods.`,'M'],
    [`Why does Hibernate return proxies for lazy associations?`,[`To make entities safe to share across threads`,`To load the real data only when a method is first called`,`To make entities serializable for remote calls`,`To avoid generating SQL for the entity's class`],1,`Outside a session that load fails (LazyInitializationException).`,'M'],
    [`Spring <code>@Transactional</code> is implemented by?`,[`Bytecode javac injects around the annotated method`,`A proxy that starts/commits a transaction around the call`,`A servlet filter that wraps every HTTP request`,`A database trigger on the method's tables`],1,`Hence the self-invocation trap.`,'E'],
  ],
  quizAdv: [
    [`On a JDK dynamic proxy, calling equals, hashCode or toString?`,[`They go to java.lang.Object directly`,`They throw UnsupportedOperationException`,`They're routed to the InvocationHandler too`,`Only toString is routed`],2,`Those three Object methods are dispatched to the handler.`,'H'],
    [`Spring Boot's default proxy type for @Transactional beans?`,[`CGLIB class-based proxies`,`JDK interface proxies, always`,`AspectJ compile-time weaving`,`No proxies: bytecode rewriting`],0,`Boot 2+ defaults to class-based proxies, even when interfaces exist.`,'M'],
    [`How can you make an internal call go through the proxy if you must?`,[`Call it via this, which already is the proxy`,`Move it to another bean, or self-inject / use AopContext`,`Make the method private so the proxy sees it`,`Make the method static so it gets intercepted`],1,`Splitting the bean is preferred.`,'M'],
    [`<code>getClass()</code> on an injected @Transactional bean in Spring Boot shows?`,[`Your own class, since proxies are invisible`,`A CGLIB subclass, e.g. OrderService$$SpringCGLIB$$0`,`A JDK proxy class like jdk.proxy2.$Proxy42`,`The interface type the bean implements`],1,`It's a proxy.`,'H'],
  ],
});
