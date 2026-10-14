/* 5.8 Web layer: request flow */
topic('5', { no:'5.8', title:'Web layer: request flow', idea:`Follow <code>POST /cars</code> through filters, DispatcherServlet, handler mapping, interceptors, argument resolution and validation, the controller, and JSON conversion. Then the error path through @RestControllerAdvice.`,
actors:'Request', stateTitle:'Request state', dgTitle:'Request pipeline',
vb:'0 0 600 200',
nodes:{f:{x:65,y:50,label:'Filter chain',w:110}, ds:{x:195,y:50,label:'Dispatcher\nServlet',w:110,h:46}, hm:{x:325,y:50,label:'Handler\nMapping',w:100,h:46}, ic:{x:450,y:50,label:'Interceptor\npreHandle',w:110,h:46}, ar:{x:540,y:150,label:'Args +\n@Valid',w:100,h:46}, ctl:{x:400,y:150,label:'Controller',w:110}, mc:{x:250,y:150,label:'Jackson\n→ JSON',w:100,h:46}, adv:{x:90,y:150,label:'@RestController\nAdvice',w:130,h:46}},
edges:[['f','ds'],['ds','hm'],['hm','ic'],['ic','ar'],['ar','ctl'],['ctl','mc']],
codes:{a:`@RestController @RequestMapping("/cars")
class CarController {
  @GetMapping("/{id}") CarDto get(@PathVariable long id) { return svc.get(id); }
  @PostMapping ResponseEntity<CarDto> create(@Valid @RequestBody CreateCar req) {
    return ResponseEntity.status(201).body(svc.create(req));
  }
}
record CreateCar(@NotBlank String model, @Positive long price) {}

@RestControllerAdvice
class Errors {
  @ExceptionHandler(NotFound.class) @ResponseStatus(HttpStatus.NOT_FOUND)
  Map<String, String> nf(NotFound e) { return Map.of("error", e.getMessage()); }
  @ExceptionHandler(MethodArgumentNotValidException.class) @ResponseStatus(HttpStatus.BAD_REQUEST)
  Map<String, String> bad(MethodArgumentNotValidException e) { return fieldErrors(e); }
}`},
steps:[
{th:[['POST /cars','in filters:info','{"model":"Swift","price":500000}']], d:{type:'graph',on:['f']}, g:[G('Filter chain (servlet level)',C('order',['CORS','Security (5.9)','RequestId/MDC','TenantFilter (ThreadLocal)']))],
 say:`Tomcat gives the request a thread from its pool (200 by default, or a virtual thread, 4.17), then runs the <b>servlet filter chain</b>: security, CORS, logging, putting a tenant or trace id into a ThreadLocal (4.12). Filters see <b>every</b> request, including static files and errors, and know nothing about controllers.`},
{th:[['POST /cars','routing:info','']], d:{type:'graph',on:['ds','hm'],e:[['f','ds','','hot'],['ds','hm','which method?','hot']]}, g:[G('HandlerMapping',['POST /cars','→ CarController.create','ok'],['no match','404'],['method mismatch','405'])],
 say:`Spring MVC's single front controller, <b>DispatcherServlet</b>, asks the <b>HandlerMapping</b> which controller method matches the path and HTTP method (built at startup from <code>@RequestMapping</code> annotations).`},
{th:[['POST /cars','preHandle:info','']], d:{type:'graph',on:['ic'],e:[['hm','ic','','hot']]},
 say:`<b>HandlerInterceptor.preHandle</b> runs next. Unlike a filter, it <b>knows the target handler</b> (method and annotations), so it suits checks like "this endpoint needs feature flag X" or per-handler metrics. <code>postHandle</code> and <code>afterCompletion</code> run on the way out.`},
{hl:{mvc:[4,8]}, th:[['POST /cars','binding:info','JSON → CreateCar']], d:{type:'graph',on:['ar'],e:[['ic','ar','','hot']]}, g:[G('Argument resolution',['@RequestBody','Jackson reads JSON → CreateCar','ok'],['@Valid','Bean Validation: model not blank ✔, price > 0 ✔','ok'],['@PathVariable / @RequestParam','from URL / query string'])],
 say:`<b>HandlerMethodArgumentResolvers</b> build each parameter: <code>@RequestBody</code> uses an <code>HttpMessageConverter</code> (Jackson) to deserialize the body; <code>@Valid</code> runs Bean Validation on the result.`},
{hl:{mvc:[5]}, th:[['POST /cars','controller:ok','svc.create(req)']], d:{type:'graph',on:['ctl','mc'],e:[['ar','ctl','','hot'],['ctl','mc','CarDto','hot']]}, log:['HTTP/1.1 201 Created','{"id":101,"model":"Swift","price":500000}'],
 say:`The controller calls the service and returns a <code>ResponseEntity</code> (status 201). A return-value handler uses Jackson again to <b>serialize</b> the DTO to JSON, based on the <code>Accept</code> header. Return DTOs, not JPA entities: entities leak internals and trigger lazy loading during serialization.`},
{th:[['POST /cars','validation failed:bad','price = -5']], d:{type:'graph',on:['adv'],bad:['ar'],e:[['ic','ar','','hot'],['ar','adv','MethodArgumentNotValidException','bad']]}, log:['HTTP/1.1 400 Bad Request','{"price":"must be greater than 0"}'],
 say:`<b>Error path:</b> with <code>price = -5</code>, validation throws <code>MethodArgumentNotValidException</code> before your controller runs. The <b>@RestControllerAdvice</b> handler maps it to a clean 400 with field errors.`},
{hl:{mvc:[3,12,13]}, th:[['GET /cars/999','not found:bad','']], d:{type:'graph',on:['adv'],bad:['ctl'],e:[['ctl','adv','NotFound','bad']]}, log:['HTTP/1.1 404 Not Found','{"error":"car 999 not found"}'],
 say:`A domain exception thrown anywhere below the controller (here <code>NotFound</code>) is mapped centrally, so controllers stay clean and error formats stay consistent. Boot 3 also supports RFC 7807 <code>ProblemDetail</code> responses. <b>Filter vs interceptor:</b> filter = servlet level, every request, no handler info; interceptor = Spring MVC level, knows the handler.`}
],
keep:[`Filters → DispatcherServlet → HandlerMapping → interceptors → argument resolvers (+@Valid) → controller → message converter.`,`@RestControllerAdvice maps exceptions to status + JSON centrally.`,`Filter = servlet-wide; interceptor = knows the handler. Return DTOs, not entities.`]}, {
  imp: 'good',
  theory: TH(`An HTTP request travels through servlet filters, Spring's DispatcherServlet, interceptors, argument binding and validation to your controller, and the result is converted to JSON on the way back.`,
`<p>When a request like <code>POST /cars</code> arrives, the embedded server hands it to a chain of <b>filters</b> (security, logging, CORS). Then Spring's <b>DispatcherServlet</b> finds the controller method matching the URL and HTTP method, runs <b>interceptors</b>, converts the JSON body into a Java object, validates it (<code>@Valid</code>), and calls your method. The return value is converted back to JSON by a message converter (Jackson).</p>
<p>Exceptions anywhere in the controller layer can be turned into proper HTTP error responses in one place with <code>@RestControllerAdvice</code>.</p>`,
[[`Filter`,`Servlet-level component that sees every request.`],[`DispatcherServlet`,`Spring MVC's front controller that routes requests.`],[`HandlerInterceptor`,`Runs around controller handlers.`],[`@Valid`,`Triggers Bean Validation on a request body.`],[`@RestControllerAdvice`,`Global exception-to-response mapping.`]],
[`Filters (security first) → DispatcherServlet.`,`Handler mapping finds the controller method.`,`Interceptors' preHandle → argument resolution and validation → controller.`,`Return value → JSON via Jackson → response.`,`Errors → @ExceptionHandler → error JSON with the right status.`],
[`Return DTOs (records), not JPA entities.`,`Validate input with annotations (@NotNull, @Size) on DTOs.`,`Return correct status codes (201 Created, 400, 404, 409).`],
[`Business logic in controllers.`,`try/catch in every controller instead of central error handling.`]),
  quiz: [
    [`A body fails <code>@Valid</code>. Where do you map that to a 400 JSON error for every controller?`,[`A try/catch in every controller method`,`A servlet filter in front of the dispatcher`,`A custom ErrorController per endpoint`,`A @RestControllerAdvice @ExceptionHandler`],3,`Central, consistent error mapping.`,'E'],
    [`Add a request-id header to every response, including static resources and error pages. Filter or HandlerInterceptor?`,[`HandlerInterceptor`,`A Filter`,`An @Aspect on controllers`,`@ControllerAdvice`],1,`Filters run for everything in the servlet container; interceptors only see requests mapped to handlers.`,'M'],
    [`<code>@Valid OrderDto</code> has <code>List&lt;ItemDto&gt; items</code> without @Valid; ItemDto has @NotNull fields. Are items validated?`,[`Yes: Bean Validation always cascades into collections`,`Only the first item in the list is validated`,`No: the items field needs @Valid to cascade`,`Yes, as long as ItemDto is declared as a record`],2,`Bean Validation only cascades into fields marked @Valid.`,'H'],
    [`Which annotation marks a class returning JSON from handler methods?`,[`@Controller`,`@RestController`,`@Service`,`@Component`],1,`@Controller + @ResponseBody.`,'E'],
    [`Read <code>/cars/7</code>'s 7 into a parameter?`,[`@RequestParam`,`@PathVariable`,`@RequestBody`,`@Header`],1,`@RequestParam reads ?query=params.`,'E'],
    [`Which status should a successful POST that creates a resource return?`,[`200`,`201 Created`,`204`,`302`],1,`Often with a Location header.`,'M'],
    [`What converts Java objects to JSON in Spring MVC?`,[`The ViewResolver (Thymeleaf)`,`HttpMessageConverters (Jackson)`,`Tomcat's response encoder (Coyote)`,`HandlerInterceptors (Gson)`],1,`Content negotiation picks one.`,'M'],
    [`What does <code>@Valid @RequestBody CarDto dto</code> trigger on failure?`,[`ConstraintViolationException → 500 by default`,`MethodArgumentNotValidException → 400 by default`,`BindException → 422 by default`,`HttpMessageNotReadableException → 400 by default`],1,`Customise the body in @ControllerAdvice.`,'M'],
  ],
  quizAdv: [
    [`Why return DTOs rather than JPA entities from controllers?`,[`DTOs serialise faster`,`Avoids leaks and lazy-load errors`,`Entities can't be serialised`,`Spring requires it`],1,`DTOs give a stable API contract.`,'M'],
    [`An exception thrown in a servlet Filter, before DispatcherServlet. Does @RestControllerAdvice handle it?`,[`Yes, always`,`Only RuntimeExceptions`,`No: filters run before it`,`Only in tests`],2,`Handle errors inside the filter, or use the error endpoint.`,'H'],
    [`Where does a HandlerInterceptor run relative to the controller?`,[`Before the DispatcherServlet, as a servlet filter in the chain`,`preHandle before, postHandle after, afterCompletion at the very end`,`preHandle before, then postHandle only if an exception is thrown`,`Inside the controller method, wrapped like an @Around aspect`],1,`Filters wrap the whole servlet.`,'H'],
    [`Idempotent HTTP methods are?`,[`GET, POST, PUT (and HEAD, OPTIONS)`,`GET, PUT, DELETE (and HEAD, OPTIONS)`,`GET, POST, PATCH (and HEAD only)`,`GET and HEAD only (not PUT or DELETE)`],1,`POST isn't; use idempotency keys (5.13c).`,'M'],
  ],
});
