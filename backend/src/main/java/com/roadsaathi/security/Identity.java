package com.roadsaathi.security;

import com.roadsaathi.common.ApiException;
import com.roadsaathi.user.User;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class Identity {
  public User optional() {
    var a = SecurityContextHolder.getContext().getAuthentication();
    return a != null && a.getPrincipal() instanceof User u ? u : null;
  }

  public User user() {
    var u = optional();
    if (u == null) throw new ApiException(401, "Please sign in to continue");
    return u;
  }

  public User staff() {
    var u = user();
    if (!u.staff()) throw ApiException.forbidden();
    return u;
  }

  public User admin() {
    var u = user();
    if (!u.admin()) throw ApiException.forbidden();
    return u;
  }
}
