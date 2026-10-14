/* 4.15 ForkJoinPool and work stealing */
topic('4', { no:'4.15', title:'ForkJoinPool and work stealing', idea:`Divide and conquer the sum of [1..8]. Each worker has a deque; idle workers steal the oldest (biggest) task from the other end.`,
codes:{a:`class SumTask extends RecursiveTask<Long> {
  int lo, hi;                                    // range [lo, hi)
  protected Long compute() {
    if (hi - lo <= 2) return sumDirect(lo, hi);  // small: just do it
    int mid = (lo + hi) / 2;
    SumTask left = new SumTask(lo, mid);
    left.fork();                                 // push to MY deque
    long right = new SumTask(mid, hi).compute(); // do right half myself
    return right + left.join();                  // wait, or help
  }
}
// pool.invoke(new SumTask(0, 8))   array = 1..8`},
steps:[
{hl:{W1:[3]}, th:[['W1','RUN','compute [0,8)'],['W2','WAITING','idle, looking for work']], g:[G('W1 deque  (top=steal end … bottom=owner end)',C('tasks',[['empty','dim']])), G('W2 deque',C('tasks',[['empty','dim']])), G('Results',['—','—'])],
 say:`<code>pool.invoke</code> gives the root task [0,8) to W1. Each worker owns a <b>double-ended queue</b>. The owner pushes and pops at the <b>bottom</b> (LIFO). Thieves take from the <b>top</b> (FIFO).`},
{hl:{W1:[5,6,7]}, th:[['W1','RUN','forked [0,4), computing [4,8)'],['W2','WAITING','']], g:[G('W1 deque  (top=steal end … bottom=owner end)',C('tasks',[['[0,4)','hot']])), G('W2 deque',C('tasks',[['empty','dim']])), G('Results',['—','—'])],
 say:`Too big, so split. <code>fork()</code> pushes the left half [0,4) onto W1's own deque. Then W1 <b>keeps working</b> on the right half itself (line 8) instead of waiting idle.`},
{hl:{W1:[7,8]}, th:[['W1','RUN','forked [4,6), computing [6,8)'],['W2','WAITING','']], g:[G('W1 deque  (top=steal end … bottom=owner end)',C('tasks',['[0,4)',['[4,6)','hot']])), G('W2 deque',C('tasks',[['empty','dim']])), G('Results',['—','—'])],
 say:`[4,8) splits again: fork [4,6) to the bottom, compute [6,8). The deque now has the <b>oldest, biggest</b> task at the top and the newest, smallest at the bottom.`},
{hl:{W1:[4],W2:[3]}, th:[['W1','RUN','[6,8) = 7+8 = 15'],['W2','RUN','STOLE [0,4) from W1\'s top']], g:[G('W1 deque  (top=steal end … bottom=owner end)',C('tasks',['[4,6)'])), G('W2 deque',C('tasks',[['empty','dim']])), G('Results',['[6,8)','15','hot'])], log:['W2 steals [0,4) from the TOP of W1\'s deque'],
 say:`<b>Work stealing.</b> Idle W2 takes from the <b>top</b> of W1's deque and gets [0,4), half of the whole job. Stealing old, big tasks means few steals and little contention, because owner and thief work at opposite ends. Meanwhile W1 computes the leaf [6,8) = 15.`},
{hl:{W1:[9],W2:[7,8]}, th:[['W1','RUN','pop [4,6) from bottom = 5+6 = 11'],['W2','RUN','forked [0,2), computing [2,4)']], g:[G('W1 deque  (top=steal end … bottom=owner end)',C('tasks',[['empty','dim']])), G('W2 deque',C('tasks',[['[0,2)','hot']])), G('Results',['[6,8)','15'],['[4,6)','11','hot'],['[4,8)','26','hot'])],
 say:`W1 reaches <code>left.join()</code> for [4,6). The task is still in its own deque, so W1 just pops it (LIFO: the bottom is still warm in cache) and runs it: 11. [4,8) = 15 + 11 = 26. W2 splits its stolen [0,4).`},
{th:[['W1','RUN','join([0,4)): helps / waits'],['W2','RUN','[2,4)=3+4=7, pop [0,2)=1+2=3']], g:[G('W1 deque  (top=steal end … bottom=owner end)',C('tasks',[['empty','dim']])), G('W2 deque',C('tasks',[['empty','dim']])), G('Results',['[6,8)','15'],['[4,6)','11'],['[4,8)','26'],['[2,4)','7','hot'],['[0,2)','3','hot'],['[0,4)','10','hot'])],
 say:`At the root, W1 calls <code>join</code> on [0,4), which was stolen. Instead of just blocking, a ForkJoin worker tries to <b>help</b> (run other pending tasks) while it waits. W2 finishes: 7 + 3 = 10.`},
{th:[['W1','TERM','root = 26 + 10 = 36'],['W2','WAITING','idle']], g:[G('Results',['[0,8)','36','ok'])], log:['invoke() → 36'],
 say:`Root = 26 + 10 = <b>36</b>. <code>ForkJoinPool.commonPool()</code> runs <b>parallel streams</b> and CompletableFuture's default async methods. The threshold matters: split too fine and the overhead beats the gain. Don't block on I/O inside a ForkJoin task.`}
],
keep:[`fork = push to own deque; compute one half yourself; join the other.`,`Owner LIFO at the bottom, thieves FIFO from the top → steal big, old tasks.`,`commonPool backs parallel streams; keep it CPU-only.`]}, {
  imp: 'extra',
  theory: TH(`ForkJoinPool runs divide-and-conquer tasks on all cores and keeps them busy by letting idle threads steal work from busy ones.`,
`<p>Big problems (sum a huge array, process a tree) can be split in half, and each half split again, until pieces are small enough to do directly. Each worker thread in a <b>ForkJoinPool</b> has its own deque of tasks. It pushes the halves it forks and pops them itself; when a worker runs out, it <b>steals</b> a task from the other end of someone else's deque, typically a big, old one.</p>`,
[[`RecursiveTask / RecursiveAction`,`Fork/join task with / without a result.`],[`fork()`,`Push a subtask to be run asynchronously.`],[`join()`,`Wait for a subtask's result (while helping with other work).`],[`Work stealing`,`Idle threads taking tasks from busy threads' queues.`],[`Common pool`,`A JVM-wide ForkJoinPool used by parallel streams and async defaults.`]],
[`If the task is small enough, compute directly.`,`Otherwise split: fork() the left half, compute() the right half yourself.`,`join() the left half and combine the results.`],
[`Parallel streams use this under the hood.`,`Keep the common pool CPU-only: no blocking I/O.`],
[`Splitting too finely, so overhead dominates.`,`Blocking calls inside parallel streams.`]),
  quiz: [
    [`Why is blocking I/O inside a parallel stream a bad idea?`,[`Parallel streams aren't allowed to do I/O`,`It blocks the shared commonPool for everyone`,`It disables the JIT for the whole pipeline`,`It makes the results come back unordered`],1,`Keep the common pool CPU-bound.`,'E'],
    [`In a RecursiveTask, why compute one half yourself instead of forking both?`,[`Forking both halves is illegal`,`To avoid a stack overflow`,`To make execution deterministic`,`So the thread works instead of waiting`],3,`fork() one half, compute() the other, then join().`,'M'],
    [`How does work stealing pick tasks?`,[`Owners pop newest; thieves take the oldest, biggest tasks`,`Each idle thread picks a random task from anyone`,`All threads share one global FIFO queue`,`Tasks are dealt round-robin to the threads`],0,`Stealing big tasks means fewer steals overall.`,'H'],
    [`What kind of tasks suit ForkJoinPool?`,[`Blocking I/O like file and socket reads`,`Recursive divide-and-conquer CPU work`,`Long single tasks that can't be split`,`Database calls issued in parallel batches`],1,`Split, compute, combine.`,'E'],
    [`RecursiveTask vs RecursiveAction?`,[`RecursiveAction returns a result; RecursiveTask doesn't`,`RecursiveTask returns a result; RecursiveAction doesn't`,`RecursiveTask can fork subtasks; RecursiveAction can't`,`RecursiveAction is for I/O; RecursiveTask for CPU work`],1,`compute() returns V or void.`,'M'],
    [`What is the common pool's default parallelism?`,[`Number of available processors × 2`,`Number of available processors − 1`,`Exactly the number of available processors`,`A fixed 256, regardless of CPU count`],1,`Shared by the whole JVM.`,'M'],
    [`What uses the common ForkJoinPool by default?`,[`Tomcat request threads and Spring @Async methods`,`Parallel streams and CompletableFuture async methods without an executor`,`Spring @Scheduled tasks and JDBC connection pools`,`Every pool created by Executors.newFixedThreadPool`],1,`Don't block it.`,'M'],
    [`Why steal from the opposite end of another worker's deque?`,[`To keep tasks in strict FIFO order across all the workers`,`Older tasks are bigger, so fewer steals are needed and contention with the owner is low`,`So stolen tasks are always the smallest and finish fastest`,`Either end works; the opposite end is just a convention`],1,`Owner works LIFO at its end.`,'H'],
  ],
  quizAdv: [
    [`Why does <code>join()</code> inside a ForkJoinPool avoid the starvation a fixed pool suffers?`,[`Waiting workers run other tasks`,`The pool has unlimited threads`,`join() never blocks at all`,`Tasks there can't depend on others`],0,`Work stealing keeps threads busy.`,'H'],
    [`A RecursiveTask's split threshold is very small. Effect?`,[`Better load balance, so faster`,`Stack overflow, always`,`Results become incorrect`,`Task overhead dominates the work`],3,`Split down to a few thousand elements, then compute sequentially.`,'M'],
    [`What does <code>ForkJoinPool.managedBlock</code> help with?`,[`Cancelling a blocked task after a timeout so others can run`,`Compensating with extra threads when a task must block, avoiding starvation`,`Moving the blocking task onto the caller thread instead`,`Logging which tasks block, so you can tune the pool size`],1,`Used internally by some blocking JDK classes.`,'H'],
    [`Can you run a parallel stream in your own pool?`,[`No: parallel streams always use the common pool, whoever calls them`,`Running it inside your own ForkJoinPool works, but isn't documented`,`Yes, by passing your pool directly to stream.parallel(pool)`,`Yes, by calling Executors.newWorkStealingPool().stream()`],1,`Implementation behaviour; prefer explicit executors.`,'H'],
  ],
});
