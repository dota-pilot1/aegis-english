package com.cj.englishagenthub.category.application;

import com.cj.englishagenthub.category.domain.Category;
import com.cj.englishagenthub.category.infrastructure.CategoryRepository;
import com.cj.englishagenthub.category.presentation.dto.CategoryCreateRequest;
import com.cj.englishagenthub.category.presentation.dto.CategoryRenameRequest;
import com.cj.englishagenthub.category.presentation.dto.CategoryResponse;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.question.infrastructure.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final QuestionRepository questionRepository;

    @Transactional(readOnly = true)
    public List<CategoryResponse> list() {
        Map<Long, Long> countByCategory = new HashMap<>();
        for (QuestionRepository.CategoryCount count : questionRepository.countGroupByCategory()) {
            countByCategory.put(count.getCategoryId(), count.getCnt());
        }
        return categoryRepository.findAllByOrderByDisplayOrderAscIdAsc().stream()
                .map(category -> CategoryResponse.from(category, countByCategory.getOrDefault(category.getId(), 0L)))
                .toList();
    }

    @Transactional
    public CategoryResponse create(CategoryCreateRequest req) {
        Category parent = req.parentId() == null ? null : loadOrThrow(req.parentId());
        String name = req.name().trim();
        boolean duplicated = parent == null
                ? categoryRepository.existsByParentIsNullAndName(name)
                : categoryRepository.existsByParent_IdAndName(parent.getId(), name);
        if (duplicated) throw new BusinessException(ErrorCode.CATEGORY_DUPLICATE_NAME);

        long siblings = parent == null
                ? categoryRepository.countByParentIsNull()
                : categoryRepository.countByParent_Id(parent.getId());
        Category saved = categoryRepository.save(Category.create(parent, name, (int) siblings));
        return CategoryResponse.from(saved, 0);
    }

    @Transactional
    public CategoryResponse rename(Long id, CategoryRenameRequest req) {
        Category target = loadOrThrow(id);
        String name = req.name().trim();
        if (!name.equals(target.getName())) {
            boolean duplicated = target.getParentId() == null
                    ? categoryRepository.existsByParentIsNullAndName(name)
                    : categoryRepository.existsByParent_IdAndName(target.getParentId(), name);
            if (duplicated) throw new BusinessException(ErrorCode.CATEGORY_DUPLICATE_NAME);
            target.rename(name);
        }
        return CategoryResponse.from(target, questionRepository.countByCategory_Id(id));
    }

    @Transactional
    public void delete(Long id) {
        Category target = loadOrThrow(id);
        if (categoryRepository.existsByParent_Id(id) || questionRepository.existsByCategory_Id(id)) {
            throw new BusinessException(ErrorCode.CATEGORY_NOT_EMPTY);
        }
        categoryRepository.delete(target);
    }

    @Transactional(readOnly = true)
    public Category loadOrThrow(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.CATEGORY_NOT_FOUND));
    }

    /** 자신 + 모든 자손의 id 집합 (전체 로드 후 BFS — PoC 규모 전제) */
    @Transactional(readOnly = true)
    public Set<Long> subtreeIds(Long rootId) {
        loadOrThrow(rootId);
        Map<Long, List<Long>> childrenByParent = new HashMap<>();
        for (Category category : categoryRepository.findAll()) {
            if (category.getParentId() != null) {
                childrenByParent.computeIfAbsent(category.getParentId(), k -> new java.util.ArrayList<>()).add(category.getId());
            }
        }
        Set<Long> ids = new HashSet<>();
        Deque<Long> queue = new ArrayDeque<>();
        queue.add(rootId);
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            if (!ids.add(current)) continue;
            queue.addAll(childrenByParent.getOrDefault(current, List.of()).stream()
                    .filter(childId -> !Objects.equals(childId, current))
                    .toList());
        }
        return ids;
    }
}
