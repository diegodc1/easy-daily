package com.daily.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "pre_daily_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PreDailyTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pre_daily_id", nullable = false)
    private PreDaily preDaily;

    @Column(name = "project_name", nullable = false, length = 100)
    private String projectName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
}
