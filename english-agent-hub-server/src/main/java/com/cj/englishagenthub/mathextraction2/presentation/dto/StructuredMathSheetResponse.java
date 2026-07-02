package com.cj.englishagenthub.mathextraction2.presentation.dto;

import com.cj.englishagenthub.mathextraction2.domain.StructuredMathItem;
import com.cj.englishagenthub.mathextraction2.domain.StructuredMathSheet;

import java.time.Instant;
import java.util.List;

public record StructuredMathSheetResponse(
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
            List<String> choices,
            String figureImageUrl,
            String answer,
            Integer points,
            String type,
            String subject,
            boolean needsReview
    ) {
        static Item from(StructuredMathItem item) {
            return new Item(
                    item.getQuestionNumber(),
                    item.getPrompt(),
                    item.getChoices(),
                    item.getFigureImageUrl(),
                    item.getAnswer(),
                    item.getPoints(),
                    item.getType(),
                    item.getSubject(),
                    item.isNeedsReview()
            );
        }
    }

    public static StructuredMathSheetResponse summary(StructuredMathSheet sheet) {
        return new StructuredMathSheetResponse(
                sheet.getId(), sheet.getTitle(), sheet.getSourceFileName(), sheet.itemCount(),
                sheet.getCreatedBy().getUsername(), sheet.getCreatedAt(), List.of());
    }

    public static StructuredMathSheetResponse from(StructuredMathSheet sheet) {
        return new StructuredMathSheetResponse(
                sheet.getId(), sheet.getTitle(), sheet.getSourceFileName(), sheet.itemCount(),
                sheet.getCreatedBy().getUsername(), sheet.getCreatedAt(),
                sheet.getItems().stream().map(Item::from).toList());
    }
}
