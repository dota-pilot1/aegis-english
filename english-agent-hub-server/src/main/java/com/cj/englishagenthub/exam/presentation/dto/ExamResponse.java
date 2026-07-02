package com.cj.englishagenthub.exam.presentation.dto;

import com.cj.englishagenthub.category.domain.Category;
import com.cj.englishagenthub.exam.domain.Exam;
import com.cj.englishagenthub.exam.domain.ExamStatus;
import com.cj.englishagenthub.exam_category.domain.ExamCategory;

import java.time.Instant;
import java.util.List;

/**
 * 출제 관리(관리자) 화면용 시험지 응답. 문항 상세까지 포함.
 */
public record ExamResponse(
        String id,
        String title,
        String description,
        Long subjectId,
        String subjectName,
        Long examCategoryId,
        String examCategoryName,
        ExamStatus status,
        Integer timeLimitMinutes,
        int totalPoints,
        int itemCount,
        Long createdById,
        String createdByName,
        List<ExamItemResponse> items,
        Instant createdAt,
        Instant updatedAt
) {
    public static ExamResponse from(Exam exam) {
        return new ExamResponse(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                subjectId(exam),
                subjectName(exam),
                examCategoryId(exam),
                examCategoryName(exam),
                exam.getStatus(),
                exam.getTimeLimitMinutes(),
                exam.totalPoints(),
                exam.getItems().size(),
                exam.getCreatedBy().getId(),
                exam.getCreatedBy().getUsername(),
                exam.getItems().stream().map(ExamItemResponse::from).toList(),
                exam.getCreatedAt(),
                exam.getUpdatedAt()
        );
    }

    /** 목록용 경량 응답(문항 상세 제외). */
    public static ExamResponse summary(Exam exam) {
        return new ExamResponse(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                subjectId(exam),
                subjectName(exam),
                examCategoryId(exam),
                examCategoryName(exam),
                exam.getStatus(),
                exam.getTimeLimitMinutes(),
                exam.totalPoints(),
                exam.getItems().size(),
                exam.getCreatedBy().getId(),
                exam.getCreatedBy().getUsername(),
                List.of(),
                exam.getCreatedAt(),
                exam.getUpdatedAt()
        );
    }

    private static Long subjectId(Exam exam) {
        Category subject = exam.getSubject();
        return subject == null ? null : subject.getId();
    }

    private static String subjectName(Exam exam) {
        Category subject = exam.getSubject();
        return subject == null ? null : subject.getName();
    }

    private static Long examCategoryId(Exam exam) {
        ExamCategory category = exam.getExamCategory();
        return category == null ? null : category.getId();
    }

    private static String examCategoryName(Exam exam) {
        ExamCategory category = exam.getExamCategory();
        return category == null ? null : category.getName();
    }
}
