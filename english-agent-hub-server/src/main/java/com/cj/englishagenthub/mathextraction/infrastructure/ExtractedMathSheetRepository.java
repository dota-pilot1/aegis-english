package com.cj.englishagenthub.mathextraction.infrastructure;

import com.cj.englishagenthub.mathextraction.domain.ExtractedMathSheet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExtractedMathSheetRepository extends JpaRepository<ExtractedMathSheet, String> {
    List<ExtractedMathSheet> findAllByOrderByCreatedAtDesc();
}
