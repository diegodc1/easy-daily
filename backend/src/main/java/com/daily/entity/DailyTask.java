package com.daily.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "daily_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_id", nullable = false)
    private Daily daily;

    @Column(name = "project_name", nullable = false, length = 100)
    private String projectName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "hours_spent")
    private Double hoursSpent = 0.0;
}
