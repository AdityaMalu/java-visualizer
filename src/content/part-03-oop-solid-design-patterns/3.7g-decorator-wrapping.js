/* 3.7g Decorator (wrapping) */
topic('3', { no:'3.7g', title:'Decorator (wrapping)', idea:`Follow <code>readLine()</code> down through BufferedReader → InputStreamReader → FileInputStream, then build your own Retrying(Logged(Sms)) chain.`,
actors:'Call stack', stateTitle:'Wrappers',
codes:{a:`BufferedReader r = new BufferedReader(        // adds buffering + readLine()
    new InputStreamReader(                     // bytes -> chars (UTF-8)
        new FileInputStream("a.txt"),          // reads raw bytes
        StandardCharsets.UTF_8));
r.readLine();
r.readLine();`,
b:`interface Notifier { void send(String m); }
class Sms implements Notifier { public void send(String m) { gateway.sms(m); } }
class Logged implements Notifier {
  private final Notifier inner;
  Logged(Notifier inner) { this.inner = inner; }
  public void send(String m) { log.info("sending {}", m); inner.send(m); }
}
class Retrying implements Notifier {
  private final Notifier inner;
  Retrying(Notifier inner) { this.inner = inner; }
  public void send(String m) {
    for (int i = 1; ; i++) {
      try { inner.send(m); return; }
      catch (RuntimeException e) { if (i == 3) throw e; }
    }
  }
}
Notifier n = new Retrying(new Logged(new Sms()));
n.send("OTP 4821");`},
steps:[
{cv:'a', hl:{caller:[1,2,3,4]}, th:[], g:[G('wrapping (outside → inside)',C('',['BufferedReader','InputStreamReader','FileInputStream'])), G('each layer',['same kind of interface (Reader / InputStream)',''],['adds exactly one feature','buffering · decoding · file access'])],
 say:`<b>Decorator</b>: wrap an object in another object with the <b>same interface</b> that adds one behaviour, then delegates. Java I/O is built this way: features stack by nesting constructors.`},
{hl:{caller:[5]}, th:[['BufferedReader.readLine','RUN:ok','buffer empty → fill()'],['InputStreamReader.read(char[8192])','RUN:ok','decode UTF-8'],['FileInputStream.read(byte[])','RUN:ok','syscall to the OS']], g:[G('BufferedReader buffer',['chars','8192 loaded','hot'])], log:['readLine → "line 1"'],
 say:`First <code>readLine()</code>: the buffer is empty, so BufferedReader asks its inner Reader for a <b>big chunk</b> (8192 chars). The decoder asks the file stream for bytes, which makes one OS call. The call travels <b>inward</b> through each layer.`},
{hl:{caller:[6]}, th:[['BufferedReader.readLine','RUN:ok','served from buffer'],['InputStreamReader.read(char[8192])','NEW:dim','not called'],['FileInputStream.read(byte[])','NEW:dim','not called']], log:['readLine → "line 2"  (no syscall)'],
 say:`Second <code>readLine()</code> is served from memory, with no call to the inner layers. That's the point of the buffering decorator: thousands of small reads become a handful of syscalls.`},
{cv:'b', logReset:true, hl:{caller:[18,19],R:[11,12,13]}, th:[['Retrying.send','RUN:ok','attempt 1'],['Logged.send','RUN:ok','log + forward'],['Sms.send','RUN:bad','gateway timeout']], log:['sending OTP 4821','✘ timeout (attempt 1)'],
 say:`Your own decorators: <code>Retrying(Logged(Sms))</code>. The call goes Retrying → Logged → Sms. The SMS gateway times out, and the exception travels back up to Retrying.`},
{th:[['Retrying.send','RUN:ok','attempt 2'],['Logged.send','RUN:ok',''],['Sms.send','RUN:ok','sent']], log:['sending OTP 4821','✔ sent (attempt 2)'],
 say:`Retrying catches it and calls its inner again. Logging happens on each attempt because Logged is <b>inside</b> Retrying. Swap the order, <code>Logged(Retrying(Sms))</code>, and it logs once. <b>Order of wrapping is behaviour.</b>`},
{th:[], g:[G('Decorator vs inheritance',['features combine','at run time, any order','ok'],['subclass per combo','LoggedRetryingSms, RetryingSms … explosion','bad']), G('More decorators',['Collections.unmodifiableList','blocks writes'],['Collections.synchronizedList','adds locking'],['Spring/Resilience4j','@Retry, @CircuitBreaker (applied via proxies)']), G('Decorator vs Proxy',['Decorator','ADDS behaviour; client composes it'],['Proxy','CONTROLS access; usually created for you'])],
 say:`Decorators solve the same class-explosion problem as composition (3.4). The JDK's unmodifiable/synchronized wrappers are decorators. Decorator and Proxy are structurally identical; the difference is <b>intent</b> (3.7h).`}
],
keep:[`Same interface, wraps an inner object, adds one behaviour, delegates.`,`Calls flow inward; wrapping order changes behaviour (Logged(Retrying) ≠ Retrying(Logged)).`,`Java I/O, unmodifiableList are decorators; vs Proxy = intent.`]}, {
  imp: 'good',
  theory: TH(`A Decorator wraps an object with the same interface and adds one extra behaviour around it; decorators can be stacked.`,
`<p>You want a client that logs, retries and caches. Rather than one huge class, wrap the basic client in a <code>RetryingClient</code>, wrap that in a <code>LoggingClient</code>, and so on. Each wrapper implements the same interface, does its bit, and passes the call inward. Like layers of clothing, they can be added or removed independently, and their order matters.</p>`,
[[`Wrapper`,`An object that holds another of the same type and delegates to it.`],[`Delegation`,`Forwarding a call to the wrapped object.`]],
[`Implement the same interface as the object you wrap.`,`Take the wrapped object in the constructor.`,`In each method, add behaviour before or after calling the inner object.`],
[`Java I/O is decorators: <code>new BufferedReader(new InputStreamReader(in))</code>.`,`Collections.unmodifiableList and synchronizedList are decorators.`,`HTTP client interceptors and filters follow the same idea.`],
[`Forgetting that wrapping order changes behaviour (logging each retry vs once).`,`Closing only the inner stream and losing buffered data.`]),
  quiz: [
    [`<code>new BufferedReader(reader)</code> adds buffering behind the same Reader type. Which pattern?`,[`Decorator`,`Proxy`,`Adapter`,`Composite`],0,`Same interface, wraps an inner object, adds one behaviour, delegates.`,'E'],
    [`<code>Logged(Retrying(client))</code> vs <code>Retrying(Logged(client))</code>?`,[`No difference: decorators always commute`,`The first one ends up retrying the logging`,`The first logs once per call; the second logs each attempt`,`The second doesn't compile`],2,`Calls flow inward through the layers, so order changes behaviour.`,'M'],
    [`Decorator vs Proxy?`,[`Proxy changes the interface; a decorator keeps it the same`,`Decorators can be stacked several deep; proxies can't`,`Proxies must always be generated at run time`,`Same shape; decorator adds behaviour, proxy controls access`],3,`The difference is intent (lazy, cache, security, remote vs extra behaviour).`,'H'],
    [`A decorator implements...`,[`A different interface from the wrapped object`,`The same interface as the object it wraps`,`No interface`,`Only abstract classes`],1,`That's why decorators stack.`,'E'],
    [`Which JDK API is built from decorators?`,[`java.time (LocalDate, ZonedDateTime, Instant…)`,`java.io streams (BufferedInputStream, GZIPInputStream…)`,`java.util.Random (SecureRandom, ThreadLocalRandom…)`,`java.lang.Math (StrictMath, Math.abs, Math.max…)`],1,`Each adds one capability.`,'E'],
    [`Adding caching, logging and retry to a client with decorators instead of subclassing gives?`,[`One subclass for each feature combination`,`Independent layers you can combine and reorder`,`Faster calls, since no extra layers exist`,`A single class holding all three concerns`],1,`Avoids class explosion.`,'M'],
    [`<code>Collections.synchronizedList(list)</code> is a decorator adding?`,[`Sorting on every insertion`,`A lock around each method call`,`Immutability, rejecting writes`,`A cached copy for fast reads`],1,`Same List interface.`,'M'],
    [`Does the order of decorators matter?`,[`No: decorators are applied in any order`,`Yes: calls pass through outer layers first`,`Only for java.io streams, not other APIs`,`Only when decorators share mutable state`],1,`e.g. cache outside retry vs inside.`,'E'],
  ],
  quizAdv: [
    [`<code>Collections.unmodifiableList(list)</code> is an example of?`,[`Adapter: it changes the interface`,`Facade over the collection classes`,`Factory method`,`Decorator: same interface, blocks writes`],3,`It wraps and delegates reads, and throws on writes.`,'M'],
    [`You close only the inner FileWriter, not the outer BufferedWriter. Effect?`,[`Nothing: they share the same file`,`Buffered data that wasn't flushed is lost`,`IOException at the next write`,`Data is written twice`],1,`Close the outermost decorator; it flushes, then closes the inner one.`,'H'],
    [`Spring's <code>@Cacheable</code> plus <code>@Retryable</code> on one method: which concept decides their order?`,[`The order the annotations are written on the method`,`Advisor/interceptor order (e.g. @Order) in the proxy chain`,`Alphabetical order of the annotation class names`,`The registration order of the beans by name`],1,`The proxy applies interceptors in order.`,'H'],
    [`Decorator vs inheritance for adding behaviour to a final class?`,[`Inheritance, by overriding the public methods`,`Only a decorator, since final classes can't be subclassed`,`Neither, because final classes are fully sealed`,`Only reflection, by patching out the final modifier`],1,`Composition works with any implementation of the interface.`,'M'],
  ],
});
