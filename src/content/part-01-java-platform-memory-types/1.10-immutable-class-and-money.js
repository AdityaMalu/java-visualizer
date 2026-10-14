/* 1.10 Immutable class and money */
topic('1', { no:'1.10', title:'Immutable class and money', idea:`Break a "final" class from outside through its list, fix it with defensive copies, then see why money never goes in a double.`,
actors:'Callers', stateTitle:'Objects',
codes:{a:`public final class Price {
  private final List<String> tags;
  public Price(List<String> tags) { this.tags = tags; }   // ✘ no copy
  public List<String> tags() { return tags; }             // ✘ leaks
}
List<String> t = new ArrayList<>(List.of("new"));
Price p = new Price(t);
t.add("hacked");                 // p changed from outside!
p.tags().clear();                // and again`,
b:`public final class Price {                     // 1. can't subclass
  private final long amount;                   // 2. private final
  private final List<String> tags;
  public Price(long amount, List<String> tags) {
    this.amount = amount;
    this.tags = List.copyOf(tags);             // 3. copy IN
  }
  public List<String> tags() { return tags; }  // 4. already unmodifiable
  public Price plus(long x) {                  // 5. "change" = new object
    return new Price(amount + x, tags);
  }
}
// Java 16+: record Price(long amount, List<String> tags) {
//   Price { tags = List.copyOf(tags); } }     // compact constructor`,
c:`double d = 0.1 + 0.2;                    // 0.30000000000000004
BigDecimal a = new BigDecimal("0.1").add(new BigDecimal("0.2"));  // 0.3
new BigDecimal(0.1);                     // ✘ 0.1000000000000000055511…
new BigDecimal("2.0").equals(new BigDecimal("2.00"));     // false!
new BigDecimal("2.0").compareTo(new BigDecimal("2.00"));  // 0
long paise = 1999;                       // ₹19.99 as an exact integer
new BigDecimal("10").divide(new BigDecimal("3"));         // ✘ throws
new BigDecimal("10").divide(new BigDecimal("3"), 2, RoundingMode.HALF_EVEN); // 3.33`},
steps:[
{cv:'a', hl:{caller:[6,7]}, th:[['caller','RUN','owns list t']], g:[G('Price p',['tags','→ list@9 (the SAME list as t)','bad']), G('list@9',['contents','["new"]'])],
 say:`This class looks immutable (final class, final field, no setters) but it stores the <b>caller's own list</b>. Both <code>t</code> and <code>p.tags</code> point to list@9.`},
{hl:{caller:[8]}, g:[G('Price p',['tags','→ list@9','bad']), G('list@9',['contents','["new", "hacked"]','bad'])], log:['p.tags() → [new, hacked]'],
 say:`The caller mutates its list, and the "immutable" Price changes. If Price was a HashMap key or had been validated, that guarantee is now broken.`},
{hl:{caller:[9]}, g:[G('list@9',['contents','[]','bad'])], log:['p.tags() → []'],
 say:`The getter leaks the internal list too, so anyone can clear it. Two holes: <b>in</b> through the constructor and <b>out</b> through the accessor.`},
{cv:'b', logReset:true, hl:{caller:[6,8]}, g:[G('Price p',['tags','→ ImmutableList@4 (own copy)','ok']), G('caller list t',['t.add("hacked")','affects only t','ok'],['p.tags().clear()','UnsupportedOperationException','ok'])],
 say:`The recipe: <b>final class</b> (or private constructor + factory), <b>private final</b> fields, <b>no setters</b>, <b>copy mutable inputs</b> (<code>List.copyOf</code> also rejects nulls), <b>never expose</b> mutable internals, and "modify" by returning a <b>new instance</b>. Records give you most of this, but you still need the compact constructor to copy lists.`},
{g:[G('Payoff',['thread-safe','no locks needed (final-field guarantee)','ok'],['safe map key / set element','hash never changes','ok'],['can cache & share freely','ok'],['cost','new object per change (usually cheap)'])],
 say:`Immutable value objects (Money, Price, DateRange) remove whole classes of bugs. <code>java.time</code>, <code>String</code> and <code>BigDecimal</code> are all built this way.`},
{cv:'c', hl:{main:[1]}, g:[G('double 0.1 in binary',['0.1','0.0001100110011… (repeats forever)','bad'],['stored as','nearest 52-bit fraction'],['0.1 + 0.2','0.30000000000000004','bad'])], log:['0.30000000000000004'],
 say:`<b>Money in double:</b> 0.1 has no exact binary representation, just as 1/3 has none in decimal. Errors pile up across sums, splits and interest calculations. Never use float/double for money.`},
{hl:{main:[2,3]}, log:['0.3','0.1000000000000000055511151231257827021181583404541015625'],
 say:`<code>BigDecimal</code> stores an exact unscaled integer and a scale. Build it from a <b>String</b> (or <code>BigDecimal.valueOf(double)</code>). <code>new BigDecimal(0.1)</code> faithfully copies the double's binary error.`},
{hl:{main:[4,5]}, log:['false','0'],
 say:`<b>Gotcha:</b> <code>equals</code> compares value <b>and scale</b>, so 2.0 ≠ 2.00. Use <code>compareTo(...) == 0</code>, or normalise with <code>stripTrailingZeros()</code>. This also means a <code>HashSet&lt;BigDecimal&gt;</code> can hold "both" 2.0 and 2.00.`},
{hl:{main:[6,7,8]}, log:['✘ ArithmeticException: Non-terminating decimal expansion','3.33'],
 say:`Division needs an explicit <b>scale and RoundingMode</b> (HALF_EVEN is banker's rounding, which avoids upward bias). The simple alternative is a <b>long in minor units</b> (paise, cents): exact, fast, and what most payment systems store. Add the currency as a separate field.`}
],
keep:[`Immutable: final class, private final fields, no setters, copy in, don't leak out, new object on change.`,`Never double for money: BigDecimal from String, or long minor units.`,`BigDecimal equals checks scale (2.0 ≠ 2.00) → compareTo; divide needs scale + RoundingMode.`]}, {
  imp: 'must',
  theory: TH(`An immutable object never changes after construction, which makes it simple and thread-safe; money must use exact decimal types, never double.`,
`<p>An <b>immutable</b> object, like <code>String</code> or <code>LocalDate</code>, is set up once in its constructor and never changes. "Changing" it gives you a new object. You never have to wonder who modified it, and you can share it between threads without locks.</p>
<p><b>Money</b> needs exact decimals. <code>double</code> stores numbers in binary, which can't represent 0.1 exactly (like 1/3 in decimal), so <code>0.1 + 0.2</code> becomes 0.30000000000000004. Use <code>BigDecimal</code> created from a String, or store whole <b>minor units</b> (cents) in a <code>long</code>.</p>`,
[[`Immutable class`,`final class, private final fields, no setters, defensive copies in and out.`],[`Defensive copy`,`Copying a mutable argument so the caller can't change your internals later.`],[`BigDecimal`,`Arbitrary-precision decimal number with an explicit scale.`],[`Scale / RoundingMode`,`Number of decimal places, and how to round when dividing.`]],
[`Make the class final and all fields private final.`,`In the constructor, copy any mutable inputs (lists, arrays, dates).`,`Don't expose mutable internals; return copies or unmodifiable views.`,`For changes, return a new instance ("withers": <code>withAmount(...)</code>).`],
[`Records are a concise way to write immutable data carriers.`,`Store money as BigDecimal or long cents; always specify RoundingMode when dividing.`,`Compare BigDecimals with compareTo, because equals also compares the scale (2.0 ≠ 2.00).`],
[`<code>new BigDecimal(0.1)</code>: it captures the double's error. Use <code>new BigDecimal("0.1")</code> or <code>BigDecimal.valueOf(0.1)</code>.`,`Storing a caller's list directly in an "immutable" object.`]),
  quiz: [
    [`<code>0.1 + 0.2 == 0.3</code> is false with doubles. What should you use for money?`,[`double, rounding with Math.round to two decimals after each step`,`new BigDecimal(0.1), which converts the double exactly`,`BigDecimal built from a String, or a long count of minor units (cents)`,`float, which has enough precision for currency`],2,`Binary floating point can't represent 0.1. new BigDecimal(0.1) faithfully captures the double's error; use BigDecimal("0.1") or BigDecimal.valueOf.`,'E'],
    [`<code>new BigDecimal("2.0").equals(new BigDecimal("2.00"))</code> returns?`,[`true, because the numeric values are equal`,`true, because trailing zeros are stripped on construction`,`It throws: values with different scales can't be compared`,`false, because equals compares scale as well as value`],3,`Use compareTo(...) == 0 for numeric equality. This also matters for HashSet&lt;BigDecimal&gt; (TreeSet uses compareTo).`,'M'],
    [`An "immutable" class has <code>private final List&lt;Item&gt; items</code>, and its constructor does <code>this.items = Collections.unmodifiableList(items);</code>. Is it immutable?`,[`Yes: a final field holding an unmodifiable list is enough`,`No: the view still tracks the caller's list; copy it with List.copyOf`,`Yes, as long as the class itself is also declared final`,`No: unmodifiableList only blocks add(), so set() still works`],1,`unmodifiableList is a read-only view over the original list. Copy on the way in (and Item must be immutable too).`,'H'],
    [`Which is NOT required for an immutable class?`,[`final fields`,`no setters`,`defensive copies of mutable inputs`,`a public no-arg constructor`],3,`Immutable classes usually validate everything in one constructor.`,'E'],
    [`Why are immutable objects naturally thread-safe?`,[`Immutable classes use locks internally`,`Their state never changes, so nothing races`,`Immutable objects are stored on the stack`,`The JIT shields them from other threads`],1,`Share them freely.`,'E'],
    [`<code>new BigDecimal("1.10").setScale(1, RoundingMode.HALF_UP)</code>?`,[`1.1`,`1.10`,`1`,`ArithmeticException`],0,`Scale 1 → one decimal place.`,'M'],
    [`How should you compare two BigDecimals for numeric equality?`,[`equals`,`compareTo(...) == 0`,`==`,`hashCode`],1,`equals also compares scale.`,'M'],
    [`Storing prices as long cents means $12.34 is stored as?`,[`12.34`,`1234`,`12`,`123400`],1,`Integer minor units avoid floating point errors.`,'E'],
  ],
  quizAdv: [
    [`<code>new BigDecimal("10").divide(new BigDecimal("3"))</code>?`,[`3.33, rounded to two places`,`3, using integer division`,`3.3333333333, to 10 places`,`ArithmeticException: non-terminating`],3,`Non-terminating decimal with no MathContext. Pass a scale and RoundingMode.`,'H'],
    [`What does <code>new BigDecimal(0.1)</code> print?`,[`0.1, since BigDecimal is exact`,`0.10, with the default scale of 2`,`0.1000000000000000055511151231…`,`1E-1, in scientific notation`],2,`It captures the exact binary value of the double. Use BigDecimal.valueOf(0.1) or new BigDecimal("0.1").`,'M'],
    [`An immutable class returns its internal <code>List</code> from a getter. Safe way?`,[`Return the field directly, since it's final`,`Return List.copyOf(items) or an unmodifiable view`,`Return null and make callers rebuild it`,`Make the getter synchronized`],1,`Don't let callers modify internal state.`,'M'],
    [`<code>BigDecimal.valueOf(0.1)</code> vs <code>new BigDecimal(0.1)</code>?`,[`They're identical: both store exactly 0.1`,`valueOf gives 0.1; the constructor the exact binary value`,`valueOf throws for values like 0.1`,`The constructor is the safer, exact choice`],1,`Prefer valueOf or the String constructor.`,'H'],
  ],
});
