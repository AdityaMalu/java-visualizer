/* 2.2 HashMap internals */
topic('2', { no:'2.2', title:'HashMap internals', idea:`Real hash arithmetic, step by step: spread the hash, mask to a bucket, collide ("Aa" and "BB" share a hash), update, look up, treeify, and resize-split.`,
actors:'Operation', stateTitle:'table[] (n = 16)',
codes:{a:`Map<String, Integer> m = new HashMap<>();   // table allocated lazily
m.put("Aa", 1);
m.put("BB", 2);          // "Aa".hashCode() == "BB".hashCode() == 2112
m.put("Pune", 7);
m.put("Pune", 8);        // same key: replace value
m.get("BB");
// ... more puts: size 13 > 16 * 0.75 = 12 -> resize to 32

static int hash(Object key) {               // inside HashMap
  int h;
  return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
// bucket index = hash & (n - 1)`},
steps:[
{hl:{op:[1]}, th:[['op','new HashMap:info','no table yet']], g:[G('HashMap fields',['table','null (allocated on first put)'],['size','0'],['threshold','16 × 0.75 = 12 after first put'],['load factor','0.75'])],
 say:`A new HashMap doesn't allocate the array until the first <code>put</code>. Then it creates <code>Node[16]</code>. The capacity is <b>always a power of 2</b>, which makes <code>hash &amp; (n-1)</code> equal to <code>hash % n</code>, but faster.`},
{hl:{op:[2,9,10,11,13]}, th:[['op','put("Aa", 1):info','compute bucket']], g:[G('hash("Aa")',['hashCode','\'A\'(65)·31 + \'a\'(97) = 2112'],['h >>> 16','0'],['spread = h ^ (h>>>16)','2112'],['index = 2112 & 15','0','hot']), G('table[] (n = 16)',C('[0]',[['Aa=1','hot']]),C('[10]',[['null','dim']]),['size','1'])],
 say:`<b>Step 1</b>: <code>hashCode()</code>. <b>Step 2</b>: XOR the high 16 bits into the low 16 bits, because the mask only looks at the low bits, and without spreading, keys that differ only in their high bits would all collide. <b>Step 3</b>: <code>index = hash &amp; (n-1)</code> = bucket 0. Empty bucket, so store a new <code>Node(hash, key, value, next)</code>.`},
{hl:{op:[3]}, th:[['op','put("BB", 2):info','collision!']], g:[G('hash("BB")',['hashCode','66·31 + 66 = 2112 (same!)','bad'],['index','0','hot']), G('table[] (n = 16)',C('[0]',['Aa=1',['BB=2','hot']]),C('[10]',[['null','dim']]),['size','2'])],
 say:`"BB" has <b>exactly the same hashCode</b> as "Aa". Bucket 0 is occupied, so HashMap walks the chain: same hash? yes. Same key (<code>==</code> or <code>equals</code>)? no. So it appends at the <b>tail</b> (Java 8+). Two keys, one bucket: a <b>collision</b>.`},
{hl:{op:[4]}, th:[['op','put("Pune", 7):info','']], g:[G('hash("Pune")',['hashCode','2499228  (…0001 1100 in low bits)'],['h >>> 16','38  (…0010 0110)'],['spread (XOR)','2499258  (…0011 1010)'],['index = spread & 15','10  (1010)','hot'],['without spreading','2499228 & 15 = 12']), G('table[] (n = 16)',C('[0]',['Aa=1','BB=2']),C('[10]',[['Pune=7','hot']]),['size','3'])],
 say:`A realistic key. The spread changes the low bits, so the bucket is 10 rather than 12. With a good <code>hashCode</code>, entries spread evenly and each bucket holds about 0–1 nodes, giving O(1) on average.`},
{hl:{op:[5]}, th:[['op','put("Pune", 8):info','update']], g:[G('table[] (n = 16)',C('[0]',['Aa=1','BB=2']),C('[10]',[['Pune=8','hot']]),['size','3 (unchanged)'],['put returned','7 (old value)'])],
 say:`Same bucket, the hash matches and <code>equals</code> matches, so the <b>value is replaced</b> and <code>put</code> returns the old value (7). No new node. The key object kept is the original one.`},
{hl:{op:[6]}, th:[['op','get("BB"):info','walk bucket 0']], g:[G('lookup bucket 0',C('node 1',[['Aa: hash ==, equals ✘','bad']]),C('node 2',[['BB: hash ==, equals ✔','ok']]),['result','2','ok']), G('compare order',['1. hash == hash','cheap int compare'],['2. key == k','same reference?'],['3. key.equals(k)','only if needed'])],
 say:`<code>get</code> recomputes the hash, goes to bucket 0, and walks the chain. For each node: compare the stored <b>hash</b> first (cheap), then reference <code>==</code>, then <code>equals</code>. This is why <b>hashCode finds the bucket and equals finds the key</b>.`},
{th:[['op','8 keys in one bucket:bad','e.g. a hash-flooding attack']], g:[G('bucket 0 (n ≥ 64)',['chain length','8 → TREEIFY_THRESHOLD','hot'],['converted to','red-black TreeNode bin','ok'],['lookup','O(n) → O(log n)','ok']), G('rules',['table < 64 (MIN_TREEIFY_CAPACITY)','resize instead of treeify'],['shrinks to ≤ 6 nodes','untreeify back to list'],['tree order','by hash, then compareTo if Comparable, then tie-break'])],
 say:`If one bucket's chain reaches <b>8</b> and the table has at least <b>64</b> slots, the chain becomes a <b>red-black tree</b>. Worst case drops from O(n) to O(log n). This defends against <b>hash flooding</b>: an attacker can generate thousands of Strings with one hash ("Aa", "BB", "AaAa", "AaBB"…). Keys that implement <code>Comparable</code> make the tree much more effective.`},
{hl:{op:[7]}, th:[['op','13th put:warn','size > threshold → resize']], g:[G('resize 16 → 32: each node checks (hash & 16)',['Aa: 2112 & 16 = 0','stays at [0]','ok'],['BB: 2112 & 16 = 0','stays at [0]','ok'],['Pune: 2499258 & 16 = 16','moves to [10 + 16] = [26]','hot']), G('table[] (n = 32)',C('[0]',['Aa=1','BB=2']),C('[26]',[['Pune=8','hot']]),['new threshold','24'])],
 say:`<b>Resize</b> doubles the table. No rehashing is needed: since n doubles, exactly <b>one more bit</b> of the hash joins the index. If <code>hash &amp; oldCap</code> is 0 the node stays at <b>i</b>, otherwise it moves to <b>i + oldCap</b>. Each chain splits into a "lo" and a "hi" list, keeping relative order. A resize is O(n), so pre-size big maps: <code>HashMap.newHashMap(expected)</code> (Java 19+) or <code>new HashMap&lt;&gt;((int)(expected / 0.75f) + 1)</code>.`},
{th:[['op','facts:info','']], g:[G('Gotchas',['null key','allowed once, hash 0 → bucket 0'],['iteration order','unspecified; changes after resize','bad'],['thread-safety','none; concurrent put can lose entries','bad'],['Java 7','head insertion → resize could create a cycle → infinite loop','bad'],['Java 8','tail insertion + trees','ok']), G('Complexity',['get/put average','O(1)'],['worst (Java 8)','O(log n)'],['worst (Java 7)','O(n)'])],
 say:`<b>Say it:</b> "An array of buckets. index = spread(hashCode) &amp; (n−1). Collisions chain at the tail and turn into a red-black tree past 8 entries (once the table is ≥ 64). It resizes ×2 when size exceeds 0.75·n, and each node either stays or moves by oldCap. hashCode finds the bucket, equals finds the key. Not thread-safe: use ConcurrentHashMap."`}
],
keep:[`index = (h ^ h>>>16) & (n−1); n is a power of 2.`,`Collision → tail of list → tree at 8 (table ≥ 64), back to list at 6.`,`Resize at size > 0.75n: node stays at i or moves to i+oldCap. Pre-size big maps.`]}, {
  imp: 'must',
  theory: TH(`A HashMap turns each key into a number (its hash), uses that number to pick a bucket in an array, and so finds values in about constant time.`,
`<p>Looking for a name in an unsorted list means checking every entry. A <b>hash table</b> avoids that. It calls <code>key.hashCode()</code> to get an int, squeezes it into an array index, and stores the entry in that <b>bucket</b>. To find the key later it computes the same index and looks only there. Like a library where a book's title tells you exactly which shelf it's on.</p>
<p>Two different keys can land in the same bucket (a <b>collision</b>), so each bucket holds a small linked list, which becomes a tree if it grows large. When the map gets too full, it doubles its array (<b>resize</b>) and redistributes entries.</p>`,
[[`hashCode()`,`An int summarising the key. Equal keys must return equal hash codes.`],[`Bucket`,`One slot of the internal array.`],[`Collision`,`Different keys mapping to the same bucket.`],[`Load factor`,`How full the map may get before resizing (0.75 by default).`],[`Treeify`,`Turning a long bucket list (8+) into a red-black tree.`]],
[`<code>put(k, v)</code>: compute hash, spread its bits, index = hash & (capacity − 1).`,`Empty bucket → store the entry. Otherwise walk the bucket comparing with <code>equals</code>; replace the value if the key exists, else append.`,`If size exceeds capacity × 0.75, double the array and move entries.`,`<code>get(k)</code>: same index, then equals to find the exact entry.`],
[`Keys must have correct, consistent <code>equals</code> and <code>hashCode</code> (2.3). Records and Strings do.`,`Pre-size big maps (<code>HashMap.newHashMap(n)</code>) to avoid repeated resizes.`,`HashMap is not thread-safe; use ConcurrentHashMap for shared maps.`],
[`Mutable keys: changing a key after inserting it loses the entry.`,`Relying on iteration order; HashMap has none.`]),
  quiz: [
    [`You'll insert 1,000,000 entries. Why pre-size, e.g. <code>HashMap.newHashMap(1_000_000)</code>?`,[`It makes get() O(1) instead of O(log n) on big maps`,`It avoids repeated resizes, each of which rehashes all entries`,`It prevents hash collisions between similar keys`,`A HashMap can't grow past its initial capacity later`],1,`From 16 buckets the table doubles about 17 times, moving every node each time. Pre-sizing skips that.`,'E'],
    [`A table of 16 buckets. Which bucket for a spread hash of 165 (0b1010_0101)?`,[`10, taken from the high bits of the hash`,`165 % 17, since tables use a prime size`,`15, the last bucket, because 165 ≥ 16`,`5, because index = hash & (n − 1)`],3,`n is a power of two, so n − 1 is a bit mask: 165 & 15 = 5.`,'M'],
    [`When does a bucket's linked list become a red-black tree?`,[`At 8 nodes in a bucket, if the table has ≥ 64 buckets; otherwise it resizes`,`At 8 nodes in any bucket, whatever the current table size is`,`When the overall load factor passes 0.75 and the table is full`,`At 16 nodes in one bucket, matching the default table capacity`],0,`TREEIFY_THRESHOLD = 8 and MIN_TREEIFY_CAPACITY = 64. Trees turn back into lists at 6.`,'H'],
    [`What is HashMap's default initial capacity?`,[`10`,`16`,`32`,`100`],1,`It doubles on resize.`,'E'],
    [`What is the default load factor?`,[`0.5`,`0.75`,`1.0`,`2.0`],1,`Resize when size > capacity × 0.75.`,'E'],
    [`How does HashMap find the right entry within a bucket?`,[`By comparing hashCode values only`,`By comparing keys with equals`,`By the order the entries were inserted`,`By reference equality (==) only`],1,`hashCode picks the bucket, equals picks the entry.`,'M'],
    [`Can a HashMap have a null key?`,[`No: null keys throw NullPointerException`,`Yes, one, stored in bucket 0`,`Yes, any number of them, all stored together`,`Only in Java 8 and later versions`],1,`ConcurrentHashMap and Hashtable don't allow null keys.`,'M'],
    [`What is a hash collision?`,[`Two equal keys inserted twice`,`Two different keys landing in the same bucket`,`The table becoming completely full`,`Inserting a null key into the map`],1,`Collisions are normal; equals resolves them.`,'E'],
  ],
  quizAdv: [
    [`Why does HashMap mix the high bits in with <code>h ^ (h &gt;&gt;&gt; 16)</code>?`,[`To make every resulting hash positive`,`To defend against hash-flooding attacks`,`To give null keys a stable hash`,`So high-bit differences reach the index`],3,`Hashes that differ only in high bits would otherwise share a bucket in small tables.`,'H'],
    [`The table resizes from 16 to 32. Where does a node from bucket 5 go?`,[`Any bucket: everything is fully rehashed`,`Bucket 5 or 21, depending on one hash bit`,`Always bucket 10`,`It always stays in bucket 5`],1,`Each node stays at i or moves to i + oldCap, so lists split cheaply.`,'H'],
    [`Why is HashMap's capacity always a power of two?`,[`Tradition carried over from Hashtable`,`So the index is a cheap bit mask: hash &amp; (n − 1)`,`Power-of-two tables use less memory`,`It makes the map safe for many threads`],1,`That's also why the hash's high bits are spread down.`,'H'],
    [`Two threads put into a plain HashMap at the same time. What can go wrong?`,[`Nothing: HashMap synchronizes puts internally`,`Lost entries or corrupted buckets`,`It throws ConcurrentModificationException each time`,`Only throughput suffers; the data stays correct`],1,`Use ConcurrentHashMap.`,'H'],
  ],
});
