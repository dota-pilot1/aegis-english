package com.cj.englishagenthub.mathextraction2.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * 정형 추출 문항 1개. 발문·보기는 텍스트(LaTeX는 $...$로 감쌈), 도형은 별도 이미지 URL로 보관한다.
 */
@Entity
@Table(name = "structured_math_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StructuredMathItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sheet_id", nullable = false)
    private StructuredMathSheet sheet;

    @Column(name = "order_no", nullable = false)
    private int orderNo;

    @Column(name = "question_number")
    private Integer questionNumber;

    /** 발문 (한글 + $LaTeX$ 인라인 수식). */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String prompt;

    /** 보기 ①~⑤ (각 항목에 LaTeX 포함 가능). 단답형이면 비어 있음. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "structured_math_item_choices", joinColumns = @JoinColumn(name = "item_id"))
    @Column(name = "choice", length = 2000)
    private List<String> choices = new ArrayList<>();

    /** 도형·그래프 이미지 URL (없으면 null). */
    @Column(name = "figure_image_url", columnDefinition = "TEXT")
    private String figureImageUrl;

    /** 정답 (①~⑤ 또는 정수). */
    @Column(columnDefinition = "TEXT")
    private String answer;

    private Integer points;

    @Column(length = 20)
    private String type;

    @Column(length = 30)
    private String subject;

    @Column(name = "needs_review", nullable = false)
    private boolean needsReview;

    static StructuredMathItem of(StructuredMathSheet sheet, int orderNo, StructuredMathSheet.ItemSpec spec) {
        StructuredMathItem item = new StructuredMathItem();
        item.sheet = sheet;
        item.orderNo = orderNo;
        item.questionNumber = spec.questionNumber();
        item.prompt = spec.prompt() == null ? "" : spec.prompt().trim();
        item.choices = spec.choices() == null ? new ArrayList<>() : new ArrayList<>(spec.choices());
        item.figureImageUrl = StringUtils.hasText(spec.figureImageUrl()) ? spec.figureImageUrl() : null;
        item.answer = StringUtils.hasText(spec.answer()) ? spec.answer().trim() : null;
        item.points = spec.points();
        item.type = StringUtils.hasText(spec.type()) ? spec.type().trim() : null;
        item.subject = StringUtils.hasText(spec.subject()) ? spec.subject().trim() : null;
        item.needsReview = spec.needsReview();
        return item;
    }
}
