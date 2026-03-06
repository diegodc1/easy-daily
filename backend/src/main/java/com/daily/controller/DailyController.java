package com.daily.controller;

import com.daily.dto.DailyDTO.*;
import com.daily.entity.User;
import com.daily.service.DailyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/daily")
@RequiredArgsConstructor
public class DailyController {

    private final DailyService dailyService;

    @PostMapping
    public ResponseEntity<DailyResponse> save(@AuthenticationPrincipal User user,
                                               @Valid @RequestBody DailyRequest req) {
        return ResponseEntity.ok(dailyService.saveOrUpdate(user, req));
    }

    @GetMapping("/date/{date}")
    public ResponseEntity<DailyResponse> getByDate(
            @AuthenticationPrincipal User user,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dailyService.getByUserAndDate(user, date)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/history")
    public ResponseEntity<List<DailyResponse>> getHistory(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(dailyService.getMyHistory(user));
    }

    // Public endpoint so the frontend can load projects without admin token
    @GetMapping("/projects")
    public ResponseEntity<List<ProjectResponse>> getActiveProjects() {
        return ResponseEntity.ok(dailyService.listProjects(true));
    }
}
