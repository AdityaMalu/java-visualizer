/* 5.12 Testing Spring apps */
topic('5', { no:'5.12', title:'Testing Spring apps', idea:`The same CarController and CarService tested four ways. Each step shows what gets loaded and what it costs.`,
actors:'Test', stateTitle:'What is loaded',
codes:{a:`// 1. plain unit test: no Spring
var svc = new CarService(mock(CarRepo.class));

// 2. web slice
@WebMvcTest(CarController.class)
class CarControllerTest {
  @Autowired MockMvc mvc;
  @MockitoBean CarService svc;          // @MockBean before Boot 3.4
  @Test void get() throws Exception {
    when(svc.get(1)).thenReturn(new CarDto(1, "Swift"));
    mvc.perform(get("/cars/1")).andExpect(status().isOk())
       .andExpect(jsonPath("$.name").value("Swift"));
  }
}
// 3. @DataJpaTest: repositories + DB only
// 4. @SpringBootTest + Testcontainers (real Postgres in Docker)`},
steps:[
{hl:{t:[2]}, th:[['unit','PASS:ok','~5 ms']], g:[G('Loaded',['Spring context','none','ok'],['tests','business logic, edge cases'],['count in suite','MANY (base of the pyramid)'])],
 say:`Constructor injection pays off here: <code>new CarService(fakeRepo)</code>, no Spring at all, milliseconds per test. Most logic tests belong at this level.`},
{hl:{t:[5,6,7,8,9,10,11,12]}, th:[['web slice','PASS:ok','~1 s']], g:[G('Loaded',['MVC infrastructure','controllers, advice, converters, filters','ok'],['services / repos','✘ (mock them)'],['tests','routing, validation, JSON shape, status codes, security rules'])],
 say:`<code>@WebMvcTest</code> loads only the web layer, and <code>MockMvc</code> sends fake HTTP requests through the real DispatcherServlet (5.8) with no server port. You verify JSON, status codes and validation errors. Services are mocks.`},
{hl:{t:[15]}, th:[['jpa slice','PASS:ok','~2 s']], g:[G('Loaded',['JPA, repositories, DataSource','✔'],['each test','rolled back afterwards'],['tests','custom @Query, mappings, N+1 checks'])],
 say:`<code>@DataJpaTest</code> loads only JPA. By default it uses an embedded DB, but H2 behaves differently from Postgres (SQL dialect, JSON types, locking), so prefer Testcontainers with the real engine.`},
{hl:{t:[16]}, th:[['integration','PASS:ok','~10 s (container start)']], g:[G('Loaded',['full context','✔'],['real Postgres / Kafka in Docker','Testcontainers','ok'],['tests','end-to-end wiring, transactions, migrations'],['count in suite','FEW (top of the pyramid)'])],
 say:`<code>@SpringBootTest</code> with Testcontainers boots the whole app against real dependencies, so it catches wiring, Flyway migrations and transaction behaviour. It's slow, so keep these few. Spring caches the context between tests with the same configuration; random <code>@MockitoBean</code> differences break that cache and slow suites down.`}
],
keep:[`Pyramid: many plain unit tests, some slices (@WebMvcTest, @DataJpaTest), few @SpringBootTest.`,`MockMvc exercises the real MVC pipeline without a server.`,`Testcontainers over H2 for DB fidelity; keep context configs consistent for caching.`]}, {
  imp: 'good',
  theory: TH(`Test a Spring app at several levels: fast plain unit tests for logic, "slice" tests for one layer, and a few full-context integration tests.`,
`<p>Most tests should be plain JUnit tests of your classes with dependencies passed in (constructor injection makes this easy). For a single layer, Spring offers <b>slice</b> tests that load only part of the app: <code>@WebMvcTest</code> for controllers (with MockMvc), <code>@DataJpaTest</code> for repositories. <code>@SpringBootTest</code> loads everything and is the slowest. Testcontainers runs a real database in Docker for realistic tests.</p>`,
[[`Unit test`,`Tests one class in isolation, no Spring.`],[`Slice test`,`Loads only one layer's beans.`],[`MockMvc`,`Calls controllers through the MVC pipeline without a server.`],[`@MockBean / @MockitoBean`,`Replaces a bean in the Spring context with a mock.`],[`Testcontainers`,`Throwaway Docker containers (PostgreSQL, Kafka) for tests.`]],
[`Write unit tests for services with mocks or fakes.`,`Write @WebMvcTest tests for status codes, validation and JSON.`,`Write @DataJpaTest + Testcontainers tests for queries.`,`A few @SpringBootTest tests for end-to-end wiring.`],
[`Keep test configuration consistent so Spring can reuse cached contexts.`,`Test against the same database engine as production.`],
[`Everything as @SpringBootTest (slow suites).`,`H2 passing tests that fail on PostgreSQL.`]),
  quiz: [
    [`Test only a controller's mapping, validation and JSON. Which?`,[`@SpringBootTest with a real server`,`@DataJpaTest`,`@WebMvcTest with MockMvc, mocking the service`,`A plain JUnit test calling the method`],2,`Loads only the MVC layer.`,'E'],
    [`Why prefer Testcontainers (real PostgreSQL) over H2 for repository tests?`,[`Dialect, constraints and locking differ from production`,`H2 is slower than PostgreSQL for large test datasets`,`H2 can't run inside CI pipelines without a license`,`Testcontainers needs no Docker, so tests start faster`],0,`Test against the engine you run.`,'M'],
    [`The suite is slow because Spring contexts keep reloading. Common cause?`,[`Too many assertions per test`,`Using JUnit 5`,`Using MockMvc`,`Differing @MockBean setups`],3,`Keep test configurations consistent so the cached context is reused.`,'H'],
    [`@SpringBootTest loads?`,[`Only the web layer and controllers`,`The full application context`,`Only beans in the test's own package`,`A mock context with no real beans`],1,`Slowest, most realistic.`,'E'],
    [`@DataJpaTest loads?`,[`The full application context, but with transactions disabled`,`JPA components (entities, repositories) with an embedded or configured DB`,`Repositories only, with every query mocked by Mockito`,`Controllers and services, with an in-memory repository stub`],1,`Transactions roll back after each test.`,'E'],
    [`MockMvc lets you?`,[`Start a real embedded server on a random port for HTTP tests`,`Call controllers through the MVC stack without a network server`,`Mock the repository layer so controllers never touch the DB`,`Run load tests against controllers with many virtual users`],1,`Check status, headers and JSON.`,'M'],
    [`Why test against a real database with Testcontainers?`,[`Faster test runs than any in-memory database can offer`,`Same SQL dialect, constraints and behaviour as production`,`No Docker dependency, so it runs on any CI agent`,`Spring Boot requires it for @DataJpaTest to start`],1,`H2 can hide dialect issues.`,'M'],
    [`What's the test pyramid?`,[`Many end-to-end tests, fewer integration tests, very few unit tests`,`Many fast unit tests, fewer integration tests, very few end-to-end tests`,`Equal numbers of unit, integration and end-to-end tests per feature`,`Mostly integration tests, with unit tests only for utility classes`],1,`Fast feedback with confidence.`,'E'],
  ],
  quizAdv: [
    [`<code>@DataJpaTest</code> by default?`,[`Uses your real datasource`,`Rolls back each test`,`Starts the web server`,`Loads every bean`],1,`It also replaces your DB with an embedded one unless configured.`,'M'],
    [`<code>@MockBean</code> (or <code>@MockitoBean</code>) vs Mockito's <code>@Mock</code>?`,[`They're identical`,`@Mock needs Spring`,`It replaces the bean`,`@MockBean can't stub`],2,`@Mock is a plain Mockito mock with no Spring context.`,'M'],
    [`What is @TestConfiguration for?`,[`Production beans that tests may not replace`,`Extra or overriding beans just for tests`,`Activating a test profile for the context`,`Configuring log levels during test runs`],1,`Doesn't get picked up by component scanning by default.`,'M'],
    [`@ServiceConnection with Testcontainers (Boot 3.1+) does?`,[`Starts Docker and pulls the image before any test class loads`,`Wires the container's connection details into Spring automatically`,`Replaces the container with an embedded database when offline`,`Shares one container across JVMs by registering it as a service`],1,`Replaces @DynamicPropertySource boilerplate.`,'H'],
  ],
});
