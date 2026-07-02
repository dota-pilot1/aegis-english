package com.cj.englishagenthub.question.presentation.dto;

import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import com.cj.englishagenthub.question.domain.QuestionKind;
import com.cj.englishagenthub.question.domain.QuestionSourceType;
import com.cj.englishagenthub.question.domain.QuestionType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.util.StringUtils;

import java.util.List;

@Schema(description = "문제 등록/수정 요청")
public record QuestionUpsertRequest(
        @Schema(description = "문제 유형", example = "MULTIPLE_CHOICE", allowableValues = {"MULTIPLE_CHOICE", "SHORT_ANSWER"})
        @NotNull QuestionType questionType,
        @Schema(description = "수능형 문항 유형", example = "GRAMMAR_CHECK")
        QuestionKind questionKind,
        @Schema(description = "출처 유형", example = "MOCK", allowableValues = {"UNKNOWN", "CSAT", "MOCK", "CUSTOM"})
        QuestionSourceType sourceType,
        @Schema(description = "출처명", example = "2024학년도 9월 모의고사")
        String sourceName,
        @Schema(description = "문제 카테고리 ID", example = "12")
        @NotNull Long categoryId,
        @Schema(description = "난이도", example = "medium", allowableValues = {"easy", "medium", "hard"})
        @NotNull QuestionDifficulty difficulty,
        @Schema(description = "문제 본문", example = "다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?")
        @NotBlank String question,
        @Schema(description = "지문. 독해 문제 등에서 사용", example = "People often think creativity is a gift, but it can be trained through repeated practice.")
        String passage,
        @Schema(description = "객관식 보기. MULTIPLE_CHOICE일 때 2개 이상 필요", example = "[\"practice\", \"luck\", \"silence\", \"speed\"]")
        List<String> choices,
        @Schema(description = "정답. 객관식은 choices 중 하나와 정확히 일치해야 함", example = "practice")
        @NotBlank String answer,
        @Schema(description = "해설", example = "지문은 창의성이 반복 연습을 통해 길러질 수 있다고 설명하므로 practice가 적절하다.")
        @NotBlank String explanation,
        @Schema(description = "검색/분류용 키워드", example = "[\"빈칸추론\", \"creativity\"]")
        List<String> keywords,
        @Schema(description = "임베딩 생성에 사용할 텍스트. 비우면 문제/지문/정답/해설/키워드 기반으로 자동 구성", example = "creativity can be trained through repeated practice")
        String embeddingText
) {

    @JsonIgnore
    private List<String> trimmedChoices() {
        if (choices == null) return List.of();
        return choices.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .toList();
    }

    @JsonIgnore
    @AssertTrue(message = "객관식 문제는 보기를 2개 이상 입력해야 합니다.")
    public boolean isChoicesSufficientForMultipleChoice() {
        if (questionType != QuestionType.MULTIPLE_CHOICE) return true;
        return trimmedChoices().size() >= 2;
    }

    @JsonIgnore
    @AssertTrue(message = "객관식 정답은 보기 중 하나와 일치해야 합니다.")
    public boolean isAnswerContainedInChoices() {
        if (questionType != QuestionType.MULTIPLE_CHOICE) return true;
        if (!StringUtils.hasText(answer)) return true; // @NotBlank가 별도로 처리
        return trimmedChoices().contains(answer.trim());
    }

    @JsonIgnore
    @AssertTrue(message = "주관식 문제는 보기를 입력할 수 없습니다.")
    public boolean isChoicesEmptyForShortAnswer() {
        if (questionType != QuestionType.SHORT_ANSWER) return true;
        return trimmedChoices().isEmpty();
    }
}
