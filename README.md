# Java Visualizer

Step-by-step visual walkthroughs of core Java interview topics, like stepping through a debugger: highlighted code lines, thread and object state, memory, locks, queues and diagrams, with an explanation at every step.

**Live:** https://adityamalu.github.io/java-visualizer/

| Part | Topics |
|---|---|
| 0. Java basics | first program, types and operators, control flow, arrays, methods and recursion, classes and objects, packages and access |
| 1. Java platform, memory, types | JIT, class loading, stack vs heap, GC, references, pass-by-value, Integer cache, String pool, immutability |
| 2. Collections, generics, exceptions, Java 8+ | HashMap internals, equals/hashCode, LRU, TreeMap, heaps, fail-fast iterators, generics/PECS, streams, Optional |
| 3. OOP, SOLID, design patterns | dynamic dispatch, overloading, init order, composition, SOLID, 10 patterns |
| 4. Multithreading and concurrency | races, synchronized, volatile/JMM, CAS, wait/notify, deadlock, locks, synchronizers, pools, CompletableFuture, virtual threads |
| 5. Spring Boot, JPA, microservices | DI, bean lifecycle, AOP proxies, @Transactional, Hibernate, Boot internals, security, circuit breaker, saga/outbox, idempotency |
| 6. Real-world scenarios | flash-sale overselling across pods, production memory leak (heap dump → fix), thread-pool starvation, long @Transactional draining the connection pool, cache stampede, shared SimpleDateFormat |
| 7. Language features in depth | enums, reflection and annotations, Collectors (groupingBy, toMap), java.time, I/O and serialization, Java 8 → 25 |
| 8. Data and messaging | transactions and isolation levels, indexes and EXPLAIN, JDBC and connection pooling, Kafka fundamentals |
| 9. Testing and production tooling | JUnit 5 and Mockito, JVM troubleshooting (jcmd, dumps, JFR), Maven/Gradle dependency conflicts, logging/metrics/tracing, Java modules |
| 10. Reactive programming | Project Reactor (Mono/Flux, backpressure), WebFlux vs virtual threads |
| 11. Data structures and algorithms in Java | Big-O and collection costs, two pointers and sliding window, hashing patterns, binary search, BFS/DFS, dynamic programming |

Each topic is tagged by interview priority (must-know, good to know, beyond interviews). Use the **Interview focus** filter at the top of the topic list to see only what you need; Prev/Next topic and the `[` `]` keys follow it.

Every topic opens with a **Theory: start here** section written for someone who has never seen the concept: the idea in one sentence, a plain-language explanation with an everyday analogy, key terms, how it works step by step, how it shows up in real projects, and common mistakes. Then the visual walkthrough, then the quiz.

Every topic ends with a quiz drawn from a bank of 12 questions per topic (8 core plus 4 advanced on JMM edge cases, GC tuning, Hibernate flush ordering and multi-pod failure modes), 1,320 in total. Each attempt shows 3 core or 2 advanced questions; press **↻ New questions** to draw a fresh set you haven't seen yet, with the answer order shuffled every time. The bank itself isn't listed on the page. Each question is tagged Easy, Medium or Hard, and you can filter by set and level. Wrong options are real misconceptions, and every answer is explained. Best scores are kept in your browser and shown in the topic list (✓ core, ★ core + advanced).

Keys: `←` `→` step, `space` play, `[` `]` previous/next topic.

The topic list can be hidden with **«** and brought back with **☰ Topics**, and widened by dragging its right edge (double-click the edge to reset). Both choices are remembered. On phones it opens as a slide-in drawer, which also gives you the interview focus filter.

The written notes are in [Java_Concepts_Visual_Guide.md](Java_Concepts_Visual_Guide.md).

## Development

The site ships as one self-contained `index.html`, built from small source files:

```
src/
  index.html                 page shell (markup only); the build inlines styles and scripts here
  styles/                    tokens, layout, theory, stepper, quiz, responsive (cascade order)
  engine/                    the app, one concern per file
    registry.js              part() / topic() registration, step helpers (mon, G, C) and TH()
    model.js                 flattens parts into topics and resolves step inheritance
    dom.js  diagrams.js  focus.js  sidebar.js  theory.js  quiz.js  stepper.js  main.js
  content/
    parts.js                 part numbers and titles
    part-04-multithreading-and-concurrency/
      4.6-volatile-and-the-java-memory-model.js   one file per topic
scripts/
  build.mjs                  bundles src/ into dist/index.html (no dependencies)
  check-content.mjs          validates every topic file without a browser
tests/site.spec.js           Playwright end-to-end tests (desktop and mobile)
```

Each topic file holds everything about that topic and nothing else:

```js
topic('4', { no:'4.6', title:'…', idea:`…`, codes:{a:`…`}, steps:[…], keep:[…] }, {
  imp: 'must',                 // must | good | extra (interview focus filter)
  theory: TH(one, intro, terms, steps, practice, mistakes),
  quiz:    [ [question, [a, b, c, d], answerIndex, why, 'E'|'M'|'H'], … ],   // at least 3
  quizAdv: [ … ],                                                         // at least 2
});
```

To add a topic, create `src/content/part-NN-…/<no>-<slug>.js`. The build picks it up and orders topics by number. No other file changes.

```sh
npm ci                                  # once
npm run dev                             # rebuild dist/index.html on every change; open it in a browser
npm run check                           # validate content: structure, quiz banks, highlighted lines
npm test                                # check + build + end-to-end tests
npx playwright install chromium         # once, before the first end-to-end run
```

Every push and pull request runs the checks, the build and the end-to-end tests in GitHub Actions. Pushes to `main` then deploy `dist/` to GitHub Pages.
