package com.daily.repository;

import com.daily.entity.PreDaily;
import com.daily.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PreDailyRepository extends JpaRepository<PreDaily, Long> {
    Optional<PreDaily> findFirstByUserOrderByUpdatedAtDesc(User user);
    long deleteByUser(User user);
}
