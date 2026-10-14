/* 8.1 Transactions and isolation levels */
topic('8', { no:'8.1', title:'Transactions and isolation levels', imp:'must', idea:`Three transactions run at once against one table. See dirty reads, non-repeatable reads and phantoms appear or disappear as the isolation level goes up, and what PostgreSQL and MySQL actually do.`,
actors:'Transactions', stateTitle:'What T1 sees at each isolation level', logTitle:'Results',
codes:{a:`-- account 1: balance 100, branch PUNE   (3 accounts in PUNE)
T1: BEGIN;
T1: SELECT balance FROM account WHERE id = 1;            -- read A
T2: BEGIN; UPDATE account SET balance = 50 WHERE id = 1;
T1: SELECT balance FROM account WHERE id = 1;            -- read B (T2 not committed)
T2: COMMIT;
T1: SELECT balance FROM account WHERE id = 1;            -- read C (T2 committed)
T3: INSERT INTO account VALUES (9, 70, 'PUNE'); COMMIT;
T1: SELECT count(*) FROM account WHERE branch = 'PUNE';  -- read D
T1: COMMIT;`},
steps:[
{hl:{T1:[2]}, th:[['T1','RUN:ok','report: reads twice'],['T2','NEW:dim','transfer'],['T3','NEW:dim','new account']], g:[G('ACID',['Atomic','all or nothing'],['Consistent','constraints hold before and after'],['Isolated','concurrent transactions don\'t see each other\'s half-done work','hot'],['Durable','committed = survives a crash'])],
 say:`A <b>transaction</b> groups statements into one all-or-nothing unit. The "I" in ACID, <b>isolation</b>, is a dial: perfect isolation (as if transactions ran one after another) is slow, so databases offer weaker levels that allow some <b>anomalies</b>. T1 is a report that reads the same data several times.`},
{hl:{T1:[3]}, g:[G('Read A',['every level','100'])], log:['A = 100'],
 say:`T1 reads account 1: balance 100. Nothing interesting yet.`},
{hl:{T2:[4]}, th:[['T1','RUN:ok',''],['T2','RUN:warn','updated, NOT committed'],['T3','NEW:dim','']], g:[G('account 1',['committed value','100'],['T2\'s pending value','50','hot'],['row lock','held by T2'])],
 say:`T2 updates the balance to 50 but hasn't committed. It might still roll back. The database keeps both versions: the committed 100, and T2's uncommitted 50.`},
{hl:{T1:[5]}, g:[G('Read B',['READ UNCOMMITTED','50 → dirty read','bad'],['READ COMMITTED','100','ok'],['REPEATABLE READ','100','ok'],['SERIALIZABLE','100','ok'])], log:['B = 100 (or 50 under READ UNCOMMITTED)'],
 say:`<b>Dirty read:</b> seeing another transaction's <i>uncommitted</i> data. Only READ UNCOMMITTED allows it; if T2 then rolled back, T1 would have used a value that never existed. (PostgreSQL treats READ UNCOMMITTED as READ COMMITTED, so it never returns dirty data.)`},
{hl:{T2:[6],T1:[7]}, th:[['T1','RUN:ok',''],['T2','TERM:ok','committed'],['T3','NEW:dim','']], g:[G('Read C',['READ COMMITTED','50 → non-repeatable read','bad'],['REPEATABLE READ','100 (same snapshot)','ok'],['SERIALIZABLE','100','ok'])], log:['C = 50 under READ COMMITTED, 100 under REPEATABLE READ'],
 say:`T2 commits. Under <b>READ COMMITTED</b> every statement sees the latest committed data, so T1 now reads 50: the <b>same query in the same transaction gave a different answer</b> (a non-repeatable read). Under <b>REPEATABLE READ</b> T1 keeps reading from the snapshot taken at its first read, so it still sees 100.`},
{hl:{T3:[8],T1:[9]}, th:[['T1','RUN:ok',''],['T2','TERM:ok',''],['T3','TERM:ok','inserted + committed']], g:[G('Read D: count of PUNE accounts',['READ COMMITTED','4 → phantom row','bad'],['REPEATABLE READ (SQL standard)','may be 4 (phantoms allowed)'],['REPEATABLE READ (PostgreSQL, MySQL InnoDB)','3 (snapshot)','ok'],['SERIALIZABLE','3','ok'])], log:['D = 4 under READ COMMITTED, 3 under snapshot-based REPEATABLE READ'],
 say:`A <b>phantom</b> is a new row that appears in a repeated range query. The SQL standard allows phantoms at REPEATABLE READ, but PostgreSQL's and MySQL InnoDB's snapshot-based implementations don't show them to plain reads. SERIALIZABLE forbids them everywhere.`},
{hl:{T1:[10]}, th:[['T1','TERM:ok','committed'],['T2','TERM:ok',''],['T3','TERM:ok','']], g:[G('Defaults',['PostgreSQL, Oracle, SQL Server','READ COMMITTED'],['MySQL InnoDB','REPEATABLE READ']), G('Higher levels cost',['REPEATABLE READ (Postgres)','"could not serialize access" errors on conflicting updates'],['SERIALIZABLE','more aborts; app must retry','hot'])],
 say:`Higher isolation isn't free. In PostgreSQL, REPEATABLE READ and SERIALIZABLE <b>abort</b> a transaction that would break the rules, with a serialization error, so the application must retry it. Know your database's default: PostgreSQL uses READ COMMITTED, MySQL InnoDB uses REPEATABLE READ.`},
{th:[], g:[G('In practice (Spring)',['@Transactional(isolation = …)','per method, if you need it'],['usual choice','default READ COMMITTED','ok'],['protect updates','conditional UPDATE / @Version / SELECT … FOR UPDATE (6.1, 5.5)','ok'],['serialization failures','retry the whole transaction','ok'])],
 say:`<b>Say it:</b> "Isolation levels trade consistency for concurrency. READ COMMITTED prevents dirty reads, REPEATABLE READ also gives a stable snapshot, SERIALIZABLE behaves as if transactions ran one at a time. Most apps keep READ COMMITTED and protect specific updates with optimistic locking or conditional updates, retrying on conflicts."`}
],
keep:[`Anomalies: dirty read (uncommitted data), non-repeatable read (same row changes), phantom (new rows in a range).`,`READ UNCOMMITTED < READ COMMITTED (Postgres default) < REPEATABLE READ (MySQL default) < SERIALIZABLE.`,`Higher levels can abort with serialization errors: retry. Usually: READ COMMITTED + optimistic locking / conditional updates.`]}, {
  imp: 'good',
  theory: TH(`A transaction makes several database changes succeed or fail together; the isolation level decides how much concurrent transactions can see of each other's work.`,
`<p>Moving money means two updates: subtract here, add there. If the system crashes in between, money vanishes. A <b>transaction</b> wraps both so they commit together or not at all. That's the A (atomicity) in <b>ACID</b>.</p>
<p>Many transactions run at the same time. Perfect <b>isolation</b> would make each behave as if it ran alone, but that requires lots of locking or aborting. So databases offer levels: <b>READ COMMITTED</b> (never see uncommitted data), <b>REPEATABLE READ</b> (a stable snapshot for the whole transaction), <b>SERIALIZABLE</b> (as if one at a time). Each level rules out more <b>anomalies</b>.</p>`,
[[`ACID`,`Atomicity, Consistency, Isolation, Durability.`],[`Dirty read`,`Reading another transaction's uncommitted change.`],[`Non-repeatable read`,`The same row read twice gives different values.`],[`Phantom read`,`A repeated range query returns new rows.`],[`MVCC`,`Multi-version concurrency control: readers see a snapshot, writers create new versions.`],[`Serialization failure`,`The DB aborts a transaction to keep a high isolation guarantee.`]],
[`BEGIN starts a transaction (Spring does this for @Transactional).`,`Reads see data according to the isolation level (statement-level or transaction-level snapshot).`,`Writes take row locks; other writers to the same row wait.`,`COMMIT makes changes durable and visible; ROLLBACK discards them.`],
[`Keep transactions short and use the default level unless you have a reason.`,`Protect read-modify-write with optimistic locking, conditional updates or SELECT … FOR UPDATE.`,`Retry transactions that fail with deadlock or serialization errors.`],
[`Assuming @Transactional alone prevents lost updates.`,`Long transactions holding locks and connections.`,`Not knowing your database's default level.`]),
  quiz: [
    [`What is a dirty read?`,[`Reading a row that another transaction deleted and committed`,`Reading another transaction's uncommitted change`,`Reading the same row twice and getting different values`,`Reading a row while it's being indexed`],1,`Only READ UNCOMMITTED allows it.`,'E'],
    [`Under READ COMMITTED, T1 reads a balance, T2 updates and commits it, T1 reads again. T1's second read?`,[`The old value: READ COMMITTED keeps a snapshot`,`An error`,`It blocks until T1 commits`,`The new value: a non-repeatable read`],3,`Each statement sees the latest committed data.`,'M'],
    [`What is PostgreSQL's default isolation level?`,[`READ COMMITTED`,`REPEATABLE READ`,`SERIALIZABLE`,`READ UNCOMMITTED`],0,`MySQL InnoDB defaults to REPEATABLE READ.`,'H'],
    [`What does atomicity guarantee?`,[`Concurrent transactions never see each other's changes`,`All statements in a transaction take effect, or none do`,`Committed changes survive a crash or power loss`,`Each statement is applied the moment it executes`],1,`The A in ACID.`,'E'],
    [`Which level prevents dirty reads but allows non-repeatable reads?`,[`READ UNCOMMITTED`,`READ COMMITTED`,`REPEATABLE READ`,`SERIALIZABLE`],1,`The most common default.`,'E'],
    [`What is a phantom read?`,[`A row disappearing after another transaction deletes it`,`New rows appearing when a range query is repeated`,`Reading data another transaction hasn't committed yet`,`A row's value changing when the same row is re-read`],1,`Prevented by SERIALIZABLE.`,'M'],
    [`MySQL InnoDB's default isolation level?`,[`READ COMMITTED`,`REPEATABLE READ`,`SERIALIZABLE`,`READ UNCOMMITTED`],1,`PostgreSQL defaults to READ COMMITTED.`,'M'],
    [`Set isolation for one Spring method?`,[`@Transactional(propagation = Propagation.REQUIRES_NEW)`,`@Transactional(isolation = Isolation.REPEATABLE_READ)`,`spring.jpa.properties.isolation in application.yml`,`@Lock(LockModeType.PESSIMISTIC_READ) on the method`],1,`Per transaction.`,'M'],
  ],
  quizAdv: [
    [`PostgreSQL at REPEATABLE READ: two transactions update the same row concurrently. The second one?`,[`Overwrites the first silently once the first one commits`,`Waits, then fails with "could not serialize access due to concurrent update"`,`Deadlocks and both transactions are rolled back immediately`,`Waits, then sees the first one's change and applies its own`],1,`Snapshot isolation won't let it update a row changed after its snapshot; retry.`,'H'],
    [`Write skew: two doctors each check "at least one other doctor is on call" and both go off call. Which level prevents it?`,[`READ COMMITTED`,`REPEATABLE READ (snapshot)`,`SERIALIZABLE`,`None`],2,`Each transaction's snapshot looks fine; only serializable detects the conflict.`,'H'],
    [`What is MVCC?`,[`Model-view-controller-cache: a pattern for caching query results`,`Multi-version concurrency control: readers see snapshots while writers create new row versions`,`A locking scheme where readers take shared locks that block writers`,`A replication mode where every write goes to multiple versions of the DB`],1,`Readers don't block writers.`,'H'],
    [`Lost update: two transactions read 100, both write 100 − 10. Which isolation catches it in PostgreSQL?`,[`READ COMMITTED (the second write re-reads and applies on top)`,`REPEATABLE READ (the second write fails with a serialization error)`,`READ UNCOMMITTED (the second write sees the first's dirty value)`,`None of them: only explicit SELECT ... FOR UPDATE catches it`],1,`Or use SELECT … FOR UPDATE / @Version.`,'H'],
  ],
});
