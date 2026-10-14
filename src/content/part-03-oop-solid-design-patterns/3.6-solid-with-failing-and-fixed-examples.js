/* 3.6 SOLID, with failing and fixed examples */
topic('3', { no:'3.6', title:'SOLID, with failing and fixed examples', idea:`Each principle with a concrete step: what breaks, why, and the shape of the fix. The Liskov example is traced line by line.`,
actors:'Principle', stateTitle:'Design',
codes:{a:`interface FeeRule { long apply(Booking b); }
class WeekendFee implements FeeRule {
  public long apply(Booking b) { return b.isWeekend() ? 500 : 0; }
}
class CityFee implements FeeRule {
  public long apply(Booking b) { return b.city().equals("Mumbai") ? 300 : 0; }
}
class FeeCalculator {                         // closed for modification
  private final List<FeeRule> rules;          // open for extension
  FeeCalculator(List<FeeRule> rules) { this.rules = rules; }
  long total(Booking b) { return rules.stream().mapToLong(r -> r.apply(b)).sum(); }
}
// new requirement: festive surcharge -> add class FestiveFee, nothing else changes`,
b:`class Rectangle {
  protected int w, h;
  void setWidth(int w)  { this.w = w; }
  void setHeight(int h) { this.h = h; }
  int area() { return w * h; }
}
class Square extends Rectangle {
  void setWidth(int w)  { this.w = w; this.h = w; }   // keep it square
  void setHeight(int h) { this.w = h; this.h = h; }
}
void resize(Rectangle r) { r.setWidth(5); r.setHeight(4); assert r.area() == 20; }
resize(new Square());   // area 16 ✘`,
c:`interface PaymentGateway { Receipt charge(long paise); }   // small (ISP)
class CheckoutService {
  private final PaymentGateway gateway;                   // abstraction (DIP)
  CheckoutService(PaymentGateway g) { this.gateway = g; } // injected
  Receipt checkout(Cart c) { return gateway.charge(c.total()); }
}
// prod: Spring injects RazorpayGateway
// test: new CheckoutService(paise -> new Receipt("t1", true))`},
steps:[
{cv:'a', th:[['S','Single responsibility:info','one reason to change']], g:[G('✘ InvoiceService',['calculate()','changes when tax rules change','bad'],['save()','changes when the DB changes','bad'],['email()','changes when the email provider changes','bad']), G('✔ split',['InvoiceCalculator','tax team'],['InvoiceRepository','DB'],['InvoiceMailer','notifications'])],
 say:`<b>S: a class should have one reason to change</b>, meaning one actor or stakeholder whose requests change it. Three unrelated reasons in one class means unrelated changes collide and tests need everything mocked.`},
{hl:{O:[1,2,3,4,5,6,7,8,9,10,11]}, th:[['O','Open/closed:info','extend without editing']], g:[G('FeeCalculator.total(booking)',C('rules',['WeekendFee → 500','CityFee → 300']),['total','800','ok'])],
 say:`<b>O: open for extension, closed for modification.</b> The calculator loops over <code>FeeRule</code>s. It has no <code>if (weekend) … else if (city)</code> chain that every new rule would have to edit.`},
{hl:{O:[13]}, th:[['O','new rule:ok','add a class']], g:[G('FeeCalculator.total(booking)',C('rules',['WeekendFee → 500','CityFee → 300',['FestiveFee → 200','ok']]),['total','1000','ok'],['edited classes','0','ok'])],
 say:`A new requirement means a <b>new class</b> (registered as a Spring bean, so it's injected into the list automatically). The tested code is untouched. This is Strategy plus a list (3.7d). Don't overdo it, though: apply OCP where change actually happens.`},
{cv:'b', hl:{L:[11,3]}, th:[['L','Liskov:info','resize(new Square())']], g:[G('Square r',['w','5','hot'],['h','5 (setWidth also set h)','hot'])],
 say:`<b>L: subtypes must be usable anywhere the base type is</b>, without surprising the caller. <code>resize</code> was written against Rectangle's contract: "setWidth changes only the width". Square's setWidth also changes the height…`},
{hl:{L:[11,9]}, g:[G('Square r',['w','4','hot'],['h','4','hot'])],
 say:`…and setHeight(4) changes the width back to 4.`},
{hl:{L:[11,5,12]}, th:[['L','violated:bad','area 16 ≠ 20']], g:[G('Square r',['area()','16','bad'],['caller expected','20','bad'])], log:['✘ AssertionError: expected 20, got 16'],
 say:`The caller's assumption breaks: <b>a Square is not a behavioural Rectangle</b>, even though it "is a" rectangle in maths. Fixes: don't relate them (both implement <code>Shape</code> with <code>area()</code>), or make them immutable (no setters, so nothing to violate). Real-world LSP smells: overrides that throw <code>UnsupportedOperationException</code>, or that strengthen preconditions.`},
{cv:'c', hl:{I:[1]}, th:[['I','Interface segregation:info','small interfaces']], g:[G('✘ fat interface',['Vehicle { drive(); fly(); openSunroof(); }',''],['Bike','forced to implement fly() → throws','bad']), G('✔ role interfaces',['Drivable','drive()'],['Flyable','fly()'],['HasSunroof','openSunroof()'])],
 say:`<b>I: clients shouldn't depend on methods they don't use.</b> Fat interfaces force dummy implementations (an LSP violation in waiting) and tie unrelated clients together. Prefer small role interfaces. <code>PaymentGateway</code> has one method, so it's trivially fakeable.`},
{hl:{D:[2,3,4,5,7,8]}, th:[['D','Dependency inversion:ok','depend on abstractions']], g:[G('✘ hard-wired',['new RazorpayClient() inside CheckoutService','can\'t test without the network','bad']), G('✔ inverted',['CheckoutService → «PaymentGateway»','policy depends on abstraction','ok'],['RazorpayGateway → «PaymentGateway»','detail depends on abstraction','ok'],['test','a lambda fake, no Spring needed','ok'])],
 say:`<b>D: high-level policy shouldn't depend on low-level details; both depend on an abstraction.</b> Constructor injection makes the dependency explicit, lets you mark it <code>final</code>, and lets a test pass a fake directly. Spring's IoC container does the wiring in production (5.1).`}
],
keep:[`S: one reason to change. O: new behaviour = new class. L: subtypes keep the base contract.`,`I: small role interfaces. D: depend on interfaces, inject implementations.`,`Square/Rectangle: setWidth then setHeight gives area 16, not 20.`]}, {
  imp: 'must',
  theory: TH(`SOLID is five design principles that keep code easy to change: single responsibility, open/closed, Liskov substitution, interface segregation and dependency inversion.`,
`<ul><li><b>S – Single responsibility</b>: a class should have one reason to change. Pricing logic and PDF generation don't belong together.</li><li><b>O – Open/Closed</b>: add new behaviour by adding code (a new class), not by editing a growing if/switch.</li><li><b>L – Liskov substitution</b>: a subclass must work anywhere its parent is expected, without surprises.</li><li><b>I – Interface segregation</b>: many small, focused interfaces beat one big one that forces classes to implement methods they can't support.</li><li><b>D – Dependency inversion</b>: high-level code depends on abstractions (interfaces), and the concrete classes are plugged in from outside.</li></ul>
<p>They aren't laws; they're warning lights. When a change ripples through many files, one of them is usually being broken.</p>`,
[[`Responsibility`,`A reason for a class to change (a business rule, a format, a storage).`],[`Abstraction`,`An interface that hides which implementation is used.`],[`Dependency injection`,`Passing collaborators in, usually through the constructor.`]],
[`Spot the smell: a class that changes for unrelated reasons, a switch that grows, an override that throws, an interface with unused methods, a <code>new ConcreteThing()</code> deep in business code.`,`Apply the matching fix: split the class, introduce a strategy interface, rethink the hierarchy, split the interface, inject the dependency.`],
[`Spring's DI is dependency inversion in practice.`,`A list of rule beans injected into a service is open/closed: new rule = new bean.`],
[`Applying every principle everywhere, which creates needless layers.`,`Square extends Rectangle: the classic Liskov violation.`]),
  quiz: [
    [`Each new fee type means editing a big <code>switch</code> in FeeCalculator. Which principle, and what fix?`,[`Single responsibility: split FeeCalculator into two classes`,`Liskov: add a FeeCalculator subclass per fee`,`Open/Closed: add a FeeRule implementation and inject all rules`,`Interface segregation: one interface per case`],2,`New behaviour should be a new class, not an edit to existing code.`,'E'],
    [`<code>Square extends Rectangle</code>. A test does setWidth(5), setHeight(4) and expects area 20 but gets 16. Which principle is broken?`,[`Liskov substitution`,`Single responsibility`,`Dependency inversion`,`Open/Closed`],0,`A subtype must keep the base type's contract. Square silently changes both sides.`,'M'],
    [`<code>Printer</code> has print, scan and fax. <code>SimplePrinter.fax()</code> throws UnsupportedOperationException. What's violated?`,[`Only single responsibility`,`Only open/closed`,`Nothing: throwing UnsupportedOperationException is the standard approach`,`Interface segregation, and Liskov (callers of Printer can't rely on fax)`],3,`Split into small role interfaces (Printer, Scanner, Fax) so no class implements methods it can't support.`,'H'],
    [`What does "S" in SOLID stand for?`,[`Static`,`Single responsibility`,`Substitution`,`Segregation`],1,`One reason to change.`,'E'],
    [`Which principle says depend on abstractions, not concretions?`,[`Open/closed`,`Liskov`,`Dependency inversion`,`Interface segregation`],2,`Inject interfaces.`,'E'],
    [`A <code>UserService</code> validates input, saves to the DB, sends emails and builds PDFs. Which principle is strained?`,[`Liskov`,`Single responsibility`,`Interface segregation`,`None`],1,`Four different reasons to change.`,'E'],
    [`Strategy and plugin designs mostly help which principle?`,[`Open/closed`,`Single responsibility`,`Liskov`,`None`],0,`Add behaviour by adding classes.`,'M'],
    [`A subclass override returns null where the parent promised a non-empty list. Which principle breaks?`,[`Interface segregation`,`Liskov substitution`,`Dependency inversion`,`Open/closed`],1,`It weakens the postcondition.`,'M'],
  ],
  quizAdv: [
    [`OrderService does <code>new MySqlOrderRepository()</code> in its constructor. What does DIP suggest?`,[`Depend on an OrderRepository interface, injected`,`Make the repository a static singleton`,`Have OrderService extend the repository`,`Create it lazily with a factory method`],0,`High-level code depends on abstractions; wiring picks the implementation.`,'M'],
    [`An override throws a new unchecked exception for inputs the base accepted. Liskov violation?`,[`No: unchecked exceptions are always allowed`,`Only if the exception is checked`,`Only when the base class is abstract`,`Yes: it strengthens the preconditions`],3,`Callers relying on the base contract break.`,'H'],
    [`How does Spring's DI relate to SOLID?`,[`It breaks single responsibility`,`It's dependency inversion in practice`,`It replaces SOLID entirely`,`It only relates to Liskov`],1,`Also eases testing.`,'M'],
    [`When can applying SOLID hurt?`,[`Never: more SOLID is always better`,`When over-applied as needless indirection`,`Only inside unit tests`,`Only when using records`],1,`Apply where change is likely.`,'H'],
  ],
});
