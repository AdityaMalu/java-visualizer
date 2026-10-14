/* 3.7d Strategy */
topic('3', { no:'3.7d', title:'Strategy', idea:`Swap the pricing algorithm at run time without touching Checkout. A lambda is a strategy too.`,
actors:'Objects', stateTitle:'Checkout',
codes:{a:`interface PricingStrategy { long price(Car c); }
class Standard implements PricingStrategy { public long price(Car c) { return c.base(); } }
class Festive  implements PricingStrategy { public long price(Car c) { return c.base() * 90 / 100; } }
class Checkout {
  private PricingStrategy pricing;
  Checkout(PricingStrategy p) { pricing = p; }
  void setPricing(PricingStrategy p) { pricing = p; }   // swap at run time
  long total(Car c) { return pricing.price(c); }
}
Checkout co = new Checkout(new Standard());
co.total(car);                  // 500000
co.setPricing(new Festive());
co.total(car);                  // 450000
co.setPricing(c -> c.base() - 10_000);   // a lambda is a strategy`},
steps:[
{hl:{co:[10,11],S:[2]}, th:[['co','pricing = Standard:ok','']], g:[G('Checkout',['pricing →','Standard'],['total(₹5,00,000 car)','500000'])], log:['500000'],
 say:`<b>Strategy</b> = a family of interchangeable algorithms behind one interface. <code>Checkout</code> <b>has a</b> PricingStrategy and delegates to it. It doesn't know or care which one.`},
{hl:{co:[12,13],F:[3]}, th:[['co','pricing = Festive:ok','swapped at run time']], g:[G('Checkout',['pricing →','Festive','hot'],['total','450000','hot'])], log:['450000'],
 say:`Swap the strategy and the behaviour changes. Checkout's code didn't change. Compare that with <code>if (festive) … else if (clearance) …</code> growing inside Checkout.`},
{hl:{co:[14]}, th:[['co','pricing = lambda:ok','']], g:[G('Checkout',['pricing →','lambda (c -> c.base() - 10000)','hot'])], log:['490000'],
 say:`Since <code>PricingStrategy</code> has one method, it's a functional interface, so a <b>lambda is a strategy</b>. <code>Comparator</code> is the JDK's most famous strategy (2.7).`},
{th:[], g:[G('Strategy vs State (same shape)',['who switches?','Strategy: the CALLER / config picks'],['','State: the object switches ITSELF on events (3.7e)']), G('Choosing a strategy',['by request','Factory / Spring map (3.7b)'],['by config','@ConditionalOnProperty bean'],['by feature flag','resolve per request'])],
 say:`Strategy and State look identical in a class diagram. The difference is <b>who changes the delegate</b>: an outside caller (Strategy) or the object reacting to its own transitions (State).`}
],
keep:[`Strategy: interchangeable algorithms behind one interface; context delegates.`,`Swap at run time; any functional interface + lambda is a strategy.`,`Strategy = caller picks; State = object switches itself.`]}, {
  imp: 'must',
  theory: TH(`Strategy puts interchangeable algorithms behind one interface, so you can choose or swap them at run time.`,
`<p>Pricing might be "regular", "festival discount" or "surge". Instead of an if/else inside the pricing service, each rule becomes its own class implementing <code>PricingStrategy</code>. The service just calls <code>strategy.price(order)</code> on whichever strategy it was given.</p>
<p>Any functional interface is a strategy slot: the <code>Comparator</code> you pass to <code>sort</code> is a strategy, and a lambda is the lightest way to write one.</p>`,
[[`Strategy`,`An interface for an algorithm, with several implementations.`],[`Context`,`The class that uses a strategy without knowing which one.`]],
[`Define the strategy interface.`,`Write one implementation per algorithm.`,`The context receives a strategy (constructor, parameter, or lookup map) and delegates to it.`],
[`Spring: inject all strategy beans as a Map and pick by key, e.g. per country or customer tier.`,`Keep strategies stateless so a single bean can serve every thread.`],
[`Mutable fields in a strategy bean shared by all requests.`,`Confusing with State: in Strategy the caller chooses; in State the object switches itself.`]),
  quiz: [
    [`Pricing must switch between "regular", "festival" and "surge" at run time. Which pattern?`,[`Strategy: a PricingStrategy interface, passed in`,`Template method: subclasses override a pricing step`,`State: the price object swaps its own behaviour`,`Decorator: prices are wrapped in discount layers`],0,`The context delegates to whichever strategy it holds; the caller picks it.`,'E'],
    [`Strategy vs State, in one line?`,[`Strategy: the object switches itself; State: the caller picks`,`State needs an enum, while Strategy needs an interface`,`They're the same pattern, just with different names`,`Strategy: the caller picks; State: the object switches itself`],3,`Same structure, different intent.`,'M'],
    [`Strategies are singleton Spring beans looked up from a map, and one keeps a mutable field <code>lastPrice</code>. Risk?`,[`Map lookups from many threads aren't thread-safe`,`None: each request gets its own strategy instance`,`Strategies are shared singletons, so lastPrice races`,`Strategies are garbage-collected between requests`],2,`Singleton beans must be stateless. Keep per-request data in parameters or locals.`,'H'],
    [`Strategy replaces which code smell?`,[`Long parameter lists in constructors`,`if/else or switch choosing between algorithms`,`Duplicated getters and setters across classes`,`Static mutable state shared across threads`],1,`Each branch becomes a class.`,'E'],
    [`Is a Comparator passed to sort a strategy?`,[`Yes`,`No`,`Only if anonymous`,`Only for Strings`],0,`The sorting algorithm delegates comparison.`,'E'],
    [`Who usually chooses the strategy?`,[`The strategy itself`,`The caller or configuration`,`The JVM`,`The garbage collector`],1,`In State, the object switches itself.`,'M'],
    [`How can Spring pick a strategy per request?`,[`Use @Primary to switch the bean on each request`,`Inject Map&lt;String, Strategy&gt; and look up by key`,`Store the chosen strategy in a static field`,`Use @Qualifier, which is resolved per request`],1,`Bean names are the keys.`,'M'],
    [`What's the risk of strategies with mutable fields as singletons?`,[`Each thread gets a copy, wasting memory`,`Shared by all threads → race conditions`,`Spring refuses to create mutable singletons`,`Fields reset to defaults after each call`],1,`Keep strategies stateless.`,'M'],
  ],
  quizAdv: [
    [`The lightest-weight strategy in modern Java?`,[`A lambda for a functional interface`,`An abstract class per algorithm`,`A static method plus a switch`,`A reflective method call`],0,`Comparator, Function, Supplier: any functional interface is a strategy slot.`,'M'],
    [`<code>enum Fee { WEEKEND { long apply(…) {…} }, … ; abstract long apply(…); }</code> is?`,[`Illegal: enums can't have abstract methods`,`The State pattern`,`A strategy per constant (constant-specific bodies)`,`Template method`],2,`A compact, closed set of strategies.`,'H'],
    [`Strategy vs Template Method for varying one step?`,[`Same thing; both rely on inheritance`,`Strategy composes, swappable at run time; Template subclasses`,`Template swaps at run time; Strategy is fixed per subclass`,`Strategy requires abstract classes; Template uses interfaces`],1,`Prefer composition when the variation changes at run time.`,'M'],
    [`Enum with a constant-specific method per constant is?`,[`Invalid`,`A compact strategy set`,`A singleton only`,`An adapter`],1,`e.g. Operation.PLUS.apply(a, b).`,'H'],
  ],
});
