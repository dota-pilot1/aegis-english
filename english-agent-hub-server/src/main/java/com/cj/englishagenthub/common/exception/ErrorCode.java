package com.cj.englishagenthub.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    DUPLICATE_EMAIL(HttpStatus.CONFLICT, "AUTH_001", "이미 사용 중인 이메일입니다."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "AUTH_002", "사용자를 찾을 수 없습니다."),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "AUTH_003", "이메일 또는 비밀번호가 올바르지 않습니다."),
    ACCOUNT_INACTIVE(HttpStatus.FORBIDDEN, "AUTH_004", "비활성화된 계정입니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_005", "유효하지 않은 토큰입니다."),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_006", "유효하지 않은 리프레시 토큰입니다."),
    ROLE_NOT_FOUND(HttpStatus.NOT_FOUND, "ROLE_001", "롤을 찾을 수 없습니다."),
    ROLE_CODE_DUPLICATE(HttpStatus.CONFLICT, "ROLE_002", "이미 존재하는 롤 코드입니다."),
    ROLE_SYSTEM_READONLY(HttpStatus.BAD_REQUEST, "ROLE_003", "시스템 롤은 수정 또는 삭제할 수 없습니다."),
    ROLE_IN_USE(HttpStatus.CONFLICT, "ROLE_004", "해당 롤을 사용 중인 유저가 있어 삭제할 수 없습니다."),
    PERMISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "PERM_001", "권한을 찾을 수 없습니다."),
    PERMISSION_CODE_DUPLICATE(HttpStatus.CONFLICT, "PERM_002", "이미 존재하는 권한 코드입니다."),
    PERMISSION_CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "PCAT_001", "권한 카테고리를 찾을 수 없습니다."),
    PERMISSION_CATEGORY_CODE_DUPLICATE(HttpStatus.CONFLICT, "PCAT_002", "이미 존재하는 카테고리 코드입니다."),
    PERMISSION_CATEGORY_IN_USE(HttpStatus.CONFLICT, "PCAT_003", "해당 카테고리를 사용 중인 권한이 있어 삭제할 수 없습니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "COMMON_002", "접근 권한이 없습니다."),
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "COMMON_001", "입력값이 올바르지 않습니다."),
    UPLOAD_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "UPLOAD_001", "파일 업로드(S3)가 설정되지 않았습니다."),
    UPLOAD_INVALID_CONTENT_TYPE(HttpStatus.BAD_REQUEST, "UPLOAD_002", "허용되지 않은 파일 형식입니다."),
    OPENAI_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "AI_001", "OpenAI API 키가 설정되지 않았습니다."),
    AI_AGENT_NOT_FOUND(HttpStatus.NOT_FOUND, "AI_002", "AI 에이전트를 찾을 수 없습니다."),
    AI_REQUEST_FAILED(HttpStatus.BAD_GATEWAY, "AI_003", "AI 요청 처리 중 오류가 발생했습니다."),
    OPENAI_KEY_INVALID(HttpStatus.BAD_REQUEST, "AI_004", "유효하지 않은 OpenAI API 키입니다."),
    SITE_SETTING_NOT_FOUND(HttpStatus.NOT_FOUND, "SITE_001", "사이트 설정을 찾을 수 없습니다."),
    CHARACTER_NOT_FOUND(HttpStatus.NOT_FOUND, "CHAR_001", "캐릭터를 찾을 수 없습니다."),
    CHARACTER_NOT_OWNER(HttpStatus.FORBIDDEN, "CHAR_002", "본인이 만든 캐릭터만 수정/삭제할 수 있습니다."),
    CONVERSATION_SAVE_NOT_FOUND(HttpStatus.NOT_FOUND, "CONV_001", "저장된 대화를 찾을 수 없습니다."),
    QUESTION_NOT_FOUND(HttpStatus.NOT_FOUND, "QUES_001", "문제를 찾을 수 없습니다."),
    QUESTION_NOT_EMBEDDED(HttpStatus.BAD_REQUEST, "QUES_002", "임베딩되지 않은 문제는 유사 문제를 조회할 수 없습니다."),
    EXTRACTION_EMPTY_TEXT(HttpStatus.BAD_REQUEST, "QUES_003", "PDF에서 읽을 수 있는 텍스트가 없습니다. 스캔본이면 OCR이 필요합니다."),
    EXTRACTION_PDF_READ_FAILED(HttpStatus.BAD_REQUEST, "QUES_004", "PDF 파일을 읽지 못했습니다."),
    EXTRACTION_NO_READING(HttpStatus.UNPROCESSABLE_ENTITY, "QUES_005", "추출된 독해 문항이 없습니다."),
    EXTRACTED_SHEET_NOT_FOUND(HttpStatus.NOT_FOUND, "QUES_006", "추출 시험지를 찾을 수 없습니다."),
    MATH_EXTRACTION_NO_VISION(HttpStatus.SERVICE_UNAVAILABLE, "QUES_007", "수학 이미지 추출을 위한 Gemini Vision 키가 설정되지 않았습니다."),
    MATH_EXTRACTION_NONE(HttpStatus.UNPROCESSABLE_ENTITY, "QUES_008", "추출된 수학 문항이 없습니다."),
    EXTRACTED_MATH_SHEET_NOT_FOUND(HttpStatus.NOT_FOUND, "QUES_009", "수학 추출 시험지를 찾을 수 없습니다."),
    CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "QCAT_001", "카테고리를 찾을 수 없습니다."),
    CATEGORY_NOT_EMPTY(HttpStatus.CONFLICT, "QCAT_002", "하위 카테고리 또는 문제가 있어 삭제할 수 없습니다."),
    CATEGORY_DUPLICATE_NAME(HttpStatus.CONFLICT, "QCAT_003", "같은 위치에 동일한 이름의 카테고리가 있습니다."),
    MENU_NOT_FOUND(HttpStatus.NOT_FOUND, "MENU_001", "메뉴를 찾을 수 없습니다."),
    MENU_CODE_DUPLICATE(HttpStatus.CONFLICT, "MENU_002", "이미 존재하는 메뉴 코드입니다."),
    MENU_PARENT_NOT_FOUND(HttpStatus.NOT_FOUND, "MENU_003", "부모 메뉴를 찾을 수 없습니다."),
    EXAM_NOT_FOUND(HttpStatus.NOT_FOUND, "EXAM_001", "시험지를 찾을 수 없습니다."),
    EXAM_NOT_PUBLISHED(HttpStatus.BAD_REQUEST, "EXAM_002", "발행되지 않은 시험은 응시할 수 없습니다."),
    EXAM_HAS_NO_ITEMS(HttpStatus.BAD_REQUEST, "EXAM_003", "문항이 없는 시험은 변형할 수 없습니다."),
    EXAM_CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, "ECAT_001", "시험지 분류를 찾을 수 없습니다."),
    EXAM_CATEGORY_NOT_EMPTY(HttpStatus.CONFLICT, "ECAT_002", "하위 분류 또는 시험지가 있어 삭제할 수 없습니다."),
    EXAM_CATEGORY_DUPLICATE_NAME(HttpStatus.CONFLICT, "ECAT_003", "같은 위치에 동일한 시험지 분류가 있습니다."),
    ATTEMPT_NOT_FOUND(HttpStatus.NOT_FOUND, "ATMP_001", "응시 기록을 찾을 수 없습니다."),
    ATTEMPT_NOT_OWNER(HttpStatus.FORBIDDEN, "ATMP_002", "본인의 응시 기록만 접근할 수 있습니다."),
    ATTEMPT_ALREADY_SUBMITTED(HttpStatus.CONFLICT, "ATMP_003", "이미 제출된 응시입니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "COMMON_999", "서버 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
