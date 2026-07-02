package com.cj.englishagenthub.common.response;

import com.cj.englishagenthub.common.exception.ErrorCode;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(
        String code,
        String message,
        Instant timestamp,
        Map<String, String> fieldErrors
) {
    public static ErrorResponse of(ErrorCode ec) {
        return new ErrorResponse(ec.getCode(), ec.getMessage(), Instant.now(), null);
    }

    public static ErrorResponse of(ErrorCode ec, Map<String, String> fieldErrors) {
        return new ErrorResponse(ec.getCode(), ec.getMessage(), Instant.now(), fieldErrors);
    }

    /** 코드 체계는 유지하되 도메인에서 전달한 구체 메시지를 노출. */
    public static ErrorResponse of(ErrorCode ec, String message) {
        return new ErrorResponse(ec.getCode(), message, Instant.now(), null);
    }
}
