/* 5.5 JPA and Hibernate: states, dirty checking, N+1, locking */
topic('5', { no:'5.5', title:'JPA and Hibernate: states, dirty checking, N+1, locking', idea:`An entity moves TRANSIENT → MANAGED → DETACHED while the SQL log shows what Hibernate actually sends. Then count the N+1 queries and resolve a lost update with @Version.`,
actors:'Entity', stateTitle:'Persistence context', logTitle:'SQL log', dgTitle:'Entity states',
vb:'0 0 520 200',
nodes:{TR:{x:80,y:55,label:'TRANSIENT',w:120}, MG:{x:270,y:55,label:'MANAGED',w:120}, DT:{x:450,y:55,label:'DETACHED',w:120}, RM:{x:270,y:160,label:'REMOVED',w:120}},
edges:[['TR','MG','persist()'],['MG','DT','tx ends / detach'],['DT','MG','merge()'],['MG','RM','remove()']],
codes:{a:`@Transactional public void demo() {
  Car c = new Car("Swift");          // TRANSIENT
  em.persist(c);                     // MANAGED
  c.setPrice(500_000);               // no SQL yet
  Car same = em.find(Car.class, c.getId());   // 1st-level cache: no SELECT
}                                    // flush at commit
// after the tx: c is DETACHED
c.setPrice(1);                       // nothing happens
Car back = em.merge(c);              // copies state onto a MANAGED copy`,
b:`List<Order> orders = orderRepo.findAll();          // 1 query
for (Order o : orders) o.getItems().size();        // +1 query PER order
// fix:
@Query("select distinct o from Order o join fetch o.items where o.status = :s")
List<Order> findWithItems(@Param("s") Status s);   // 1 query
// or @EntityGraph(attributePaths = "items"), or default_batch_fetch_size = 50`,
c:`@Entity class Car { @Id Long id; long price; @Version int version; }
// tx A and tx B both read Car 7 at version 3
UPDATE car SET price = 510000, version = 4 WHERE id = 7 AND version = 3;  -- A: 1 row
UPDATE car SET price = 495000, version = 4 WHERE id = 7 AND version = 3;  -- B: 0 rows
// B -> OptimisticLockException -> retry, or 409 Conflict
@Lock(LockModeType.PESSIMISTIC_WRITE)  // SELECT ... FOR UPDATE instead`},
steps:[
{cv:'a', hl:{em:[2]}, th:[['car','TRANSIENT:dim','plain Java object']], d:{type:'graph',on:['TR']}, g:[G('Persistence context (1st-level cache)',['entries','none'])],
 say:`<code>new Car()</code> is <b>transient</b>: Hibernate doesn't know about it, it has no id, and no row exists.`},
{hl:{em:[3]}, th:[['car','MANAGED:ok','tracked']], d:{type:'graph',on:['MG'],e:[['TR','MG','persist()','hot']]}, g:[G('Persistence context (1st-level cache)',['Car#101','snapshot: {model:Swift, price:0}','hot'],['action queue','INSERT car (deferred*)'])], log:['select nextval(\'car_seq\')   -- id assigned'],
 say:`<code>persist</code> → <b>managed</b>. The entity goes into the <b>persistence context</b>, a per-transaction map of id → entity, plus a <b>snapshot</b> of its loaded state. The INSERT is queued until flush. (*With <code>IDENTITY</code> ids Hibernate must insert immediately to learn the id, which also disables JDBC batching. Prefer SEQUENCE.)`},
{hl:{em:[4]}, th:[['car','MANAGED:ok','price changed in memory']], g:[G('Persistence context (1st-level cache)',['Car#101','current price 500000 ≠ snapshot 0','hot'])],
 say:`A setter on a managed entity issues <b>no SQL</b> and needs no <code>save()</code> call. Hibernate will notice the difference later, through <b>dirty checking</b>.`},
{hl:{em:[5]}, th:[['car','MANAGED:ok','same instance returned']], log:['(no SELECT: served from the persistence context)'],
 say:`<code>find</code> by id checks the persistence context first: <b>same object, no query</b>. Within one transaction there's exactly one instance per row (identity guarantee). This cache is <b>per transaction</b>; it isn't shared between requests (that's the optional 2nd-level cache).`},
{hl:{em:[6]}, th:[['car','MANAGED → flushing:ok','']], log:['insert into car (model, price, id) values (\'Swift\', 0, 101)','update car set price=500000 where id=101','commit'],
 say:`At commit, Hibernate <b>flushes</b>: it runs queued actions and compares every managed entity with its snapshot, issuing UPDATEs for the dirty ones. (It also flushes before a JPQL query that might read those tables.) <code>readOnly = true</code> skips the snapshot comparison, which is cheaper for big reads.`},
{hl:{em:[7,8,9]}, th:[['car','DETACHED:warn','context closed']], d:{type:'graph',on:['DT'],e:[['MG','DT','tx ends','hot']]}, log:['(c.setPrice(1): nothing; no context is watching)','select … from car where id=101   -- merge loads a managed copy'],
 say:`After the transaction the object is <b>detached</b>: changes aren't tracked. <code>merge</code> loads (or finds) a managed instance and <b>copies</b> the detached state onto it, then returns <b>that</b> instance. Keep using the returned one. Touching a <b>lazy</b> association on a detached entity throws <b>LazyInitializationException</b>: fetch what you need inside the transaction, or map to DTOs.`},
{cv:'b', logReset:true, d:null, hl:{repo:[1]}, th:[['orders','MANAGED:ok','100 orders loaded']], g:[G('Order.items',['each order','LAZY proxy collection (not loaded)'])], log:['select * from orders                              -- 1'],
 say:`<b>N+1 problem.</b> One query loads 100 orders. <code>@OneToMany</code> is LAZY, so <code>items</code> are uninitialised proxy collections (3.7h).`},
{hl:{repo:[2]}, th:[['orders','MANAGED:bad','touching each items list']], g:[G('queries',['1 for orders + 100 for items','101 round trips','bad'],['at 2 ms each','~200 ms','bad'])], log:['select * from order_item where order_id=1   -- 2','select * from order_item where order_id=2   -- 3','…','select * from order_item where order_id=100 -- 101'],
 say:`The loop touches each collection, firing <b>one query per order</b>: N+1 = 101 round trips. It's invisible in code and shows up as slow pages. Enable SQL logging or Hibernate statistics in tests to catch it.`},
{hl:{repo:[4,5,6]}, th:[['orders','MANAGED:ok','items fetched together']], g:[G('fixes',['JOIN FETCH','1 query (watch duplicates → distinct; can\'t paginate collections in SQL)','ok'],['@EntityGraph','declarative fetch plan','ok'],['batch fetching (50)','1 + ⌈100/50⌉ = 3 queries','ok'],['DTO projection','select only needed columns','ok'])], log:['select distinct o.*, i.* from orders o join order_item i on … where o.status=?   -- 1'],
 say:`<code>JOIN FETCH</code> loads orders and items in one query. Batch fetching loads lazy collections in groups (<code>where order_id in (?, ?, …)</code>). Also: <code>@ManyToOne</code> is <b>EAGER</b> by default, so set it to LAZY explicitly to avoid surprise joins and N+1 on the other side.`},
{cv:'c', logReset:true, hl:{A:[3],B:[4]}, th:[['txA','COMMITTED:ok','1 row → version 4'],['txB','FAILED:bad','0 rows']], g:[G('car 7',['price','510000 (A\'s write)','ok'],['version','4'],['B\'s write','rejected, NOT lost','ok'])], log:['update car set price=510000, version=4 where id=7 and version=3   -- 1 row','update car set price=495000, version=4 where id=7 and version=3   -- 0 rows','✘ OptimisticLockException (StaleObjectStateException)'],
 say:`<b>Lost update protection.</b> Both transactions read version 3. A's UPDATE matches <code>version = 3</code> and bumps it to 4. B's UPDATE matches <b>0 rows</b>, and Hibernate throws <b>OptimisticLockException</b> instead of silently overwriting A. Retry (re-read and re-apply) or return 409. It's the same compare-and-swap idea as CAS (4.7).`},
{hl:{A:[6]}, th:[], g:[G('Optimistic (@Version)',['locks','none while reading'],['conflict','detected at write → retry'],['best for','low contention, user edits']), G('Pessimistic (FOR UPDATE)',['locks','row locked until commit'],['conflict','others WAIT'],['best for','high contention, money/stock'],['risk','deadlocks, lock timeouts','bad'])],
 say:`<b>Pessimistic</b> locking (<code>SELECT … FOR UPDATE</code>) makes others wait instead of failing. Choose by contention: optimistic when conflicts are rare, pessimistic when they're frequent and retries would be expensive (decrementing hot inventory). Always lock rows in a consistent order (the 4.9 lesson).`}
],
keep:[`TRANSIENT → persist → MANAGED (snapshot + dirty checking at flush) → DETACHED → merge returns a managed copy.`,`N+1: lazy collections in a loop → JOIN FETCH / @EntityGraph / batch size. Make @ManyToOne LAZY.`,`@Version: UPDATE … WHERE version=? → 0 rows → OptimisticLockException. FOR UPDATE = pessimistic.`]}, {
  imp: 'must',
  theory: TH(`JPA maps Java objects to database tables; Hibernate tracks the objects you load and automatically writes changes back, which is powerful but has traps like N+1 queries.`,
`<p>With JPA you annotate classes as <b>entities</b> (<code>@Entity</code>), and Hibernate turns <code>find</code>, <code>persist</code> and queries into SQL. Within a transaction, loaded entities are <b>managed</b>: Hibernate keeps a snapshot, and at <b>flush</b> time (before commit or before a query) it compares and issues UPDATEs for anything you changed. That's <b>dirty checking</b>: you never call update().</p>
<p>Relationships can be loaded <b>lazily</b> (when first accessed). Loading 100 orders and touching each one's items triggers 1 + 100 queries: the <b>N+1 problem</b>.</p>`,
[[`Entity`,`A class mapped to a table.`],[`Persistence context`,`The set of managed entities in the current transaction (first-level cache).`],[`Entity states`,`transient (new), managed, detached, removed.`],[`Flush`,`Sending pending changes to the database as SQL.`],[`Lazy / eager`,`Load a relationship on first access / immediately.`],[`@Version`,`Optimistic locking column.`]],
[`<code>find(id)</code> → SELECT; the entity becomes managed and a snapshot is taken.`,`You change fields with setters.`,`At flush, Hibernate diffs against the snapshot and runs UPDATEs (inserts, then updates, then deletes).`,`After the transaction ends, entities become detached.`],
[`Fix N+1 with JOIN FETCH, @EntityGraph or batch fetching; watch SQL logs in development.`,`Make @ManyToOne LAZY explicitly (it's eager by default).`,`Use @Version to detect concurrent edits.`],
[`LazyInitializationException from touching lazy fields after the transaction.`,`Returning entities from controllers (lazy loading during JSON serialisation).`]),
  quiz: [
    [`Load 100 orders, then access <code>order.getItems()</code> (LAZY) in a loop. How many queries?`,[`101 (N+1)`,`1`,`2`,`100`],0,`Fix with JOIN FETCH, @EntityGraph or batch fetching.`,'E'],
    [`In a transaction you load a managed entity and call a setter, without save(). At commit?`,[`Nothing: changes need save()`,`An exception about unsaved changes`,`An INSERT`,`An UPDATE, from dirty checking at flush`],3,`Managed entities are compared with their snapshot at flush.`,'M'],
    [`Two users edit the same entity, which has <code>@Version</code>. The second save?`,[`It waits for the first user's row lock, then commits`,`OptimisticLockException: the versioned UPDATE hits 0 rows`,`It silently overwrites the first user's change`,`Hibernate merges both users' changes field by field`],1,`Optimistic locking detects lost updates without holding locks.`,'H'],
    [`What's the persistence context?`,[`The shared cache of entities across all sessions (second-level cache)`,`The set of entities managed in the current transaction (first-level cache)`,`The mapping metadata Hibernate builds from your @Entity classes`,`The JDBC connection plus its open statements for the request`],1,`find() twice returns the same instance.`,'E'],
    [`Which fetch type is the default for @ManyToOne?`,[`LAZY`,`EAGER`,`NONE`,`BATCH`],1,`Make it LAZY explicitly.`,'M'],
    [`Fix N+1 when listing orders with their items?`,[`FetchType.EAGER on the items collection`,`JOIN FETCH / @EntityGraph / batch fetching`,`An index on the order_id foreign key`,`A larger connection pool and @Transactional`],1,`Load associations in one or few queries.`,'E'],
    [`What does <code>merge(detached)</code> return?`,[`The same instance, now attached to the context`,`A managed copy; the passed object stays detached`,`A detached copy; the passed object becomes managed`,`Nothing; it reattaches the passed object in place`],1,`Use the returned instance.`,'M'],
    [`What does <code>@Version</code> add?`,[`Pessimistic row locking on every read`,`Optimistic locking via a version column`,`Audit history of each change in a table`,`Schema versioning for Flyway migrations`],1,`Detects lost updates.`,'E'],
  ],
  quizAdv: [
    [`In one transaction you remove an entity with a unique email, then persist a new one with the same email. At flush?`,[`Unique violation: inserts run first`,`It works: deletes run first`,`Hibernate turns it into an UPDATE`,`The persist is silently ignored`],0,`Call flush() after remove, or reuse the entity.`,'H'],
    [`You modify a managed entity, then run a JPQL query on its table (FlushMode AUTO). The query sees?`,[`The old data`,`An exception`,`Nothing: changes discarded`,`Your changes (auto flush)`],3,`AUTO flushes pending changes that could affect the query.`,'H'],
    [`Why can <code>equals</code> on entities based on generated id be tricky?`,[`Hibernate proxies override equals, so the id is never compared`,`The id is null before persist, so equality and hash change after saving`,`Generated ids are reused after deletes, so stale entities match`,`The id is reassigned on each load, so it differs per session`],1,`Use a business key or careful id-based equals with constant hashCode.`,'H'],
    [`What's the second-level cache?`,[`A per-transaction cache of entities, cleared on commit (the session)`,`A cache shared across sessions/transactions (e.g. with Ehcache/Caffeine)`,`The database's own buffer pool, which Hibernate tunes automatically`,`A query plan cache that Hibernate keeps for compiled JPQL`],1,`Off by default; use for read-mostly reference data.`,'H'],
  ],
});
