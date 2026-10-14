/* 1.8 String pool, == vs equals, StringBuilder */
topic('1', { no:'1.8', title:'String pool, == vs equals, StringBuilder', idea:`Which strings share one pooled object, which are new, why compile-time constants fold, and why <code>+=</code> in a loop is O(n²).`,
actors:'Variables', stateTitle:'Heap', dgTitle:'Variables → String objects',
vb:'0 0 460 240',
nodes:{a:{x:50,y:30,label:'a',kind:'mem',w:50,h:30}, b:{x:50,y:75,label:'b',kind:'mem',w:50,h:30}, d:{x:50,y:120,label:'d',kind:'mem',w:50,h:30}, c:{x:50,y:170,label:'c',kind:'mem',w:50,h:30}, e:{x:50,y:215,label:'e',kind:'mem',w:50,h:30},
  pool:{x:320,y:75,label:'"hi"  (String pool)',w:190,h:40}, c1:{x:320,y:170,label:'"hi"  new String',w:190,h:34}, e1:{x:320,y:215,label:'"hi"  runtime concat',w:190,h:34}},
codes:{a:`String a = "hi";                 // literal -> pool
String b = "hi";                 // same pooled object
String c = new String("hi");     // new heap object
String d = "h" + "i";            // compile-time constant -> "hi"
String h = "h";
String e = h + "i";              // runtime concat -> new object
System.out.println(a == b);      // true
System.out.println(a == c);      // false
System.out.println(a == d);      // true
System.out.println(a == e);      // false
System.out.println(a == c.intern());  // true
System.out.println(a.equals(c)); // true`,
b:`String s = "";
for (int i = 0; i < 5; i++) s += i;      // new String every time
StringBuilder sb = new StringBuilder();  // capacity 16
for (int i = 0; i < 5; i++) sb.append(i);
String r = sb.toString();                // one final copy`},
steps:[
{cv:'a', hl:{main:[1,2]}, d:{type:'graph',hide:['d','c','e','c1','e1'],e:[['a','pool','','hot'],['b','pool','','hot']]},
 say:`String literals are <b>interned</b>: the JVM keeps one copy of each in the <b>String pool</b> (a hash table on the heap since Java 7). a and b point to the <b>same</b> object.`},
{hl:{main:[3]}, d:{type:'graph',hide:['d','e','e1'],e:[['a','pool',''],['b','pool',''],['c','c1','new','hot']]},
 say:`<code>new String("hi")</code> always creates a <b>new</b> object (its char data may be shared with the pooled one). Almost never write this.`},
{hl:{main:[4]}, d:{type:'graph',hide:['e','e1'],e:[['a','pool',''],['b','pool',''],['d','pool','folded','hot'],['c','c1','']]},
 say:`<code>"h" + "i"</code> is a <b>compile-time constant expression</b>: javac folds it into the literal <code>"hi"</code>, so it's pooled. The same applies to <code>final String h = "h"; h + "i"</code>, because h is a constant variable.`},
{hl:{main:[5,6]}, d:{type:'graph',e:[['a','pool',''],['b','pool',''],['d','pool',''],['c','c1',''],['e','e1','new','hot']]},
 say:`<code>h</code> is not final, so <code>h + "i"</code> is computed <b>at run time</b> (via <code>StringConcatFactory</code> since Java 9). That produces a <b>new</b> String, not pooled.`},
{hl:{main:[7,8,9,10,11,12]}, log:['true','false','true','false','true','true'],
 say:`<code>==</code> compares references, <code>equals</code> compares characters. <code>intern()</code> returns the pooled copy (adding it if absent). Interning by hand is rarely worth it; G1's <code>-XX:+UseStringDeduplication</code> dedups char arrays automatically.`},
{d:null, g:[G('Why String is immutable',['pooling','safe to share one object','ok'],['hashCode cached','fast HashMap keys','ok'],['thread-safe','no sync needed','ok'],['security','path/URL can\'t change after a check','ok']), G('Java 9 compact strings',['storage','byte[] + coder (LATIN1 or UTF16)'],['effect','ASCII text uses 1 byte/char','ok']), G('Passwords',['use char[]','wipe with Arrays.fill','ok'],['String','stays in memory until GC; may be pooled','bad'])],
 say:`Interview reasons for immutability. Also: a String's <code>hashCode</code> is computed once and stored in the object, which is part of why Strings make great map keys.`},
{cv:'b', hl:{main:[1,2]}, g:[G('s += i in a loop',C('objects',['""','"0"','"01"','"012"','"0123"',['"01234"','hot']]),['chars copied','1+2+3+4+5 = 15 → O(n²)','bad'])],
 say:`Each <code>s += i</code> builds a <b>brand-new</b> String and copies all previous characters into it. For n iterations that's 1+2+…+n = <b>O(n²)</b> character copies plus n garbage objects. (javac optimises a single <code>a + b + c</code> expression, but not across loop iterations.)`},
{hl:{main:[3,4,5]}, g:[G('StringBuilder',['buffer','[0,1,2,3,4, _, _, …] capacity 16','ok'],['when full','grow to (old × 2) + 2, copy once'],['total work','amortised O(n)','ok'],['toString()','one final copy'])],
 say:`<b>StringBuilder</b> appends into one growable buffer: amortised O(1) per append, O(n) total. <code>StringBuffer</code> is the same but every method is <code>synchronized</code>, which is legacy and rarely needed. Pre-size with <code>new StringBuilder(expectedLen)</code> for big outputs.`}
],
keep:[`Literals and compile-time constants are pooled; new String and runtime concat aren't.`,`== compares references; equals compares content; intern() returns the pooled copy.`,`+= in a loop is O(n²) → StringBuilder. String immutable for pooling, hashing, safety.`]}, {
  imp: 'must',
  theory: TH(`Strings are immutable objects; identical literals are shared through a pool, and == compares references, not text.`,
`<p>A <code>String</code> can never change after it's created. Methods like <code>toUpperCase()</code> return a <b>new</b> String. Because of that, the JVM can safely share one copy of each literal: <code>"hello"</code> written in ten places points to the same object in the <b>String pool</b>.</p>
<p>That's why <code>==</code> sometimes "works" for strings (two literals are the same pooled object) and sometimes doesn't (a string built at run time is a new object). Always compare text with <code>equals</code>.</p>`,
[[`Immutable`,`Its contents can't change once created.`],[`String pool`,`A JVM-wide table of shared string instances for literals and interned strings.`],[`intern()`,`Returns the pooled copy of a string, adding it if needed.`],[`StringBuilder`,`A mutable buffer for building strings efficiently.`]],
[`Literals and compile-time constants (<code>"a" + "b"</code>, final constants) are put in the pool.`,`Strings built at run time (<code>s + t</code>, <code>new String</code>, reading input) are new heap objects.`,`<code>s1 == s2</code> is true only if both point to the same object; <code>equals</code> compares characters.`,`Each <code>+=</code> creates a whole new String, copying the old contents.`],
[`Build strings in loops with <code>StringBuilder</code>.`,`Immutability makes Strings safe as HashMap keys and safe to share between threads.`,`Use <code>String.join</code>, <code>formatted()</code> or text blocks for readability.`],
[`Comparing user input with == to a literal.`,`<code>s += x</code> inside a large loop: O(n²) copying.`]),
  quiz: [
    [`Building a 100,000-line report with <code>s += line</code> in a loop is slow. Why?`,[`String concatenation is synchronized, so it contends`,`Each new String is interned, and the pool keeps resizing`,`Each += creates a new String and copies everything so far: O(n²)`,`Loops that concatenate strings can't be JIT-compiled`],2,`Strings are immutable, so every concatenation copies the whole result. Use one StringBuilder.`,'E'],
    [`Which is NOT a reason String is immutable?`,[`Pooled literals can be shared safely`,`Its hash code can be cached for HashMap keys`,`A validated path or class name can't change after the check`,`So that == can safely compare content`],3,`== always compares references for objects. Immutability enables pooling, hash caching and security, not content comparison with ==.`,'M'],
    [`<pre>final String a = "ja";
String b = "ja";
System.out.println((a + "va" == "java") + " " + (b + "va" == "java"));</pre>`,[`true false`,`false false`,`true true`,`false true`],0,`a is a compile-time constant, so a + "va" is folded into the pooled literal "java". b isn't final, so b + "va" is built at run time as a new String.`,'H'],
    [`Which is the right way to check two Strings have the same text?`,[`s1 == s2`,`s1.equals(s2)`,`s1.hashCode() == s2.hashCode()`,`s1.compareTo(s2) == 1`],1,`equals compares characters.`,'E'],
    [`What does <code>s.toUpperCase()</code> do to s?`,[`Changes s in place to upper case`,`Returns a new String; s is unchanged`,`Throws if s has no lower-case letters`,`Interns s and returns the pooled copy`],1,`Strings are immutable.`,'E'],
    [`Safest way to compare a variable with a literal when the variable may be null?`,[`input.equals("yes")`,`"yes".equals(input)`,`input == "yes"`,`input.compareTo("yes")`],1,`The literal is never null. Objects.equals also works.`,'M'],
    [`<code>"a,b,,c".split(",")</code> returns how many elements?`,[`3`,`4`,`5`,`2`],1,`[a, b, "", c]; trailing empty strings would be removed, middle ones aren't.`,'H'],
    [`Why is StringBuilder preferred over String concatenation in a loop?`,[`StringBuilder is synchronized, so it's safer`,`It appends into one buffer instead of recopying`,`It uses less CPU per character in every case`,`It's immutable, so the JIT can optimise it`],1,`StringBuffer is the old synchronized version.`,'E'],
  ],
  quizAdv: [
    [`<code>String s = new String("hi");</code> What are <code>s.intern() == "hi"</code> and <code>s == "hi"</code>?`,[`true and true`,`true and false`,`false and false`,`false and true`],1,`intern() returns the pooled copy; s itself is a separate heap object.`,'M'],
    [`Since Java 9, how is <code>a + b + c</code> on Strings compiled?`,[`One StringBuilder, reused across loop iterations`,`A chain of String.concat calls`,`An invokedynamic call to StringConcatFactory`,`Folded into a constant at compile time`],2,`It's efficient for one expression, but a loop still builds a new String per iteration.`,'H'],
    [`Since Java 9, how are Strings stored internally for Latin-1 text?`,[`UTF-16, two bytes per char, always`,`One byte per char (compact strings)`,`UTF-8, variable length per char`,`char arrays, one char per element`],1,`Compact Strings halve memory for Latin-1 content.`,'H'],
    [`<code>String s = "hi"; String t = s + "";</code> Is <code>s == t</code>?`,[`true: adding an empty string changes nothing`,`false: it's built at run time, a new String`,`Compile error: can't add an empty literal`,`It depends on when the GC last ran`],1,`Only constant expressions are folded into the pool.`,'H'],
  ],
});
