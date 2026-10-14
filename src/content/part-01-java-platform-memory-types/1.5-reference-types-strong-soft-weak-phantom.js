/* 1.5 Reference types: strong, soft, weak, phantom */
topic('1', { no:'1.5', title:'Reference types: strong, soft, weak, phantom', idea:`Drop the strong references and watch what each GC event does to soft, weak and phantom references.`,
actors:'Events', stateTitle:'Objects and references',
codes:{a:`Image big   = loadImage("a.png");      // strong refs
Image thumb = loadImage("a_thumb.png");
SoftReference<Image> soft = new SoftReference<>(big);
WeakReference<Image> weak = new WeakReference<>(thumb, queue);
big = null; thumb = null;               // drop the strong refs
// ... a GC happens
weak.get();   // null: only weakly reachable -> cleared
soft.get();   // still there (cleared only under memory pressure)
// ... heap nearly full
soft.get();   // null: soft refs cleared BEFORE OutOfMemoryError`,
b:`Map<Session, Stats> m = new WeakHashMap<>();
Session s = new Session();
m.put(s, new Stats());        // key held WEAKLY, value strongly
s = null;                     // key no longer strongly reachable
// ... GC, then any m.get/size call expunges stale entries
m.size();                     // 0
// ✘ trap: value refers to key -> key never collected
m.put(s2, new Stats(s2));`},
steps:[
{cv:'a', hl:{main:[1,2,3,4]}, th:[['main','RUN','refs created']], g:[G('a.png (big)',['strong refs','big','ok'],['soft refs','soft']), G('a_thumb.png',['strong refs','thumb','ok'],['weak refs','weak (+ queue)'])],
 say:`Both images are <b>strongly</b> reachable through local variables, so the GC will never collect them. The wrapper objects (SoftReference, WeakReference) are themselves strong; what's special is the <b>referent</b> they point to.`},
{hl:{main:[5]}, g:[G('a.png (big)',['strong refs','none','hot'],['reachability','SOFTLY reachable','hot']), G('a_thumb.png',['strong refs','none','hot'],['reachability','WEAKLY reachable','hot'])],
 say:`Now the strongest path to each image is through a special reference. Strength order: <b>strong &gt; soft &gt; weak &gt; phantom</b>. An object's reachability is set by the <b>strongest</b> path to it.`},
{hl:{main:[6,7]}, th:[['GC','RUN:ok','minor GC']], g:[G('a.png (big)',['reachability','softly'],['state','kept (memory is fine)','ok']), G('a_thumb.png',['weak.get()','null','bad'],['state','collected','bad'],['queue','WeakReference enqueued','hot'])], log:['GC: cleared weak ref → enqueued on ReferenceQueue'],
 say:`At the <b>next GC</b>, weakly reachable objects are collected and the WeakReference is cleared. If you registered a <code>ReferenceQueue</code>, the reference object is enqueued, so you can poll it to clean up bookkeeping (for example, remove the map entry that pointed to it).`},
{hl:{main:[8]}, log:['soft.get() → Image(a.png)'],
 say:`The soft ref survives: soft referents are cleared only when the JVM is <b>short on memory</b> (HotSpot also uses an LRU-ish policy with <code>-XX:SoftRefLRUPolicyMSPerMB</code>). It sounds like a perfect cache…`},
{hl:{main:[9,10]}, th:[['GC','RUN:bad','full GC, heap nearly full']], g:[G('a.png (big)',['soft.get()','null','bad'],['guarantee','all soft refs cleared before OOM','ok'])], log:['GC: memory pressure → cleared soft refs'],
 say:`…but under pressure <b>all</b> soft refs can be cleared at once. The cache empties exactly when load is highest, and the GC does extra work deciding. In practice, prefer a real cache (<b>Caffeine</b> with size/time bounds) over SoftReference caches.`},
{cv:'b', logReset:true, hl:{main:[1,2,3]}, th:[['main','RUN','']], g:[G('WeakHashMap',['entry','Session@1 → Stats@2'],['key held','weakly'],['value held','strongly'])],
 say:`<b>WeakHashMap</b>: keys are wrapped in WeakReferences. Use it to attach metadata to objects you don't own, so the entry goes away when the object does.`},
{hl:{main:[4,5,6]}, th:[['GC','RUN:ok','']], g:[G('WeakHashMap',['entry','expunged on next access','ok'],['size()','0'])], log:['size() → 0'],
 say:`<code>s = null</code> → the key is only weakly reachable → GC clears it → the map <b>expunges stale entries</b> lazily the next time you call get/put/size.`},
{hl:{main:[8]}, g:[G('WeakHashMap (leak)',['entry','Session@3 → Stats(session=Session@3)'],['key reachable via','map → value → key (strong!)','bad'],['collected?','never','bad'])],
 say:`<b>Trap:</b> if the <b>value</b> strongly references the key, the map itself keeps the key alive forever. Another trap: String literal or boxed small-Integer keys are always reachable (pool/cache), so they never disappear.`},
{th:[], g:[G('Cheat sheet',['strong','normal refs; never collected while reachable'],['soft','cleared under memory pressure; before OOM'],['weak','cleared at next GC; WeakHashMap, canonical maps'],['phantom','get() always null; enqueued after collection → cleanup']), G('Phantom + Cleaner',['replaces','finalize() (deprecated)'],['use','free native memory / file handles after an object dies'],['example','DirectByteBuffer uses a Cleaner','ok'])],
 say:`<b>Phantom references</b> never give the object back (<code>get()</code> is always null). They only tell you "it's been collected" through a queue. <code>java.lang.ref.Cleaner</code> builds on them and is the modern replacement for <code>finalize()</code>, which is slow, unpredictable, and could even resurrect objects.`}
],
keep:[`Reachability = strongest path. Weak → cleared at next GC. Soft → cleared under memory pressure, before OOM.`,`WeakHashMap: weak keys, strong values (value→key = leak).`,`Phantom + Cleaner for post-mortem cleanup; prefer Caffeine over soft-ref caches.`]}, {
  imp: 'extra',
  theory: TH(`Besides normal (strong) references, Java has soft, weak and phantom references that let the GC reclaim an object even while you still point at it.`,
`<p>A normal variable is a <b>strong</b> reference: as long as it exists, the object stays alive. Sometimes you want to <i>remember</i> an object without <i>keeping it alive</i>, for example a cache entry or metadata attached to an object owned by someone else. The <code>java.lang.ref</code> classes wrap an object in a weaker kind of reference that the GC is allowed to break.</p>
<p>Analogy: a strong reference is holding someone's hand; a weak reference is knowing their phone number. If everyone else lets go, they can leave, and the number stops working.</p>`,
[[`Strong`,`Normal reference. Never cleared while reachable.`],[`Soft`,`Cleared when memory is tight, always before OutOfMemoryError.`],[`Weak`,`Cleared at the next GC once no strong or soft references remain.`],[`Phantom`,`Never returns the object; only tells you it has been collected, for cleanup.`],[`WeakHashMap`,`A map whose keys are weak: entries disappear once the key is otherwise unreachable.`]],
[`Wrap the object: <code>new WeakReference&lt;&gt;(obj)</code>.`,`<code>ref.get()</code> returns the object, or null once it has been cleared.`,`Optionally register a ReferenceQueue to be told when a reference is cleared.`,`<code>Cleaner</code> (built on phantom references) runs cleanup code after an object dies.`],
[`Rarely needed directly; use a bounded cache like Caffeine instead of soft-reference caches.`,`WeakHashMap is useful for attaching data to objects whose lifetime you don't control.`,`ThreadLocal uses weak keys internally, which matters for its leak behaviour (4.12).`],
[`A WeakHashMap value that references its own key: the entry can never be cleared.`,`Using soft references as a cache: under pressure many are cleared at once, causing GC churn.`]),
  quiz: [
    [`When does the GC clear a softly-reachable object?`,[`At the next GC cycle, exactly like a weak reference`,`When the SoftReference variable goes out of scope`,`Under memory pressure; always before OutOfMemoryError`,`After a fixed time, regardless of free memory`],2,`Soft references are cleared at the GC's discretion under memory pressure. Weak references are cleared at the next GC that finds them weakly reachable.`,'E'],
    [`A <code>WeakHashMap&lt;Key, Value&gt;</code> never shrinks, even though nothing else uses the keys. Likely bug?`,[`Each value holds a strong reference back to its own key`,`WeakHashMap only clears entries when purge() is called`,`Weak references are only cleared during a full GC`,`Reading the map from several threads pins its entries`],0,`Values are held strongly by the map. If value → key, the key stays strongly reachable and is never cleared.`,'M'],
    [`What's the modern replacement for <code>finalize()</code> to release a native resource once an object is unreachable?`,[`Overriding finalize(), which is still the supported hook in Java 21`,`A SoftReference, so cleanup waits until memory is needed`,`A WeakReference whose get() can revive the object for cleanup`,`java.lang.ref.Cleaner, which runs an action once the object is phantom reachable`],3,`Cleaner uses phantom reachability for post-mortem cleanup. finalize() is deprecated for removal. Still prefer explicit close() with try-with-resources.`,'H'],
    [`Which reference type is cleared at the next GC once nothing stronger points to the object?`,[`Strong`,`Soft`,`Weak`,`Phantom`],2,`Soft waits for memory pressure.`,'E'],
    [`What does <code>weakRef.get()</code> return after the object is collected?`,[`The old object`,`null`,`An exception`,`A new instance`],1,`Always check for null.`,'E'],
    [`Why can a phantom reference's get() never return the object?`,[`It's a known JDK bug kept for compatibility`,`It's post-mortem only: no resurrection allowed`,`Phantom references always start out as null`,`get() is synchronized on the GC thread`],1,`Used with ReferenceQueue / Cleaner.`,'M'],
    [`What does a ReferenceQueue tell you?`,[`Which objects are still strongly reachable`,`That a registered reference has been cleared by the GC`,`How long each GC pause took`,`How much heap is still free`],1,`Lets you clean up associated resources.`,'M'],
    [`Which is a typical use of WeakHashMap?`,[`As the primary store for application data`,`Metadata for objects you don't own, without leaks`,`A thread-safe cache shared by all requests`,`Keeping keys sorted by insertion time`],1,`Entries vanish when keys become unreachable.`,'M'],
  ],
  quizAdv: [
    [`A cache keeps values behind SoftReferences. Running near the heap limit, what typically happens?`,[`The GC clears many at once, causing misses and GC churn`,`The heap stays stable, which is the point of soft refs`,`Soft refs held in static fields are never cleared`,`They're cleared one at a time in LRU order`],0,`Soft-ref caches are unpredictable. Prefer a bounded cache (Caffeine).`,'H'],
    [`ThreadLocal's internal map uses weak keys. Why can it still leak in a pool?`,[`Weak keys are only cleared during a full GC`,`ThreadLocal values are stored in Metaspace`,`It can't leak; weak keys solve the problem`,`Values are strong, and pool threads never die`],3,`A stale entry's value lives until the map happens to purge it, and pool threads live forever. Call remove().`,'H'],
    [`Why is finalize() deprecated for removal?`,[`It runs too often and blocks the GC threads`,`Unpredictable, can resurrect objects, may never run`,`It needs root privileges on the host machine`,`It only works on Linux-based JVMs`],1,`Prefer try-with-resources and Cleaner.`,'H'],
    [`Strings used as WeakHashMap keys are never removed. Why?`,[`Strings can't be wrapped in weak references`,`Literal Strings are interned, so always reachable`,`WeakHashMap skips String keys entirely`,`Strings are too small for the GC to collect`],1,`Use keys whose lifetime you control.`,'H'],
  ],
});
