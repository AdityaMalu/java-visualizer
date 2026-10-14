/* 2.3 equals and hashCode contract */
topic('2', { no:'2.3', title:'equals and hashCode contract', idea:`Override only equals and the map can't find your key. Then mutate a key inside a map and create a ghost entry.`,
actors:'Operation', stateTitle:'HashMap buckets',
codes:{a:`class Emp {
  int id;
  Emp(int id) { this.id = id; }
  @Override public boolean equals(Object o) {
    return o instanceof Emp e && e.id == id;
  }
  // ✘ no hashCode(): Object's identity hash is used
}
Map<Emp, String> m = new HashMap<>();
m.put(new Emp(1), "Asha");
m.get(new Emp(1));              // null ✘`,
b:`class Emp {
  int id;                                    // ✘ mutable, used in hashCode
  public boolean equals(Object o) { return o instanceof Emp e && e.id == id; }
  public int hashCode() { return Integer.hashCode(id); }
}
Emp k = new Emp(1);
m.put(k, "Asha");               // bucket for hash 1
m.get(new Emp(1));              // "Asha" ✔
k.id = 2;                       // mutate a key INSIDE the map ✘
m.get(k);                       // null: searches bucket for 2
m.get(new Emp(1));              // null: right bucket, equals fails
m.size();                       // 1 → a ghost entry (leak)`},
steps:[
{cv:'a', hl:{op:[10]}, th:[['op','put(Emp#1a):info','identityHash = 7712']], g:[G('table',C('[0]',[['Emp(1)#1a → "Asha"','hot']]),C('[5]',[['null','dim']]))],
 say:`With no <code>hashCode</code> override, <code>Object.hashCode()</code> returns an <b>identity hash</b> (roughly random per object). The entry lands in a bucket chosen by that random number.`},
{hl:{op:[11]}, th:[['op','get(Emp#2b):bad','identityHash = 9045 → other bucket']], g:[G('table',C('[0]',['Emp(1)#1a → "Asha"']),C('[5]',[['looked here: empty','bad']]))], log:['null ✘  (equal objects, different hash codes)'],
 say:`A <b>new</b> Emp(1) is <code>equals</code> to the stored key, but it has a different identity hash, so <code>get</code> searches a <b>different bucket</b> and never even calls equals. <b>Rule: a.equals(b) ⇒ a.hashCode() == b.hashCode().</b> The reverse isn't required: collisions are allowed.`},
{cv:'b', logReset:true, hl:{op:[6,7,8]}, th:[['op','put / get:ok','hash = 1']], g:[G('table',C('[1]',[['Emp(id=1) → "Asha"','ok']]),C('[2]',[['null','dim']]))], log:['"Asha" ✔'],
 say:`Now both are overridden and use the <b>same fields</b>. Equal keys give equal hashes, so get finds the bucket and equals finds the key. Use <code>Objects.hash(a, b)</code> or IDE/record-generated code. <b>Records</b> generate correct equals/hashCode for you.`},
{hl:{op:[9]}, th:[['op','k.id = 2:bad','key mutated in place']], g:[G('table',C('[1]',[['Emp(id=2!) → "Asha"','bad']]),C('[2]',[['null','dim']]),['stored hash in node','still 1','bad'])],
 say:`The key object is mutated <b>while inside the map</b>. The node still sits in bucket 1 and its cached hash is still 1, but the key now reports hash 2.`},
{hl:{op:[10,11,12]}, th:[['op','lookups fail:bad','']], g:[G('get(k) with id = 2',['searches bucket','[2] → empty','bad']), G('get(new Emp(1))',['searches bucket','[1] → finds node'],['equals(Emp(id=2))','false','bad']), G('map',['size()','1 (ghost entry)','bad'],['remove possible?','no; only by iterating','bad'])], log:['null','null','1'],
 say:`Now <b>nothing</b> can find the entry: the new hash points to an empty bucket, and the old bucket's equals fails. The entry is stuck there, a <b>memory leak</b>. Rule: fields used in <code>hashCode</code>/<code>equals</code> must not change while the object is in a hash-based collection. Make keys <b>immutable</b>.`},
{th:[], g:[G('equals must be',['reflexive','x.equals(x)'],['symmetric','x.equals(y) ⇔ y.equals(x)'],['transitive','x=y, y=z ⇒ x=z'],['consistent','same answer while unchanged'],['x.equals(null)','false']), G('Inheritance trap',['Point(1,2) vs ColorPoint(1,2,red)','instanceof in both → symmetric breaks','bad'],['options','getClass() check, or composition, or final classes / records','ok'])],
 say:`The full contract. A classic SDE-2 follow-up: with subclasses, <code>instanceof</code>-based equals tends to break symmetry (a Point equals a ColorPoint, but not the other way round). Fix it with <code>getClass() != o.getClass()</code>, or avoid it entirely with composition or final value types.`}
],
keep:[`equal ⇒ same hashCode (not the reverse). Override both, from the same fields.`,`Never mutate a key's hashed fields while it's in a HashMap/HashSet → ghost entry.`,`Use records / Objects.hash; beware equals symmetry with subclasses.`]}, {
  imp: 'must',
  theory: TH(`equals decides whether two objects mean the same thing; hashCode must agree with it, or hash-based collections break.`,
`<p>By default, <code>equals</code> asks "are these the very same object in memory?". For value-like classes (Money, Email, a composite key) you usually want "do these have the same contents?", so you override <code>equals</code>.</p>
<p>Hash collections first use <code>hashCode</code> to pick a bucket and only then call <code>equals</code>. If two equal objects return different hash codes, the set looks in the wrong bucket and never finds the match. Hence the rule: <b>override both together, using the same fields</b>.</p>`,
[[`equals contract`,`Reflexive, symmetric, transitive, consistent, and x.equals(null) is false.`],[`hashCode contract`,`Equal objects ⇒ equal hash codes. (Unequal objects may still collide.)`],[`Value object`,`An object identified by its contents, not its identity.`]],
[`Choose the fields that define identity (e.g. id, or email).`,`Implement equals comparing exactly those fields.`,`Implement hashCode from the same fields (<code>Objects.hash(...)</code>).`,`Or use a <code>record</code>, which generates both correctly.`],
[`Make key classes immutable so their hash can't change while in a map.`,`JPA entities need care: generated ids are null before persist.`,`IDEs and records generate correct implementations; prefer them to hand-written ones.`],
[`Overriding equals but not hashCode.`,`Mutating a field used in hashCode while the object is a key in a HashMap or HashSet.`,`Adding a field to equals in a subclass, which breaks symmetry.`]),
  quiz: [
    [`A class overrides <code>equals</code> but not <code>hashCode</code>. Two equal instances are added to a HashSet. Size?`,[`1, because HashSet uses equals to find duplicates`,`1, because Object.hashCode is derived from the fields`,`Usually 2, because they land in different buckets`,`Compile error: equals and hashCode must be overridden together`],2,`The default hashCode is identity-based, so equal objects usually hash to different buckets and equals is never called.`,'E'],
    [`<pre>Key k = new Key("a"); map.put(k, 1);
k.setName("b");     // name is used in hashCode
map.get(k);</pre>Returns?`,[`1, because the map holds the same object reference`,`null: the entry sits in the bucket for the old hash`,`1, because HashMap rehashes keys on each get`,`It throws ConcurrentModificationException`],1,`Lookups go to the bucket for the new hash. The entry becomes a ghost you can't reach or remove.`,'M'],
    [`Which statement about the equals/hashCode contract is true?`,[`Equal hash codes imply equal objects`,`Unequal objects must have different hash codes`,`hashCode may use fields that equals ignores, if it's consistent`,`Equal objects must have equal hash codes`],3,`Collisions are allowed. Using a field that equals ignores would let two equal objects get different hashes, which breaks the contract.`,'H'],
    [`Which methods must be overridden together?`,[`toString and equals`,`equals and hashCode`,`hashCode and compareTo`,`clone and finalize`],1,`From the same fields.`,'E'],
    [`What does the default <code>Object.equals</code> compare?`,[`All fields`,`References (identity)`,`hashCode values`,`toString output`],1,`Override it for value semantics.`,'E'],
    [`What do records generate for equals/hashCode?`,[`Nothing`,`Identity-based versions`,`Versions based on all components`,`Only hashCode`],2,`That's why records make good map keys.`,'E'],
    [`Is <code>x.equals(null)</code> allowed to throw?`,[`Yes, NullPointerException`,`No: it must return false`,`Only for Strings`,`Only if x is null`],1,`Part of the equals contract.`,'M'],
    [`Why should hashCode be cheap and stable?`,[`It's only called once, when the key is inserted`,`Maps call it on every put/get; a changing hash loses entries`,`Maps use it for sorting keys in order`,`It doesn't matter as long as equals is correct`],1,`Use immutable fields.`,'M'],
  ],
  quizAdv: [
    [`<code>ColorPoint extends Point</code> overrides equals to also compare color. <code>p.equals(cp)</code> is true, <code>cp.equals(p)</code> false. What's broken?`,[`Symmetry`,`Reflexivity`,`hashCode only`,`Nothing`],0,`You can't add a value field in a subclass and keep the equals contract. Prefer composition.`,'H'],
    [`A JPA entity's hashCode uses its generated id (null until persist). You add it to a HashSet, then persist. Problem?`,[`Nothing: ids never change once set`,`persist() throws because it's in a set`,`HashSet rehashes changed keys itself`,`Its hash changes, so the set can't find it`],3,`Use a business key, or a constant hashCode with id-based equals.`,'H'],
    [`Using <code>instanceof</code> vs <code>getClass() ==</code> in equals: trade-off?`,[`There's no difference between the two`,`instanceof risks symmetry; getClass() blocks subtypes`,`getClass() is faster, nothing else changes`,`instanceof doesn't compile inside equals`],1,`Records and final classes avoid the dilemma.`,'H'],
    [`A class's hashCode returns 42 for every object. Correct? Fast?`,[`Incorrect and slow: it breaks the contract`,`Correct, but every entry collides: very slow`,`Incorrect but fast: collisions don't matter`,`Correct and fast: one bucket is efficient`],1,`Valid but terrible distribution.`,'H'],
  ],
});
