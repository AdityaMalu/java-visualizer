/* 9.1 Unit testing with JUnit 5 and Mockito */
topic('9', { no:'9.1', title:'Unit testing with JUnit 5 and Mockito', imp:'must', idea:`Test one class in isolation: replace its dependency with a mock, follow arrange-act-assert, verify interactions, cover failure paths and parameterised inputs, and learn what not to mock.`,
actors:'Test run', stateTitle:'Test state', logTitle:'Test report',
codes:{a:`class PriceServiceTest {
  TaxClient tax = mock(TaxClient.class);                  // fake dependency
  PriceService service = new PriceService(tax);           // real class under test

  @Test
  void addsTaxToNetPrice() {
    when(tax.rateFor("DE")).thenReturn(new BigDecimal("0.19"));    // arrange
    BigDecimal gross = service.gross(new BigDecimal("100"), "DE");  // act
    assertEquals(new BigDecimal("119.00"), gross);                  // assert
    verify(tax).rateFor("DE");                                      // interaction
  }

  @ParameterizedTest
  @CsvSource({"0, 0.00", "250, 297.50"})
  void grossForManyPrices(String net, String expected) { /* … */ }

  @Test
  void failsClearlyWhenTaxServiceIsDown() {
    when(tax.rateFor(any())).thenThrow(new TaxUnavailableException());
    assertThrows(PriceUnavailableException.class,
                 () -> service.gross(BigDecimal.TEN, "DE"));
  }
}`},
steps:[
{hl:{test:[1,3]}, th:[['test','NEW:dim','PriceServiceTest']], g:[G('Unit under test',['PriceService','real code we want to check'],['TaxClient','calls a remote tax API: slow, flaky, costs money','bad'])],
 say:`A <b>unit test</b> checks one class quickly and in isolation. <code>PriceService</code> depends on <code>TaxClient</code>, which calls a remote API. We don't want real network calls in a test: they're slow, flaky and may cost money. Constructor injection (5.1) lets us pass in a stand-in.`},
{hl:{test:[2]}, g:[G('mock(TaxClient.class)',['type','generated subclass/proxy of TaxClient'],['every method','returns a default (null, 0, false, empty)'],['records calls','yes, for verify()','ok'])],
 say:`<b>Mockito</b> creates a <b>mock</b>: a fake TaxClient whose methods do nothing and return defaults, while recording every call. (With <code>@ExtendWith(MockitoExtension.class)</code> you can write <code>@Mock TaxClient tax</code> and <code>@InjectMocks PriceService service</code> instead.)`},
{hl:{test:[5,6,7]}, th:[['test','RUN','addsTaxToNetPrice']], g:[G('Arrange',['when(tax.rateFor("DE"))','thenReturn(0.19)','hot'])],
 say:`Tests follow <b>Arrange, Act, Assert</b>. Arrange: <b>stub</b> the mock so <code>rateFor("DE")</code> returns 0.19. Now the result depends only on PriceService's logic. <code>@Test</code> marks the method for JUnit 5 to run.`},
{hl:{test:[8]}, g:[G('Act',['service.gross(100, "DE")','100 × (1 + 0.19)'],['result','119.00','hot'])],
 say:`Act: call the method being tested, exactly as production code would.`},
{hl:{test:[9]}, g:[G('Assert',['expected','119.00'],['actual','119.00','ok'],['careful','BigDecimal.equals compares scale: 119 ≠ 119.00'])], log:['✔ addsTaxToNetPrice'],
 say:`Assert: compare expected and actual. If they differ, the test fails with a clear message. Note the BigDecimal trap (1.10): <code>assertEquals(new BigDecimal("119"), …)</code> would fail on scale; AssertJ's <code>isEqualByComparingTo</code> avoids that.`},
{hl:{test:[10]}, g:[G('verify',['tax.rateFor("DE") called','exactly once','ok'],['other calls','none'])],
 say:`<code>verify</code> checks an <b>interaction</b>: that the mock was called the way we expected. Use it when the call itself is the behaviour (sending an email, publishing an event). Don't verify every internal call, or tests break on every refactor.`},
{hl:{test:[13,14,15]}, th:[['test','RUN','grossForManyPrices × 2']], g:[G('@ParameterizedTest',['run 1','net 0 → 0.00','ok'],['run 2','net 250 → 297.50','ok'])], log:['✔ grossForManyPrices [1] 0, 0.00','✔ grossForManyPrices [2] 250, 297.50'],
 say:`A <b>parameterised test</b> runs the same check with many inputs: here from inline CSV. Great for boundaries: 0, negative, huge, rounding cases.`},
{hl:{test:[17,18,19,20,21]}, th:[['test','RUN','failsClearly…']], g:[G('Failure path',['stub','rateFor(any()) throws TaxUnavailableException'],['expected','PriceUnavailableException','ok'])], log:['✔ failsClearlyWhenTaxServiceIsDown'],
 say:`Test the <b>unhappy path</b> too: make the mock throw and assert the service translates it properly. <code>assertThrows</code> runs the lambda and checks the exception type. Failure handling is where production bugs hide.`},
{th:[['test','TERM:ok','4 passed in 0.2 s']], g:[G('Mock or not?',['remote clients, repositories','mock or fake','ok'],['value objects, records, collections','use real ones','ok'],['the class under test','never mock it','bad'],['types you don\'t own (e.g. RestTemplate)','prefer wrapping them, or a real stub server'])],
 say:`<b>Say it:</b> "Unit tests isolate a class by mocking its collaborators: arrange with stubs, act, assert results, and verify only meaningful interactions. I test happy and failure paths and boundaries with parameterised tests, use real value objects, and leave wiring and DB behaviour to slice tests and Testcontainers (5.12)."`}
],
keep:[`Arrange (stub mocks) → Act (call the method) → Assert (check results); verify only meaningful interactions.`,`Mock slow/external collaborators; use real value objects; never mock the class under test.`,`Cover failure paths (thenThrow + assertThrows) and boundaries (@ParameterizedTest).`]}, {
  imp: 'good',
  theory: TH(`A unit test runs one class in isolation and checks its behaviour automatically; mocks stand in for the slow or external things it depends on.`,
`<p>Every time you change code, you risk breaking something that used to work. <b>Automated tests</b> re-check it in seconds. A <b>unit test</b> focuses on one class: give it inputs, check its outputs. <b>JUnit 5</b> runs the tests and reports results; assertions (<code>assertEquals</code>, AssertJ's <code>assertThat</code>) express what you expect.</p>
<p>Classes depend on other classes: a client calling a remote API, a repository using a database. A <b>mock</b> (from <b>Mockito</b>) is a fake version you control: you tell it what to return (<b>stubbing</b>) and later check how it was called (<b>verification</b>). That keeps tests fast, deterministic and focused.</p>`,
[[`@Test`,`Marks a JUnit test method.`],[`Assertion`,`A check that fails the test if the expectation isn't met.`],[`Mock`,`A fake object that records calls and returns stubbed values.`],[`Stub`,`A configured response: when(x).thenReturn(y).`],[`verify`,`Checks that a mock was called in a certain way.`],[`Arrange-Act-Assert`,`Structure: set up, run, check.`]],
[`Create the class under test with mocked dependencies (constructor injection makes this easy).`,`Arrange: stub the mocks for this scenario.`,`Act: call the method under test.`,`Assert results; verify interactions that matter; also test errors and boundaries.`],
[`Run unit tests on every build; keep them fast (milliseconds each).`,`Use AssertJ for readable assertions and @ParameterizedTest for many inputs.`,`Name tests after behaviour: <code>rejectsNegativeAmounts</code>.`],
[`Mocking everything, including value objects.`,`Verifying every internal call (brittle tests).`,`Testing only the happy path.`]),
  quiz: [
    [`What does <code>mock(TaxClient.class)</code> return by default for a method returning an object?`,[`A real TaxClient`,`null (or an empty value for collections/Optional)`,`It throws UnsupportedOperationException`,`The last value returned`],1,`Unstubbed methods return defaults.`,'E'],
    [`Which should you usually NOT mock in a unit test?`,[`A remote HTTP client calling a payment API`,`A repository that talks to the database`,`A message publisher sending to a broker`,`Value objects like Money or a record DTO`],3,`Use real value objects; mock collaborators with side effects or slowness.`,'M'],
    [`<code>assertEquals(new BigDecimal("119"), result)</code> fails though result is 119.00. Why?`,[`BigDecimal.equals compares scale, and 119 has scale 0`,`assertEquals can't compare BigDecimals`,`Rounding error`,`The mock returned null`],0,`Use compareTo or AssertJ's isEqualByComparingTo.`,'H'],
    [`What does <code>assertEquals(expected, actual)</code> do when they differ?`,[`Logs a warning and lets the test continue`,`Fails the test with both values in the message`,`Fails the test, but shows only the expected value`,`Throws a RuntimeException that stops the suite`],1,`Order matters for readable messages.`,'E'],
    [`What does <code>when(mock.find(1)).thenReturn(car)</code> do?`,[`Calls the real find(1) and records the result`,`Stubs the mock to return car for find(1)`,`Verifies that find(1) was called exactly once`,`Stubs find() to return car for any argument`],1,`Arrange step.`,'E'],
    [`Which JUnit 5 annotation runs before each test?`,[`@Before`,`@BeforeEach`,`@BeforeAll`,`@Setup`],1,`@BeforeAll runs once per class.`,'E'],
    [`How do you assert an exception in JUnit 5?`,[`@Test(expected = Type.class) on the method`,`assertThrows(Type.class, () -> …)`,`assertException(Type.class, () -&gt; …)`,`@ExpectedException(Type.class) on the class`],1,`@Test(expected) was JUnit 4.`,'M'],
    [`<code>verify(repo, never()).save(any())</code> checks?`,[`save was called once`,`save was never called`,`save threw`,`Nothing`],1,`Useful for "no side effect on invalid input".`,'M'],
  ],
  quizAdv: [
    [`Your test verifies 8 internal calls on mocks and breaks on every refactor. Better approach?`,[`Verify every call with inOrder() so the test pins the exact sequence of interactions`,`Assert on observable results; verify only interactions that are the behaviour (e.g. "email sent")`,`Replace all the mocks with spies so real code runs and the verify calls stay valid`,`Use verifyNoMoreInteractions on each mock so unexpected calls fail the test early`],1,`Tests should check behaviour, not implementation details.`,'H'],
    [`What does <code>@InjectMocks</code> do?`,[`Creates the class under test and injects the @Mock fields into it`,`Creates a mock for every field of the test class`,`Injects matching Spring beans from the test context`,`Creates the class under test with real dependencies`],0,`Prefer explicit constructor calls when it's just as short.`,'M'],
    [`What is a spy in Mockito?`,[`A mock whose methods all return defaults until stubbed`,`A wrapper around a real object; unstubbed methods call the real code`,`A listener that records each test's calls for reports`,`A mock that verifies every call automatically at the end`],1,`Use sparingly.`,'M'],
    [`Why is <code>Thread.sleep</code> in tests a smell?`,[`It's fine: a fixed sleep makes async timing deterministic`,`Tests become slow and flaky; wait on a condition (Awaitility) or inject a Clock`,`It blocks JUnit's thread pool, so other tests can't run`,`Sleeping threads aren't interrupted when the test times out`],1,`Make time and async completion controllable.`,'H'],
  ],
});
