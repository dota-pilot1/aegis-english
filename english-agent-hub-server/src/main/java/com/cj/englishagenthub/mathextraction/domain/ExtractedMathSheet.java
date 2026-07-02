package com.cj.englishagenthub.mathextraction.domain;

import com.cj.englishagenthub.user.domain.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 수학 PDF에서 추출한 문항 묶음(검수 전 원본).
 * 영어 독해와 달리 수식·도형이 깨지지 않도록 문항 영역을 '이미지'로 잘라 보관한다.
 * (발문 → 도형 → 보기가 원본 레이아웃 그대로 한 장에 세로로 담긴다.)
 */
@Entity
@Table(name = "extracted_math_sheets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExtractedMathSheet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "source_file_name", length = 300)
    private String sourceFileName;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @OneToMany(mappedBy = "sheet", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderNo ASC")
    private List<ExtractedMathItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public static ExtractedMathSheet create(User createdBy, String title, String sourceFileName, List<ItemSpec> specs) {
        if (specs == null || specs.isEmpty()) {
            throw new IllegalArgumentException("추출된 문항이 없으면 시험지를 만들 수 없습니다.");
        }
        ExtractedMathSheet sheet = new ExtractedMathSheet();
        sheet.createdBy = createdBy;
        sheet.title = title;
        sheet.sourceFileName = sourceFileName;
        int order = 1;
        for (ItemSpec spec : specs) {
            sheet.items.add(ExtractedMathItem.of(
                    sheet, order++, spec.questionNumber(), spec.imageUrl(),
                    spec.points(), spec.type(), spec.answer(), spec.subject(),
                    spec.text(), spec.hasFigure(), spec.needsReview()
            ));
        }
        return sheet;
    }

    public int itemCount() {
        return items.size();
    }

    /** 문항 구성 입력값. */
    public record ItemSpec(Integer questionNumber, String imageUrl, Integer points,
                           String type, String answer, String subject,
                           String text, boolean hasFigure, boolean needsReview) {}
}
