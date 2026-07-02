package com.cj.englishagenthub.extraction.presentation.dto;

import com.cj.englishagenthub.extraction.domain.ExtractedSheet;
import com.cj.englishagenthub.extraction.domain.ExtractedSheetItem;

import java.time.Instant;
import java.util.List;

public record ExtractedSheetResponse(
        String id,
        String title,
        String sourceFileName,
        int itemCount,
        String createdByName,
        Instant createdAt,
        List<Item> items
) {
    public record Item(
            Integer questionNumber,
            String prompt,
            String passage,
            List<String> choices,
            String answer,
            String explanation,
            String type
    ) {
        static Item from(ExtractedSheetItem item) {
            return new Item(
                    item.getQuestionNumber(),
                    item.getPrompt(),
                    item.getPassage(),
                    item.getChoices(),
                    item.getAnswer(),
                    item.getExplanation(),
                    item.getType()
            );
        }
    }

    /** 카드 목록용 — 문항 본문 제외. */
    public static ExtractedSheetResponse summary(ExtractedSheet sheet) {
        return new ExtractedSheetResponse(
                sheet.getId(),
                sheet.getTitle(),
                sheet.getSourceFileName(),
                sheet.itemCount(),
                sheet.getCreatedBy().getUsername(),
                sheet.getCreatedAt(),
                List.of()
        );
    }

    /** 상세 — 문항 포함. */
    public static ExtractedSheetResponse from(ExtractedSheet sheet) {
        return new ExtractedSheetResponse(
                sheet.getId(),
                sheet.getTitle(),
                sheet.getSourceFileName(),
                sheet.itemCount(),
                sheet.getCreatedBy().getUsername(),
                sheet.getCreatedAt(),
                sheet.getItems().stream().map(Item::from).toList()
        );
    }
}
