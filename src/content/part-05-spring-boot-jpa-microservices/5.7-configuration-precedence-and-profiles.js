/* 5.7 Configuration precedence and profiles */
topic('5', { no:'5.7', title:'Configuration precedence and profiles', idea:`Resolve <code>payment.url</code>, <code>timeout</code> and <code>retries</code> across four sources and see which one wins each time.`,
actors:'Property', stateTitle:'Property sources (highest first)',
codes:{a:`# application.yml
payment:
  url: https://sandbox.pay.example
  timeout: 2s
  retries: 3
# application-prod.yml   (spring.profiles.active=prod)
payment:
  url: https://api.pay.example
# environment variable:  PAYMENT_TIMEOUT=5s
# command line:          --payment.retries=5

@ConfigurationProperties(prefix = "payment")
record PaymentProps(String url, Duration timeout, int retries) {}`},
steps:[
{hl:{url:[3,8]}, th:[['payment.url','resolving:info','']], g:[G('Property sources (highest first)',['1. command line','—'],['2. env vars','—'],['3. application-prod.yml','https://api.pay.example','ok'],['4. application.yml','https://sandbox.pay.example','dim'])],
 say:`Spring looks through property sources <b>in priority order</b> and the first one that defines the key wins. The <b>profile-specific</b> file (<code>application-prod.yml</code>) overrides the base <code>application.yml</code>, which gives the production URL.`},
{hl:{timeout:[4,9]}, th:[['payment.timeout','resolving:info','']], g:[G('Property sources (highest first)',['1. command line','—'],['2. env PAYMENT_TIMEOUT','5s','ok'],['3. application-prod.yml','—'],['4. application.yml','2s','dim'])],
 say:`<b>Relaxed binding:</b> the env var <code>PAYMENT_TIMEOUT</code> maps to <code>payment.timeout</code> (uppercase, dots → underscores). Env vars beat files, which is how Kubernetes or Docker override config per environment without rebuilding.`},
{hl:{retries:[5,10]}, th:[['payment.retries','resolving:info','']], g:[G('Property sources (highest first)',['1. --payment.retries','5','ok'],['2. env vars','—'],['3. application-prod.yml','—'],['4. application.yml','3','dim'])],
 say:`Command-line arguments are near the top, handy for a one-off override. (The full order has about 15 levels; tests' <code>@TestPropertySource</code> and <code>properties</code> attributes rank even higher.)`},
{hl:{bind:[12,13]}, th:[], g:[G('PaymentProps (bound)',['url','https://api.pay.example','ok'],['timeout','Duration.ofSeconds(5)','ok'],['retries','5','ok'])],
 say:`<code>@ConfigurationProperties</code> binds the whole prefix into a <b>typed, immutable</b> object, converting "5s" to a <code>Duration</code>. Add <code>@Validated</code> + <code>@NotBlank</code> to fail fast at startup. Prefer it over scattered <code>@Value("&#36;{…}")</code>.`},
{th:[], g:[G('Profiles',['@Profile("dev") @Bean DataSource h2()','only when dev is active'],['spring.profiles.active','set per environment'],['profile groups','prod = prod-db + prod-kafka']), G('Secrets',['in application.yml in git','✘ never','bad'],['env vars / K8s Secrets','✔','ok'],['Vault / AWS Secrets Manager','✔ via Spring Cloud','ok'])],
 say:`<code>@Profile</code> switches whole beans per environment. Keep secrets out of the repo: inject them through env vars or a secret manager. And print the resolved value of anything surprising: <code>/actuator/env</code> shows which source each property came from.`}
],
keep:[`First source wins: cmd line > env vars > application-{profile}.yml > application.yml.`,`Relaxed binding: PAYMENT_TIMEOUT → payment.timeout.`,`@ConfigurationProperties (typed, validated) over many @Value; secrets via env/vault.`]}, {
  imp: 'good',
  theory: TH(`Spring Boot reads configuration from many sources (files, environment variables, command line) in a fixed priority order, and profiles switch sets of settings per environment.`,
`<p>The same JAR runs in dev, test and prod with different database URLs and timeouts. Boot collects properties from <code>application.yml</code>, profile files like <code>application-prod.yml</code>, environment variables, command-line arguments and more. When the same key appears in several places, the higher-priority source wins: command line beats environment variables, which beat profile files, which beat the base file.</p>
<p><b>Profiles</b> (<code>spring.profiles.active=prod</code>) activate extra files and beans for an environment.</p>`,
[[`Property source`,`A place properties come from.`],[`Profile`,`A named set of configuration (dev, prod…).`],[`Relaxed binding`,`PAYMENT_TIMEOUT_MS env var → payment.timeout-ms.`],[`@ConfigurationProperties`,`Binds a group of properties to a typed class.`]],
[`Boot loads every property source in order of precedence.`,`For each key the first (highest-priority) value wins.`,`Values are bound to @Value fields and @ConfigurationProperties classes at startup.`,`Missing required values fail startup.`],
[`Use @ConfigurationProperties records with @Validated for grouped, checked settings.`,`Keep secrets out of files: environment variables, Vault, or Kubernetes secrets.`],
[`Hard-coding environment-specific values.`,`A property defined only in a profile file, so startup fails without that profile.`]),
  quiz: [
    [`Env var <code>PAYMENT_TIMEOUT_MS</code> binds to which property?`,[`Nothing: env vars must match exactly`,`payment.timeout-ms, through relaxed binding`,`payment_timeout_ms only`,`PAYMENT_TIMEOUT_MS only`],1,`Relaxed binding maps env-var style to property names.`,'E'],
    [`<code>server.port</code>: 8080 in application.yml, 9090 in application-prod.yml, env SERVER_PORT=7070, <code>--server.port=6060</code>. Profile prod is active. Port?`,[`9090`,`7070`,`6060`,`8080`],2,`Command-line arguments beat env vars, which beat profile files, which beat application.yml.`,'M'],
    [`<code>@Value("\${payment.timeout}")</code> is set only in application-prod.yml, and the app runs without prod. Result?`,[`Startup fails: unresolvable placeholder`,`The field stays null until prod is active`,`The field defaults to 0, as for any int`,`A warning is logged and an empty string is used`],0,`Give a default (\${payment.timeout:5000}) or define it in application.yml.`,'H'],
    [`What activates a profile?`,[`spring.profiles.active=prod (property, env var or arg)`,`A @Profile annotation on the main application class`,`Naming the JAR after the profile, e.g. app-prod.jar`,`spring.config.name=prod passed on the command line`],0,`SPRING_PROFILES_ACTIVE as env var.`,'E'],
    [`Which file holds properties for profile dev?`,[`application.dev.yml (or .properties)`,`application-dev.yml (or .properties)`,`profile-dev.yml (or .properties)`,`dev.application.yml (or .properties)`],1,`Loaded on top of application.yml.`,'E'],
    [`<code>@Value("\${timeout:5000}")</code> means?`,[`Use 5000 unless timeout is set to a larger value`,`Use property timeout, or 5000 if it's missing`,`Set timeout to 5000, overriding any configured value`,`Use timeout, capped at a maximum of 5000`],1,`Default after the colon.`,'M'],
    [`Where should database passwords come from in production?`,[`application-prod.yml committed to Git, encoded with Base64`,`Environment variables or a secret store (Vault, Kubernetes secrets)`,`A constants class compiled into the JAR and obfuscated`,`JVM system properties baked into the Docker image`],1,`Never commit secrets.`,'E'],
    [`Does a command-line argument beat an environment variable?`,[`No`,`Yes`,`Only for ports`,`They merge`],1,`Command line has higher precedence.`,'M'],
  ],
  quizAdv: [
    [`Best way to bind a group of related settings with validation?`,[`@ConfigurationProperties + @Validated`,`Many separate @Value fields`,`System.getProperty calls`,`Hard-coded constants`],0,`Typed, grouped and validated at startup.`,'M'],
    [`Profiles <code>dev,local</code> are active, and both set <code>x</code>. Which wins?`,[`dev, listed first`,`Neither: startup fails`,`application.yml`,`local, listed last`],3,`Later profiles override earlier ones.`,'H'],
    [`@Profile("!prod") on a bean means?`,[`Active only when a profile other than prod is set`,`Active in every profile except prod`,`Active only in prod, but loaded lazily`,`Excluded from every profile, including prod`],1,`Profile expressions support !, &, |.`,'M'],
    [`How can you see where a property's value came from at run time?`,[`Actuator /actuator/beans shows each property's origin`,`Actuator /actuator/env shows property sources and values`,`Actuator /actuator/mappings lists properties by source`,`Running jstack prints the active property sources`],1,`Secure it; it can expose secrets (Boot masks many).`,'H'],
  ],
});
