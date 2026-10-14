/* 7.4 Date and time with java.time */
topic('7', { no:'7.4', title:'Date and time with java.time', imp:'good', idea:`Instant, LocalDate, LocalDateTime and ZonedDateTime each mean something different. Watch a meeting fall into a daylight-saving gap, months clamp, and why servers store UTC.`,
actors:'Thread', stateTitle:'Values',
codes:{a:`Instant now = Instant.now();                          // a point on the timeline (UTC)
LocalDate due = LocalDate.of(2026, 3, 31);            // a calendar date, no time zone
LocalDateTime meeting = LocalDateTime.of(2026, 3, 29, 2, 30);   // no zone either!
ZonedDateTime inBerlin = meeting.atZone(ZoneId.of("Europe/Berlin"));
ZonedDateTime inIndia = inBerlin.withZoneSameInstant(ZoneId.of("Asia/Kolkata"));
LocalDate nextMonth = due.plusMonths(1);
Duration d = Duration.between(now, now.plusSeconds(5400));
Period p = Period.between(LocalDate.of(1990, 5, 20), due);
String s = due.format(DateTimeFormatter.ISO_LOCAL_DATE);`},
steps:[
{hl:{main:[1]}, th:[], g:[G('Instant',['meaning','an exact moment, same everywhere'],['stored as','seconds + nanos since 1970-01-01T00:00Z'],['now','2026-03-28T09:15:00Z (example)'])],
 say:`<b>Instant</b> is a moment on the global timeline: "when did this happen?" It has no time zone and no calendar, just a count of seconds since 1970 UTC. Use it for timestamps: createdAt, event times, logs.`},
{hl:{main:[2,3]}, g:[G('Local types (no zone)',['LocalDate','2026-03-31: a date on a calendar'],['LocalDateTime','2026-03-29T02:30: a wall-clock reading'],['is it a moment?','no: 02:30 where?','bad'])],
 say:`<b>LocalDate</b> and <b>LocalDateTime</b> are what a calendar or wall clock shows, with <b>no zone</b>. A birthday or a due date is a LocalDate. A LocalDateTime is not an exact moment until you say where.`},
{hl:{main:[4]}, g:[G('Berlin, 2026-03-29',['clocks jump','02:00 → 03:00 (DST starts)','hot'],['02:30 exists?','no: it\'s in the gap','bad'],['atZone result','2026-03-29T03:30+02:00','ok'])],
 say:`Attaching a zone gives a <b>ZonedDateTime</b>. On 29 March 2026 Berlin skips from 02:00 to 03:00 for daylight saving, so 02:30 never happens. java.time doesn't fail: it shifts forward by the gap, to 03:30. Real bug: jobs scheduled at 02:30 local time run late or twice in autumn.`},
{hl:{main:[5]}, g:[G('Same instant, two zones',['Berlin','03:30 +02:00'],['UTC','01:30 Z'],['India','07:00 +05:30','ok'])],
 say:`<code>withZoneSameInstant</code> converts to another zone without changing the moment. The same instant is 07:00 in India. (<code>withZoneSameLocal</code> would keep 03:30 and change the moment, which is rarely what you want.)`},
{hl:{main:[6]}, g:[G('Calendar math',['2026-03-31 plusMonths(1)','2026-04-30 (clamped)','ok'],['plusDays(30)','2026-04-30'],['immutable?','yes: due is unchanged','ok'])],
 say:`Calendar arithmetic is careful: March 31 + 1 month is April 30, since April 31 doesn't exist. All java.time types are <b>immutable</b>: plusMonths returns a new value, so they're thread-safe (unlike the old <code>Date</code>, <code>Calendar</code> and <code>SimpleDateFormat</code>, see 6.6).`},
{hl:{main:[7,8]}, g:[G('Amounts of time',['Duration','PT1H30M: exact seconds/nanos (machine time)'],['Period','P35Y10M11D: years, months, days (human time)'])],
 say:`<b>Duration</b> is an exact amount (timeouts, elapsed time). <b>Period</b> is calendar-based (age, subscription length): "one day" in a Period can be 23 or 25 hours across a DST change.`},
{hl:{main:[9]}, g:[G('Good practice',['store','Instant / UTC (DB: timestamptz)','ok'],['display','convert to the user\'s ZoneId at the edges','ok'],['APIs','ISO-8601 strings: 2026-03-31, 2026-03-28T09:15:00Z','ok'],['tests','inject a Clock instead of calling now() directly','ok'])],
 say:`Rules of thumb: <b>store and compute in UTC</b> (Instant), convert to local time only for display, exchange ISO-8601 strings, and inject a <code>Clock</code> so tests can control "now". <code>DateTimeFormatter</code> is immutable and safe to share.`}
],
keep:[`Instant = moment (UTC); LocalDate/LocalDateTime = wall calendar, no zone; ZonedDateTime = local time + zone rules.`,`Store UTC, convert at the edges; DST gaps/overlaps make some local times invalid or ambiguous.`,`java.time is immutable and thread-safe; Duration = exact, Period = calendar; inject a Clock for tests.`]}, {
  imp: 'good',
  theory: TH(`java.time separates exact moments (Instant) from calendar dates and wall-clock times (LocalDate, LocalDateTime) and from time zones (ZonedDateTime), and every type is immutable.`,
`<p>Time is harder than it looks. "2026-03-29 02:30" means different moments in Berlin and Mumbai, and in Berlin on that day it doesn't exist at all because clocks jump forward for daylight saving. The old <code>Date</code> and <code>Calendar</code> classes mixed these ideas and were mutable.</p>
<p>The <b>java.time</b> API (Java 8) gives each idea its own type: <b>Instant</b> for a precise moment, <b>LocalDate</b> for a calendar date, <b>LocalDateTime</b> for a date and time without a zone, <b>ZonedDateTime</b> for local time in a specific zone, <b>Duration</b> and <b>Period</b> for amounts of time.</p>`,
[[`Instant`,`A moment on the UTC timeline.`],[`LocalDate / LocalDateTime`,`Calendar date / date-time without a zone.`],[`ZoneId`,`A time zone with its rules, e.g. Europe/Berlin.`],[`DST`,`Daylight saving time: clocks jump, creating gaps and overlaps.`],[`Duration / Period`,`Exact time amount / calendar amount.`],[`ISO-8601`,`Standard text format: 2026-03-31T09:15:00Z.`]],
[`Capture moments as Instant (UTC).`,`Keep dates without time as LocalDate.`,`Convert to ZonedDateTime with the user's ZoneId only for display or local rules.`,`Format and parse with DateTimeFormatter (ISO by default).`],
[`Database: timestamp with time zone (stored in UTC) for moments; date for plain dates.`,`Inject <code>Clock</code> into services so tests can fix "now".`],
[`Using LocalDateTime for timestamps across regions.`,`Scheduling at local times inside DST transitions.`,`Mixing old Date/SimpleDateFormat with java.time.`]),
  quiz: [
    [`Which type should a server use to record when an order was created?`,[`LocalDateTime`,`LocalDate`,`String`,`Instant`],3,`Instant is an exact moment, independent of time zones.`,'E'],
    [`<code>LocalDate.of(2026, 1, 31).plusMonths(1)</code>?`,[`2026-03-03`,`2026-02-28`,`2026-02-31`,`DateTimeException`],1,`java.time clamps to the last valid day of the month.`,'M'],
    [`In Berlin, clocks jump from 02:00 to 03:00 on 29 March 2026. <code>LocalDateTime 02:30</code>.atZone(Berlin) gives?`,[`03:30, shifted forward by the gap`,`02:30 exactly, with a +02:00 offset`,`01:30, shifted back before the gap`,`DateTimeException, since 02:30 doesn't exist`],0,`Times in a DST gap are moved forward by the gap's length.`,'H'],
    [`Which type represents a birthday?`,[`Instant`,`LocalDate`,`ZonedDateTime`,`Duration`],1,`A calendar date without time or zone.`,'E'],
    [`Are java.time objects mutable?`,[`Yes, setters like setDayOfMonth change them in place`,`No: methods return new instances`,`Only LocalDate is immutable; the other types are mutable`,`Only Instant is immutable, because it has no time zone`],1,`Thread-safe as a result.`,'E'],
    [`Exact elapsed time between two Instants?`,[`Period.between`,`Duration.between`,`ChronoUnit.YEARS`,`LocalDate.until`],1,`Period is for calendar amounts.`,'E'],
    [`Parse "2026-03-31" into a date?`,[`new Date("2026-03-31")`,`LocalDate.parse("2026-03-31")`,`Instant.parse("2026-03-31")`,`Integer.parseInt`],1,`ISO format by default.`,'M'],
    [`Why store timestamps in UTC?`,[`UTC values take less space in the database than zoned values`,`A single unambiguous timeline; convert to local zones only for display`,`The JVM requires UTC to sort timestamps correctly across hosts`,`UTC removes the need to convert anything when showing times to users`],1,`Avoids DST and region confusion.`,'M'],
  ],
  quizAdv: [
    [`<code>withZoneSameInstant</code> vs <code>withZoneSameLocal</code>?`,[`They're the same: both keep the instant and only relabel the zone`,`SameInstant keeps the moment; SameLocal keeps the clock reading and changes the moment`,`SameLocal keeps the moment; SameInstant keeps the clock reading instead`,`SameInstant only works with UTC; SameLocal handles any region zone`],1,`Use SameInstant to convert for display.`,'M'],
    [`Why inject a <code>Clock</code> into services?`,[`Clock.instant() is cheaper than calling Instant.now() repeatedly`,`Spring requires a Clock bean before any java.time type can be used`,`Tests can fix or advance "now" deterministically`,`A Clock automatically corrects local times around DST transitions`],2,`Instant.now(clock) in code; Clock.fixed(...) in tests.`,'H'],
    [`In autumn, a local time like 02:30 can occur twice (DST overlap). What does atZone pick?`,[`It throws DateTimeException because the time is ambiguous`,`The earlier offset by default (withLaterOffsetAtOverlap() to choose the later)`,`The later offset by default (withEarlierOffsetAtOverlap() to choose the earlier)`,`The system default zone's standard offset, ignoring the overlap`],1,`Ambiguous local times need a policy.`,'H'],
    [`<code>LocalDate.of(2024, 2, 29).plusYears(1)</code>?`,[`2025-02-29`,`2025-02-28`,`2025-03-01`,`Exception`],1,`Clamped to the last valid day.`,'M'],
  ],
});
