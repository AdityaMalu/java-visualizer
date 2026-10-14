/* 5.3 AOP proxies and self-invocation */
topic('5', { no:'5.3', title:'AOP proxies and self-invocation', idea:`Follow a call through the proxy's interceptor chain, then watch <code>this.audit()</code> bypass it, so REQUIRES_NEW silently does nothing.`,
actors:'Call path', stateTitle:'Transaction state',
codes:{a:`@Service class OrderService {
  @Transactional public void place(Order o) {
    repo.save(o);
    this.audit(o);                 // ✘ direct call: skips the proxy
  }
  @Transactional(propagation = REQUIRES_NEW)
  public void audit(Order o) { auditRepo.save(new Audit(o.id())); }
  @Transactional private void helper() {}   // ✘ private: never intercepted
}`,
b:`@Aspect @Component class Timing {
  @Around("@annotation(com.app.Timed)")              // pointcut
  Object time(ProceedingJoinPoint pjp) throws Throwable {   // advice
    long t = System.nanoTime();
    try { return pjp.proceed(); }                    // join point: the real call
    finally { log.info("{} took {} ms", pjp.getSignature(), (System.nanoTime() - t) / 1_000_000); }
  }
}`},
steps:[
{cv:'a', hl:{caller:[2]}, th:[['controller','RUN','svc.place(o)'],['OrderService$$Proxy','RUN:ok','TransactionInterceptor'],['OrderService (target)','READY','']], g:[G('Transaction',['status','BEGIN tx#1 (conn from pool)','hot'])],
 say:`The controller's <code>svc</code> field holds the <b>proxy</b>, not your object (5.2). The proxy runs its interceptor chain first. <code>TransactionInterceptor</code> starts transaction #1 and binds the connection to the thread (a ThreadLocal), then calls the target.`},
{hl:{target:[3]}, th:[['controller','WAITING',''],['OrderService$$Proxy','WAITING',''],['OrderService (target)','RUN:ok','repo.save → tx#1']], log:['INSERT INTO orders … (tx#1)'],
 say:`Inside the real object now. <code>repo.save</code> joins tx#1 (repositories find it through the thread-bound connection).`},
{hl:{target:[4,7]}, th:[['controller','WAITING',''],['OrderService$$Proxy','WAITING',''],['OrderService (target)','RUN:bad','this.audit() → plain Java call']], g:[G('Transaction',['status','still tx#1','bad'],['REQUIRES_NEW applied?','NO','bad'])], log:['INSERT INTO audit … (tx#1, not a new tx!)'],
 say:`<b>Self-invocation:</b> <code>this</code> is the raw target, not the proxy. The call never goes through an interceptor, so <code>audit</code>'s annotation is <b>ignored</b> and it runs inside tx#1. If <code>place</code> rolls back, the audit row rolls back with it, which is the opposite of what REQUIRES_NEW was for.`},
{th:[['controller','RUN','returns'],['OrderService$$Proxy','RUN:ok','COMMIT tx#1']], g:[G('Fixes',['move audit() to another bean (AuditService)','cleanest','ok'],['inject self lazily: @Lazy @Autowired OrderService self; self.audit()','works'],['TransactionTemplate (programmatic)','explicit','ok'],['AspectJ weaving','no proxies; heavy'])],
 say:`Fix: put <code>audit</code> in a <b>separate bean</b> so the call crosses a proxy. The same rule applies to <code>@Async</code>, <code>@Cacheable</code>, <code>@Retryable</code> and every proxy-based annotation.`},
{hl:{target:[8]}, th:[], g:[G('Methods proxies can\'t intercept',['private','not visible to the proxy / subclass','bad'],['final (CGLIB)','can\'t be overridden','bad'],['static','not per-instance','bad'],['called via this','bypasses the proxy','bad'])],
 say:`Annotating a <code>private</code> method with <code>@Transactional</code> does nothing, silently. Proxies only see <b>public calls coming from outside the bean</b> (Spring 6 also allows protected and package-private with CGLIB, but stay with public).`},
{cv:'b', hl:{aspect:[2,3,4,5,6]}, th:[['caller','RUN','svc.place()'],['Timing aspect','RUN:ok','@Around before'],['target','RUN:ok','pjp.proceed()']], log:['OrderService.place(..) took 42 ms'],
 say:`Writing your own aspect. Vocabulary: <b>aspect</b> = the module (Timing), <b>advice</b> = the code that runs (@Before, @AfterReturning, @AfterThrowing, @After, @Around), <b>pointcut</b> = which methods (an expression), <b>join point</b> = one actual method execution. <code>@Around</code> must call <code>proceed()</code> or the method never runs. Order multiple aspects with <code>@Order</code>.`}
],
keep:[`Callers hold the proxy; the interceptor chain runs before your method.`,`this.method() skips the proxy → annotations ignored. Split into another bean.`,`Private/final/static methods can't be intercepted. Aspect/advice/pointcut/join point.`]}, {
  imp: 'must',
  theory: TH(`AOP (aspect-oriented programming) adds cross-cutting behaviour (transactions, caching, security, logging) around your methods without changing them, using proxies.`,
`<p>Many concerns cut across every service: open a transaction, check permissions, log timing. Copying that code into every method is messy. With <b>AOP</b> you write it once as an <b>aspect</b> and say <i>where</i> it applies (a <b>pointcut</b>, e.g. "methods annotated @Transactional"). Spring then wraps matching beans in <b>proxies</b> that run the aspect's code (<b>advice</b>) before and after your method.</p>
<p>Because it's done by a proxy, it only applies to calls that <b>go through the proxy</b>, meaning calls from other beans.</p>`,
[[`Aspect`,`A module of cross-cutting behaviour.`],[`Advice`,`The code that runs: @Before, @After, @Around.`],[`Pointcut`,`Expression choosing which methods are affected.`],[`Join point`,`A point where advice can run (a method call in Spring AOP).`],[`Proxy`,`The wrapper object Spring injects in place of your bean.`]],
[`Spring sees a bean matches a pointcut.`,`It creates a proxy (CGLIB subclass by default in Boot) around the bean.`,`Other beans receive the proxy.`,`A call enters the proxy → interceptor chain (transaction, cache…) → your method → back out.`],
[`Use built-in aspects via annotations (@Transactional, @Cacheable, @Async, @PreAuthorize).`,`Write custom @Around aspects for timing, auditing, rate limiting.`],
[`Self-invocation (<code>this.method()</code>) bypasses the proxy and the annotation.`,`Annotations on private, final or static methods do nothing.`]),
  quiz: [
    [`<code>@Cacheable</code> on a <code>private</code> method. Effect?`,[`It works like on a public method`,`Compile error`,`Silently ignored`,`Spring fails at startup`],2,`Same for final and static methods.`,'E'],
    [`In AOP terms, what is a pointcut?`,[`An expression choosing where advice applies`,`The code that runs around the method call`,`The generated proxy class for the bean`,`The exception type that triggers advice`],0,`Aspect = advice (what) + pointcut (where).`,'M'],
    [`<code>placeOrder()</code> calls <code>this.audit()</code>, which is <code>@Async</code>. What happens?`,[`audit runs asynchronously`,`audit runs synchronously`,`It deadlocks`,`Startup fails`],1,`Self-invocation skips the proxy. Move audit() to another bean.`,'H'],
    [`What is "advice" in AOP?`,[`The expression that selects which methods to intercept`,`The code an aspect runs (before/after/around a method)`,`The proxy object Spring generates around a bean`,`The point in execution where an aspect may apply`],1,`Pointcut says where; advice says what.`,'E'],
    [`Which advice can skip or replace the target call?`,[`@Before`,`@After`,`@Around`,`@AfterReturning`],2,`It controls proceed().`,'M'],
    [`What's a join point in Spring AOP?`,[`Any field access on a Spring bean`,`A method execution on a Spring bean`,`A constructor call on any Java object`,`A pointcut expression combined with advice`],1,`Spring AOP only intercepts method calls.`,'M'],
    [`Why does AOP only apply to Spring beans?`,[`Aspects are compiled into beans by the Spring Boot plugin`,`Interception is done by proxies Spring creates around beans`,`Only beans are loaded by Spring's instrumenting class loader`,`Non-bean classes lack the metadata the pointcut parser needs`],1,`new MyService() isn't proxied.`,'E'],
    [`Which annotation enables custom @Aspect classes in Spring Boot?`,[`Nothing extra: auto-configured with spring-boot-starter-aop`,`@AspectScan on the main application class`,`@EnableAop plus an aop.xml file in META-INF`,`@EnableWeaving on a @Configuration class`],0,`Boot enables @EnableAspectJAutoProxy for you.`,'M'],
  ],
  quizAdv: [
    [`An <code>@Around</code> advice forgets to call <code>pjp.proceed()</code>. Effect?`,[`The target method never runs`,`The target runs after the advice`,`Spring calls proceed itself`,`Startup fails`],0,`Around advice decides whether, and how, to call the target.`,'M'],
    [`Retry and transaction advice on one method. Why does their order matter?`,[`It doesn't matter`,`Only for log output`,`Retry must be inner`,`Outer retry: fresh tx`],3,`Retry should wrap the transaction so each attempt starts clean.`,'H'],
    [`AspectJ weaving vs Spring AOP proxies?`,[`Proxies weave bytecode at load time, so they're faster than AspectJ`,`AspectJ weaves bytecode, so it catches self-calls and private methods`,`AspectJ needs interfaces, while proxies work on any concrete class`,`Both use proxies; AspectJ just has a richer pointcut language`],1,`Spring supports load-time weaving if needed.`,'H'],
    [`A custom @Audited annotation with an @Around aspect: how do you match it?`,[`within(com.shop.Audited)`,`@annotation(com.shop.Audited)`,`target(com.shop.Audited)`,`args(com.shop.Audited)`],1,`Pointcut on the annotation.`,'H'],
  ],
});
