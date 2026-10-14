/* 7.1 Enums with fields and behaviour */
topic('7', { no:'7.1', title:'Enums with fields and behaviour', imp:'must', idea:`An enum is a class with a fixed set of instances. Give it fields and logic, switch over it exhaustively, store it safely, and use EnumMap.`,
actors:'Thread', stateTitle:'Enum instances',
codes:{a:`public enum OrderStatus {
  PENDING(false), PAID(false), SHIPPED(true), CANCELLED(true);

  private final boolean terminal;               // enums can have fields
  OrderStatus(boolean terminal) { this.terminal = terminal; }
  public boolean isTerminal() { return terminal; }

  public boolean canMoveTo(OrderStatus next) {  // and behaviour
    return switch (this) {
      case PENDING -> next == PAID || next == CANCELLED;
      case PAID    -> next == SHIPPED || next == CANCELLED;
      case SHIPPED, CANCELLED -> false;
    };
  }
}
OrderStatus s = OrderStatus.valueOf("PAID");    // from a String
boolean same = (s == OrderStatus.PAID);         // == is safe for enums
Map<OrderStatus, Long> counts = new EnumMap<>(OrderStatus.class);`},
steps:[
{hl:{main:[1,2]}, th:[], g:[G('OrderStatus instances (created once)',['PENDING','ordinal 0'],['PAID','ordinal 1'],['SHIPPED','ordinal 2'],['CANCELLED','ordinal 3'])],
 say:`An <b>enum</b> is a class whose instances are listed up front and created exactly once, when the class is initialised. Nobody can create a fifth one: no public constructor, no subclassing. It's the type-safe replacement for <code>int</code> or String constants.`},
{hl:{main:[4,5,6]}, g:[G('OrderStatus instances',['PENDING','terminal = false'],['PAID','terminal = false'],['SHIPPED','terminal = true','hot'],['CANCELLED','terminal = true','hot'])],
 say:`Enums are full classes: each constant can carry data. The values in brackets go to the constructor, which is implicitly private. Put facts about a status <b>on the status</b>, instead of scattering <code>if (status == SHIPPED || …)</code> through the code.`},
{hl:{main:[8,9,10,11,12]}, g:[G('canMoveTo',['PENDING → PAID','✔','ok'],['PAID → PENDING','✘','bad'],['SHIPPED → anything','✘ (terminal)','bad'])],
 say:`Behaviour belongs here too. A <b>switch expression</b> over an enum with no <code>default</code> must cover every constant, so if someone adds <code>REFUNDED</code>, this method <b>stops compiling</b> until the rule is defined. That's a compile-time safety net a String status can't give you.`},
{hl:{main:[16]}, g:[G('Built-in methods',['valueOf("PAID")','PAID','ok'],['valueOf("paid")','IllegalArgumentException','bad'],['name()','"PAID"'],['ordinal()','1'],['values()','[PENDING, PAID, SHIPPED, CANCELLED]'])],
 say:`Every enum gets <code>valueOf</code> (exact, case-sensitive name), <code>name()</code>, <code>ordinal()</code> (position) and <code>values()</code>. Parsing user or API input with valueOf throws on unknown values, so validate or map errors to a 400.`},
{hl:{main:[17]}, g:[G('Comparing',['s == OrderStatus.PAID','true: one instance per constant','ok'],['null == PAID','false (no NPE)','ok'],['nullStatus.equals(PAID)','NullPointerException','bad'])],
 say:`Each constant is a singleton, so <code>==</code> is correct and also null-safe. Enums also work in switch, as map keys, and are thread-safe to share.`},
{hl:{main:[18]}, g:[G('EnumMap counts (array indexed by ordinal)',C('',[['PENDING: 4'],['PAID: 9'],['SHIPPED: 12'],['CANCELLED: 1']]),['order','declaration order','ok'],['speed','array lookup, no hashing','ok'])],
 say:`<b>EnumMap</b> and <b>EnumSet</b> are specialised collections: internally an array indexed by ordinal (EnumSet is a bit set). Faster and smaller than HashMap/HashSet, and they iterate in declaration order.`},
{th:[], g:[G('Storing enums',['@Enumerated(EnumType.ORDINAL)','stores 0,1,2…: reordering constants corrupts data','bad'],['@Enumerated(EnumType.STRING)','stores "PAID": safe to reorder','ok'],['renaming a constant','still needs a migration'],['JSON (Jackson)','name() by default'])],
 say:`<b>Production pitfall:</b> JPA's default stores the <b>ordinal</b>. Insert a new constant in the middle and every existing row now means something else. Always use <code>@Enumerated(EnumType.STRING)</code>. Enums can also implement interfaces, which gives you a strategy per constant (3.7d) and the safest singleton (3.7a).`}
],
keep:[`Enum = class with a fixed set of singleton instances; can have fields, constructors, methods, implement interfaces.`,`Switch expressions over enums are exhaustive: adding a constant breaks unhandled switches at compile time.`,`Compare with ==; use EnumMap/EnumSet; persist with EnumType.STRING, never ORDINAL.`]}, {
  imp: 'good',
  theory: TH(`An enum defines a type with a fixed, named set of values, and each value is a real object that can hold data and behaviour.`,
`<p>Many things in a program have a small fixed set of possible values: order status, day of week, payment method. Using Strings ("PAID") or ints (2) for them invites typos and invalid values. An <b>enum</b> makes them a type: <code>OrderStatus.PAID</code> is checked by the compiler, and nothing else can be passed.</p>
<p>Each enum constant is a single object created once, so you compare with <code>==</code>. Because enums are classes, constants can carry fields (like <code>isTerminal</code>) and methods (like <code>canMoveTo</code>), keeping related rules in one place.</p>`,
[[`Constant`,`One named instance of the enum (PAID).`],[`ordinal()`,`Position in the declaration (0, 1, 2…).`],[`name() / valueOf()`,`Constant → String / String → constant.`],[`EnumMap / EnumSet`,`Fast collections specialised for enum keys.`],[`Exhaustive switch`,`A switch expression covering every constant, checked by the compiler.`]],
[`Declare constants, optionally with constructor arguments.`,`Add fields, a (private) constructor and methods.`,`Use constants directly, compare with ==, switch over them.`,`Convert from text with valueOf (handle IllegalArgumentException).`],
[`Model statuses, types and modes as enums, with the business rules on them.`,`Persist with <code>@Enumerated(EnumType.STRING)</code>.`,`Use EnumMap for per-status counters or handlers.`],
[`Storing ordinals in the database.`,`Switching on enums with a default that silently swallows new constants.`,`Using valueOf on raw user input without handling bad values.`]),
  quiz: [
    [`How should you compare an enum value to a constant?`,[`s.equals("PAID")`,`s.name() == "PAID"`,`s == OrderStatus.PAID`,`s.ordinal() == "PAID".hashCode()`],2,`Each constant is a singleton; == is correct and null-safe.`,'E'],
    [`JPA entity uses <code>@Enumerated</code> with the default type. You insert a new constant in the middle of the enum. Effect?`,[`Nothing changes, since enum names are stored`,`Existing rows now map to different constants`,`Hibernate fails schema validation at startup`,`Only newly inserted rows get the shifted values`],1,`The default is ORDINAL; positions shift. Use EnumType.STRING.`,'M'],
    [`A switch expression over an enum has no default. You add a new constant. What happens?`,[`The new constant is silently ignored`,`It throws at run time only`,`Nothing: switch expressions don't need cases`,`The switch fails to compile until the case is handled`],3,`Switch expressions must be exhaustive; that's the safety net.`,'H'],
    [`What does <code>OrderStatus.values()</code> return?`,[`A Set of all constants in hash order`,`An array of all constants in declaration order`,`An immutable List of constants sorted by name`,`A Map from each constant's name to its ordinal`],1,`A new array each call.`,'E'],
    [`Can enum constants have their own fields?`,[`No, enums can only hold their name and ordinal`,`Yes, set through the enum's constructor`,`Yes, but only static fields shared by all constants`,`Only if each field is a compile-time constant`],1,`e.g. PAID(false).`,'E'],
    [`An enum's constructor is...`,[`public`,`implicitly private`,`protected`,`static`],1,`You can't call it yourself.`,'M'],
    [`Why is an enum good for statuses instead of String constants?`,[`String comparisons are slower and the JIT can't inline them, so enums are always faster`,`The compiler only allows valid values and switches can be checked for exhaustiveness`,`Enums are stored more compactly in the database and use less disk than text columns`,`String constants can't be used as switch labels, so validation logic must use if-chains`],1,`Typos become compile errors.`,'E'],
    [`<code>OrderStatus.PAID.compareTo(OrderStatus.SHIPPED)</code> compares?`,[`Names alphabetically`,`Ordinal positions`,`Hash codes`,`It throws`],1,`Declaration order.`,'M'],
  ],
  quizAdv: [
    [`Can an enum extend another class?`,[`Yes, any non-final class, as long as it has a no-arg constructor`,`Only abstract classes, because the constants act as their subclasses`,`No: enums implicitly extend java.lang.Enum, but they can implement interfaces`,`Only other enums, so a child enum inherits all the parent's constants`],2,`Java has single inheritance, and Enum is already the parent.`,'M'],
    [`Why are EnumMap and EnumSet faster than HashMap/HashSet for enum keys?`,[`They precompute and cache each key's hashCode once at class load`,`They're backed by an array / bit vector indexed by ordinal`,`They're internally synchronized, so lookups avoid lock contention`,`They're backed by a TreeMap sorted by ordinal for faster binary search`],1,`No hashing, compact memory, declaration-order iteration.`,'H'],
    [`Can an enum implement an interface?`,[`No, enums are final, so they can't implement interfaces`,`Yes, and each constant can provide its own implementation`,`Yes, but only marker interfaces with no abstract methods`,`Only Comparable and Serializable, which Enum already declares`],1,`Useful for strategy-like enums.`,'M'],
    [`Why is switching on an enum's ordinal stored in the DB risky?`,[`Ordinals are recomputed at each JVM start and can differ between runs`,`Reordering or inserting constants changes ordinals and corrupts meaning`,`Switching on an int is slower than switching on the enum constant itself`,`Ordinals are capped at 127 because they're stored as a single signed byte`],1,`Store names (EnumType.STRING).`,'M'],
  ],
});
