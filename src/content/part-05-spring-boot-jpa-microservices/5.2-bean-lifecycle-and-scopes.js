/* 5.2 Bean lifecycle and scopes */
topic('5', { no:'5.2', title:'Bean lifecycle and scopes', idea:`Every lifecycle hook in order, including the moment the AOP proxy replaces your bean. Then the prototype-in-singleton trap.`,
actors:'Bean', stateTitle:'Lifecycle',
codes:{a:`@Service class PriceCache {
  private final PriceClient client;
  PriceCache(PriceClient c) { this.client = c; }       // 1. instantiate + inject
  @PostConstruct void warm() { client.loadAll(); }     // 3. init callback
  @Transactional public void refresh() { /* ... */ }   // → needs a proxy
  @PreDestroy void close() { client.shutdown(); }      // on shutdown
}`,
b:`@Component @Scope("prototype") class Cart { List<Item> items = new ArrayList<>(); }

@Service class CheckoutService {
  private final Cart cart;                             // ✘ injected ONCE
  CheckoutService(Cart cart) { this.cart = cart; }
}
@Service class CheckoutService2 {
  private final ObjectProvider<Cart> carts;            // ✔ fresh each time
  CheckoutService2(ObjectProvider<Cart> carts) { this.carts = carts; }
  void start() { Cart c = carts.getObject(); }
}`},
steps:[
{cv:'a', hl:{bean:[3]}, th:[['priceCache','creating:info','constructor']], g:[G('Lifecycle',['1. instantiate','constructor (+ constructor injection)','hot'],['2. populate','setter / field injection'],['3. Aware callbacks','BeanNameAware, ApplicationContextAware'],['4. BPP before-init','@PostConstruct handled here'],['5. init','InitializingBean.afterPropertiesSet, initMethod'],['6. BPP after-init','proxies created HERE'],['7. ready','stored in context'],['8. destroy','@PreDestroy on shutdown'])],
 say:`The constructor runs first, with dependencies resolved (5.1). Field and setter injection (if any) happen in step 2, which is why those fields are still null <i>inside</i> the constructor.`},
{hl:{bean:[4]}, th:[['priceCache','initialising:info','@PostConstruct warm()']], g:[G('Lifecycle',['1–3','done','ok'],['4. @PostConstruct','warm(): load prices','hot'])], log:['PriceCache: loaded 12,400 prices'],
 say:`<code>@PostConstruct</code> runs once all dependencies are set: good for warming caches or validating config. <b>Gotcha:</b> it runs on the <b>raw</b> object, before the proxy exists, so <code>@Transactional</code> methods called from it get <b>no transaction</b>. Use <code>ApplicationReadyEvent</code> for work that needs proxies.`},
{hl:{bean:[5]}, th:[['priceCache','raw object:dim','wrapped'],['priceCache$$Proxy','READY:ok','what everyone gets']], g:[G('Lifecycle',['6. BPP after-init','AOP auto-proxy creator sees @Transactional','hot'],['context stores','the PROXY, not your object','hot'])],
 say:`<b>BeanPostProcessors</b> can replace the bean. The AOP auto-proxy creator notices <code>@Transactional</code> (or @Async, @Cacheable, an aspect) and returns a <b>proxy</b> wrapping your object. Every other bean gets the proxy injected (3.7h, 5.3).`},
{hl:{bean:[6]}, th:[['priceCache$$Proxy','TERM:dim','context closing']], log:['@PreDestroy close(): client shut down'],
 say:`On graceful shutdown (SIGTERM, context close), <code>@PreDestroy</code> runs. Release pools and flush buffers here. <b>Prototype</b> beans never get @PreDestroy: the container hands them out and forgets them.`},
{th:[], g:[G('Scopes',['singleton (default)','one per container: must be stateless / thread-safe','hot'],['prototype','new instance per lookup / injection'],['request','one per HTTP request'],['session','one per HTTP session'],['application','one per ServletContext']), G('Singleton + mutable field',['private int counter;  counter++','race across request threads','bad'],['fix','no instance state; or Atomic / ConcurrentHashMap','ok'])],
 say:`One singleton serves <b>all request threads at once</b>, so a mutable instance field is shared state with races (4.4). Keep services stateless: per-request data goes in method parameters or locals.`},
{cv:'b', hl:{bean:[3,4,5]}, th:[['checkoutService','singleton:info','created once'],['cart#1','prototype:bad','injected once, shared forever']], g:[G('Requests',['user A adds item','cart#1 = [A1]'],['user B adds item','cart#1 = [A1, B1]  ✘ leaked across users','bad'])],
 say:`<b>Prototype into a singleton:</b> injection happens <b>once</b>, when the singleton is created, so every call uses the same "prototype" instance. In this example, users see each other's cart items.`},
{hl:{bean:[7,8,9,10]}, th:[['checkoutService2','singleton:ok',''],['cart#2','prototype:ok','per call'],['cart#3','prototype:ok','per call']], g:[G('Requests',['user A','cart#2','ok'],['user B','cart#3','ok'])],
 say:`Fix: inject an <code>ObjectProvider&lt;Cart&gt;</code> (or <code>Provider&lt;Cart&gt;</code>, or a <code>@Lookup</code> method) and ask for a fresh instance each time. For request-scoped beans injected into singletons, Spring uses a <b>scoped proxy</b> that looks up the current request's instance on every call.`}
],
keep:[`Instantiate → inject → Aware → @PostConstruct → BPP after (PROXY) → ready → @PreDestroy.`,`@PostConstruct runs on the raw bean: no @Transactional there.`,`Singletons must be stateless; prototype-in-singleton → ObjectProvider.`]}, {
  imp: 'must',
  theory: TH(`Every Spring bean goes through a lifecycle (created, wired, initialised, possibly proxied, used, destroyed), and its scope decides how many instances exist.`,
`<p>Spring doesn't just call <code>new</code>. It instantiates the bean, injects dependencies, calls initialisation callbacks (<code>@PostConstruct</code>), lets <b>BeanPostProcessors</b> wrap it (that's where proxies for @Transactional are created), and later calls <code>@PreDestroy</code> on shutdown.</p>
<p><b>Scope</b> decides sharing. The default <b>singleton</b> means one instance for the whole application, used by every thread, so it must not keep per-request data in fields. <b>prototype</b> means a new instance each time it's requested; <b>request</b> and <b>session</b> scopes give one per HTTP request or session.</p>`,
[[`@PostConstruct`,`Runs after injection, before the bean is used.`],[`@PreDestroy`,`Runs on context shutdown (singletons only).`],[`BeanPostProcessor`,`Hook that can modify or wrap beans; creates AOP proxies.`],[`Scope`,`singleton, prototype, request, session…`]],
[`Instantiate (constructor) → inject → Aware callbacks → @PostConstruct.`,`BeanPostProcessors run; the bean may be replaced by a proxy.`,`The bean is ready and shared (singleton).`,`On shutdown: @PreDestroy, then destroy.`],
[`Keep singletons stateless; put per-request data in method parameters.`,`Need a fresh prototype each call from a singleton? Inject <code>ObjectProvider&lt;T&gt;</code>.`,`Warm caches after startup with an ApplicationReadyEvent listener.`],
[`Calling @Transactional methods from @PostConstruct (the proxy doesn't exist yet).`,`Storing the current user in a singleton's field.`]),
  quiz: [
    [`A singleton service stores <code>private User currentUser</code> per request. What's wrong?`,[`Nothing: Spring isolates beans per request`,`It needs @Lazy so it's created per request`,`Every request thread shares it, so users clash`,`The field must be final to be safe`],2,`Keep singletons stateless; pass request data as parameters.`,'E'],
    [`A singleton needs a fresh prototype bean on every call. How?`,[`Inject ObjectProvider&lt;Proto&gt; and call getObject() each time`,`@Autowired Proto proto, since prototypes are recreated per use`,`Make the singleton a prototype too`,`Call new Proto() inside the method`],0,`A directly injected prototype is created once, when the singleton is built. new skips DI.`,'M'],
    [`Why can a <code>@Transactional</code> method called from <code>@PostConstruct</code> run without a transaction?`,[`Transactions stay disabled until startup completes`,`@PostConstruct methods are always treated as static`,`It does run in a transaction, as usual`,`It runs on the raw bean, before the proxy exists`],3,`Use ApplicationReadyEvent, or call through another bean.`,'H'],
    [`Default bean scope?`,[`prototype`,`singleton`,`request`,`session`],1,`One instance per context.`,'E'],
    [`What does prototype scope mean?`,[`One shared instance per HTTP request being handled`,`A new instance each time the bean is requested`,`One instance per thread, reused across requests`,`A template copy cloned from the singleton at startup`],1,`Spring doesn't manage its destruction.`,'E'],
    [`Where do proxies for @Transactional get created in the lifecycle?`,[`In the constructor via a generated subclass call`,`In a BeanPostProcessor after initialisation`,`At compile time by an annotation processor`,`At the first method call through lazy weaving`],1,`postProcessAfterInitialization.`,'M'],
    [`Order: constructor, dependency injection, @PostConstruct?`,[`Injection → constructor → @PostConstruct`,`Constructor → injection → @PostConstruct`,`Constructor → @PostConstruct → injection`,`@PostConstruct → constructor → injection`],1,`With constructor injection, the first two happen together.`,'M'],
    [`Where should per-request data live instead of a singleton field?`,[`A static field guarded by the singleton's monitor`,`Method parameters/locals or request-scoped beans`,`A volatile field on the singleton bean itself`,`An instance field marked transient on the singleton`],1,`Keep singletons stateless.`,'E'],
  ],
  quizAdv: [
    [`Is <code>@PreDestroy</code> called on prototype beans?`,[`Yes, when the context closes`,`No: Spring doesn't track them`,`Yes, after every use`,`Only if also singletons`],1,`The caller owns prototype instances.`,'H'],
    [`Why does injecting a request-scoped bean into a singleton work?`,[`The singleton is rebuilt per request`,`Request beans are really singletons`,`A scoped proxy finds the current one`,`It doesn't work at all`],2,`proxyMode / @RequestScope creates a proxy.`,'H'],
    [`What does <code>SmartInitializingSingleton</code> or <code>ApplicationReadyEvent</code> help with?`,[`Running cleanup before the context shuts down`,`Running work after all singletons (and proxies) are ready`,`Registering extra bean definitions before instantiation`,`Choosing scopes for beans before they're created`],1,`Safer than @PostConstruct for transactional work.`,'H'],
    [`Lazy initialisation (<code>spring.main.lazy-initialization=true</code>) trade-off?`,[`Lower memory use, but circular dependencies are no longer detected`,`Faster startup, but config errors appear at first use, not at startup`,`Faster startup, but @Autowired constructors stop being supported`,`Faster requests, because every bean becomes prototype-scoped`],1,`Often used in dev only.`,'H'],
  ],
});
