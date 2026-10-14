/* 9.3 Maven and Gradle: dependencies and conflicts */
topic('9', { no:'9.3', title:'Maven and Gradle: dependencies and conflicts', imp:'good', idea:`How a build tool turns a few declared dependencies into dozens of JARs, why two libraries wanting different versions of the same JAR cause NoSuchMethodError at run time, and how to fix it.`,
actors:'Build', stateTitle:'Resolved dependencies', logTitle:'Build output',
codes:{a:`<project>
  <groupId>com.shop</groupId>
  <artifactId>order-service</artifactId>
  <version>1.4.0</version>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.4.0</version>
  </parent>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>com.vendor</groupId><artifactId>pay-sdk</artifactId>
      <version>2.1.0</version>
    </dependency>
    <dependency>
      <groupId>com.partner</groupId><artifactId>loyalty-client</artifactId>
      <version>3.0.0</version>
    </dependency>
  </dependencies>
</project>`},
steps:[
{hl:{build:[1,2,3,4]}, th:[['build','RUN','mvn package']], g:[G('Coordinates',['groupId','com.shop (organisation)'],['artifactId','order-service (project)'],['version','1.4.0'])],
 say:`A build tool (Maven or Gradle) compiles your code, runs tests and packages the result, and above all <b>downloads dependencies</b>. Every library is identified by <b>coordinates</b>: groupId, artifactId and version, fetched from a repository like Maven Central.`},
{hl:{build:[5,6,7,8,9,11,12,13,14]}, g:[G('Managed versions (BOM)',['spring-boot-starter-web','no version written: comes from the parent'],['jackson, tomcat, logback…','all versions chosen and tested together by Spring Boot','ok'])],
 say:`The Spring Boot <b>parent</b> (or BOM) supplies tested, compatible versions for hundreds of libraries, so you don't write versions for them. One starter brings in Spring MVC, Tomcat, Jackson and logging.`},
{hl:{build:[15,16,17,18,19,20,21]}, g:[G('Transitive dependencies',['pay-sdk 2.1.0','→ json-lite 1.2'],['loyalty-client 3.0.0','→ json-lite 2.0'],['conflict','two versions of json-lite requested','hot'])], log:['$ mvn dependency:tree','+- com.vendor:pay-sdk:2.1.0','|  \\- com.acme:json-lite:1.2','+- com.partner:loyalty-client:3.0.0','   \\- com.acme:json-lite:2.0 (omitted for conflict with 1.2)'],
 say:`Your libraries have their own dependencies (<b>transitive</b> dependencies). Both need <code>json-lite</code>, in different versions. Only <b>one</b> version can be on the classpath, so the build tool must pick.`},
{g:[G('Who wins?',['Maven','nearest in the tree; on a tie, first declared → 1.2','hot'],['Gradle','highest version by default → 2.0'])], log:['[INFO] BUILD SUCCESS'],
 say:`<b>Maven</b> picks the version <b>nearest</b> to your project in the tree, and on a tie the one declared first: json-lite 1.2. <b>Gradle</b> picks the highest by default. The build succeeds: compiling only checks your own code against the APIs you call directly.`},
{th:[['build','TERM:bad','runtime failure']], g:[G('At run time',['loyalty-client calls','JsonLite.parseStrict() (added in 2.0)'],['classpath has','json-lite 1.2','bad'])], log:['java.lang.NoSuchMethodError: \'com.acme.JsonLite com.acme.JsonLite.parseStrict(java.lang.String)\'','   at com.partner.loyalty.Client.fetchPoints(Client.java:88)'],
 say:`In production, loyalty-client calls a method that exists only in 2.0, and the JVM throws <b>NoSuchMethodError</b> (or NoClassDefFoundError / ClassNotFoundException). This "JAR hell" error only appears when that code path runs.`},
{th:[['build','RUN:ok','mvn package']], g:[G('Fixes',['pin the version','<dependencyManagement> json-lite 2.0 (or Gradle constraints)','ok'],['check compatibility','does pay-sdk work with 2.0? run its tests','hot'],['exclude','<exclusions> on the dependency that brings the wrong one'],['find it','mvn dependency:tree / gradle dependencies','ok'])],
 say:`Fix it by <b>pinning</b> the version you want in dependencyManagement (Gradle: a constraint or a version catalog), after checking the other library works with it, or by excluding the bad transitive dependency. Tools like the Maven Enforcer plugin's dependency convergence rule fail the build on such conflicts early.`},
{th:[['build','TERM:ok','order-service-1.4.0.jar']], g:[G('Lifecycle (Maven)',['compile → test → package → verify → install → deploy','each phase runs the earlier ones'],['scopes','compile, runtime, test, provided']), G('Habits',['use the wrapper','./mvnw, ./gradlew: same tool version everywhere','ok'],['Spring Boot plugin','builds an executable fat JAR','ok'],['Gradle','implementation vs api; version catalogs'])],
 say:`Maven runs a fixed <b>lifecycle</b>; <code>mvn package</code> compiles, tests and builds the JAR. Dependency <b>scopes</b> keep test libraries out of production. Always commit the wrapper (<code>mvnw</code>/<code>gradlew</code>) so CI and every developer use the same build tool version.`}
],
keep:[`Dependencies = coordinates (group:artifact:version); transitive dependencies come along automatically.`,`One version per JAR: Maven = nearest wins (then first declared), Gradle = highest wins. Mismatch → NoSuchMethodError at run time.`,`Use BOMs, pin versions in dependencyManagement, inspect with dependency:tree, commit the wrapper.`]}, {
  imp: 'good',
  theory: TH(`Maven and Gradle build your project and manage its libraries, including the libraries those libraries need; when two need different versions of the same one, the tool picks one, sometimes wrongly.`,
`<p>A real project uses dozens of open-source libraries, and those use others. Build tools resolve this whole tree from a few lines of configuration, download the JARs from repositories like Maven Central, compile, run tests and package your app.</p>
<p>Only <b>one version</b> of each library can be on the classpath. When two dependencies want different versions, the tool chooses (Maven: nearest wins; Gradle: highest wins). If the chosen version lacks something the other library calls, you get <b>NoSuchMethodError</b> or <b>NoClassDefFoundError</b> at run time.</p>`,
[[`Coordinates`,`groupId:artifactId:version.`],[`Transitive dependency`,`A dependency of your dependency.`],[`BOM / dependencyManagement`,`A central list of versions to use.`],[`Scope`,`Where a dependency is available: compile, runtime, test, provided.`],[`Wrapper`,`mvnw / gradlew: pins the build tool version.`]],
[`Declare direct dependencies (versions often from a BOM).`,`The tool resolves the full tree and resolves conflicts.`,`Compile, test, package (a fat JAR for Spring Boot).`,`Inspect with dependency:tree; pin versions when needed.`],
[`Let Spring Boot's BOM manage versions; override deliberately.`,`Use dependency convergence checks in CI.`,`Keep dependencies updated (Dependabot/Renovate) and scan for vulnerabilities.`],
[`Adding a library without checking what it drags in.`,`Ignoring "omitted for conflict" in the tree.`,`Different build tool versions on different machines.`]),
  quiz: [
    [`What is a transitive dependency?`,[`A dependency only used in tests`,`A dependency you declared twice`,`A dependency of one of your dependencies`,`A dependency loaded at run time by reflection`],2,`They come along automatically; inspect them with dependency:tree.`,'E'],
    [`Two libraries need json-lite 1.2 and 2.0 at the same depth. Which does Maven pick?`,[`The highest version, 2.0`,`The one declared first in the pom`,`The lowest version, 1.2`,`The build fails with a conflict`],1,`Maven: nearest wins, ties go to the first declaration. Gradle picks the highest.`,'M'],
    [`The build succeeds, but production throws NoSuchMethodError inside a library. Most likely?`,[`A dependency version conflict put an older JAR on the classpath`,`The JIT inlined and removed the method at run time`,`A compiler warning about the method was ignored`,`The library was compiled for a newer Java release`],0,`Check dependency:tree and pin the version.`,'H'],
    [`What identifies a Maven dependency?`,[`The JAR file name and its checksum`,`groupId, artifactId and version`,`The repository URL and its path`,`groupId, artifactId and packaging`],1,`Coordinates.`,'E'],
    [`Which scope keeps JUnit out of the production JAR?`,[`compile`,`test`,`runtime`,`provided`],1,`Test-only dependencies.`,'E'],
    [`Command to see the full dependency tree in Maven?`,[`mvn tree`,`mvn dependency:tree`,`mvn deps`,`mvn list`],1,`Gradle: gradle dependencies.`,'E'],
    [`What does <code>mvn package</code> run?`,[`Only compile and package, skipping the tests`,`Compile, test, then package (earlier phases included)`,`Compile, test, package, then install locally`,`Only the package phase, using existing classes`],1,`The lifecycle runs phases in order.`,'M'],
    [`Gradle's default conflict resolution picks?`,[`The nearest`,`The highest version`,`The first declared`,`The oldest`],1,`Maven picks the nearest.`,'M'],
  ],
  quizAdv: [
    [`What does the Spring Boot parent / BOM give you?`,[`Faster compilation through shared, precompiled starter modules`,`Automatic security patches applied whenever you rebuild the app`,`Tested, compatible versions for many libraries, so you omit versions`,`A single fat JAR dependency that bundles all Spring libraries`],2,`You still upgrade Boot to get newer managed versions.`,'M'],
    [`Why commit <code>mvnw</code> / <code>gradlew</code>?`,[`The wrapper downloads dependencies faster`,`Everyone and CI run the same build tool version`,`Maven Central rejects builds without them`,`They let builds run without a JDK installed`],1,`Reproducible builds.`,'M'],
    [`Gradle <code>api</code> vs <code>implementation</code>?`,[`They're the same; implementation is just the newer name for compile`,`api exposes the dependency to consumers' compile classpath; implementation keeps it internal`,`implementation exposes the dependency to consumers; api keeps it internal`,`api is for published library JARs only; implementation is for test code`],1,`implementation speeds builds and hides internals.`,'H'],
    [`What does a BOM import (<code>&lt;scope&gt;import&lt;/scope&gt;</code>) do?`,[`Adds every library in the BOM as a dependency`,`Brings in managed versions without adding dependencies`,`Copies the BOM's plugins into your build section`,`Replaces your parent pom with the BOM's parent`],1,`e.g. spring-boot-dependencies, testcontainers-bom.`,'M'],
  ],
});
