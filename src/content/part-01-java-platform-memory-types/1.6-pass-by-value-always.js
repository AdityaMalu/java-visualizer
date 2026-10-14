/* 1.6 Pass-by-value (always) */
topic('1', { no:'1.6', title:'Pass-by-value (always)', idea:`The parameter gets a copy of the caller's value. For objects that value is a reference: you can mutate the object, but you can't re-point the caller's variable.`,
actors:'Frames', stateTitle:'Values', dgTitle:'References (arrows) and objects',
vb:'0 0 460 220',
nodes:{car:{x:70,y:60,label:'car\n(caller)',kind:'mem',w:100,h:46}, c:{x:70,y:170,label:'c\n(parameter)',kind:'mem',w:100,h:46}, o1:{x:330,y:60,label:'Car@1\nprice = 1',w:130,h:46}, o2:{x:330,y:170,label:'Car@2\nprice = 0',w:130,h:46}},
codes:{a:`void change(Car c) {
  c.price = 5;          // follows the copied arrow: same object
  c = new Car();        // re-points the COPY only
  c.price = 9;
}
Car car = new Car();    // price = 1
change(car);
System.out.println(car.price);   // 5

void swap(Car a, Car b) { Car t = a; a = b; b = t; }  // swaps copies
void bump(int x) { x++; }                             // copy of 1`},
steps:[
{hl:{caller:[6]}, th:[['caller','RUN','car = new Car()']], d:{type:'graph',hide:['c','o2'],e:[['car','o1','','hot']]},
 g:[G('caller frame',['car','→ Car@1 (address 0x1a)'])],
 say:`<code>car</code> doesn't <i>contain</i> the object. It contains a <b>reference</b> (think: address 0x1a) to Car@1 on the heap.`},
{hl:{caller:[7],change:[1]}, th:[['caller','WAITING','in change(car)'],['change','RUN','c = copy of 0x1a']], d:{type:'graph',hide:['o2'],e:[['car','o1','',''],['c','o1','copy','hot']]},
 g:[G('caller frame',['car','0x1a']), G('change frame',['c','0x1a (a COPY)','hot'])],
 say:`Calling <code>change(car)</code> <b>copies the value</b> 0x1a into parameter <code>c</code>. There are now two arrows to one object. This is pass-by-value; the value just happens to be a reference.`},
{hl:{change:[2]}, d:{type:'graph',hide:['o2'],labels:{o1:'Car@1\nprice = 5'},on:['o1'],e:[['car','o1','',''],['c','o1','c.price = 5','hot']]},
 say:`<code>c.price = 5</code> follows the arrow and modifies the <b>shared object</b>. The caller will see 5.`},
{hl:{change:[3]}, d:{type:'graph',labels:{o1:'Car@1\nprice = 5'},e:[['car','o1','','ok'],['c','o2','re-pointed','hot']]},
 g:[G('caller frame',['car','0x1a (unchanged)','ok']), G('change frame',['c','0x2b','hot'])],
 say:`<code>c = new Car()</code> overwrites the <b>local copy</b>. The caller's <code>car</code> still holds 0x1a. If Java were pass-by-reference, this line would change the caller's variable; it doesn't.`},
{hl:{change:[4]}, d:{type:'graph',labels:{o1:'Car@1\nprice = 5',o2:'Car@2\nprice = 9'},on:['o2'],e:[['car','o1','','ok'],['c','o2','c.price = 9','hot']]},
 say:`This changes Car@2, which nobody outside the method can see. It becomes garbage when <code>change</code> returns.`},
{hl:{caller:[8]}, th:[['caller','RUN','prints 5'],['change','TERM','returned']], d:{type:'graph',hide:['c'],labels:{o1:'Car@1\nprice = 5',o2:'Car@2 (garbage)'},dim:['o2'],e:[['car','o1','','ok']]}, log:['5'],
 say:`Output <b>5</b>: the mutation through the shared object was visible; the reassignment wasn't.`},
{hl:{caller:[10,11]}, d:null, g:[G('swap(x, y)',['inside','a, b copies swapped'],['caller x, y','unchanged','bad']), G('bump(n)',['inside','x = 2'],['caller n','still 1','bad'])],
 say:`That's why a <code>swap(a, b)</code> method can't work in Java, and why <code>bump(int)</code> can't change the caller's int. To "return two things", return a record, or mutate a holder object. <b>Say it:</b> "Java is always pass-by-value. For objects, the value is the reference, so you can mutate the object but not reassign the caller's variable."`}
],
keep:[`Always pass-by-value; object variables hold references.`,`Mutating through the parameter is visible; reassigning the parameter is not.`,`No swap(a,b) in Java; return a result object instead.`]}, {
  imp: 'must',
  theory: TH(`Java always passes a copy of the variable's value into a method; for objects that value is a reference, so the method can change the object but not the caller's variable.`,
`<p>When you call <code>m(x)</code>, Java copies whatever is in <code>x</code> into the parameter. For an <code>int</code> that's the number. For an object, the variable doesn't hold the object itself; it holds a <b>reference</b> (an address), so the address is copied.</p>
<p>Analogy: I give you a <b>photocopy of my house's address</b>. You can go to the house and repaint it (I'll see the new colour), but if you scribble a different address on your copy, my copy doesn't change.</p>`,
[[`Pass-by-value`,`The callee receives a copy of the argument's value.`],[`Reference`,`The value stored in an object variable: it says where the object is.`],[`Mutation`,`Changing the object's fields through a reference; visible to everyone holding that reference.`],[`Reassignment`,`Pointing a variable at a different object; only affects that variable.`]],
[`Caller has <code>Car car</code> → object A.`,`Calling <code>m(car)</code> copies the reference: parameter <code>c</code> also → A.`,`<code>c.name = "x"</code> changes A, which the caller sees.`,`<code>c = new Car()</code> points only <code>c</code> at a new object B; the caller still sees A.`],
[`Methods that need to "return two things" should return a small result object or record.`,`Defensive copies: if a method stores a list you pass in, it may want to copy it so your later changes don't affect it.`],
[`Saying "objects are passed by reference" in an interview: the precise answer is "references are passed by value".`,`Expecting a <code>swap(a, b)</code> method to swap the caller's variables.`]),
  quiz: [
    [`<pre>void reset(Car c) { c = new Car("Blank"); }
Car car = new Car("Tesla"); reset(car);
System.out.println(car.name);</pre>What prints?`,[`Blank, because objects are passed by reference`,`Tesla`,`null, because reset releases the old reference`,`Nothing: parameters are implicitly final, so it won't compile`],1,`The reference is copied. Reassigning the parameter changes only the copy; the caller's variable still points to Tesla.`,'E'],
    [`<pre>void rename(Car c) { c.name = "Blank"; }
Car car = new Car("Tesla"); rename(car);</pre>What is <code>car.name</code> now?`,[`Blank`,`Tesla, because Java passes a copy of the object`,`Tesla, because String fields are immutable`,`null, because the parameter's changes are discarded`],0,`Both references point to the same object, so mutating it through the parameter is visible to the caller.`,'E'],
    [`Which statement is correct?`,[`Primitives are passed by value; objects are passed by reference`,`Objects are passed by reference, except Strings, which are copied`,`Java is always pass-by-value; for objects, the value copied is the reference`,`Arrays are passed by reference; everything else is passed by value`],2,`There's no pass-by-reference in Java, which is why a swap(a, b) method can't change the caller's variables.`,'M'],
    [`<pre>void inc(int n) { n++; }
int x = 1; inc(x);</pre>What is x?`,[`2`,`1`,`0`,`Compile error`],1,`The int value is copied.`,'E'],
    [`<pre>void clear(List&lt;String&gt; l) { l.clear(); }</pre>Called with a list of 3 items. Afterwards the caller's list has?`,[`3 items`,`0 items`,`null`,`It throws`],1,`Same object, mutated through the copied reference.`,'E'],
    [`<pre>void reset(String s) { s = "new"; }
String t = "old"; reset(t);</pre>What is t?`,[`"new"`,`"old"`,`null`,`""`],1,`Reassigning the parameter doesn't affect the caller, and Strings are immutable anyway.`,'M'],
    [`How can a method give back two values to its caller?`,[`Use two return statements in a row`,`Return a small result object or record`,`Swap the values into the caller's variables`,`Pass the variables by reference`],1,`e.g. record MinMax(int min, int max).`,'M'],
    [`<pre>void grow(StringBuilder sb) { sb.append("!"); sb = new StringBuilder("x"); }
StringBuilder b = new StringBuilder("hi"); grow(b);</pre>What is b?`,[`hi`,`hi!`,`x`,`x!`],1,`The append mutates the shared object; the reassignment is local.`,'H'],
  ],
  quizAdv: [
    [`<pre>void grow(int[] a) { a = Arrays.copyOf(a, 10); a[0] = 99; }
int[] x = {1}; grow(x);</pre>What is <code>x[0]</code>?`,[`99`,`1`,`0`,`ArrayIndexOutOfBoundsException`],1,`copyOf creates a new array; reassigning the parameter doesn't touch the caller's array.`,'M'],
    [`<pre>void add(List&lt;String&gt; l) { l.add("x"); l = new ArrayList&lt;&gt;(); l.add("y"); }</pre>The caller's empty list afterwards?`,[`[y]`,`[x, y]`,`[x]`,`[]`],2,`The first add goes through the shared reference; after reassignment, l points to a different list.`,'M'],
    [`Why can't you write a general <code>swap(Integer a, Integer b)</code> that swaps the caller's variables?`,[`Integer objects are final, so they can't move`,`Parameters hold copies of the caller's references`,`Generics forbid swapping wrapper types`,`It works fine with a simple temp variable`],1,`Swap elements inside an array or object instead.`,'M'],
    [`An array is passed to a method that does <code>arr[0] = 9;</code>. Does the caller see it?`,[`Yes: the method gets a copy of the reference`,`No: arrays are copied when passed in`,`Only for int arrays, not object arrays`,`Only if the parameter is declared final`],0,`Same rule as any object.`,'M'],
  ],
});
