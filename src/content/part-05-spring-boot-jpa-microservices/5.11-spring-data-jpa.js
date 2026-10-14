/* 5.11 Spring Data JPA */
topic('5', { no:'5.11', title:'Spring Data JPA', idea:`How a method name becomes SQL, why <code>Page</code> runs two queries and deep offsets get slow, and how Specifications compose dynamic filters.`,
actors:'Repository call', stateTitle:'Query building', logTitle:'SQL log',
codes:{a:`interface CarRepo extends JpaRepository<Car, Long>, JpaSpecificationExecutor<Car> {
  List<Car> findByCityAndPriceLessThan(String city, long price);
  Page<Car> findByCity(String city, Pageable p);
  @Modifying @Query("update Car c set c.sold = true where c.id = :id")
  int markSold(@Param("id") long id);
}
repo.findByCityAndPriceLessThan("Pune", 600_000);
repo.findByCity("Pune", PageRequest.of(2, 20, Sort.by("price")));
Specification<Car> spec = cityIs("Pune").and(priceBelow(600_000)).and(yearAtLeast(2018));
repo.findAll(spec);`},
steps:[
{hl:{repo:[1,2]}, th:[['startup','parsing:info','method name → query']], g:[G('PartTree for findByCityAndPriceLessThan',['subject','find … By'],['predicate 1','city = ?1'],['AND',''],['predicate 2','price < ?2'],['validated at','startup (typo → app fails to start)','ok'])],
 say:`At startup Spring Data creates a <b>proxy</b> implementing your interface. For derived methods it <b>parses the name</b> into a tree: <code>findBy</code>, then <code>City</code>, <code>And</code>, <code>PriceLessThan</code>. A misspelled property fails at startup, not at run time.`},
{hl:{repo:[7]}, th:[['findByCity…','RUN:ok','']], log:['select c.* from car c where c.city=? and c.price<?   [Pune, 600000]'],
 say:`The call runs the generated JPQL, which Hibernate turns into SQL. Keywords: <code>Between</code>, <code>In</code>, <code>Containing</code>, <code>IgnoreCase</code>, <code>OrderBy…Desc</code>, <code>Top10</code>, <code>exists…</code>, <code>countBy…</code>. Past two or three conditions, switch to <code>@Query</code> or Specifications for readability.`},
{hl:{repo:[3,8]}, th:[['findByCity(page 2)','RUN:warn','2 queries']], log:['select c.* from car c where c.city=? order by c.price limit 20 offset 40','select count(c.id) from car c where c.city=?'],
 say:`<code>Page</code> runs a <b>second COUNT query</b> to compute total pages. Use <code>Slice</code> if you only need "is there a next page", which skips the count. Deep pages are slow because <code>OFFSET 100000</code> makes the DB read and discard 100k rows.`},
{th:[['keyset pagination','RUN:ok','']], g:[G('Offset vs keyset',['OFFSET 100000 LIMIT 20','scans 100,020 rows','bad'],['WHERE (price, id) > (?, ?) ORDER BY price, id LIMIT 20','index seek, constant time','ok'],['trade-off','no "jump to page 5000"'])],
 say:`For infinite scroll or large exports, use <b>keyset (seek) pagination</b>: remember the last row's sort key and ask for rows after it. With an index on <code>(price, id)</code>, every page costs the same.`},
{hl:{repo:[4,5]}, th:[['markSold(7)','RUN:ok','bulk UPDATE']], g:[G('@Modifying',['needs','@Transactional around it'],['bypasses','persistence context (managed entities now stale)','bad'],['fix','@Modifying(clearAutomatically = true)','ok'],['returns','rows updated'])], log:['update car set sold=true where id=?   -- 1 row'],
 say:`<code>@Modifying</code> queries go straight to the database, skipping dirty checking and the persistence context. Any Car already loaded in this transaction still shows <code>sold = false</code>. Clear the context, or re-read.`},
{hl:{repo:[9,10]}, th:[['findAll(spec)','RUN:ok','criteria composed']], g:[G('Specification = a reusable WHERE fragment',['cityIs("Pune")','c.city = ?'],['priceBelow(600000)','c.price < ?'],['yearAtLeast(2018)','c.year >= ?'],['null-safe pattern','return null when a filter is empty → ignored','ok'])], log:['select c.* from car c where c.city=? and c.price<? and c.year>=?'],
 say:`<b>Specifications</b> (the Specification pattern) are small predicate builders you can combine with <code>and</code>/<code>or</code>. They suit search screens where any subset of filters may be present, instead of writing 2ⁿ derived methods. Querydsl and jOOQ are the type-safe alternatives.`}
],
keep:[`Derived queries are parsed from the method name at startup.`,`Page = data + COUNT; Slice skips the count; deep OFFSET is slow → keyset pagination.`,`@Modifying bypasses the persistence context; Specifications compose dynamic filters.`]}, {
  imp: 'good',
  theory: TH(`Spring Data JPA generates repository implementations for you: you declare an interface, and query methods are derived from their names.`,
`<p>Instead of writing DAO classes, you write <code>interface CarRepository extends JpaRepository&lt;Car, Long&gt;</code> and get save, findById, findAll, delete and paging for free. A method like <code>findByMakeAndYearGreaterThan(String make, int year)</code> is parsed at startup into a query. For anything complex you write <code>@Query</code> with JPQL or SQL.</p>`,
[[`Repository`,`Interface for data access to one entity type.`],[`Derived query`,`Query generated from a method name.`],[`Pageable / Page / Slice`,`Paging request; page with total count; page without count.`],[`@Modifying`,`Marks an update/delete @Query.`],[`Specification`,`Composable dynamic filters.`]],
[`At startup Spring creates a proxy implementation for each repository interface.`,`Method names are parsed into queries (a typo fails startup).`,`Calls run inside the current transaction using the EntityManager.`],
[`Use Page for UIs that need totals, Slice for infinite scroll; keyset pagination for deep pages.`,`Projections (interfaces or records) to fetch only needed columns.`],
[`Very long derived method names; switch to @Query.`,`Bulk @Modifying updates leaving stale entities in the persistence context.`]),
  quiz: [
    [`When does Spring Data parse <code>findByMakeAndYearGreaterThan(String make, int year)</code>?`,[`At startup; a typo fails startup`,`On every call, then it's cached`,`At compile time by an annotation processor`,`Never: you must write @Query`],0,`Derived queries are created from the method name.`,'E'],
    [`Paging to page 50,000 with OFFSET is slow. Better?`,[`Bigger page sizes, so fewer pages`,`An index on every column used`,`Slice instead of Page`,`Keyset: WHERE id &gt; :lastId`],3,`OFFSET still scans and discards the skipped rows. Slice only skips the COUNT.`,'M'],
    [`<code>@Modifying @Query("update Car ...")</code> runs, then you read a Car already loaded in the same persistence context. You see?`,[`The new value`,`Maybe the old value`,`An exception`,`null`],1,`Use clearAutomatically = true, or clear/refresh.`,'H'],
    [`What does <code>JpaRepository&lt;Car, Long&gt;</code> give you?`,[`A generated SQL schema plus migration scripts for the Car table`,`CRUD, paging and sorting methods without writing implementations`,`Only findAll and save; paging needs a separate repository`,`A JDBC template preconfigured with the Car table's columns`],1,`Spring generates the implementation.`,'E'],
    [`<code>findByEmail(String email)</code> becomes?`,[`A runtime reflection call`,`SELECT … WHERE email = ?`,`A full table scan in Java`,`Nothing`],1,`Derived query.`,'E'],
    [`Page vs Slice?`,[`Slice runs an extra COUNT for totals; Page only knows if there's a next page`,`Page runs an extra COUNT for totals; Slice only knows if there's a next page`,`Page loads all rows and splits them in memory; Slice uses LIMIT`,`Page supports sorting; Slice returns rows in insertion order only`],1,`Slice is cheaper for infinite scroll.`,'M'],
    [`Write a custom JPQL query?`,[`@Sql("select c from Car c where …")`,`@Query("select c from Car c where …")`,`@Select("select c from Car c where …")`,`@Jpql("select c from Car c where …")`],1,`nativeQuery = true for SQL.`,'E'],
    [`Fetch only id and name for a list page?`,[`Use FetchType.LAZY on the other columns`,`Use a projection (interface or record DTO)`,`Use a Page with a small page size`,`Use @Transient on the unused fields`],1,`Less data, no dirty checking.`,'M'],
  ],
  quizAdv: [
    [`<code>Page&lt;Car&gt;</code> query with a JOIN FETCH of a collection. Effect?`,[`Pages in memory, with a warning`,`Pages in SQL with LIMIT as usual`,`Fails at startup with a query error`,`Silently drops the fetched collection`],0,`It loads every row, then slices. Fetch ids first, then the collections.`,'H'],
    [`<code>save()</code> on an entity whose id you assign yourself (not generated)?`,[`An INSERT right away`,`An exception`,`It's ignored`,`A SELECT, then INSERT`],3,`Implement Persistable to tell Spring Data it's new.`,'H'],
    [`What does <code>saveAll</code> in a loop of 10,000 entities need to be efficient?`,[`EAGER fetching on all associations so inserts share one query`,`JDBC batching (hibernate.jdbc.batch_size) and a non-IDENTITY id strategy`,`A bigger heap and a call to flush() after every single save`,`IDENTITY ids so the database assigns keys in one round trip`],1,`IDENTITY ids force one insert at a time.`,'H'],
    [`Specification / Criteria are used for?`,[`Declaring fixed queries checked at startup`,`Building dynamic queries from optional filters`,`Generating schema migrations from entities`,`Caching query results between transactions`],1,`Combine predicates at run time.`,'M'],
  ],
});
