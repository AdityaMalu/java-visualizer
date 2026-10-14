/* 5.13b Saga and the Outbox pattern */
topic('5', { no:'5.13b', title:'Saga and the Outbox pattern', idea:`A distributed order: create, charge, then reserve stock fails, so compensations run in reverse. Then the outbox makes "saved ⇔ event published" reliable.`,
actors:'Services', stateTitle:'Data per service',
codes:{a:`void placeOrder(Order o) {                    // orchestrator
  orders.create(o);                            // T1 (local tx in Order DB)
  try {
    payments.charge(o);                        // T2 (Payment DB)
    try { inventory.reserve(o); }              // T3 (Inventory DB)
    catch (OutOfStock e) { payments.refund(o); throw e; }   // C2
  } catch (Exception e) {
    orders.cancel(o);                          // C1
  }
}`,
b:`@Transactional
public void placeOrder(Order o) {
  orderRepo.save(o);                                        // business row
  outboxRepo.save(new OutboxEvent("OrderPlaced", toJson(o)));   // SAME tx
}
// relay (poller or Debezium CDC):
//   SELECT * FROM outbox WHERE sent = false ORDER BY id
//   -> kafka.send(event) -> UPDATE outbox SET sent = true
// consumers must be idempotent: the relay may send twice`},
steps:[
{cv:'a', th:[['Order','RUN:ok','own DB'],['Payment','RUN:ok','own DB'],['Inventory','RUN:ok','own DB']], g:[G('Why not one transaction?',['each service','owns its database','ok'],['2PC / XA across services','blocking, fragile, rarely available','bad'],['so','a chain of LOCAL transactions + compensations'])],
 say:`In microservices each service owns its data, so there's no single ACID transaction across them. A <b>saga</b> is a sequence of local transactions, each with a <b>compensating action</b> that semantically undoes it.`},
{hl:{saga:[2]}, th:[['Order','DONE:ok','T1: order PENDING'],['Payment','READY',''],['Inventory','READY','']], g:[G('Order DB',['order 42','PENDING','hot'])],
 say:`T1 commits locally: the order exists in a <b>PENDING</b> state. Sagas expose intermediate states, so design for them (show "processing" in the UI rather than "confirmed").`},
{hl:{saga:[4]}, th:[['Order','DONE:ok',''],['Payment','DONE:ok','T2: charged ₹4,999'],['Inventory','READY','']], g:[G('Order DB',['order 42','PENDING']), G('Payment DB',['charge 42','CAPTURED','hot'])],
 say:`T2: payment captured and committed in the payment service's DB.`},
{hl:{saga:[5]}, th:[['Order','DONE:ok',''],['Payment','DONE:ok',''],['Inventory','FAILED:bad','T3: out of stock']], log:['✘ OutOfStock: SKU 991'],
 say:`T3 fails: no stock. We can't roll back T1 and T2, because they're already committed in other databases.`},
{hl:{saga:[6,8]}, th:[['Order','COMPENSATED:warn','C1: order CANCELLED'],['Payment','COMPENSATED:warn','C2: refunded'],['Inventory','FAILED:bad','']], g:[G('Order DB',['order 42','CANCELLED','hot']), G('Payment DB',['charge 42','REFUNDED','hot'])], log:['C2 refund(42) ✔','C1 cancel(42) ✔'],
 say:`Compensations run in <b>reverse order</b>: refund (C2), then cancel the order (C1). They must be <b>idempotent and retryable</b>, because they can fail too. <b>Orchestration</b> (a coordinator like this, or Temporal / Camunda) is easier to follow. <b>Choreography</b> (each service reacts to events) is more decoupled but harder to trace.`},
{cv:'b', logReset:true, th:[['Order','RUN:bad','DB commit ✔ then Kafka send ✘']], g:[G('Dual write problem',['save(order) then kafka.send()','crash between → order saved, NO event','bad'],['kafka.send() then save()','DB fails → phantom event for no order','bad'])],
 say:`Every step above has a hidden trap: "write to my DB <b>and</b> publish an event" is two systems with no shared transaction. A crash between them loses the event or publishes a phantom one. That's the <b>dual write problem</b>.`},
{hl:{outbox:[1,2,3,4,5]}, th:[['Order','RUN:ok','one local tx']], g:[G('Order DB (single commit)',['orders','order 42','ok'],['outbox','{id: 9001, type: OrderPlaced, sent: false}','ok'])],
 say:`<b>Outbox:</b> write the business row <b>and</b> an event row into an <code>outbox</code> table in the <b>same local transaction</b>. Either both exist or neither does. That's atomic by plain ACID.`},
{hl:{outbox:[6,7,8,9]}, th:[['Relay','RUN:ok','publishes 9001'],['Kafka','RUN:ok','OrderPlaced'],['Payment','RUN:ok','consumes (idempotently)']], g:[G('outbox row 9001',['sent','true','ok'])], log:['relay: SELECT unsent → send 9001 → mark sent','consumer: processed event 9001 (dedupe by id)'],
 say:`A separate relay (a poller, or CDC with <b>Debezium</b> reading the DB log) publishes unsent rows to Kafka and marks them sent. If it crashes after sending but before marking, it sends again, so delivery is <b>at least once</b>. Consumers deduplicate by event id (an idempotent consumer table) to get effectively-once processing.`}
],
keep:[`Saga: local transactions + reverse-order compensations; expose intermediate states.`,`Compensations must be idempotent and retryable. Orchestration vs choreography.`,`Outbox: business row + event row in one tx; relay publishes at-least-once → idempotent consumers.`]}, {
  imp: 'good',
  theory: TH(`A saga replaces one big distributed transaction with a series of local transactions plus "undo" steps; the outbox pattern makes saving data and publishing an event reliable.`,
`<p>An order touches several services, each with its own database: create order, charge payment, reserve stock. There's no single transaction across them. A <b>saga</b> runs each step as a local transaction. If a later step fails, it runs <b>compensations</b> for the earlier ones in reverse: refund the payment, cancel the order.</p>
<p>Services usually communicate through events. But "save to my DB" and "publish to Kafka" are two systems, so one can succeed while the other fails. The <b>outbox pattern</b> writes the event into an <code>outbox</code> table <i>in the same DB transaction</i> as the data; a separate relay reads that table and publishes to the broker.</p>`,
[[`Saga`,`Sequence of local transactions with compensating actions.`],[`Compensation`,`A business "undo" (refund, release stock).`],[`Orchestration / choreography`,`A central coordinator / services reacting to each other's events.`],[`Outbox`,`Table of events written in the same transaction as business data.`],[`At-least-once`,`Messages may be delivered more than once, never lost.`]],
[`Step 1 commits locally and emits an event (via the outbox).`,`The next service reacts, does its local transaction, emits its event.`,`A failure triggers compensations for completed steps, in reverse order.`,`Consumers deduplicate by event id because delivery is at-least-once.`],
[`Expose intermediate states to users (PENDING, CONFIRMED).`,`Make compensations idempotent and retryable.`],
[`Publishing to Kafka inside a DB transaction and assuming both happen.`,`Consumers that can't handle duplicate events.`]),
  quiz: [
    [`Order created, payment charged, inventory reservation fails. In a saga, next?`,[`A distributed two-phase-commit rollback`,`Compensations in reverse: refund, then cancel`,`Nothing: the order stays half done`,`Retry the inventory call until it works`],1,`Each step has a compensation.`,'E'],
    [`What does the Outbox pattern solve?`,[`Slow queries under load`,`Thread pool exhaustion`,`Schema migrations across services`,`DB save and Kafka publish in one step`],3,`Avoids "saved but not published" and "published but rolled back".`,'M'],
    [`The outbox relay publishes at-least-once. What must consumers be?`,[`Idempotent`,`Stateless`,`Single-threaded`,`Timestamp-ordered`],0,`Duplicates will happen.`,'H'],
    [`Why can't a normal database transaction span two microservices?`,[`HTTP calls are stateless, so they can't carry a transaction ID`,`Each service has its own database; there's no shared transaction`,`Spring only supports @Transactional within a single bean`,`Message brokers like Kafka reject any transactional producer`],1,`Sagas coordinate local transactions instead.`,'E'],
    [`What is a compensating action?`,[`A database rollback of the earlier step's transaction`,`A business "undo" of an earlier step, e.g. refund`,`A retry of the failed step with a new idempotency key`,`A timeout that cancels the step if it runs too long`],1,`Must be idempotent.`,'E'],
    [`Orchestration means?`,[`Services react to each other's events with no central owner`,`A central coordinator tells each service what to do next`,`A coordinator runs two-phase commit across all databases`,`Each service polls a shared table to find its next task`],1,`Choreography is the event-driven alternative.`,'M'],
    [`In the outbox pattern, who publishes to Kafka?`,[`The request thread, inside the transaction`,`A separate relay reading the outbox table (polling or CDC)`,`The database`,`The consumer`],1,`After the transaction commits.`,'M'],
    [`What delivery guarantee does the outbox give?`,[`Exactly-once`,`At-least-once`,`At-most-once`,`None`],1,`Consumers must deduplicate.`,'M'],
  ],
  quizAdv: [
    [`Orchestration vs choreography in a saga?`,[`They're the same thing`,`Coordinator vs event-driven`,`Choreography needs 2PC`,`Orchestration can't compensate`],1,`Orchestration is easier to follow; choreography is more decoupled.`,'M'],
    [`Outbox relay by polling vs CDC (e.g. Debezium)?`,[`CDC gives exactly-once delivery`,`Polling has lower latency`,`CDC reads the log, no polling`,`Polling avoids duplicates`],2,`Both are at-least-once.`,'H'],
    [`Why expose intermediate states (PENDING_PAYMENT) in a saga?`,[`Kafka requires each saga state to be published as its own topic`,`Steps happen over time; clients must see and handle in-progress states`,`Intermediate states lock the rows until the saga finishes`,`They let the database roll back the saga automatically on failure`],1,`No global atomic view exists.`,'M'],
    [`What is two-phase commit's main problem in microservices?`,[`It commits too eagerly, so partial writes are always visible`,`Blocking coordinator, poor availability, little broker/DB support`,`It doesn't encrypt messages between the participants`,`It works only when every service uses Kafka for messaging`],1,`Sagas trade atomicity for availability.`,'H'],
  ],
});
