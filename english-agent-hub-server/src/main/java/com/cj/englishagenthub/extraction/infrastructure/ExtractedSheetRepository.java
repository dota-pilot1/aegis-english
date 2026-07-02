package com.cj.englishagenthub.extraction.infrastructure;

import com.cj.englishagenthub.extraction.domain.ExtractedSheet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExtractedSheetRepository extends JpaRepository<ExtractedSheet, String> {
    List<ExtractedSheet> findAllByOrderByCreatedAtDesc();
}
