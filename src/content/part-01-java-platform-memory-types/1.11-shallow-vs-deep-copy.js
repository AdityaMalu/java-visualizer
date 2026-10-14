/* 1.11 Shallow vs deep copy */
topic('1', { no:'1.11', title:'Shallow vs deep copy', idea:`<code>clone()</code> copies the outer object but shares everything inside it. A copy constructor gives you an independent copy.`,
actors:'Variables', stateTitle:'Objects', dgTitle:'Object graph',
vb:'0 0 480 230',
nodes:{a:{x:50,y:40,label:'a',kind:'mem',w:50,h:32}, b:{x:50,y:115,label:'b',kind:'mem',w:50,h:32}, c:{x:50,y:190,label:'c',kind:'mem',w:50,h:32},
  ca:{x:190,y:40,label:'Car#1',w:100,h:34}, cb:{x:190,y:115,label:'Car#2 (clone)',w:120,h:34}, cc:{x:190,y:190,label:'Car#3 (copy)',w:120,h:34},
  e1:{x:390,y:75,label:'Engine#1\nhp = 100',w:120,h:46}, e3:{x:390,y:190,label:'Engine#3\nhp = 100',w:120,h:46}},
codes:{a:`class Engine { int hp; }
class Car implements Cloneable {
  Engine engine; List<String> tags;
  public Car clone() throws CloneNotSupportedException {
    return (Car) super.clone();        // shallow: copies the references
  }
  Car(Car o) {                         // copy constructor: deep
    this.engine = new Engine(o.engine.hp);
    this.tags = new ArrayList<>(o.tags);
  }
}
Car a = new Car(...);   Car b = a.clone();
b.engine.hp = 200;                     // a.engine.hp is 200 too!
Car c = new Car(a);     c.engine.hp = 300;   // a untouched`},
steps:[
{hl:{main:[12]}, d:{type:'graph',hide:['b','cb','c','cc','e3'],e:[['a','ca','','hot'],['ca','e1','engine','']]},
 say:`<code>a</code> points to Car#1, which has a reference to Engine#1.`},
{hl:{main:[12],Car:[5]}, d:{type:'graph',hide:['c','cc','e3'],e:[['a','ca',''],['ca','e1','engine',''],['b','cb','','hot'],['cb','e1','engine (same!)','bad']]},
 say:`<code>super.clone()</code> makes a new Car#2 and copies each field <b>bit by bit</b>. The <code>engine</code> field holds a reference, so the reference is copied. Both cars now share <b>one Engine</b> (and one tags list).`},
{hl:{main:[13]}, d:{type:'graph',hide:['c','cc','e3'],labels:{e1:'Engine#1\nhp = 200'},bad:['e1'],e:[['a','ca',''],['ca','e1','engine','bad'],['b','cb',''],['cb','e1','engine','bad']]}, log:['a.engine.hp → 200 ✘'],
 say:`Change b's engine and a's engine changes too. That's a <b>shallow copy</b> bug: fine for primitives and immutable fields (String, Integer), wrong for mutable ones.`},
{hl:{main:[14],Car:[7,8,9]}, d:{type:'graph',labels:{e1:'Engine#1\nhp = 200',e3:'Engine#3\nhp = 300'},ok:['e3'],e:[['a','ca',''],['ca','e1','engine',''],['b','cb',''],['cb','e1','engine',''],['c','cc','','hot'],['cc','e3','own engine','ok']]},
 say:`The <b>copy constructor</b> builds a new Engine and a new list, so Car#3 is fully independent. Deep-copy every <b>mutable</b> field, recursively. Immutable fields can be shared safely, which is another win for immutability.`},
{d:null, g:[G('Why avoid clone()',['no constructor runs','invariants/validation skipped','bad'],['shallow by default','easy bugs','bad'],['Cloneable','marker interface; Object.clone is protected','bad'],['checked exception','CloneNotSupportedException','bad'],['final fields','can\'t be reassigned in clone()','bad']), G('Prefer',['copy constructor','new Car(other)','ok'],['static factory','Car.copyOf(other)','ok'],['immutable objects','no copying needed','ok'])],
 say:`Effective Java's advice: <b>avoid clone()</b>. Arrays are the one place it's fine (<code>arr.clone()</code>, still shallow for object arrays). Serialization-based deep copy works but is slow and fragile. The Object methods worth knowing: equals, hashCode, toString, getClass, clone, wait/notify/notifyAll, and the deprecated finalize.`}
],
keep:[`Shallow copy shares nested mutable objects; deep copy duplicates them.`,`clone(): no constructor, shallow, awkward → use a copy constructor or factory.`,`Immutable fields can be shared safely.`]}, {
  imp: 'good',
  theory: TH(`Copying an object can copy just the outer object (shallow) or everything it contains (deep); the difference decides whether changes leak between copies.`,
`<p>Imagine photocopying a folder's cover page but not the documents inside: both "copies" still share the same documents. That's a <b>shallow copy</b>: a new outer object whose fields point to the <i>same</i> inner objects. A <b>deep copy</b> also duplicates the inner mutable objects, so the copies are fully independent.</p>`,
[[`Shallow copy`,`New top-level object; nested objects shared.`],[`Deep copy`,`Nested mutable objects copied too.`],[`clone()`,`Object's built-in copy: shallow by default, skips constructors, awkward to use.`],[`Copy constructor`,`A constructor that takes another instance and copies it explicitly.`]],
[`Decide which fields are mutable (lists, arrays, Dates, your own mutable classes).`,`Copy each mutable field: new list, and copies of its elements if they're mutable too.`,`Immutable fields (String, Integer, LocalDate, records of immutables) can be shared safely.`,`For object graphs with cycles, track already-copied objects to avoid infinite recursion.`],
[`Prefer copy constructors or static factories (<code>Order.copyOf(o)</code>) over Cloneable.`,`The best fix is often immutability: if nothing can change, sharing is safe.`],
[`Assuming <code>new ArrayList&lt;&gt;(other)</code> is a deep copy: it copies references to the same elements.`,`Using clone() on classes with mutable fields without overriding it.`]),
  quiz: [
    [`<code>Order copy = original.clone()</code> with the default shallow <code>clone()</code>. Then <code>copy.getItems().add(x)</code>. What happens to <code>original</code>?`,[`Nothing: clone() copies nested collections too`,`original.getItems() also contains x, because the list is shared`,`copy.getItems() is null, because clone skips reference fields`,`clone() throws CloneNotSupportedException for collections`],1,`A shallow copy duplicates the top-level object but shares nested mutable objects.`,'E'],
    [`What's the usual recommendation instead of <code>Cloneable</code>?`,[`A copy constructor or static factory that copies each field explicitly`,`Serialize and deserialize, which is the fastest deep copy`,`Implement Cloneable; super.clone() deep-copies by default`,`BeanUtils.copyProperties, which deep-copies collections`],0,`clone() skips constructors, is shallow and has an awkward contract. A copy constructor is explicit and type-safe.`,'M'],
    [`A copy constructor does <code>this.items = new ArrayList&lt;&gt;(other.items);</code>, and <code>Item</code> is mutable. Is the copy deep?`,[`Yes: new ArrayList copies every element it's given`,`Yes, because the items field is declared final`,`No: the list is new, but the Item objects are shared`,`Only if Item implements Cloneable`],2,`new ArrayList(other) copies references. For a deep copy, copy each Item too (or make Item immutable).`,'H'],
    [`A shallow copy duplicates...`,[`Everything, recursively, down to the primitives`,`Only the top-level object; nested objects are shared`,`Nothing: it returns the same reference`,`Only the primitive fields; references become null`],1,`Deep copies duplicate nested mutable objects too.`,'E'],
    [`Why can immutable fields be shared between a copy and the original?`,[`Immutable fields are static, so they're shared anyway`,`They can't change, so sharing has no side effects`,`The GC makes copies of them when needed`,`They're stored on the stack, not the heap`],1,`Strings, LocalDate, records of immutables.`,'E'],
    [`What does <code>Object.clone()</code> do by default?`,[`A deep copy that calls each class's constructor`,`Shallow field-by-field copy without calling constructors`,`Serializes the object and reads it back`,`Nothing, unless you override it`],1,`And requires implementing Cloneable.`,'M'],
    [`Calling clone() on a class that doesn't implement Cloneable throws?`,[`NullPointerException`,`CloneNotSupportedException`,`ClassCastException`,`Nothing`],1,`Cloneable is a marker interface.`,'M'],
    [`<code>int[] b = a.clone();</code> for an int array. Is it independent of a?`,[`No: array clones always share their storage`,`Yes: primitive arrays copy their values`,`Only the first element is copied over`,`It throws CloneNotSupportedException`],1,`For object arrays it's still shallow (elements shared).`,'M'],
  ],
  quizAdv: [
    [`Which fields can a copy safely share with the original?`,[`Immutable ones: String, Integer, LocalDate`,`Primitive arrays, since they hold no references`,`java.util.Date, since it's a value type`,`Any final field, whatever its type`],0,`Immutable objects can't change, so sharing them is safe. Arrays and Date are mutable.`,'M'],
    [`Deep-copying a graph with a cycle (A → B → A) by naive recursion?`,[`It works, copying each object exactly once`,`It copies A twice, but then terminates`,`ConcurrentModificationException midway`,`Infinite recursion, unless copies are tracked`],3,`Keep an IdentityHashMap from originals to copies.`,'H'],
    [`Why is a copy constructor often preferred to clone()?`,[`It's always faster than clone()`,`It's explicit, type-safe and works with final fields`,`clone() was removed in recent Java versions`,`It deep-copies every field automatically`],1,`Effective Java recommends it.`,'M'],
    [`Records of immutable components: do they need deep copying?`,[`Yes, every record must be deep-copied`,`No: they can be shared safely`,`Only when equals is overridden`,`Only before being serialized`],1,`Immutability removes the need to copy.`,'H'],
  ],
});
