/* 9.5 Java modules (JPMS) */
topic('9', { no:'9.5', title:'Java modules (JPMS)', imp:'extra', idea:`module-info.java declares what a module needs and what it exposes. See strong encapsulation block an internal package, reflection needing opens, and why most Spring apps still live on the classpath.`,
actors:'Compiler', stateTitle:'Visibility', logTitle:'Compiler output',
codes:{a:`// src/com.shop.orders/module-info.java
module com.shop.orders {
  requires com.shop.payments;            // I depend on this module
  requires java.sql;
  exports com.shop.orders.api;           // only this package is visible to others
  opens com.shop.orders.model to com.fasterxml.jackson.databind;  // reflection access
}

// in another module that requires com.shop.orders:
import com.shop.orders.api.OrderService;      // exported: OK
import com.shop.orders.internal.OrderMapper;  // not exported: compile error`},
steps:[
{hl:{javac:[1]}, th:[], g:[G('Classpath problems (before Java 9)',['public','means visible to every JAR','bad'],['missing JAR','found only at run time (NoClassDefFoundError)','bad'],['two JARs, same package','unpredictable (split packages)','bad'])],
 say:`On the classpath, everything <code>public</code> in every JAR is visible to everything else, missing dependencies are discovered at run time, and duplicate classes resolve by accident of ordering. The <b>Java Platform Module System</b> (Java 9) adds explicit boundaries.`},
{hl:{javac:[2,3,4]}, g:[G('module com.shop.orders',['requires','com.shop.payments, java.sql'],['checked','at compile time and startup','ok'])],
 say:`A <b>module</b> is a named group of packages with a <code>module-info.java</code>. <code>requires</code> declares dependencies explicitly; if a required module is missing, the application fails at startup, not halfway through a request.`},
{hl:{javac:[5,10,11]}, g:[G('From another module',['com.shop.orders.api','exported → accessible','ok'],['com.shop.orders.internal','public classes, but NOT exported → inaccessible','bad'])], log:['error: package com.shop.orders.internal is not visible','  (package com.shop.orders.internal is declared in module com.shop.orders, which does not export it)'],
 say:`<b>Strong encapsulation:</b> only <code>exports</code>-ed packages are accessible from other modules. A <code>public</code> class in an internal package is no longer reachable from outside: "public" now means "public within what the module exports".`},
{hl:{javac:[6]}, g:[G('Reflection',['exports','compile-time access to public API'],['opens','deep reflection (private fields) at run time'],['who needs it','Jackson, Hibernate, Spring'])],
 say:`Frameworks that use reflection on private fields (Jackson filling a DTO, Hibernate setting an id) need the package <code>opens</code>-ed to them. Without it you get <code>InaccessibleObjectException</code> at run time.`},
{th:[], g:[G('Where you meet JPMS',['the JDK itself','split into ~70 modules (java.base, java.sql…)','ok'],['jlink','build a slim runtime with only needed modules','ok'],['Java 17+','JDK internals locked: --add-opens needed for old libraries','hot'],['typical Spring Boot app','still runs on the classpath (unnamed module)'])],
 say:`Most application code (including typical Spring Boot apps) still runs on the classpath, in the "unnamed module". But everyone meets JPMS: the JDK itself is modular, <code>jlink</code> builds small custom runtimes for containers, and since Java 17 old libraries poking at JDK internals need <code>--add-opens</code> flags. Libraries increasingly ship module names.`}
],
keep:[`module-info: requires (dependencies), exports (public API), opens (reflection).`,`Non-exported packages are inaccessible even if their classes are public.`,`JDK is modular (jlink); Java 17 locks internals (--add-opens); most apps still use the classpath.`]}, {
  imp: 'good',
  theory: TH(`The Java Platform Module System lets a JAR declare which modules it needs and which packages it exposes, giving strong encapsulation beyond public/private.`,
`<p>Before Java 9 there were only classes and packages on a flat <b>classpath</b>: any public class could be used by anyone, even if it was meant to be internal. A <b>module</b> adds a boundary around a group of packages, described in <code>module-info.java</code>: what it <b>requires</b>, what it <b>exports</b> (its public API) and what it <b>opens</b> for reflection.</p>
<p>The JDK itself was split into modules, which allows tools like <code>jlink</code> to build small runtimes, and since Java 17 its internals can't be accessed reflectively by default.</p>`,
[[`module-info.java`,`The module descriptor.`],[`requires`,`Declares a dependency on another module.`],[`exports`,`Makes a package accessible to other modules.`],[`opens`,`Allows deep reflection into a package at run time.`],[`Unnamed module`,`Where classpath code lives.`],[`jlink`,`Builds a custom runtime image with only needed modules.`]],
[`Create module-info.java at the root of the source tree.`,`List required modules and exported packages.`,`Open packages that frameworks reflect on.`,`Run with --module-path instead of the classpath.`],
[`Libraries benefit most (clear public API).`,`jlink makes slim container images.`,`Know --add-opens for legacy libraries on Java 17+.`],
[`Forgetting opens for Jackson/Hibernate model packages.`,`Expecting public classes in non-exported packages to be usable.`]),
  quiz: [
    [`In module-info.java, what does <code>exports com.shop.api</code> do?`,[`Makes that package accessible to other modules`,`Opens that package for deep reflection only`,`Declares a dependency on that package's module`,`Makes the package readable by the unnamed module only`],0,`Only exported packages are part of the module's public API.`,'E'],
    [`A public class sits in a package that isn't exported. Can another module use it?`,[`Yes, it's public`,`Only via reflection, always`,`No: it's encapsulated`,`Only in the same JAR`],2,`Strong encapsulation: public isn't enough across modules.`,'M'],
    [`Jackson throws InaccessibleObjectException on a modular app's DTO. Fix?`,[`Make the DTO fields public static so Jackson can see them`,`Open the package to Jackson in module-info (opens … to com.fasterxml.jackson.databind)`,`Add requires transitive com.fasterxml.jackson.databind to module-info`,`Run with --add-modules ALL-SYSTEM so Jackson sees the module`],1,`Deep reflection needs opens, not just exports.`,'H'],
    [`What file declares a Java module?`,[`module.xml`,`module-info.java`,`pom.xml`,`MANIFEST.MF`],1,`At the source root.`,'E'],
    [`Which keyword declares a dependency on another module?`,[`imports`,`requires`,`uses`,`needs`],1,`requires java.sql;`,'E'],
    [`Which module is always available without requires?`,[`java.sql`,`java.base`,`java.desktop`,`java.logging`],1,`Contains java.lang, java.util…`,'M'],
    [`What does <code>exports</code> NOT allow by itself?`,[`Using the package's public types`,`Deep reflection into private members`,`Compiling against the package`,`Calling its public static methods`],1,`That needs opens.`,'M'],
    [`Since which version are JDK internals strongly encapsulated by default?`,[`9`,`11`,`16/17`,`21`],2,`JEP 396 (16) then 403 (17).`,'M'],
  ],
  quizAdv: [
    [`What does <code>jlink</code> produce?`,[`A fat JAR that bundles the app with all its dependencies`,`A custom Java runtime containing only the modules you need`,`A native executable that runs without any JVM at all`,`A module-info.java file generated from your classpath`],1,`Smaller images; GraalVM native image is the no-JVM option.`,'M'],
    [`Where does code from the classpath live in the module system?`,[`In java.base, alongside the core classes`,`In an automatic module named after each JAR`,`In the unnamed module, which reads all modules`,`In the unnamed module, which reads only java.base`],2,`Automatic modules are JARs on the module path without a descriptor.`,'H'],
    [`What is an automatic module?`,[`A module-info.java that jdeps generates for a JAR at build time`,`A plain JAR placed on the module path, named from its manifest or file name`,`A JDK module loaded on demand the first time a class needs it`,`A plain JAR on the classpath, which the JVM names after its package`],1,`Helps migration.`,'H'],
    [`<code>requires transitive</code> means?`,[`The dependency is optional and may be missing at runtime`,`Modules requiring this one also get read access to that dependency`,`The dependency is only needed at runtime, not at compile time`,`This module's packages are exported to all modules that read it`],1,`Implied readability.`,'H'],
  ],
});
