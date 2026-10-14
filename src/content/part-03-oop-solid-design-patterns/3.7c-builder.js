/* 3.7c Builder */
topic('3', { no:'3.7c', title:'Builder', idea:`Replace an unreadable telescoping constructor with a fluent builder that accumulates fields, validates once, and produces an immutable object.`,
actors:'Objects', stateTitle:'State',
codes:{a:`public final class CarFilter {
  private final String city; private final Long maxPrice; private final Integer minYear;
  private CarFilter(Builder b) { city = b.city; maxPrice = b.maxPrice; minYear = b.minYear; }
  public static Builder builder() { return new Builder(); }
  public static final class Builder {
    private String city; private Long maxPrice; private Integer minYear;
    public Builder city(String c)   { this.city = c; return this; }
    public Builder maxPrice(long p) { this.maxPrice = p; return this; }
    public Builder minYear(int y)   { this.minYear = y; return this; }
    public CarFilter build() {
      if (maxPrice != null && maxPrice < 0) throw new IllegalArgumentException("price");
      return new CarFilter(this);
    }
  }
}
CarFilter f = CarFilter.builder().city("Pune").maxPrice(600_000).minYear(2018).build();
// vs: new CarFilter("Pune", null, 600000, null, 2018, null)  ← which arg is which?`},
steps:[
{hl:{client:[17]}, th:[], g:[G('Telescoping constructor',['new CarFilter("Pune", null, 600000, null, 2018, null)',''],['which null is which?','unreadable','bad'],['swap two Integers by mistake','compiles fine','bad'],['n optional fields','2ⁿ constructor combinations','bad'])],
 say:`The problem: many optional parameters. Telescoping constructors are unreadable and error-prone (same-typed arguments in the wrong order still compile). JavaBeans setters fix readability but leave the object <b>mutable and half-built</b> in between.`},
{hl:{client:[16],B:[4]}, th:[['Builder','created:info','all fields null']], g:[G('Builder@1',['city','null'],['maxPrice','null'],['minYear','null'])],
 say:`<code>builder()</code> returns a mutable, throwaway <b>Builder</b>. It's a static nested class so it can call the private constructor.`},
{hl:{B:[7,8,9]}, th:[['Builder','accumulating:ok','returns this → chaining']], g:[G('Builder@1',['city','"Pune"','hot'],['maxPrice','600000','hot'],['minYear','2018','hot'])],
 say:`Each setter stores a value and <b>returns <code>this</code></b>, which is what makes the calls chain fluently. Each call names its field, and you set only what you need, in any order.`},
{hl:{B:[10,11,12],C:[3]}, th:[['Builder','build():ok','validate → construct'],['CarFilter','created:ok','immutable']], g:[G('CarFilter@2 (final fields)',['city','"Pune"','ok'],['maxPrice','600000','ok'],['minYear','2018','ok'],['setters','none','ok'])],
 say:`<code>build()</code> is the single place to <b>validate</b> (including cross-field rules: min ≤ max) before the object exists. The result is <b>immutable</b>, so it's thread-safe and shareable. The builder itself isn't thread-safe and isn't meant to be shared.`},
{hl:{client:[16]}, th:[], g:[G('In practice',['Lombok','@Builder (+ @Value for immutability)'],['records','no builder; use a static factory or a Lombok builder'],['toBuilder()','copy-and-modify an existing object'],['JDK examples','StringBuilder, HttpRequest.newBuilder(), Stream.builder()'])],
 say:`Use a Builder for objects with roughly 4+ parameters, especially optional ones: request DTOs, query filters, HTTP clients, test data. "Step builders" go further and force the required fields first at compile time.`}
],
keep:[`Builder: fluent setters return this; build() validates once; result is immutable.`,`Solves telescoping constructors and half-built JavaBeans.`,`Lombok @Builder / toBuilder in real code.`]}, {
  imp: 'must',
  theory: TH(`A Builder constructs a complex object step by step with readable, named calls, then validates and creates it in one go.`,
`<p>Constructors with many parameters are hard to read and easy to get wrong: <code>new Car("VW", "Golf", 2020, 5, true, false, "red")</code>. Which boolean is which? A <b>builder</b> lets you write <code>Car.builder().make("VW").model("Golf").year(2020).color("red").build()</code>. Optional values can be skipped, and <code>build()</code> checks the combination is valid before creating an immutable object.</p>`,
[[`Telescoping constructors`,`Many overloaded constructors with growing parameter lists.`],[`Fluent interface`,`Methods returning this, so calls can be chained.`],[`build()`,`Validates all values and creates the final object.`]],
[`A static nested Builder class holds the same fields, all mutable.`,`Each setter-like method sets a field and returns this.`,`<code>build()</code> validates cross-field rules and calls the target's private constructor.`,`The result has final fields and no setters.`],
[`Lombok's <code>@Builder</code> generates builders; <code>toBuilder()</code> makes modified copies.`,`Test data builders make tests readable.`],
[`Builders for classes with two or three fields; a constructor or record is clearer.`,`Skipping validation in build().`]),
  quiz: [
    [`<code>new Car(String, String, int, int, boolean, boolean, String)</code> keeps causing swapped-argument bugs. Best fix?`,[`More overloaded constructors with fewer parameters each`,`A no-arg constructor plus a JavaBean setter for each field`,`A static factory method taking the same 7 parameters`,`A Builder with named fluent methods and checks in build()`],3,`Builder fixes telescoping constructors and avoids half-built objects that setters allow.`,'E'],
    [`Where should a Builder check invariants such as "end date after start date"?`,[`In each fluent setter only`,`In build(), once, with all values known`,`In the built object's getters`,`In the target class's no-arg constructor`],1,`Cross-field rules need all values together, which only build() has.`,'M'],
    [`Why can a Builder produce an immutable object when JavaBeans can't?`,[`The builder deep-copies every field it's given, so nothing can leak out`,`Builder methods are synchronized, so the object can't change mid-build`,`It's built once in build() with every field set, so fields can be final`,`Discarding the builder afterwards freezes the object's fields in place`],2,`JavaBeans need setters (and a moment where the object is half-built); a builder hands everything to one constructor.`,'H'],
    [`What problem does Builder mainly solve?`,[`Sharing one instance safely across threads`,`Long constructors with many optional parameters`,`Choosing which subclass to create at run time`,`Slow startup caused by eager object creation`],1,`Telescoping constructors.`,'E'],
    [`Where is the final object created in a builder?`,[`In each setter`,`In build()`,`In the builder's constructor`,`In toString`],1,`After validation.`,'E'],
    [`Why are JavaBeans (setters) worse for required fields?`,[`Setter calls are slower than one constructor call`,`The object exists in a half-built state between setter calls`,`Objects with setters can't be serialised by Jackson`,`Setters make the object immutable once it's built`],1,`And can't be immutable.`,'M'],
    [`Lombok's <code>@Builder(toBuilder = true)</code> gives?`,[`A builder from an existing instance, to make a modified copy`,`A builder that checks required fields at compile time`,`A shared static builder reused across all instances`,`A builder whose build() caches the created object`],0,`Handy for immutable objects.`,'M'],
    [`A builder method should return?`,[`void`,`this`,`a new object of the target class`,`null`],1,`For chaining.`,'E'],
  ],
  quizAdv: [
    [`Lombok <code>@Builder</code> (no @Singular): <code>builder.items(list)</code>, then the caller mutates list. Effect?`,[`Lombok copied the list, so no effect`,`The built object sees the change`,`An exception at build()`,`Compile error`],1,`The reference is stored as-is. Use @Singular or copy in the constructor.`,'H'],
    [`What do a builder's fluent methods return?`,[`void`,`A new builder each time`,`The built object`,`this, the same builder`],3,`Returning this enables chaining.`,'M'],
    [`How do you make a builder enforce required fields at compile time?`,[`Annotate required builder fields with Lombok's @NonNull`,`Step builder: each step's interface exposes only the next setter`,`Validate in build() and throw IllegalStateException`,`Make the builder's required fields static final`],1,`Trades simplicity for safety.`,'H'],
    [`Records with many components: alternative to a builder?`,[`Public setters generated for each record component`,`Static factory methods or "withers" returning modified copies`,`Extending the record to add the optional fields`,`Reflection to set components after construction`],1,`Records can also get builders via libraries.`,'M'],
  ],
});
