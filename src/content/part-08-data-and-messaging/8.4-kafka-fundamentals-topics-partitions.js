/* 8.4 Kafka fundamentals: topics, partitions, consumer groups */
topic('8', { no:'8.4', title:'Kafka fundamentals: topics, partitions, consumer groups', imp:'must', idea:`Follow order events from a producer into a partitioned topic, out to two independent consumer groups, through offset commits, a crash, a redelivery and a rebalance.`,
actors:'Consumers', stateTitle:'Offsets (next message to read)', dgTitle:'Topic "orders" (3 partitions)', logTitle:'Events',
vb:'0 0 600 220',
nodes:{prod:{x:70,y:110,label:'order-service\nproducer',w:120,h:46}, p0:{x:250,y:45,label:'P0 ▮▮▮▮▮',kind:'mem',w:110,h:30}, p1:{x:250,y:110,label:'P1 ▮▮▮▮',kind:'mem',w:110,h:30}, p2:{x:250,y:175,label:'P2 ▮▮▮▮▮▮',kind:'mem',w:110,h:30},
  c1:{x:440,y:70,label:'billing #1',w:100,h:30}, c2:{x:440,y:150,label:'billing #2',w:100,h:30}, a1:{x:560,y:110,label:'analytics',w:70,h:30,fs:10}},
edges:[['prod','p0'],['prod','p1'],['prod','p2'],['p0','c1'],['p1','c1'],['p2','c2']],
codes:{a:`// Producer: the key decides the partition → same key, same order
producer.send(new ProducerRecord<>("orders", order.customerId(), event));

// Consumer: one group id = one logical subscriber
props.put("group.id", "billing-service");
props.put("enable.auto.commit", "false");
consumer.subscribe(List.of("orders"));
while (true) {
  for (ConsumerRecord<String, OrderEvent> r : consumer.poll(Duration.ofMillis(500))) {
    billing.handle(r.value());            // must be idempotent
  }
  consumer.commitSync();                  // commit offsets AFTER processing
}`},
steps:[
{hl:{c1:[1,2]}, th:[], d:{type:'graph',on:['prod','p0','p1','p2'],e:[['prod','p1','key = cust-7','hot']]}, g:[G('Topic "orders"',['P0','offsets 0 … 4'],['P1','offsets 0 … 3'],['P2','offsets 0 … 5'],['partition for key','hash(key) % 3'])],
 say:`Kafka stores events in <b>topics</b>, and each topic is split into <b>partitions</b>: append-only logs on disk. Every message in a partition gets an increasing number, its <b>offset</b>. The producer picks the partition by hashing the <b>key</b>, so all events for customer 7 land in P1, <b>in order</b>. Kafka guarantees order only <b>within</b> a partition.`},
{hl:{c1:[4,5,7]}, th:[['billing #1','RUN:ok','P0, P1'],['billing #2','RUN:ok','P2']], d:{type:'graph',on:['c1','c2'],e:[['p0','c1','','ok'],['p1','c1','','ok'],['p2','c2','','ok']]}, g:[G('Group billing-service',C('assignment',[['P0 → #1'],['P1 → #1'],['P2 → #2']]),['max useful consumers','3 (one per partition)'])],
 say:`Consumers with the same <b>group.id</b> share the work: each partition is assigned to <b>exactly one</b> consumer in the group. Two billing instances split three partitions. A 4th instance would sit idle, because <b>partitions are the unit of parallelism</b>.`},
{hl:{a1:[4]}, th:[['billing #1','RUN:ok','P0, P1'],['billing #2','RUN:ok','P2'],['analytics','RUN:ok','P0, P1, P2']], d:{type:'graph',on:['a1'],e:[['p0','a1','','hot'],['p1','a1','','hot'],['p2','a1','','hot']]}, g:[G('Offsets per group',['billing-service · P1','2'],['analytics · P1','0 (reads independently)','hot'])],
 say:`A <b>different group</b> gets its own copy of the stream, with its own offsets. Analytics reads everything without affecting billing. Messages aren't deleted when read; they're kept for the topic's <b>retention</b> period (e.g. 7 days), so a new consumer can even replay history.`},
{hl:{c1:[8,9,10]}, th:[['billing #1','RUN:ok','processing P1 offsets 2, 3'],['billing #2','RUN:ok','']], d:{type:'graph',on:['c1'],e:[['p1','c1','poll','hot']]}, g:[G('billing · P1',['committed offset','2'],['processing','offsets 2 and 3','hot'])],
 say:`<code>poll</code> fetches a batch. The consumer processes each record. Kafka doesn't know about this yet: progress is recorded only when the consumer <b>commits</b> its offset.`},
{hl:{c1:[12]}, g:[G('billing · P1',['committed offset','4','ok'],['meaning','"next read starts at 4"'])], log:['commitSync: billing-service P1 → 4'],
 say:`<b>Commit after processing.</b> Committing offset 4 says "everything before 4 is done". Committing <i>before</i> processing would lose messages if the consumer crashed in between (at-most-once).`},
{hl:{c1:[10]}, th:[['billing #1','TERM:bad','crashed after handling offset 4, before commit'],['billing #2','RUN:ok','P2']], d:{type:'graph',bad:['c1']}, g:[G('billing · P1',['committed offset','4'],['actually handled','offset 4 (charge created)','hot'])], log:['billing #1 crashed (OOMKilled)'],
 say:`Instance #1 processes offset 4 (creates an invoice) and <b>crashes before committing</b>. Kafka still thinks P1's next message is 4.`},
{th:[['billing #2','RUN:warn','now owns P0, P1, P2']], d:{type:'graph',ok:['c2'],dim:['c1'],e:[['p0','c2','','ok'],['p1','c2','rebalanced','ok'],['p2','c2','','ok']]}, g:[G('After rebalance',C('assignment',[['P0 → #2'],['P1 → #2'],['P2 → #2']]),['billing · P1 resumes at','4 → redelivered','bad'])], log:['rebalance: billing-service partitions reassigned','offset 4 delivered again to billing #2'],
 say:`The group <b>rebalances</b>: #2 takes over P0 and P1 and resumes from the committed offset 4, so offset 4 is processed <b>again</b>. This is <b>at-least-once delivery</b>, the normal Kafka setup. The consumer must be <b>idempotent</b>: dedupe by event id or make the operation naturally repeatable (5.13c), or the customer gets two invoices.`},
{th:[], d:null, g:[G('Production checklist',['key choice','what must stay in order? (customer id, order id)','ok'],['partitions','≥ expected consumer count; hard to reduce later'],['idempotent consumers','dedupe table / unique constraint','ok'],['poison messages','retry a few times, then a dead-letter topic','ok'],['publishing from a DB transaction','outbox pattern (5.13b)','ok'],['exactly-once','idempotent producer + transactions, within Kafka only'])],
 say:`<b>Say it:</b> "A topic is split into partitions; the key picks the partition, and order is only guaranteed within one. Each partition goes to one consumer per group, so partitions cap parallelism. I commit offsets after processing, which gives at-least-once delivery, so consumers are idempotent. Failing messages go to a dead-letter topic, and producers use the outbox pattern."`}
],
keep:[`Topic → partitions (ordered logs with offsets); key → partition; order only within a partition.`,`One consumer per partition per group; other groups read independently; messages are retained, not deleted on read.`,`Commit after processing = at-least-once → idempotent consumers; rebalances redeliver; DLQ for poison messages.`]}, {
  imp: 'good',
  theory: TH(`Kafka is a distributed, durable log: producers append events to partitioned topics, and consumer groups read them at their own pace, tracking their position with offsets.`,
`<p>Services often need to tell each other "something happened" (order placed, payment received) without calling each other directly. <b>Kafka</b> stores these events in <b>topics</b>. Each topic is split into <b>partitions</b>, ordered append-only logs spread across brokers for scale and replicated for safety.</p>
<p>Consumers read in <b>groups</b>: within a group, each partition is handled by one consumer, so adding consumers (up to the number of partitions) adds throughput. Each group tracks its own <b>offset</b> per partition, so many independent services can read the same events. Events stay for the retention period whether or not they've been read.</p>`,
[[`Topic`,`A named stream of events.`],[`Partition`,`An ordered, append-only log; the unit of parallelism and ordering.`],[`Offset`,`Position of a message in a partition.`],[`Consumer group`,`Consumers sharing work; each partition to one member.`],[`Rebalance`,`Reassigning partitions when consumers join or leave.`],[`At-least-once`,`Messages may be redelivered after failures, never lost.`],[`DLQ`,`Dead-letter topic for messages that keep failing.`]],
[`Producer sends (key, value); hash(key) picks the partition.`,`Brokers append it to that partition's log and replicate it.`,`Consumers in a group poll their assigned partitions.`,`After processing, they commit offsets; on restart they resume from the last commit.`],
[`Choose keys by what must stay ordered (e.g. orderId).`,`Make consumers idempotent; route poison messages to a DLQ.`,`Use the outbox pattern to publish events reliably from a database transaction.`],
[`Expecting global ordering across partitions.`,`Auto-committing before processing (lost messages).`,`More consumers than partitions and expecting more throughput.`]),
  quiz: [
    [`Kafka guarantees message order...`,[`Across the whole topic`,`Within a partition only`,`Across all topics`,`Never`],1,`Use a key so related events go to the same partition.`,'E'],
    [`A topic has 4 partitions; a group has 6 consumers. How many are actively consuming?`,[`6`,`4; 2 sit idle`,`3`,`1`],1,`Each partition goes to one consumer in a group.`,'M'],
    [`A consumer processes a message, then crashes before committing its offset. What happens?`,[`The message is lost, since it was already read once`,`Kafka moves it to the dead-letter topic automatically`,`It's redelivered after the rebalance, so processing must be idempotent`,`The whole partition is replayed from offset 0 on restart`],2,`At-least-once delivery.`,'H'],
    [`What is a Kafka topic?`,[`A table-like store of current values, keyed by id`,`A named stream of events, split into partitions`,`A queue owned by one consumer group, split into shards`,`A broker process that hosts a set of partition replicas`],1,`Producers write, consumers read.`,'E'],
    [`What is an offset?`,[`The timestamp at which the broker stored a message`,`The position of a message within a partition`,`The id of the partition a message was written to`,`A global sequence number across the whole topic`],1,`Consumers commit offsets to track progress.`,'E'],
    [`Two different consumer groups subscribe to the same topic. Each gets?`,[`Each gets a share of the messages, split across groups`,`All the messages, independently`,`Only the group that subscribed first gets the messages`,`All the messages, but only after the other group commits`],1,`Groups don't share progress.`,'E'],
    [`Are Kafka messages deleted once consumed?`,[`Yes, once every consumer group commits its offset`,`No: they're kept for the retention period`,`Only after the consumer acknowledges them`,`Yes, once all in-sync replicas have read them`],1,`Enables replay.`,'M'],
    [`What does a message key influence?`,[`Which broker replica handles the consumer's reads`,`Which partition the message goes to (and so its ordering)`,`How long the message is kept before it's deleted`,`Which consumer group the message is delivered to`],1,`Same key → same partition.`,'M'],
  ],
  quizAdv: [
    [`Why does adding partitions to an existing keyed topic break ordering for some keys?`,[`hash(key) % partitions changes, so a key's new events go to a different partition`,`Kafka rehashes and moves existing messages into the new partitions, reordering them`,`Consumer group offsets are reset to the earliest offset on all existing partitions`,`New partitions get their own leader, which reorders messages from all the other leaders`],0,`Plan partition counts up front.`,'H'],
    [`A message always fails processing (bad payload). What should the consumer do?`,[`Retry it forever with backoff until a fix is deployed`,`Commit its offset and skip it without logging anything`,`Retry a few times, then send it to a dead-letter topic and continue`,`Stop the consumer so the partition is reassigned elsewhere`],2,`Otherwise one poison message blocks the whole partition.`,'M'],
    [`What is a consumer lag metric?`,[`The network delay between the producer and the broker`,`How far a group's committed offset is behind the latest offset`,`How long a consumer takes to process each message`,`How far a follower replica is behind the partition leader`],1,`Rising lag means consumers can't keep up.`,'M'],
    [`What does an idempotent producer (enable.idempotence=true) prevent?`,[`Duplicate processing on the consumer side after a rebalance`,`Duplicate writes to a partition caused by producer retries`,`Message loss when the broker crashes before flushing to disk`,`Reordering of messages across different partitions of a topic`],1,`Default in recent clients.`,'H'],
  ],
});
