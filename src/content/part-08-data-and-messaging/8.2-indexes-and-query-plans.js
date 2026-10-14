/* 8.2 Indexes and query plans */
topic('8', { no:'8.2', title:'Indexes and query plans', imp:'must', idea:`Why a query on 10 million rows takes seconds, and how a B-tree index makes it milliseconds. Then composite indexes, the leftmost-prefix rule, queries that can't use an index, and reading EXPLAIN.`,
actors:'Query', stateTitle:'Cost', dgTitle:'B-tree index on customer_id', logTitle:'EXPLAIN ANALYZE',
vb:'0 0 560 190',
nodes:{root:{x:280,y:30,label:'root: 4000 | 8000',w:180,h:34}, n1:{x:90,y:105,label:'1 … 3999',w:120,h:34}, n2:{x:280,y:105,label:'4000 … 7999',w:120,h:34}, n3:{x:470,y:105,label:'8000 …',w:120,h:34}, leaf:{x:90,y:165,label:'leaf: 42 → rows',kind:'mem',w:150,h:30}},
edges:[['root','n1'],['root','n2'],['root','n3'],['n1','leaf']],
codes:{a:`CREATE TABLE orders (id BIGINT PRIMARY KEY, customer_id BIGINT,
                     status TEXT, created_at TIMESTAMPTZ, total NUMERIC);
-- 10 million rows

SELECT * FROM orders WHERE customer_id = 42;            -- before the index
CREATE INDEX idx_orders_customer ON orders (customer_id);
SELECT * FROM orders WHERE customer_id = 42;            -- after

CREATE INDEX idx_cust_created ON orders (customer_id, created_at);
SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20;
SELECT * FROM orders WHERE created_at > now() - interval '1 day';
SELECT * FROM orders WHERE lower(status) = 'paid';

EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;`},
steps:[
{hl:{q:[5]}, th:[['q','RUN:bad','Seq Scan']], d:null, g:[G('Without an index',['rows checked','10,000,000','bad'],['rows returned','37'],['time','~2,400 ms','bad'])], log:['Seq Scan on orders (rows=37) (actual time=0.1..2412 ms)','  Filter: (customer_id = 42)','  Rows Removed by Filter: 9999963'],
 say:`With no index, the database has only one option: read <b>every row</b> and keep the 37 that match: a <b>sequential (full table) scan</b>. Fine for 1,000 rows, painful for 10 million, and it gets slower as the table grows.`},
{hl:{q:[6]}, th:[['q','READY','index being built']], d:{type:'graph',on:['root']}, g:[G('B-tree index',['stores','customer_id → row locations, sorted'],['height','3–4 levels for 10M rows'],['lookup cost','O(log n): a few page reads','ok'])],
 say:`An <b>index</b> is a separate, sorted structure, like the index at the back of a book: look up the word, get the page numbers. Most indexes are <b>B-trees</b>: a shallow, balanced tree whose leaves hold sorted keys with pointers to the table rows.`},
{hl:{q:[7]}, th:[['q','RUN:ok','Index Scan']], d:{type:'graph',on:['root','n1','leaf'],e:[['root','n1','42 < 4000','hot'],['n1','leaf','','hot']]}, g:[G('With the index',['pages read','~40','ok'],['time','~0.3 ms','ok'],['speed-up','~8,000×','ok'])], log:['Index Scan using idx_orders_customer on orders (rows=37) (actual time=0.03..0.3 ms)','  Index Cond: (customer_id = 42)'],
 say:`Now the database walks root → branch → leaf (42 is below 4000, so go left) and fetches only the 37 matching rows. Thousands of times faster, and it stays fast as the table grows.`},
{hl:{q:[9,10]}, th:[['q','RUN:ok','Index Scan, no sort']], d:null, g:[G('Composite index (customer_id, created_at)',['sorted by','customer_id, then created_at'],['WHERE customer_id = 42','uses it','ok'],['ORDER BY created_at DESC LIMIT 20','already in order: no sort step','ok'])],
 say:`A <b>composite index</b> sorts by the first column, then the second within it, like a phone book sorted by surname, then first name. For "customer 42's latest 20 orders", the rows are already in order inside the index, so the database reads 20 entries and stops.`},
{hl:{q:[11]}, th:[['q','RUN:warn','can\'t use the leading column']], g:[G('Leftmost-prefix rule',['(customer_id)','✔ uses the index','ok'],['(customer_id, created_at)','✔','ok'],['(created_at) alone','✘ not the leading column','bad'])],
 say:`A composite index helps queries that filter on its <b>leading</b> column(s). Filtering only by <code>created_at</code> is like finding everyone named "Ana" in a surname-sorted phone book: the order doesn't help. That query needs its own index on <code>created_at</code>.`},
{hl:{q:[12]}, th:[['q','RUN:bad','Seq Scan']], g:[G('Index killers',['function on the column: lower(status)','index on status unused','bad'],['fix','expression index: ON orders (lower(status))','ok'],['leading wildcard: LIKE \'%abc\'','unused','bad'],['type mismatch / implicit cast','often unused','bad'])],
 say:`Wrapping the column in a function (<code>lower(status)</code>, <code>date(created_at)</code>) hides it from a plain index. Create an <b>expression index</b>, or rewrite the query (e.g. a range on created_at instead of <code>date(created_at) = …</code>).`},
{hl:{q:[14]}, th:[], g:[G('Indexes cost something',['every INSERT/UPDATE','also updates each index','bad'],['disk + memory','each index takes space'],['low-selectivity columns','status with 3 values: rarely worth it'],['foreign keys','index them: joins and deletes need it','ok'])],
 say:`<b>EXPLAIN ANALYZE</b> runs the query and shows the real plan: Seq Scan vs Index Scan, rows, time. Don't index everything: each index slows writes and uses space. Index the columns you <b>filter, join and sort</b> on, check slow queries with EXPLAIN, and remember JPA's N+1 queries (5.5) often hit an unindexed foreign key.`}
],
keep:[`No index → full table scan; B-tree index → O(log n) lookups.`,`Composite index (a, b): helps filters on a, or a + b, and ORDER BY b within a; not b alone (leftmost prefix).`,`Functions on columns, leading wildcards and casts defeat indexes; use EXPLAIN ANALYZE. Indexes slow writes.`]}, {
  imp: 'good',
  theory: TH(`An index is a sorted lookup structure (usually a B-tree) that lets the database find matching rows without scanning the whole table.`,
`<p>Without an index, finding "all orders of customer 42" means checking every row: a <b>full table scan</b>. An <b>index</b> on <code>customer_id</code> keeps those values sorted in a balanced tree with pointers back to the rows, so the database jumps straight to them in a handful of steps, like using a book's index instead of reading every page.</p>
<p>Indexes aren't free: every insert, update and delete must also update each index, and they take space. The art is indexing the columns your important queries <b>filter, join and sort</b> by, and checking with <b>EXPLAIN</b>.</p>`,
[[`Full table scan`,`Reading every row (Seq Scan).`],[`B-tree`,`Balanced sorted tree; the default index type.`],[`Composite index`,`An index on several columns, in a specific order.`],[`Leftmost prefix`,`A composite index helps queries using its first column(s).`],[`Selectivity`,`How few rows a value matches; high selectivity = good index candidate.`],[`EXPLAIN ANALYZE`,`Shows the plan the database chose and real timings.`]],
[`Find slow queries (logs, APM, pg_stat_statements).`,`Run EXPLAIN ANALYZE; look for Seq Scans on big tables and sort steps.`,`Add an index matching the WHERE / JOIN / ORDER BY columns (most selective / equality columns first).`,`Re-check the plan and the write cost.`],
[`Index foreign keys used in joins.`,`Composite index (customer_id, created_at) for "latest orders per customer" pages.`,`Declare indexes in migrations (Flyway/Liquibase); JPA @Index for documentation.`],
[`Indexing every column.`,`Functions on indexed columns in WHERE.`,`Composite indexes with columns in the wrong order.`]),
  quiz: [
    [`Without an index, how does the DB answer <code>WHERE customer_id = 42</code> on a big table?`,[`It uses the primary key automatically`,`It reads every row (full table scan)`,`It samples a few rows`,`It caches the answer forever`],1,`Seq Scan: cost grows with table size.`,'E'],
    [`Index on (customer_id, created_at). Which query can't use it well?`,[`WHERE customer_id = 42`,`WHERE customer_id = 42 ORDER BY created_at`,`WHERE created_at &gt; yesterday`,`WHERE customer_id = 42 AND created_at &gt; yesterday`],2,`Leftmost-prefix rule: the leading column isn't constrained.`,'M'],
    [`An index exists on status, but <code>WHERE lower(status) = 'paid'</code> does a full scan. Fix?`,[`Add an expression index on lower(status), or store normalised values`,`Increase work_mem so the sort for lower() fits in memory`,`Add LIMIT 1 so the planner stops after the first match`,`Run ANALYZE so the planner picks up the status index`],0,`Functions on the column hide it from a plain index.`,'H'],
    [`What's the most common index structure in relational databases?`,[`Hash table`,`B-tree`,`Linked list`,`Bitmap`],1,`Supports equality and range queries.`,'E'],
    [`Does a primary key create an index?`,[`No`,`Yes, automatically`,`Only in MySQL`,`Only if named`],1,`Unique constraints too.`,'E'],
    [`Why does every extra index slow down inserts?`,[`Each insert must rebuild the index from scratch`,`Each insert must also update every index`,`Each index takes a table-level lock on insert`,`Each insert is replayed once per index in the WAL`],1,`Write cost vs read benefit.`,'E'],
    [`<code>WHERE name LIKE 'abc%'</code> vs <code>LIKE '%abc'</code>: which can use a B-tree index on name?`,[`Both`,`Only 'abc%' (prefix)`,`Only '%abc'`,`Neither`],1,`A leading wildcard can't use the sort order.`,'M'],
    [`What does EXPLAIN (without ANALYZE) show?`,[`The actual run time of each plan node`,`The planned execution strategy and estimated costs`,`The rows the query would return, unsorted`,`The locks each step would take at runtime`],1,`ANALYZE runs it and shows actual numbers.`,'M'],
  ],
  quizAdv: [
    [`What's a covering index?`,[`A composite index that includes every column of the table`,`A clustered index that physically orders rows by primary key`,`A partial index whose WHERE clause covers all the query's rows`,`An index containing all columns a query needs, so the table isn't read`],3,`Enables index-only scans (INCLUDE columns in PostgreSQL).`,'M'],
    [`Why is an index on a boolean or a 3-value status column often useless?`,[`Low selectivity: each value matches a big share of rows, so a scan is cheaper`,`Most databases store booleans as bits, which B-tree indexes can't hold`,`Every update to the column rewrites the whole index, so it stays bloated`,`The index forces a lock on all matching rows, so reads end up blocking`],0,`A partial index (WHERE status = 'PENDING') can still help for rare values.`,'H'],
    [`What is a partial index?`,[`An index on only the first part of each value, e.g. a column prefix`,`An index on only rows matching a condition, e.g. WHERE status = 'PENDING'`,`An index split across partitions, each covering one date range`,`An index built in the background, usable for reads before it finishes`],1,`Small and useful for rare values.`,'H'],
    [`Why does the planner sometimes ignore an existing index?`,[`Indexes are skipped once they exceed shared_buffers, so it scans`,`It estimates a sequential scan is cheaper (low selectivity, small table, stale statistics)`,`It only uses an index when the query includes an ORDER BY clause`,`The index was created after the connection opened its plan cache`],1,`Run ANALYZE to refresh statistics.`,'H'],
  ],
});
