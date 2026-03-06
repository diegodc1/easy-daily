package com.daily.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "dailies", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "daily_date"})
})
@Data @NoArgsConstructor @AllArgsConstructor
public class Daily {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "daily_date", nullable = false)
    private LocalDate dailyDate;

    @Column(name = "done_yesterday", columnDefinition = "TEXT")
    private String doneYesterday;

    @Column(name = "doing_today", columnDefinition = "TEXT")
    private String doingToday;

    @Column(name = "blockers", columnDefinition = "TEXT")
    private String blockers;

    @Column(name = "has_blocker")
    private boolean hasBlocker = false;

    // 5 protocol types
    @Column(name = "protocol_fa")  private Integer protocolFA  = 0;
    @Column(name = "protocol_imp") private Integer protocolIMP = 0;
    @Column(name = "protocol_de")  private Integer protocolDE  = 0;
    @Column(name = "protocol_di")  private Integer protocolDI  = 0;
    @Column(name = "protocol_co")  private Integer protocolCO  = 0;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "daily", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectTime> projectTimes = new ArrayList<>();

    @PrePersist  protected void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }
    @PreUpdate   protected void onUpdate() { updatedAt = LocalDateTime.now(); }

    public int totalProtocols() {
        return safe(protocolFA) + safe(protocolIMP) + safe(protocolDE) + safe(protocolDI) + safe(protocolCO);
    }
    private int safe(Integer v) { return v != null ? v : 0; }
}
