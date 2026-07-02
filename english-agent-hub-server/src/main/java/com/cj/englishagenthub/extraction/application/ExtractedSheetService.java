package com.cj.englishagenthub.extraction.application;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.extraction.domain.ExtractedSheet;
import com.cj.englishagenthub.extraction.infrastructure.ExtractedSheetRepository;
import com.cj.englishagenthub.extraction.presentation.dto.ExtractedSheetResponse;
import com.cj.englishagenthub.question.application.QuestionExtractionService;
import com.cj.englishagenthub.question.presentation.dto.ExtractedQuestionResponse;
import com.cj.englishagenthub.user.domain.User;
import com.cj.englishagenthub.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 추출 시험지 유스케이스. 추출 엔진(QuestionExtractionService)으로 독해 문항을 뽑고
 * ExtractedSheet 애그리거트로 영속한다. 구조 조립 규칙은 애그리거트가 소유한다.
 */
@Service
@RequiredArgsConstructor
public class ExtractedSheetService {

    private final ExtractedSheetRepository extractedSheetRepository;
    private final QuestionExtractionService questionExtractionService;
    private final UserRepository userRepository;

    @Transactional
    public ExtractedSheetResponse createFromPdf(UserPrincipal principal, MultipartFile file) {
        List<ExtractedQuestionResponse> extracted = questionExtractionService.extractReadingQuestions(file);
        User creator = userRepository.findById(principal.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        List<ExtractedSheet.ItemSpec> specs = extracted.stream()
                .map(q -> new ExtractedSheet.ItemSpec(q.number(), q.prompt(), q.passage(), q.choices(),
                        q.answer(), q.explanation(), q.type()))
                .toList();

        ExtractedSheet sheet = ExtractedSheet.create(creator, deriveTitle(file.getOriginalFilename()), file.getOriginalFilename(), specs);
        return ExtractedSheetResponse.from(extractedSheetRepository.save(sheet));
    }

    @Transactional(readOnly = true)
    public List<ExtractedSheetResponse> list() {
        return extractedSheetRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(ExtractedSheetResponse::summary)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExtractedSheetResponse get(String id) {
        return ExtractedSheetResponse.from(loadOrThrow(id));
    }

    @Transactional
    public void delete(String id) {
        extractedSheetRepository.delete(loadOrThrow(id));
    }

    private ExtractedSheet loadOrThrow(String id) {
        return extractedSheetRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXTRACTED_SHEET_NOT_FOUND));
    }

    private String deriveTitle(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "추출 시험지";
        }
        int dot = fileName.lastIndexOf('.');
        String base = dot > 0 ? fileName.substring(0, dot) : fileName;
        return base.length() > 180 ? base.substring(0, 180) : base;
    }
}
