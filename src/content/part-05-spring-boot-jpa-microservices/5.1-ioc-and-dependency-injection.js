/* 5.1 IoC and dependency injection */
topic('5', { no:'5.1', title:'IoC and dependency injection', idea:`Watch the container scan, build the dependency graph, create beans in dependency order, resolve two candidates with @Qualifier, and fail on a constructor cycle.`,
actors:'Beans', stateTitle:'ApplicationContext', dgTitle:'Dependency graph',
vb:'0 0 520 220',
nodes:{ctl:{x:80,y:50,label:'OrderController',w:140}, svc:{x:270,y:50,label:'OrderService',w:130}, repo:{x:450,y:50,label:'JpaOrderRepo',w:120}, rz:{x:200,y:170,label:'razorpay',w:110}, pu:{x:360,y:170,label:'payu',w:90}},
edges:[['ctl','svc','needs'],['svc','repo','needs'],['svc','rz','PaymentGateway?','dash'],['svc','pu','','dash']],
codes:{a:`@Repository class JpaOrderRepo implements OrderRepo { /* ... */ }
@Service class OrderService {
  private final OrderRepo repo;
  private final PaymentGateway gateway;
  OrderService(OrderRepo repo, @Qualifier("razorpay") PaymentGateway gateway) {
    this.repo = repo; this.gateway = gateway;
  }
}
@RestController class OrderController {
  private final OrderService svc;
  OrderController(OrderService svc) { this.svc = svc; }
}
@Component("razorpay") class RazorpayGateway implements PaymentGateway {}
@Component("payu")     class PayUGateway     implements PaymentGateway {}`,
b:`@Service class A { A(B b) {} }
@Service class B { B(A a) {} }
// startup:
// BeanCurrentlyInCreationException: Requested bean is currently in creation:
//   Is there an unresolvable circular reference?  (A -> B -> A)`},
steps:[
{hl:{scan:[1,2,9,13,14]}, th:[['container','scanning:info','@ComponentScan from the main package']], d:{type:'graph',dim:['ctl','svc','repo','rz','pu']}, g:[G('BeanDefinitions (recipes, no objects yet)',C('found',['orderController','orderService','jpaOrderRepo','razorpay','payu']))],
 say:`<b>Inversion of control:</b> you don't call <code>new</code> on your dependencies; the container does. First it <b>scans</b> for <code>@Component</code> (and its specialisations @Service, @Repository, @Controller) and <code>@Bean</code> methods, and records a <b>BeanDefinition</b> for each: class, scope, constructor arguments. No objects exist yet.`},
{hl:{ctl:[11]}, th:[['container','creating:info','orderController'],['orderController','WAITING','needs OrderService']], d:{type:'graph',on:['ctl'],e:[['ctl','svc','needs','hot']]},
 say:`At refresh, singletons are created eagerly. To build the controller, the container looks at its <b>constructor</b>: it needs an <code>OrderService</code>, which doesn't exist yet, so it creates that first (recursively).`},
{hl:{svc:[5]}, th:[['orderService','WAITING','needs OrderRepo + PaymentGateway'],['jpaOrderRepo','RUN:ok','created (no deps)']], d:{type:'graph',on:['repo'],e:[['ctl','svc','needs','hot'],['svc','repo','needs','ok']]},
 say:`OrderService needs an <code>OrderRepo</code>: exactly one bean implements it (JpaOrderRepo), so it's created and injected. Injection is <b>by type</b>.`},
{th:[['orderService','WAITING','PaymentGateway: 2 candidates!']], d:{type:'graph',on:['svc'],bad:['rz','pu'],e:[['svc','repo','','ok'],['svc','rz','?','bad dash'],['svc','pu','?','bad dash']]}, g:[G('PaymentGateway candidates',C('beans',['razorpay','payu']),['without a tie-breaker','NoUniqueBeanDefinitionException','bad'])],
 say:`Two beans implement <code>PaymentGateway</code>. Without help, startup fails with <b>NoUniqueBeanDefinitionException</b>. Tie-breakers in order: <code>@Qualifier("name")</code> at the injection point, <code>@Primary</code> on one bean, or the parameter name matching a bean name (fragile).`},
{hl:{svc:[5,6]}, th:[['orderService','RUN:ok','created'],['razorpay','RUN:ok','injected']], d:{type:'graph',ok:['rz','svc'],dim:['pu'],e:[['svc','repo','','ok'],['svc','rz','@Qualifier','ok']]},
 say:`<code>@Qualifier("razorpay")</code> picks one. Need all of them? Inject <code>List&lt;PaymentGateway&gt;</code> or <code>Map&lt;String, PaymentGateway&gt;</code> (the factory trick from 3.7b).`},
{th:[['orderController','RUN:ok','created'],['orderService','RUN:ok',''],['jpaOrderRepo','RUN:ok','']], d:{type:'graph',ok:['ctl','svc','repo','rz'],dim:['pu'],e:[['ctl','svc','','ok'],['svc','repo','','ok'],['svc','rz','','ok']]}, g:[G('ApplicationContext (singletons)',C('ready',['orderController','orderService','jpaOrderRepo','razorpay','payu']))], log:['Started App in 2.3 seconds'],
 say:`Everything is wired and the app starts. <b>Constructor injection</b> is preferred: fields can be <code>final</code>, dependencies are explicit, a unit test can just call <code>new OrderService(fakeRepo, fakeGateway)</code>, and cycles fail fast at startup.`},
{cv:'b', hl:{A:[1],B:[2]}, th:[['a','WAITING:bad','creating A → needs B'],['b','WAITING:bad','creating B → needs A (in creation!)']], d:null, log:['✘ BeanCurrentlyInCreationException: A → B → A'],
 say:`<b>Circular constructor dependency:</b> A needs B, B needs A, so neither can be constructed first. Spring Boot 2.6+ refuses cycles even with field injection, by default. The real fix is design: extract the shared logic into a third bean, or have one side publish an event. <code>@Lazy</code> on one parameter (it injects a proxy) is a workaround, not a fix.`}
],
keep:[`Container scans → BeanDefinitions → creates singletons in dependency order, injecting by type.`,`2 candidates → @Qualifier / @Primary, or inject a List/Map of all.`,`Constructor injection: final, testable, cycles fail fast; fix cycles by redesign.`]}, {
  imp: 'must',
  theory: TH(`Instead of your classes creating their own collaborators, Spring creates them and hands them in: that's Inversion of Control, and the handing-in is Dependency Injection.`,
`<p>Without a framework, <code>OrderService</code> would do <code>new PaymentClient(new HttpClient(...))</code>, deciding and building everything it needs. That ties it to specific classes and makes testing hard.</p>
<p>With <b>Inversion of Control</b>, a container (Spring's ApplicationContext) is in charge of creating objects, called <b>beans</b>. Your class just declares what it needs in its constructor, and Spring <b>injects</b> matching beans. Like a hotel: you don't bring your own bed, you state what you need and the hotel provides it.</p>`,
[[`Bean`,`An object created and managed by Spring.`],[`ApplicationContext`,`Spring's container that holds all beans.`],[`@Component / @Service / @Repository`,`Mark a class to be discovered and created as a bean.`],[`@Bean`,`A method in a @Configuration class that creates a bean (for third-party classes).`],[`@Qualifier / @Primary`,`Choose between several beans of the same type.`]],
[`At startup Spring scans packages for annotated classes and reads @Bean methods.`,`It builds a definition for each bean and works out who depends on whom.`,`It creates beans in dependency order, passing dependencies into constructors.`,`Your code receives ready-to-use objects; in tests you pass fakes instead.`],
[`Use constructor injection with final fields (no @Autowired needed with one constructor).`,`Depend on interfaces so implementations can change.`,`Inject <code>List&lt;X&gt;</code> or <code>Map&lt;String, X&gt;</code> to get all implementations.`],
[`Field injection, which hides dependencies and needs reflection in tests.`,`Circular dependencies, a sign two classes should be redesigned.`]),
  quiz: [
    [`Two beans implement <code>PaymentGateway</code>, and a service injects one by type. What happens?`,[`Spring picks the first bean it found`,`NoUniqueBeanDefinitionException`,`Spring injects both behind a proxy`,`The alphabetically first bean wins`],1,`Or inject List&lt;PaymentGateway&gt; / Map&lt;String, PaymentGateway&gt; to get all of them.`,'E'],
    [`Why is constructor injection preferred over field injection?`,[`Final fields, easy tests, and cycles fail fast`,`It's faster at run time than field injection`,`Field injection can't inject interfaces`,`Only constructor-injected beans can be proxied`],0,`Required dependencies become explicit.`,'M'],
    [`ServiceA needs ServiceB and ServiceB needs ServiceA, both through constructors. Best fix?`,[`Switch both to field injection`,`Set allow-circular-references=true`,`Add @Lazy to both constructors`,`Extract the shared part into a third bean`],3,`The workarounds hide a design problem.`,'H'],
    [`What is Inversion of Control?`,[`Lower layers depend on higher layers instead of the other way round`,`The framework creates and wires objects instead of your code doing it`,`Objects look up their own dependencies through a static service locator`,`Interfaces are used everywhere so implementations swap at compile time`],1,`Dependency injection is how Spring does it.`,'E'],
    [`What is a Spring bean?`,[`A serializable class with getters, setters and a no-arg constructor`,`An object created and managed by the Spring container`,`A configuration entry declared in application.properties`,`A class file loaded by Spring's custom class loader`],1,`Declared via @Component or @Bean.`,'E'],
    [`With a single constructor, is <code>@Autowired</code> required on it?`,[`Yes: without it Spring can't inject anything`,`No: Spring uses it automatically`,`Only when the constructor is public`,`Only when parameters are interfaces`],1,`Since Spring 4.3.`,'M'],
    [`Use @Bean instead of @Component when?`,[`For beans that must be singletons, since @Component is prototype`,`For third-party classes you can't annotate, or custom construction`,`For classes that need constructor injection rather than fields`,`For beans that should be created lazily instead of at startup`],1,`@Bean methods live in @Configuration classes.`,'M'],
    [`What does @Primary do?`,[`Makes the bean initialise before all other beans`,`Marks the default bean when several match by type`,`Forces the bean to be a singleton in every context`,`Exposes the bean to child application contexts only`],1,`@Qualifier overrides it at an injection point.`,'E'],
  ],
  quizAdv: [
    [`Beans A (@Primary) and B. An injection point has <code>@Qualifier("b")</code>. Which is injected?`,[`B: the qualifier is explicit`,`A, because @Primary always wins`,`Ambiguous, so startup fails`,`Both, in a list`],0,`@Primary is only a default when nothing more specific is given.`,'M'],
    [`Order of beans in an injected <code>List&lt;PaymentGateway&gt;</code>?`,[`Alphabetical by bean name`,`Random each startup`,`Reverse registration order`,`@Order, else registration`],3,`Annotate with @Order when order matters.`,'H'],
    [`Injecting <code>Optional&lt;Foo&gt;</code> or <code>ObjectProvider&lt;Foo&gt;</code> is useful when?`,[`The dependency must be injected into a static field`,`The bean may not exist, or should be resolved lazily`,`The bean must be serialised across cluster nodes`,`Forcing the dependency to be created before the caller`],1,`Avoids startup failure for optional dependencies.`,'H'],
    [`Why is field injection hard to unit test?`,[`Mockito can't create mocks for classes with private injected fields`,`Tests need Spring or reflection to set them; fields can't be final`,`Field values are reset by Spring between each test method run`,`The JIT inlines injected fields, so mocks get ignored at runtime`],1,`Constructor injection lets plain new work.`,'M'],
  ],
});
