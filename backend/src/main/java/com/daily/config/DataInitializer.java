package com.daily.config;

import com.daily.entity.Project;
import com.daily.entity.User;
import com.daily.repository.ProjectRepository;
import com.daily.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository    userRepository;
    private final ProjectRepository projectRepository;
    private final PasswordEncoder   passwordEncoder;

    @Override
    public void run(String... args) {
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
                new Project(null, "SigaMatch",   "#00e5a0", true, 0),
                new Project(null, "RiscoSacado", "#3b82f6", true, 1),
                new Project(null, "RpBanking",   "#f59e0b", true, 2),
                new Project(null, "RpOne",       "#f43f5e", true, 3)
            );
            projectRepository.saveAll(defaults);
            System.out.println(">>> Projetos padrão criados");
        }
    }
}
