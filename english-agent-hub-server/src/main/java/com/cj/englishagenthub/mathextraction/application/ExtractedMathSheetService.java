package com.cj.englishagenthub.mathextraction.application;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.mathextraction.domain.ExtractedMathSheet;
import com.cj.englishagenthub.mathextraction.infrastructure.ExtractedMathSheetRepository;
import com.cj.englishagenthub.mathextraction.presentation.dto.ExtractedMathSheetResponse;
import com.cj.englishagenthub.user.domain.User;
import com.cj.englishagenthub.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 추출 수학 시험지 유스케이스. MathExtractionService로 문항 이미지를 뽑고
 * ExtractedMathSheet 애그리거트로 영속한다.
 */
@Service
@RequiredArgsConstructor
public class ExtractedMathSheetService {

    private final ExtractedMathSheetRepository repository;
    private final MathExtractionService mathExtractionService;
    private final UserRepository userRepository;

    @Transactional
    public ExtractedMathSheetResponse createFromPdf(UserPrincipal principal, MultipartFile problemPdf, MultipartFile answerPdf) {
        List<ExtractedMathSheet.ItemSpec> specs = mathExtractionService.extract(problemPdf, answerPdf);
        User creator = userRepository.findById(principal.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        ExtractedMathSheet sheet = ExtractedMathSheet.create(
                creator, deriveTitle(problemPdf.getOriginalFilename()), problemPdf.getOriginalFilename(), specs);
        return ExtractedMathSheetResponse.from(repository.save(sheet));
    }

    @Transactional(readOnly = true)
    public List<ExtractedMathSheetResponse> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(ExtractedMathSheetResponse::summary)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExtractedMathSheetResponse get(String id) {
        return ExtractedMathSheetResponse.from(loadOrThrow(id));
    }

    @Transactional
    public void delete(String id) {
        repository.delete(loadOrThrow(id));
    }

    private ExtractedMathSheet loadOrThrow(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXTRACTED_MATH_SHEET_NOT_FOUND));
    }

    private String deriveTitle(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "수학 추출 시험지";
        }
        int dot = fileName.lastIndexOf('.');
        String base = dot > 0 ? fileName.substring(0, dot) : fileName;
        return base.length() > 180 ? base.substring(0, 180) : base;
    }
}
