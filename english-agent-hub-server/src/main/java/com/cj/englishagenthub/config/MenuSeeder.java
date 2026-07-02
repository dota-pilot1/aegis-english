package com.cj.englishagenthub.config;

import com.cj.englishagenthub.menu.domain.Menu;
import com.cj.englishagenthub.menu.infrastructure.MenuRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Slf4j
@Component
@Order(4)
@RequiredArgsConstructor
public class MenuSeeder implements ApplicationRunner {

    private final MenuRepository menuRepository;

    /** 구조 개편으로 코드가 바뀌거나 사라진 메뉴 — 부팅 시 제거 */
    private static final List<String> LEGACY_CODES = List.of("ADMIN_QUESTION_BANK", "ADMIN_API_DOCS");

    /** MVP 범위 밖 메뉴는 부팅 시 운영 헤더에서 숨긴다. */
    private static final Set<String> MVP_HIDDEN_MENU_CODES = Set.of(
            "DASHBOARD",
            "LEARNING",
            "PRACTICE",
            "LEARNING_RESULTS",
            "REFERENCE_DATA",
            "REFERENCE_VOCABULARY",
            "REFERENCE_IDIOMS",
            "REFERENCE_GRAMMAR",
            "REFERENCE_QUESTION_TYPES",
            "REFERENCE_CURRICULUM",
            "RESULTS",
            "EXAM_RESULTS",
            "WRONG_ANSWER_NOTE"
    );

    private record MenuDef(
            String code, String parentCode, String label, String labelKey,
            String path, String icon, String requiredRole, int displayOrder
    ) {}

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (String legacyCode : LEGACY_CODES) {
            menuRepository.findByCode(legacyCode).ifPresent(menu -> {
                menuRepository.delete(menu);
                log.info("Removed legacy menu: {}", legacyCode);
            });
        }

