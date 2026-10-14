/* 3.7f Observer (events) */
topic('3', { no:'3.7f', title:'Observer (events)', idea:`OrderService publishes "order placed" and listeners react without the service knowing them. Then the failure modes: a throwing listener, a slow listener, and events before commit.`,
actors:'Listeners', stateTitle:'Publisher',
codes:{a:`interface OrderListener { void onPlaced(Order o); }
class OrderService {
  private final List<OrderListener> listeners = new CopyOnWriteArrayList<>();
  void subscribe(OrderListener l) { listeners.add(l); }
  void place(Order o) {
    repo.save(o);
    for (OrderListener l : listeners) l.onPlaced(o);   // notify all
  }
}
svc.subscribe(new SmsListener());
svc.subscribe(new EmailListener());
svc.subscribe(o -> analytics.track(o));
svc.place(order);`,
b:`@Service class OrderService {
  private final ApplicationEventPublisher events;
  @Transactional void place(Order o) {
    repo.save(o);
    events.publishEvent(new OrderPlaced(o.id()));
  }
}
@Component class SmsListener {
  @Async
  @TransactionalEventListener(phase = AFTER_COMMIT)   // only if the tx commits
  void on(OrderPlaced e) { sms.send(e.orderId()); }
}`},
steps:[
{cv:'a', hl:{svc:[10,11,12]}, th:[['Sms','subscribed:info',''],['Email','subscribed:info',''],['Analytics','subscribed:info','lambda']], g:[G('OrderService.listeners',C('list',['Sms','Email','Analytics']))],
 say:`<b>Observer</b>: subscribers register with a publisher. The publisher only knows the <code>OrderListener</code> interface, so you can add or remove reactions without touching OrderService. (CopyOnWriteArrayList so that subscribing during notification is safe, 4.16.)`},
{hl:{svc:[13,6,7]}, th:[['Sms','RUN:ok','onPlaced → SMS'],['Email','RUN:ok','onPlaced → email'],['Analytics','RUN:ok','track']], log:['saved order 42','SMS sent','email sent','tracked'],
 say:`<code>place()</code> saves, then notifies each listener <b>in turn, on the same thread</b>. Loose coupling: OrderService doesn't import SmsService.`},
{th:[['Sms','RUN:bad','throws: gateway down'],['Email','NEW:dim','never called'],['Analytics','NEW:dim','never called']], log:['✘ RuntimeException in SmsListener → loop aborted; place() fails'],
 say:`<b>Failure mode 1:</b> with plain synchronous notification, one listener's exception <b>stops the loop</b> and bubbles up into <code>place()</code>. A broken SMS gateway now fails orders. Wrap each call in try/catch, or make listeners asynchronous.`},
{th:[['Sms','RUN:warn','takes 3 s'],['Email','WAITING','waiting its turn'],['Analytics','WAITING','']], log:['place() took 3.2 s ✘'],
 say:`<b>Failure mode 2:</b> a slow listener slows down the publisher, because notification is synchronous. Also: listeners that are never unsubscribed keep objects alive (a memory leak, 1.4).`},
{cv:'b', logReset:true, hl:{svc:[3,4,5],Sms:[9,10,11]}, th:[['Sms','WAITING:warn','queued until commit']], g:[G('transaction',['repo.save','pending'],['event','held until AFTER_COMMIT','hot'])],
 say:`<b>Failure mode 3:</b> publishing inside a transaction that later <b>rolls back</b> means you've sent an SMS for an order that doesn't exist. Spring's <code>@TransactionalEventListener(AFTER_COMMIT)</code> delays delivery until the commit succeeds, and <code>@Async</code> moves it off the request thread.`},
{th:[['Sms','RUN:ok','after commit, async']], g:[G('transaction',['commit','done','ok'],['event delivered','SmsListener on task executor','ok']), G('Across services',['in-process Observer','lost if the pod dies before delivery','bad'],['Kafka topic','durable, replayable, many consumers','ok'],['guarantee "saved ⇒ published"','Outbox pattern (5.13)','ok'])],
 say:`In-process events vanish if the JVM dies between commit and delivery. Across services, the Observer becomes <b>pub/sub on Kafka</b>, and the <b>Outbox pattern</b> guarantees the event is published if and only if the DB commit happened (5.13).`}
],
keep:[`Observer: publisher knows only the listener interface; add reactions without editing it.`,`Sync notification: one exception aborts the rest, a slow listener slows the publisher.`,`Spring: @TransactionalEventListener(AFTER_COMMIT) + @Async; across services → Kafka + Outbox.`]}, {
  imp: 'good',
  theory: TH(`Observer lets one object announce events while any number of listeners react, without the publisher knowing who they are.`,
`<p>When an order is placed, many things should happen: send an email, update analytics, notify the warehouse. If OrderService called each of them directly, it would grow with every new feature. Instead it <b>publishes</b> an "OrderPlaced" event, and each interested component <b>subscribes</b>. Adding a reaction means adding a listener; the publisher never changes.</p>`,
[[`Publisher / subject`,`The object that emits events.`],[`Listener / observer`,`Code that reacts to an event.`],[`Synchronous vs asynchronous`,`Listeners run in the publisher's thread, or later on another thread.`]],
[`Define an event (a small immutable record).`,`Listeners register interest (in Spring: <code>@EventListener</code> methods).`,`The publisher calls <code>publishEvent(event)</code>; the framework calls every matching listener.`],
[`Use <code>@TransactionalEventListener(phase = AFTER_COMMIT)</code> for side effects that should only happen once the data is saved.`,`Across services, publish events to a broker (Kafka) using the Outbox pattern.`],
[`Slow or failing synchronous listeners that slow down or break the publisher.`,`Sending emails before the transaction commits.`]),
  quiz: [
    [`Send a confirmation email only if the order transaction commits. In Spring?`,[`@EventListener`,`@Async on its own`,`@TransactionalEventListener(AFTER_COMMIT)`,`@PostConstruct on the mail service`],2,`AFTER_COMMIT fires only once the change is durable, so a rollback won't send a misleading email.`,'E'],
    [`A synchronous listener throws while handling OrderPlaced. What happens?`,[`Spring isolates listeners, so the others still run`,`The exception reaches the publisher; later listeners may not run`,`The event is put back on the queue and retried`,`The exception is logged and swallowed`],1,`Synchronous notification couples the publisher to every listener's failures and latency.`,'M'],
    [`An event is published outside any transaction, and its listener is <code>@TransactionalEventListener(AFTER_COMMIT)</code>. What happens?`,[`The listener runs immediately instead`,`It throws IllegalStateException`,`It runs at the next commit on that thread`,`It's skipped unless fallbackExecution = true`],3,`With no transaction to bind to, the event is dropped for that listener by default.`,'H'],
    [`Observer decouples...`,[`threads from the locks they acquire`,`the publisher from the code reacting to its events`,`interfaces from the classes implementing them`,`the database from the cache in front of it`],1,`Add reactions without editing the publisher.`,'E'],
    [`Spring annotation to handle an application event?`,[`@Bean`,`@EventListener`,`@Async`,`@Service`],1,`publisher.publishEvent(event) triggers it.`,'E'],
    [`By default, Spring event listeners run?`,[`Asynchronously, on a new thread each`,`Synchronously, in the publisher's thread`,`On Spring's task scheduler thread pool`,`After the publisher's transaction commits`],1,`Add @Async for asynchronous handling.`,'M'],
    [`Why use AFTER_COMMIT for "send email" listeners?`,[`So the email is sent on a separate async thread`,`So the email only goes out once the data is really saved`,`So a failed email rolls back the saved data`,`So the listener joins the publisher's transaction`],1,`Rollbacks would otherwise send wrong emails.`,'M'],
    [`What's the risk of many slow synchronous listeners?`,[`Listeners start running on parallel threads`,`The publisher's request gets slower with each one`,`Each listener keeps its event object in memory`,`Listeners always deadlock with the publisher`],1,`Make heavy ones async or move to a queue.`,'M'],
  ],
  quizAdv: [
    [`Across microservices, the Observer pattern usually becomes?`,[`Direct HTTP calls to every service`,`Shared database triggers`,`Events on a broker via the Outbox pattern`,`RMI callbacks`],2,`The outbox makes "save" and "publish" atomic.`,'M'],
    [`An <code>@EventListener</code> that is also <code>@Async</code> throws. What does the publisher see?`,[`Nothing: it goes to the async exception handler`,`The exception, rethrown from publishEvent`,`A rollback of its transaction`,`An automatic retry`],0,`For void async methods, Spring uses the AsyncUncaughtExceptionHandler.`,'H'],
    [`Listeners in one JVM vs a message broker?`,[`Same delivery guarantees, just a different API`,`In-JVM events vanish on crash; a broker persists them`,`Brokers are synchronous; in-JVM events are async`,`In-JVM events reach other services; brokers don't`],1,`Use the outbox for reliable cross-service events.`,'H'],
    [`Java's built-in <code>java.util.Observable</code>?`,[`Recommended for new code over listener interfaces`,`Deprecated since Java 9; use listener interfaces`,`Removed in Java 8 with the move to lambdas`,`Generic since Java 5, typed as Observable&lt;T&gt;`],1,`Too limited.`,'M'],
  ],
});
