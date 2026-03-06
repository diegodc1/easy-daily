package com.daily.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "project_times")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectTime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_id", nullable = false)
    private Daily daily;

    @Column(name = "project_name", nullable = false, length = 100)
    private String projectName;

    @Column(name = "percent_spent")
    private Double percentSpent = 0.0;
    // protocolCount removed — protocols are now a single total field on Daily
}
