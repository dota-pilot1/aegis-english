package com.cj.englishagenthub.exam.application;

import com.cj.englishagenthub.attempt.infrastructure.ExamAttemptRepository;
import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.category.domain.Category;
import com.cj.englishagenthub.category.infrastructure.CategoryRepository;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.exam.domain.Exam;
import com.cj.englishagenthub.exam.domain.ExamStatus;
import com.cj.englishagenthub.exam.infrastructure.ExamRepository;
import com.cj.englishagenthub.exam.presentation.dto.ExamResponse;
import com.cj.englishagenthub.exam.presentation.dto.ExamUpsertRequest;
import com.cj.englishagenthub.exam_category.domain.ExamCategory;
import com.cj.englishagenthub.exam_category.infrastructure.ExamCategoryRepository;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.infrastructure.QuestionRepository;
import com.cj.englishagenthub.user.domain.User;
import com.cj.englishagenthub.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ExamCategoryRepository examCategoryRepository;
    private final ExamAttemptRepository examAttemptRepository;

    @Transactional(readOnly = true)
    public List<ExamResponse> list() {
        return examRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(ExamResponse::summary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExamResponse> listPublished() {
        return examRepository.findByStatusOrderByCreatedAtDesc(ExamStatus.PUBLISHED).stream()
                .map(ExamResponse::summary)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamResponse get(String id) {
        return ExamResponse.from(loadOrThrow(id));
    }

    @Transactional(readOnly = true)
    public Exam loadOrThrow(String id) {
        return examRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXAM_NOT_FOUND));
    }

    @Transactional
    public ExamResponse create(UserPrincipal principal, ExamUpsertRequest req) {
        User creator = userRepository.findById(principal.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Exam exam = Exam.create(
                creator,
                req.title(),
                req.description(),
                req.timeLimitMinutes(),
                resolveSubject(req.subjectId()),
                resolveExamCategory(req.examCategoryId())
        );
        exam.replaceItems(resolveItems(req.safeItems()));
        return ExamResponse.from(examRepository.save(exam));
    }

    @Transactional
    public ExamResponse update(String id, ExamUpsertRequest req) {
        Exam exam = loadOrThrow(id);
        exam.updateMeta(
                req.title(),
                req.description(),
                req.timeLimitMinutes(),
                resolveSubject(req.subjectId()),
                resolveExamCategory(req.examCategoryId())
        );
        exam.replaceItems(resolveItems(req.safeItems()));
        return ExamResponse.from(exam);
    }

    @Transactional
    public ExamResponse publish(String id) {
        Exam exam = loadOrThrow(id);
        exam.publish();
        return ExamResponse.from(exam);
    }

    @Transactional
    public ExamResponse close(String id) {
        Exam exam = loadOrThrow(id);
        exam.close();
        return ExamResponse.from(exam);
    }

    @Transactional
    public void delete(String id) {
        Exam exam = loadOrThrow(id);
        // 응시 기록(및 cascade로 답안)을 먼저 제거해야 FK 제약에 걸리지 않는다.
        examAttemptRepository.deleteAll(examAttemptRepository.findByExam_IdOrderByStartedAtDesc(id));
        examRepository.delete(exam);
    }

    /** 과목(분류) id를 Category로 해석. null이면 미분류. */
    private Category resolveSubject(Long subjectId) {
        if (subjectId == null) return null;
        return categoryRepository.findById(subjectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CATEGORY_NOT_FOUND));
    }

    private ExamCategory resolveExamCategory(Long examCategoryId) {
        if (examCategoryId == null) return null;
        return examCategoryRepository.findById(examCategoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXAM_CATEGORY_NOT_FOUND));
    }

    /** 요청의 questionId들을 한 번에 조회해 순서를 유지하며 ItemSpec으로 변환. */
    private List<Exam.ItemSpec> resolveItems(List<ExamUpsertRequest.Item> items) {
        List<String> ids = items.stream().map(ExamUpsertRequest.Item::questionId).toList();
        Map<String, Question> byId = questionRepository.findAllById(ids).stream()
                .collect(java.util.stream.Collectors.toMap(Question::getId, Function.identity()));
        return items.stream()
                .map(it -> {
                    Question q = byId.get(it.questionId());
                    if (q == null) throw new BusinessException(ErrorCode.QUESTION_NOT_FOUND);
                    return new Exam.ItemSpec(q, it.points());
                })
                .toList();
    }
}
