package com.daily.controller;

import com.daily.dto.DailyDTO.*;
import com.daily.entity.User;
import com.daily.repository.UserRepository;
import com.daily.service.DailyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final DailyService    dailyService;
    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    // ── Dailies ──────────────────────────────────────────────────
    @GetMapping("/dailies")
    public ResponseEntity<List<DailyByDateResponse>> getAllDailies(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        if (start == null) start = LocalDate.now().minusDays(14);
        if (end   == null) end   = LocalDate.now();
        return ResponseEntity.ok(dailyService.getAllGroupedByDate(start, end));
    }

    @GetMapping("/pending")
    public ResponseEntity<PendingResponse> getPending(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        if (date == null) date = LocalDate.now();
        return ResponseEntity.ok(dailyService.getPendingForDate(date));
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) throws Exception {
        if (start == null) start = LocalDate.now().minusDays(14);
        if (end   == null) end   = LocalDate.now();
        String csv   = dailyService.exportToCsv(start, end);
        byte[] bytes = ("\uFEFF" + csv).getBytes("UTF-8");
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"dailies_" + start + "_" + end + ".csv\"")
            .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
            .body(bytes);
    }

    // ── Projects ─────────────────────────────────────────────────
    @GetMapping("/projects")
    public ResponseEntity<List<ProjectResponse>> getProjects(
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(dailyService.listProjects(activeOnly));
    }

    @PostMapping("/projects")
    public ResponseEntity<ProjectResponse> createProject(@Valid @RequestBody ProjectRequest req) {
        return ResponseEntity.ok(dailyService.createProject(req));
    }

    @PutMapping("/projects/{id}")
    public ResponseEntity<ProjectResponse> updateProject(@PathVariable Long id, @Valid @RequestBody ProjectRequest req) {
        return dailyService.updateProject(id, req)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/projects/{id}/toggle")
    public ResponseEntity<Void> toggleProject(@PathVariable Long id) {
        return dailyService.toggleProject(id) ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    // ── Users ─────────────────────────────────────────────────────
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getUsers() {
        return ResponseEntity.ok(userRepository.findAll().stream()
            .map(dailyService::toUserResponse).collect(Collectors.toList()));
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserRequest req) {
        if (userRepository.existsByUsername(req.getUsername()))
            return ResponseEntity.badRequest().build();
        User u = new User();
        u.setUsername(req.getUsername());
        u.setPassword(passwordEncoder.encode(req.getPassword()));
        u.setFullName(req.getFullName());
        u.setEmail(req.getEmail());
        u.setRole(req.getRole() != null ? req.getRole() : User.Role.MEMBER);
        return ResponseEntity.ok(dailyService.toUserResponse(userRepository.save(u)));
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id, @RequestBody UserRequest req) {
        return userRepository.findById(id).map(u -> {
            u.setFullName(req.getFullName());
            u.setEmail(req.getEmail());
            if (req.getRole() != null) u.setRole(req.getRole());
            if (req.getPassword() != null && !req.getPassword().isBlank())
                u.setPassword(passwordEncoder.encode(req.getPassword()));
            return ResponseEntity.ok(dailyService.toUserResponse(userRepository.save(u)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deactivateUser(@PathVariable Long id) {
        return userRepository.findById(id).map(u -> {
            u.setActive(false); userRepository.save(u);
            return ResponseEntity.ok().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
