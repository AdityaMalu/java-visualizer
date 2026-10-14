/* 3.4 Inheritance vs composition */
topic('3', { no:'3.4', title:'Inheritance vs composition', idea:`The classic fragile-base-class bug: a counting HashSet counts 6 instead of 3. Then the composition version, and why composition stops a class explosion.`,
actors:'Call stack', stateTitle:'Counter',
codes:{a:`class CountingSet<E> extends HashSet<E> {
  int added = 0;
  @Override public boolean add(E e) { added++; return super.add(e); }
  @Override public boolean addAll(Collection<? extends E> c) {
    added += c.size();
    return super.addAll(c);    // HashSet's addAll calls add() per element!
  }
}
CountingSet<String> s = new CountingSet<>();
s.addAll(List.of("a", "b", "c"));
System.out.println(s.added);   // 6, not 3 ✘`,
b:`class CountingSet<E> implements Set<E> {   // or extend a ForwardingSet
  private final Set<E> inner;              // HAS-A
  int added = 0;
  CountingSet(Set<E> inner) { this.inner = inner; }
  public boolean add(E e) { added++; return inner.add(e); }
  public boolean addAll(Collection<? extends E> c) {
    added += c.size();
    return inner.addAll(c);  // inner's add() is NOT our add()
  }
  // ... other Set methods simply forward to inner
}`,
c:`class Notifier {
  private final Channel channel;     // Sms | Email | Push
  private final RetryPolicy retry;   // Fixed | Exponential
  Notifier(Channel c, RetryPolicy r) { channel = c; retry = r; }
  void send(Message m) { retry.run(() -> channel.deliver(m)); }
}
new Notifier(new Sms(), new Exponential(3));    // any combination`},
steps:[
{cv:'a', hl:{s:[10,4,5]}, th:[['CountingSet.addAll','RUN:ok','added += 3']], g:[G('s',['added','3','hot'])],
 say:`We extend HashSet to count insertions. <code>addAll</code> adds the collection's size (3), then delegates to <code>super.addAll</code>.`},
{hl:{s:[6]}, th:[['CountingSet.addAll','WAITING:warn',''],['AbstractCollection.addAll','RUN:ok','for (e : c) add(e)']],
 say:`Here's the hidden detail. <code>HashSet.addAll</code> (inherited from AbstractCollection) is implemented by calling <b><code>add(e)</code> for each element</b>, and <code>add</code> is virtual…`},
{hl:{s:[3]}, th:[['CountingSet.addAll','WAITING:warn',''],['AbstractCollection.addAll','WAITING:warn',''],['CountingSet.add','RUN:bad','added++ (×3)']], g:[G('s',['added','4 → 5 → 6','bad'])],
 say:`…so it dispatches back to <b>our</b> overridden <code>add</code>, which counts every element again.`},
{hl:{s:[11]}, th:[], g:[G('s',['added','6 (expected 3)','bad'],['root cause','we depended on the parent\'s INTERNAL self-calls','bad'])], log:['6 ✘'],
 say:`Result: <b>6</b>. This is the <b>fragile base class</b> problem (Effective Java, item 18). The subclass's correctness depends on undocumented implementation details of the parent. A JDK update that changed <code>addAll</code> to not call <code>add</code> would "fix" it, and then a different override would break.`},
{cv:'b', hl:{s:[6,7,8]}, th:[['CountingSet.addAll','RUN:ok','added += 3'],['inner (HashSet).addAll','RUN:ok','calls ITS OWN add()']], g:[G('s',['added','3','ok'])], log:['3 ✔'],
 say:`<b>Composition</b>: hold a Set and <b>forward</b> to it. The inner set's self-calls stay inside the inner set and never reach our methods. It's robust to changes in HashSet, works with <b>any</b> Set implementation (TreeSet, a concurrent set), and is easy to test. This wrapper is also exactly the Decorator pattern (3.7g).`},
{cv:'c', hl:{s:[1,2,3,4,5,7]}, th:[], g:[G('Inheritance: one class per combination',C('',['SmsFixed','SmsExpo','EmailFixed','EmailExpo','PushFixed','PushExpo']),['add a channel','+2 classes','bad']), G('Composition: parts combine',C('Channel',['Sms','Email','Push']),C('RetryPolicy',['Fixed','Exponential']),['add a channel','+1 class','ok'],['swap at run time','yes','ok'])],
 say:`Inheritance across <b>two independent dimensions</b> multiplies classes (3 × 2 = 6, growing fast). Composition adds them (3 + 2), allows run-time choices, and makes each part mockable. <b>Say it:</b> "Prefer composition. Inheritance couples the child to the parent's internals and Java allows only one superclass. I use inheritance only for a true is-a that passes Liskov (3.6)."`},
{th:[], g:[G('Relationships',['Association  Dealer — Auction','know/use each other'],['Aggregation  Showroom ◇— Car','has-a; Car lives on without the Showroom'],['Composition  Car ◆— Engine','has-a; Engine\'s lifetime is owned by the Car']), G('No multiple class inheritance',['why','diamond: which parent\'s hello()?'],['interfaces','allowed; default-method conflicts must be resolved (3.5)'])],
 say:`UML vocabulary interviewers sometimes check: association (uses), aggregation (has, but shared or independent lifetime), composition (owns the lifetime). Java has no multiple <b>class</b> inheritance because of the diamond problem; interfaces with default methods have explicit conflict rules instead.`}
],
keep:[`Fragile base class: overriding add() + addAll() double counts via the parent's self-calls.`,`Composition + forwarding is robust, flexible, testable.`,`Independent dimensions → compose (3+2), don't inherit (3×2).`]}, {
  imp: 'must',
  theory: TH(`Inheritance ("is-a") reuses a parent's code but couples you to its internals; composition ("has-a") builds behaviour by holding other objects, and is usually more flexible.`,
`<p>Inheritance looks like free reuse: extend <code>HashSet</code>, override <code>add</code>, done. But your subclass now depends on <i>how</i> the parent works internally, like which of its methods call which. If HashSet's <code>addAll</code> internally calls <code>add</code>, your counting is doubled. This is the <b>fragile base class</b> problem.</p>
<p>With <b>composition</b> your class <i>has</i> a Set field and forwards calls to it, adding its own behaviour around them. It depends only on the Set's public contract, and the inner object can be swapped, even for a fake in tests.</p>`,
[[`is-a`,`Inheritance relationship (Car is a Vehicle).`],[`has-a`,`Composition relationship (Car has an Engine).`],[`Forwarding`,`Passing a call on to a wrapped object.`],[`Fragile base class`,`Changes in a parent's internals breaking subclasses.`]],
[`Ask "is it truly a subtype that can be used anywhere the parent is?" If not, compose.`,`Hold the collaborator in a private final field, injected through the constructor.`,`Implement the same interface and forward calls, adding behaviour where needed.`],
[`Spring services are composition: a service holds repositories and clients, injected by constructor.`,`Use inheritance for genuine type hierarchies and frameworks designed for it (with documented hooks).`],
[`Extending a concrete library class to tweak one method.`,`Creating a subclass for every combination of features (class explosion); compose features instead.`]),
  quiz: [
    [`What's the composition-based fix for the counting HashSet?`,[`Mark add() final in CountingSet so it can't be called twice`,`Call super.addAll inside a synchronized block`,`Wrap a Set field and forward calls, counting in your own add/addAll`,`Keep the count in a static field shared by every instance`],2,`A forwarding wrapper doesn't depend on the inner class's self-calls.`,'E'],
    [`<code>CountingSet extends HashSet</code> overrides add() and addAll() to count. addAll of 3 items reports 6. Why?`,[`HashSet.addAll calls add() internally, so each item counts twice`,`addAll also counts the duplicates that HashSet rejects`,`There's a race between add and addAll on the counter field`,`super.addAll returns how many were already in the set`],0,`The fragile base class problem: you depend on the parent's self-use, which isn't part of its contract.`,'M'],
    [`Your subclass of a JDK class works today. Why is that still risky?`,[`JDK classes are made final in later versions, breaking subclasses`,`Inheritance stops the JIT from inlining the parent's methods`,`Subclasses of JDK collection classes can't be serialised`,`A new version may change which methods call which, breaking overrides`],3,`Self-use is an implementation detail. Composition depends only on the public contract.`,'H'],
    [`"has-a" relationships are modelled with?`,[`Inheritance`,`Composition (a field)`,`Interfaces only`,`Static methods`],1,`Car has an Engine.`,'E'],
    [`What is a forwarding (wrapper) class?`,[`A subclass that adds behaviour`,`Holds an object and delegates to it`,`An abstract base class`,`Only a JDK dynamic proxy`],1,`The basis of decorators.`,'E'],
    [`Why does composition make testing easier?`,[`Composed code runs faster`,`Collaborators can be swapped for fakes`,`It removes the need for interfaces`,`Tests no longer need any setup`],1,`You can't swap a superclass in a test.`,'M'],
    [`When is inheritance still appropriate?`,[`Whenever it lets you reuse code`,`For true is-a subtypes, or classes made for it`,`Always, it's the main OOP tool`,`Never, composition is always better`],1,`Effective Java: design for inheritance or prohibit it.`,'M'],
    [`Why make classes <code>final</code> by default in some codebases?`,[`It makes method calls faster`,`Stops fragile subclassing`,`Spring requires final classes`,`It saves memory per object`],1,`Note: Spring proxies need non-final classes for CGLIB.`,'H'],
  ],
  quizAdv: [
    [`3 vehicle types × 2 engine types. Inheritance needs 6 classes. Composition needs?`,[`6, one per combination`,`9, with abstract bases`,`1, with flags`,`5: vehicles hold an Engine`],3,`Independent dimensions compose (3 + 2) instead of multiplying (3 × 2).`,'M'],
    [`Besides robustness, why is composition easier to test?`,[`Composed classes don't need tests`,`The dependency can be swapped for a fake`,`Composition removes the need for mocks`,`Composed classes run faster under test`],1,`You can't swap a superclass in a test.`,'M'],
    [`What's the "self-use" problem when extending a class?`,[`Infinite recursion in overridden methods`,`Parent internals call your overrides unexpectedly`,`Static method calls being hidden`,`Memory leaks through subclasses`],1,`The HashSet addAll example.`,'M'],
    [`Default methods in interfaces vs abstract base classes for sharing code?`,[`They're identical in every way`,`Defaults: no state, many; base: state, one`,`Default methods can hold fields`,`Abstract classes are deprecated`],1,`Trade-off between state and multiple inheritance.`,'H'],
  ],
});
