/* 7.5 I/O, NIO files and serialization */
topic('7', { no:'7.5', title:'I/O, NIO files and serialization', imp:'good', idea:`Read and write files the modern way with Path and Files, avoid loading huge files into memory, close resources safely, and turn objects into JSON (and why Java's built-in serialization is risky).`,
actors:'Thread', stateTitle:'Memory and files', logTitle:'Console',
codes:{a:`Path file = Path.of("orders.csv");
List<String> all = Files.readAllLines(file);          // whole file in memory
try (Stream<String> lines = Files.lines(file)) {      // lazy: one line at a time
  long paid = lines.filter(l -> l.endsWith(",PAID")).count();
}                                                     // file closed here
try (BufferedWriter w = Files.newBufferedWriter(Path.of("out.txt"))) {
  w.write("total=" + all.size());
}                                                     // flushed + closed here

record OrderDto(long id, String customer) {}
String json = mapper.writeValueAsString(new OrderDto(7, "Ana"));
OrderDto back = mapper.readValue(json, OrderDto.class);

class Legacy implements Serializable {                // Java serialization
  private static final long serialVersionUID = 1L;
  private transient String password;                  // not written
}`},
steps:[
{hl:{main:[1]}, th:[], g:[G('I/O families',['byte streams','InputStream / OutputStream: images, any binary'],['character streams','Reader / Writer: text, with a charset'],['NIO.2 (Java 7+)','Path + Files: the modern file API','ok'])],
 say:`Java I/O moves data as <b>streams of bytes</b> (InputStream/OutputStream) or <b>characters</b> (Reader/Writer, which decode bytes using a charset like UTF-8). For files, use the modern <b>Path</b> and <b>Files</b> API. A Path is just a location; nothing is opened yet.`},
{hl:{main:[2]}, g:[G('readAllLines',['file size','2 GB'],['heap needed','> 2 GB of Strings','bad'],['fine for','small config or test files','ok'])], log:['java.lang.OutOfMemoryError: Java heap space'],
 say:`<code>Files.readAllLines</code> (and <code>readString</code>) load the <b>whole file</b> into memory. Perfect for a small file, fatal for a 2 GB export.`},
{hl:{main:[3,4,5]}, g:[G('Files.lines (lazy)',['in memory at once','~1 line','ok'],['file handle','open until the stream is closed','hot'],['paid','184,302'])],
 say:`<code>Files.lines</code> returns a <b>lazy</b> Stream that reads line by line as you consume it, so memory stays flat. But it holds an open file handle, so it must be closed: put it in <b>try-with-resources</b>. Forgetting leaks file descriptors until "Too many open files".`},
{hl:{main:[6,7,8]}, g:[G('BufferedWriter',['buffer','8 KB in memory, written in chunks'],['on close','flush buffer → close file','ok'],['charset','UTF-8 (default since Java 18)'])],
 say:`Writers are <b>buffered</b> for speed: data sits in memory until the buffer fills or you flush. try-with-resources flushes and closes even if an exception is thrown. Without closing, the last chunk can be lost (see 3.7g).`},
{hl:{main:[10,11,12]}, g:[G('JSON with Jackson',['object → JSON','{"id":7,"customer":"Ana"}','ok'],['JSON → object','OrderDto[id=7, customer=Ana]','ok'],['ObjectMapper','create once, share (thread-safe)'])],
 say:`<b>Serialization</b> means turning an object into bytes or text to store or send, and <b>deserialization</b> is the reverse. In real services that's almost always <b>JSON</b> via Jackson (Spring does it for every request, 5.8). Records work out of the box.`},
{hl:{main:[14,15,16]}, g:[G('Java built-in serialization',['marker','implements Serializable'],['serialVersionUID','version check between writer and reader'],['transient','field skipped (null/0 after reading)'],['risk','deserializing untrusted bytes can run gadget code','bad'])],
 say:`Java also has <b>built-in</b> binary serialization (<code>ObjectOutputStream</code>). Fields marked <code>transient</code> aren't written; <code>serialVersionUID</code> detects incompatible class versions. It's discouraged today: brittle across versions, and <b>deserializing untrusted data is a known remote-code-execution risk</b>. Prefer JSON, Protobuf or Avro.`},
{th:[], g:[G('When you need more',['huge files','stream + process line by line','ok'],['servers handling 10k sockets','NIO channels / Netty, or virtual threads'],['memory-mapped files','FileChannel.map for random access to huge files'],['temp files','Files.createTempFile + delete'])],
 say:`NIO also has <b>channels</b> and <b>buffers</b> for non-blocking network I/O (the basis of Netty and WebFlux), and memory-mapped files. For most application code: Path + Files, try-with-resources, stream big data, JSON for objects.`}
],
keep:[`Use Path + Files; readAllLines only for small files, Files.lines (closed with try-with-resources) for big ones.`,`Always close streams/writers with try-with-resources; writers are buffered.`,`JSON (Jackson) for object serialization; avoid Java serialization of untrusted data; transient fields are skipped.`]}, {
  imp: 'good',
  theory: TH(`Java reads and writes data as streams of bytes or characters; the modern Files API handles files simply, and serialization turns objects into bytes or text such as JSON.`,
`<p>Every program reads or writes data: files, network sockets, HTTP bodies. Java models these as <b>streams</b> (not the same as the Stream API): you read or write a sequence of bytes, or characters decoded with a charset. Resources like files and sockets must be <b>closed</b>, which try-with-resources guarantees.</p>
<p>To save or send an object, you <b>serialize</b> it: turn it into JSON, binary or another format. Today that's usually JSON with Jackson. Java's built-in object serialization still exists but is discouraged for security and compatibility reasons.</p>`,
[[`InputStream / OutputStream`,`Byte-oriented I/O.`],[`Reader / Writer`,`Character-oriented I/O using a charset.`],[`Path / Files`,`Modern file API (NIO.2).`],[`Buffering`,`Collecting data in memory to read/write in efficient chunks.`],[`Serialization`,`Object → bytes/text; deserialization is the reverse.`],[`transient`,`Field excluded from Java serialization.`]],
[`Locate the file with Path.of.`,`Small file: Files.readString / readAllLines. Big file: Files.lines or a BufferedReader, inside try-with-resources.`,`Write with Files.writeString or a BufferedWriter.`,`For objects, map to and from JSON with an ObjectMapper.`],
[`Process large CSV/log files line by line.`,`Configure Jackson once (dates as ISO, unknown properties policy) and share the ObjectMapper.`],
[`Reading huge files fully into memory.`,`Not closing streams (file descriptor leaks).`,`Deserializing untrusted data with ObjectInputStream.`]),
  quiz: [
    [`Best way to count lines matching a pattern in a 5 GB log file?`,[`Files.readAllLines, then stream and filter the list`,`Files.readString, then split on newlines and filter`,`Files.lines inside try-with-resources, then filter and count`,`Read it into a StringBuilder, then use a Matcher on it`],2,`Lazy streaming keeps memory flat; the stream must be closed.`,'E'],
    [`A field is marked <code>transient</code> in a Serializable class. After deserialization it is?`,[`Its default value (null / 0)`,`Its original value`,`An exception is thrown`,`Encrypted`],0,`Transient fields aren't written.`,'M'],
    [`Why is <code>ObjectInputStream.readObject</code> on untrusted input dangerous?`,[`It loads the whole stream into memory before checking types`,`It ignores serialVersionUID, so mismatched classes load silently`,`It skips constructors, so final fields are always left null`,`Crafted byte streams can trigger code in classes on the classpath (gadget chains)`],3,`Deserialization vulnerabilities have led to remote code execution; prefer JSON with explicit types.`,'H'],
    [`Read a small text file in one line?`,[`new File(path).readText()`,`Files.readString(Path.of(path))`,`Paths.get(path).readString()`,`Files.readAllBytes(path).toString()`],1,`Java 11+.`,'E'],
    [`What's the difference between InputStream and Reader?`,[`InputStream is buffered while Reader reads one byte at a time`,`InputStream reads bytes; Reader reads characters (decoded with a charset)`,`Reader reads lines only; InputStream reads raw characters (UTF-16)`,`InputStream is for files only; Reader is for network sockets`],1,`Wrap with InputStreamReader to convert.`,'E'],
    [`Why use try-with-resources for files?`,[`It buffers the file so reads become faster`,`Files get closed even if an exception happens`,`The compiler rejects file APIs used outside it`,`It retries automatically if opening the file fails`],1,`Avoids leaking file handles.`,'E'],
    [`Convert an object to JSON in Spring apps?`,[`toString()`,`Jackson's ObjectMapper`,`Serializable`,`String.format`],1,`Spring MVC uses it automatically.`,'E'],
    [`What does <code>serialVersionUID</code> protect against?`,[`Deserializing objects whose classes aren't on the classpath`,`Deserializing data written by an incompatible class version`,`Classes being serialized concurrently from several threads`,`Malicious byte streams triggering gadget chains on deserialize`],1,`Mismatches throw InvalidClassException.`,'M'],
  ],
  quizAdv: [
    [`A BufferedWriter writes 100 lines, and the program exits without close() or flush(). What's in the file?`,[`All 100 lines, since the JVM flushes writers on exit`,`Possibly nothing or a partial file`,`Exactly the first 99 lines, missing the last one`,`An empty file, plus an IOException written to stderr`],1,`Unflushed buffer contents are lost.`,'M'],
    [`What's the default charset for Files.newBufferedWriter (and since Java 18, most APIs)?`,[`The OS default, always`,`ISO-8859-1`,`UTF-16`,`UTF-8`],3,`Files methods always defaulted to UTF-8; JEP 400 made UTF-8 the platform default in 18.`,'H'],
    [`What does Jackson's <code>FAIL_ON_UNKNOWN_PROPERTIES = false</code> allow?`,[`Deserializing JSON that is missing some of your class's required fields, filling them with defaults`,`Ignoring JSON fields your class doesn't have, so newer producers don't break older consumers`,`Accepting null values for primitive fields instead of throwing a MismatchedInputException`,`Skipping schema validation on every field, so large payloads are parsed noticeably faster`],1,`Spring Boot disables failing by default.`,'H'],
    [`Why is <code>Files.walk(dir)</code> wrapped in try-with-resources?`,[`It reads every file's contents eagerly into memory`,`It returns a lazy Stream holding open directory handles`,`It locks the directory against writes until closed`,`It starts a background thread that must be stopped`],1,`Same for Files.lines and Files.list.`,'M'],
  ],
});
