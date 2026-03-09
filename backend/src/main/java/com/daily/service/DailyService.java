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
}
