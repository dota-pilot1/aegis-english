package com.cj.englishagenthub.extraction.domain;

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
 * PDF에서 추출한 독해 문항 묶음(검수 전 원본). 정식 시험지(Exam)가 되기 전 단계로,
 * 정답·해설이 없는 상태로 보관하다가 검수 후 문제 은행으로 승격한다.
 */
@Entity
@Table(name = "extracted_sheets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExtractedSheet {

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
    private List<ExtractedSheetItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public static ExtractedSheet create(User createdBy, String title, String sourceFileName, List<ItemSpec> specs) {
        if (specs == null || specs.isEmpty()) {
            throw new IllegalArgumentException("추출된 문항이 없으면 시험지를 만들 수 없습니다.");
        }
        ExtractedSheet sheet = new ExtractedSheet();
        sheet.createdBy = createdBy;
        sheet.title = title;
        sheet.sourceFileName = sourceFileName;
        int order = 1;
        for (ItemSpec spec : specs) {
            sheet.items.add(ExtractedSheetItem.of(
                    sheet, order++, spec.questionNumber(), spec.prompt(), spec.passage(),
                    spec.choices(), spec.answer(), spec.explanation(), spec.type()
            ));
        }
        return sheet;
    }

    public int itemCount() {
        return items.size();
    }

    /** 문항 구성 입력값. */
    public record ItemSpec(Integer questionNumber, String prompt, String passage, List<String> choices,
                           String answer, String explanation, String type) {}
}
