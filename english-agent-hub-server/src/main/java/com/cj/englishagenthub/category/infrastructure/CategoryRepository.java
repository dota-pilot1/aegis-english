package com.cj.englishagenthub.category.infrastructure;

import com.cj.englishagenthub.category.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findAllByOrderByDisplayOrderAscIdAsc();
    Optional<Category> findFirstByParentIsNullAndName(String name);
    Optional<Category> findFirstByParent_IdAndName(Long parentId, String name);
    boolean existsByParent_Id(Long parentId);
    boolean existsByParent_IdAndName(Long parentId, String name);
    boolean existsByParentIsNullAndName(String name);
    long countByParent_Id(Long parentId);
    long countByParentIsNull();
}
