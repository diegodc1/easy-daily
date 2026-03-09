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

    @PostMapping("/pre-daily")
    public ResponseEntity<PreDailyResponse> savePreDaily(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PreDailyRequest req) {
        return ResponseEntity.ok(dailyService.saveOrUpdatePreDaily(user, req));
    }

    @GetMapping("/pre-daily")
    public ResponseEntity<PreDailyResponse> getPreDaily(
            @AuthenticationPrincipal User user) {
        return dailyService.getPreDailyByUser(user)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/pre-daily/date/{date}")
    public ResponseEntity<PreDailyResponse> getPreDailyByDate(
            @AuthenticationPrincipal User user,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dailyService.getPreDailyByUser(user)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.noContent().build());
    }

    @DeleteMapping("/pre-daily")
    public ResponseEntity<Void> deletePreDaily(
            @AuthenticationPrincipal User user) {
        return dailyService.deletePreDailyByUser(user)
            ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/pre-daily/date/{date}")
    public ResponseEntity<Void> deletePreDailyByDate(
            @AuthenticationPrincipal User user,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dailyService.deletePreDailyByUser(user)
            ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
    }

    @GetMapping("/notes")
    public ResponseEntity<List<GeneralNoteResponse>> listGeneralNotes(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(dailyService.listGeneralNotes(user));
    }

    @PostMapping("/notes")
    public ResponseEntity<GeneralNoteResponse> createGeneralNote(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody GeneralNoteRequest req) {
        return ResponseEntity.ok(dailyService.createGeneralNote(user, req));
    }

    @PutMapping("/notes/{id}")
    public ResponseEntity<GeneralNoteResponse> updateGeneralNote(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody GeneralNoteRequest req) {
        return ResponseEntity.ok(dailyService.updateGeneralNote(user, id, req));
    }

    @PatchMapping("/notes/{id}/finished")
    public ResponseEntity<GeneralNoteResponse> setGeneralNoteFinished(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody GeneralNoteFinishRequest req) {
        return ResponseEntity.ok(dailyService.setGeneralNoteFinished(user, id, req.getFinished()));
    }

    @DeleteMapping("/notes/{id}")
    public ResponseEntity<Void> deleteGeneralNote(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        return dailyService.deleteGeneralNote(user, id)
            ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
    }

    @PostMapping("/edit-requests")
    public ResponseEntity<DailyEditRequestResponse> requestEditPermission(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody DailyEditRequestCreate req) {
        return ResponseEntity.ok(dailyService.requestEditPermission(user, req));
    }

    // Public endpoint so the frontend can load projects without admin token
    @GetMapping("/projects")
    public ResponseEntity<List<ProjectResponse>> getActiveProjects() {
        return ResponseEntity.ok(dailyService.listProjects(true));
    }

    @GetMapping("/projects/preferences")
    public ResponseEntity<UserProjectPreferencesResponse> getProjectPreferences(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(dailyService.getProjectPreferences(user));
    }

    @PutMapping("/projects/preferences")
    public ResponseEntity<UserProjectPreferencesResponse> saveProjectPreferences(
            @AuthenticationPrincipal User user,
            @RequestBody UserProjectPreferencesRequest req) {
        return ResponseEntity.ok(dailyService.saveProjectPreferences(user, req));
    }

    // Backward-compatible endpoint for clients using /daily/projects as preferences save path
    @PutMapping("/projects")
    public ResponseEntity<UserProjectPreferencesResponse> saveProjectPreferencesLegacy(
            @AuthenticationPrincipal User user,
            @RequestBody UserProjectPreferencesRequest req) {
        return ResponseEntity.ok(dailyService.saveProjectPreferences(user, req));
    }
}
