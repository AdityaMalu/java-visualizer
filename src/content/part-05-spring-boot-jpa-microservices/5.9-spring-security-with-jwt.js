/* 5.9 Spring Security with JWT */
topic('5', { no:'5.9', title:'Spring Security with JWT', idea:`Three requests: no token (401), valid user token on an admin path (403), valid admin token (200). Watch the filter and the SecurityContext at each step.`,
actors:'Request', stateTitle:'Security state',
codes:{a:`@Bean SecurityFilterChain api(HttpSecurity http) throws Exception {
  return http.csrf(c -> c.disable())                       // stateless JWT API
    .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
    .authorizeHttpRequests(a -> a
        .requestMatchers("/auth/**").permitAll()
        .requestMatchers("/admin/**").hasRole("ADMIN")
        .anyRequest().authenticated())
    .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
    .build();
}
// JwtFilter: read "Authorization: Bearer <jwt>" -> verify signature + exp
//            -> SecurityContextHolder.getContext().setAuthentication(auth)
@PreAuthorize("hasRole('ADMIN') or #id == authentication.name")
UserDto get(@PathVariable String id) { /* ... */ }`},
steps:[
{hl:{sec:[11,7]}, th:[['GET /orders','no token:bad','']], g:[G('JwtFilter',['Authorization header','missing'],['SecurityContext','anonymous']), G('Authorization',['anyRequest().authenticated()','✘ not authenticated','bad'])], log:['HTTP/1.1 401 Unauthorized'],
 say:`Spring Security is a chain of <b>servlet filters</b> in front of your app (5.8). No token, so the JWT filter sets no authentication, the authorization rule needs an authenticated user, and the response is <b>401 Unauthorized</b>, which really means "who are you?".`},
{th:[['GET /admin/users','token for asha:info','']], g:[G('JWT = header.payload.signature',['header','{"alg":"RS256","kid":"k1"}'],['payload','{"sub":"asha","roles":["USER"],"exp":1760290000}'],['signature','RSA over header.payload'],['encoding','base64url: SIGNED, NOT encrypted','bad'])],
 say:`A JWT is three base64url parts. Anyone can <b>read</b> the payload (paste it into jwt.io), so never put secrets in it. The <b>signature</b> proves it was issued by your auth server and hasn't been modified.`},
{hl:{sec:[8,11,12]}, th:[['GET /admin/users','authenticated:ok','asha / ROLE_USER']], g:[G('JwtFilter',['verify signature','public key k1 ✔','ok'],['check exp / iss / aud','✔','ok'],['SecurityContextHolder','Authentication(asha, [ROLE_USER])','hot'],['stored in','a ThreadLocal; cleared after the request'])],
 say:`The filter verifies the signature and the claims (expiry, issuer, audience), builds an <code>Authentication</code>, and stores it in <code>SecurityContextHolder</code>, which is a <b>ThreadLocal</b> (4.12). It's stateless: no server session, so any pod can verify any request.`},
{hl:{sec:[6]}, th:[['GET /admin/users','forbidden:bad','asha lacks ADMIN']], g:[G('Authorization',['/admin/** requires','ROLE_ADMIN'],['asha has','ROLE_USER','bad'])], log:['HTTP/1.1 403 Forbidden'],
 say:`Asha is <b>authenticated</b> but not <b>authorized</b> for /admin, so the response is <b>403 Forbidden</b>, meaning "I know who you are, you can't do this". Authentication = who you are; authorization = what you may do.`},
{hl:{sec:[13,14]}, th:[['GET /users/asha','method security:ok','#id == authentication.name']], log:['HTTP/1.1 200 OK'],
 say:`<code>@PreAuthorize</code> adds <b>method-level</b> rules with SpEL: admins, <i>or</i> users reading their own record. It's another proxy-based annotation (5.3), so self-invocation skips it.`},
{th:[], g:[G('Design notes',['passwords','BCrypt/Argon2 hash, never plain text','ok'],['CSRF','needed for cookie sessions; off for stateless bearer APIs'],['short-lived access token','5–15 min','ok'],['refresh token','rotate; store server-side to revoke'],['logout / revoke JWT','can\'t un-sign → short expiry + denylist'],['transport','HTTPS only'])],
 say:`The JWT weak spot is <b>revocation</b>: a signed token stays valid until it expires. So keep access tokens short-lived, use refresh tokens you can revoke, and denylist by <code>jti</code> for emergencies. CSRF protection matters only when the browser sends credentials automatically (cookies).`}
],
keep:[`Security = filter chain; JWT filter verifies signature + exp → Authentication in a ThreadLocal SecurityContext.`,`401 = not authenticated; 403 = authenticated but not allowed.`,`JWT is signed, not encrypted; short expiry + refresh tokens for revocation.`]}, {
  imp: 'good',
  theory: TH(`Spring Security is a chain of filters that authenticates who you are and authorises what you can do; with JWT, the client sends a signed token on every request.`,
`<p><b>Authentication</b> answers "who are you?"; <b>authorisation</b> answers "are you allowed?". With <b>JWT</b>, after login the server issues a token containing claims (user id, roles, expiry) and signs it. The client sends it in the <code>Authorization: Bearer …</code> header. On each request a filter verifies the signature and expiry, builds an <code>Authentication</code> object, and stores it in the SecurityContext for the rest of the request.</p>
<p>The server doesn't need to store sessions (stateless), but it also can't easily revoke a token before it expires.</p>`,
[[`JWT`,`Base64URL-encoded header.payload.signature; signed, not encrypted.`],[`SecurityFilterChain`,`The ordered filters that process security.`],[`SecurityContext`,`Holds the current user's Authentication (thread-bound).`],[`401 vs 403`,`Not authenticated vs authenticated but forbidden.`],[`Refresh token`,`Long-lived token used to get new short-lived access tokens.`]],
[`Request arrives → the JWT filter reads the header.`,`Verify signature and expiry with the expected algorithm and key.`,`Create an Authentication with the user's authorities.`,`Authorisation rules (URL rules, @PreAuthorize) check roles.`,`Missing/invalid token → 401; insufficient role → 403.`],
[`Keep access tokens short-lived (minutes) and use refresh tokens.`,`Never put secrets in the payload; anyone can decode it.`,`Prefer a standard resource-server setup (spring-boot-starter-oauth2-resource-server) to hand-written filters.`],
[`Accepting tokens without checking the algorithm.`,`Long-lived tokens with no revocation plan.`]),
  quiz: [
    [`Valid JWT, but the user lacks ADMIN for <code>/admin</code>. Status?`,[`403`,`401`,`404`,`500`],0,`401 = not authenticated; 403 = authenticated but not allowed.`,'E'],
    [`Is a JWT's payload secret?`,[`Yes: it's encrypted with the signing key`,`Only the roles claim is encrypted`,`It depends on the token's expiry`,`No: it's only encoded and signed`],3,`Signing prevents tampering, not reading. Don't put secrets in a JWT.`,'M'],
    [`A user is banned, but their 24-hour JWT still works. Standard mitigation?`,[`Delete the user's HttpSession on the server`,`Short-lived access tokens plus refresh tokens`,`Call SecurityContextHolder.clearContext() on logout`,`Set the token's exp to now on the server`],1,`Stateless tokens can't be changed server-side; keep them short and revoke refresh tokens.`,'H'],
    [`Authentication vs authorisation?`,[`Authentication = what you may do; authorisation = who you are`,`Authentication = who you are; authorisation = what you may do`,`Authentication = the login form; authorisation = the session cookie`,`Authentication = for end users; authorisation = for services`],1,`401 vs 403.`,'E'],
    [`Where does a JWT usually travel?`,[`In the URL`,`In the Authorization: Bearer header`,`In the body of every request`,`In a server session`],1,`Sometimes in a cookie.`,'E'],
    [`What part of a JWT proves it wasn't tampered with?`,[`Header`,`Payload`,`Signature`,`Base64`],2,`Signed with a secret or private key.`,'E'],
    [`Where are passwords stored securely?`,[`Hashed once with fast SHA-256 so logins stay quick`,`Hashed with a slow, salted algorithm like bcrypt/argon2`,`Encrypted with AES using a key stored in the code`,`Base64-encoded with a salt so they can't be read`],1,`Spring Security's PasswordEncoder.`,'M'],
    [`@PreAuthorize("hasRole('ADMIN')") does what?`,[`Checks the role after the method runs, filtering its result`,`Checks the current user's role before the method runs`,`Grants the ADMIN role to the caller for that method`,`Restricts the URL mapped to the method in the filter chain`],1,`Method security (enable with @EnableMethodSecurity).`,'M'],
  ],
  quizAdv: [
    [`How do you defend against a JWT with <code>"alg": "none"</code>?`,[`Pin the algorithm; reject unsigned`,`Check the exp claim first`,`Base64-decode the token twice`,`Shorten the token's expiry`],0,`Never let the token choose its own verification algorithm.`,'H'],
    [`CSRF protection with JWTs sent in the Authorization header?`,[`Always required, as with sessions`,`Never needed with any JWT setup`,`Only needed for GET requests`,`Usually not needed with headers`],3,`Browsers attach cookies automatically, not Authorization headers.`,'H'],
    [`HS256 vs RS256 for JWT?`,[`HS256 signs with a private key; RS256 uses one shared secret`,`HS256 uses one shared secret; RS256 signs privately, verifies publicly`,`HS256 encrypts the payload; RS256 only signs the header`,`RS256 is unsigned and relies on TLS; HS256 signs the token`],1,`RS256 lets many services verify without the signing secret.`,'H'],
    [`Why store JWTs in HttpOnly cookies rather than localStorage in browsers?`,[`HttpOnly cookies are encrypted by the browser, so tokens can't leak`,`JavaScript (and XSS) can't read HttpOnly cookies; then add CSRF protection`,`Cookies are sent only over HTTPS, so CSRF is no longer possible`,`localStorage is cleared on every page reload, so tokens get lost`],1,`Trade-off between XSS and CSRF risk.`,'H'],
  ],
});
