package com.cj.englishagenthub.question.presentation.dto;

import com.cj.englishagenthub.question.domain.EmbeddingStatus;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import com.cj.englishagenthub.question.domain.QuestionKind;
import com.cj.englishagenthub.question.domain.QuestionSourceType;
import com.cj.englishagenthub.question.domain.QuestionType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

@Schema(description = "문제 응답. 관리자 API이므로 정답과 해설을 포함한다.")
public record QuestionResponse(
        @Schema(description = "문제 ID", example = "018f6d7e-2c88-7c2a-bcb1-91f9012bc111")
        String id,
        @Schema(description = "문제 유형", example = "MULTIPLE_CHOICE")
        QuestionType questionType,
        @Schema(description = "수능형 문항 유형", example = "GRAMMAR_CHECK")
        QuestionKind questionKind,
        @Schema(description = "출처 유형", example = "MOCK")
        QuestionSourceType sourceType,
        @Schema(description = "출처명", example = "2024학년도 9월 모의고사")
        String sourceName,
        @Schema(description = "카테고리 ID", example = "12")
        Long categoryId,
        @Schema(description = "루트부터 현재 카테고리까지의 이름 경로", example = "[\"영어\", \"독해\", \"빈칸추론\"]")
        List<String> categoryPath,
        @Schema(description = "영역. 카테고리 경로에서 듣기/읽기/어휘·어법/간접 쓰기/장문 중 하나를 추출", example = "읽기")
        String area,
        @Schema(description = "듣기 영역 여부", example = "false")
        boolean listening,
        @Schema(description = "난이도", example = "medium")
        QuestionDifficulty difficulty,
        @Schema(description = "문제 본문", example = "다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?")
        String question,
        @Schema(description = "지문", example = "People often think creativity is a gift, but it can be trained through repeated practice.")
        String passage,
        @Schema(description = "객관식 보기", example = "[\"practice\", \"luck\", \"silence\", \"speed\"]")
        List<String> choices,
        @Schema(description = "정답", example = "practice")
        String answer,
        @Schema(description = "해설", example = "지문은 창의성이 반복 연습을 통해 길러질 수 있다고 설명하므로 practice가 적절하다.")
        String explanation,
        @Schema(description = "키워드", example = "[\"빈칸추론\", \"creativity\"]")
        List<String> keywords,
        @Schema(description = "임베딩 대상 텍스트", example = "creativity can be trained through repeated practice")
        String embeddingText,
        @Schema(description = "임베딩 상태", example = "PENDING")
        EmbeddingStatus embeddingStatus,
        @Schema(description = "임베딩 모델명", example = "text-embedding-3-small")
        String embeddingModel,
        @Schema(description = "임베딩 완료 시각")
        Instant embeddedAt,
        @Schema(description = "생성 시각")
        Instant createdAt,
        @Schema(description = "수정 시각")
        Instant updatedAt
) {
    public static QuestionResponse from(Question q) {
        List<String> categoryPath = q.getCategory().getPathNames();
        String area = resolveArea(categoryPath);
        return new QuestionResponse(
                q.getId(),
                q.getQuestionType(),
                q.getQuestionKind(),
                q.getSourceType(),
                q.getSourceName(),
                q.getCategory().getId(),
                categoryPath,
                area,
                "듣기".equals(area),
                q.getDifficulty(),
                q.getQuestion(),
                q.getPassage(),
                q.getChoices(),
                q.getAnswer(),
                q.getExplanation(),
                q.getKeywords(),
                q.getEmbeddingText(),
                q.getEmbeddingStatus(),
                q.getEmbeddingModel(),
                q.getEmbeddedAt(),
                q.getCreatedAt(),
                q.getUpdatedAt()
        );
    }

    private static String resolveArea(List<String> categoryPath) {
        return categoryPath.stream()
                .filter(name -> name.equals("듣기")
                        || name.equals("읽기")
                        || name.equals("어휘/어법")
                        || name.equals("간접 쓰기")
                        || name.equals("장문"))
                .findFirst()
                .orElse(null);
    }
}
