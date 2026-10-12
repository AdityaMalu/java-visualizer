# Java Visualizer

Step-by-step visual walkthroughs of core Java interview topics, like stepping through a debugger: highlighted code lines, thread and object state, memory, locks, queues and diagrams, with an explanation at every step.

**Live:** https://adityamalu.github.io/java-visualizer/

| Part | Topics |
|---|---|
| 1. Java platform, memory, types | JIT, class loading, stack vs heap, GC, references, pass-by-value, Integer cache, String pool, immutability |
| 2. Collections, generics, exceptions, Java 8+ | HashMap internals, equals/hashCode, LRU, TreeMap, heaps, fail-fast iterators, generics/PECS, streams, Optional |
| 3. OOP, SOLID, design patterns | dynamic dispatch, overloading, init order, composition, SOLID, 10 patterns |
| 4. Multithreading and concurrency | races, synchronized, volatile/JMM, CAS, wait/notify, deadlock, locks, synchronizers, pools, CompletableFuture, virtual threads |
| 5. Spring Boot, JPA, microservices | DI, bean lifecycle, AOP proxies, @Transactional, Hibernate, Boot internals, security, circuit breaker, saga/outbox, idempotency |
| 6. Real-world scenarios | flash-sale overselling across pods, production memory leak (heap dump → fix), thread-pool starvation, long @Transactional draining the connection pool, cache stampede, shared SimpleDateFormat |

Every topic ends with a 3-question quiz that explains each answer. Your best score per topic is kept in your browser and shown in the topic list.

Keys: `←` `→` step, `space` play, `[` `]` previous/next topic.

The written notes are in [Java_Concepts_Visual_Guide.md](Java_Concepts_Visual_Guide.md). Everything is one self-contained `index.html`, no build step.
