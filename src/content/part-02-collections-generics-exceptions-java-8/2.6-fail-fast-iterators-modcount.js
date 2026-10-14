/* 2.6 Fail-fast iterators (modCount) */
topic('2', { no:'2.6', title:'Fail-fast iterators (modCount)', idea:`Trace modCount and expectedModCount through a for-each removal, plus the strange case where removing the second-to-last element doesn't throw.`,
actors:'Iterator', stateTitle:'ArrayList internals',
codes:{a:`List<String> list = new ArrayList<>(List.of("a", "b", "c"));
for (String s : list) {                 // Iterator: expectedModCount = modCount
  if (s.equals("a")) list.remove(s);    // modCount++
}                                       // next() -> CME`,
b:`List<String> list = new ArrayList<>(List.of("a", "b", "c"));
for (String s : list) {
  if (s.equals("b")) list.remove(s);    // remove the 2nd-to-last
}                                       // NO exception... and "c" is skipped`,
c:`list.removeIf(s -> s.startsWith("x"));          // ✔ one pass, safe
Iterator<String> it = list.iterator();
while (it.hasNext())
  if (bad(it.next())) it.remove();              // ✔ updates expectedModCount
for (String s : new CopyOnWriteArrayList<>(list)) list.remove(s);  // snapshot`},
steps:[
{cv:'a', hl:{it:[1,2]}, th:[['it','created:info','cursor = 0']], g:[G('ArrayList',C('elements',['a','b','c']),['size','3'],['modCount','0']), G('Iterator',['cursor','0'],['expectedModCount','0'])],
 say:`A for-each loop over a List compiles into <code>Iterator it = list.iterator(); while (it.hasNext()) { s = it.next(); … }</code>. The iterator <b>remembers</b> the list's <code>modCount</code>, which counts structural changes (add/remove, not set).`},
{hl:{it:[2]}, th:[['it','next() → "a":ok','cursor = 1']], g:[G('ArrayList',C('elements',[['a','hot'],'b','c']),['size','3'],['modCount','0']), G('Iterator',['cursor','1','hot'],['expectedModCount','0'])],
 say:`<code>next()</code> first checks <code>modCount == expectedModCount</code>, then returns element 0 and moves the cursor to 1.`},
{hl:{it:[3]}, th:[['it','list.remove("a"):warn','behind the iterator\'s back']], g:[G('ArrayList',C('elements',['b','c']),['size','2','hot'],['modCount','1','hot']), G('Iterator',['cursor','1'],['expectedModCount','0','bad'])],
 say:`Calling <code>list.remove</code> directly shifts the elements and increments <code>modCount</code>. The iterator doesn't know: its cursor (1) now points at "c", so it would skip "b".`},
{hl:{it:[2,4]}, th:[['it','next() → CME:bad','1 ≠ 0']], g:[G('ArrayList',C('elements',['b','c']),['size','2'],['modCount','1','bad']), G('Iterator',['hasNext()','cursor 1 ≠ size 2 → true'],['next() check','modCount 1 ≠ expected 0','bad'])], log:['✘ java.util.ConcurrentModificationException'],
 say:`<code>hasNext()</code> says true, and <code>next()</code> sees the mismatch → <b>ConcurrentModificationException</b>. The name is misleading: this is a <b>single-threaded</b> bug. "Fail-fast" means "fail at once instead of silently skipping elements".`},
{cv:'b', logReset:true, hl:{it:[2,3]}, th:[['it','next() a, next() b:info','cursor = 2']], g:[G('ArrayList',C('elements',['a','c']),['size','2','hot'],['modCount','1','hot']), G('Iterator',['cursor','2'],['expectedModCount','0','bad'])],
 say:`<b>Interview twist.</b> This time remove "b", the <b>second-to-last</b> element. After two <code>next()</code> calls the cursor is 2. Removing b makes size 2.`},
{hl:{it:[4]}, th:[['it','hasNext() → false:bad','loop ends silently']], g:[G('Iterator',['hasNext()','cursor 2 == size 2 → false','bad'],['"c" visited?','never','bad'],['exception?','none','bad'])], log:['loop finished: no CME, but "c" was never processed'],
 say:`<code>hasNext()</code> only compares cursor and size: 2 == 2 → false, so the loop exits <b>before</b> <code>next()</code> could check modCount. No exception, and "c" was silently skipped. Fail-fast is <b>best-effort</b>, not a guarantee. Never depend on CME for correctness.`},
{cv:'c', logReset:true, hl:{it:[1,2,3,4]}, th:[['it','it.remove():ok','expectedModCount = modCount']], g:[G('Safe ways',['removeIf(pred)','single pass, compacts the array: O(n)','ok'],['it.remove()','removes last returned & re-syncs counts','ok'],['collect then removeAll','fine for small lists'],['index loop backwards','for (i = size-1; i >= 0; i--)'])],
 say:`Correct patterns. <code>removeIf</code> is the cleanest and O(n) overall, whereas repeated <code>remove(i)</code> in a loop is O(n²) because of shifting.`},
{hl:{it:[5]}, th:[['it','snapshot:ok','']], g:[G('Fail-safe / weakly consistent',['CopyOnWriteArrayList','iterates a snapshot array: never CME, never sees new changes'],['ConcurrentHashMap','weakly consistent: no CME, may or may not reflect updates'],['cost','COW copies on every write','bad'])],
 say:`Concurrent collections don't throw CME. COW iterators walk an immutable snapshot, and CHM iterators traverse the live table tolerantly (4.16). They're the choice when other threads modify the collection while you iterate.`}
],
keep:[`for-each = Iterator; next() checks modCount == expectedModCount.`,`Removing the second-to-last element skips the last one with no CME. Fail-fast is best-effort.`,`Use removeIf / it.remove(); concurrent collections are weakly consistent.`]}, {
  imp: 'must',
  theory: TH(`Most collection iterators detect if the collection is changed behind their back and throw ConcurrentModificationException, to avoid silently returning wrong results.`,
`<p>A for-each loop uses an <b>Iterator</b> under the hood. If you add or remove elements from the list directly while iterating, the iterator's position no longer matches the data. To catch this bug early, collections keep a counter, <code>modCount</code>, that increases on every structural change. The iterator remembers the value it started with and checks it on each <code>next()</code>. A mismatch throws <b>ConcurrentModificationException</b> (despite the name, it usually happens on a single thread).</p>`,
[[`Iterator`,`Object that walks a collection: hasNext(), next(), remove().`],[`modCount`,`Counter of structural modifications.`],[`Fail-fast`,`Throw as soon as a concurrent change is detected (best-effort, not guaranteed).`],[`Weakly consistent`,`Concurrent collections' iterators: never throw, may or may not show recent changes.`]],
[`The for-each loop creates an iterator with expectedModCount = modCount.`,`<code>list.remove(x)</code> inside the loop increments modCount.`,`The next <code>next()</code> sees the mismatch and throws.`,`<code>iterator.remove()</code> updates both counters, so it's safe.`],
[`Remove with <code>list.removeIf(predicate)</code> or an explicit <code>Iterator.remove()</code>.`,`Or collect results into a new list instead of modifying while iterating.`],
[`Catching ConcurrentModificationException instead of fixing the loop.`,`Assuming fail-fast always triggers; removing the second-to-last element skips the last one silently.`]),
  quiz: [
    [`<pre>for (String s : list) if (s.isBlank()) list.remove(s);</pre>Usually throws?`,[`IllegalStateException from the iterator`,`IndexOutOfBoundsException`,`Nothing: the loop skips the removed element`,`ConcurrentModificationException`],3,`The for-each iterator compares modCount with its expected count on next(). Removing through the list changes modCount.`,'E'],
    [`Correct way to remove blank strings from an ArrayList?`,[`list.removeIf(String::isBlank)`,`A forward index loop calling list.remove(i)`,`Catch ConcurrentModificationException and continue`,`Wrap the list in Collections.synchronizedList`],0,`removeIf (or Iterator.remove) keeps the iterator consistent. A forward index loop skips the element after each removal.`,'M'],
    [`List [a, b, c]. Inside a for-each you remove "b" (second-to-last). What happens?`,[`ConcurrentModificationException on the next iteration`,`No exception, but c is never visited`,`c is visited twice`,`No exception, and c is visited normally`],1,`After the removal size is 2 and the cursor is 2, so hasNext() is false and the loop ends before next() can check modCount. Fail-fast is best-effort.`,'H'],
    [`What is modCount?`,[`The list's current number of elements`,`A count of structural changes`,`The number of open iterators`,`The capacity of the backing array`],1,`Used for fail-fast behaviour.`,'E'],
    [`Does <code>list.set(i, x)</code> during a for-each loop throw CME?`,[`Yes, any change during iteration throws`,`No: set isn't a structural modification`,`Only for LinkedList, not ArrayList`,`Only when setting the last element`],1,`Structural = size changes.`,'M'],
    [`Are fail-fast iterators guaranteed to detect all concurrent modifications?`,[`Yes`,`No: it's best-effort`,`Only single-threaded`,`Only on ArrayList`],1,`Don't rely on CME for correctness.`,'M'],
    [`How do you safely remove while iterating with an explicit iterator?`,[`list.remove(x)`,`it.remove()`,`list.clear()`,`it.next() twice`],1,`Iterator.remove keeps counts in sync.`,'E'],
    [`Iterating a ConcurrentHashMap while another thread adds keys?`,[`It throws ConcurrentModificationException`,`No CME: weakly consistent iteration`,`Iteration blocks until the writer finishes`,`It always returns duplicate keys`],1,`Concurrent collections are fail-safe.`,'M'],
  ],
  quizAdv: [
    [`One thread iterates a CopyOnWriteArrayList while another adds. What happens?`,[`ConcurrentModificationException at once`,`The iterator also sees the new element`,`No CME: it walks the old snapshot`,`The add blocks until iteration ends`],2,`Writes copy the array; iterators keep the old one.`,'M'],
    [`<code>arrayList.forEach(x -> arrayList.add(x));</code>?`,[`Doubles the list`,`ConcurrentModificationException`,`Infinite loop`,`UnsupportedOperationException`],1,`ArrayList.forEach checks modCount and throws CME.`,'H'],
    [`A backwards index loop removing elements from an ArrayList: is it safe?`,[`No: it throws ConcurrentModificationException`,`Yes: removing at i doesn't shift indexes you haven't visited`,`Only for LinkedList, not ArrayList`,`Only if you call removeIf instead`],1,`Forward loops skip elements; backward loops don't.`,'H'],
    [`<code>map.keySet().removeIf(k -&gt; k.startsWith("tmp"))</code> on a HashMap?`,[`It throws ConcurrentModificationException`,`Removes matching entries from the map safely`,`It removes the keys but leaves the values`,`It doesn't compile on a keySet view`],1,`keySet is a view backed by the map.`,'H'],
  ],
});
