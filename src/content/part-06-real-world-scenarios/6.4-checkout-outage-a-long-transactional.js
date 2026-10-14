/* 6.4 Checkout outage: a long @Transactional drains the connection pool */
topic('6', { no:'6.4', title:'Checkout outage: a long @Transactional drains the connection pool', idea:`A slow payment provider plus an HTTP call inside <code>@Transactional</code> holds every DB connection. Unrelated endpoints and health checks start failing too. Then fix it with short transactions and after-commit side effects.`,
actors:'Request threads', stateTitle:'Connection pool and side effects', dgTitle:'Where the time goes (per checkout)',
vb:'0 0 580 170',
nodes:{tx:{x:290,y:30,label:'@Transactional checkout() holds 1 DB connection the whole time',w:560,h:30,fs:11}, sql1:{x:55,y:95,label:'SQL\n15 ms',w:90,h:44}, pay:{x:225,y:95,label:'payment HTTP\n200 ms → 10 s',w:230,h:44}, mail:{x:440,y:95,label:'SMTP\n1.3 s',w:180,h:44}, sql2:{x:555,y:95,label:'commit',w:50,h:44,fs:10}},
edges:[],
codes:{a:`@Transactional
public Receipt checkout(Cart cart) {
  Order order = orders.save(Order.from(cart));          // gets a DB connection
  inventory.reserve(cart.items());                      // SQL
  PaymentResult r = paymentClient.charge(cart.total()); // HTTP: 200 ms … 10 s
  order.markPaid(r.txId());
  mailer.sendConfirmation(order);                       // SMTP: ~1.3 s
  return Receipt.of(order);
}                                                       // commit, connection back
# spring.datasource.hikari.maximum-pool-size: 10
# load: 5 checkouts / second per pod`,
b:`public Receipt checkout(Cart cart) {                    // NOT @Transactional
  Order order = tx.execute(s -> {                      // tx 1: ~15 ms
    inventory.reserve(cart.items());
    return orders.save(Order.pending(cart));
  });
  PaymentResult r = paymentClient.charge(order.id(), cart.total()); // no connection held
  return tx.execute(s -> {                             // tx 2: ~10 ms
    Order o = orders.findById(order.id()).orElseThrow();
    o.markPaid(r.txId());
    events.publishEvent(new OrderPaid(o.id()));        // email after commit
    return Receipt.of(o);
  });
}

@Async @TransactionalEventListener(phase = AFTER_COMMIT)
void onPaid(OrderPaid e) { mailer.sendConfirmation(e.orderId()); }`},
steps:[
{hl:{'req-1':[1,3]}, th:[['req-1','RUN','checkout'],['req-2','RUN','GET /cars'],['health','RUN:ok','/actuator/health']], d:{type:'graph',on:['tx'],labels:{pay:'payment HTTP\n200 ms'}},
 g:[G('Hikari pool (max 10)',['connections in use (avg)','7.5','hot'],['threads waiting for a connection','0','ok']), G('Little\'s law',['in use = arrival rate × hold time',''],['5 / s × 1.5 s','= 7.5 connections'])],
 say:`<code>@Transactional</code> grabs a DB connection at the first query and holds it <b>until commit</b>. A checkout holds it for ~1.5 s: 15 ms of SQL, 200 ms of payment HTTP, 1.3 s of SMTP. <b>Little's law</b>: connections in use = arrival rate × hold time = 5/s × 1.5 s ≈ <b>7.5 of 10</b>. It works, barely, and nobody knows how close it is.`},
{hl:{'req-1':[5]}, th:[['req-1','WAITING:warn','HTTP read, connection idle but held'],['req-2','RUN','GET /cars'],['health','RUN:ok','']], d:{type:'graph',on:['tx'],bad:['pay'],labels:{pay:'payment HTTP\n10 s (provider slow)'}},
 g:[G('Hikari pool (max 10)',['connections needed','5 / s × 11.3 s ≈ 57','bad'],['connections in use','10 / 10','bad'],['threads waiting for a connection','47','bad'])],
 say:`At 20:00 the payment provider slows to <b>10 s</b> per call. Hold time is now ~11.3 s, so we'd need <b>57</b> connections and have 10. Each one sits <b>idle inside a transaction</b> while its thread waits on HTTP. The database is fine and nearly idle: the bottleneck is our pool.`},
{hl:{'req-2':[3]}, th:[['req-1','WAITING:warn','HTTP read'],['req-2','TIMED:bad','getConnection() 30 s'],['health','TIMED:bad','getConnection() 30 s']], d:{type:'graph',bad:['tx','pay']},
 g:[G('Hikari pool (max 10)',['connections in use','10 / 10','bad'],['threads waiting','190','bad']), G('Blast radius',['GET /cars (read only)','also waits → 500','bad'],['/actuator/health (DB check)','times out','bad'],['Kubernetes','restarts the pod','bad'],['in-flight payments','outcome unknown','bad'])], log:['HikariPool-1 - Connection is not available, request timed out after 30000ms','Liveness probe failed: timeout','Killing container checkout-6b8d…'],
 say:`Now the outage spreads. <b>Every</b> endpoint that touches the database waits for the same 10 connections, including the read-only catalogue and the health check. Health checks fail, Kubernetes restarts the pod, and payments in flight are cut off with an <b>unknown outcome</b>. A slow third party has taken down checkout <i>and</i> browsing.`},
{hl:{'req-1':[7,9]}, th:[['req-1','TERM:bad','email sent, then commit failed']], d:{type:'graph',on:['mail'],bad:['sql2']},
 g:[G('Second bug: side effects inside the tx',['payment','charged ✔','hot'],['confirmation email','sent ✔','hot'],['commit','failed (timeout / constraint)','bad'],['database','no order row','bad'],['customer sees','"Order confirmed" + a charge, no order','bad'])], log:['mail: sent confirmation for order 9921','ERROR: could not commit: connection closed','✘ charged + emailed, but order rolled back'],
 say:`A second, quieter bug. The email goes out at line 7 <b>before</b> the commit. If the commit fails, the database rolls back but the <b>email and the card charge can't be rolled back</b>. The customer was charged and told "confirmed" for an order that doesn't exist.`},
{th:[['oncall','RUN:ok','reading metrics + thread dump']],
 g:[G('Metrics',['hikaricp_connections_active','10 = max','bad'],['hikaricp_connections_pending','190','bad'],['hikaricp_connections_usage p99','11.3 s','bad'],['DB CPU','8%']), G('Thread dump',['10 threads','SocketInputStream.read in PaymentClient, inside checkout()'],['190 threads','HikariPool.getConnection'])], log:['tip: spring.datasource.hikari.leak-detection-threshold=2000 logs where a connection was held > 2 s'],
 say:`The diagnosis is in the pool metrics: <b>active = max, pending high, usage time long, database CPU low</b>. Connections are held, not used. The thread dump confirms it: ten threads in a socket read <i>inside</i> <code>checkout()</code>, everyone else in <code>getConnection</code>. Hikari's leak-detection threshold logs the stack trace of long holders.`},
{cv:'b', hl:{'req-1':[2,3,4,5,6]}, th:[['req-1','WAITING:ok','HTTP, no connection held'],['req-2','RUN:ok','GET /cars'],['health','RUN:ok','']], d:{type:'graph',ok:['sql1','sql2'],on:['pay'],labels:{tx:'two short transactions, no connection held during HTTP',pay:'payment HTTP\n10 s (no tx)',mail:'SMTP after commit\n(async)'}},
 g:[G('Hikari pool (max 10)',['hold time per checkout','~25 ms','ok'],['connections needed','5 / s × 0.025 s ≈ 0.13','ok'],['threads waiting','0','ok']), G('Payment slow?',['checkout','slow (10 s), but isolated','ok'],['catalogue + health','unaffected','ok'])], logReset:true,
 say:`<b>The fix: keep remote calls out of transactions.</b> Transaction 1 reserves stock and saves a PENDING order (15 ms). The payment call runs with <b>no connection held</b>, using the order id as its idempotency key (5.13c). Transaction 2 marks it paid (10 ms). Hold time drops from 11 s to 25 ms. A slow provider now only makes checkout slow; it can't starve the rest of the app.`},
{hl:{'req-1':[10,15,16]}, th:[['req-1','TERM:ok','receipt returned'],['mailer','RUN:ok','after commit, async']],
 g:[G('Side effects',['email','only after commit (AFTER_COMMIT)','ok'],['payment fails','mark FAILED + release stock (saga, 5.13b)','ok'],['crash between charge and tx 2','reconcile PENDING orders with the provider','ok']), G('Also',['HTTP client timeouts','connect 1 s, read 3 s','ok'],['circuit breaker on payments','5.13a','ok'],['spring.jpa.open-in-view','false (else the whole request holds a connection)','ok'])],
 say:`Emails are sent from an <code>@TransactionalEventListener(AFTER_COMMIT)</code>, so they only go out for committed orders. Note that <code>checkout()</code> uses <code>TransactionTemplate</code> rather than calling its own <code>@Transactional</code> methods, which would bypass the proxy (5.3). Add timeouts and a circuit breaker on the payment client, and turn off <b>open-in-view</b>.`},
{th:[], d:null,
 g:[G('Interview checklist',['no HTTP / SMTP / Kafka sends inside @Transactional','✔'],['size pools with Little\'s law','rate × hold time'],['bigger pool ≠ fix','DB max_connections is shared by all pods','bad'],['external side effects','after commit, or via an outbox (5.13b)','ok'],['every remote call','timeout + breaker','ok'])],
 say:`<b>Interview answer:</b> "Connections were held idle during a slow HTTP call inside the transaction, so the pool ran dry and every DB-using endpoint failed, including health checks. I'd move remote calls outside the transaction, keep transactions to a few milliseconds, send side effects after commit or through an outbox, and add timeouts and a breaker. Making the pool bigger just moves the problem to the database's connection limit."`}
],
keep:[`@Transactional holds a DB connection from the first query to commit. Never wait on HTTP/SMTP inside it.`,`Little's law: connections in use = rate × hold time. Long holds starve every endpoint, health checks included.`,`Short transactions; external side effects after commit (AFTER_COMMIT / outbox); timeouts + breaker; open-in-view off.`]}, {
  imp: 'must',
  theory: TH(`A database transaction holds a connection from the pool until it commits; doing slow remote calls inside it can use up every connection and take down the whole service.`,
`<p>Connection pools (HikariCP) hold a small number of DB connections, often 10. <code>@Transactional</code> takes one at the first query and keeps it until commit. If the method then calls a slow payment API, the connection sits idle but unavailable. Under load, all connections get held this way, and every other request that needs the database, even simple reads and health checks, waits and times out.</p>
<p><b>Little's law</b> tells you how many you need: connections in use = requests per second × seconds each one holds a connection.</p>`,
[[`Connection pool`,`A reusable set of DB connections (HikariCP).`],[`Little's law`,`L = λ × W: items in the system = arrival rate × time each spends.`],[`Open-in-view`,`Spring setting that keeps the persistence context open for the whole web request.`],[`After-commit side effect`,`An action (email, message) done only once the transaction succeeds.`]],
[`Keep transactions to the database work only (milliseconds).`,`Do remote calls outside transactions.`,`Send emails and messages after commit (@TransactionalEventListener or the outbox).`,`Set HTTP timeouts and circuit breakers; set <code>spring.jpa.open-in-view=false</code>.`],
[`Monitor hikaricp_connections_active, pending, and usage time.`,`Size pools from the database's connection limit across all pods.`],
[`"Fixing" it by making the pool bigger.`,`Sending emails inside the transaction.`]),
  quiz: [
    [`Why is sending a confirmation email inside <code>@Transactional</code> a correctness problem?`,[`SMTP clients aren't thread-safe inside a tx`,`Spring blocks network calls inside transactions`,`Rendering the email holds a row lock too long`,`A failed commit can't unsend the email`],3,`Use @TransactionalEventListener(AFTER_COMMIT) or an outbox.`,'E'],
    [`20 requests/s, each holding a connection for 0.5 s. Connections in use on average?`,[`20`,`10`,`40`,`0.5`],1,`Little's law: L = λ × W = 20 × 0.5 = 10.`,'M'],
    [`Hikari shows active = max and many pending threads, but DB CPU is 8%. Most likely cause?`,[`The database instance is too small`,`Missing indexes on the hot tables`,`Connections held while waiting on HTTP`,`Long GC pauses in the application`],2,`Low DB load with an exhausted pool means connections are held, not used.`,'H'],
    [`When does @Transactional borrow a DB connection?`,[`At application start, one per bean, held for the bean's life`,`At the first database access in the transaction, held until commit`,`Per SQL statement, returned to the pool after each one`,`At commit time only, when the changes are flushed to the DB`],1,`Then it's held through everything inside.`,'E'],
    [`Why is an HTTP call inside a transaction dangerous?`,[`HTTP clients roll back the transaction when a response is slow`,`The connection is held idle while waiting; slow calls drain the pool`,`The HTTP call joins the transaction and can't be retried later`,`JSON parsing inside a transaction disables Hibernate's flush`],1,`Move remote calls outside.`,'E'],
    [`Hikari error "Connection is not available, request timed out" usually means?`,[`The SQL is invalid and the driver rejected the statement`,`The pool is empty: connections are held too long or leaked`,`The query hit a deadlock and the database aborted it`,`The JDBC driver version doesn't match the database server`],1,`Check usage time metrics.`,'M'],
    [`Why does a slow checkout affect health checks?`,[`Health checks share the checkout's Tomcat thread and wait on it`,`Health checks need connections from the same exhausted pool`,`Kubernetes slows probes down whenever CPU usage is high`,`Actuator pauses health checks while a transaction is open`],1,`Blast radius of one slow dependency.`,'M'],
    [`Where should the confirmation email be sent?`,[`Inside the transaction`,`After commit (AFTER_COMMIT listener or outbox)`,`Before saving`,`In the controller before the service`],1,`Only for committed orders.`,'E'],
  ],
  quizAdv: [
    [`<code>spring.jpa.open-in-view=true</code> (the default) means?`,[`The EntityManager stays open per request`,`Lazy loading is switched off`,`Each query gets its own connection`,`Every transaction spans the request`],0,`Once used, a connection can be held through view rendering and JSON serialisation.`,'H'],
    [`20 pods × Hikari max 10, but PostgreSQL <code>max_connections</code> = 100. Effect?`,[`Hikari shares connections between pods`,`Postgres queues the extra ones`,`Nothing until 100 users`,`Pods fail to connect as they scale`],3,`200 > 100. Size pools from the DB limit, or use a pooler like PgBouncer.`,'H'],
    [`What does <code>spring.jpa.open-in-view=false</code> change?`,[`Lazy loading works in views, since the session stays open longer`,`The EntityManager closes after the service layer, not after rendering`,`JPA repositories are disabled for web controllers in the app`,`Spring stops wrapping controller methods in transactions`],1,`Boot warns when it's enabled by default.`,'H'],
    [`Payment succeeded but the app crashed before marking the order paid. Recovery?`,[`Charge again with a fresh idempotency key to be safe`,`Reconcile PENDING orders with the provider by order id or key`,`Delete PENDING orders older than an hour and email users`,`Mark every PENDING order as paid when the app restarts`],1,`Design for crashes between steps.`,'H'],
  ],
});
