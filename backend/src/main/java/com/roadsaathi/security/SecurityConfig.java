package com.roadsaathi.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.roadsaathi.common.Db;
import com.roadsaathi.user.UserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain chain(
      HttpSecurity http,
      Tokens tokens,
      UserRepository users,
      Db db,
      ObjectMapper json,
      @Value("${roadsaathi.allowed-origins}") String origins)
      throws Exception {
    Set<String> allowed = new HashSet<>(Arrays.asList(origins.split(",")));
    var cors = new CorsConfiguration();
    cors.setAllowedOrigins(new ArrayList<>(allowed));
    cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    cors.setAllowedHeaders(List.of("Content-Type", "X-Roadsaathi", "Idempotency-Key"));
    cors.setAllowCredentials(true);
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cors);
    return http.cors(c -> c.configurationSource(source))
        .csrf(c -> c.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/api/v1/auth/**",
                        "/api/v1/config",
                        "/actuator/health",
                        "/actuator/health/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/v3/api-docs/**")
                    .permitAll()
                    .requestMatchers(
                        org.springframework.http.HttpMethod.GET,
                        "/api/v1/reports/**",
                        "/api/v1/evidence/**",
                        "/api/v1/analytics/public-summary",
                        "/api/v1/rewards/leaderboard",
                        "/api/v1/hazards/**")
                    .permitAll()
                    .requestMatchers("/api/v1/admin/**")
                    .hasRole("SUPER_ADMIN")
                    .requestMatchers("/api/v1/municipal/**", "/api/v1/analytics/**")
                    .hasAnyRole("MUNICIPAL_OFFICER", "SUPER_ADMIN")
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (q, s, x) -> error(s, json, 401, "Please sign in to continue"))
                    .accessDeniedHandler(
                        (q, s, x) ->
                            error(s, json, 403, "You do not have permission for this action")))
        .addFilterBefore(
            new OncePerRequestFilter() {
              record Window(long start, int count) {}

              final Map<String, Window> attempts = new ConcurrentHashMap<>();

              @Override
              protected void doFilterInternal(
                  HttpServletRequest q, HttpServletResponse s, FilterChain chain)
                  throws ServletException, IOException {
                boolean write = !Set.of("GET", "HEAD", "OPTIONS").contains(q.getMethod());
                if (write
                    && (!"1".equals(q.getHeader("X-Roadsaathi"))
                        || (q.getHeader("Origin") != null
                            && !allowed.contains(q.getHeader("Origin"))))) {
                  error(s, json, 403, "Request origin could not be verified");
                  return;
                }
                if (write
                    && (q.getRequestURI().startsWith("/api/v1/auth/")
                        || q.getRequestURI().startsWith("/api/v1/ai/"))) {
                  long now = System.currentTimeMillis();
                  if (attempts.size() > 10000)
                    attempts.entrySet().removeIf(e -> now - e.getValue().start() > 60000);
                  String key =
                      q.getRemoteAddr()
                          + ":"
                          + (q.getRequestURI().startsWith("/api/v1/ai/") ? "ai" : "auth");
                  var w =
                      attempts.compute(
                          key,
                          (k, v) ->
                              v == null || now - v.start() > 60000
                                  ? new Window(now, 1)
                                  : new Window(v.start(), v.count() + 1));
                  if (w.count() > 30) {
                    s.setHeader("Retry-After", "60");
                    error(s, json, 429, "Too many requests. Try again in a minute.");
                    return;
                  }
                }
                String token = cookie(q, "rs_access");
                if (token != null)
                  try {
                    var jwt = tokens.decode(token);
                    UUID uid = UUID.fromString(jwt.getSubject()),
                        sid = UUID.fromString(jwt.getClaimAsString("sid"));
                    if (db.count(
                            "SELECT count(*) FROM refresh_sessions WHERE id=:s AND user_id=:u AND"
                                + " NOT revoked AND expires_at>now()",
                            Map.of("s", sid, "u", uid))
                        > 0)
                      users
                          .findById(uid)
                          .filter(u -> u.active)
                          .ifPresent(
                              u ->
                                  SecurityContextHolder.getContext()
                                      .setAuthentication(
                                          new UsernamePasswordAuthenticationToken(
                                              u,
                                              null,
                                              List.of(
                                                  new SimpleGrantedAuthority("ROLE_" + u.role)))));
                  } catch (org.springframework.security.oauth2.jwt.JwtException
                      | IllegalArgumentException ignored) {
                    /* Expired cookies are handled by the refresh endpoint. */
                  }
                chain.doFilter(q, s);
              }
            },
            UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  public static String cookie(HttpServletRequest q, String name) {
    if (q.getCookies() != null)
      for (var c : q.getCookies()) if (c.getName().equals(name)) return c.getValue();
    return null;
  }

  private static void error(HttpServletResponse s, ObjectMapper json, int status, String message)
      throws IOException {
    s.setStatus(status);
    s.setContentType("application/json");
    json.writeValue(
        s.getOutputStream(),
        Map.of(
            "timestamp",
            Instant.now().toString(),
            "status",
            status,
            "message",
            message,
            "error",
            "AUTHORIZATION_ERROR"));
  }
}
