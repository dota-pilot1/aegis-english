package com.cj.englishagenthub.mathextraction.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.util.StringUtils;

/**
 * 추출 수학 시험지의 문항 1개. ExtractedMathSheet 애그리거트의 하위 엔티티.
 * 발문·도형·보기는 원본을 그대로 잘라낸 한 장의 이미지(imageUrl)로 보관한다.
 */
@Entity
@Table(name = "extracted_math_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExtractedMathItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sheet_id", nullable = false)
    private ExtractedMathSheet sheet;

    @Column(name = "order_no", nullable = false)
    private int orderNo;

    /** 원본 문제지의 문항 번호 (없을 수 있음) */
    @Column(name = "question_number")
    private Integer questionNumber;

    /** 문항 전체(발문+도형+보기)를 잘라낸 이미지 URL. */
    @Column(name = "image_url", nullable = false, columnDefinition = "TEXT")
    private String imageUrl;

    /** 배점 (2/3/4점). 없을 수 있음. */
    private Integer points;

    /** 5지선다 | 단답형 */
    @Column(length = 20)
    private String type;

    /** 정답 PDF에서 매핑한 정답(①~⑤ 또는 정수 문자열). 검수 단계에서 수정 가능. */
    @Column(columnDefinition = "TEXT")
    private String answer;

    /** 공통 | 확률과통계 | 미적분 | 기하 */
    @Column(length = 30)
    private String subject;

    /** PDF 텍스트 레이어에서 살린 발문/보기 텍스트(검색·검수용). 수식 부분은 깨질 수 있음. */
    @Column(name = "raw_text", columnDefinition = "TEXT")
    private String text;

    /** 도형·그래프 포함 추정 여부. */
    @Column(name = "has_figure", nullable = false)
    private boolean hasFigure;

    /** 수식/도형/보기누락 등으로 사람 검수(Math OCR 보정)가 필요한 문항. */
    @Column(name = "needs_review", nullable = false)
    private boolean needsReview;

    static ExtractedMathItem of(
            ExtractedMathSheet sheet, int orderNo, Integer questionNumber, String imageUrl,
            Integer points, String type, String answer, String subject,
            String text, boolean hasFigure, boolean needsReview
    ) {
        ExtractedMathItem item = new ExtractedMathItem();
        item.sheet = sheet;
        item.orderNo = orderNo;
        item.questionNumber = questionNumber;
        item.imageUrl = imageUrl;
        item.points = points;
        item.type = StringUtils.hasText(type) ? type.trim() : null;
        item.answer = StringUtils.hasText(answer) ? answer.trim() : null;
        item.subject = StringUtils.hasText(subject) ? subject.trim() : null;
        item.text = StringUtils.hasText(text) ? text.trim() : null;
        item.hasFigure = hasFigure;
        item.needsReview = needsReview;
        return item;
    }
}
