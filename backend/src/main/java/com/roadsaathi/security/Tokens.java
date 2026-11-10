package com.roadsaathi.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

@Component
public class Tokens {
  private final JwtEncoder encoder;
  private final JwtDecoder decoder;

  public Tokens(@Value("${roadsaathi.jwt-secret}") String secret) {
    if (secret.length() < 48)
      throw new IllegalStateException("JWT_SECRET must contain at least 48 random characters");
    var key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
    var d = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    d.setJwtValidator(JwtValidators.createDefaultWithIssuer("roadsaathi"));
    decoder = d;
  }

  public String access(UUID user, UUID session) {
    var claims =
        JwtClaimsSet.builder()
            .issuer("roadsaathi")
            .subject(user.toString())
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(900))
            .claim("sid", session.toString())
            .build();
    return encoder
        .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }

  public Jwt decode(String token) {
    return decoder.decode(token);
  }

  public static String random() {
    byte[] b = new byte[48];
    new SecureRandom().nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  public static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
