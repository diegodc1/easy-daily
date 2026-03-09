package com.daily.repository;

import com.daily.entity.GeneralNote;
import com.daily.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GeneralNoteRepository extends JpaRepository<GeneralNote, Long> {
    List<GeneralNote> findByUserOrderByUpdatedAtDescCreatedAtDesc(User user);
    Optional<GeneralNote> findByIdAndUser(Long id, User user);
}
