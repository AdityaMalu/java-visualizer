/* 0.7 Packages, imports and access modifiers */
topic('0', { no:'0.7', title:'Packages, imports and access modifiers', imp:'good', idea:`How code is organised into packages, how you use classes from other packages, and the four access levels that decide who can see what.`,
actors:'Thread', stateTitle:'Who can see what',
codes:{a:`// file: src/main/java/com/shop/order/Order.java
package com.shop.order;

import java.util.List;                  // a class from another package
import com.shop.pay.PaymentClient;

public class Order {                    // visible everywhere
  private long id;                      // only inside Order
  int itemCount;                        // package-private: com.shop.order only
  protected void audit() { }            // same package + subclasses
  public long id() { return id; }       // everyone
}`},
steps:[
{hl:{main:[1,2]}, th:[], g:[G('Package = folder',['package','com.shop.order'],['folder','com/shop/order/'],['full class name','com.shop.order.Order'])],
 say:`A <b>package</b> groups related classes, like folders group files. The package name mirrors the folder path, and by convention starts with a reversed domain (<code>com.shop</code>) so names are globally unique. Two classes can share a short name if their packages differ.`},
{hl:{main:[4,5]}, g:[G('Imports',['java.util.List','JDK collection'],['com.shop.pay.PaymentClient','your other package'],['java.lang.*','always imported (String, Math…)'])],
 say:`<code>import</code> lets you write the short name <code>List</code> instead of <code>java.util.List</code> everywhere. It doesn't load or copy anything; it's only a naming shortcut for the compiler. Classes in <code>java.lang</code> and in your own package need no import.`},
{hl:{main:[7,8,9,10,11]}, g:[G('Access levels (most → least open)',['public','everywhere','ok'],['protected','same package + subclasses'],['(no keyword)','same package only ("package-private")'],['private','same class only','bad'])],
 say:`<b>Access modifiers</b> control who may use a class, field or method. Default to <b>private</b> for fields, and open up only what callers truly need.`},
{hl:{main:[8,11]}, g:[G('From com.shop.billing.Invoice',['order.id()','✔ public'],['order.id','✘ private','bad'],['order.itemCount','✘ different package','bad'],['order.audit()','✘ not a subclass','bad'])],
 say:`From a class in another package, only <code>public</code> members are reachable. The private field is hidden behind the public <code>id()</code> method, so Order can later change how it stores ids without breaking callers. That's <b>encapsulation</b>.`},
{hl:{main:[10]}, g:[G('class SpecialOrder extends Order (other package)',['audit() inside SpecialOrder','✔ protected via inheritance','ok'],['itemCount','✘ package-private','bad'])],
 say:`<code>protected</code> also opens a member to <b>subclasses</b>, even in other packages. Package-private is often used for tests and helpers that live in the same package.`},
{th:[], g:[G('Rules of thumb',['fields','private'],['helper classes','package-private'],['API types and methods','public'],['top-level classes','only public or package-private'],['modules (Java 9+)','export packages explicitly'])],
 say:`A top-level class can only be <code>public</code> or package-private, and a file may hold only one public class. In larger systems, <b>modules</b> (module-info.java) add another layer: a package is visible outside its module only if it's exported.`}
],
keep:[`Package = folder + namespace; import is only a naming shortcut.`,`public > protected (package + subclasses) > package-private > private.`,`Fields private, expose behaviour through methods: encapsulation.`]}, {
  imp: 'good',
  theory: TH(`Packages organise classes into namespaces, imports let you refer to them by short names, and access modifiers control who can use each class and member.`,
`<p>As a codebase grows, you need structure. <b>Packages</b> group related classes (<code>com.shop.order</code>, <code>com.shop.payment</code>) and match folders on disk. Two classes can have the same simple name in different packages.</p>
<p><b>Access modifiers</b> decide visibility: <code>public</code> (everyone), <code>protected</code> (same package and subclasses), package-private (no keyword: same package only) and <code>private</code> (same class only). Hiding details lets you change them later without breaking other code.</p>`,
[[`Package`,`Namespace + folder for related classes.`],[`Fully qualified name`,`Package + class, e.g. java.util.List.`],[`import`,`Lets you use the short class name.`],[`Package-private`,`Default access when no modifier is written.`],[`Module`,`Java 9+ unit that exports selected packages.`]],
[`Declare the package at the top of each file.`,`Import the classes you use from other packages.`,`Choose the most restrictive access that works.`,`Expose a small public API; keep the rest private or package-private.`],
[`Typical layout: package by feature (order, payment) rather than by layer.`,`Spring scans components from the main class's package downward (5.6).`],
[`Making everything public "just in case".`,`Wildcard imports hiding which classes are actually used.`]),
  quiz: [
    [`Which modifier makes a member visible only inside its own class?`,[`private`,`protected`,`(no modifier)`,`final`],0,`private is the most restrictive.`,'E'],
    [`A field has no access modifier. Who can see it?`,[`Everyone, like public`,`Only the class itself`,`Classes in the same package`,`Only its subclasses`],2,`No keyword = package-private.`,'M'],
    [`What does an <code>import</code> statement do?`,[`Loads the class into memory at startup`,`Copies the class into your package`,`Makes private members accessible`,`Lets you use a class's short name`],3,`Imports are a compile-time naming shortcut only.`,'M'],
    [`Which classes don't need an import?`,[`Classes in java.util, like List and Map`,`Classes in java.lang and in the same package`,`Every class that ships with the JDK`,`None: every class needs an import`],1,`String, Math, Integer… are in java.lang.`,'E'],
    [`What does the package declaration have to match?`,[`The name of the public class in the file`,`The folder structure of the source file`,`The name of the JAR it will be packaged in`,`Nothing: it's only a label`],1,`com.shop.order ↔ com/shop/order/.`,'E'],
    [`Which access level should most fields have?`,[`public`,`protected`,`private`,`package-private`],2,`Expose behaviour through methods instead.`,'E'],
    [`A protected field in class Base (package a). A subclass Child in package b. Can Child's methods use the inherited field?`,[`Yes`,`No`,`Only if static`,`Only with an import`],0,`protected = package + subclasses.`,'M'],
    [`What does <code>import java.util.*;</code> import?`,[`All classes in java.util and its sub-packages`,`All classes directly in java.util (not sub-packages)`,`Only interfaces`,`Nothing`],1,`java.util.concurrent still needs its own import.`,'M'],
  ],
  quizAdv: [
    [`Can a top-level class be declared <code>private</code>?`,[`Yes`,`Only inside a package-info file`,`Only if it's final`,`No: only public or package-private`],3,`private and protected apply to members and nested classes.`,'M'],
    [`A protected method in <code>com.a.Base</code>. Can <code>com.b.Other</code> (not a subclass) call it?`,[`Yes, protected is public within the module`,`No: only the same package or subclasses`,`Yes, after importing com.a.Base`,`Only through reflection with no restrictions`],1,`protected = package access plus subclasses.`,'H'],
    [`Two imported packages both contain a class named Date. What happens if you use plain <code>Date</code>?`,[`The first import statement wins`,`Compile error: ambiguous, use the full name`,`The class from the newest JDK module wins`,`It always resolves to java.util.Date`],1,`Write java.sql.Date or java.util.Date explicitly.`,'H'],
    [`What does <code>import static java.lang.Math.max;</code> let you write?`,[`Only Math.max(a, b), as before`,`max(a, b) without the class name`,`static max = … as a declaration`,`Nothing new compared with import`],1,`Static imports bring static members into scope.`,'M'],
  ],
});
