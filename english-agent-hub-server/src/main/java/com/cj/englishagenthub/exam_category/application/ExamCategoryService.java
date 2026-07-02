package com.cj.englishagenthub.exam_category.application;

import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.exam.infrastructure.ExamRepository;
import com.cj.englishagenthub.exam_category.domain.ExamCategory;
import com.cj.englishagenthub.exam_category.infrastructure.ExamCategoryRepository;
import com.cj.englishagenthub.exam_category.presentation.dto.ExamCategoryCreateRequest;
import com.cj.englishagenthub.exam_category.presentation.dto.ExamCategoryRenameRequest;
import com.cj.englishagenthub.exam_category.presentation.dto.ExamCategoryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ExamCategoryService {

    private final ExamCategoryRepository examCategoryRepository;
    private final ExamRepository examRepository;

    @Transactional(readOnly = true)
    public List<ExamCategoryResponse> list() {
        Map<Long, Long> countByCategory = new HashMap<>();
        for (ExamRepository.ExamCategoryCount count : examRepository.countGroupByExamCategory()) {
            countByCategory.put(count.getExamCategoryId(), count.getCnt());
        }
        return examCategoryRepository.findAllByOrderByDisplayOrderAscIdAsc().stream()
                .map(category -> ExamCategoryResponse.from(category, countByCategory.getOrDefault(category.getId(), 0L)))
                .toList();
    }

    @Transactional
    public ExamCategoryResponse create(ExamCategoryCreateRequest req) {
        ExamCategory parent = req.parentId() == null ? null : loadOrThrow(req.parentId());
        String name = req.name().trim();
        boolean duplicated = parent == null
                ? examCategoryRepository.existsByParentIsNullAndName(name)
                : examCategoryRepository.existsByParent_IdAndName(parent.getId(), name);
        if (duplicated) throw new BusinessException(ErrorCode.EXAM_CATEGORY_DUPLICATE_NAME);

        long siblings = parent == null
                ? examCategoryRepository.countByParentIsNull()
                : examCategoryRepository.countByParent_Id(parent.getId());
        ExamCategory saved = examCategoryRepository.save(ExamCategory.create(parent, name, (int) siblings));
        return ExamCategoryResponse.from(saved, 0);
    }

    @Transactional
    public ExamCategoryResponse rename(Long id, ExamCategoryRenameRequest req) {
        ExamCategory target = loadOrThrow(id);
        String name = req.name().trim();
        if (!name.equals(target.getName())) {
            boolean duplicated = target.getParentId() == null
                    ? examCategoryRepository.existsByParentIsNullAndName(name)
                    : examCategoryRepository.existsByParent_IdAndName(target.getParentId(), name);
            if (duplicated) throw new BusinessException(ErrorCode.EXAM_CATEGORY_DUPLICATE_NAME);
            target.rename(name);
        }
        return ExamCategoryResponse.from(target, examRepository.countByExamCategory_Id(id));
    }

    @Transactional
    public void delete(Long id) {
        ExamCategory target = loadOrThrow(id);
        if (examCategoryRepository.existsByParent_Id(id) || examRepository.existsByExamCategory_Id(id)) {
            throw new BusinessException(ErrorCode.EXAM_CATEGORY_NOT_EMPTY);
        }
        examCategoryRepository.delete(target);
    }

    @Transactional(readOnly = true)
    public ExamCategory loadOrThrow(Long id) {
        return examCategoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXAM_CATEGORY_NOT_FOUND));
    }
}
