package com.daily.repository;

import com.daily.entity.Daily;
import com.daily.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyRepository extends JpaRepository<Daily, Long> {

    Optional<Daily> findByUserAndDailyDate(User user, LocalDate date);

    List<Daily> findByDailyDateOrderByUser_FullName(LocalDate date);

    List<Daily> findByUserOrderByDailyDateDesc(User user);

    @Query("SELECT DISTINCT d.dailyDate FROM Daily d ORDER BY d.dailyDate DESC")
    List<LocalDate> findAllDistinctDates();

    @Query("SELECT DISTINCT d FROM Daily d JOIN FETCH d.user LEFT JOIN FETCH d.projectTimes " +
           "WHERE d.dailyDate BETWEEN :start AND :end ORDER BY d.dailyDate DESC, d.user.fullName")
    List<Daily> findByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT d FROM Daily d JOIN FETCH d.user LEFT JOIN FETCH d.projectTimes " +
           "WHERE d.dailyDate = :date ORDER BY d.user.fullName")
    List<Daily> findByDateWithDetails(@Param("date") LocalDate date);
}
