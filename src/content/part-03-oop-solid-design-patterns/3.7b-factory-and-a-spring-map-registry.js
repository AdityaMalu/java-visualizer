/* 3.7b Factory (and a Spring map registry) */
topic('3', { no:'3.7b', title:'Factory (and a Spring map registry)', idea:`The client asks for "UPI" and gets an interface back; it never names a concrete class. Then make it open/closed with Spring's map injection.`,
actors:'Objects', stateTitle:'Factory',
codes:{a:`interface PaymentStrategy { Receipt pay(long paise); }
class UpiPay  implements PaymentStrategy { /* ... */ }
class CardPay implements PaymentStrategy { /* ... */ }
class PaymentFactory {
  static PaymentStrategy of(String type) {
    return switch (type) {
      case "UPI"  -> new UpiPay();
      case "CARD" -> new CardPay();
      default -> throw new IllegalArgumentException(type);
    };
  }
}
PaymentStrategy p = PaymentFactory.of(req.type());  // client knows only the interface
p.pay(49_900);`,
b:`@Component("UPI")  class UpiPay  implements PaymentStrategy { /* ... */ }
@Component("CARD") class CardPay implements PaymentStrategy { /* ... */ }
@Service class PaymentFactory {
  private final Map<String, PaymentStrategy> byType;   // all beans, by name
  PaymentFactory(Map<String, PaymentStrategy> m) { this.byType = m; }
  PaymentStrategy of(String t) {
    return Optional.ofNullable(byType.get(t)).orElseThrow(() -> new Unsupported(t));
  }
}
// WALLET support = add one @Component("WALLET") class. Factory untouched.`},
steps:[
{cv:'a', hl:{client:[13],factory:[5,6,7]}, th:[['client','RUN','asks for "UPI"'],['factory','RUN:ok','decides the class']], g:[G('client sees',['type','PaymentStrategy (interface only)','ok'],['knows about UpiPay?','no','ok'])],
 say:`A <b>factory</b> hides <i>which</i> concrete class gets created. The client depends only on the <code>PaymentStrategy</code> interface, so adding or changing implementations doesn't touch callers.`},
{hl:{client:[14]}, th:[['client','RUN','p.pay(49900)'],['UpiPay','RUN:ok','polymorphic call']], log:['UPI collect request for ₹499.00'],
 say:`The client calls <code>pay</code> polymorphically. Factory + Strategy is the classic pairing: the factory <b>picks</b> the strategy, the strategy <b>does</b> the work.`},
{hl:{factory:[9]}, th:[['client','RUN','asks for "WALLET"'],['factory','RUN:bad','no case']], log:['✘ IllegalArgumentException: WALLET'],
 say:`The weakness: every new type means <b>editing</b> the switch, which violates open/closed (3.6). That's fine for 2–3 stable types, but it gets painful as the list grows.`},
{cv:'b', hl:{spring:[1,2,4,5]}, th:[['Spring','RUN:ok','injects Map<beanName, bean>']], g:[G('byType (injected)',['"UPI"','UpiPay bean'],['"CARD"','CardPay bean'])],
 say:`<b>Spring trick:</b> inject a <code>Map&lt;String, PaymentStrategy&gt;</code> and Spring fills it with <b>every</b> bean of that type, keyed by bean name. A <code>List&lt;PaymentStrategy&gt;</code> works the same way.`},
{hl:{spring:[10]}, th:[['Spring','RUN:ok','new bean registered']], g:[G('byType (injected)',['"UPI"','UpiPay bean'],['"CARD"','CardPay bean'],['"WALLET"','WalletPay bean','ok'],['factory edits','0','ok'])],
 say:`Adding a payment method is now <b>one new class</b>. The factory is closed for modification. (You can also let each strategy expose <code>type()</code> and build the map yourself, which avoids relying on bean names.)`},
{th:[], g:[G('Variants',['Simple factory','static method with a switch (above)'],['Factory method','subclass decides: abstract Notifier create()'],['Abstract factory','a FAMILY that fits together'],['Static factories in the JDK','List.of, Optional.of, Integer.valueOf (can cache!)']), G('Abstract factory example',['AwsFactory','AWS disk + network + VM'],['AzureFactory','Azure disk + network + VM'],['guarantees','you never mix AWS disk with Azure VM','ok'])],
 say:`Know the three flavours. <b>Abstract factory</b> creates a <b>family</b> of related objects (a cloud provider's disk, network and VM). Static factory methods also beat constructors because they have names, can return cached instances (<code>Integer.valueOf</code>), and can return subtypes.`}
],
keep:[`Factory hides the concrete class; client depends on the interface.`,`switch-factory violates OCP as types grow → Spring Map&lt;String, Bean&gt; registry.`,`Abstract factory = a family of matching objects.`]}, {
  imp: 'must',
  theory: TH(`A Factory hides which concrete class gets created, so callers only depend on an interface.`,
`<p>If code does <code>new StripeProcessor()</code> everywhere, switching providers means editing all of it. A <b>factory</b> centralises creation: callers ask <code>factory.forType("stripe")</code> and receive a <code>PaymentProcessor</code>. They don't know or care which class it is.</p>
<p>An <b>Abstract Factory</b> goes further: it creates a whole family of objects that must match, like a UI theme producing buttons and checkboxes that look alike.</p>`,
[[`Factory method`,`A method that returns an object of some interface type.`],[`Abstract factory`,`An object that creates a family of related objects.`],[`Registry`,`A map from keys to implementations, used to look up the right one.`]],
[`Define the product interface (PaymentProcessor).`,`Implement concrete products.`,`Give the factory one method that picks and returns the right implementation.`,`In Spring, inject <code>Map&lt;String, PaymentProcessor&gt;</code> to get every implementation keyed by bean name.`],
[`Static factory methods (<code>List.of</code>, <code>Integer.valueOf</code>) can cache instances and have meaningful names.`],
[`A factory switch that grows with every new type (that breaks open/closed); prefer a registry.`]),
  quiz: [
    [`Main benefit of a factory to client code?`,[`Objects are created faster than with new`,`Clients depend only on the interface type`,`It removes the need for interfaces`,`It guarantees one instance per type`],1,`The client can't accidentally depend on the concrete class.`,'E'],
    [`What does an Abstract Factory produce?`,[`One complex object, built up step by step`,`A cached instance for each key you ask for`,`Families of related objects that must match, e.g. one theme`,`Instances of abstract classes, via generated subclasses`],2,`Swapping the factory swaps the whole family consistently.`,'M'],
    [`Spring injects <code>Map&lt;String, PaymentProcessor&gt;</code>. What are the keys?`,[`Bean names, e.g. "stripeProcessor"`,`Fully qualified class names`,`The order beans were created in`,`Whatever each bean's getKey() returns`],0,`Spring builds the map from bean names. Name your beans deliberately when using a map registry.`,'H'],
    [`What does a factory method return?`,[`Always a new instance of one concrete class`,`An object typed as an interface or base class`,`A Class object for the caller to instantiate`,`A Supplier that builds the object lazily`],1,`Callers don't see the concrete type.`,'E'],
    [`<code>List.of(...)</code> is an example of?`,[`Builder`,`Static factory method`,`Adapter`,`Observer`],1,`It can return different hidden implementations.`,'E'],
    [`What smell suggests replacing a switch-factory with a registry?`,[`The switch has just two or three cases`,`Every new type means editing the switch`,`Its return type is an interface`,`The factory method is declared static`],1,`Open/closed.`,'M'],
    [`Abstract Factory vs Factory Method?`,[`Same pattern; Abstract Factory is just declared abstract`,`Abstract Factory makes related families; Factory Method one product`,`Factory Method makes related families; Abstract Factory one product`,`Abstract Factory is a Builder that hides construction steps`],1,`e.g. a UI kit per platform.`,'M'],
    [`In Spring, a FactoryBean is used to?`,[`Build complex objects; getObject() returns the actual bean`,`Replace @Bean methods in Java configuration classes`,`Inject all beans of one type as a List`,`Decide which profile's beans get registered`],0,`e.g. older SessionFactory setups.`,'H'],
  ],
  quizAdv: [
    [`A <code>PaymentFactory</code> switch grows with each provider. Spring-friendly fix?`,[`Inject a Map&lt;String, PaymentProcessor&gt;`,`Reflection on class names built from the type`,`An abstract method per provider`,`A static map filled in a static block`],0,`Adding a provider becomes adding a bean.`,'M'],
    [`One advantage of a static factory method over a constructor?`,[`Faster allocation than new`,`It's required for immutability`,`It can't be called reflectively`,`It can return a cached instance`],3,`Also: descriptive names (Integer.valueOf, List.of).`,'M'],
    [`Can a static factory cache and return the same instance?`,[`No: a factory must return a new instance`,`Yes, e.g. Integer.valueOf, Boolean.valueOf`,`Only for String, via the string pool`,`Only if the class is an enum singleton`],1,`Constructors always create a new object.`,'M'],
    [`What naming conventions do static factories use?`,[`new followed by the type name, e.g. newList`,`of, from, valueOf, getInstance, newInstance, create`,`get, set, is and has, like JavaBeans`,`make, build, construct and init`],1,`They describe what the factory does.`,'M'],
  ],
});
