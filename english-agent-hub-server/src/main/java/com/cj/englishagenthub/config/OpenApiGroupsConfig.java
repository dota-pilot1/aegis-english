package com.cj.englishagenthub.config;

import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * DDD 바운디드 컨텍스트(패키지) 기준으로 OpenAPI 스펙을 도메인 클러스터로 분리한다.
 * 각 그룹은 /api/docs/{group} 으로 노출되고(인증 필요), 프론트 /api-docs 의 그룹 탭에서 전환한다.
 */
@Configuration
public class OpenApiGroupsConfig {

    private static final String BASE = "com.cj.englishagenthub.";

    private static String[] pkgs(String... modules) {
        String[] out = new String[modules.length];
        for (int i = 0; i < modules.length; i++) out[i] = BASE + modules[i];
        return out;
    }

    @Bean
    public GroupedOpenApi allGroup() {
        return GroupedOpenApi.builder()
                .group("all")
                .packagesToScan("com.cj.englishagenthub")
                .build();
    }

    @Bean
    public GroupedOpenApi authUserGroup() {
        return GroupedOpenApi.builder()
                .group("auth-user")
                .packagesToScan(pkgs("auth", "user", "role", "permission", "permission_category"))
                .build();
    }

    @Bean
    public GroupedOpenApi questionExamGroup() {
        return GroupedOpenApi.builder()
                .group("question-exam")
                .packagesToScan(pkgs("question", "category", "exam", "exam_category", "attempt", "practice"))
                .build();
    }

    @Bean
    public GroupedOpenApi extractionGroup() {
        return GroupedOpenApi.builder()
                .group("extraction")
                .packagesToScan(pkgs("extraction", "mathextraction", "mathextraction2"))
                .build();
    }

    @Bean
    public GroupedOpenApi aiAgentGroup() {
        return GroupedOpenApi.builder()
                .group("ai-agent")
                .packagesToScan(pkgs("ai", "character"))
                .build();
    }

    @Bean
    public GroupedOpenApi contentGroup() {
        return GroupedOpenApi.builder()
                .group("content")
                .packagesToScan(pkgs("menu", "site_settings", "reference_data", "common"))
                .build();
    }
}
