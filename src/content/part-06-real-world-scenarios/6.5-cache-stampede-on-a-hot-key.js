/* 6.5 Cache stampede on a hot key */
topic('6', { no:'6.5', title:'Cache stampede on a hot key', idea:`A popular key expires and a thousand requests miss at once, all hitting the database with the same query. Watch the overload feed itself, then coalesce the misses so only one request loads.`,
actors:'Requests (one pod shown)', stateTitle:'Cache and database', dgTitle:'Who hits the database',
vb:'0 0 480 200',
nodes:{r1:{x:60,y:40,label:'req 1',w:80}, r2:{x:60,y:100,label:'req 2',w:80}, r3:{x:60,y:160,label:'req 1,200',w:90}, redis:{x:330,y:50,label:'Redis\ncar:42',kind:'mem',w:110,h:46}, db:{x:330,y:155,label:'database\n6-join query',kind:'mem',w:130,h:46}},
edges:[['r1','redis'],['r2','redis'],['r3','redis']],
codes:{a:`public CarPage carPage(long id) {
  CarPage p = redis.get("car:" + id);           // TTL 60 s
  if (p == null) {                               // miss
    p = db.loadCarPage(id);                      // 6 joins, ~400 ms
    redis.set("car:" + id, p, Duration.ofSeconds(60));
  }
  return p;
}
// homepage hero car: 3,000 requests/s across 12 pods`,
b:`private final ConcurrentHashMap<Long, CompletableFuture<CarPage>> inFlight = new ConcurrentHashMap<>();

public CarPage carPage(long id) {
  CarPage p = redis.get("car:" + id);
  if (p != null) return p;
  CompletableFuture<CarPage> mine = new CompletableFuture<>();
  CompletableFuture<CarPage> f = inFlight.putIfAbsent(id, mine);
  if (f == null) {                                 // I am the loader
    try {
      CarPage loaded = db.loadCarPage(id);
      redis.set("car:" + id, loaded, ttlWithJitter(60));
      mine.complete(loaded);
    } catch (Exception e) { mine.completeExceptionally(e); }
    finally { inFlight.remove(id); }
    return mine.join();
  }
  return f.orTimeout(2, SECONDS).join();           // everyone else waits for it
}`},
steps:[
{hl:{'r1':[2,7]}, th:[['r1','RUN:ok','request 1: hit'],['r2','RUN:ok','request 2: hit'],['rN','RUN:ok','request 1,200: hit']], d:{type:'graph',ok:['redis'],e:[['r1','redis','hit','ok'],['r2','redis','hit','ok'],['r3','redis','hit','ok']]},
 g:[G('Redis car:42',['state','present, TTL 3 s left'],['hit rate','99.9%','ok']), G('Database',['car page queries / s','~0.02','ok'],['CPU','20%'])],
 say:`The homepage hero car gets <b>3,000 requests/s</b>. It's cached in Redis with a 60 s TTL, so the database sees one load per minute for it. Everything's quiet.`},
{hl:{'r1':[2,3],'r2':[2,3],'rN':[2,3]}, th:[['r1','RUN:warn','miss'],['r2','RUN:warn','miss'],['rN','RUN:warn','miss']], d:{type:'graph',bad:['redis'],e:[['r1','redis','miss','bad'],['r2','redis','miss','bad'],['r3','redis','miss','bad']]},
 g:[G('Redis car:42',['state','expired at 12:00:00.000','bad']), G('Misses before the first reload finishes',['rate × load time','3,000 / s × 0.4 s','hot'],['concurrent misses','≈ 1,200','bad'])],
 say:`At 12:00:00 the key expires. The first request misses and starts a 400 ms reload. During those 400 ms, <b>every</b> other request also misses, because nothing has been written back yet: 3,000/s × 0.4 s ≈ <b>1,200 misses</b>, all for the same key.`},
{hl:{'r1':[4],'r2':[4],'rN':[4]}, th:[['r1','WAITING:bad','db query 5 s'],['r2','WAITING:bad','db query 5 s'],['rN','WAITING:bad','waiting for a connection']], d:{type:'graph',bad:['redis','db'],e:[['r1','db','SELECT','bad'],['r2','db','SELECT','bad'],['r3','db','SELECT','bad']]},
 g:[G('Database',['identical queries in flight','1,200','bad'],['CPU','100%','bad'],['query time','400 ms → 5 s','bad']), G('Feedback loop',['slower query','longer miss window','bad'],['longer miss window','more concurrent misses','bad'],['all pods','connection pools exhausted (6.4)','bad'])], log:['db: 1,187 active queries: SELECT … FROM car JOIN … WHERE car.id = 42','p99 latency 12 s, error rate 38%'],
 say:`<b>Stampede.</b> 1,200 identical expensive queries hit the database together. CPU hits 100%, each query slows from 400 ms to 5 s, which <b>widens the miss window</b>, which lets even more requests miss. Other pages slow down too because they share the database and every pod's connection pool fills up (6.4).`},
{th:[['r1','TERM:bad',''],['r2','TERM:bad',''],['rN','TERM:bad','']], d:null,
 g:[G('Makes it worse',['same TTL for many keys','warm-up after deploy → all expire together','bad'],['cache miss on missing data','every request queries the DB ("penetration")','bad'],['retries on timeout','multiply the load','bad'])],
 say:`Variations make it worse. If a deploy warmed thousands of keys with the same TTL, they all <b>expire together</b> a minute later. Requests for ids that don't exist never get cached and always hit the DB. Client retries multiply everything.`},
{cv:'b', hl:{'r1':[4,6,7,8,10],'r2':[7,17],'rN':[7,17]}, th:[['r1','RUN:ok','loader: won putIfAbsent'],['r2','WAITING:ok','waits on r1\'s future'],['rN','WAITING:ok','waits on r1\'s future']], d:{type:'graph',on:['db'],dim:['r2','r3'],labels:{r2:'req 2\nwaits',r3:'req 1,200\nwaits'},e:[['r1','db','1 SELECT','ok']]},
 g:[G('inFlight map (this pod)',['key 42','future owned by req 1','hot']), G('Database',['car:42 queries from this pod','1','ok'],['from all 12 pods','12 (not 1,200)','ok'])], logReset:true,
 say:`<b>Coalesce the misses ("single-flight").</b> Each miss tries <code>putIfAbsent(id, future)</code>, which is atomic on a ConcurrentHashMap (4.16). Exactly one request wins and becomes the <b>loader</b>. Everyone else gets the winner's future and waits on it. The database sees <b>one</b> query per pod instead of hundreds.`},
{hl:{'r1':[11,12,14],'r2':[17],'rN':[17]}, th:[['r1','TERM:ok','loaded, cached, completed'],['r2','TERM:ok','got the same CarPage'],['rN','TERM:ok','got the same CarPage']], d:{type:'graph',ok:['redis','db'],e:[['r1','redis','SET (TTL 60 ± 6 s)','ok']]},
 g:[G('Redis car:42',['state','fresh, TTL 57 s (jittered)','ok']), G('inFlight map (this pod)',['key 42','removed (finally)','ok']), G('Database',['CPU','22%','ok'])], log:['loaded car:42 in 410 ms; 1,199 waiters released'],
 say:`The loader writes Redis, <b>completes</b> the future (waking all the waiters with the same value), and removes the entry in <code>finally</code>, so a failure doesn't leave a stuck future. Waiters have a <code>orTimeout</code> so they can't hang. The TTL gets random <b>jitter</b> so keys loaded together don't expire together.`},
{th:[], d:null,
 g:[G('Toolbox',['single-flight per key','this topic; Caffeine get(key, loader) does it in-JVM','ok'],['refresh ahead','Caffeine refreshAfterWrite: serve stale, reload in background','ok'],['TTL jitter','spread expiries','ok'],['cross-pod lock','Redis SET NX PX for one loader cluster-wide'],['negative caching','cache "not found" for a short time','ok']), G('Why store futures, not values',['computeIfAbsent(slow loader)','blocks other keys in the same bin'],['putIfAbsent(future)','map op is instant; waiting happens outside','ok'])],
 say:`<b>Interview answer:</b> "A hot key expired and all concurrent requests missed and queried the DB, which slowed down and made the miss window wider. I'd coalesce loads per key so only one request goes to the DB, add TTL jitter, use refresh-ahead for hot keys so users get the slightly stale value while one thread reloads, and cache negative results briefly."`}
],
keep:[`Concurrent misses ≈ request rate × reload time. A hot key expiring sends all of them to the DB at once.`,`Single-flight: one loader per key (putIfAbsent of a future); others wait on it. Always clean up in finally and time out waiters.`,`TTL jitter, refresh-ahead, negative caching; Caffeine's get(key, loader) coalesces within a JVM.`]}, {
  imp: 'good',
  theory: TH(`When a popular cache entry expires, all the requests that arrive before it's reloaded go to the database at once: a cache stampede.`,
`<p>Caches protect the database by serving repeated reads from memory. But when a hot key expires, the next request misses and starts reloading. Until it finishes, every other request for that key also misses. With high traffic that's hundreds or thousands of identical expensive queries at once, which slow the database down, which makes the miss window even longer.</p>
<p>The fix is <b>request coalescing</b> ("single-flight"): only one request reloads the key; the others wait for its result.</p>`,
[[`Cache hit / miss`,`Value found / not found in the cache.`],[`TTL`,`How long an entry lives.`],[`Single-flight`,`One loader per key; everyone else waits on it.`],[`Refresh-ahead`,`Reload in the background while still serving the old value.`],[`Cache penetration`,`Requests for keys that don't exist, always missing.`]],
[`On a miss, atomically register "I'm loading key K" (putIfAbsent of a future).`,`The winner loads and fills the cache; others wait on its future.`,`Add random jitter to TTLs so keys don't expire together.`,`For hot keys, refresh in the background before expiry.`],
[`Caffeine's <code>get(key, loader)</code> already coalesces within one JVM; refreshAfterWrite gives refresh-ahead.`,`Cache "not found" results briefly.`],
[`Identical TTLs for everything warmed at the same time.`,`Slow loaders inside ConcurrentHashMap.computeIfAbsent.`]),
  quiz: [
    [`A key gets 2,000 requests/s and takes 250 ms to reload. Without coalescing, roughly how many requests miss during the reload?`,[`500`,`1`,`2,000`,`8`],0,`2,000/s × 0.25 s = 500 concurrent misses.`,'E'],
    [`Why add random jitter to cache TTLs?`,[`Redis needs it to spread memory evenly`,`It hides key lifetimes from attackers`,`It reduces memory use over time`,`Keys loaded together won't expire together`],3,`Synchronised expiry causes stampedes after deploys and warm-ups.`,'M'],
    [`Why does the single-flight code store a <code>CompletableFuture</code> instead of <code>computeIfAbsent(id, k -> db.load(k))</code>?`,[`computeIfAbsent isn't atomic per key`,`computeIfAbsent loads under the bin lock`,`A future is faster than the database`,`Futures use less memory than values`],1,`ConcurrentHashMap's compute functions must be short.`,'H'],
    [`What triggers a cache stampede?`,[`The cache reaching its maximum size and evicting`,`A popular key expiring while many requests arrive`,`Too many distinct keys being written at once`,`A slow network between the app and the cache`],1,`All of them miss together.`,'E'],
    [`What does "single-flight" mean?`,[`Each pod runs only one request per second for each key`,`For each key, only one request loads it; others wait for that result`,`Only one thread per pod may read the cache at a time`,`Each key is stored in exactly one cache across all services`],1,`Coalescing.`,'E'],
    [`Caffeine's <code>cache.get(key, loader)</code> under concurrent misses?`,[`Calls the loader once per caller, then keeps the last`,`Calls the loader once per key; other callers wait`,`Throws, since concurrent misses must be handled by you`,`Returns null to the others until the first load ends`],1,`Built-in coalescing within a JVM.`,'M'],
    [`What is negative caching?`,[`Caching error responses permanently so failures stay consistent`,`Briefly caching "not found" so missing keys don't hit the DB every time`,`Evicting entries early when the DB reports a newer version`,`Storing deltas instead of whole values to save cache memory`],1,`Defends against cache penetration.`,'M'],
    [`Why does a stampede get worse over time once it starts?`,[`The cache grows with each miss until it evicts the hot key again`,`The DB slows down, so the reload takes longer and more requests miss meanwhile`,`GC pauses from failed lookups block the cache's eviction thread`,`Each miss resets the TTL, so the key keeps expiring sooner`],1,`A feedback loop.`,'M'],
  ],
  quizAdv: [
    [`Caffeine <code>refreshAfterWrite</code> vs <code>expireAfterWrite</code>?`,[`They're identical`,`Refresh serves stale while reloading`,`Expire serves stale data`,`Refresh blocks every caller`],1,`Expiry makes callers wait on a miss; refresh hides reloads.`,'H'],
    [`Many requests ask for ids that don't exist, and each hits the DB. Fix?`,[`A longer TTL on real entries`,`More database replicas`,`Cache "not found" briefly`,`Retry the query`],2,`That's cache penetration.`,'M'],
    [`How do you make only one pod reload a key cluster-wide?`,[`A synchronized block around the reload in each pod`,`A distributed lock, e.g. Redis SET key NX PX with a short TTL`,`A static AtomicBoolean flag checked before reloading`,`A longer TTL on the key so it expires less often`],1,`Others serve stale data or wait.`,'H'],
    [`What does "stale-while-revalidate" mean?`,[`Block callers until the value is refreshed, then serve it new`,`Serve the slightly old value while refreshing in the background`,`Serve the old value until a client explicitly purges it`,`Return an error while the value is being revalidated`],1,`Like Caffeine's refreshAfterWrite.`,'M'],
  ],
});
