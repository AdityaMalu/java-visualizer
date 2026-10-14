/* 5.13c Idempotency keys (no double charge) */
topic('5', { no:'5.13c', title:'Idempotency keys (no double charge)', idea:`The client times out and retries a payment that actually succeeded. With an idempotency key, the retry replays the stored response instead of charging twice.`,
actors:'Requests', stateTitle:'Server state',
codes:{a:`POST /payments
Idempotency-Key: 7f3c9b2e-…-a91
{ "orderId": 42, "amount": 49900 }

Payment pay(String key, PayReq r) {
  var prev = idem.find(key);
  if (prev.isPresent()) return prev.get().response();   // replay
  idem.insert(key, IN_PROGRESS);       // UNIQUE(key): one winner
  Payment p = gateway.charge(r);
  idem.complete(key, p);               // store the response
  return p;
}`},
steps:[
{hl:{srv:[1,2,3,6,8]}, th:[['client','sent:info','key 7f3c…'],['server','RUN:ok','new key → IN_PROGRESS']], g:[G('idempotency table',['7f3c…','IN_PROGRESS','hot'])],
 say:`The client generates a unique <b>Idempotency-Key</b> per <i>logical</i> operation (one per checkout attempt, reused on retries). The server inserts it with a <b>unique constraint</b> before doing any work.`},
{hl:{srv:[9,10]}, th:[['client','TIMEOUT:bad','no response in 3 s'],['server','DONE:ok','charged, response stored']], g:[G('idempotency table',['7f3c…','DONE → {id: pay_77, status: captured}','ok']), G('gateway',['charges for order 42','1'])], log:['client: read timeout (network dropped the response)'],
 say:`The charge succeeds, but the response is lost on the way back (timeout, dropped connection). The client <b>can't tell</b> "failed" from "succeeded but I didn't hear". This is the standard distributed-systems ambiguity.`},
{hl:{srv:[6,7]}, th:[['client','RETRY:info','same key 7f3c…'],['server','REPLAY:ok','found DONE']], g:[G('gateway',['charges for order 42','still 1','ok'])], log:['200 OK {id: pay_77, status: captured}  (replayed, no new charge)'],
 say:`The client retries <b>with the same key</b>. The server finds it DONE and <b>returns the stored response</b>, so there's no second charge. Retries are now safe, which is what allows the retry and backoff patterns of 5.13a.`},
{hl:{srv:[8]}, th:[['retry-A','RUN:ok','won the insert'],['retry-B','CONFLICT:bad','duplicate key']], log:['retry-B: UNIQUE violation → 409 Conflict (or wait and replay)'],
 say:`Two copies of the request racing at the same moment (a double-click plus a retry): the <b>unique constraint</b> lets exactly one insert succeed. The loser gets 409 or polls until the first one completes. Check-then-insert without the constraint would race (4.4).`},
{th:[], g:[G('Design details',['key scope','per client/merchant + key'],['also store','request hash → reject same key with a different body','ok'],['TTL','keep keys 24 h – 7 days'],['IN_PROGRESS stuck (crash)','expire / reconcile with the gateway'],['downstream','pass the key on to the PSP (Stripe supports it)','ok']), G('Naturally idempotent',['PUT /cars/7 {price}','same result on repeat'],['DELETE','gone stays gone'],['POST create / charge','NOT, so it needs a key','bad'])],
 say:`Stripe's API works exactly this way. Mention the request-hash check (same key with a different payload is a client bug) and recovery from <b>stuck IN_PROGRESS</b> keys after a crash: reconcile with the payment provider using the same key. Observability ties it together: logs, metrics and a <b>trace id</b> propagated through headers across services.`}
],
keep:[`Client sends one key per logical operation; server stores key → response.`,`Retry with the same key → replay, no duplicate side effect.`,`UNIQUE constraint resolves concurrent duplicates; store a request hash; handle stuck keys.`]}, {
  imp: 'good',
  theory: TH(`An idempotency key lets a client safely retry a request (like a payment) without the server doing it twice.`,
`<p>A client sends "charge $50", the network times out, and the client doesn't know whether it worked. Retrying might charge twice. The fix: the client generates a unique <b>idempotency key</b> per logical operation and sends it with the request. The server records the key with the result. If the same key arrives again, it returns the stored result instead of charging again.</p>`,
[[`Idempotent`,`Doing it once or many times has the same effect.`],[`Idempotency key`,`Client-generated unique id for one logical operation.`],[`Unique constraint`,`Database rule that rejects duplicate keys atomically.`]],
[`Client creates a key (UUID) and sends it in a header.`,`Server inserts the key (status IN_PROGRESS); a unique constraint means only one request wins.`,`Server performs the operation, stores the response with the key.`,`A retry with the same key gets the stored response; a concurrent duplicate waits or gets 409.`],
[`Stripe and most payment APIs work this way; pass the key on to downstream providers.`,`Store a hash of the request body to reject the same key used with different data.`,`Expire keys after a retention period, and reconcile any stuck IN_PROGRESS ones.`],
[`Checking for the key and then inserting it (a race), instead of relying on the unique constraint.`,`Keeping keys in one pod's memory.`]),
  quiz: [
    [`The client times out on POST /payments and retries. How does the server avoid charging twice?`,[`It ignores every retry`,`It locks the account for a minute`,`Idempotency key → stored response`,`The client switches to GET`],2,`Same key, same result, no duplicate side effect.`,'E'],
    [`Two copies of a request with the same key arrive in the same millisecond. What stops both from running?`,[`A UNIQUE constraint on the key: only one insert wins`,`An in-memory HashMap of seen keys`,`Checking whether the key exists, then inserting`,`A short Thread.sleep`],0,`Check-then-insert races (4.4); the DB constraint is atomic and works across pods.`,'M'],
    [`The same key arrives with a different request body. Best response?`,[`Process it as a new request`,`Return the stored response`,`Ignore the new body`,`Reject it: the request hash differs`],3,`Signals a client bug.`,'H'],
    [`What is an idempotent operation?`,[`One that returns the same response time on every call`,`One that has the same effect whether it runs once or many times`,`One that never fails, so it never needs to be retried`,`One that only reads data and never changes any state`],1,`e.g. setting a value, not incrementing it.`,'E'],
    [`Who generates the idempotency key?`,[`The server, once per incoming HTTP request`,`The client, once per logical operation`,`The database, as the order's primary key`,`The client, freshly for every retry attempt`],1,`Retries reuse the same key.`,'E'],
    [`What does the server store with each key?`,[`The client's credentials so retries can re-authenticate`,`The status and the response (plus a request hash)`,`Only the client IP address and the request time`,`A lock that expires once the first request finishes`],1,`To replay the same response.`,'M'],
    [`Is <code>PUT /cars/7 {price: 100}</code> naturally idempotent?`,[`No: each PUT creates a new version of the car`,`Yes: repeating it leaves the same state`,`No: only GET and DELETE are idempotent by spec`,`Only if an idempotency key header is sent too`],1,`Unlike POST /charges.`,'M'],
    [`How long should idempotency keys be kept?`,[`Forever, so any replay at any time returns the original result`,`A bounded retention window (e.g. 24 h–7 days), long enough for retries`,`Only until the response is sent, then delete it right away`,`Until the next deploy, since keys live in application memory`],1,`Then expire them.`,'M'],
  ],
  quizAdv: [
    [`A key stays IN_PROGRESS forever after a crash. Fix?`,[`Expire, then reconcile with the provider`,`Delete it; let the client retry blindly`,`Mark it COMPLETED and move on`,`Ignore it; it's harmless`],0,`Ask the payment provider what actually happened.`,'H'],
    [`Where do you store idempotency keys with 10 pods?`,[`A HashMap on each pod`,`The client's local storage`,`A ThreadLocal per request`,`A shared store, unique key`],3,`A DB table or Redis SET NX, not per-pod memory.`,'M'],
    [`A retry arrives while the first request with the same key is still IN_PROGRESS. Reasonable response?`,[`Process it again, since the first may have crashed`,`409 Conflict (or wait/poll) until the first finishes`,`200 OK with an empty body to stop further retries`,`404 Not Found, since no response is stored yet`],1,`Never run the side effect twice.`,'H'],
    [`Why also pass the idempotency key to downstream providers like Stripe?`,[`Because Stripe rejects any request that doesn't include a key`,`So their side is protected from duplicates too if your call is retried`,`So the payment is encrypted end to end with the shared key`,`So they can refund automatically when your service crashes`],1,`End-to-end protection.`,'M'],
  ],
});
