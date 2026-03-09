package com.daily.config;

import com.daily.entity.Project;
import com.daily.entity.User;
import com.daily.repository.ProjectRepository;
import com.daily.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        ensureGeneralNotesSchema();

        // Default admin
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setFullName("Administrador");
            admin.setEmail("admin@empresa.com");
            admin.setRole(User.Role.ADMIN);
            userRepository.save(admin);
            System.out.println(">>> Admin criado: admin / admin123");
        }

        // Default projects
        if (projectRepository.count() == 0) {
            var defaults = List.of(
                new Project(null, "SigaMatch", "#00e5a0", true, 0),
                new Project(null, "RiscoSacado", "#3b82f6", true, 1),
                new Project(null, "RpBanking", "#f59e0b", true, 2),
                new Project(null, "RpOne", "#f43f5e", true, 3)
            );
            projectRepository.saveAll(defaults);
            System.out.println(">>> Projetos padrao criados");
        }
    }

    private void ensureGeneralNotesSchema() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS general_notes (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    project_name VARCHAR(100) NOT NULL,
                    protocol VARCHAR(100),
                    note_text TEXT NOT NULL,
                    finished BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP(6) NOT NULL DEFAULT NOW()
                )
                """);

            jdbcTemplate.execute("ALTER TABLE general_notes ADD COLUMN IF NOT EXISTS finished BOOLEAN NOT NULL DEFAULT FALSE");

            jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.table_constraints
                        WHERE table_name = 'general_notes'
                          AND constraint_type = 'FOREIGN KEY'
                          AND constraint_name = 'fk_general_notes_user'
                    ) THEN
                        ALTER TABLE general_notes
                        ADD CONSTRAINT fk_general_notes_user
                        FOREIGN KEY (user_id) REFERENCES users(id);
                    END IF;
                END $$;
                """);
        } catch (Exception ex) {
            System.out.println(">>> Aviso: nao foi possivel validar schema de general_notes automaticamente: " + ex.getMessage());
        }
    }
}
