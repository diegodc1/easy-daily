package com.daily.repository;

import com.daily.entity.Daily;
import com.daily.entity.DailyEditRequest;
import com.daily.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DailyEditRequestRepository extends JpaRepository<DailyEditRequest, Long> {

    Optional<DailyEditRequest> findFirstByDailyAndRequestedByAndStatusAndUsedAtIsNullOrderByReviewedAtDescCreatedAtDesc(
        Daily daily,
        User requestedBy,
        DailyEditRequest.Status status
    );

    Optional<DailyEditRequest> findFirstByDailyAndRequestedByAndStatusOrderByCreatedAtDesc(
        Daily daily,
        User requestedBy,
        DailyEditRequest.Status status
    );

    List<DailyEditRequest> findByStatusOrderByCreatedAtAsc(DailyEditRequest.Status status);
}
