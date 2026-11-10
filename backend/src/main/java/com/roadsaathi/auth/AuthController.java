package com.roadsaathi.auth;

import com.roadsaathi.security.*;
import com.roadsaathi.user.User;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService auth;
  private final Identity identity;
  private final boolean secure;

  public AuthController(
      AuthService auth, Identity identity, @Value("${roadsaathi.cookie-secure}") boolean secure) {
    this.auth = auth;
    this.identity = identity;
    this.secure = secure;
  }

  record Registration(
      @NotBlank @Size(max = 100) String name,
      @Email @NotBlank @Size(max = 254) String email,
      @NotBlank @Size(min = 10, max = 72) String password) {}

  record Login(
      @Email @NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {}

  record EmailRequest(@Email @NotBlank String email) {}

  record Reset(@NotBlank String token, @NotBlank @Size(min = 10, max = 72) String password) {}

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  User.View register(@Valid @RequestBody Registration req, HttpServletResponse response) {
    return set(auth.register(req.name, req.email, req.password), response);
  }

  @PostMapping("/login")
  User.View login(@Valid @RequestBody Login req, HttpServletResponse response) {
    return set(auth.login(req.email, req.password), response);
  }

  @PostMapping("/refresh")
  User.View refresh(HttpServletRequest request, HttpServletResponse response) {
    return set(auth.refresh(SecurityConfig.cookie(request, "rs_refresh")), response);
  }

  @PostMapping("/logout")
  Map<String, Boolean> logout(HttpServletRequest request, HttpServletResponse response) {
    auth.logout(SecurityConfig.cookie(request, "rs_refresh"));
    cookies(response, "", "", 0, 0);
    return Map.of("success", true);
  }

  @GetMapping("/me")
  User.View me() {
    return identity.user().view();
  }

  @PostMapping("/forgot-password")
  Map<String, String> forgot(@Valid @RequestBody EmailRequest req) {
    auth.forgot(req.email);
    return Map.of("message", "If the account exists, a reset email has been sent.");
  }

  @PostMapping("/reset-password")
  Map<String, String> reset(@Valid @RequestBody Reset req) {
    auth.reset(req.token, req.password);
    return Map.of("message", "Password updated. Sign in with your new password.");
  }

  private User.View set(AuthService.Session session, HttpServletResponse response) {
    cookies(response, session.access(), session.refresh(), 900, 2592000);
    return session.user();
  }

  private void cookies(
      HttpServletResponse response, String access, String refresh, int accessAge, int refreshAge) {
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("rs_access", access)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path("/")
            .maxAge(accessAge)
            .build()
            .toString());
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("rs_refresh", refresh)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path("/api/v1/auth")
            .maxAge(refreshAge)
            .build()
            .toString());
  }
}
