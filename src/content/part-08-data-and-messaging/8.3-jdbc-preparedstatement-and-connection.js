/* 8.3 JDBC, PreparedStatement and connection pooling */
topic('8', { no:'8.3', title:'JDBC, PreparedStatement and connection pooling', imp:'good', idea:`What happens underneath JPA and JdbcTemplate: borrow a connection from the pool, run a parameterised query, read rows, give the connection back. Plus SQL injection and leaked connections.`,
actors:'Request threads', stateTitle:'Connection pool (HikariCP, max 4 shown)', logTitle:'SQL sent',
codes:{a:`String sql = "SELECT id, total FROM orders WHERE customer_id = ?";
try (Connection con = dataSource.getConnection();          // borrow from the pool
     PreparedStatement ps = con.prepareStatement(sql)) {
  ps.setLong(1, customerId);                               // bind the parameter
  try (ResultSet rs = ps.executeQuery()) {
    while (rs.next()) {
      orders.add(new Order(rs.getLong("id"), rs.getBigDecimal("total")));
    }
  }
}                                                          // returned to the pool

// NEVER build SQL by concatenation:
String bad = "SELECT * FROM users WHERE name = '" + name + "'";`},
steps:[
{hl:{t1:[1]}, th:[['t1','RUN','GET /customers/42/orders']], g:[G('JDBC layers',['your code / JPA / JdbcTemplate','↓'],['DataSource (HikariCP pool)','↓'],['Connection','one DB session (TCP + auth)'],['PreparedStatement','one SQL statement'],['ResultSet','a cursor over result rows'])],
 say:`<b>JDBC</b> is Java's standard API for talking to relational databases. Every higher layer (JPA, Spring Data, JdbcTemplate) ends up here. A database-specific <b>driver</b> implements it for PostgreSQL, MySQL and so on.`},
{hl:{t1:[2]}, g:[G('Pool',C('connections',[['c1 · t1','hot'],['c2 · idle','ok'],['c3 · idle','ok'],['c4 · idle','ok']]),['cost of a NEW connection','TCP + TLS + auth ≈ 10–50 ms','bad'],['cost of borrowing','≈ microseconds','ok'])],
 say:`Opening a database connection is slow (network handshake, TLS, authentication) and each one uses memory on the database. A <b>connection pool</b> keeps a few open and lends them out. <code>getConnection()</code> borrows one; <code>close()</code> gives it back instead of really closing it.`},
{hl:{t1:[3,4]}, g:[G('PreparedStatement',['SQL','… WHERE customer_id = ?'],['parameter 1','42 (sent separately, as a value)','ok'],['plan','can be reused for other ids'])], log:['SELECT id, total FROM orders WHERE customer_id = $1   [$1 = 42]'],
 say:`A <b>PreparedStatement</b> sends the SQL with <code>?</code> placeholders, and the values separately. The database never treats the value as SQL code, and it can reuse the parsed statement.`},
{hl:{t1:[5,6,7]}, g:[G('ResultSet cursor',['row 1','id 1001 · 300.00'],['row 2','id 1007 · 125.50'],['rs.next()','moves to the next row; false at the end'])],
 say:`<code>executeQuery</code> returns a <b>ResultSet</b>, a cursor positioned before the first row. Each <code>next()</code> advances it; you read columns by name or position and map them to objects. This is exactly the work JPA's mapping and Spring's <code>RowMapper</code> do for you.`},
{hl:{t1:[10]}, th:[['t1','TERM:ok','response sent']], g:[G('Pool',C('connections',[['c1 · idle','ok'],['c2 · idle','ok'],['c3 · idle','ok'],['c4 · idle','ok']]))],
 say:`try-with-resources closes ResultSet, PreparedStatement and Connection in reverse order, even on exceptions. Closing the connection <b>returns it to the pool</b>, ready for the next request.`},
{hl:{t1:[13]}, th:[['t1','RUN:bad','name = x\' OR \'1\'=\'1']], g:[G('String concatenation',['input','x\' OR \'1\'=\'1'],['SQL becomes','… WHERE name = \'x\' OR \'1\'=\'1\'','bad'],['result','every user returned','bad'],['fix','PreparedStatement parameters (or JPA named parameters)','ok'])], log:['SELECT * FROM users WHERE name = \'x\' OR \'1\'=\'1\''],
 say:`<b>SQL injection.</b> Concatenating user input into SQL lets an attacker change the query itself. This classic input turns the condition into "always true" and dumps every user; worse inputs can delete data. Always use parameters, including in <code>@Query</code> strings and native queries.`},
{th:[['t1','RUN','forgot to close'],['t2','TIMED','waiting for a connection'],['t3','TIMED','waiting'],['t4','TIMED','waiting']], g:[G('Pool',C('connections',[['c1 · leaked','bad'],['c2 · leaked','bad'],['c3 · leaked','bad'],['c4 · leaked','bad']]),['getConnection()','waits up to connectionTimeout (30 s), then fails','bad'])], log:['HikariPool-1 - Connection is not available, request timed out after 30000ms','Connection leak detection triggered for … (leak-detection-threshold)'],
 say:`If code forgets to close connections, they're never returned: a <b>connection leak</b>. Once the pool is empty, every request waits and then fails, which looks just like the slow-transaction outage in 6.4. HikariCP's <code>leak-detection-threshold</code> logs the stack trace of whoever held a connection too long.`},
{th:[], g:[G('What frameworks add',['transactions','con.setAutoCommit(false) … commit()/rollback() = @Transactional','ok'],['JdbcTemplate','connection + statement + mapping + exception translation'],['batching','addBatch / executeBatch for bulk inserts','ok'],['pool sizing','small (10–20), from DB limits and Little\'s law (6.4)'])],
 say:`A transaction at this level is <code>setAutoCommit(false)</code>, then <code>commit()</code> or <code>rollback()</code> on the same connection, which is exactly what <code>@Transactional</code> does on the thread's borrowed connection. For bulk work, batch statements instead of sending thousands of single inserts.`}
],
keep:[`Connection = expensive DB session → always via a pool (HikariCP); close() returns it.`,`PreparedStatement with ? parameters: safe from SQL injection and reusable. Never concatenate input into SQL.`,`try-with-resources for Connection/Statement/ResultSet; leaks exhaust the pool. Transaction = autoCommit(false) + commit/rollback.`]}, {
  imp: 'good',
  theory: TH(`JDBC is Java's low-level API for relational databases: borrow a connection, run a prepared statement with parameters, read the result set, and give the connection back to the pool.`,
`<p>Every Java database library, from JPA to Spring Data, uses <b>JDBC</b> underneath. The flow is always the same: get a <b>Connection</b> (a session with the database), create a <b>PreparedStatement</b> with <code>?</code> placeholders, bind values, execute, and read rows from the <b>ResultSet</b>.</p>
<p>Opening a real connection is slow, so applications use a <b>connection pool</b> (HikariCP in Spring Boot) that keeps a few connections open and lends them out. "Closing" a pooled connection returns it to the pool.</p>`,
[[`Driver`,`Database-specific JDBC implementation.`],[`DataSource`,`Factory for connections; in practice a pool.`],[`PreparedStatement`,`Parameterised SQL; prevents injection.`],[`ResultSet`,`Cursor over returned rows.`],[`SQL injection`,`Attacker-controlled input changing the SQL itself.`],[`Connection leak`,`A connection never returned to the pool.`]],
[`Borrow a connection from the DataSource.`,`Prepare SQL with placeholders and bind values.`,`Execute; iterate the ResultSet and map rows.`,`Close everything with try-with-resources (connection returns to the pool).`],
[`Prefer JdbcTemplate or JPA over raw JDBC; know JDBC to debug them.`,`Use batch updates for bulk inserts.`,`Configure pool size, connection timeout and leak detection.`],
[`Concatenating user input into SQL.`,`Forgetting to close connections.`,`Huge pools that overload the database.`]),
  quiz: [
    [`What does <code>close()</code> on a connection from HikariCP do?`,[`Closes the TCP connection to the database`,`Nothing`,`Returns it to the pool`,`Commits the transaction`],2,`The pool wraps connections; close hands it back for reuse.`,'E'],
    [`Why use PreparedStatement parameters instead of string concatenation?`,[`They avoid round trips by batching all queries into one call`,`They prevent SQL injection and let the DB reuse the parsed statement`,`They escape results automatically and return them faster`,`They're required for JPA and Spring to manage the transaction`],1,`Values are sent as data, never parsed as SQL.`,'M'],
    [`Requests start failing with "Connection is not available, request timed out after 30000ms" while the DB is idle. Likely cause?`,[`The database is down, so new connections can't be opened`,`Too many indexes slow every query past the 30 second limit`,`Long GC pauses stop the pool's housekeeping thread`,`Connections are leaked or held too long, so the pool is empty`],3,`Enable leak detection; check for unclosed connections or long transactions (6.4).`,'H'],
    [`What does a JDBC driver do?`,[`Pools and reuses connections for the app`,`Implements JDBC for a specific database`,`Translates JPQL into native SQL queries`,`Compiles SQL strings into Java bytecode`],1,`e.g. the PostgreSQL driver.`,'E'],
    [`Which object runs parameterised SQL?`,[`Statement`,`PreparedStatement`,`ResultSet`,`DriverManager`],1,`With ? placeholders.`,'E'],
    [`How do you read the next row of a ResultSet?`,[`rs.get()`,`rs.next()`,`rs.read()`,`rs.row()`],1,`Returns false when there are no more rows.`,'E'],
    [`Default pool in Spring Boot?`,[`Tomcat JDBC`,`HikariCP`,`C3P0`,`DBCP 1`],1,`Fast and well tuned.`,'M'],
    [`What does <code>con.setAutoCommit(false)</code> start?`,[`A new physical connection reserved for writes`,`A manual transaction: you must commit or roll back`,`Read-only mode until you call setAutoCommit(true)`,`Statement batching: queries run on executeBatch()`],1,`What @Transactional does for you.`,'M'],
  ],
  quizAdv: [
    [`Inserting 100,000 rows one statement at a time is slow. Better?`,[`Spread inserts across many threads, each with its own connection`,`Batch with addBatch/executeBatch (or COPY), inside one transaction`,`Turn autoCommit on so each row commits and frees its locks sooner`,`Raise maximumPoolSize so more inserts can run in parallel`],1,`Fewer round trips and commits.`,'M'],
    [`What does <code>@Transactional</code> do at the JDBC level?`,[`Opens a dedicated connection pool for each transactional method`,`Prefixes each SQL statement with BEGIN and COMMIT strings`,`Runs each statement in its own transaction, retried on error`,`Borrows a connection, disables autoCommit, binds it to the thread, then commits or rolls back`],3,`All repository calls in that thread reuse that connection.`,'H'],
    [`What does <code>maximumPoolSize</code> too large risk?`,[`Nothing serious: idle connections cost the database nothing`,`Overloading the database with connections and context switching, slowing everything`,`Hikari ignores values above the CPU count, so it has no effect`,`The pool opens all connections lazily, delaying the first queries`],1,`More connections isn't more throughput.`,'H'],
    [`Why use <code>getBigDecimal</code> instead of <code>getDouble</code> for money columns?`,[`getDouble rounds every value to two decimal places`,`Exact decimal values without binary floating point errors`,`JDBC drivers reject getDouble on NUMERIC columns`,`BigDecimal is faster since it skips floating point`],1,`See 1.10.`,'M'],
  ],
});
