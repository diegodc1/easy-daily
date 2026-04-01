package com.daily.service;

import com.daily.dto.DailyDTO.DailyResponse;
import com.daily.dto.DailyDTO.MeetingParticipantResponse;
import com.daily.dto.DailyDTO.MeetingSessionResponse;
import com.daily.dto.DailyDTO.ProjectTimeResponse;
import com.daily.dto.DailyDTO.TaskResponse;
import com.daily.dto.DailyDTO.UserResponse;
import com.daily.entity.Daily;
import com.daily.entity.DailyTask;
import com.daily.entity.User;
import com.daily.repository.DailyRepository;
import com.daily.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MeetingService {

    private final DailyRepository dailyRepository;
    private final UserRepository userRepository;
    private final Map<LocalDate, MeetingSessionState> sessionsByDate = new ConcurrentHashMap<>();

    public MeetingSessionResponse getState(User user, LocalDate date) {
        ensureCanAccessMeeting(user);
        MeetingSessionState state = sessionsByDate.get(date);
        if (state == null) {
            List<MeetingParticipantSnapshot> snapshots = buildSnapshots(date);
            return toResponse(user, date, SessionStatus.IDLE, OrderMode.RANDOM, null, Collections.emptySet(), snapshots, LocalDateTime.now());
        }
        return toResponse(user, date, state.status, state.orderMode, state.currentSpeakerUserId, state.spokenUserIds, state.participants, state.updatedAt);
    }

    public MeetingSessionResponse start(User admin, LocalDate date) {
        return start(admin, date, true);
    }

    public MeetingSessionResponse start(User admin, LocalDate date, boolean randomize) {
        requireMeetingController(admin);
        List<MeetingParticipantSnapshot> participants = buildSnapshots(date);
        if (participants.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nao ha membros ativos para iniciar a reuniao.");
        }

        List<Long> speakerOrder = participants.stream()
            .filter(p -> p.daily != null)
            .map(p -> p.user.getId())
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        if (speakerOrder.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nenhuma daily enviada na data selecionada para sorteio.");
        }
        Map<Long, Integer> orderByUserId = new LinkedHashMap<>();
        if (!randomize) {
            for (int i = 0; i < speakerOrder.size(); i++) {
                orderByUserId.put(speakerOrder.get(i), i + 1);
            }
        }
        for (MeetingParticipantSnapshot p : participants) {
            Integer order = p.user != null ? orderByUserId.get(p.user.getId()) : null;
            p.orderIndex = order;
        }

        MeetingSessionState state = new MeetingSessionState();
        state.date = date;
        state.status = SessionStatus.IN_PROGRESS;
        state.orderMode = randomize ? OrderMode.RANDOM : OrderMode.ORDERED;
        state.speakerOrder = speakerOrder;
        state.spokenUserIds = new HashSet<>();
        state.participants = participants;
        if (randomize) {
            int firstIdx = ThreadLocalRandom.current().nextInt(speakerOrder.size());
            state.currentSpeakerUserId = speakerOrder.get(firstIdx);
            assignOrderIndexIfMissing(state, state.currentSpeakerUserId);
        } else {
            state.currentSpeakerUserId = speakerOrder.get(0);
            assignOrderIndexIfMissing(state, state.currentSpeakerUserId);
        }
        state.updatedAt = LocalDateTime.now();
        sessionsByDate.put(date, state);

        return toResponse(admin, date, state.status, state.orderMode, state.currentSpeakerUserId, state.spokenUserIds, state.participants, state.updatedAt);
    }

    public MeetingSessionResponse next(User admin, LocalDate date) {
        return next(admin, date, null);
    }

    public MeetingSessionResponse next(User admin, LocalDate date, Boolean randomizeOverride) {
        requireMeetingController(admin);
        MeetingSessionState state = requireRunningSession(date);
        if (randomizeOverride != null) {
            state.orderMode = randomizeOverride ? OrderMode.RANDOM : OrderMode.ORDERED;
        }
        advanceTurn(state);
        return toResponse(admin, date, state.status, state.orderMode, state.currentSpeakerUserId, state.spokenUserIds, state.participants, state.updatedAt);
    }

    public MeetingSessionResponse finishTurn(User user, LocalDate date) {
        ensureCanAccessMeeting(user);
        MeetingSessionState state = requireRunningSession(date);
        Long currentId = state.currentSpeakerUserId;
        boolean isController = isMeetingController(user);
        boolean isCurrentSpeaker = user != null && currentId != null && Objects.equals(user.getId(), currentId);
        if (!isController && !isCurrentSpeaker) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o usuario da vez, admin ou sistema pode encerrar esta vez.");
        }

        advanceTurn(state);
        return toResponse(user, date, state.status, state.orderMode, state.currentSpeakerUserId, state.spokenUserIds, state.participants, state.updatedAt);
    }

    public MeetingSessionResponse reset(User admin, LocalDate date) {
        requireMeetingController(admin);
        sessionsByDate.remove(date);
        return getState(admin, date);
    }

    public boolean isMeetingFinished(LocalDate date) {
        MeetingSessionState state = sessionsByDate.get(date);
        return state != null && state.status == SessionStatus.FINISHED;
    }

    private void advanceTurn(MeetingSessionState state) {
        if (state.currentSpeakerUserId != null) {
            state.spokenUserIds.add(state.currentSpeakerUserId);
        }

        Long nextSpeakerId = null;
        if (state.orderMode == OrderMode.RANDOM) {
            List<Long> remaining = state.speakerOrder.stream()
                .filter(userId -> !state.spokenUserIds.contains(userId))
                .collect(Collectors.toList());
            if (!remaining.isEmpty()) {
                int pick = ThreadLocalRandom.current().nextInt(remaining.size());
                nextSpeakerId = remaining.get(pick);
            }
        } else {
            for (Long userId : state.speakerOrder) {
                if (!state.spokenUserIds.contains(userId)) {
                    nextSpeakerId = userId;
                    break;
                }
            }
        }

        state.currentSpeakerUserId = nextSpeakerId;
        assignOrderIndexIfMissing(state, nextSpeakerId);
        state.status = nextSpeakerId == null ? SessionStatus.FINISHED : SessionStatus.IN_PROGRESS;
        state.updatedAt = LocalDateTime.now();
    }

    private void assignOrderIndexIfMissing(MeetingSessionState state, Long userId) {
        if (userId == null) return;
        int maxOrder = state.participants.stream()
            .map(p -> p.orderIndex)
            .filter(Objects::nonNull)
            .max(Integer::compareTo)
            .orElse(0);
        for (MeetingParticipantSnapshot participant : state.participants) {
            if (participant.user != null && Objects.equals(participant.user.getId(), userId)) {
                if (participant.orderIndex == null) {
                    participant.orderIndex = maxOrder + 1;
                }
                return;
            }
        }
    }

    private MeetingSessionState requireRunningSession(LocalDate date) {
        MeetingSessionState state = sessionsByDate.get(date);
        if (state == null || state.status == SessionStatus.IDLE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A reuniao nao foi iniciada para esta data.");
        }
        if (state.status == SessionStatus.FINISHED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A reuniao desta data ja foi finalizada.");
        }
        return state;
    }

    private boolean isMeetingController(User user) {
        return user != null && (user.getRole() == User.Role.ADMIN || user.getRole() == User.Role.SISTEMA);
    }

    private void requireMeetingController(User user) {
        if (!isMeetingController(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apenas admin ou sistema pode controlar a reuniao.");
        }
    }

    private void ensureCanAccessMeeting(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Usuario nao autenticado.");
        }
    }

    private List<MeetingParticipantSnapshot> buildSnapshots(LocalDate date) {
        Map<Long, Daily> dailyByUserId = dailyRepository.findByDateWithDetails(date).stream()
            .filter(d -> d.getUser() != null && d.getUser().getId() != null)
            .collect(Collectors.toMap(d -> d.getUser().getId(), d -> d, (a, b) -> a, LinkedHashMap::new));

        return userRepository.findByActiveTrue().stream()
            .filter(u -> u.getRole() == User.Role.MEMBER || u.getRole() == User.Role.ADMIN)
            .sorted(Comparator.comparing(User::getFullName, String.CASE_INSENSITIVE_ORDER))
            .map(u -> {
                MeetingParticipantSnapshot snapshot = new MeetingParticipantSnapshot();
                snapshot.user = toUserResponse(u);
                Daily daily = dailyByUserId.get(u.getId());
                snapshot.daily = daily != null ? toDailyResponse(daily) : null;
                snapshot.orderIndex = null;
                return snapshot;
            })
            .collect(Collectors.toCollection(ArrayList::new));
    }

    private UserResponse toUserResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setFullName(user.getFullName());
        response.setEmail(user.getEmail());
        response.setBitrixId(user.getBitrixId());
        response.setRole(user.getRole().name());
        response.setActive(user.isActive());
        return response;
    }

    private DailyResponse toDailyResponse(Daily daily) {
        DailyResponse response = new DailyResponse();
        response.setId(daily.getId());
        response.setDailyDate(daily.getDailyDate());

        String doneYesterday = (daily.getTasks() != null && !daily.getTasks().isEmpty())
            ? formatTasksAsDoneYesterday(daily.getTasks())
            : daily.getDoneYesterday();

        response.setDoneYesterday(doneYesterday);
        response.setDoingToday(daily.getDoingToday());
        response.setBlockers(daily.getBlockers());
        response.setHasBlocker(daily.isHasBlocker());
        response.setProtocolFA(daily.getProtocolFA());
        response.setProtocolIMP(daily.getProtocolIMP());
        response.setProtocolDE(daily.getProtocolDE());
        response.setProtocolDI(daily.getProtocolDI());
        response.setProtocolCO(daily.getProtocolCO());
        response.setTotalProtocols(daily.totalProtocols());
        if (daily.getCreatedAt() != null) {
            response.setCreatedAt(daily.getCreatedAt().toString());
        }
        if (daily.getUpdatedAt() != null) {
            response.setUpdatedAt(daily.getUpdatedAt().toString());
        }
        response.setUser(toUserResponse(daily.getUser()));

        if (daily.getProjectTimes() != null) {
            response.setProjectTimes(daily.getProjectTimes().stream().map(projectTime -> {
                ProjectTimeResponse projectTimeResponse = new ProjectTimeResponse();
                projectTimeResponse.setId(projectTime.getId());
                projectTimeResponse.setProjectName(projectTime.getProjectName());
                projectTimeResponse.setPercentSpent(projectTime.getPercentSpent());
                return projectTimeResponse;
            }).collect(Collectors.toList()));
        }

        if (daily.getTasks() != null) {
            response.setTasks(daily.getTasks().stream().map(task -> {
                TaskResponse taskResponse = new TaskResponse();
                taskResponse.setId(task.getId());
                taskResponse.setProjectName(task.getProjectName());
                taskResponse.setDescription(task.getDescription());
                taskResponse.setHoursSpent(task.getHoursSpent());
                return taskResponse;
            }).collect(Collectors.toList()));
        }

        return response;
    }

    private String formatTasksAsDoneYesterday(List<DailyTask> tasks) {
        return tasks.stream()
            .filter(task -> task.getProjectName() != null && task.getDescription() != null)
            .map(task -> "- [" + task.getProjectName() + "] " + task.getDescription() + " (" + formatHours(task.getHoursSpent()) + ")")
            .collect(Collectors.joining("\n"));
    }

    private String formatHours(Double hours) {
        double safeHours = hours != null ? Math.max(hours, 0.0) : 0.0;
        int totalMinutes = (int) Math.round(safeHours * 60.0);
        int hh = totalMinutes / 60;
        int mm = totalMinutes % 60;
        return String.format("%02d:%02d", hh, mm);
    }

    private MeetingSessionResponse toResponse(
        User user,
        LocalDate date,
        SessionStatus status,
        OrderMode orderMode,
        Long currentSpeakerUserId,
        Set<Long> spokenUserIds,
        List<MeetingParticipantSnapshot> participants,
        LocalDateTime updatedAt
    ) {
        MeetingSessionResponse response = new MeetingSessionResponse();
        response.setDate(date);
        response.setStatus(status.name());
        response.setOrderMode((orderMode != null ? orderMode : OrderMode.RANDOM).name());
        response.setCurrentSpeakerUserId(currentSpeakerUserId);
        response.setTotalParticipants(participants.size());
        response.setSpokenCount((int) participants.stream()
            .map(p -> p.user != null ? p.user.getId() : null)
            .filter(Objects::nonNull)
            .filter(spokenUserIds::contains)
            .count());
        boolean canControl = isMeetingController(user);
        boolean canFinish = status == SessionStatus.IN_PROGRESS &&
            user != null &&
            (canControl || Objects.equals(user.getId(), currentSpeakerUserId));
        response.setCanControl(canControl);
        response.setCanFinishCurrentTurn(canFinish);
        response.setUpdatedAt(updatedAt != null ? updatedAt.toString() : null);

        List<MeetingParticipantResponse> list = new ArrayList<>();
        for (MeetingParticipantSnapshot p : participants) {
            MeetingParticipantResponse item = new MeetingParticipantResponse();
            item.setUser(p.user);
            item.setDaily(p.daily);
            Long id = p.user != null ? p.user.getId() : null;
            item.setSpoke(id != null && spokenUserIds.contains(id));
            item.setOrderIndex(p.orderIndex);
            list.add(item);
        }
        response.setParticipants(list);
        return response;
    }

    private enum SessionStatus {
        IDLE,
        IN_PROGRESS,
        FINISHED
    }

    private enum OrderMode {
        RANDOM,
        ORDERED
    }

    private static class MeetingSessionState {
        private LocalDate date;
        private SessionStatus status = SessionStatus.IDLE;
        private OrderMode orderMode = OrderMode.RANDOM;
        private List<Long> speakerOrder = new ArrayList<>();
        private Set<Long> spokenUserIds = new HashSet<>();
        private Long currentSpeakerUserId;
        private List<MeetingParticipantSnapshot> participants = new ArrayList<>();
        private LocalDateTime updatedAt;
    }

    private static class MeetingParticipantSnapshot {
        private UserResponse user;
        private DailyResponse daily;
        private Integer orderIndex;
    }

}
