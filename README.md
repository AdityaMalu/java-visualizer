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

Each topic is tagged by interview priority (must-know, good to know, beyond interviews). Use the **Interview focus** filter at the top of the topic list to see only what you need; Prev/Next topic and the `[` `]` keys follow it.

Every topic opens with a **Theory: start here** section written for someone who has never seen the concept: the idea in one sentence, a plain-language explanation with an everyday analogy, key terms, how it works step by step, how it shows up in real projects, and common mistakes. Then the visual walkthrough, then the quiz.

Every topic ends with a quiz: 3 core questions plus 2 advanced ones (JMM edge cases, GC tuning, Hibernate flush ordering, multi-pod failure modes), 400 in total. Each question is tagged Easy, Medium or Hard, and you can filter by set and level. Wrong options are real misconceptions, and every answer is explained. Best scores are kept in your browser and shown in the topic list (✓ core, ★ core + advanced).

Keys: `←` `→` step, `space` play, `[` `]` previous/next topic.

The written notes are in [Java_Concepts_Visual_Guide.md](Java_Concepts_Visual_Guide.md). Everything is one self-contained `index.html`, no build step.
