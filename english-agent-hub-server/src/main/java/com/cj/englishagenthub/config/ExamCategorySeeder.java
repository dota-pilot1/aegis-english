package com.cj.englishagenthub.config;

import com.cj.englishagenthub.exam_category.domain.ExamCategory;
import com.cj.englishagenthub.exam_category.infrastructure.ExamCategoryRepository;
import com.cj.englishagenthub.exam.infrastructure.ExamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 시험지 운영 분류 트리. 문제 은행 분류(QuestionSeeder)와 동일하게
 * MVP 범위(고등 영어·수학)로 맞추고, 비-고등 분류는 정리한다.
 */
@Component
@Order(4)
@RequiredArgsConstructor
public class ExamCategorySeeder implements ApplicationRunner {

    private final ExamCategoryRepository examCategoryRepository;
    private final ExamRepository examRepository;

    // 시험지는 여러 영역을 묶은 '종합' 평가가 기본이라 과목별 종합 분류를 둔다. (종합은 맨 뒤)
    private static final List<String> ENGLISH_AREAS = List.of("듣기", "읽기", "어휘/어법", "간접 쓰기", "장문", "종합");
    private static final List<String> MATH_UNITS = List.of("대수", "미적분Ⅰ", "확률과 통계", "기하", "종합");

    private static final Set<String> ALLOWED_CATEGORY_PATHS = Set.of(
            "영어",
            "영어 > 종합",
            "영어 > 듣기",
            "영어 > 읽기",
            "영어 > 어휘/어법",
            "영어 > 간접 쓰기",
            "영어 > 장문",
            "수학",
            "수학 > 종합",
            "수학 > 대수",
            "수학 > 미적분Ⅰ",
            "수학 > 확률과 통계",
            "수학 > 기하"
    );

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 루트 순서: 영어(0), 수학(1). 자식은 리스트 인덱스대로 displayOrder를 명시·갱신해 순서를 고정한다.
        ExamCategory english = ensureRoot("영어", 0);
        ExamCategory math = ensureRoot("수학", 1);
        ensureChildren(english, ENGLISH_AREAS);
        ensureChildren(math, MATH_UNITS);
        cleanupUnexpectedCategories();
    }

    private ExamCategory ensureRoot(String name, int displayOrder) {
        ExamCategory root = examCategoryRepository.findFirstByParentIsNullAndName(name).orElse(null);
        if (root == null) {
            return examCategoryRepository.save(ExamCategory.create(null, name, displayOrder));
        }
        if (root.getDisplayOrder() != displayOrder) {
            root.reorder(displayOrder);
        }
        return root;
    }

    private void ensureChildren(ExamCategory parent, List<String> names) {
        for (int i = 0; i < names.size(); i++) {
            String name = names.get(i);
            ExamCategory child = examCategoryRepository.findFirstByParent_IdAndName(parent.getId(), name).orElse(null);
            if (child == null) {
                examCategoryRepository.save(ExamCategory.create(parent, name, i));
            } else if (child.getDisplayOrder() != i) {
                child.reorder(i);
            }
        }
    }

    /** 허용 경로 밖의 시험지 분류를 자식·참조가 없을 때 정리한다. */
    private void cleanupUnexpectedCategories() {
        boolean changed;
        do {
            changed = false;
            for (ExamCategory category : examCategoryRepository.findAll()) {
                if (ALLOWED_CATEGORY_PATHS.contains(categoryPath(category))) {
                    continue;
                }
                if (examCategoryRepository.existsByParent_Id(category.getId()) || examRepository.existsByExamCategory_Id(category.getId())) {
                    continue;
                }
                examCategoryRepository.delete(category);
                examCategoryRepository.flush();
                changed = true;
                break;
            }
        } while (changed);
    }

    private String categoryPath(ExamCategory category) {
        List<String> names = new ArrayList<>();
        ExamCategory cursor = category;
        while (cursor != null) {
            names.add(0, cursor.getName());
            cursor = cursor.getParent();
        }
        return String.join(" > ", names);
    }
}
