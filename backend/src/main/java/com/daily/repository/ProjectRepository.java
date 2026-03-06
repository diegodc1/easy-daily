package com.daily.repository;

import com.daily.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByActiveTrueOrderBySortOrderAsc();
    boolean existsByName(String name);
}
