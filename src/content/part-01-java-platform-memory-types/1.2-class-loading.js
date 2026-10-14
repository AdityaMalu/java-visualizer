/* 1.2 Class loading */
topic('1', { no:'1.2', title:'Class loading', idea:`Classes load lazily, on first real use, through parent-first delegation. Then: load → link (verify, prepare, resolve) → initialise.`,
actors:'Class loaders', stateTitle:'Class state', dgTitle:'Delegation (ask parent first)',
vb:'0 0 480 240',
nodes:{app:{x:80,y:60,label:'Application\nloader',w:130,h:46}, plat:{x:240,y:60,label:'Platform\nloader',w:130,h:46}, boot:{x:400,y:60,label:'Bootstrap\nloader',w:130,h:46},
  cp:{x:80,y:180,label:'classpath\nyour jars',kind:'mem',w:130,h:46}, mods:{x:240,y:180,label:'platform\nmodules',kind:'mem',w:130,h:46}, jdk:{x:400,y:180,label:'java.base\n(java.lang …)',kind:'mem',w:130,h:46}},
edges:[['app','plat','parent','line'],['plat','boot','parent','line'],['app','cp','','line'],['plat','mods','','line'],['boot','jdk','','line']],
codes:{a:`class Config {
  static int x = 5;                   // prepare: x = 0, init: x = 5
  static final int MAX = 10;          // compile-time constant
  static { System.out.println("Config init"); }
}
class App {
  public static void main(String[] a) throws Exception {
    System.out.println(Config.MAX);   // NO init: 10 was inlined by javac
    Config[] arr = new Config[3];     // NO init: only an array type
    System.out.println(Config.x);     // first real use -> init
    System.out.println(Config.x);     // already initialised
    Class.forName("com.app.Plugin");  // load by name at run time
  }
}`},
steps:[
{hl:{main:[8]}, th:[['main','RUN','line 8']], d:{type:'graph'}, g:[G('Config',['loaded?','no','dim'],['initialised?','no','dim'])], log:['10'],
 say:`<code>Config.MAX</code> is a <code>static final</code> primitive with a constant value, so javac <b>copied 10 straight into App's bytecode</b>. Config isn't touched at all. Gotcha: if you change MAX and recompile only Config, App still prints the old value.`},
{hl:{main:[9]}, g:[G('Config',['loaded?','yes','hot'],['linked?','yes'],['initialised?','no','dim'],['static block ran?','no','dim'])],
 say:`Creating a <code>Config[]</code> needs the Config <b>class</b> to be loaded (to build the array type), but it does <b>not initialise</b> it. No static block yet. Other non-triggers: <code>Config.class</code> literals and accessing constants.`},
{hl:{main:[10]}, th:[['main','WAITING','needs com.app.Config'],['app','RUN:ok','asked first']], d:{type:'graph',on:['app'],e:[['app','plat','1. ask parent','hot']]},
 say:`Say Config weren't loaded yet. The request goes to the <b>Application loader</b>. Before looking itself, it <b>delegates to its parent</b>.`},
{th:[['main','WAITING',''],['app','WAITING:warn','waiting'],['plat','WAITING:warn','asks its parent'],['boot','RUN:ok','searches java.base']], d:{type:'graph',on:['boot'],e:[['app','plat','1. ask parent','hot'],['plat','boot','2. ask parent','hot'],['boot','jdk','3. not here','bad dash']]},
 say:`Platform asks <b>Bootstrap</b> (native code, loads <code>java.lang</code>, <code>java.util</code>…). Bootstrap doesn't find <code>com.app.Config</code>.`},
{th:[['main','WAITING',''],['app','RUN:ok','loads it from the classpath'],['plat','TERM:dim','not found'],['boot','TERM:dim','not found']], d:{type:'graph',on:['app','cp'],e:[['plat','mods','4. not here','bad dash'],['app','cp','5. found → define','ok']]},
 say:`Platform doesn't have it either, so control comes back down and the <b>Application loader loads it itself</b> from your jar. Parent-first means core classes always come from the most trusted loader.`},
{th:[['main','RUN','continues'],['app','TERM:dim','']], d:{type:'graph'},
 g:[G('Config: phases',['1. LOAD','read bytes → Class object in Metaspace','ok'],['2a. VERIFY','bytecode safe?','ok'],['2b. PREPARE','x = 0 (default value)','hot'],['2c. RESOLVE','symbolic refs → real refs (often lazily)'],['3. INIT','not yet'])],
 say:`<b>Linking</b>: verify the bytecode, then <b>prepare</b> (allocate statics with <b>default</b> values, so x = 0, not 5), then resolve symbolic references, usually lazily on first use.`},
{hl:{main:[10],Config:[2,4]}, th:[['main','RUN','first real use of Config']], log:['Config init','5'],
 g:[G('Config: phases',['1. LOAD','done'],['2. LINK','done'],['3. INIT','x = 5, static block ran','ok'],['init lock','JVM-held: exactly once, thread-safe','ok'])],
 say:`<b>Initialisation</b> runs static initialisers and static blocks in textual order (<code>&lt;clinit&gt;</code>). Triggers: <code>new</code>, a static method call, reading or writing a non-constant static field, a subclass being initialised, or reflection. The JVM holds a lock, so init runs <b>exactly once</b> even with many threads. That's what makes the <b>holder-idiom singleton</b> safe.`},
{hl:{main:[11]}, log:['5'],
 say:`Already initialised, so no output from the static block. If the static block had <b>thrown</b>, the first use would get <code>ExceptionInInitializerError</code> and every later use <code>NoClassDefFoundError</code>. That's a confusing production log, because the real cause is only in the <i>first</i> error.`},
{hl:{main:[12]}, th:[['main','RUN','exception'],['app','RUN:ok','not found anywhere']], d:{type:'graph',bad:['cp'],e:[['app','plat','ask','hot'],['plat','boot','ask','hot']]}, log:['✘ java.lang.ClassNotFoundException: com.app.Plugin'],
 say:`<b>ClassNotFoundException</b> (checked): <i>you</i> asked for a class by name (<code>Class.forName</code>, <code>loadClass</code>) and no loader has it. <b>NoClassDefFoundError</b> (an Error): the class existed at compile time but is missing at run time, or its init failed earlier. Usually a dependency or classpath problem.`},
{th:[], d:{type:'graph',on:['boot','jdk'],e:[['app','plat','ask','hot'],['plat','boot','ask','hot'],['boot','jdk','real String','ok']]}, logReset:true, log:['your fake java/lang/String.class is never used'],
 g:[G('Why parent-first',['you ship java/lang/String.class','ignored','ok'],['Bootstrap answers first','the real String','ok']), G('Class identity',['= name + defining loader',''],['Car (loader A) vs Car (loader B)','different classes','bad'],['symptom','ClassCastException: Car cannot be cast to Car','bad'])],
 say:`Delegation also gives <b>security</b>: a malicious <code>java.lang.String</code> on the classpath is never loaded. And a class is identified by <b>name + loader</b>. In app servers, plugin systems, or with dev-tools hot reload, two loaders can define "the same" class and you get the strange <code>Car cannot be cast to Car</code>.`}
],
keep:[`Delegation: app → platform → bootstrap; load yourself only if parents can't.`,`Load → link (verify, prepare = defaults, resolve) → init (static blocks, once, thread-safe).`,`Constants are inlined; ClassNotFoundException vs NoClassDefFoundError; identity = name + loader.`]}, {
  imp: 'good',
  theory: TH(`Classes aren't all loaded at startup; the JVM finds and loads each one the first time it's needed, through a chain of class loaders.`,
`<p>Your program uses thousands of classes: yours, your libraries', and the JDK's. Loading all of them at startup would be slow, so the JVM loads a class <b>lazily</b>, the first time your code really uses it. The component that finds the <code>.class</code> bytes (in a JAR, a folder or even over the network) is a <b>class loader</b>.</p>
<p>There's a hierarchy of loaders, like a chain of command. When a loader is asked for a class it first asks its <b>parent</b>; only if the parent can't find it does it look itself. This <b>parent delegation</b> guarantees that <code>java.lang.String</code> always comes from the JDK and can't be replaced by a fake one on your classpath.</p>`,
[[`Bootstrap loader`,`Built into the JVM; loads core classes like java.lang.*.`],[`Platform loader`,`Loads other JDK modules (java.sql, …).`],[`Application loader`,`Loads your classes and libraries from the classpath.`],[`Linking`,`Verifying the bytecode is safe, preparing static fields with default values, and resolving references.`],[`Initialisation`,`Running static field initialisers and static { } blocks, exactly once, the first time the class is actively used.`]],
[`Code mentions a class for the first time (e.g. <code>new Car()</code>).`,`The application loader delegates up to platform, then bootstrap; whoever can find it loads it.`,`The bytes are verified (no stack overflows, type-correct instructions).`,`Static fields get default values (0, null), then static initialisers run, once, in a thread-safe way.`,`The class's identity is its name <b>plus</b> the loader that defined it.`],
[`App servers and plugin systems use separate loaders per app, so two versions of a library can coexist.`,`<code>ClassNotFoundException</code> = you asked by name and it isn't there. <code>NoClassDefFoundError</code> = it was there when compiling but missing (or failed to initialise) at run time: check your deployed JARs.`,`Changing a <code>static final</code> constant in a library needs the callers recompiled, because constants are copied into them.`],
[`Doing heavy work or calling remote services in a static block; if it fails, the class is unusable for the rest of the JVM's life.`,`Assuming two classes with the same name are the same type, even when different loaders loaded them.`]),
  quiz: [
    [`Your code asks for <code>java.lang.String</code>. Which class loader actually loads it?`,[`The application loader, because it received the request first`,`Whichever loader finds a matching class first on the classpath`,`The bootstrap loader, because loaders delegate to their parent first`,`The platform loader, which owns every java.* package`],2,`Parent-first delegation: app → platform → bootstrap. Core classes such as java.lang.String come from the bootstrap loader, so they can't be spoofed.`,'E'],
    [`Code compiled fine, but at run time it throws <code>NoClassDefFoundError</code> (not ClassNotFoundException). Classic cause?`,[`Class.forName was called with a misspelled class name at run time`,`Two class loaders loaded the class and the JVM couldn't choose one`,`The class's constructor threw an exception while running new`,`The class existed at compile time but is missing now, or its static init failed`],3,`ClassNotFoundException comes from explicit loading (forName, loadClass). NoClassDefFoundError means linking to a class seen at compile time failed: a missing JAR, or an earlier ExceptionInInitializerError.`,'M'],
    [`Library A has <code>static final int MAX = 10;</code> used by app B. You change it to 20 and redeploy only A's JAR. What does B see?`,[`20, because static fields are always read from the defining class`,`10, because compile-time constants are inlined into B's bytecode`,`20, but only after B's classes are reloaded by a new class loader`,`B fails at startup with IncompatibleClassChangeError`],1,`Compile-time constants are copied into the calling class at compile time. B must be recompiled to see 20.`,'H'],
    [`When is a class typically loaded?`,[`At JVM startup, all at once`,`The first time it's actually needed`,`When javac compiles it`,`Only when Class.forName is called`],1,`Loading is lazy.`,'E'],
    [`Which loader loads your application's classes from the classpath?`,[`The bootstrap class loader`,`The platform class loader`,`Application (system) class loader`,`The JIT compiler's loader`],2,`It delegates to platform and bootstrap first.`,'E'],
    [`What happens if a static initialiser throws an exception?`,[`It's retried the next time the class is used`,`ExceptionInInitializerError; the class stays unusable`,`The error is ignored and fields keep defaults`,`The class loader restarts and tries again`],1,`Avoid risky work in static blocks.`,'M'],
    [`During "preparation", what values do static fields get?`,[`Their declared initial values`,`Default values (0, null, false)`,`Random values`,`None until first use`],1,`Initialisers run later, at initialisation.`,'M'],
    [`Two threads trigger initialisation of the same class at once. What does the JVM guarantee?`,[`Both threads run the static block once each`,`Static init runs exactly once; the other thread waits`,`The JVM deadlocks the two threads`,`The second thread gets an exception`],1,`That's why the holder idiom is thread-safe.`,'M'],
  ],
  quizAdv: [
    [`<code>com.acme.Plugin</code> is loaded by two different class loaders. You cast an instance from loader 1 to the type seen by loader 2. Result?`,[`It works: the class names match`,`ClassCastException: Plugin cannot be cast to Plugin`,`LinkageError when the second loader loads it`,`NoClassDefFoundError at the cast`],1,`A class's identity is its name plus its defining loader. Classic in app servers and plugin systems.`,'H'],
    [`When do a class's static initialisers run?`,[`When the class file is first read from disk`,`At JVM startup, for every class on the classpath`,`On first active use: new, a static call, a static field`,`As soon as a variable of that type is declared`],2,`Loading and linking can happen earlier; initialisation is lazy and happens once.`,'M'],
    [`Why do app servers use separate class loaders per application?`,[`Class loading runs faster on multi-core servers`,`Apps can use different library versions and unload`,`Only to sandbox each application for security`,`The JVM can't load two WARs any other way`],1,`Each loader defines its own copy of classes.`,'H'],
    [`Redeploying an app leaks Metaspace over time. Typical cause?`,[`Too many threads are created on each deploy`,`Something outside the app still holds its class loader`,`The heap is set too large for the container`,`Large String constants pile up in the pool`],1,`A class loader leak keeps all its classes alive.`,'H'],
  ],
});
