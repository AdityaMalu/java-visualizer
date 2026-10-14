/* 3.7j Template method */
topic('3', { no:'3.7j', title:'Template method', idea:`A final skeleton in the base class calls steps that subclasses fill in: a required abstract step and an optional hook. "Don't call us, we'll call you."`,
actors:'Call stack', stateTitle:'Report run',
codes:{a:`abstract class ReportGenerator {
  public final byte[] generate(Query q) {      // the fixed skeleton
    List<Row> rows = fetch(q);
    rows = filter(rows);                       // hook: optional override
    byte[] out = format(rows);                 // varies per subclass
    audit(q, out.length);
    return out;
  }
  protected List<Row> fetch(Query q) { return repo.find(q); }
  protected List<Row> filter(List<Row> r) { return r; }      // default: no-op
  protected abstract byte[] format(List<Row> rows);
  private void audit(Query q, int n) { log.info("report {} bytes", n); }
}
class CsvReport extends ReportGenerator {
  protected byte[] format(List<Row> rows) { return toCsv(rows); }
}
class PdfReport extends ReportGenerator {
  protected List<Row> filter(List<Row> r) { return r.subList(0, Math.min(100, r.size())); }
  protected byte[] format(List<Row> rows) { return toPdf(rows); }
}
new PdfReport().generate(q);`},
steps:[
{hl:{call:[21],base:[2,3,9]}, th:[['PdfReport.generate','RUN:ok','inherited, final'],['fetch','RUN:ok','base version']], g:[G('run',['rows fetched','2,340'])],
 say:`<code>generate</code> is <code>final</code>: subclasses <b>can't change the order</b> of steps, which is the point. It runs <code>fetch</code> (the base implementation, which subclasses may override).`},
{hl:{base:[4],pdf:[18]}, th:[['PdfReport.generate','RUN:ok',''],['PdfReport.filter','RUN:ok','overridden hook']], g:[G('run',['rows fetched','2,340'],['after filter','100 (PDF cap)','hot'])],
 say:`<code>filter</code> is a <b>hook</b>: a step with a default (no-op) that subclasses <i>may</i> override. PdfReport caps the rows at 100. CsvReport doesn't override it, so it keeps everything.`},
{hl:{base:[5],pdf:[19]}, th:[['PdfReport.generate','RUN:ok',''],['PdfReport.format','RUN:ok','required abstract step']], g:[G('run',['after filter','100'],['bytes','84,210 (PDF)','hot'])],
 say:`<code>format</code> is <b>abstract</b>, so every subclass must provide it. The base class calls down into the subclass. This is the <b>Hollywood principle</b>: "don't call us, we'll call you".`},
{hl:{base:[6,7,12]}, th:[['PdfReport.generate','TERM:ok','returns bytes'],['audit','RUN:ok','private: same for everyone']], log:['report 84210 bytes'],
 say:`<code>audit</code> is <code>private</code>, so every report gets it and nobody can skip it. The skeleton is where you put cross-cutting steps (auditing, metrics, error handling) once.`},
{th:[], g:[G('In the wild',['JdbcTemplate','fixed: get conn → run → map rows (your RowMapper) → close'],['AbstractList','you implement get + size; iteration etc. inherited'],['Spring Batch / servlet HttpServlet.service','calls your doGet / doPost']), G('Template vs Strategy',['Template','vary steps by INHERITANCE (compile-time)'],['Strategy','vary by COMPOSITION (run-time swap)'],['modern Java','often a template method that takes lambdas (JdbcTemplate + RowMapper)','ok'])],
 say:`Template Method uses inheritance, so it inherits inheritance's downsides (3.4). Spring's <code>JdbcTemplate</code> is the hybrid that won: a fixed skeleton (connection, statement, cleanup, exception translation) with the varying step passed in as a <b>callback</b> (a strategy) instead of a subclass.`}
],
keep:[`final skeleton method; abstract required steps; hooks with defaults.`,`Base calls subclass (Hollywood principle); private steps can't be skipped.`,`JdbcTemplate = template + callback (strategy) hybrid.`]}, {
  imp: 'good',
  theory: TH(`Template Method fixes the steps of an algorithm in a base class and lets subclasses fill in specific steps.`,
`<p>Many processes share the same outline with small variations: every report is "load data → format → export". The base class has a <code>final</code> method that runs the steps in order, calling abstract methods (required steps) and hooks (optional steps with defaults). Subclasses supply only what differs. The base class calls the subclass, not the other way round: "don't call us, we'll call you".</p>`,
[[`Template method`,`The final method that defines the sequence of steps.`],[`Abstract step`,`A step subclasses must implement.`],[`Hook`,`A step with a default implementation subclasses may override.`]],
[`Write the skeleton method in an abstract base class and mark it final.`,`Make varying steps abstract or hooks.`,`Subclasses implement the steps; callers just call the template method.`],
[`Spring's JdbcTemplate and RestTemplate use a callback variant: you pass the varying part as a lambda instead of subclassing.`],
[`Deep hierarchies of templates; prefer passing a strategy when possible.`]),
  quiz: [
    [`In Template Method, what is a "hook"?`,[`An abstract step every subclass must implement`,`A step with a default body subclasses may override`,`A static callback registered once at startup`,`A JVM shutdown hook that runs the template`],1,`Required steps are abstract; optional ones are hooks.`,'E'],
    [`Why is the template (skeleton) method usually <code>final</code>?`,[`So subclasses can't change the order of steps`,`Because final methods run faster`,`Because abstract methods require it`,`So it can be called from a constructor`],0,`Subclasses fill in steps; the base class controls the flow.`,'M'],
    [`<code>JdbcTemplate.query(sql, rowMapper)</code> combines template method with?`,[`Builder`,`Observer`,`Singleton`,`Callback (Strategy)`],3,`The template owns connection, statement, errors and cleanup; you supply only the varying part.`,'H'],
    [`Template method puts the fixed algorithm in?`,[`Each subclass, which overrides the whole method`,`A base-class method that calls overridable steps`,`An interface whose methods each subclass implements`,`A static utility method taking a lambda per step`],1,`Subclasses fill in steps.`,'E'],
    [`What's a typical modifier for the template method itself?`,[`abstract`,`final`,`static`,`private`],1,`So subclasses can't reorder steps.`,'E'],
    [`Which Spring class follows template + callback?`,[`RestTemplate / JdbcTemplate`,`ApplicationContext / BeanFactory`,`Environment / PropertySource`,`ApplicationEventPublisher / Environment`],0,`They handle boilerplate; you pass the varying part.`,'M'],
    [`JUnit's @BeforeEach / @AfterEach around tests is like?`,[`Observer: JUnit notifies hooks when tests change`,`Template method: fixed lifecycle, your test is the varying step`,`Singleton: one shared fixture for the whole class`,`Builder: each hook adds a step that builds the test`],1,`The framework controls the flow.`,'M'],
    [`A required step should be declared as?`,[`A hook with a default`,`An abstract method`,`A static method`,`A private method`],1,`Optional steps are hooks.`,'E'],
  ],
  quizAdv: [
    [`The "Hollywood principle" in Template Method?`,[`The base class calls the subclass's steps`,`Subclasses call the base class's skeleton`,`Only final classes may be templates`,`Steps must be static`],0,`"Don't call us, we'll call you."`,'M'],
    [`Template Method vs Strategy for varying one step?`,[`Template uses composition; Strategy uses inheritance`,`They're interchangeable in every case`,`Template uses inheritance; Strategy composition`,`Strategy only works with abstract classes`],2,`Template fixes the variant per subclass; strategies can be swapped at run time.`,'M'],
    [`Downside of template method compared with passing lambdas (strategy)?`,[`Virtual calls make it much slower than lambdas`,`It needs a subclass per variation, fixed at compile time`,`It can't offer optional hook methods to subclasses`,`It forces every step to be declared abstract`],1,`Callbacks are often lighter.`,'M'],
    [`Why are abstract test base classes with many hooks sometimes discouraged?`,[`JUnit 5 forbids abstract classes in test hierarchies`,`Deep test hierarchies hide setup and make tests hard to read`,`Inherited @BeforeEach methods never run in subclasses`,`Each level of inheritance slows test startup a lot`],1,`Prefer composition (extensions, helper objects).`,'H'],
  ],
});