        List<MenuDef> defs = List.of(
                new MenuDef("DASHBOARD",             null,       "대시보드",      "nav.dashboard",        "/dashboard",        "LayoutDashboard", null,                    0),
                new MenuDef("LEARNING",              null,       "학습하기",      "nav.learning",         null,                "GraduationCap",   null,                    1),
                new MenuDef("PRACTICE",              "LEARNING", "문제 풀기",     "nav.practice",         "/practice",         "PlayCircle",      null,                    0),
                new MenuDef("LEARNING_RESULTS",      "LEARNING", "성적/기록",     "nav.learningResults",  "/scores",           "BarChart3",       null,                    1),
                new MenuDef("ENGLISH_CONVERSATION",  null,       "영어 회화",     "nav.englishConversation", "/dashboard",       "MessagesSquare",  null,                    1),
                new MenuDef("QUESTION",              null,       "문제 관리",     "nav.questionMgmt",     null,                "BookOpenCheck",   RoleSeeder.ROLE_ADMIN,   2),
                new MenuDef("QUESTION_BANK",         "QUESTION", "문제 은행",     "nav.questionBank",     "/question-bank",    "BookOpenCheck",   RoleSeeder.ROLE_ADMIN,   0),
                new MenuDef("EXAM_MANAGE",           "QUESTION", "시험 출제",     "nav.examManage",       "/exams",            "ClipboardList",   RoleSeeder.ROLE_ADMIN,   1),
                new MenuDef("QUESTION_GEN",          null,       "문제 생성",     "nav.questionGen",      null,                "Sparkles",        RoleSeeder.ROLE_ADMIN,   3),
                new MenuDef("QUESTION_GEN_EN",       "QUESTION_GEN", "영어 문제 생성기", "nav.questionGenEnglish", "/question-generator/english", "Sparkles",    RoleSeeder.ROLE_ADMIN,   0),
                new MenuDef("QUESTION_GEN_MATH",     "QUESTION_GEN", "수학 문제 생성기", "nav.questionGenMath",    "/question-generator/math",    "Calculator",  RoleSeeder.ROLE_ADMIN,   1),
                new MenuDef("QUESTION_EXTRACTOR",    "QUESTION_GEN", "영어 문제 추출", "nav.questionExtractor", "/question-generator/extractor", "FileSearch", RoleSeeder.ROLE_ADMIN,   2),
                new MenuDef("QUESTION_EXTRACTOR_MATH","QUESTION_GEN", "수학 문제 추출", "nav.questionExtractorMath", "/question-generator/math-extractor", "Calculator", RoleSeeder.ROLE_ADMIN, 3),
                new MenuDef("QUESTION_EXTRACTOR_MATH2","QUESTION_GEN", "수학 문제 추출기 2", "nav.questionExtractorMath2", "/question-generator/math-extractor-2", "FunctionSquare", RoleSeeder.ROLE_ADMIN, 4),
                new MenuDef("REFERENCE_DATA",         null,       "기준정보",      "nav.referenceData",     null,                "Database",        RoleSeeder.ROLE_ADMIN,   5),
                new MenuDef("REFERENCE_VOCABULARY",   "REFERENCE_DATA", "어휘 사전", "nav.vocabularyDictionary", "/reference-data/vocabulary", "BookOpenText", RoleSeeder.ROLE_ADMIN, 0),
                new MenuDef("REFERENCE_IDIOMS",       "REFERENCE_DATA", "숙어 사전", "nav.idiomDictionary", "/reference-data/idioms", "Languages", RoleSeeder.ROLE_ADMIN, 1),
                new MenuDef("REFERENCE_GRAMMAR",      "REFERENCE_DATA", "문법 기준", "nav.grammarStandards", "/reference-data/grammar", "ListChecks", RoleSeeder.ROLE_ADMIN, 2),
                new MenuDef("REFERENCE_QUESTION_TYPES","REFERENCE_DATA", "문항 유형", "nav.questionTypes", "/reference-data/question-types", "ClipboardList", RoleSeeder.ROLE_ADMIN, 3),
                new MenuDef("REFERENCE_CURRICULUM",   "REFERENCE_DATA", "교육과정", "nav.curriculum", "/reference-data/curriculum", "GraduationCap", RoleSeeder.ROLE_ADMIN, 4),
                new MenuDef("RESULTS",               null,       "성적 관리",     "nav.resultsMgmt",      null,                "BarChart3",       RoleSeeder.ROLE_ADMIN,   4),
                new MenuDef("EXAM_RESULTS",          "RESULTS",  "시험 성적",     "nav.examResults",      "/exam-results",     "BarChart3",       RoleSeeder.ROLE_ADMIN,   0),
                new MenuDef("WRONG_ANSWER_NOTE",     "RESULTS",  "오답 노트",     "nav.wrongAnswerNote",  "/wrong-answer-notes","NotebookPen",    RoleSeeder.ROLE_ADMIN,   1),
                new MenuDef("ADMIN",                 null,       "설정 관리",     "nav.admin",            null,                "Settings",        RoleSeeder.ROLE_ADMIN,   6),
                new MenuDef("ADMIN_USERS",           "ADMIN",    "유저 관리",     "nav.users",            "/users",            "Users",           RoleSeeder.ROLE_ADMIN,   0),
                new MenuDef("ADMIN_ROLE_PERMISSIONS","ADMIN",    "역할-권한 매핑","nav.rolePermissions",  "/role-permissions", "ShieldCheck",     RoleSeeder.ROLE_ADMIN,   1),
                new MenuDef("ADMIN_SITE_SETTINGS",   "ADMIN",    "메인 관리",     "nav.siteSettings",     "/site-settings",    "LayoutDashboard", RoleSeeder.ROLE_ADMIN,   2),
                new MenuDef("ADMIN_MENU_MANAGEMENT", "ADMIN",    "메뉴 관리",     "nav.menuManagement",   "/menu-management",  "Menu",            RoleSeeder.ROLE_ADMIN,   3),
                new MenuDef("API_DOCS",              null,       "API 문서",      "nav.apiDocs",          null,                "FileCode2",       RoleSeeder.ROLE_ADMIN,   7),
                new MenuDef("API_DOCS_SWAGGER",      "API_DOCS", "Swagger",       "nav.swagger",          "/api-docs",         "FileCode2",       RoleSeeder.ROLE_ADMIN,   0),
                new MenuDef("API_DOCS_KEY",          "API_DOCS", "주요 API",      "nav.keyApi",           "/api-docs/key",     "ListChecks",      RoleSeeder.ROLE_ADMIN,   1)
        );

        // upsert: 시더 defs를 소스 오브 트루스로 라벨/계층/순서를 동기화한다.
        // 단, visible과 requiredPermission은 메뉴 관리 화면에서 조정한 값을 보존한다.
        for (MenuDef def : defs) {
            Menu parent = def.parentCode() != null
                    ? menuRepository.findByCode(def.parentCode()).orElse(null)
                    : null;
            Menu existing = menuRepository.findByCode(def.code()).orElse(null);
            boolean visible = !MVP_HIDDEN_MENU_CODES.contains(def.code());
            if (existing == null) {
                menuRepository.save(Menu.create(
                        def.code(), parent, def.label(), def.labelKey(),
                        def.path(), def.icon(), false,
                        def.requiredRole(), null, visible, def.displayOrder()
                ));
                log.info("Seeded menu: {}", def.code());
            } else {
                boolean nextVisible = visible && existing.isVisible();
                existing.update(
                        parent, def.label(), def.labelKey(),
                        def.path(), def.icon(), existing.isExternal(),
                        def.requiredRole(), existing.getRequiredPermission(),
                        nextVisible, def.displayOrder()
                );
            }
        }
    }
}
