package com.cj.englishagenthub.mathextraction2.presentation.dto;

import com.cj.englishagenthub.mathextraction2.application.StructuredMathJobService;

/** 정형 추출 잡 상태(폴링 응답). status: PROCESSING | DONE | FAILED */
public record StructuredMathJobResponse(
        String status,
        String sheetId,
        String error,
        int total,
        int done
) {
    public static StructuredMathJobResponse from(StructuredMathJobService.Job job) {
        return new StructuredMathJobResponse(
                job.getState().name(),
                job.getSheetId(),
                job.getError(),
                job.getTotal().get(),
                job.getDone().get()
        );
    }
}
