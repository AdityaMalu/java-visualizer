/* 0.1 Your first Java program */
topic('0', { no:'0.1', title:'Your first Java program', imp:'extra', idea:`Write, compile and run <code>Hello.java</code>, and see what every word of <code>public static void main</code> means.`,
actors:'Thread', stateTitle:'Files and memory', logTitle:'Terminal',
codes:{a:`// File: Hello.java  (the file name must match the public class)
public class Hello {
  public static void main(String[] args) {
    String name = args.length > 0 ? args[0] : "world";
    System.out.println("Hello, " + name + "!");
  }
}
// $ javac Hello.java          -> creates Hello.class
// $ java Hello Ana            -> Hello, Ana!
// $ java Hello.java Ana       -> Java 11+: compile and run in one step`},
steps:[
{hl:{main:[1,2]}, th:[], g:[G('Files',['Hello.java','source code you write'])],
 say:`Every Java program is made of <b>classes</b>. This file declares one public class, <code>Hello</code>, so the file must be called <code>Hello.java</code>. The braces <code>{ }</code> mark where the class starts and ends.`},
{hl:{main:[3]}, g:[G('main, word by word',['public','anyone may call it (the JVM must)'],['static','belongs to the class: no object needed'],['void','returns nothing'],['main','the name the JVM looks for'],['String[] args','command-line arguments'])],
 say:`<code>main</code> is the <b>entry point</b>: the JVM starts your program by calling it. Each keyword has a reason. <code>static</code> matters most: the JVM can call it without first creating a <code>Hello</code> object.`},
{hl:{main:[8]}, g:[G('Files',['Hello.java','source code'],['Hello.class','bytecode, created by javac','hot'])], log:['$ javac Hello.java','(no output: success)'],
 say:`<code>javac</code> (the Java compiler) checks your code and turns it into <b>bytecode</b> in <code>Hello.class</code>. Compile errors (a typo, a missing semicolon) are reported here, before anything runs.`},
{hl:{main:[9,3]}, th:[['main','RUN','JVM called main()']], g:[G('Files',['Hello.class','loaded by the JVM']), G('main() frame',['args','["Ana"]','hot'])], log:['$ java Hello Ana'],
 say:`<code>java Hello Ana</code> starts the JVM, loads the class and calls <code>main</code>, passing the words after the class name as the <code>args</code> array. Here <code>args[0]</code> is "Ana".`},
{hl:{main:[4]}, g:[G('main() frame',['args','["Ana"]'],['args.length','1'],['name','"Ana"','hot'])],
 say:`A <b>local variable</b> <code>name</code> of type String. The <b>ternary</b> <code>cond ? a : b</code> picks a value: there is an argument, so name = "Ana". With no arguments it would be "world".`},
{hl:{main:[5]}, g:[G('main() frame',['name','"Ana"'],['"Hello, " + name + "!"','"Hello, Ana!"','hot'])], log:['Hello, Ana!'],
 say:`<code>+</code> joins strings. <code>System.out.println</code> prints a line to the console. When main returns, the program ends.`},
{hl:{main:[10]}, th:[], g:[G('Shortcuts',['java Hello.java','compile + run a single file (Java 11+)'],['jshell','try one line at a time (Java 9+)'],['void main() { … }','compact source files (final in Java 25)'])], log:['$ java Hello.java Ana','Hello, Ana!'],
 say:`For quick experiments: run a single source file directly, or use <code>jshell</code>. Java 25 also allows a <b>compact source file</b> with just <code>void main() { … }</code>, which is great for learning. Real projects still use classes, packages and a build tool (Maven or Gradle).`}
],
keep:[`A program is classes; execution starts at <code>public static void main(String[] args)</code>.`,`javac compiles .java → .class (bytecode); java runs it on the JVM.`,`Public class name = file name; compile errors appear before anything runs.`]}, {
  imp: 'good',
  theory: TH(`A Java program is a set of classes; you compile it with javac and run it with java, and execution starts in the main method.`,
`<p>Programming means writing instructions for a computer. In Java you write them in <code>.java</code> text files, organised into <b>classes</b>. The compiler <code>javac</code> checks them and translates them into <b>bytecode</b> (<code>.class</code> files), and the <code>java</code> command starts a Java Virtual Machine that runs that bytecode.</p>
<p>The JVM needs to know where to begin, so it looks for a method with the exact signature <code>public static void main(String[] args)</code>. Think of it as the front door of your program.</p>`,
[[`Source file`,`A .java text file you write.`],[`Compiler (javac)`,`Checks your code and produces .class bytecode.`],[`JVM (java)`,`Runs bytecode on your machine.`],[`main method`,`The entry point the JVM calls first.`],[`Statement`,`One instruction, usually ending with a semicolon.`]],
[`Write <code>Hello.java</code> containing <code>public class Hello</code>.`,`Run <code>javac Hello.java</code>; fix any compile errors it reports.`,`Run <code>java Hello</code>; the JVM loads the class and calls main.`,`main runs top to bottom; when it returns, the program ends.`],
[`Real projects use a build tool (Maven or Gradle) and an IDE (IntelliJ IDEA) that compile for you.`,`Use <code>jshell</code> to try snippets quickly.`],
[`A public class name that doesn't match the file name.`,`Misspelling main's signature, so the JVM can't find the entry point.`]),
  quiz: [
    [`Which method signature does the JVM look for to start a program?`,[`public void main(String[] args)`,`public static void main(String[] args)`,`static int main(String args)`,`public static void start(String[] args)`],1,`It must be public, static, void, named main, with a String[] parameter (Java 25 also allows simpler forms in compact source files).`,'E'],
    [`What does <code>javac Hello.java</code> produce?`,[`A native .exe for your OS`,`A .jar archive`,`Hello.class containing bytecode`,`Nothing until you run java`],2,`javac compiles source to platform-neutral bytecode; the JVM runs it.`,'E'],
    [`A file <code>Main.java</code> contains <code>public class App</code>. What happens?`,[`It runs, and the JVM uses App as the entry point`,`Compile error: a public class must be in a file of the same name`,`It compiles, but running java Main then fails`,`javac renames the class to Main automatically`],1,`One public top-level class per file, and the file is named after it.`,'M'],
    [`What does the JVM do with a <code>.class</code> file?`,[`Turns it back into Java source first`,`Loads its bytecode, verifies it and runs it`,`Sends it to the OS to execute directly`,`Compresses it into a JAR`],1,`The JVM loads, verifies and executes (interprets/JIT-compiles) bytecode.`,'E'],
    [`What does <code>System.out.println("a" + 1 + 2)</code> print?`,[`a3`,`a12`,`3a`,`Compile error`],1,`Left to right: "a" + 1 = "a1", then + 2 = "a12".`,'M'],
    [`And <code>System.out.println(1 + 2 + "a")</code>?`,[`12a`,`a3`,`3a`,`Compile error`],2,`1 + 2 = 3 first (int math), then "3" + "a".`,'M'],
    [`You run <code>java Hello</code> but get "Could not find or load main class Hello". Most likely cause?`,[`main is missing, so the JVM can't start the class`,`The class wasn't compiled, or you're in the wrong folder / classpath`,`The installed JVM is too old for the bytecode`,`The source file still contains a comment block`],1,`java looks for Hello.class on the classpath (current directory by default).`,'E'],
    [`What does <code>javac</code> report when you forget a semicolon?`,[`A compile error with the file and line`,`A warning, then it runs anyway`,`A runtime exception`,`Nothing: semicolons are optional`],0,`Syntax errors stop compilation before anything runs.`,'E'],
  ],
  quizAdv: [
    [`Where does <code>String[] args</code> get its values?`,[`From words typed after the class name on the command line`,`From environment variables set before launching java`,`From application.properties on the classpath`,`From whatever the user types into System.in`],0,`java Hello a b → args = ["a", "b"].`,'M'],
    [`Why is main <code>static</code>?`,[`So it runs faster`,`So only one thread can call it`,`So the JVM can call it without creating an object`,`So it can't be overridden by mistake`],2,`No instance of the class exists yet when the program starts.`,'H'],
    [`Can one <code>.java</code> file contain several top-level classes?`,[`No, never: exactly one class per source file`,`Yes, as long as every one of them is public`,`Yes, but at most one may be public (named like the file)`,`Only from Java 25 with compact source files`],2,`Each compiles to its own .class file.`,'M'],
    [`What is the difference between a JDK and a JRE today?`,[`The JRE is a faster runtime than the JDK's JVM`,`No separate JRE since Java 11: use the JDK or jlink`,`The JDK can compile but can't run programs`,`They're one download with two different names`],1,`jlink can build a trimmed runtime for deployment.`,'H'],
  ],
});
