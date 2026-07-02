package com.cj.englishagenthub.extraction.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * 추출 시험지에 담긴 독해 문항 1개. ExtractedSheet 애그리거트의 하위 엔티티.
 * 정답·해설은 검수 단계에서 채우므로 여기엔 없다.
 */
@Entity
@Table(name = "extracted_sheet_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExtractedSheetItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sheet_id", nullable = false)
    private ExtractedSheet sheet;

    @Column(name = "order_no", nullable = false)
    private int orderNo;

    /** 원본 문제지의 문항 번호 (없을 수 있음) */
    @Column(name = "question_number")
    private Integer questionNumber;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String prompt;

    @Column(columnDefinition = "TEXT")
    private String passage;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "extracted_sheet_item_choices", joinColumns = @JoinColumn(name = "item_id"))
    @Column(name = "choice", length = 1000)
    private List<String> choices = new ArrayList<>();

    /** LLM이 판단한 정답(보기 중 하나). 검수 단계에서 수정 가능. */
    @Column(columnDefinition = "TEXT")
    private String answer;

    /** LLM이 생성한 해설(선택). */
    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(length = 20)
    private String type;

    static ExtractedSheetItem of(
            ExtractedSheet sheet, int orderNo, Integer questionNumber,
            String prompt, String passage, List<String> choices, String answer, String explanation, String type
    ) {
        ExtractedSheetItem item = new ExtractedSheetItem();
        item.sheet = sheet;
        item.orderNo = orderNo;
        item.questionNumber = questionNumber;
        item.prompt = prompt == null ? "" : prompt.trim();
        item.passage = StringUtils.hasText(passage) ? passage.trim() : null;
        item.choices = choices == null ? new ArrayList<>() : new ArrayList<>(choices);
        item.answer = StringUtils.hasText(answer) ? answer.trim() : null;
        item.explanation = StringUtils.hasText(explanation) ? explanation.trim() : null;
        item.type = type;
        return item;
    }
}
