# -*- coding: utf-8 -*-
"""EnglishAgentHub 프로젝트 스펙 PDF 생성기"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# 한국어 CID 폰트 등록 (reportlab 내장 — TTF 불필요)
pdfmetrics.registerFont(UnicodeCIDFont('HYSMyeongJo-Medium'))   # 명조 (serif)
pdfmetrics.registerFont(UnicodeCIDFont('HYGothic-Medium'))      # 고딕 (sans)
BODY = 'HYGothic-Medium'
SERIF = 'HYSMyeongJo-Medium'

# 색상 팔레트
INDIGO = colors.HexColor('#3730a3')
INDIGO_LT = colors.HexColor('#eef2ff')
SLATE = colors.HexColor('#334155')
SLATE_LT = colors.HexColor('#f1f5f9')
GREY = colors.HexColor('#64748b')
LINE = colors.HexColor('#cbd5e1')
EMERALD = colors.HexColor('#047857')
EMERALD_LT = colors.HexColor('#ecfdf5')
AMBER_LT = colors.HexColor('#fffbeb')
WHITE = colors.white

styles = getSampleStyleSheet()

def S(name, **kw):
    base = dict(fontName=BODY, leading=15)
    base.update(kw)
    return ParagraphStyle(name, **base)

TitleStyle   = S('t', fontName=SERIF, fontSize=26, textColor=INDIGO, alignment=TA_CENTER, leading=32)
SubTitle     = S('st', fontSize=12.5, textColor=GREY, alignment=TA_CENTER, leading=18)
H1           = S('h1', fontSize=16, textColor=INDIGO, leading=22, spaceBefore=4, spaceAfter=8)
H2           = S('h2', fontSize=12.5, textColor=SLATE, leading=18, spaceBefore=10, spaceAfter=5)
Body         = S('b', fontSize=9.7, textColor=SLATE, leading=15.5, spaceAfter=4)
Small        = S('sm', fontSize=8.6, textColor=GREY, leading=12.5)
CellHead     = S('ch', fontSize=8.7, textColor=WHITE, leading=11.5)
Cell         = S('cl', fontSize=8.5, textColor=SLATE, leading=11.5)
CellMono     = S('cm', fontName='Courier', fontSize=8.2, textColor=colors.HexColor('#0f172a'), leading=11)
CellMonoW    = S('cmw', fontName='Courier-Bold', fontSize=8.2, textColor=WHITE, leading=11)
Bullet       = S('bl', fontSize=9.6, textColor=SLATE, leading=15, leftIndent=12, spaceAfter=2)

story = []

def hr(color=LINE, w=0.8, space=6):
    story.append(Spacer(1, space))
    story.append(HRFlowable(width='100%', thickness=w, color=color, spaceAfter=space))

def h1(txt, num=None):
    label = f'{num}. {txt}' if num else txt
    story.append(Spacer(1, 4))
    story.append(Paragraph(label, H1))
    story.append(HRFlowable(width='100%', thickness=1.4, color=INDIGO, spaceAfter=8))

def h2(txt):
    story.append(Paragraph(txt, H2))

def body(txt):
    story.append(Paragraph(txt, Body))

def bullets(items):
    for it in items:
        story.append(Paragraph(f'• {it}', Bullet))

def kv_table(rows, c0=38*mm):
    """key/value 2열 테이블"""
    data = [[Paragraph(k, S('k', fontSize=8.8, textColor=INDIGO, leading=12)),
             Paragraph(v, Cell)] for k, v in rows]
    t = Table(data, colWidths=[c0, None])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), INDIGO_LT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t)

def api_table(rows, widths, header=('Method', 'Path', '설명')):
    """API 엔드포인트 테이블. rows: [(method, path, desc), ...]"""
    method_color = {
        'GET': colors.HexColor('#2563eb'), 'POST': colors.HexColor('#059669'),
        'PUT': colors.HexColor('#d97706'), 'DELETE': colors.HexColor('#dc2626'),
        'PATCH': colors.HexColor('#7c3aed'),
    }
    data = [[Paragraph(h, CellHead) for h in header]]
    styls = [
        ('BACKGROUND', (0, 0), (-1, 0), INDIGO),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    for i, (m, p, d) in enumerate(rows, start=1):
        mc = method_color.get(m, GREY)
        data.append([
            Paragraph(m, S('m', fontName='Courier-Bold', fontSize=8, textColor=WHITE, leading=10, alignment=TA_CENTER)),
            Paragraph(p, CellMono),
            Paragraph(d, Cell),
        ])
        styls.append(('BACKGROUND', (0, i), (0, i), mc))
        if i % 2 == 0:
            styls.append(('BACKGROUND', (1, i), (-1, i), colors.HexColor('#f8fafc')))
    t = Table(data, colWidths=widths)
    t.setStyle(TableStyle(styls))
    story.append(t)

def note(txt, bg=AMBER_LT, bar=colors.HexColor('#f59e0b')):
    p = Paragraph(txt, S('n', fontSize=8.8, textColor=SLATE, leading=13))
    t = Table([[p]], colWidths=[None])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('LINEBEFORE', (0, 0), (0, -1), 3, bar),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(Spacer(1, 4))
    story.append(t)
    story.append(Spacer(1, 4))

# ============================================================ 표지
story.append(Spacer(1, 70))
story.append(Paragraph('EnglishAgentHub', TitleStyle))
story.append(Spacer(1, 8))
story.append(Paragraph('프로젝트 기술 스펙 명세서', S('ts2', fontName=SERIF, fontSize=16, textColor=SLATE, alignment=TA_CENTER, leading=22)))
story.append(Spacer(1, 14))
story.append(HRFlowable(width='40%', thickness=1.2, color=INDIGO, hAlign='CENTER'))
story.append(Spacer(1, 14))
story.append(Paragraph('AI 영어 학습 · 문제 은행 · 시험 출제/응시 플랫폼', SubTitle))
story.append(Spacer(1, 40))

cover = [
    ['도메인', 'dxline-tallent.com'],
    ['프론트엔드', 'Next.js 16 · React 19 · TypeScript · Tailwind v4'],
    ['백엔드', 'Spring Boot 4 · Java 21 · Spring AI'],
    ['데이터베이스', 'PostgreSQL (pgvector)'],
    ['인증', 'JWT Stateless · RBAC · 사용자별 API Key 암호화'],
    ['작성일', '2026-06-23'],
]
ct = Table([[Paragraph(k, S('ck', fontSize=9.5, textColor=INDIGO, leading=13)),
             Paragraph(v, S('cv', fontSize=9.5, textColor=SLATE, leading=13))] for k, v in cover],
           colWidths=[35*mm, 110*mm], hAlign='CENTER')
ct.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, -1), INDIGO_LT),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ('BOX', (0, 0), (-1, -1), 0.6, LINE),
    ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
]))
story.append(ct)
story.append(PageBreak())

# ============================================================ 1. 개요
h1('프로젝트 개요', 1)
body('<b>EnglishAgentHub</b>는 AI 기반 영어 학습과 문제 은행·시험 시스템을 통합한 웹 플랫폼이다. '
     'OpenAI(Spring AI)를 활용한 영어 회화 에이전트·번역·피드백·실시간 음성 학습을 제공하며, '
     'PDF/이미지에서 문항을 자동 추출하고(영어 독해 및 수학), 추출·등록된 문항으로 시험지를 구성해 '
     '응시·자동 채점·결과 분석·오답노트까지 수행한다. '
     '관리자는 RBAC 기반으로 사용자·역할·권한·메뉴·사이트 설정을 관리한다.')
h2('핵심 도메인')
bullets([
    '<b>AI 학습</b> — 영어 에이전트 채팅(모바일 포함), 한↔영 번역, 표현 피드백, 답변 추천, 뉴스 학습, TTS/STT, OpenAI Realtime Voice',
    '<b>문제 은행</b> — 문항 관리/생성, PDF 문항 추출, 수학 문항 추출(정형 LaTeX), 시험지 생성, 응시, 결과 분석, 오답노트',
    '<b>사용자/관리</b> — 회원가입·로그인, 프로필, 개인 OpenAI API Key 관리, 사용자/역할/권한, 메뉴/사이트 설정',
])

# ============================================================ 2. 기술 스택
h1('기술 스택', 2)
h2('프론트엔드 — english-agent-hub-front  (dev 포트 3300)')
kv_table([
    ('프레임워크', 'Next.js 16.1.4 · React 19.2.3 · TypeScript 5'),
    ('스타일', 'Tailwind CSS v4 (@tailwindcss/postcss)'),
    ('데이터', 'TanStack Query 5.90 · Axios 1.13 · Zod 4 · react-hook-form 7'),
    ('UI', 'Radix UI · AG Grid 35.3 · Framer Motion 12 · dnd-kit'),
    ('기타', 'KaTeX 0.17 (수식 렌더링) · i18next (다국어) · socket.io-client 4.8'),
])
h2('백엔드 — english-agent-hub-server  (포트 3301)')
kv_table([
    ('프레임워크', 'Spring Boot 4.0.5 · Java 21 · Gradle'),
    ('보안', 'Spring Security · jjwt 0.12.6 (JWT) · BCrypt'),
    ('데이터', 'Spring Data JPA · PostgreSQL · Hibernate (ddl-auto: update)'),
    ('AI', 'Spring AI OpenAI 2.0.0-M7 (Chat/Embedding/Realtime)'),
    ('문서/저장', 'PDFBox 3.0.3 · AWS S3 SDK 2.29 · SpringDoc OpenAPI 2.8'),
])
h2('데이터베이스 — PostgreSQL')
kv_table([
    ('로컬 연결', 'jdbc:postgresql://localhost:5436/english_agent_hub'),
    ('확장', 'pgvector (문항 임베딩 · 유사 문항 검색)'),
    ('계정', 'postgres / postgres (로컬 개발)'),
])

# ============================================================ 3. 아키텍처
h1('시스템 아키텍처', 3)
arch = [
    ['Next.js (3300/443)', '→', 'Nginx (Reverse Proxy)'],
    ['', '↓', ''],
    ['Spring Boot API (3301/4301)', '↔', 'Spring AI → OpenAI'],
    ['', '↓', ''],
    ['PostgreSQL (5436) + pgvector', '', ''],
]
at = Table(arch, colWidths=[70*mm, 18*mm, 62*mm], hAlign='CENTER')
at.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, -1), BODY), ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TEXTCOLOR', (0, 0), (-1, -1), SLATE),
    ('BACKGROUND', (0, 0), (0, 0), INDIGO_LT),
    ('BACKGROUND', (0, 2), (0, 2), INDIGO_LT),
    ('BACKGROUND', (2, 2), (2, 2), EMERALD_LT),
    ('BACKGROUND', (0, 4), (0, 4), SLATE_LT),
    ('BOX', (0, 0), (0, 0), 0.6, INDIGO), ('BOX', (0, 2), (0, 2), 0.6, INDIGO),
    ('BOX', (2, 2), (2, 2), 0.6, EMERALD), ('BOX', (0, 4), (0, 4), 0.6, GREY),
    ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
]))
story.append(at)
story.append(Spacer(1, 8))
body('프론트는 정적 빌드되어 CDN(S3 + CloudFront)에서 서빙되고, API 호출은 Nginx가 Spring Boot로 리버스 프록시한다. '
     'AI 기능은 백엔드의 Spring AI가 OpenAI를 호출하며, 문항 임베딩/유사 검색은 PostgreSQL + pgvector로 처리한다.')

story.append(PageBreak())

# ============================================================ 4. 인증·인가
h1('인증 · 인가 구조', 4)
body('Spring Security 기반의 <b>JWT Stateless</b> 인증을 사용한다. 세션을 두지 않고(SessionCreationPolicy.STATELESS), '
     '요청마다 Authorization 헤더의 Bearer 토큰을 검증한다.')

h2('JWT 토큰 발급/검증')
kv_table([
    ('Provider', 'JwtTokenProvider — HMAC-SHA256 서명 (256bit 키, jwt.secret SHA-256 파생)'),
    ('Filter', 'JwtAuthenticationFilter (OncePerRequestFilter) — Bearer 추출·검증·SecurityContext 주입'),
    ('Access Token', '만료 30분. claims: userId, email, username, role, permissions, type'),
    ('Refresh Token', '만료 7일. claims: userId, type. /api/auth/refresh 로 회전(rotation)'),
    ('세션 정책', 'STATELESS — CSRF/FormLogin/HTTP Basic 비활성, CORS 다중 오리진'),
], c0=32*mm)

h2('역할 · 권한 (RBAC)')
kv_table([
    ('Role', 'code(unique)·name·description·systemRole · permissions(N:M)'),
    ('Permission', 'code(unique)·name·description·category(PermissionCategory)'),
    ('적용', "@EnableMethodSecurity · @PreAuthorize(\"hasRole('ADMIN')\") · authorizeHttpRequests"),
], c0=32*mm)

h2('공개(인증 불필요) 엔드포인트')
bullets([
    'POST /api/auth/signup · /login · /refresh · /check-email',
    'GET /api/agents/** · /api/site-settings · /api/menus (읽기)',
    'GET /swagger-ui/** · /v3/api-docs/** · 모든 OPTIONS',
])

h2('사용자별 OpenAI API Key 암호화')
body('사용자가 등록한 OpenAI API Key는 평문 저장하지 않고 <b>AES-GCM(256bit)</b>으로 암호화해 보관한다.')
kv_table([
    ('저장 필드', 'User.openAiApiKeyEncrypted (TEXT)'),
    ('암호화기', 'ApiKeyCipher — 키는 app.security.api-key-secret 의 SHA-256 파생'),
    ('방식', 'IV 12바이트(매회 랜덤) · 128bit 태그 · 출력 base64(IV‖ciphertext+tag)'),
    ('관리 API', '/api/users/me/api-key — GET(마스킹) · PUT(저장) · DELETE · POST /openai/validate'),
], c0=32*mm)

h2('인증 엔드포인트 — /api/auth')
api_table([
    ('POST', '/signup', '회원가입 (기본 역할 부여) → SignupResponse'),
    ('POST', '/login', '로그인 → TokenResponse (access + refresh)'),
    ('POST', '/refresh', 'Refresh 토큰 회전 → 신규 TokenResponse'),
    ('POST', '/logout', 'Refresh 토큰 무효화'),
    ('GET', '/check-email', '이메일 사용 가능 여부'),
    ('GET', '/me', '현재 사용자 요약'),
], widths=[18*mm, 40*mm, None])

story.append(PageBreak())

# ============================================================ 5. 문제 은행 (핵심)
h1('문제 은행 도메인 & API', 5)
note('이 장이 본 명세의 핵심이다. 문항 관리 → AI 생성/유사 검색 → PDF·수학 문항 추출 → 시험지 구성 → 응시·채점 → '
     '결과 분석/오답노트로 이어지는 전체 파이프라인을 다룬다. 모든 관리 API는 기본적으로 '
     "@PreAuthorize(\"hasRole('ADMIN')\")로 보호된다.", bg=INDIGO_LT, bar=INDIGO)

# 5.1 문항
h2('5.1  문항 관리 · AI 생성 — QuestionController  (/api/questions)')
api_table([
    ('GET', '/', '문항 목록 (categoryId·difficulty·keyword 필터)'),
    ('GET', '/{id}', '문항 단건 조회 (전체 내용)'),
    ('POST', '/', '문항 생성 (QuestionUpsertRequest)'),
    ('PUT', '/{id}', '문항 수정'),
    ('DELETE', '/{id}', '문항 삭제'),
    ('POST', '/embed-pending', 'PENDING/FAILED 문항 일괄 임베딩 (limit=50)'),
    ('POST', '/{id}/embed', '단건 임베딩 생성'),
    ('GET', '/{id}/similar', '유사 문항 검색 (벡터, limit=10)'),
    ('POST', '/{id}/generate-similar-reading', '해당 문항 템플릿으로 유사 독해 문항 생성'),
    ('POST', '/generate-similar-reading', '샘플 템플릿으로 유사 독해 문항 생성'),
    ('GET', '/embedding-status', '임베딩 상태 카운트 (categoryId 옵션)'),
], widths=[16*mm, 56*mm, None])
story.append(Spacer(1, 3))
story.append(Paragraph('DTO/서비스: QuestionResponse · QuestionUpsertRequest · QuestionDifficulty(enum) · '
    'QuestionEmbeddingService(OpenAI 임베딩+시맨틱 검색) · QuestionGenerationService(AI 변형 생성)', Small))

# 5.2 카테고리
h2('5.2  문항 카테고리 — CategoryController  (/api/categories)')
body('무한 트리(self-reference) 구조로 문항 분류를 관리한다. 문항은 categoryId로 분류·필터된다.')

# 5.3 PDF 추출
h2('5.3  PDF 문항 추출 — ExtractedSheetController  (/api/extracted-sheets)')
api_table([
    ('POST', '/', 'PDF 업로드 → 독해 문항 추출 (multipart, 동기) → ExtractedSheetResponse'),
    ('GET', '/', '추출 시트 목록 (카드)'),
    ('GET', '/{id}', '시트 단건 (추출 문항 포함)'),
    ('DELETE', '/{id}', '시트 삭제'),
], widths=[16*mm, 26*mm, None])

# 5.4 수학 추출 (legacy)
h2('5.4  수학 문항 추출(이미지형) — ExtractedMathSheetController  (/api/extracted-math-sheets)')
api_table([
    ('POST', '/', '수학 PDF 업로드 → 문항 이미지 분할 (multipart, answerFile 옵션, 동기)'),
    ('GET', '/', '수학 추출 시트 목록'),
    ('GET', '/{id}', '시트 단건 (문항 이미지 포함)'),
    ('DELETE', '/{id}', '시트 삭제'),
], widths=[16*mm, 26*mm, None])

# 5.5 정형 수학 추출 (신규)
h2('5.5  정형 수학 추출(LaTeX+도형, 비동기) — StructuredMathSheetController  (/api/structured-math-sheets)')
api_table([
    ('POST', '/', '수학 PDF 업로드 → 비동기 추출 잡 시작 (202 + jobId)'),
    ('GET', '/jobs/{jobId}', '잡 상태 폴링 (PENDING/IN_PROGRESS/COMPLETED/FAILED + result)'),
    ('GET', '/', '완료된 정형 시트 목록'),
    ('GET', '/{id}', '시트 단건 (LaTeX 전사 + 도형 분리)'),
    ('DELETE', '/{id}', '시트 삭제'),
], widths=[16*mm, 32*mm, None])
note('Vision 모델로 수식을 LaTeX로 전사하고 도형을 분리한다. 504 회피를 위해 <b>Async Request-Reply</b> 패턴'
     '(202 + jobId + 상태 폴링)으로 동작하며, 프론트는 시험지형/퀴즈형 미리보기와 URL 해시 딥링크·문항 네비게이터를 제공한다.',
     bg=EMERALD_LT, bar=EMERALD)

story.append(PageBreak())

# 5.6 시험지
h2('5.6  시험지 — ExamController  (/api/exams)')
api_table([
    ('GET', '/', '시험지 목록 (전체 상태)'),
    ('GET', '/{id}', '시험지 단건 (문항/섹션 포함)'),
    ('POST', '/', '문항으로 시험지 생성 → DRAFT'),
    ('PUT', '/{id}', '시험지 수정 (DRAFT 한정)'),
    ('POST', '/{id}/generate-variant', 'AI 유사 변형본 생성 (새 DRAFT 복제)'),
    ('POST', '/{id}/publish', '게시 (DRAFT → PUBLISHED)'),
    ('POST', '/{id}/close', '마감 (PUBLISHED → CLOSED, 응시 종료)'),
    ('DELETE', '/{id}', '시험지 삭제'),
], widths=[16*mm, 50*mm, None])
story.append(Spacer(1, 2))
story.append(Paragraph('상태: DRAFT → PUBLISHED → CLOSED · DTO: ExamResponse / ExamUpsertRequest · '
    '서비스: ExamService · ExamVariantService(AI 변형). 분류는 ExamCategoryController가 담당.', Small))

# 5.7 응시/채점
h2('5.7  응시 · 자동 채점 — ExamAttemptController  (/api/attempts)')
api_table([
    ('POST', '/start/{examId}', '응시 시작/재개 → ExamTakeResponse (정답 미포함)  · 인증'),
    ('GET', '/{attemptId}/take', '응시 화면 조회 (문항, 타이머)  · 인증'),
    ('POST', '/{attemptId}/submit', '답안 제출 & 자동 채점 → AttemptResultResponse  · 인증'),
    ('GET', '/{attemptId}/result', '결과 조회 (본인/관리자)  · 인증'),
    ('GET', '/me', '내 응시 이력 (AttemptSummaryResponse[])  · 인증'),
    ('GET', '/exam/{examId}', '특정 시험의 전체 응시 내역  · ADMIN'),
    ('DELETE', '/{attemptId}', '응시 기록 삭제  · ADMIN'),
], widths=[16*mm, 40*mm, None])
story.append(Spacer(1, 2))
story.append(Paragraph('DTO: ExamTakeResponse(정답 제외 문항) · AttemptSubmitRequest(questionId→답) · '
    'AttemptResultResponse(점수·등급·문항별 분석·오답노트·소요시간) · AttemptSummaryResponse(카드). '
    '서비스: ExamAttemptService(응시 생명주기 · 자동 채점/스코어링).', Small))

h2('5.8  결과 분석 · 오답노트')
body('응시 제출 시 자동 채점되어 <b>점수·등급·문항별 정오 분석·소요 시간</b>이 산출되며, 틀린 문항은 '
     '<b>오답노트(AttemptResultResponse 내)</b>로 제공된다. 학생용 공개 시험 목록은 PracticeExamController(/api/practice/exams)가 '
     'PUBLISHED 시험만 노출한다.')

# ============================================================ 6. 기타 API
h1('기타 도메인 API', 6)
two = [
    ('AI 채팅/학습', 'AiChatController · LearningAgentController · RealtimeController (/api/ai, /api/agents, /api/realtime)'),
    ('어휘 참조', 'EnglishVocabularyController'),
    ('파일 업로드', 'UploadController (S3 연동, presigned URL)'),
    ('사용자 관리', 'UserManagementController · UserApiKeyController (/api/users)'),
    ('RBAC 관리', 'RoleController · PermissionController · PermissionCategoryController'),
    ('UI 설정', 'MenuController (/api/menus) · SiteSettingController (/api/site-settings)'),
    ('캐릭터', 'CharacterController (AI 에이전트 NPC)'),
]
kv_table(two, c0=32*mm)

# ============================================================ 7. 배포
h1('배포 구조', 7)
h2('운영 환경 (dxline-tallent.com)')
kv_table([
    ('Frontend', 'S3 + CloudFront (정적 배포) — 443'),
    ('Backend', 'EC2 + systemd (Spring Boot) — 4301'),
    ('Reverse Proxy', 'Nginx'),
    ('Database', 'PostgreSQL (Docker, pgvector) — 5436'),
])
note('운영 백엔드는 SERVER_PORT=4301로 구동되며 PostgreSQL은 pgvector 확장이 필수다. '
     '본 인프라는 BeautyBook에서 인계받아 dxline-tallent.com 도메인을 사용한다 (S3 버킷명·잔재에 beauty-book 흔적이 남아있어도 정상).')

h2('외부 연동')
kv_table([
    ('AWS S3', 'region ap-northeast-2 · prefix english-agent-hub · presign 300s'),
    ('OpenAI Chat', 'gpt-5-mini (Spring AI)'),
    ('OpenAI Embedding', 'text-embedding-3-small (문항 벡터)'),
    ('OpenAI 번역', 'gpt-5-nano'),
    ('OpenAI STT', 'gpt-4o-mini-transcribe'),
    ('OpenAI Realtime', 'gpt-realtime-2 · voice: marin'),
    ('업로드 제한', 'multipart 25MB'),
], c0=38*mm)

story.append(Spacer(1, 18))
story.append(HRFlowable(width='100%', thickness=0.6, color=LINE))
story.append(Spacer(1, 6))
story.append(Paragraph('EnglishAgentHub 프로젝트 기술 스펙 명세서 · 2026-06-23 · 실제 코드베이스 기준 검증',
    S('foot', fontSize=8, textColor=GREY, alignment=TA_CENTER, leading=12)))

# ============================================================ 빌드
def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(BODY, 8)
    canvas.setFillColor(GREY)
    canvas.drawRightString(A4[0]-18*mm, 12*mm, f'{doc.page}')
    canvas.drawString(18*mm, 12*mm, 'EnglishAgentHub · 기술 스펙')
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(18*mm, 15*mm, A4[0]-18*mm, 15*mm)
    canvas.restoreState()

doc = SimpleDocTemplate(
    '/Users/terecal/english-agent-hub-container/EnglishAgentHub_스펙명세서.pdf',
    pagesize=A4,
    leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=20*mm,
    title='EnglishAgentHub 프로젝트 기술 스펙 명세서', author='EnglishAgentHub',
)
doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=footer)
print('OK')
