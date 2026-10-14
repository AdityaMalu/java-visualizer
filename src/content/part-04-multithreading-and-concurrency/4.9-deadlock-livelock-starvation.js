/* 4.9 Deadlock, livelock, starvation */
topic('4', { no:'4.9', title:'Deadlock, livelock, starvation', idea:`Two transfers in opposite directions each grab one lock and wait forever for the other. Then fix it with lock ordering.`,
nodes:{A:{x:80,y:50,label:'Thread A',kind:'thread'}, acc2:{x:360,y:50,label:'acc2 lock',kind:'lock'}, B:{x:360,y:200,label:'Thread B',kind:'thread'}, acc1:{x:80,y:200,label:'acc1 lock',kind:'lock'}},
codes:{a:`void transfer(Account from, Account to, long amt) {
  synchronized (from) {
    synchronized (to) {
      from.debit(amt);
      to.credit(amt);
    }
  }
}
// A: transfer(acc1, acc2, 100)
// B: transfer(acc2, acc1, 50)`,
b:`void transfer(Account a, Account b, long amt) {
  Account first  = a.id() < b.id() ? a : b;   // global order
  Account second = first == a ? b : a;
  synchronized (first) {
    synchronized (second) {
      a.debit(amt);
      b.credit(amt);
    }
  }
}`},
steps:[
{cv:'a', th:[['A','READY','transfer(acc1 → acc2)'],['B','READY','transfer(acc2 → acc1)']], g:[mon('acc1',null),mon('acc2',null)], d:{type:'graph',e:[]},
 say:`A moves money acc1 → acc2. At the same moment B moves money acc2 → acc1. Each call locks <code>from</code>, then <code>to</code>.`},
{hl:{A:[2]}, th:[['A','RUN','holds acc1'],['B','READY','']], g:[mon('acc1','A'),mon('acc2',null)], d:{type:'graph',e:[['A','acc1','holds','ok']]},
 say:`A locks acc1 (its <code>from</code>).`},
{hl:{B:[2]}, th:[['A','READY','preempted'],['B','RUN','holds acc2']], g:[mon('acc1','A'),mon('acc2','B')], d:{type:'graph',e:[['A','acc1','holds','ok'],['B','acc2','holds','ok']]},
 say:`Context switch. B locks acc2 (its <code>from</code>). Each thread now holds one lock.`},
{hl:{A:[3]}, th:[['A','BLOCKED','wants acc2'],['B','RUN','']], g:[mon('acc1','A'),mon('acc2','B',['A'])], d:{type:'graph',e:[['A','acc1','holds','ok'],['B','acc2','holds','ok'],['A','acc2','wants','bad']]},
 say:`A needs acc2, which B holds → A is BLOCKED. Not a problem yet; B could finish and release.`},
{hl:{B:[3]}, th:[['A','BLOCKED','wants acc2 (held by B)'],['B','BLOCKED','wants acc1 (held by A)']], g:[mon('acc1','A',['B']),mon('acc2','B',['A'])], d:{type:'graph',e:[['A','acc1','holds','ok'],['B','acc2','holds','ok'],['A','acc2','wants','bad'],['B','acc1','wants','bad']]}, log:['✘ DEADLOCK: cycle A → acc2 → B → acc1 → A'],
 say:`B needs acc1, which A holds. Now there's a <b>cycle</b>: each waits for the other, forever. <code>synchronized</code> can't time out or be interrupted, so only a restart fixes it. All four <b>Coffman conditions</b> hold: mutual exclusion, hold-and-wait, no preemption, <b>circular wait</b>. Break any one and deadlock can't happen.`},
{log:['$ jstack <pid>','Found one Java-level deadlock:','"A": waiting to lock monitor 0x..(acc2), held by "B"','"B": waiting to lock monitor 0x..(acc1), held by "A"'],
 say:`In production: take a thread dump (<code>jstack &lt;pid&gt;</code> or <code>jcmd &lt;pid&gt; Thread.print</code>). The JVM detects monitor cycles and prints "Found one Java-level deadlock" with both stacks.`},
{cv:'b', hl:{A:[2,3,4],B:[2,3]}, logReset:true, th:[['A','RUN','first = acc1 → holds acc1'],['B','RUN','first = acc1 too']], g:[mon('acc1','A'),mon('acc2',null)], d:{type:'graph',e:[['A','acc1','holds','ok']]},
 say:`<b>Fix: lock ordering.</b> Always lock the account with the <b>smaller id first</b>, whatever the direction of the transfer. For B, <code>first</code> is also acc1. A locks acc1.`},
{hl:{B:[4]}, th:[['A','RUN','holds acc1'],['B','BLOCKED','waits for acc1, holds NOTHING']], g:[mon('acc1','A',['B']),mon('acc2',null)], d:{type:'graph',e:[['A','acc1','holds','ok'],['B','acc1','wants','']]},
 say:`B blocks on acc1, but it <b>holds no lock</b> while waiting, so it can't be part of a cycle. Circular wait is now impossible.`},
{hl:{A:[5,6,7]}, th:[['A','RUN','holds acc1 + acc2, transferring'],['B','BLOCKED','']], g:[mon('acc1','A',['B']),mon('acc2','A')], d:{type:'graph',e:[['A','acc1','holds','ok'],['A','acc2','holds','ok'],['B','acc1','wants','']]},
 say:`A gets acc2 freely and does the transfer.`},
{hl:{B:[5,6,7]}, th:[['A','TERM','released both'],['B','RUN','holds acc1 + acc2']], g:[mon('acc1','B'),mon('acc2','B')], d:{type:'graph',e:[['B','acc1','holds','ok'],['B','acc2','holds','ok']]}, log:['✔ both transfers complete'],
 say:`A releases, B proceeds. Other fixes: <code>tryLock(timeout)</code> and back off (4.10), or one global lock (simple but slow).`},
{th:[['A','RUN','tryLock fails → backs off → retries'],['B','RUN','tryLock fails → backs off → retries']], d:null, g:[G('Livelock', C('A',['grab','release','grab','release']), C('B',['grab','release','grab','release']), ['progress','none, but threads are busy','bad'], ['fix','random backoff / jitter','ok']), G('Starvation', ['symptom','one thread never gets the lock or CPU'], ['causes','unfair lock, greedy threads, low priority'], ['fix','fair lock, bounded work','ok'])],
 say:`<b>Livelock</b>: threads keep reacting to each other (both back off, both retry at the same moment) and nobody progresses, like two people stepping aside in a corridor. Unlike deadlock they are RUNNING. Add random backoff. <b>Starvation</b>: one thread keeps losing. Use fair locks.`}
],
keep:[`Deadlock needs all 4: mutual exclusion, hold-and-wait, no preemption, circular wait.`,`Practical fix: a global lock order (e.g. by account id), or tryLock with timeout.`,`Detect with a thread dump; livelock = busy but no progress.`]}, {
  imp: 'must',
  theory: TH(`A deadlock is threads waiting on each other forever; livelock is threads busy reacting to each other without progress; starvation is one thread never getting a turn.`,
`<p>Thread 1 holds lock A and waits for B. Thread 2 holds B and waits for A. Neither will ever let go: a <b>deadlock</b>. Like two cars meeting on a one-lane bridge, each waiting for the other to back up.</p>
<p>A deadlock needs four conditions: mutual exclusion, hold-and-wait, no preemption, and <b>circular wait</b>. Break any one and it can't happen. The practical fix is breaking circular wait: always take locks in the same global order.</p>`,
[[`Deadlock`,`A cycle of threads, each holding a lock the next needs.`],[`Livelock`,`Threads keep changing state in response to each other, making no progress.`],[`Starvation`,`A thread never gets the resource because others always win.`],[`Lock ordering`,`Always acquiring multiple locks in a consistent order.`]],
[`Spot code that takes more than one lock.`,`Define an order (e.g. lower account id first) and always follow it.`,`Or use tryLock with a timeout and back off on failure.`,`Diagnose a hang with a thread dump: the JVM reports Java-level deadlocks.`],
[`Databases have the same problem with row locks; they detect it and abort one transaction, so retry.`,`Avoid calling external code (listeners, callbacks) while holding a lock.`],
[`Nested synchronized blocks in different orders in different methods.`,`Adding random sleeps instead of fixing the ordering.`]),
  quiz: [
    [`Thread 1 locks A then B; thread 2 locks B then A. Risk and standard fix?`,[`Race; make the account fields volatile`,`Starvation; switch to fair locks`,`Deadlock; always lock in one global order`,`Livelock; add a short random sleep`],2,`Breaking circular wait removes one of the four deadlock conditions.`,'E'],
    [`How do you confirm a deadlock in a running JVM?`,[`A thread dump: it reports "Found one Java-level deadlock"`,`A heap dump: deadlocked threads' objects stay reachable`,`GC logs: a deadlock stops collections from finishing`,`Restart the service and see if it happens again`],0,`The dump shows which thread holds which lock and waits for which.`,'M'],
    [`You order locks by <code>System.identityHashCode(obj)</code>. What edge case must you handle?`,[`identityHashCode changes when the GC moves objects`,`It isn't thread-safe to call concurrently`,`It's much slower than a single global lock`,`Two objects can share a hash; add a tie-break lock`],3,`Equal hashes give no order, so take a third "tie" lock first in that case.`,'H'],
    [`Which is NOT one of the four deadlock conditions?`,[`Mutual exclusion`,`Hold and wait`,`Circular wait`,`High CPU usage`],3,`The others plus "no preemption".`,'E'],
    [`What is starvation?`,[`All threads blocked waiting on each other forever`,`A thread repeatedly losing out and never getting the resource`,`A thread spinning in a busy loop that burns CPU`,`The JVM running out of heap for new threads`],1,`Fair locks can help.`,'M'],
    [`How does tryLock with a timeout help with deadlocks?`,[`It sorts lock requests so all threads acquire them in order`,`A thread gives up instead of waiting forever, then retries or backs off`,`It makes the lock fair so waiters get it by arrival order`,`It detects the lock cycle and throws a DeadlockException`],1,`Breaks "hold and wait".`,'M'],
    [`A thread dump shows thread A waiting for lock X held by B, and B waiting for lock Y held by A. That is?`,[`Livelock`,`Deadlock`,`Starvation`,`A race`],1,`A cycle of waits.`,'E'],
    [`Does a deadlock use CPU?`,[`Yes: they spin at 100% CPU retrying`,`No: deadlocked threads are blocked, idle`,`Yes, but only one core is kept busy`,`Only while the GC scans their stacks`],1,`Hangs with low CPU often mean deadlock or waiting.`,'M'],
  ],
  quizAdv: [
    [`Threads keep retrying and backing off in sync, but nothing completes. That's?`,[`Livelock`,`Deadlock`,`Starvation`,`A data race`],0,`Busy, but no progress. Randomise the backoff.`,'M'],
    [`Two DB transactions update the same rows in opposite order. What does the database do?`,[`Both wait forever`,`Both commit anyway`,`The table gets locked`,`One is aborted; retry`],3,`Order updates consistently and retry on deadlock errors.`,'H'],
    [`Calling an external callback while holding a lock risks?`,[`A memory leak, since the lock pins the callback object`,`Deadlock: the callback may take other locks in a different order`,`Nothing, because synchronized locks are reentrant`,`Lost updates, since the lock is released during the call`],1,`"Open calls": call out without holding locks.`,'H'],
    [`Can deadlocks happen with only one lock?`,[`Never: a deadlock needs at least two locks`,`Yes, e.g. a non-reentrant lock taken twice by one thread`,`Only with synchronized, since it isn't reentrant`,`Only in databases that use row-level locking`],1,`Resource deadlocks aren't only about two locks.`,'H'],
  ],
});
