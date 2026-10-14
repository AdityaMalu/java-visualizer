/* 0.6 Classes, objects and constructors */
topic('0', { no:'0.6', title:'Classes, objects and constructors', imp:'good', idea:`A class is a blueprint; <code>new</code> builds objects from it. Follow two accounts being created, a deposit, and two variables pointing at the same object.`,
actors:'Thread', stateTitle:'Heap',
codes:{a:`public class Account {
  private final String owner;          // fields: the object's data
  private long balance;

  public Account(String owner) {       // constructor: sets up a new object
    this.owner = owner;                // this = the object being built
  }
  public void deposit(long amount) {   // method: behaviour
    if (amount <= 0) throw new IllegalArgumentException("amount");
    balance += amount;
  }
  public long balance() { return balance; }
}

Account a = new Account("Ana");
Account b = new Account("Raj");
a.deposit(500);
Account c = a;                         // a and c: the same object
c.deposit(100);
// a.balance() → 600, b.balance() → 0, a == c → true, a == b → false`},
steps:[
{hl:{main:[1,2,3]}, th:[], g:[G('class Account (blueprint)',['fields','owner, balance'],['constructor','Account(String owner)'],['methods','deposit, balance'])],
 say:`A <b>class</b> describes a kind of thing: what data each one has (<b>fields</b>) and what it can do (<b>methods</b>). It's a blueprint. No account exists yet.`},
{hl:{main:[15,5,6]}, g:[G('Account #1 (a)',['owner','"Ana"','hot'],['balance','0'])],
 say:`<code>new Account("Ana")</code> allocates an <b>object</b> on the heap, sets fields to defaults (balance = 0), then runs the <b>constructor</b>. Inside it, <code>this</code> means "the object being built", so <code>this.owner = owner</code> copies the parameter into the field.`},
{hl:{main:[16]}, g:[G('Account #1 (a)',['owner','"Ana"'],['balance','0']), G('Account #2 (b)',['owner','"Raj"','hot'],['balance','0'])],
 say:`A second <code>new</code> creates a second, completely separate object. Each object has its own copy of every (non-static) field.`},
{hl:{main:[17,8,9,10]}, g:[G('Account #1 (a)',['owner','"Ana"'],['balance','500','hot']), G('Account #2 (b)',['owner','"Raj"'],['balance','0'])],
 say:`<code>a.deposit(500)</code> runs the method <b>on object #1</b>. The method checks the input first (rejecting amounts ≤ 0) and only then changes the balance. This is <b>encapsulation</b>: the field is private, so this method is the only way to change it, and it protects the rules.`},
{hl:{main:[18]}, g:[G('Account #1 (a, c)',['owner','"Ana"'],['balance','500']), G('Account #2 (b)',['owner','"Raj"'],['balance','0'])],
 say:`<code>Account c = a</code> doesn't copy the object. Variables of class types hold <b>references</b>, so now <code>a</code> and <code>c</code> point to the same account.`},
{hl:{main:[19,20]}, g:[G('Account #1 (a, c)',['owner','"Ana"'],['balance','600','hot']), G('Account #2 (b)',['owner','"Raj"'],['balance','0'])], log:['a.balance() = 600','a == c → true (same object)','a == b → false'],
 say:`Depositing through <code>c</code> changes the one object both names point to. <code>==</code> on objects asks "same object?", not "same contents?". For content equality, classes override <code>equals</code> (2.3).`},
{th:[], g:[G('Vocabulary',['class','blueprint'],['object / instance','one thing built from it'],['field','data each object holds'],['method','behaviour'],['constructor','runs once per new object'],['this','the current object'])],
 say:`If you write no constructor, Java provides an empty no-argument one. <code>final</code> fields must be set exactly once, in the constructor. Records (2.14) generate all this for simple data classes.`}
],
keep:[`Class = blueprint (fields + methods); new creates an object on the heap and runs the constructor.`,`Object variables hold references: assignment shares the object; == compares identity.`,`Private fields + public methods that check inputs = encapsulation.`]}, {
  imp: 'good',
  theory: TH(`A class is a blueprint that defines data (fields) and behaviour (methods); objects are individual things built from it with new, and constructors set them up.`,
`<p>Real programs model things: accounts, orders, cars. A <b>class</b> describes what every account has (owner, balance) and can do (deposit, withdraw). An <b>object</b> is one specific account. You can create as many as you like with <code>new</code>, and each has its own field values.</p>
<p>A <b>constructor</b> is special code that runs once when an object is created, to put it in a valid starting state. Making fields <code>private</code> and offering methods that check their inputs keeps objects valid: this is <b>encapsulation</b>.</p>`,
[[`Class`,`The definition: fields + constructors + methods.`],[`Object / instance`,`One thing created from a class.`],[`Field`,`A variable belonging to each object.`],[`Constructor`,`Initialises a new object; same name as the class, no return type.`],[`this`,`Reference to the current object.`],[`static`,`Belongs to the class itself, not to each object.`]],
[`<code>new Account("Ana")</code> allocates memory on the heap with default field values.`,`The constructor runs and sets the fields.`,`A reference to the object is returned and stored in a variable.`,`Calling <code>a.deposit(500)</code> runs the method with <code>this</code> = a.`],
[`Keep fields private; expose behaviour, not raw setters.`,`Validate in constructors and methods so an object can't get into an invalid state.`,`Use records for simple immutable data classes.`],
[`Thinking <code>b = a</code> copies an object (it copies the reference).`,`Comparing objects with == when you mean equals.`]),
  quiz: [
    [`What does a constructor do?`,[`Destroys an old object before reuse`,`Initialises a newly created object`,`Copies an existing object field by field`,`Compares two objects for equality`],1,`It runs once per new object to set its starting state.`,'E'],
    [`<code>Account a = new Account("Ana"); Account c = a; c.deposit(100);</code> Does a's balance change?`,[`Yes: a and c are the same object`,`No: c is a copy`,`Only if deposit is static`,`Compile error`],0,`Object variables hold references; assignment shares the object.`,'M'],
    [`Inside a constructor, what does <code>this.owner = owner</code> do?`,[`Compares the field to the parameter`,`Assigns the field to itself`,`Copies the parameter into the object's field`,`Creates a new object`],2,`this.owner is the field; owner alone is the parameter that shadows it.`,'M'],
    [`How do you create an object of class Car?`,[`Car c = Car();`,`Car c = new Car();`,`Car c = create Car;`,`new c = Car();`],1,`new allocates the object and runs a constructor.`,'E'],
    [`What is the default value of an object field of type String?`,[`""`,`null`,`"null"`,`It must be set, or compile error`],1,`Fields get default values; locals don't.`,'E'],
    [`A constructor has which return type?`,[`void, like any method returning nothing`,`The class type, since it builds an instance`,`None: constructors have no return type`,`Object, the parent of every class`],2,`Adding void turns it into an ordinary method.`,'M'],
    [`Why make fields <code>private</code> and expose methods instead?`,[`Private fields are faster for the JVM to access`,`So the class controls changes and keeps its data valid`,`Java forbids public fields on normal classes`,`Private fields take up less memory per object`],1,`That's encapsulation.`,'E'],
    [`<code>class A { int x; }</code> <code>A a1 = new A(); A a2 = new A(); a1.x = 5;</code> What is <code>a2.x</code>?`,[`5`,`0`,`null`,`Compile error`],1,`Each object has its own copy of instance fields.`,'M'],
  ],
  quizAdv: [
    [`You write a constructor <code>Account(String owner)</code>. Can you still call <code>new Account()</code>?`,[`No: the default constructor is only provided when you write none`,`Yes: Java always adds a no-arg constructor too`,`Yes, but every field of the new object is null`,`Only through reflection, never with new`],0,`Declaring any constructor removes the implicit no-arg one.`,'H'],
    [`A <code>static</code> field <code>count</code> is incremented in the constructor. After 3 objects, what is count?`,[`1 in each object`,`0`,`3, shared by the class`,`Compile error`],2,`Static fields have one copy for the whole class.`,'M'],
    [`What does <code>this(...)</code> as the first line of a constructor do?`,[`Calls the parent class's constructor`,`Calls another constructor of the same class`,`Creates a copy of the current object`,`Returns this to the caller of new`],1,`Constructor chaining avoids duplicated setup.`,'M'],
    [`A local variable is declared but never assigned, then printed. Result?`,[`It prints 0, the default for an int`,`It prints null, the default for references`,`Compile error: might not have been initialized`,`It throws an exception when printed`],2,`Unlike fields, locals have no default value.`,'H'],
  ],
});
