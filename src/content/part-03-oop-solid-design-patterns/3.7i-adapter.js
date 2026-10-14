/* 3.7i Adapter */
topic('3', { no:'3.7i', title:'Adapter', idea:`Your code speaks <code>PaymentGateway.charge</code>; the vendor SDK speaks <code>createCharge(Map)</code>. The adapter translates in both directions, including errors.`,
actors:'Call path', stateTitle:'Translation',
codes:{a:`interface PaymentGateway { Receipt charge(long paise, String token); }  // OUR interface
// vendor SDK we can't change:
class StripeClient { StripeCharge createCharge(Map<String, Object> params) { /*...*/ } }

class StripeAdapter implements PaymentGateway {
  private final StripeClient stripe;
  StripeAdapter(StripeClient s) { stripe = s; }
  public Receipt charge(long paise, String token) {
    try {
      StripeCharge ch = stripe.createCharge(Map.of(
          "amount", paise, "currency", "inr", "source", token));     // translate IN
      return new Receipt(ch.getId(), "succeeded".equals(ch.getStatus())); // translate OUT
    } catch (StripeException e) {
      throw new PaymentFailed(e.getCode(), e);                        // translate ERRORS
    }
  }
}
checkout.pay(new StripeAdapter(new StripeClient(key)));`},
steps:[
{hl:{you:[1],vendor:[3]}, th:[['Checkout','RUN','wants charge(paise, token)'],['StripeClient','RUN:warn','offers createCharge(Map)']], g:[G('mismatch',['method name','charge vs createCharge','bad'],['inputs','typed args vs Map<String,Object>','bad'],['outputs','Receipt vs StripeCharge','bad'],['errors','PaymentFailed vs StripeException','bad'])],
 say:`<b>Adapter</b> makes an existing class fit an interface it wasn't written for. You can't change the vendor SDK, and you don't want vendor types leaking all over your domain.`},
{hl:{adapter:[8,10,11]}, th:[['Checkout','RUN','charge(49900, "tok_x")'],['StripeAdapter','RUN:ok','translate IN'],['StripeClient','RUN:ok','createCharge(…)']], g:[G('translate IN',['amount','49900'],['currency','"inr" (we\'re INR-only)'],['source','"tok_x"'])],
 say:`The adapter implements <b>your</b> interface and holds the vendor object. It converts your call into the vendor's format.`},
{hl:{adapter:[12]}, th:[['StripeAdapter','RUN:ok','translate OUT']], g:[G('translate OUT',['ch.getId()','"ch_3Nx…" → receipt.id'],['status "succeeded"','→ receipt.success = true','ok'])], log:['Receipt(ch_3Nx…, success=true)'],
 say:`…and converts the vendor's response back into your domain type. Your checkout code never imports a Stripe class.`},
{hl:{adapter:[13,14]}, th:[['StripeClient','RUN:bad','card_declined'],['StripeAdapter','RUN:ok','translate ERROR']], log:['✘ PaymentFailed(card_declined)  → 402 to client'],
 say:`Don't forget errors: map vendor exceptions to your own, so upper layers handle one exception type whichever gateway is behind it.`},
{hl:{you:[18]}, th:[], g:[G('Payoff',['switch to Razorpay','write RazorpayAdapter; checkout untouched','ok'],['tests','fake PaymentGateway, no SDK','ok']), G('JDK adapters',['Arrays.asList','array → List'],['InputStreamReader','InputStream → Reader'],['Collections.enumeration','Collection → Enumeration']), G('Bigger version',['Anti-corruption layer (DDD)','a whole translation layer around a legacy/external system'])],
 say:`Adapter + Dependency Inversion (3.6) is how you keep third-party APIs at the edge of your system. Contrast: <b>Adapter</b> changes the interface, <b>Decorator</b> keeps it and adds behaviour, <b>Facade</b> simplifies a whole subsystem behind one interface.`}
],
keep:[`Adapter implements YOUR interface, wraps the vendor object, translates in/out/errors.`,`Keeps vendor types out of the domain; swap vendors by adding an adapter.`,`Adapter changes the interface; Decorator keeps it; Facade simplifies a subsystem.`]}, {
  imp: 'good',
  theory: TH(`An Adapter makes an existing class with the wrong interface usable where your code expects a different one, by translating calls.`,
`<p>Your code expects <code>PaymentGateway.charge(Money)</code>; the vendor's SDK offers <code>pay(int cents, String currency)</code> and throws its own exceptions. An <b>adapter</b> implements your interface, holds the SDK object, and translates arguments, results and errors in both directions. Like a travel plug adapter: neither the socket nor the device changes.</p>`,
[[`Target interface`,`The interface your code wants to use.`],[`Adaptee`,`The existing class with an incompatible interface.`],[`Anti-corruption layer`,`A boundary of adapters that keeps external models out of your domain.`]],
[`Define the interface your domain needs.`,`Implement it in an adapter class that wraps the vendor client.`,`Convert inputs, call the vendor, convert outputs, and map vendor exceptions to your own.`],
[`Switching vendors means writing a new adapter, with no domain changes.`,`Treat timeouts as "unknown outcome", not "failed", in payment adapters.`],
[`Letting vendor types and exceptions leak into business code.`]),
  quiz: [
    [`Your domain uses <code>PaymentGateway.charge(Money)</code>; the vendor SDK offers <code>pay(int cents, String ccy)</code>. Which pattern?`,[`Facade`,`Decorator`,`Adapter`,`Bridge`],2,`An adapter implements your interface, wraps the SDK and translates calls, results and errors.`,'E'],
    [`Why translate vendor exceptions inside the adapter?`,[`To keep vendor types out of the domain code`,`Because vendor exceptions are always checked`,`To avoid logging the same error twice`,`Because translating exceptions is faster`],0,`The domain should only see your own error types.`,'M'],
    [`Adapter vs Facade?`,[`Facade converts one interface; Adapter simplifies a subsystem`,`They're the same pattern under two names`,`Adapter is only used when wrapping legacy code`,`Adapter converts one interface; Facade simplifies a subsystem`],3,`Different intent and scope.`,'H'],
    [`What does an adapter change?`,[`The behaviour, adding features on top`,`The interface, so incompatible code fits`,`The access, controlling who may call it`,`The performance, by caching each call`],1,`Translate calls between two interfaces.`,'E'],
    [`<code>InputStreamReader</code> adapts?`,[`a character Reader to a byte InputStream`,`a byte InputStream to a character Reader`,`a File path to a buffered InputStream`,`a String to a stream of characters`],1,`Using a charset.`,'M'],
    [`Where should vendor SDK types appear in your code?`,[`Everywhere`,`Only inside the adapter`,`In controllers`,`In entities`],1,`Keep them at the boundary.`,'E'],
    [`Switching payment provider with adapters means?`,[`Rewriting each service that calls the provider`,`Writing a new adapter for the same interface`,`Changing the domain model to match the provider`,`Subclassing the old provider's client library`],1,`Domain code stays unchanged.`,'M'],
    [`Facade vs Adapter in one sentence?`,[`Same thing; both wrap one class to rename its methods`,`Facade simplifies a subsystem; Adapter converts one interface to another`,`Facade converts interfaces; Adapter simplifies a subsystem`,`Facade adds behaviour; Adapter controls access to an object`],1,`Different intents.`,'M'],
  ],
  quizAdv: [
    [`<code>Arrays.asList(array)</code> is an example of?`,[`Decorator`,`Proxy`,`Facade`,`Adapter`],3,`It lets an array be used through the List interface.`,'M'],
    [`Your adapter maps the vendor's TimeoutException to <code>PaymentResult.failed()</code>. Risk?`,[`None: a timeout is just a failure`,`The outcome is unknown; may double-charge`,`Only the stack trace gets lost`,`Only a small performance cost`],1,`Map it to UNKNOWN and reconcile with the provider.`,'H'],
    [`An adapter receives the vendor's amounts in cents as int. Your domain uses Money. Where do you convert?`,[`In the controllers, before calling services`,`Inside the adapter, both directions`,`In the database, via a column converter`,`In each domain service that uses it`],1,`All translation in one place.`,'M'],
    [`Ports and adapters (hexagonal architecture) means?`,[`Exposing each service on its own network port`,`Domain defines interfaces (ports); infrastructure implements them`,`Adapters wrap only the UI; the domain calls the DB directly`,`A deployment model running each adapter as a container`],1,`Keeps the core independent of frameworks.`,'H'],
  ],
});
