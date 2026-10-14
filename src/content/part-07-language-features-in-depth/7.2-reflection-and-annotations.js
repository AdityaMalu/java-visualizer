/* 7.2 Reflection and annotations */
topic('7', { no:'7.2', title:'Reflection and annotations', imp:'good', idea:`Annotations are labels on code; reflection lets a program inspect and call its own classes at run time. Together they're how Spring, JPA and JUnit work. Build a tiny <code>@Timed</code> framework to see it.`,
actors:'Thread', stateTitle:'What the program can see', logTitle:'Console',
codes:{a:`@Retention(RetentionPolicy.RUNTIME)            // keep it at run time
@Target(ElementType.METHOD)                    // only allowed on methods
public @interface Timed { String value() default ""; }

class ReportService {
  @Timed("report.build")
  public String build(int id) { return "report-" + id; }
}

// A tiny "framework" that reads the annotation
Method m = ReportService.class.getMethod("build", int.class);
Timed t = m.getAnnotation(Timed.class);        // null if absent
long start = System.nanoTime();
Object result = m.invoke(new ReportService(), 42);
System.out.println(t.value() + " took " + (System.nanoTime() - start) + " ns");`},
steps:[
{hl:{main:[1,2,3]}, th:[], g:[G('@Timed',['kind','annotation type (@interface)'],['element','value(), default ""'],['@Target','METHOD only'],['@Retention','RUNTIME'])],
 say:`An <b>annotation</b> is metadata: a label attached to a class, method, field or parameter. <b>By itself it does nothing.</b> Something must read it. <code>@Target</code> says where it may be used; <code>@Retention</code> says how long it survives: SOURCE (compiler only, like @Override), CLASS (in the .class file), RUNTIME (readable by reflection).`},
{hl:{main:[5,6,7]}, g:[G('ReportService.build',['annotations','@Timed("report.build")'],['behaviour','unchanged: it just returns a string'])],
 say:`Putting <code>@Timed</code> on <code>build</code> changes nothing about how build runs. If no code ever looks for @Timed, it's just a comment the compiler checked.`},
{hl:{main:[11]}, g:[G('Reflection',['ReportService.class','the Class object: a description of the class','hot'],['getMethod("build", int.class)','Method object for build(int)','hot'])],
 say:`<b>Reflection</b> is the program looking at itself. Every class has a <code>Class</code> object describing its fields, methods, constructors and annotations. <code>getMethod</code> finds a public method by name and parameter types.`},
{hl:{main:[12]}, g:[G('Reflection',['m.getAnnotation(Timed.class)','@Timed("report.build")','ok'],['t.value()','"report.build"'])],
 say:`Because retention is RUNTIME, we can read the annotation and its values. With CLASS or SOURCE retention this would return <code>null</code>, which is a classic "my annotation is ignored" bug.`},
{hl:{main:[13,14,15]}, g:[G('Reflective call',['m.invoke(obj, 42)','"report-42"','ok'],['checked at compile time?','no: wrong args fail at run time','bad'],['cost','slower than a direct call (mostly at setup)'])], log:['report.build took 81234 ns'],
 say:`<code>invoke</code> calls the method dynamically. Our "framework" timed it based on the annotation, without the service knowing. Type mistakes now show up at run time (IllegalArgumentException, InvocationTargetException wraps exceptions thrown inside).`},
{th:[], g:[G('How Spring uses this',['startup','scan classes, read @Component, @Transactional, @GetMapping'],['wiring','create beans, inject constructors (reflection)'],['behaviour','wrap beans in proxies that act on annotations (5.3)'],['per request','mostly generated code / cached metadata, not fresh reflection'])],
 say:`Frameworks do exactly this at scale: at startup Spring scans your classes, reads annotations, creates objects and wires them by reflection, and builds proxies so <code>@Transactional</code> runs code around your method. JPA reads <code>@Entity</code> and <code>@Column</code>; JUnit finds <code>@Test</code> methods.`},
{th:[], g:[G('Compile-time alternative',['annotation processors','run inside javac, generate code'],['examples','Lombok, MapStruct, Dagger, Micronaut DI'],['benefit','no run-time reflection, faster startup','ok']), G('Reflection limits',['private members','need setAccessible(true)'],['modules (Java 9+)','can block deep reflection unless opened'],['GraalVM native image','needs reflection config'])],
 say:`Some tools process annotations at <b>compile time</b> instead, generating plain code (Lombok's getters, MapStruct mappers). That avoids reflection costs and suits native images. Reflection into private internals is increasingly restricted by the module system.`}
],
keep:[`Annotations are metadata; they do nothing until code reads them. Retention RUNTIME is needed for reflection.`,`Reflection: Class → getMethod / getDeclaredFields / getAnnotation → invoke. Flexible, but no compile-time checks and slower.`,`Spring, JPA, JUnit = annotations + reflection + proxies at startup; annotation processors do it at compile time.`]}, {
  imp: 'good',
  theory: TH(`Annotations attach metadata to code; reflection lets a program read that metadata and inspect or call classes at run time. Frameworks combine the two.`,
`<p>An <b>annotation</b> like <code>@Transactional</code> or <code>@Test</code> is a label. On its own it does nothing; it's information for some tool. That tool might be the compiler (<code>@Override</code>), an annotation processor that generates code (Lombok), or a framework that reads it while the program runs.</p>
<p><b>Reflection</b> is how a program examines itself at run time: list a class's methods and fields, read their annotations, create objects and call methods by name. Spring uses reflection at startup to find your <code>@Component</code> classes, inject constructors and decide which methods need proxies.</p>`,
[[`@interface`,`Declares an annotation type.`],[`@Retention`,`SOURCE, CLASS or RUNTIME: how long the annotation is kept.`],[`@Target`,`Where the annotation may be used.`],[`Class object`,`Run-time description of a class (Foo.class).`],[`Method.invoke`,`Calls a method reflectively.`],[`Annotation processor`,`A compiler plugin that reads annotations and generates code.`]],
[`Define an annotation with RUNTIME retention.`,`Place it on classes, methods or fields.`,`At run time, get the Class / Method / Field objects.`,`Read annotations with getAnnotation and act on them (call, wrap, validate).`],
[`You'll rarely write reflection by hand; you'll use annotations that frameworks read.`,`Custom annotations + an aspect (5.3) are a clean way to add auditing, timing or rate limiting.`],
[`Forgetting RUNTIME retention, so the annotation is invisible.`,`Using reflection in hot paths.`,`Reflecting into private JDK internals (blocked since Java 17).`]),
  quiz: [
    [`What does an annotation do by itself?`,[`Nothing: some tool or framework must read it`,`It changes the method's bytecode`,`It always runs code before the method`,`It makes the method public`],0,`Annotations are metadata; behaviour comes from whoever processes them.`,'E'],
    [`Your custom annotation is never found via <code>getAnnotation</code>. Most likely cause?`,[`The method isn't public`,`Its retention isn't RUNTIME`,`Annotations need an interface`,`Reflection is disabled by default`],1,`Default retention is CLASS, which isn't visible to reflection.`,'M'],
    [`A reflectively invoked method throws IllegalStateException. What does <code>Method.invoke</code> throw?`,[`IllegalStateException directly`,`ReflectiveOperationException with no cause`,`InvocationTargetException wrapping it`,`Nothing: it's swallowed`],2,`Unwrap with getCause().`,'H'],
    [`What does <code>Foo.class</code> give you?`,[`A new instance of Foo built with its no-arg constructor`,`The Class object describing Foo`,`A dynamic proxy that intercepts calls on Foo`,`The loaded bytecode of Foo as a byte array`],1,`Entry point for reflection.`,'E'],
    [`Which retention keeps an annotation available at run time?`,[`SOURCE`,`CLASS`,`RUNTIME`,`DEFAULT`],2,`Needed for reflection-based frameworks.`,'E'],
    [`<code>@Override</code> has which retention?`,[`RUNTIME`,`SOURCE`,`CLASS`,`None`],1,`It's only for the compiler.`,'M'],
    [`What does <code>getDeclaredFields()</code> return?`,[`All public fields, including the ones inherited from superclasses`,`All fields declared in this class, including private (not inherited)`,`All fields from this class and its superclasses, including private ones`,`Only the static fields declared in this class, including private ones`],1,`getFields() returns public ones, including inherited.`,'M'],
    [`Why is reflection slower than direct calls?`,[`Every reflective call is executed on a separate internal thread`,`Extra checks, boxing of arguments and harder JIT optimisation`,`The class file is re-parsed from disk on each invocation`,`Reflection always bypasses the JIT and runs in interpreted mode`],1,`Fine at startup, avoid in hot paths.`,'M'],
  ],
  quizAdv: [
    [`Why does Spring do most reflection at startup rather than per request?`,[`The JVM forbids reflection once the application context is refreshed`,`Request threads run without the permissions reflection requires`,`Annotations are discarded from classes once startup has finished`,`Reflective lookups are slow; it caches metadata and builds proxies once`],3,`Per-call paths use proxies and cached method handles.`,'H'],
    [`Lombok's @Getter generates getters when?`,[`At compile time, via an annotation processor`,`At startup, via reflection`,`At first call, via a proxy`,`At class loading, via bytecode rewriting by the JVM`],0,`Compile-time processing: no runtime reflection needed.`,'M'],
    [`MethodHandles vs reflection?`,[`They're the same API, just renamed in java.lang.invoke for Java 7`,`MethodHandles are lower-level, typed handles the JIT can optimise much better`,`MethodHandles skip access checks, so they're slower but more flexible`,`Reflection is the newer API and is preferred over MethodHandles today`],1,`Used under the hood by lambdas and modern reflection.`,'H'],
    [`Can annotations hold arbitrary objects as values?`,[`Yes, any Serializable object can be used as an annotation value`,`No: only primitives, String, Class, enums, other annotations and arrays of these`,`Only String and primitive values, without arrays or nested annotations`,`Any object, provided it is created by a static factory at compile time`],1,`Values must be compile-time constants.`,'H'],
  ],
});
