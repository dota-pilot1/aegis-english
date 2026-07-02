package com.cj.englishagenthub.mathextraction2.domain;

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
 * 수학 PDF를 '정형화'해 추출한 문항 묶음(추출기 2).
 * 이미지 추출기(A)와 달리 발문·보기를 텍스트(LaTeX 포함)로, 도형만 별도 이미지로 분리해 보관한다.
 */
@Entity
@Table(name = "structured_math_sheets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StructuredMathSheet {

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
    private List<StructuredMathItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public static StructuredMathSheet create(User createdBy, String title, String sourceFileName, List<ItemSpec> specs) {
        if (specs == null || specs.isEmpty()) {
            throw new IllegalArgumentException("추출된 문항이 없으면 시험지를 만들 수 없습니다.");
        }
        StructuredMathSheet sheet = new StructuredMathSheet();
        sheet.createdBy = createdBy;
        sheet.title = title;
        sheet.sourceFileName = sourceFileName;
        int order = 1;
        for (ItemSpec spec : specs) {
            sheet.items.add(StructuredMathItem.of(sheet, order++, spec));
        }
        return sheet;
    }

    public int itemCount() {
        return items.size();
    }

    /** 문항 구성 입력값. */
    public record ItemSpec(Integer questionNumber, String prompt, List<String> choices, String figureImageUrl,
                           String answer, Integer points, String type, String subject, boolean needsReview) {}
}
