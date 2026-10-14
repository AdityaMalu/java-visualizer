/* 3.7e State (auction lifecycle) */
topic('3', { no:'3.7e', title:'State (auction lifecycle)', idea:`An auction moves SCHEDULED → LIVE → SOLD or CANCELLED. Each state class decides what's legal, and the auction just delegates.`,
actors:'Auction', stateTitle:'Auction', dgTitle:'State machine',
vb:'0 0 520 200',
nodes:{SCHED:{x:80,y:60,label:'SCHEDULED',w:120},LIVE:{x:270,y:60,label:'LIVE',w:100},SOLD:{x:450,y:60,label:'SOLD',w:100},CANC:{x:270,y:160,label:'CANCELLED',w:120}},
edges:[['SCHED','LIVE','start()'],['LIVE','SOLD','end() + bids'],['LIVE','CANC','end(), no bids'],['SCHED','CANC','end()']],
codes:{a:`interface AuctionState {
  AuctionState start(Auction a);
  AuctionState bid(Auction a, long amt);
  AuctionState end(Auction a);
}
class Scheduled implements AuctionState {
  public AuctionState start(Auction a) { return new Live(); }
  public AuctionState bid(Auction a, long x) { throw new IllegalStateException("not started"); }
  public AuctionState end(Auction a)   { return new Cancelled(); }
}
class Live implements AuctionState {
  public AuctionState start(Auction a) { throw new IllegalStateException("already live"); }
  public AuctionState bid(Auction a, long x) { a.accept(x); return this; }
  public AuctionState end(Auction a)   { return a.hasBids() ? new Sold() : new Cancelled(); }
}
class Auction {
  private AuctionState state = new Scheduled();
  void bid(long x) { state = state.bid(this, x); }     // delegate
  void start()     { state = state.start(this); }
  void end()       { state = state.end(this); }
}`},
steps:[
{hl:{auction:[17,18],Scheduled:[8]}, th:[['auction','SCHEDULED:info','bid(50000)']], d:{type:'graph',on:['SCHED']}, log:['✘ IllegalStateException: not started'],
 say:`The <b>State</b> pattern: each state is a class that implements every event. <code>Auction.bid</code> just delegates to the current state. In SCHEDULED, bidding is illegal, and the <b>Scheduled</b> class says so. There's no <code>if (status == …)</code> in Auction.`},
{hl:{auction:[19],Scheduled:[7]}, th:[['auction','LIVE:ok','start()']], d:{type:'graph',on:['LIVE'],e:[['SCHED','LIVE','start()','hot']]},
 say:`<code>start()</code> → Scheduled returns a <b>Live</b> state and the auction swaps its delegate. The object <b>changes its own behaviour</b> as its state changes.`},
{hl:{auction:[18],Live:[13]}, th:[['auction','LIVE:ok','bids accepted']], g:[G('Auction',['bids','₹5,00,000, ₹5,20,000','hot'],['highest','₹5,20,000'])], log:['bid 500000 accepted','bid 520000 accepted'],
 say:`In LIVE, bids are accepted. Live returns <code>this</code>, so the state is unchanged.`},
{hl:{auction:[20],Live:[14]}, th:[['auction','SOLD:ok','end() with bids']], d:{type:'graph',on:['SOLD'],e:[['LIVE','SOLD','end() + bids','hot']]}, log:['sold for 520000'],
 say:`<code>end()</code> → Live checks <code>hasBids()</code> → SOLD (otherwise CANCELLED). The transition rules live in the state classes, so they're easy to unit-test one state at a time.`},
{th:[['auction','SOLD:ok','bid(600000)']], d:{type:'graph',on:['SOLD'],bad:['SOLD']}, log:['✘ IllegalStateException: auction closed'],
 say:`Sold rejects everything. Illegal transitions fail loudly instead of corrupting data.`},
{th:[], d:{type:'graph',on:['LIVE']}, g:[G('Simpler alternative',['enum Status + switch','fine for small machines'],['Spring Statemachine','big workflows']), G('In a database (SDE-2)',['status column','LIVE / SOLD …'],['transition atomically','UPDATE auction SET status = \'SOLD\' WHERE id = ? AND status = \'LIVE\''],['0 rows updated','someone else won the race → reject','ok'],['or','@Version optimistic locking'])],
 say:`In real systems the state is a DB column, and two pods can both try "end the auction". Make each transition a <b>conditional update</b> (<code>WHERE status = 'LIVE'</code>) and check the affected row count. That's a compare-and-swap in SQL (compare 4.7). <b>State vs Strategy:</b> same structure, but here the object switches itself.`}
],
keep:[`Each state class implements every event; context delegates and swaps state.`,`Illegal events throw in that state; transitions are testable per state.`,`In the DB: conditional UPDATE … WHERE status = expected (CAS in SQL).`]}, {
  imp: 'good',
  theory: TH(`State turns each status of an object (scheduled, live, closed) into a class that knows which actions are allowed and what the next state is.`,
`<p>An auction behaves differently depending on its status: you can bid when it's LIVE but not when it's CLOSED. Writing <code>if (status == …)</code> in every method gets messy fast. In the <b>State</b> pattern each status is a class implementing all the events (<code>placeBid</code>, <code>close</code>). The auction delegates to its current state object, and the state decides whether the action is legal and which state comes next.</p>`,
[[`State machine`,`A set of states and allowed transitions between them.`],[`Transition`,`Moving from one state to another in response to an event.`],[`Context`,`The object whose behaviour depends on its current state.`]],
[`List the states and events; draw the allowed transitions.`,`Create a state class per state; each implements every event, rejecting illegal ones.`,`The context delegates events to the current state and replaces it on transitions.`,`Persist the state (e.g. a status column) and guard transitions in the DB.`],
[`Orders, payments, auctions and tickets are all state machines.`,`In the database, make transitions atomic with <code>UPDATE … WHERE status = 'LIVE'</code> (a compare-and-set).`],
[`Transitions checked in Java but not guarded in the DB, which races across pods.`,`State logic scattered across services instead of one place.`]),
  quiz: [
    [`An auction in CLOSED receives <code>placeBid()</code>. With the State pattern, what happens?`,[`ClosedState.placeBid() rejects it`,`The context checks the status with if/else first`,`It's silently ignored`,`It's queued until the auction reopens`],0,`Each state class implements every event; illegal ones are rejected in that state.`,'E'],
    [`Biggest benefit of State over a switch on a status field?`,[`There are fewer classes than with the switch`,`It runs faster than a switch statement`,`Each state's current value is saved to the database for you`,`Each state's rules live in one class you can test on its own`],3,`Behaviour is localised per state.`,'M'],
    [`Two pods try to move one auction from LIVE to CLOSED. How do you make it safe in the DB?`,[`SELECT the status, then UPDATE if it's LIVE, inside @Transactional`,`UPDATE … SET status='CLOSED' WHERE id=? AND status='LIVE'; check rows`,`A synchronized block on the auction's id string`,`Retry the UPDATE in a loop until it succeeds`],1,`A conditional update is a compare-and-set in SQL; only one pod sees 1 row. SELECT-then-UPDATE races under READ COMMITTED, and synchronized only covers one JVM.`,'H'],
    [`In the State pattern, what changes when an event occurs?`,[`The context's class, via a new subclass instance`,`The current state object the context delegates to`,`The methods exposed on the context's interface`,`The strategy bean injected by the Spring container`],1,`The context swaps its state.`,'E'],
    [`An illegal event in a state should?`,[`Be ignored so the state stays unchanged`,`Be rejected clearly (exception / error result)`,`Reset the machine to its initial state`,`Be queued until a valid state is reached`],1,`Fail loudly.`,'E'],
    [`Which Java feature fits a small state machine well?`,[`A HashMap of strings mapping to boolean flags`,`An enum with allowed transitions and an exhaustive switch`,`A class hierarchy using reflection to pick states`,`A dedicated thread per state with a shared queue`],1,`See 7.1.`,'M'],
    [`How do you prevent two servers from both moving an order from PAID to SHIPPED twice?`,[`Mark the transition method synchronized`,`UPDATE … WHERE status = 'PAID' and check rows affected`,`Keep a static in-memory set of shipped orders`,`Read the status first, then UPDATE if PAID`],1,`Compare-and-set in SQL.`,'M'],
    [`Strategy vs State?`,[`Same structure; caller picks a strategy, an object changes its own state`,`Unrelated patterns with different class structures`,`State is a Strategy using only enums, no classes`,`Strategies swap themselves; callers pick the state`],0,`Intent differs.`,'M'],
  ],
  quizAdv: [
    [`Auction has <code>@Version</code>. Two pods close it at the same time through JPA. Outcome?`,[`Both commit; the last write wins`,`They deadlock on the row lock`,`The second blocks, then commits too`,`One commits; the other gets OptimisticLockException`],3,`The versioned UPDATE matches 0 rows for the loser.`,'H'],
    [`Auctions must close at 18:00, and you run 4 pods. Where should that transition run?`,[`@Scheduled on every pod is harmless`,`One job, with a lock or conditional UPDATE`,`In the Auction entity's constructor`,`A timer in the client's browser`],1,`Only one pod should do it, and the DB update must be idempotent.`,'H'],
    [`Where should state transition rules live in a microservice?`,[`In the UI, which hides buttons for invalid moves`,`In one domain class/state machine, enforced in the DB too`,`In each controller that handles the request`,`Only in SQL triggers, outside the application`],1,`Single source of truth.`,'M'],
    [`Why record state transitions as events (e.g. an audit table)?`,[`JPA requires an audit row for every update`,`Debugging and history: who changed what, when`,`It lets you drop indexes on the status column`,`It removes the need for optimistic locking`],1,`Often required for orders and payments.`,'M'],
  ],
});
