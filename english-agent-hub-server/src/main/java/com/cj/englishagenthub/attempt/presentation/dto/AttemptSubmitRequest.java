package com.cj.englishagenthub.attempt.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public record AttemptSubmitRequest(
        @NotNull @Valid List<Answer> answers
) {
    public record Answer(
            @NotBlank String questionId,
            String answer
    ) {}

    public Map<String, String> toMap() {
        return answers.stream()
                .collect(Collectors.toMap(
                        Answer::questionId,
                        a -> a.answer() == null ? "" : a.answer(),
                        (a, b) -> b
                ));
    }
}
