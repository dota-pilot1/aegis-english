package com.cj.englishagenthub.mathextraction.presentation.dto;

import com.cj.englishagenthub.mathextraction.domain.ExtractedMathItem;
import com.cj.englishagenthub.mathextraction.domain.ExtractedMathSheet;

import java.time.Instant;
import java.util.List;

public record ExtractedMathSheetResponse(
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
            String imageUrl,
            Integer points,
            String type,
            String answer,
            String subject,
            String text,
            boolean hasFigure,
            boolean needsReview
    ) {
        static Item from(ExtractedMathItem item) {
            return new Item(
                    item.getQuestionNumber(),
                    item.getImageUrl(),
                    item.getPoints(),
                    item.getType(),
                    item.getAnswer(),
                    item.getSubject(),
                    item.getText(),
                    item.isHasFigure(),
                    item.isNeedsReview()
            );
        }
    }

    /** 카드 목록용 — 문항 본문 제외. */
    public static ExtractedMathSheetResponse summary(ExtractedMathSheet sheet) {
        return new ExtractedMathSheetResponse(
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
    public static ExtractedMathSheetResponse from(ExtractedMathSheet sheet) {
        return new ExtractedMathSheetResponse(
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
