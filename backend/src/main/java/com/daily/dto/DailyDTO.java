package com.daily.dto;

import com.daily.entity.DailyEditRequest;
import com.daily.entity.User;
import lombok.Data;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public class DailyDTO {

    @Data public static class LoginRequest {
        @NotBlank private String username;
        @NotBlank private String password;
    }
    @Data public static class LoginResponse {
        private String token, username, fullName, role, bitrixId;
        public LoginResponse(String t, String u, String f, String r, String b) { token=t;username=u;fullName=f;role=r; bitrixId=b;}
    }
    @Data public static class UserRequest {
        @NotBlank @Size(min=3,max=50) private String username;
        @NotBlank @Size(min=3)        private String password;
        @NotBlank @Size(max=100)      private String fullName;
        @Email                        private String email;
        @Size(max=100)                private String bitrixId;
        private User.Role role = User.Role.MEMBER;
    }
    @Data public static class UserResponse {
        private Long id;
        private String username, fullName, email, bitrixId, role;
        private boolean active;
        private List<Long> visibleProjectIds;
    }
    @Data public static class ProjectRequest {
        @NotBlank @Size(max=100) private String name;
        private String color = "#00e5a0";
        private Integer sortOrder = 0;
    }
    @Data public static class ProjectResponse {
        private Long id;
        private String name, color;
        private boolean active;
        private Integer sortOrder;
    }
    @Data public static class ProjectTimeRequest {
        @NotBlank private String projectName;
        @Min(0) @Max(100) private Double percentSpent = 0.0;
    }
    @Data public static class TaskRequest {
        @NotBlank private String projectName;
        @NotBlank @Size(max = 2000) private String description;
        @Min(0) @Max(24) private Double hoursSpent = 0.0;
    }
    @Data public static class DailyRequest {
        @NotNull        private LocalDate dailyDate;
        private String  doneYesterday;
        private String  doingToday;
        private String  blockers;
        private boolean hasBlocker;
        @Min(0) private Integer protocolFA  = 0;
        @Min(0) private Integer protocolIMP = 0;
        @Min(0) private Integer protocolDE  = 0;
        @Min(0) private Integer protocolDI  = 0;
        @Min(0) private Integer protocolCO  = 0;
        private List<ProjectTimeRequest> projectTimes;
        private List<TaskRequest> tasks;
    }
    @Data public static class ProjectTimeResponse {
        private Long id;
        private String projectName;
        private Double percentSpent;
    }
    @Data public static class DailyResponse {
        private Long      id;
        private LocalDate dailyDate;
        private String    doneYesterday, doingToday, blockers;
        private boolean   hasBlocker;
        private Integer   protocolFA, protocolIMP, protocolDE, protocolDI, protocolCO;
        private Integer   totalProtocols;
        private UserResponse user;
        private List<ProjectTimeResponse> projectTimes;
        private List<TaskResponse> tasks;
        private String createdAt, updatedAt;
        private boolean canEdit = true;
        private DailyEditRequest.Status editRequestStatus;
    }
    @Data public static class TaskResponse {
        private Long id;
        private String projectName;
        private String description;
        private Double hoursSpent;
    }
    @Data public static class DailyByDateResponse {
        private LocalDate date;
        private List<DailyResponse> dailies;
        private int totalMembers, membersWithBlockers, totalProtocols;
        private List<UserResponse> pendingUsers;
    }
    @Data public static class PendingResponse {
        private LocalDate date;
        private List<UserResponse> pending, submitted;
        private int total, submittedCount;
    }

    @Data public static class DailyEditRequestCreate {
        @NotNull private LocalDate dailyDate;
        @Size(max = 1000) private String reason;
    }

    @Data public static class DailyEditRequestDecision {
        @Size(max = 1000) private String note;
    }

    @Data public static class DailyEditRequestResponse {
        private Long id;
        private Long dailyId;
        private LocalDate dailyDate;
        private UserResponse requestedBy;
        private UserResponse reviewedBy;
        private DailyEditRequest.Status status;
        private String reason;
        private String note;
        private String createdAt;
        private String reviewedAt;
        private String usedAt;
    }

    @Data public static class ProtocolCountsResponse {
        private Integer protocolFA = 0;
        private Integer protocolIMP = 0;
        private Integer protocolDE = 0;
        private Integer protocolDI = 0;
        private Integer protocolCO = 0;
    }

    @Data public static class UserProjectPreferencesRequest {
        private List<Long> projectIds;
    }

    @Data public static class UserProjectPreferencesResponse {
        private List<Long> projectIds;
    }

    @Data public static class PreDailyTaskRequest {
        @NotBlank private String projectName;
        @NotBlank @Size(max = 2000) private String description;
    }

    @Data public static class PreDailyRequest {
        private LocalDate dailyDate;
        private List<PreDailyTaskRequest> tasks;
    }

    @Data public static class PreDailyTaskResponse {
        private Long id;
        private String projectName;
        private String description;
    }

    @Data public static class PreDailyResponse {
        private Long id;
        private LocalDate dailyDate;
        private List<PreDailyTaskResponse> tasks;
        private String createdAt;
        private String updatedAt;
    }

    @Data public static class GeneralNoteRequest {
        @Size(max = 100) private String projectName;
        @Size(max = 100) private String protocol;
        @Size(max = 200) private String title;
        @Size(max = 5000) private String noteText;
        @Pattern(regexp = "TEXT|TODO") private String noteType;
        private Boolean sendFinishedToPreDaily;
        private List<GeneralNoteTodoItemRequest> todoItems;
    }

    @Data public static class GeneralNoteTodoItemRequest {
        @Size(max = 80) private String id;
        @NotBlank @Size(max = 500) private String text;
        private Boolean finished;
        private Boolean sentToPreDaily;
    }

    @Data public static class GeneralNoteResponse {
        private Long id;
        private String projectName;
        private String protocol;
        private String title;
        private String noteText;
        private String noteType;
        private boolean sendFinishedToPreDaily;
        private List<GeneralNoteTodoItemResponse> todoItems;
        private boolean finished;
        private String createdAt;
        private String updatedAt;
    }

    @Data public static class GeneralNoteTodoItemResponse {
        private String id;
        private String text;
        private boolean finished;
        private boolean sentToPreDaily;
    }

    @Data public static class GeneralNoteFinishRequest {
        @NotNull private Boolean finished;
    }
}
