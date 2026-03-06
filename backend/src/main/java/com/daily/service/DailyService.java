package com.daily.service;

import com.daily.dto.DailyDTO.*;
import com.daily.entity.*;
import com.daily.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.StringWriter;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class DailyService {
    private final DailyRepository   dailyRepository;
    private final UserRepository    userRepository;
    private final ProjectRepository projectRepository;

    @Transactional
    public DailyResponse saveOrUpdate(User user, DailyRequest req) {
        Daily daily = dailyRepository.findByUserAndDailyDate(user, req.getDailyDate()).orElse(new Daily());
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
        return toResponse(dailyRepository.save(daily));
    }

    public Optional<DailyResponse> getByUserAndDate(User user, LocalDate date) {
        return dailyRepository.findByUserAndDailyDate(user, date).map(this::toResponse);
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

                p.printRecord(d.getDailyDate(), d.getUser().getFullName(),
                    d.getDoneYesterday(), d.getDoingToday(), d.getBlockers(),
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

    public DailyResponse toResponse(Daily d) {
        DailyResponse r = new DailyResponse();
        r.setId(d.getId()); r.setDailyDate(d.getDailyDate());
        r.setDoneYesterday(d.getDoneYesterday()); r.setDoingToday(d.getDoingToday());
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
        return r;
    }
    public UserResponse toUserResponse(User u) {
        UserResponse r=new UserResponse(); r.setId(u.getId()); r.setUsername(u.getUsername());
        r.setFullName(u.getFullName()); r.setEmail(u.getEmail()); r.setRole(u.getRole().name()); r.setActive(u.isActive()); return r;
    }
    public ProjectResponse toProjectResponse(Project p) {
        ProjectResponse r=new ProjectResponse(); r.setId(p.getId()); r.setName(p.getName());
        r.setColor(p.getColor()); r.setActive(p.isActive()); r.setSortOrder(p.getSortOrder()); return r;
    }
}

