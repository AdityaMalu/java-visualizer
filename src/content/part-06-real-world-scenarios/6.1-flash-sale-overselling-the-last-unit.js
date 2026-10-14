/* 6.1 Flash sale: overselling the last unit */
topic('6', { no:'6.1', title:'Flash sale: overselling the last unit', idea:`Two buyers, two pods, one item left. <code>synchronized</code> can't help across JVMs and a read-then-write in JPA sells the item twice. The fix is a conditional UPDATE that the database makes atomic.`,
actors:'Request threads (one per pod)', stateTitle:'Database and pod memory', dgTitle:'Deployment',
vb:'0 0 560 220',
nodes:{u1:{x:60,y:50,label:'buyer 1',w:90}, u2:{x:60,y:170,label:'buyer 2',w:90}, lb:{x:190,y:110,label:'load\nbalancer',w:100,h:46},
  pA:{x:330,y:50,label:'pod A\n(JVM 1)',w:100,h:46}, pB:{x:330,y:170,label:'pod B\n(JVM 2)',w:100,h:46}, db:{x:480,y:110,label:'products\nid 42',kind:'mem',w:110,h:46}},
edges:[['u1','lb'],['u2','lb'],['lb','pA'],['lb','pB'],['pA','db'],['pB','db']],
codes:{a:`@Service
class CheckoutService {
  @Transactional
  public void buy(long productId, int qty) {
    Product p = repo.findById(productId).orElseThrow();  // SELECT stock
    if (p.getStock() < qty)                               // check
      throw new SoldOutException();
    p.setStock(p.getStock() - qty);                       // act (in memory)
    orders.save(new Order(productId, qty));
  }                                                       // commit: UPDATE
}
// 2 pods behind a load balancer, stock = 1, sale starts 12:00:00`,
b:`interface ProductRepo extends JpaRepository<Product, Long> {
  @Modifying
  @Query("""
    UPDATE Product p SET p.stock = p.stock - :qty
     WHERE p.id = :id AND p.stock >= :qty""")
  int reserve(long id, int qty);              // rows affected: 1 or 0
}

@Transactional
public void buy(long productId, int qty) {
  if (repo.reserve(productId, qty) == 0)      // check + act in ONE statement
    throw new SoldOutException();
  orders.save(new Order(productId, qty));
}`},
steps:[
{th:[['A','READY','pod A request thread'],['B','READY','pod B request thread']], d:{type:'graph',on:['u1','u2','lb']},
 g:[G('DB · products',['id 42 · stock','1']), G('DB · orders',['rows','0'])],
 say:`A sneaker drop. One pair left, two buyers click "Buy" in the same millisecond. The load balancer sends one request to <b>pod A</b> and the other to <b>pod B</b>. These are two separate JVMs that share nothing except the database.`},
{hl:{A:[5],B:[5]}, th:[['A','RUN','SELECT → stock 1'],['B','RUN','SELECT → stock 1']], d:{type:'graph',on:['pA','pB'],e:[['pA','db','SELECT','hot'],['pB','db','SELECT','hot']]},
 g:[G('DB · products',['id 42 · stock','1']), G('Pod A · persistence context',['p.stock','1','hot']), G('Pod B · persistence context',['p.stock','1','hot'])],
 say:`Both transactions run <code>SELECT … FROM product WHERE id = 42</code>. A plain SELECT takes <b>no row lock</b>, and under the default <b>READ COMMITTED</b> isolation both see the last committed value: <b>1</b>.`},
{hl:{A:[6],B:[6]}, th:[['A','RUN','1 < 1? no → continue'],['B','RUN','1 < 1? no → continue']],
 say:`Both checks pass. This is the <b>check-then-act</b> race from 4.4, but spread across two machines and a network. Each pod made its decision from a value that is about to become stale.`},
{hl:{A:[8,9],B:[8,9]}, th:[['A','RUN','stock = 0 (in memory)'],['B','RUN','stock = 0 (in memory)']], d:{type:'graph',on:['pA','pB']},
 g:[G('DB · products',['id 42 · stock','1']), G('Pod A · persistence context',['p.stock','0','hot'],['new Order','pending insert']), G('Pod B · persistence context',['p.stock','0','hot'],['new Order','pending insert'])],
 say:`Each pod decrements its <b>own copy</b> of the entity in memory and queues an order insert. Nothing has reached the database yet: JPA will write at flush time, using dirty checking (5.5).`},
{hl:{A:[10]}, th:[['A','TERM','COMMIT ✔'],['B','RUN','about to commit']], d:{type:'graph',on:['pA'],e:[['pA','db','UPDATE stock=0','hot']]},
 g:[G('DB · products',['id 42 · stock','0','hot']), G('DB · orders',['rows','1 (buyer 1)','hot'])], log:['pod A: UPDATE product SET stock=0 WHERE id=42  → 1 row','pod A: INSERT INTO orders … → commit'],
 say:`Pod A flushes <code>UPDATE product SET stock = 0 WHERE id = 42</code> and commits. So far, so good.`},
{hl:{B:[10]}, th:[['A','TERM','order #1'],['B','TERM','COMMIT ✔']], d:{type:'graph',bad:['db'],e:[['pB','db','UPDATE stock=0','bad']]},
 g:[G('DB · products',['id 42 · stock','0']), G('DB · orders',['rows','2','bad'],['units sold','2 of 1','bad'])], log:['pod B: UPDATE product SET stock=0 WHERE id=42  → 1 row','pod B: INSERT INTO orders … → commit','✘ 2 orders confirmed for 1 pair: oversold'],
 say:`Pod B writes <b>its</b> computed value, also 0, and commits. The UPDATE matched the row by id, so it succeeded. <b>Two confirmed orders for one item.</b> With stock 5 the same bug shows up as a <b>lost update</b>: two sales and stock 4 instead of 3. You'll see it in support tickets, not in logs.`},
{th:[['A','own lock:dim','JVM 1 monitor'],['B','own lock:dim','JVM 2 monitor']], d:{type:'graph',on:['pA','pB']},
 g:[G('Tempting fixes that don\'t work',['synchronized buy()','locks one JVM only','bad'],['static lock / AtomicInteger','still per JVM','bad'],['@Transactional alone','READ COMMITTED allows this','bad'],['"we only run one pod"','until autoscaling adds a second','bad']), G('Why',['monitor lives in','one JVM heap (4.5)'],['shared state lives in','the database'],['so the lock must live in','the database','ok'])],
 say:`The first instinct is <code>synchronized</code>. It would fix the race inside one JVM, but a monitor lives in <b>one heap</b>. Pod B never sees pod A's lock. A <b>race on shared state must be solved where the state lives</b>, which here is the database.`},
{cv:'b', hl:{A:[11,4,5]}, th:[['A','RUN','UPDATE … WHERE stock >= 1'],['B','BLOCKED','waiting for row lock']], d:{type:'graph',on:['pA'],e:[['pA','db','UPDATE … >= 1','hot'],['pB','db','waits for row lock','dash']]},
 g:[G('DB · products',['id 42 · stock','1 → 0','hot'],['row lock','held by pod A tx','hot']), G('DB · orders',['rows','0'])], logReset:true, log:['pod A: UPDATE … WHERE id=42 AND stock>=1 → 1 row'],
 say:`<b>The fix.</b> Make the check and the decrement <b>one SQL statement</b>. The database row-locks id 42 while it evaluates <code>stock >= 1</code> and writes. Pod A's update matches 1 row. Pod B's identical UPDATE arrives and <b>waits for the row lock</b>.`},
{hl:{B:[11,12]}, th:[['A','TERM','order placed'],['B','TERM','409 Sold out']], d:{type:'graph',ok:['db']},
 g:[G('DB · products',['id 42 · stock','0','ok']), G('DB · orders',['rows','1','ok'],['units sold','1 of 1','ok'])], log:['pod A: commit','pod B: UPDATE … WHERE id=42 AND stock>=1 → 0 rows','pod B: SoldOutException → HTTP 409'],
 say:`A commits and releases the lock. B's UPDATE re-checks the WHERE clause against the <b>new</b> row (PostgreSQL and MySQL InnoDB both do this) and finds <code>0 >= 1</code> false: <b>0 rows affected</b>. We turn that into "Sold out". Exactly one order, no Java locks.`},
{th:[], d:null,
 g:[G('Options, best first for a counter',['conditional UPDATE','atomic, no read, one round trip','ok'],['@Version optimistic lock','retry on OptimisticLockException (5.5)','ok'],['SELECT … FOR UPDATE','correct, but holds the lock longer'],['Redis DECR + async to DB','for extreme hot items']), G('Also handle',['double-click / retry','idempotency key (5.13c)'],['unpaid orders','reservation expires → stock += qty'],['observability','alert if stock < 0 (CHECK constraint)','ok'])],
 say:`<b>Interview answer:</b> "In-JVM locks don't work across pods. I'd make the decrement atomic in the database with a conditional UPDATE and check rows affected, or use optimistic locking with a retry. I'd add a <code>CHECK (stock >= 0)</code> constraint as a last line of defence, and an idempotency key so a double-click doesn't buy twice."`}
],
keep:[`A Java lock protects one JVM; shared state in a DB needs a DB-level guarantee.`,`Read → check in Java → write is a race. Use <code>UPDATE … WHERE stock >= :qty</code> and check rows affected.`,`Belt and braces: CHECK constraint, @Version for entities, idempotency key for retries.`]}, {
  imp: 'must',
  theory: TH(`When several app instances update the same database row, Java locks can't protect it; the database must make "check and update" one atomic step.`,
`<p>In production you run several copies of your service (pods) for scale and resilience. Each is a separate JVM, so <code>synchronized</code> in one doesn't affect the others. If two pods both read "stock = 1", both decide there's enough, and both write, you sell the item twice.</p>
<p>The shared state lives in the database, so the guarantee must come from the database: a conditional UPDATE (<code>WHERE stock &gt;= 1</code>), optimistic locking (<code>@Version</code>), or a row lock (<code>SELECT … FOR UPDATE</code>).</p>`,
[[`Horizontal scaling`,`Running several instances of the same service.`],[`Conditional update`,`UPDATE … WHERE (condition); rows affected tells you if it applied.`],[`Optimistic locking`,`Detect conflicts with a version column; retry on failure.`],[`Pessimistic locking`,`Lock the row while you work on it.`]],
[`Replace "read, check in Java, write" with one SQL statement that checks and writes.`,`Check rows affected: 1 = success, 0 = condition failed (sold out).`,`Add a CHECK constraint as a safety net.`],
[`Inventory, seat booking, coupon redemption, account balances.`],
[`Assuming one pod forever; autoscaling will add a second.`,`Using JPA read-modify-write for counters without @Version.`]),
  quiz: [
    [`<code>UPDATE product SET stock = stock - 1 WHERE id = 42 AND stock &gt;= 1</code> returns 0 rows affected. What does that mean?`,[`A deadlock happened and it was rolled back`,`The item is sold out (or missing); report that to the user`,`The UPDATE failed and should be retried until it returns 1`,`Another transaction holds the row, so try again later`],1,`Rows affected is the result of the atomic check. Concurrent updates wait for the row lock, then re-check.`,'E'],
    [`Each pod's <code>buy()</code> is <code>synchronized</code>. Two pods, stock 1. Can it oversell?`,[`No: synchronized prevents races`,`Only if buy() is static`,`Yes: monitors are per JVM`,`Only at READ UNCOMMITTED`],2,`Monitors live in one heap. Shared state in a DB needs a DB-level guarantee.`,'M'],
    [`Stock 5. Two concurrent JPA read-modify-write purchases of 1 unit each, no @Version. Final stock?`,[`3`,`5`,`It throws OptimisticLockException`,`4: one decrement is lost`],3,`Both read 5 and write 4. Without @Version nothing detects the lost update.`,'H'],
    [`Why can't <code>synchronized</code> prevent overselling across two pods?`,[`synchronized is released whenever a DB call blocks`,`Each pod is a separate JVM with its own locks`,`Pods share memory, but locks aren't visible across them`,`The JIT removes synchronized on Spring singleton beans`],1,`Shared state lives in the database.`,'E'],
    [`Which SQL makes "check stock and decrement" atomic?`,[`SELECT stock FROM … WHERE id = ?, then UPDATE … SET stock = ?`,`UPDATE … SET stock = stock - 1 WHERE id = ? AND stock &gt;= 1`,`UPDATE … SET stock = ? WHERE id = ? AND version IS NOT NULL`,`INSERT INTO reservations VALUES (?, 1), then SELECT COUNT(*)`],1,`Then check rows affected.`,'E'],
    [`What should the app do when the conditional UPDATE affects 0 rows?`,[`Retry the UPDATE until a row is affected`,`Report sold out (or conflict) to the user`,`Ignore it, since the order is already saved`,`Insert a new stock row and try the update again`],1,`0 rows = condition failed.`,'M'],
    [`What safety net catches bugs that would make stock negative?`,[`A unique index on (product_id, stock)`,`A CHECK (stock &gt;= 0) constraint`,`A nightly job that resets negatives to 0`,`An ERROR log line when stock drops below 0`],1,`The DB rejects invalid states.`,'M'],
    [`Optimistic locking approach for the same problem?`,[`SELECT … FOR UPDATE on Product, then decrement`,`@Version on Product, retry on OptimisticLockException`,`synchronized on Product, retry on InterruptedException`,`READ UNCOMMITTED isolation, retry on deadlock errors`],1,`Good when conflicts are rare.`,'M'],
  ],
  quizAdv: [
    [`<code>SELECT … FOR UPDATE</code> instead of a conditional UPDATE. Correct, but what's the cost?`,[`It can still oversell`,`It serialises all buyers`,`It only works on MySQL`,`It bypasses the transaction`],1,`Keep that transaction as short as possible.`,'H'],
    [`PostgreSQL at REPEATABLE READ: two concurrent conditional UPDATEs on the same row?`,[`Both succeed and stock drops twice`,`Second waits, then re-checks and updates`,`Second gets a serialization error`,`They deadlock and both roll back`],2,`"could not serialize access due to concurrent update". Retry the transaction.`,'H'],
    [`Extremely hot item (100k buyers/sec). A common design?`,[`One row with SERIALIZABLE isolation and a bigger connection pool`,`Redis DECR tokens with async persistence, or stock split into buckets`,`A synchronized method on the stock service, scaled to more pods`,`A cache of stock in each pod, synced to the DB every minute`],1,`Spread the contention.`,'H'],
    [`A user double-clicks "Buy". Which protects against two orders even with correct stock handling?`,[`A CHECK constraint on the order total`,`An idempotency key per checkout attempt`,`An index on orders(user_id, created_at)`,`READ COMMITTED isolation on checkout`],1,`Stock logic doesn't stop duplicate requests.`,'M'],
  ],
});
