package com.daily.service;

import com.daily.dto.DailyDTO.*;
import com.daily.entity.*;
import com.daily.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.StringWriter;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class DailyService {
    private final DailyRepository   dailyRepository;
    private final UserRepository    userRepository;
    private final ProjectRepository projectRepository;
    private final DailyEditRequestRepository dailyEditRequestRepository;
    private final PreDailyRepository preDailyRepository;
    private final GeneralNoteRepository generalNoteRepository;

    @Transactional
    public DailyResponse saveOrUpdate(User user, DailyRequest req) {
        Daily daily = dailyRepository.findByUserAndDailyDate(user, req.getDailyDate()).orElse(null);
        boolean updatingExisting = daily != null;

        if (!updatingExisting) {
            daily = new Daily();
        } else if (user.getRole() != User.Role.ADMIN) {
            DailyEditRequest approval = dailyEditRequestRepository
                .findFirstByDailyAndRequestedByAndStatusAndUsedAtIsNullOrderByReviewedAtDescCreatedAtDesc(
                    daily, user, DailyEditRequest.Status.APPROVED
                )
                .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Voce precisa de aprovacao do admin para alterar essa daily."
                ));
            approval.setUsedAt(LocalDateTime.now());
            dailyEditRequestRepository.save(approval);
        }

        daily.setUser(user);
        daily.setDailyDate(req.getDailyDate());
        daily.setDoneYesterday(req.getDoneYesterday());
        daily.setDoingToday(req.getDoingToday());
        daily.setBlockers(req.getBlockers());
        daily.setHasBlocker(req.isHasBlocker());
        daily.setProtocolFA( req.getProtocolFA()  != null ? req.getProtocolFA()  : 0);
        daily.setProtocolIMP(req.getProtocolIMP() != null ? req.getProtocolIMP() : 0);
        daily.setProtocolDE( req.getProtocolDE()  != null ? req.getProtocolDE()  : 0);
        daily.setProtocolDI( req.getProtocolDI()  != null ? req.getProtocolDI()  : 0);
        daily.setProtocolCO( req.getProtocolCO()  != null ? req.getProtocolCO()  : 0);
        daily.getProjectTimes().clear();
        if (req.getProjectTimes() != null) {
            for (ProjectTimeRequest ptr : req.getProjectTimes()) {
                ProjectTime pt = new ProjectTime();
                pt.setDaily(daily); pt.setProjectName(ptr.getProjectName());
                pt.setPercentSpent(ptr.getPercentSpent() != null ? ptr.getPercentSpent() : 0.0);
                daily.getProjectTimes().add(pt);
            }
        }
        daily.getTasks().clear();
        if (req.getTasks() != null) {
            for (TaskRequest tr : req.getTasks()) {
                DailyTask task = new DailyTask();
                task.setDaily(daily);
                task.setProjectName(tr.getProjectName());
                task.setDescription(tr.getDescription());
                task.setHoursSpent(tr.getHoursSpent() != null ? tr.getHoursSpent() : 0.0);
                daily.getTasks().add(task);
            }
        }
        if (daily.getTasks() != null && !daily.getTasks().isEmpty()) {
            daily.setDoneYesterday(formatTasksAsDoneYesterday(daily.getTasks()));
        } else {
            daily.setDoneYesterday(req.getDoneYesterday());
        }
        return toResponse(dailyRepository.save(daily));
    }

    public Optional<DailyResponse> getByUserAndDate(User user, LocalDate date) {
        return dailyRepository.findByUserAndDailyDate(user, date).map(d -> {
            DailyResponse response = toResponse(d);
            applyEditPermission(response, user, d);
            return response;
        });
    }

    @Transactional
    public PreDailyResponse saveOrUpdatePreDaily(User user, PreDailyRequest req) {
        PreDaily preDaily = preDailyRepository.findFirstByUserOrderByUpdatedAtDesc(user).orElse(null);
        if (preDaily == null) {
            preDaily = new PreDaily();
            preDaily.setDailyDate(req.getDailyDate() != null ? req.getDailyDate() : LocalDate.now());
        }

        preDaily.setUser(user);
        if (req.getDailyDate() != null) {
            preDaily.setDailyDate(req.getDailyDate());
        } else if (preDaily.getDailyDate() == null) {
            preDaily.setDailyDate(LocalDate.now());
        }
        preDaily.getTasks().clear();

        if (req.getTasks() != null) {
            for (PreDailyTaskRequest tr : req.getTasks()) {
                PreDailyTask task = new PreDailyTask();
                task.setPreDaily(preDaily);
                task.setProjectName(tr.getProjectName());
                task.setDescription(tr.getDescription());
                preDaily.getTasks().add(task);
            }
        }

        return toPreDailyResponse(preDailyRepository.save(preDaily));
    }

    public Optional<PreDailyResponse> getPreDailyByUserAndDate(User user, LocalDate date) {
        return preDailyRepository.findFirstByUserOrderByUpdatedAtDesc(user).map(this::toPreDailyResponse);
    }

    @Transactional
    public boolean deletePreDailyByUserAndDate(User user, LocalDate date) {
        return preDailyRepository.deleteByUser(user) > 0;
    }

    public Optional<PreDailyResponse> getPreDailyByUser(User user) {
        return preDailyRepository.findFirstByUserOrderByUpdatedAtDesc(user).map(this::toPreDailyResponse);
    }

    @Transactional
    public boolean deletePreDailyByUser(User user) {
        return preDailyRepository.deleteByUser(user) > 0;
    }

    public List<GeneralNoteResponse> listGeneralNotes(User user) {
        return generalNoteRepository.findByUserOrderByUpdatedAtDescCreatedAtDesc(user).stream()
            .map(this::toGeneralNoteResponse)
            .collect(Collectors.toList());
    }

    @Transactional
    public GeneralNoteResponse createGeneralNote(User user, GeneralNoteRequest req) {
        GeneralNote note = new GeneralNote();
        note.setUser(user);
        note.setProjectName(normalizeProjectName(req.getProjectName()));
        note.setProtocol(cleanProtocol(req.getProtocol()));
        note.setTitle(cleanTitle(req.getTitle()));
        note.setNoteText(req.getNoteText().trim());
        return toGeneralNoteResponse(generalNoteRepository.save(note));
    }

    @Transactional
    public GeneralNoteResponse updateGeneralNote(User user, Long id, GeneralNoteRequest req) {
        GeneralNote note = generalNoteRepository.findByIdAndUser(id, user)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Anotacao nao encontrada."));
        note.setProjectName(normalizeProjectName(req.getProjectName()));
        note.setProtocol(cleanProtocol(req.getProtocol()));
        note.setTitle(cleanTitle(req.getTitle()));
        note.setNoteText(req.getNoteText().trim());
        return toGeneralNoteResponse(generalNoteRepository.save(note));
    }

    @Transactional
    public GeneralNoteResponse setGeneralNoteFinished(User user, Long id, boolean finished) {
        GeneralNote note = generalNoteRepository.findByIdAndUser(id, user)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Anotacao nao encontrada."));
        note.setFinished(finished);
        return toGeneralNoteResponse(generalNoteRepository.save(note));
    }

    @Transactional
    public boolean deleteGeneralNote(User user, Long id) {
        Optional<GeneralNote> note = generalNoteRepository.findByIdAndUser(id, user);
        if (note.isEmpty()) return false;
        generalNoteRepository.delete(note.get());
        return true;
    }

    public List<DailyResponse> getMyHistory(User user) {
        return dailyRepository.findByUserOrderByDailyDateDesc(user).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<DailyByDateResponse> getAllGroupedByDate(LocalDate start, LocalDate end) {
        List<Daily> dailies = dailyRepository.findByDateRange(start, end);
        List<User>  allActive = userRepository.findByActiveTrue();
        Map<LocalDate, List<Daily>> grouped = dailies.stream().collect(Collectors.groupingBy(Daily::getDailyDate));
        return grouped.entrySet().stream()
            .sorted(Map.Entry.<LocalDate, List<Daily>>comparingByKey().reversed())
            .map(e -> {
                Set<Long> submitted = e.getValue().stream().map(d -> d.getUser().getId()).collect(Collectors.toSet());
                DailyByDateResponse r = new DailyByDateResponse();
                r.setDate(e.getKey());
                r.setDailies(e.getValue().stream().map(this::toResponse).collect(Collectors.toList()));
                r.setTotalMembers(e.getValue().size());
                r.setMembersWithBlockers((int) e.getValue().stream().filter(Daily::isHasBlocker).count());
                r.setTotalProtocols(e.getValue().stream().mapToInt(Daily::totalProtocols).sum());
                r.setPendingUsers(allActive.stream()
                    .filter(u -> u.getRole() == User.Role.MEMBER && !submitted.contains(u.getId()))
                    .map(this::toUserResponse).collect(Collectors.toList()));
                return r;
            }).collect(Collectors.toList());
    }

    public PendingResponse getPendingForDate(LocalDate date) {
        List<User>  allActive = userRepository.findByActiveTrue();
        List<Daily> dayDailies = dailyRepository.findByDailyDateOrderByUser_FullName(date);
        Set<Long>   submitted = dayDailies.stream().map(d -> d.getUser().getId()).collect(Collectors.toSet());
        List<User>  members = allActive.stream().filter(u -> u.getRole() == User.Role.MEMBER).collect(Collectors.toList());
        PendingResponse r = new PendingResponse();
        r.setDate(date); r.setTotal(members.size());
        r.setSubmittedCount((int) members.stream().filter(u -> submitted.contains(u.getId())).count());
        r.setSubmitted(members.stream().filter(u ->  submitted.contains(u.getId())).map(this::toUserResponse).collect(Collectors.toList()));
        r.setPending(  members.stream().filter(u -> !submitted.contains(u.getId())).map(this::toUserResponse).collect(Collectors.toList()));
        return r;
    }

    public String exportToCsv(LocalDate start, LocalDate end) throws Exception {
        List<Daily> dailies = dailyRepository.findByDateRange(start, end);
        StringWriter sw = new StringWriter();
        try (CSVPrinter p = new CSVPrinter(sw, CSVFormat.DEFAULT.withHeader(
                "Data","Membro","Feito ontem","Hoje","Bloqueios","Tem Bloqueio",
                "FA","IMP","DE","DI","CO","Total Protocolos","Projeto","% Tempo"))) {
            for (Daily d : dailies) {
                List<ProjectTime> projectTimes = d.getProjectTimes() != null ? d.getProjectTimes() : Collections.emptyList();
                String projects = projectTimes.stream()
                    .map(pt -> pt.getProjectName() + " (" + pt.getPercentSpent() + "%)")
                    .collect(Collectors.joining("; "));
                Double totalPercent = projectTimes.stream()
                    .map(ProjectTime::getPercentSpent)
                    .filter(Objects::nonNull)
                    .mapToDouble(Double::doubleValue)
                    .sum();

                String doneYesterday = (d.getTasks() != null && !d.getTasks().isEmpty())
                    ? formatTasksAsDoneYesterday(d.getTasks())
                    : d.getDoneYesterday();
                p.printRecord(d.getDailyDate(), d.getUser().getFullName(),
                    doneYesterday, d.getDoingToday(), d.getBlockers(),
                    d.isHasBlocker() ? "Sim" : "Nao",
                    d.getProtocolFA(), d.getProtocolIMP(), d.getProtocolDE(),
                    d.getProtocolDI(), d.getProtocolCO(), d.totalProtocols(),
                    projects, totalPercent + "%");
            }
        }
        return sw.toString();
    }

    public List<ProjectResponse> listProjects(boolean activeOnly) {
        var list = activeOnly
            ? projectRepository.findByActiveTrueOrderBySortOrderAsc()
            : projectRepository.findAll().stream().sorted(Comparator.comparing(Project::getSortOrder)).collect(Collectors.toList());
        return list.stream().map(this::toProjectResponse).collect(Collectors.toList());
    }

    public UserProjectPreferencesResponse getProjectPreferences(User user) {
        List<Long> activeProjectIds = projectRepository.findByActiveTrueOrderBySortOrderAsc().stream()
            .map(Project::getId)
            .collect(Collectors.toList());
        Set<Long> activeSet = new HashSet<>(activeProjectIds);

        List<Long> selected = parseVisibleProjectIds(user.getDailyVisibleProjectIds()).stream()
            .filter(activeSet::contains)
            .distinct()
            .collect(Collectors.toList());

        if (selected.isEmpty()) {
            selected = activeProjectIds;
        }

        UserProjectPreferencesResponse response = new UserProjectPreferencesResponse();
        response.setProjectIds(selected);
        return response;
    }

    @Transactional
    public UserProjectPreferencesResponse saveProjectPreferences(User user, UserProjectPreferencesRequest req) {
        List<Long> activeProjectIds = projectRepository.findByActiveTrueOrderBySortOrderAsc().stream()
            .map(Project::getId)
            .collect(Collectors.toList());
        Set<Long> activeSet = new HashSet<>(activeProjectIds);

        List<Long> selected = Optional.ofNullable(req.getProjectIds()).orElse(Collections.emptyList()).stream()
            .filter(Objects::nonNull)
            .filter(activeSet::contains)
            .distinct()
            .collect(Collectors.toList());

        if (selected.isEmpty()) {
            selected = activeProjectIds;
        }

        user.setDailyVisibleProjectIds(selected.stream().map(String::valueOf).collect(Collectors.joining(",")));
        userRepository.save(user);

        UserProjectPreferencesResponse response = new UserProjectPreferencesResponse();
        response.setProjectIds(selected);
        return response;
    }
    @Transactional public ProjectResponse createProject(ProjectRequest req) {
        Project p = new Project(); p.setName(req.getName());
        p.setColor(req.getColor()!=null?req.getColor():"#00e5a0");
        p.setSortOrder(req.getSortOrder()!=null?req.getSortOrder():0);
        return toProjectResponse(projectRepository.save(p));
    }
    @Transactional public Optional<ProjectResponse> updateProject(Long id, ProjectRequest req) {
        return projectRepository.findById(id).map(p -> {
            p.setName(req.getName()); if(req.getColor()!=null)p.setColor(req.getColor());
            if(req.getSortOrder()!=null)p.setSortOrder(req.getSortOrder());
            return toProjectResponse(projectRepository.save(p));
        });
    }
    @Transactional public boolean toggleProject(Long id) {
        return projectRepository.findById(id).map(p->{ p.setActive(!p.isActive()); projectRepository.save(p); return true; }).orElse(false);
    }

    @Transactional
    public DailyEditRequestResponse requestEditPermission(User user, DailyEditRequestCreate req) {
        if (user.getRole() == User.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admins nao precisam solicitar alteracao.");
        }

        Daily daily = dailyRepository.findByUserAndDailyDate(user, req.getDailyDate())
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Daily nao encontrada para a data informada."
            ));

        Optional<DailyEditRequest> pending = dailyEditRequestRepository
            .findFirstByDailyAndRequestedByAndStatusOrderByCreatedAtDesc(daily, user, DailyEditRequest.Status.PENDING);
        if (pending.isPresent()) {
            return toEditRequestResponse(pending.get());
        }

        Optional<DailyEditRequest> approvedUnused = dailyEditRequestRepository
            .findFirstByDailyAndRequestedByAndStatusAndUsedAtIsNullOrderByReviewedAtDescCreatedAtDesc(
                daily, user, DailyEditRequest.Status.APPROVED
            );
        if (approvedUnused.isPresent()) {
            return toEditRequestResponse(approvedUnused.get());
        }

        DailyEditRequest editRequest = new DailyEditRequest();
        editRequest.setDaily(daily);
        editRequest.setRequestedBy(user);
        editRequest.setStatus(DailyEditRequest.Status.PENDING);
        editRequest.setRequestReason(req.getReason());
        return toEditRequestResponse(dailyEditRequestRepository.save(editRequest));
    }

    public List<DailyEditRequestResponse> getEditRequests(DailyEditRequest.Status status) {
        DailyEditRequest.Status resolved = status != null ? status : DailyEditRequest.Status.PENDING;
        return dailyEditRequestRepository.findByStatusOrderByCreatedAtAsc(resolved).stream()
            .map(this::toEditRequestResponse)
            .collect(Collectors.toList());
    }

    @Transactional
    public DailyEditRequestResponse approveEditRequest(User admin, Long requestId, DailyEditRequestDecision decision) {
        return reviewEditRequest(admin, requestId, decision, DailyEditRequest.Status.APPROVED);
    }

    @Transactional
    public DailyEditRequestResponse rejectEditRequest(User admin, Long requestId, DailyEditRequestDecision decision) {
        return reviewEditRequest(admin, requestId, decision, DailyEditRequest.Status.REJECTED);
    }

    public DailyResponse toResponse(Daily d) {
        DailyResponse r = new DailyResponse();
        r.setId(d.getId()); r.setDailyDate(d.getDailyDate());
        String doneYesterday = (d.getTasks() != null && !d.getTasks().isEmpty())
            ? formatTasksAsDoneYesterday(d.getTasks())
            : d.getDoneYesterday();
        r.setDoneYesterday(doneYesterday); r.setDoingToday(d.getDoingToday());
        r.setBlockers(d.getBlockers()); r.setHasBlocker(d.isHasBlocker());
        r.setProtocolFA(d.getProtocolFA()); r.setProtocolIMP(d.getProtocolIMP());
        r.setProtocolDE(d.getProtocolDE()); r.setProtocolDI(d.getProtocolDI());
        r.setProtocolCO(d.getProtocolCO()); r.setTotalProtocols(d.totalProtocols());
        if(d.getCreatedAt()!=null)r.setCreatedAt(d.getCreatedAt().toString());
        if(d.getUpdatedAt()!=null)r.setUpdatedAt(d.getUpdatedAt().toString());
        r.setUser(toUserResponse(d.getUser()));
        if(d.getProjectTimes()!=null) r.setProjectTimes(d.getProjectTimes().stream().map(pt->{
            ProjectTimeResponse ptr=new ProjectTimeResponse(); ptr.setId(pt.getId());
            ptr.setProjectName(pt.getProjectName()); ptr.setPercentSpent(pt.getPercentSpent()); return ptr;
        }).collect(Collectors.toList()));
        if (d.getTasks() != null) {
            r.setTasks(d.getTasks().stream().map(t -> {
                TaskResponse task = new TaskResponse();
                task.setId(t.getId());
                task.setProjectName(t.getProjectName());
                task.setDescription(t.getDescription());
                task.setHoursSpent(t.getHoursSpent());
                return task;
            }).collect(Collectors.toList()));
        }
        r.setEditRequestStatus(null);
        r.setCanEdit(true);
        return r;
    }
    public UserResponse toUserResponse(User u) {
        UserResponse r=new UserResponse(); r.setId(u.getId()); r.setUsername(u.getUsername());
        r.setFullName(u.getFullName()); r.setEmail(u.getEmail()); r.setBitrixId(u.getBitrixId());
        r.setRole(u.getRole().name()); r.setActive(u.isActive()); return r;
    }
    public ProjectResponse toProjectResponse(Project p) {
        ProjectResponse r=new ProjectResponse(); r.setId(p.getId()); r.setName(p.getName());
        r.setColor(p.getColor()); r.setActive(p.isActive()); r.setSortOrder(p.getSortOrder()); return r;
    }

    private DailyEditRequestResponse reviewEditRequest(
        User admin,
        Long requestId,
        DailyEditRequestDecision decision,
        DailyEditRequest.Status finalStatus
    ) {
        DailyEditRequest request = dailyEditRequestRepository.findById(requestId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitacao nao encontrada."));

        if (request.getStatus() != DailyEditRequest.Status.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Solicitacao ja foi processada.");
        }

        request.setStatus(finalStatus);
        request.setReviewedBy(admin);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewNote(decision != null ? decision.getNote() : null);
        if (finalStatus == DailyEditRequest.Status.REJECTED) {
            request.setUsedAt(null);
        }

        return toEditRequestResponse(dailyEditRequestRepository.save(request));
    }

    private DailyEditRequestResponse toEditRequestResponse(DailyEditRequest request) {
        DailyEditRequestResponse response = new DailyEditRequestResponse();
        response.setId(request.getId());
        response.setDailyId(request.getDaily().getId());
        response.setDailyDate(request.getDaily().getDailyDate());
        response.setRequestedBy(toUserResponse(request.getRequestedBy()));
        if (request.getReviewedBy() != null) {
            response.setReviewedBy(toUserResponse(request.getReviewedBy()));
        }
        response.setStatus(request.getStatus());
        response.setReason(request.getRequestReason());
        response.setNote(request.getReviewNote());
        response.setCreatedAt(request.getCreatedAt() != null ? request.getCreatedAt().toString() : null);
        response.setReviewedAt(request.getReviewedAt() != null ? request.getReviewedAt().toString() : null);
        response.setUsedAt(request.getUsedAt() != null ? request.getUsedAt().toString() : null);
        return response;
    }

    private void applyEditPermission(DailyResponse response, User user, Daily daily) {
        if (user.getRole() == User.Role.ADMIN) {
            response.setCanEdit(true);
            response.setEditRequestStatus(DailyEditRequest.Status.APPROVED);
            return;
        }

        Optional<DailyEditRequest> approvedUnused = dailyEditRequestRepository
            .findFirstByDailyAndRequestedByAndStatusAndUsedAtIsNullOrderByReviewedAtDescCreatedAtDesc(
                daily, user, DailyEditRequest.Status.APPROVED
            );
        if (approvedUnused.isPresent()) {
            response.setCanEdit(true);
            response.setEditRequestStatus(DailyEditRequest.Status.APPROVED);
            return;
        }

        Optional<DailyEditRequest> pending = dailyEditRequestRepository
            .findFirstByDailyAndRequestedByAndStatusOrderByCreatedAtDesc(daily, user, DailyEditRequest.Status.PENDING);
        if (pending.isPresent()) {
            response.setCanEdit(false);
            response.setEditRequestStatus(DailyEditRequest.Status.PENDING);
            return;
        }

        Optional<DailyEditRequest> rejected = dailyEditRequestRepository
            .findFirstByDailyAndRequestedByAndStatusOrderByCreatedAtDesc(daily, user, DailyEditRequest.Status.REJECTED);
        if (rejected.isPresent()) {
            response.setCanEdit(false);
            response.setEditRequestStatus(DailyEditRequest.Status.REJECTED);
            return;
        }

        response.setCanEdit(false);
        response.setEditRequestStatus(null);
    }

    private String formatTasksAsDoneYesterday(List<DailyTask> tasks) {
        return tasks.stream()
            .filter(t -> t.getProjectName() != null && t.getDescription() != null)
            .map(t -> "- [" + t.getProjectName() + "] " + t.getDescription() + " (" + formatHours(t.getHoursSpent()) + ")")
            .collect(Collectors.joining("\n"));
    }

    private String formatHours(Double hours) {
        double safe = hours != null ? Math.max(hours, 0.0) : 0.0;
        int totalMinutes = (int) Math.round(safe * 60.0);
        int hh = totalMinutes / 60;
        int mm = totalMinutes % 60;
        return String.format("%02d:%02d", hh, mm);
    }

    private List<Long> parseVisibleProjectIds(String value) {
        if (value == null || value.isBlank()) return Collections.emptyList();
        return Arrays.stream(value.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .map(s -> {
                try {
                    return Long.parseLong(s);
                } catch (NumberFormatException ex) {
                    return null;
                }
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }

    private PreDailyResponse toPreDailyResponse(PreDaily d) {
        PreDailyResponse r = new PreDailyResponse();
        r.setId(d.getId());
        r.setDailyDate(d.getDailyDate());
        r.setCreatedAt(d.getCreatedAt() != null ? d.getCreatedAt().toString() : null);
        r.setUpdatedAt(d.getUpdatedAt() != null ? d.getUpdatedAt().toString() : null);
        if (d.getTasks() != null) {
            r.setTasks(d.getTasks().stream().map(t -> {
                PreDailyTaskResponse tr = new PreDailyTaskResponse();
                tr.setId(t.getId());
                tr.setProjectName(t.getProjectName());
                tr.setDescription(t.getDescription());
                return tr;
            }).collect(Collectors.toList()));
        }
        return r;
    }

    private GeneralNoteResponse toGeneralNoteResponse(GeneralNote note) {
        GeneralNoteResponse response = new GeneralNoteResponse();
        response.setId(note.getId());
        response.setProjectName(note.getProjectName());
        response.setProtocol(note.getProtocol());
        response.setTitle(note.getTitle());
        response.setNoteText(note.getNoteText());
        response.setFinished(note.isFinished());
        response.setCreatedAt(note.getCreatedAt() != null ? note.getCreatedAt().toString() : null);
        response.setUpdatedAt(note.getUpdatedAt() != null ? note.getUpdatedAt().toString() : null);
        return response;
    }

    private String cleanProtocol(String protocol) {
        if (protocol == null) return null;
        String trimmed = protocol.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String cleanTitle(String title) {
        if (title == null) return null;
        String trimmed = title.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeProjectName(String projectName) {
        if (projectName == null) return "Geral";
        String trimmed = projectName.trim();
        return trimmed.isEmpty() ? "Geral" : trimmed;
    }
}
