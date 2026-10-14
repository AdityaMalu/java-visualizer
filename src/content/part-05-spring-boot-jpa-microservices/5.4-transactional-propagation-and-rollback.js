/* 5.4 @Transactional: propagation and rollback */
topic('5', { no:'5.4', title:'@Transactional: propagation and rollback', idea:`Trace two database connections through REQUIRED and REQUIRES_NEW, a rollback that keeps the audit row, the "rollback-only" surprise, and checked exceptions that commit.`,
actors:'Transactions', stateTitle:'Database connections',
codes:{a:`@Service class OrderService {
  @Transactional                                  // REQUIRED (default)
  public void placeOrder(Order o) {
    orderRepo.save(o);                            // INSERT order
    stock.reduce(o.items());                      // UPDATE stock
    auditService.log("placed " + o.id());         // REQUIRES_NEW (other bean)
    payment.charge(o);                            // throws RuntimeException
  }
}
@Service class AuditService {
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void log(String msg) { auditRepo.save(new Audit(msg)); }
}`,
b:`@Transactional public void outer() {
  try { inner.risky(); }                 // inner bean, REQUIRED: joins this tx
  catch (RuntimeException e) { log.warn("ignored"); }   // swallowed...
}                                        // ...commit -> UnexpectedRollbackException
@Transactional public void risky() { throw new IllegalStateException(); }  // marks rollback-only

@Transactional public void upload() throws IOException {
  repo.save(meta); throw new IOException();   // ✘ checked → COMMITS by default
}
@Transactional(rollbackFor = Exception.class) // ✔ fix`},
steps:[
{cv:'a', hl:{tx1:[2,3,4,5]}, th:[['tx#1','ACTIVE:ok','REQUIRED → new tx']], g:[G('conn-1 (tx#1)',['INSERT orders(42)','pending','hot'],['UPDATE stock','pending','hot']), G('conn-2',['—','idle in pool','dim'])],
 say:`<code>REQUIRED</code> (default): join the current transaction if there is one, otherwise start a new one. The proxy takes conn-1 from the pool (HikariCP), sets <code>autocommit=false</code>, and binds it to the thread. Both writes are pending in tx#1.`},
{hl:{tx1:[6],tx2:[10,11]}, th:[['tx#1','SUSPENDED:warn','conn-1 held, waiting'],['tx#2','ACTIVE:ok','REQUIRES_NEW']], g:[G('conn-1 (tx#1, suspended)',['INSERT orders(42)','pending'],['UPDATE stock','pending']), G('conn-2 (tx#2)',['INSERT audit','pending','hot'])],
 say:`<code>REQUIRES_NEW</code> <b>suspends</b> tx#1 and opens tx#2 on a <b>second connection</b>. This only works because AuditService is a different bean (5.3). Note that one request now holds 2 connections; under load that can exhaust the pool.`},
{th:[['tx#1','ACTIVE:ok','resumed'],['tx#2','COMMITTED:ok','']], g:[G('conn-1 (tx#1)',['INSERT orders(42)','pending'],['UPDATE stock','pending']), G('conn-2',['INSERT audit','COMMITTED','ok'])], log:['tx#2 COMMIT (audit row is durable now)'],
 say:`tx#2 commits on its own and conn-2 returns to the pool. tx#1 resumes.`},
{hl:{tx1:[7]}, th:[['tx#1','ROLLED BACK:bad','RuntimeException'],['tx#2','COMMITTED:ok','']], g:[G('conn-1',['INSERT orders(42)','ROLLED BACK','bad'],['UPDATE stock','ROLLED BACK','bad']), G('conn-2',['INSERT audit','still there','ok'])], log:['payment failed → tx#1 ROLLBACK','DB: no order, stock unchanged, audit row present'],
 say:`<code>charge</code> throws a RuntimeException, it propagates out through the proxy, and tx#1 <b>rolls back</b>: order and stock are undone. The audit row survives because it committed separately. This is the classic REQUIRES_NEW use case ("log the attempt even if it fails"). <code>NESTED</code> would use a savepoint inside tx#1 instead.`},
{cv:'b', logReset:true, hl:{tx1:[1,2,5]}, th:[['tx#1','ROLLBACK-ONLY:bad','marked by inner']], g:[G('tx#1',['inner.risky() threw','TransactionInterceptor marks tx rollback-only','bad'],['outer catches it','but the mark stays','bad'])],
 say:`<b>Surprise case:</b> <code>risky()</code> is <code>REQUIRED</code>, so it <b>joins</b> outer's tx#1. When it throws, its interceptor can't roll back (it doesn't own the tx), so it marks tx#1 <b>rollback-only</b>. outer catches the exception and carries on happily…`},
{hl:{tx1:[3,4]}, th:[['tx#1','ROLLED BACK:bad','']], log:['✘ UnexpectedRollbackException: Transaction silently rolled back because it has been marked as rollback-only'],
 say:`…then at commit time Spring finds the mark, rolls back anyway, and throws <b>UnexpectedRollbackException</b>. Catching an exception does not undo the rollback mark. If inner work is optional, run it with REQUIRES_NEW (its own tx), or don't make it transactional.`},
{hl:{tx1:[7,8,10]}, th:[['tx#3','COMMITTED:bad','IOException is checked']], log:['✘ meta row committed although upload failed'],
 say:`<b>Default rollback rule:</b> roll back on <code>RuntimeException</code> and <code>Error</code> only. <b>Checked exceptions commit</b> (a holdover from EJB). Add <code>rollbackFor = Exception.class</code>, or throw unchecked exceptions. And if you <b>catch</b> an exception inside the method without rethrowing, there's no rollback at all.`},
{th:[], g:[G('Other settings',['readOnly = true','Hibernate skips dirty checking; may route to a replica'],['isolation','READ_COMMITTED (Postgres default) / REPEATABLE_READ / SERIALIZABLE'],['timeout','seconds before rollback']), G('Production gotchas',['HTTP call inside a tx','holds DB locks + a connection for seconds','bad'],['pool size 10, slow tx','threads wait for connections → timeouts','bad'],['@Transactional on controller','tx too wide','bad'],['fix','do remote calls outside; keep tx short','ok'])],
 say:`For an SDE-2 answer, mention <b>transaction scope</b>: keep transactions short, never wait on a network call while holding a connection and row locks, and remember that Hikari's default pool of 10 connections is easy to exhaust. Do the external call first (or after commit through an outbox, 5.13).`}
],
keep:[`REQUIRED joins or starts; REQUIRES_NEW suspends + new connection; NESTED = savepoint.`,`Inner REQUIRED failure marks rollback-only → catching it still ends in UnexpectedRollbackException.`,`Rollback only on unchecked by default; rollbackFor = Exception.class. Keep tx short.`]}, {
  imp: 'must',
  theory: TH(`@Transactional makes a method run inside a database transaction (all its changes commit together or roll back together), and propagation decides what happens when transactional methods call each other.`,
`<p>A <b>transaction</b> groups database operations so they're all-or-nothing: debit one account and credit another, or neither. <code>@Transactional</code> tells Spring's proxy to begin a transaction before your method, commit if it returns normally, and roll back if it throws an unchecked exception.</p>
<p><b>Propagation</b> answers "what if a transaction is already running?". <b>REQUIRED</b> (default) joins it. <b>REQUIRES_NEW</b> pauses it and starts an independent one (on a separate connection). <b>NESTED</b> uses a savepoint inside the same one.</p>`,
[[`Commit / rollback`,`Make changes permanent / undo them.`],[`Propagation`,`How a method's transaction relates to an existing one.`],[`Rollback-only`,`A shared transaction marked to roll back because an inner part failed.`],[`Isolation`,`How much concurrent transactions see of each other (READ COMMITTED…).`]],
[`Proxy gets a connection from the pool and turns off auto-commit.`,`Your method runs; repositories use the same connection (bound to the thread).`,`Normal return → commit. RuntimeException → rollback. Checked exception → commit (by default).`,`The connection goes back to the pool.`],
[`Put @Transactional on service methods, keep transactions short, and never call slow remote services inside them (6.4).`,`Use <code>rollbackFor = Exception.class</code> if checked exceptions should roll back.`,`Use REQUIRES_NEW for audit logs that must survive a rollback.`],
[`Catching an inner exception and expecting the outer transaction to commit (UnexpectedRollbackException).`,`@Transactional on private methods or self-invoked methods.`]),
  quiz: [
    [`A @Transactional method throws a checked <code>IOException</code>. By default?`,[`It rolls back`,`It rolls back only if the method declares throws IOException`,`It's retried`,`It commits: only unchecked exceptions and Errors roll back by default`],3,`Use rollbackFor = Exception.class if needed.`,'E'],
    [`An audit row must be saved even if the business transaction rolls back. Propagation?`,[`REQUIRES_NEW`,`NESTED`,`REQUIRED`,`SUPPORTS`],0,`REQUIRES_NEW suspends the outer tx and commits on its own connection. NESTED is a savepoint, which rolls back with the outer.`,'M'],
    [`Outer @Transactional (REQUIRED) calls inner @Transactional (REQUIRED), which throws a RuntimeException. Outer catches it and returns normally. Result?`,[`Outer commits everything, including inner's writes`,`Inner's work rolls back, but outer still commits`,`UnexpectedRollbackException: tx is rollback-only`,`Nothing is saved, and no exception surfaces`],2,`Both share one physical transaction; the inner failure poisons it.`,'H'],
    [`What does @Transactional do on success?`,[`Rolls back`,`Commits`,`Nothing`,`Retries`],1,`And rolls back on unchecked exceptions.`,'E'],
    [`Default propagation?`,[`REQUIRES_NEW`,`REQUIRED`,`NESTED`,`NEVER`],1,`Join an existing transaction or start one.`,'E'],
    [`MANDATORY propagation means?`,[`Always starts a new transaction, suspending any existing one`,`Must run inside an existing transaction, otherwise an exception`,`Runs without a transaction, throwing if one already exists`,`Joins a transaction if present, otherwise runs non-transactionally`],1,`Guards methods that must not run alone.`,'M'],
    [`@Transactional on a private method?`,[`Works, but only when called from another bean`,`Ignored: proxies can't intercept private methods`,`Fails at startup with a BeanCreationException`,`Works, but the transaction is always read-only`],1,`Same for self-invocation.`,'E'],
    [`Why keep transactions short?`,[`Hibernate flushes only at commit, so long ones lose writes`,`They hold connections and locks, blocking others and draining pools`,`The JDBC driver aborts any transaction older than a few seconds`,`Long ones bypass the first-level cache and reload every entity`],1,`See 6.4.`,'M'],
  ],
  quizAdv: [
    [`NESTED vs REQUIRES_NEW, when the outer transaction rolls back?`,[`Both inner results survive`,`NESTED rolls back; REQUIRES_NEW stays`,`Both inner results roll back`,`REQUIRES_NEW rolls back; NESTED stays`],1,`NESTED is a savepoint in the same transaction.`,'H'],
    [`<code>@Transactional(readOnly = true)</code> with Hibernate does?`,[`Blocks all writes at the DB`,`Opens a second read connection`,`Skips dirty checking (manual flush)`,`Nothing at all`],2,`Flush mode becomes manual; whether writes fail depends on the database.`,'H'],
    [`How do you roll back without throwing?`,[`TransactionSynchronizationManager.setActualTransactionActive(false)`,`TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`,`entityManager.getTransaction().rollback() inside the method`,`TransactionAspectSupport.currentTransactionStatus().flush()`],1,`Rarely needed; usually throw.`,'H'],
    [`@Transactional(timeout = 5) does what?`,[`Retries the transaction up to 5 times before rolling back`,`Rolls back if it runs over 5 seconds (checked at statement boundaries)`,`Waits 5 seconds for row locks, then continues without them`,`Kills the database session after 5 idle seconds in the pool`],1,`A safety net for runaway transactions.`,'H'],
  ],
});
