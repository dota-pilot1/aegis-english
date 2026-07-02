package com.cj.englishagenthub.exam.application;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.exam.domain.Exam;
import com.cj.englishagenthub.exam.domain.ExamItem;
import com.cj.englishagenthub.exam.infrastructure.ExamRepository;
import com.cj.englishagenthub.exam.presentation.dto.ExamResponse;
import com.cj.englishagenthub.question.application.QuestionGenerationService;
import com.cj.englishagenthub.question.application.QuestionService;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.infrastructure.QuestionRepository;
import com.cj.englishagenthub.question.presentation.dto.QuestionUpsertRequest;
import com.cj.englishagenthub.user.domain.User;
import com.cj.englishagenthub.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 시험지 통째 변형(ExamVariant) 유스케이스.
 * 문항 생성(외부 LLM 호출)·저장만 오케스트레이션하고,
 * "원본 구조를 복제해 동형 시험지를 만든다"는 규칙은 Exam 애그리거트에 위임한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExamVariantService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final QuestionService questionService;
    private final QuestionGenerationService questionGenerationService;
    private final UserRepository userRepository;

    @Transactional
    public ExamResponse generateVariant(UserPrincipal principal, String sourceExamId) {
        Exam source = examRepository.findById(sourceExamId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXAM_NOT_FOUND));
        if (source.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.EXAM_HAS_NO_ITEMS);
        }
        User creator = userRepository.findById(principal.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // 원본 문항별로 동형 새 문항을 생성·저장한다. (생성물은 임베딩 대기 상태로 큐잉됨)
        List<Question> replacements = new ArrayList<>();
        for (ExamItem item : source.getItems()) {
            QuestionUpsertRequest generated = questionGenerationService.generateOneSimilar(item.getQuestion());
            String newQuestionId = questionService.create(generated).id();
            replacements.add(questionRepository.findById(newQuestionId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.QUESTION_NOT_FOUND)));
        }

        Exam variant = Exam.variantOf(source, creator, replacements);
        Exam saved = examRepository.save(variant);
        log.info("Generated exam variant {} from source {} ({} items)", saved.getId(), sourceExamId, replacements.size());
        return ExamResponse.from(saved);
    }
}
