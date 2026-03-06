package com.daily.controller;

import com.daily.config.JwtUtil;
import com.daily.dto.DailyDTO.*;
import com.daily.entity.User;
import com.daily.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        return userRepository.findByUsername(req.getUsername())
            .filter(u -> u.isActive() && passwordEncoder.matches(req.getPassword(), u.getPassword()))
            .map(u -> ResponseEntity.ok(new LoginResponse(
                jwtUtil.generateToken(u.getUsername()),
                u.getUsername(), u.getFullName(), u.getRole().name()
            )))
            .orElse(ResponseEntity.status(401).build());
    }
}
