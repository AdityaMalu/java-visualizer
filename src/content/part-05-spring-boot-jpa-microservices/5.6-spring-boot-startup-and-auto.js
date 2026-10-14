/* 5.6 Spring Boot startup and auto-configuration */
topic('5', { no:'5.6', title:'Spring Boot startup and auto-configuration', idea:`From <code>SpringApplication.run</code> to "Started": component scan, then auto-config candidates, conditions evaluated one by one, your beans winning, then Tomcat.`,
actors:'Startup phases', stateTitle:'Conditions report',
codes:{a:`@SpringBootApplication   // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class App {
  public static void main(String[] a) { SpringApplication.run(App.class, a); }
}
// inside spring-boot-autoconfigure (simplified):
@AutoConfiguration
@ConditionalOnClass(DataSource.class)               // JDBC on the classpath?
class DataSourceAutoConfiguration {
  @Bean @ConditionalOnMissingBean                   // only if YOU didn't define one
  DataSource dataSource(DataSourceProperties p) { return p.initializeDataSourceBuilder().build(); }
}
// listed in META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`},
steps:[
{hl:{boot:[3]}, th:[['run()','RUN:ok','prepare Environment']], g:[G('Environment',['sources','cmd args, env vars, application-{profile}.yml, application.yml (5.7)'],['active profile','prod'])],
 say:`<code>SpringApplication.run</code> first builds the <b>Environment</b>: all property sources in precedence order and the active profiles. It also decides the app type (servlet, reactive or none) from the classpath.`},
{hl:{boot:[1]}, th:[['run()','RUN:ok','create context + component scan']], g:[G('Your beans',['scanned from','com.app (App\'s package) and below','hot'],['found','controllers, services, repos, @Configuration'])],
 say:`<code>@SpringBootApplication</code> combines three annotations. <code>@ComponentScan</code> scans <b>App's package and its sub-packages</b>. Gotcha: a class in a sibling package (com.other) isn't found, so keep the main class at the root package.`},
{hl:{auto:[6,12]}, th:[['run()','RUN:ok','load auto-config candidates']], g:[G('Candidates (~150 from the imports files)',C('',['DataSourceAutoConfiguration','JacksonAutoConfiguration','MongoAutoConfiguration','WebMvcAutoConfiguration','…']))],
 say:`<code>@EnableAutoConfiguration</code> reads every <code>AutoConfiguration.imports</code> file on the classpath (Boot 3; it used to be <code>spring.factories</code>). Each starter jar contributes candidates. They're processed <b>after</b> your own configuration.`},
{hl:{auto:[7]}, th:[['run()','RUN:ok','evaluate conditions']], g:[G('Conditions report',['DataSourceAutoConfiguration','@ConditionalOnClass(DataSource) ✔ (Hikari + driver present)','ok'],['MongoAutoConfiguration','@ConditionalOnClass(MongoClient) ✘ not on classpath','bad'],['WebMvcAutoConfiguration','servlet web app ✔','ok'])],
 say:`Each candidate is guarded by <b>conditions</b>: <code>@ConditionalOnClass</code> (is a library present?), <code>@ConditionalOnProperty</code> (feature flag), <code>@ConditionalOnWebApplication</code>, and so on. Adding a starter dependency puts classes on the classpath, which flips conditions to true. That's the "magic".`},
{hl:{auto:[9,10]}, th:[['run()','RUN:ok','user bean wins']], g:[G('Conditions report',['dataSource (auto)','@ConditionalOnMissingBean ✘: you defined your own DataSource','hot'],['jdbcTemplate (auto)','✔ uses YOUR DataSource','ok'])],
 say:`<code>@ConditionalOnMissingBean</code> is how Boot <b>backs off</b>: define your own <code>DataSource</code> (or ObjectMapper, RestClient…) and the auto-configured one is skipped, while other auto-config builds on yours. Run with <code>--debug</code> to print this conditions report, which is the first thing to check for "why is/isn't this bean here?".`},
{th:[['run()','RUN:ok','refresh → beans → Tomcat']], log:['Tomcat initialized with port 8080 (http)','HikariPool-1 - Start completed.','Started App in 3.1 seconds (process running for 3.6)'],
 g:[G('refresh()',['create singletons','5.1 / 5.2 lifecycle'],['embedded Tomcat','started by ServletWebServerFactory'],['runners','CommandLineRunner / ApplicationRunner'],['events','ApplicationReadyEvent → app is ready'])],
 say:`Context refresh creates the singletons (5.1), starts the embedded web server, runs <code>CommandLineRunner</code> beans, and publishes <code>ApplicationReadyEvent</code>. <b>Starters</b> are curated dependency bundles (<code>spring-boot-starter-web</code> = Spring MVC + Jackson + Tomcat). <b>Actuator</b> adds <code>/actuator/health</code> (with liveness and readiness for Kubernetes), <code>/metrics</code> and <code>/info</code>.`}
],
keep:[`@SpringBootApplication = @Configuration + @EnableAutoConfiguration + @ComponentScan (root package!).`,`Auto-config candidates from AutoConfiguration.imports, guarded by @ConditionalOn…`,`@ConditionalOnMissingBean = your bean wins. --debug prints the conditions report.`]}, {
  imp: 'good',
  theory: TH(`Spring Boot starts your app from one main method and configures common infrastructure automatically based on what's on the classpath, while letting your own beans win.`,
`<p>Plain Spring needs lots of configuration. <b>Spring Boot</b> looks at your dependencies and properties and creates sensible beans for you: add the web starter and you get an embedded Tomcat and JSON support; add the JPA starter and a datasource URL and you get a DataSource, EntityManager and transaction manager.</p>
<p>Each auto-configuration is guarded by <b>conditions</b>, like "only if this class is on the classpath" or "only if the user hasn't defined their own bean". So you can override anything just by declaring your own bean.</p>`,
[[`@SpringBootApplication`,`@Configuration + @EnableAutoConfiguration + @ComponentScan.`],[`Starter`,`A dependency bundle (spring-boot-starter-web…).`],[`Auto-configuration`,`Boot's conditional @Configuration classes.`],[`@ConditionalOnMissingBean`,`Apply only if you haven't defined that bean.`]],
[`main() calls SpringApplication.run.`,`Boot prepares the environment (properties, profiles).`,`It scans your packages from the main class's package downward.`,`It evaluates auto-configurations and applies those whose conditions match.`,`It creates beans, starts the web server and publishes ApplicationReadyEvent.`],
[`Keep the main class in the root package.`,`Run with <code>--debug</code> to see which auto-configurations applied and why.`],
[`Main class in a sub-package, so components aren't found.`,`Fighting auto-configuration instead of defining your own bean or setting a property.`]),
  quiz: [
    [`Your @Service is in <code>com.acme.other</code>, the main class in <code>com.acme.app</code>. It isn't found. Why?`,[`It's missing a @Bean method in a config class`,`Spring only scans @Configuration classes`,`Scanning starts at the main class's package`,`Service classes must be declared public`],2,`Put the main class in the root package.`,'E'],
    [`You declare your own <code>DataSource</code> bean. What does Boot's auto-configured one do?`,[`It backs off: @ConditionalOnMissingBean`,`It overrides yours`,`Both are created and startup fails`,`They're merged`],0,`Auto-configuration is conditional; your beans win.`,'M'],
    [`spring-boot-starter-data-jpa is on the classpath, but no datasource URL and no embedded DB driver. Startup?`,[`It starts with an in-memory database it creates`,`It starts with JPA silently disabled`,`It starts, then fails on the first query`,`It fails: a DataSource URL is required`],3,`DataSource auto-configuration can't determine a URL.`,'H'],
    [`What is a Spring Boot starter?`,[`A main class template that bootstraps the application context`,`A dependency that brings a curated set of libraries and auto-configuration`,`A Maven plugin that generates project skeletons from templates`,`A profile that activates default properties for a module`],1,`e.g. spring-boot-starter-web.`,'E'],
    [`What starts Tomcat in a Boot web app?`,[`The Maven plugin deploys the app to a local server`,`Auto-configuration creates an embedded server`,`The JVM launches Tomcat from a system install`,`SpringApplication downloads Tomcat on first run`],1,`The app is a runnable JAR.`,'E'],
    [`Where are auto-configuration classes listed (Boot 3)?`,[`META-INF/spring.factories under the EnableAutoConfiguration key`,`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`,`META-INF/spring/autoconfigure.properties in each starter`,`application.yml under spring.autoconfigure.include`],1,`Older Boot used spring.factories.`,'H'],
    [`@ConditionalOnClass means?`,[`Apply if a class is on the classpath`,`Apply if a bean of that class exists`,`Apply if the class matches an active @Profile`,`Apply if the class is in a scanned package`],0,`e.g. only configure Jackson if Jackson is present.`,'M'],
    [`How do you disable a specific auto-configuration?`,[`@ComponentScan(excludeFilters = …) on the main class`,`@SpringBootApplication(exclude = …) or spring.autoconfigure.exclude`,`@EnableAutoConfiguration(disabled = …) or spring.autoconfigure.skip`,`spring.main.lazy-initialization=true or @Lazy on the class`],1,`Or define your own bean so it backs off.`,'M'],
  ],
  quizAdv: [
    [`How do you see why an auto-configuration did or didn't apply?`,[`Read the starter JAR`,`Run with --debug`,`Add prints in Boot`,`It can't be seen`],1,`The report lists positive and negative matches. Also the actuator conditions endpoint.`,'M'],
    [`What does <code>@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)</code> do?`,[`Removes JDBC from the classpath`,`Disables JPA entirely`,`Stops Boot creating a DataSource`,`Nothing in production`],2,`Useful when you configure multiple DataSources yourself.`,'M'],
    [`What does <code>spring-boot-maven-plugin</code> build?`,[`A thin JAR plus a lib folder you put on the classpath`,`An executable "fat" JAR containing your classes and dependencies`,`A WAR that must be deployed to an external Tomcat`,`A shaded JAR that relocates all dependency packages`],1,`Also supports building OCI images.`,'M'],
    [`Why does Boot's startup sometimes take seconds, and what helps?`,[`JIT compilation of all classes; a larger heap fixes it`,`Scanning and bean creation; fewer starters, lazy init or AOT help`,`Downloading dependencies at launch; an offline Maven cache helps`,`GC of startup garbage; switching to ZGC removes the delay`],1,`Measure with the startup actuator endpoint.`,'H'],
  ],
});
