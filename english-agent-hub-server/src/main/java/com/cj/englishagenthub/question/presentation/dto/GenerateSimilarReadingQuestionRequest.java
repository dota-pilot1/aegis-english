package com.cj.englishagenthub.question.presentation.dto;

import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

@Schema(description = "독해 유사 문제 생성 요청")
public record GenerateSimilarReadingQuestionRequest(
        @Schema(description = "템플릿 ID", example = "blank-inference")
        @NotBlank String templateId,
        @Schema(description = "템플릿 제목", example = "빈칸 추론")
        @NotBlank String templateTitle,
        @Schema(description = "세부 유형", example = "빈칸에 들어갈 말")
        @NotBlank String subtype,
        @Schema(description = "생성 규칙", example = "[\"정답은 보기 중 하나와 정확히 일치\", \"지문 길이 80~120단어\"]")
        List<String> rules,
        @Schema(description = "생성 개수", example = "3", minimum = "1", maximum = "5")
        @Min(1) @Max(5) int count,
        @Schema(description = "난이도. source면 소스 문제 난이도 사용", example = "source", allowableValues = {"source", "easy", "medium", "hard"})
        @NotBlank String difficulty,
        @Schema(description = "보기 개수", example = "4", minimum = "2", maximum = "5")
        @Min(2) @Max(5) int choiceCount,
        @Schema(description = "해설 포함 여부", example = "true")
        boolean includeExplanation,
        @Schema(description = "소스 문제 주제 유지 여부", example = "true")
        boolean keepTopic,
        @Schema(description = "중복 회피 여부", example = "true")
        boolean avoidDuplicate,
        @Schema(description = "생성 문항 카테고리 ID", example = "12")
        Long categoryId,
        @Schema(description = "카테고리 경로 표시값", example = "영어 > 읽기")
        String categoryPath,
        @Schema(description = "소스 문제 난이도", example = "medium")
        QuestionDifficulty sourceDifficulty,
        @Schema(description = "소스 문제 본문", example = "다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?")
        String sourceQuestion,
        @Schema(description = "소스 지문")
        String sourcePassage,
        @Schema(description = "소스 보기")
        List<String> sourceChoices,
        @Schema(description = "소스 정답")
        String sourceAnswer,
        @Schema(description = "소스 해설")
        String sourceExplanation,
        @Schema(description = "소스 키워드")
        List<String> sourceKeywords
) {
    public QuestionDifficulty resolvedDifficulty(QuestionDifficulty sourceDifficulty) {
        if ("source".equalsIgnoreCase(difficulty)) return sourceDifficulty == null ? QuestionDifficulty.medium : sourceDifficulty;
        return QuestionDifficulty.valueOf(difficulty);
    }
}
