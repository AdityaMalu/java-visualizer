/* 11.5 Graphs and trees: BFS and DFS */
topic('11', { no:'11.5', title:'Graphs and trees: BFS and DFS', imp:'must', idea:`Explore a graph level by level with a queue (BFS) to find the fewest hops, or go deep first with recursion (DFS). The same two traversals cover most tree and graph problems.`,
actors:'Traversal', stateTitle:'Queue / visited', dgTitle:'Graph',
vb:'0 0 540 220',
nodes:{A:{x:70,y:110,label:'A',w:50,h:40,kind:'circle'}, B:{x:190,y:50,label:'B',w:50,h:40,kind:'circle'}, C:{x:190,y:170,label:'C',w:50,h:40,kind:'circle'}, D:{x:320,y:50,label:'D',w:50,h:40,kind:'circle'}, E:{x:320,y:170,label:'E',w:50,h:40,kind:'circle'}, F:{x:460,y:170,label:'F',w:50,h:40,kind:'circle'}},
edges:[['A','B','','line'],['A','C','','line'],['B','D','','line'],['C','D','','line'],['C','E','','line'],['E','F','','line']],
codes:{a:`Map<String, List<String>> graph = Map.of(
  "A", List.of("B", "C"), "B", List.of("A", "D"), "C", List.of("A", "D", "E"),
  "D", List.of("B", "C"), "E", List.of("C", "F"), "F", List.of("E"));

int shortestHops(String from, String to) {          // BFS: level by level
  Deque<String> queue = new ArrayDeque<>(List.of(from));
  Map<String, Integer> dist = new HashMap<>(Map.of(from, 0));
  while (!queue.isEmpty()) {
    String cur = queue.poll();
    if (cur.equals(to)) return dist.get(cur);
    for (String next : graph.get(cur))
      if (!dist.containsKey(next)) { dist.put(next, dist.get(cur) + 1); queue.add(next); }
  }
  return -1;
}

void dfs(String cur, Set<String> visited) {         // DFS: go deep first
  if (!visited.add(cur)) return;
  for (String next : graph.get(cur)) dfs(next, visited);
}`},
steps:[
{hl:{bfs:[1,2,3]}, th:[], d:{type:'graph',on:[]}, g:[G('Adjacency list',['A','B, C'],['B','A, D'],['C','A, D, E'],['D','B, C'],['E','C, F'],['F','E'])],
 say:`A <b>graph</b> is nodes connected by edges: cities and roads, users and friendships, services and dependencies. In code it's usually an <b>adjacency list</b>: a map from each node to its neighbours. A tree is a graph with no cycles and one root.`},
{hl:{bfs:[5,6,7]}, th:[['bfs','RUN','start at A']], d:{type:'graph',on:['A']}, g:[G('BFS',C('queue',[['A','hot']]),['dist','A = 0'])],
 say:`<b>Breadth-first search</b> explores in rings: first the start, then everything 1 hop away, then 2 hops, and so on. A <b>queue</b> (FIFO) enforces that order. Goal: the fewest hops from A to F.`},
{hl:{bfs:[9,11,12]}, th:[['bfs','RUN','visit A']], d:{type:'graph',on:['B','C'],ok:['A'],e:[['A','B','1','hot line'],['A','C','1','hot line']]}, g:[G('BFS',C('queue',[['B','hot'],['C','hot']]),['dist','A 0 · B 1 · C 1'])],
 say:`Take A from the queue and add its unvisited neighbours B and C at distance 1. Recording the distance (or a visited set) when a node is <b>added</b> stops it from being queued twice, which matters in graphs with cycles.`},
{hl:{bfs:[9,11,12]}, th:[['bfs','RUN','visit B, then C']], d:{type:'graph',on:['D','E'],ok:['A','B','C'],e:[['B','D','2','hot line'],['C','E','2','hot line']]}, g:[G('BFS',C('queue',[['D','hot'],['E','hot']]),['dist','… D 2 · E 2'],['C → D','already seen: skipped'])],
 say:`B adds D (distance 2). C's neighbours are A (seen), D (already queued) and E (new, distance 2). The whole "2 hops away" ring is now queued before anything at 3 hops.`},
{hl:{bfs:[10]}, th:[['bfs','TERM:ok','F found at distance 3']], d:{type:'graph',ok:['A','C','E','F'],e:[['A','C','','ok line'],['C','E','','ok line'],['E','F','3','ok line']]}, g:[G('BFS',['dist','… F 3'],['shortest path','A → C → E → F','ok'])], log:['shortestHops(A, F) → 3'],
 say:`D adds nothing new, E adds F at distance 3, and when F comes off the queue we're done: <b>3 hops</b>. Because BFS expands in rings, the first time it reaches a node is via a shortest path (in unweighted graphs). O(V + E) time.`},
{hl:{dfs:[17,18,19]}, th:[['dfs','RUN','recursion']], d:{type:'graph',ok:['A','B','D','C','E','F'],e:[['A','B','1','hot line'],['B','D','2','hot line'],['D','C','3','hot line'],['C','E','4','hot line'],['E','F','5','hot line']]}, g:[G('DFS from A',C('visit order',[['A'],['B'],['D'],['C'],['E'],['F']]),['structure','call stack (or an explicit Deque as a stack)'])],
 say:`<b>Depth-first search</b> follows one path as deep as possible before backtracking: A → B → D → C → E → F. It's naturally recursive (the call stack remembers where to return). Use it for "is there a path?", connected components, cycle detection, topological sort, and exploring all possibilities (backtracking).`},
{th:[], d:null, g:[G('Pick one',['fewest steps / nearest / level order','BFS (queue)','ok'],['explore everything / paths / cycles / ordering','DFS (recursion or stack)','ok'],['weighted shortest path','Dijkstra (PriorityQueue)']), G('Trees',['level-order traversal','BFS'],['pre / in / post-order','DFS'],['very deep trees','iterative DFS to avoid StackOverflowError'])],
 say:`On trees: BFS gives level-order traversal; DFS gives pre-, in- and post-order (in-order on a binary search tree visits values sorted). Both are O(V + E). Java recursion has no tail-call optimisation, so for very deep structures use an explicit <code>ArrayDeque</code> as a stack.`}
],
keep:[`Graph = adjacency list Map&lt;Node, List&lt;Node&gt;&gt;; mark visited to handle cycles.`,`BFS: queue, level by level → shortest path in unweighted graphs; DFS: recursion/stack → paths, cycles, components, backtracking.`,`Both O(V + E); weighted shortest path → Dijkstra with a PriorityQueue.`]}, {
  imp: 'good',
  theory: TH(`Graphs are nodes connected by edges; breadth-first search explores them level by level, depth-first search follows one path as far as possible before backtracking.`,
`<p>Many problems are secretly graphs: friends of friends, routes between cities, dependencies between modules, cells in a maze. Represent them as an <b>adjacency list</b> (each node → its neighbours) and explore with one of two traversals.</p>
<p><b>BFS</b> uses a queue and visits nodes in order of distance from the start, so it finds the shortest path in an unweighted graph. <b>DFS</b> uses recursion or a stack and dives deep, which suits "is there a path", connected components, cycle detection, topological ordering and backtracking. Trees are graphs without cycles, and their classic traversals are BFS (level order) and DFS (pre/in/post-order).</p>`,
[[`Node / edge`,`A vertex / a connection between two vertices.`],[`Adjacency list`,`Map from node to its neighbours.`],[`Visited set`,`Prevents revisiting nodes (and infinite loops on cycles).`],[`BFS / DFS`,`Queue-based level order / stack- or recursion-based depth first.`],[`O(V + E)`,`Each vertex and edge handled once.`]],
[`Build the adjacency list.`,`Pick BFS (shortest hops, levels) or DFS (explore, paths, cycles).`,`Track visited nodes.`,`Process each node's neighbours; stop early when the goal is found.`],
[`Dependency resolution and build ordering use DFS/topological sort.`,`Recommendation "people you may know" uses BFS by distance.`,`Weighted routes need Dijkstra (a priority queue).`],
[`Forgetting a visited set on graphs with cycles.`,`Deep recursion causing StackOverflowError.`,`Using DFS when the shortest path is required.`]),
  quiz: [
    [`Which traversal finds the fewest hops between two nodes in an unweighted graph?`,[`DFS`,`BFS`,`In-order traversal`,`Binary search`],1,`BFS reaches nodes in order of distance.`,'E'],
    [`What data structure drives BFS?`,[`A queue (FIFO)`,`A stack (LIFO)`,`A priority queue`,`A TreeMap`],0,`DFS uses a stack or recursion; Dijkstra a priority queue.`,'M'],
    [`DFS on a graph with cycles, without a visited set?`,[`It's slower but finishes`,`It finds shortest paths`,`It can loop forever`,`It throws ConcurrentModificationException`],2,`Mark nodes visited when you first reach them.`,'H'],
    [`BFS uses which structure?`,[`Stack`,`Queue`,`Heap`,`Hash table only`],1,`FIFO gives level order.`,'E'],
    [`DFS is naturally written with?`,[`A queue (FIFO)`,`Recursion (or an explicit stack)`,`A priority queue`,`A sorted list`],1,`Go deep, backtrack.`,'E'],
    [`Why keep a visited set?`,[`To record the order nodes are visited in for output`,`To avoid processing nodes twice and looping forever on cycles`,`To make neighbour lookups O(1) instead of O(n)`,`To free memory by dropping finished nodes early`],1,`Trees don't need it (no cycles).`,'E'],
    [`Time complexity of BFS/DFS on a graph?`,[`O(V × E)`,`O(V + E)`,`O(log V)`,`O(V²) always`],1,`Each vertex and edge once.`,'M'],
    [`Level-order traversal of a binary tree uses?`,[`DFS`,`BFS with a queue`,`Binary search`,`A heap`],1,`Process level by level.`,'M'],
  ],
  quizAdv: [
    [`Order courses so prerequisites come first. Which algorithm?`,[`BFS from each course, ordering by shortest distance`,`Dijkstra, with prerequisite counts as edge weights`,`Topological sort (DFS post-order or Kahn's algorithm)`,`Union-find, then output each component's members in order`],2,`Detects cycles too (impossible orderings).`,'H'],
    [`In-order DFS of a binary search tree visits values in what order?`,[`Insertion order`,`Level by level`,`Random`,`Sorted ascending`],3,`Left subtree, node, right subtree.`,'M'],
    [`Number of islands in a grid of 0/1 cells?`,[`Count land cells, then divide by the average island size computed by scanning each row`,`For each unvisited land cell, run BFS/DFS to mark its island, count launches`,`Sort all land cells by row and column, then count the gaps between consecutive cells`,`For each land cell, count it only if both its top and left neighbours are water cells`],1,`Classic flood fill.`,'H'],
    [`Shortest path with weighted edges (non-negative)?`,[`BFS with a plain FIFO queue`,`Dijkstra with a PriorityQueue`,`Topological sort, then relax edges`,`DFS keeping the minimum seen so far`],1,`BFS only works for unweighted graphs.`,'M'],
  ],
});
