package com.cj.englishagenthub.mathextraction2.infrastructure;

import com.cj.englishagenthub.mathextraction2.domain.StructuredMathSheet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StructuredMathSheetRepository extends JpaRepository<StructuredMathSheet, String> {
    List<StructuredMathSheet> findAllByOrderByCreatedAtDesc();
}
