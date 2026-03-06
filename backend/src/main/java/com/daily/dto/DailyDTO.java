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
        private String token, username, fullName, role;
        public LoginResponse(String t, String u, String f, String r) { token=t;username=u;fullName=f;role=r; }
    }
    @Data public static class UserRequest {
        @NotBlank @Size(min=3,max=50) private String username;
        @NotBlank @Size(min=3)        private String password;
        @NotBlank @Size(max=100)      private String fullName;
        @Email                        private String email;
        private User.Role role = User.Role.MEMBER;
    }
    @Data public static class UserResponse {
        private Long id;
        private String username, fullName, email, role;
        private boolean active;
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
        private String createdAt, updatedAt;
        private boolean canEdit = true;
        private DailyEditRequest.Status editRequestStatus;
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
}
