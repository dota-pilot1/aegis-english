package com.cj.englishagenthub.practice.presentation;

import com.cj.englishagenthub.exam.application.ExamService;
import com.cj.englishagenthub.exam.presentation.dto.ExamResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/practice/exams")
@RequiredArgsConstructor
@Tag(name = "Practice", description = "학습자 문제 풀이")
public class PracticeExamController {

    private final ExamService examService;

    @GetMapping
    @Operation(summary = "응시 가능한 발행 시험 목록")
    public List<ExamResponse> listPublished() {
        return examService.listPublished();
    }
}
