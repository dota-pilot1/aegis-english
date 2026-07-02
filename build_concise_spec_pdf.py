# -*- coding: utf-8 -*-
"""Create a concise EnglishAgentHub technical spec PDF."""
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = "/Users/terecal/english-agent-hub-container/output/pdf/EnglishAgentHub_스펙명세서_간결판.pdf"
FONT = "/System/Library/Fonts/Supplemental/AppleGothic.ttf"

pdfmetrics.registerFont(TTFont("AppleGothic", FONT))

INDIGO = colors.HexColor("#3730a3")
SLATE = colors.HexColor("#334155")
GREY = colors.HexColor("#64748b")
LINE = colors.HexColor("#cbd5e1")
BG = colors.HexColor("#f8fafc")
INDIGO_BG = colors.HexColor("#eef2ff")
GREEN_BG = colors.HexColor("#ecfdf5")
WHITE = colors.white

styles = getSampleStyleSheet()


def style(name, **kw):
    base = dict(fontName="AppleGothic", fontSize=9.2, leading=13.5, textColor=SLATE)
    base.update(kw)
    return ParagraphStyle(name, **base)


TITLE = style("title", fontSize=25, leading=31, textColor=INDIGO, alignment=TA_CENTER)
SUB = style("sub", fontSize=11, leading=16, textColor=GREY, alignment=TA_CENTER)
H1 = style("h1", fontSize=14.5, leading=20, textColor=INDIGO, spaceBefore=8, spaceAfter=6)
H2 = style("h2", fontSize=10.8, leading=15, textColor=SLATE, spaceBefore=6, spaceAfter=3)
BODY = style("body", spaceAfter=4)
SMALL = style("small", fontSize=8, leading=11.5, textColor=GREY)
CELL = style("cell", fontSize=8.2, leading=11.5)
HEAD = style("head", fontSize=8.2, leading=11, textColor=WHITE)

story = []


def p(text, s=BODY):
    story.append(Paragraph(text, s))


def h1(text):
    story.append(Paragraph(text, H1))
    story.append(HRFlowable(width="100%", thickness=1.1, color=INDIGO, spaceAfter=5))


def h2(text):
    story.append(Paragraph(text, H2))


def bullets(items):
    for item in items:
        p(f"• {item}", style("bullet", fontSize=8.9, leading=13.2, leftIndent=10))


def kv(rows, c0=36 * mm):
    data = [[Paragraph(k, style("k", fontSize=8.2, textColor=INDIGO, leading=11.5)), Paragraph(v, CELL)] for k, v in rows]
    table = Table(data, colWidths=[c0, None], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), INDIGO_BG),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 5))


def table(headers, rows, widths):
    data = [[Paragraph(h, HEAD) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(v), CELL) for v in row])
    t = Table(data, colWidths=widths, repeatRows=1)
    styles_ = [
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(2, len(data), 2):
        styles_.append(("BACKGROUND", (0, i), (-1, i), BG))
    t.setStyle(TableStyle(styles_))
    story.append(t)
    story.append(Spacer(1, 6))


def note(text):
    t = Table([[Paragraph(text, style("note", fontSize=8.6, leading=12.5))]], colWidths=[None])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_BG),
                ("LINEBEFORE", (0, 0), (0, -1), 3, colors.HexColor("#059669")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 6))


story.append(Spacer(1, 26))
p("EnglishAgentHub", TITLE)
p("기술 스펙 명세서 - 간결판", style("cover2", fontSize=15, leading=22, textColor=SLATE, alignment=TA_CENTER))
story.append(Spacer(1, 8))
story.append(HRFlowable(width="42%", thickness=1.1, color=INDIGO, hAlign="CENTER"))
story.append(Spacer(1, 12))
p("AI 영어 학습 · 문제 은행 · 시험 출제/응시 플랫폼", SUB)
story.append(Spacer(1, 14))
kv(
    [
        ("도메인", "dxline-tallent.com"),
        ("Frontend", "Next.js 16 · React 19 · TypeScript · Tailwind v4"),
        ("Backend", "Spring Boot 4 · Java 21 · Spring AI"),
        ("DB", "PostgreSQL + pgvector"),
        ("인증", "JWT Stateless · RBAC · 사용자별 OpenAI API Key 암호화"),
        ("작성일", "2026-06-23"),
    ],
    c0=30 * mm,
)

h1("1. 개요")
p(
    "EnglishAgentHub는 AI 영어 학습과 문제 은행/시험 운영을 한곳에서 제공하는 웹 플랫폼이다. "
    "영어 회화 에이전트, 번역, 표현 피드백, 음성 학습을 제공하고, PDF/이미지 문항 추출부터 시험지 생성, 응시, 자동 채점, 결과 분석, 오답노트까지 지원한다."
)
bullets(
    [
        "<b>AI 학습</b>: 에이전트 채팅, 한영/영한 번역, 표현 피드백, 답변 추천, 뉴스 학습, TTS/STT, Realtime Voice",
        "<b>문제 은행</b>: 문항 CRUD, AI 유사 문항 생성, PDF/수학 문항 추출, pgvector 유사 검색",
        "<b>시험</b>: 시험지 생성/게시/마감, 응시 재개, 자동 채점, 결과 분석, 오답노트",
        "<b>관리</b>: 회원/프로필, 사용자 OpenAI API Key, 역할/권한, 메뉴/사이트 설정",
    ]
)

h1("2. 기술 스택")
kv(
    [
        ("프론트엔드", "Next.js 16.1.4, React 19.2.3, TypeScript 5, Tailwind CSS v4, TanStack Query, Axios, Zod, react-hook-form"),
        ("UI/기능", "Radix UI, AG Grid, Framer Motion, dnd-kit, KaTeX, i18next, socket.io-client"),
        ("백엔드", "Spring Boot 4.0.5, Java 21, Gradle, Spring Security, JPA/Hibernate, SpringDoc OpenAPI"),
        ("AI/문서/저장", "Spring AI OpenAI 2.0.0-M7, PDFBox 3.0.3, AWS S3 SDK 2.29"),
        ("데이터베이스", "PostgreSQL(localhost:5436/english_agent_hub), pgvector, 로컬 계정 postgres/postgres"),
    ],
    c0=32 * mm,
)

h1("3. 아키텍처")
arch = [
    ["Frontend", "Next.js 정적 빌드 · S3/CloudFront · dev 3300"],
    ["Reverse Proxy", "Nginx가 /api 요청을 Spring Boot로 전달"],
    ["Backend", "Spring Boot API · local 3301 / prod 4301 · Spring AI 통해 OpenAI 호출"],
    ["Database", "PostgreSQL 5436 + pgvector · 문항 임베딩 및 유사 검색"],
]
table(["구성", "역할"], arch, [32 * mm, None])

h1("4. 인증/보안")
kv(
    [
        ("인증 방식", "Spring Security + JWT Stateless. Authorization: Bearer 토큰을 요청마다 검증"),
        ("토큰", "Access 30분, Refresh 7일. Refresh는 /api/auth/refresh에서 회전"),
        ("권한", "Role/Permission N:M 구조, @EnableMethodSecurity 및 @PreAuthorize 적용"),
        ("공개 API", "/api/auth/signup, /login, /refresh, /check-email, GET /api/agents/**, /api/site-settings, /api/menus, Swagger/OpenAPI, OPTIONS"),
        ("API Key", "사용자 OpenAI API Key는 AES-GCM 256bit로 암호화 저장. /api/users/me/api-key에서 조회(마스킹)/저장/삭제/검증"),
    ],
    c0=32 * mm,
)
table(
    ["Base", "주요 엔드포인트"],
    [
        ["/api/auth", "POST /signup, /login, /refresh, /logout · GET /check-email, /me"],
        ["/api/users/me/api-key", "GET 마스킹 조회 · PUT 저장 · DELETE 삭제 · POST /openai/validate"],
    ],
    [45 * mm, None],
)

h1("5. 핵심 도메인 API")
note("관리성 API는 기본적으로 ADMIN 권한으로 보호된다. 학생 응시/결과 조회는 인증 사용자 기준으로 제한한다.")
table(
    ["도메인", "Base API", "핵심 기능"],
    [
        ["문항", "/api/questions", "목록/상세/생성/수정/삭제, 임베딩 생성, 유사 문항 검색, AI 유사 독해 문항 생성"],
        ["카테고리", "/api/categories", "self-reference 트리 기반 문항 분류"],
        ["PDF 독해 추출", "/api/extracted-sheets", "PDF 업로드, 독해 문항 추출, 추출 시트 조회/삭제"],
        ["수학 이미지 추출", "/api/extracted-math-sheets", "수학 PDF 문항 이미지 분할, answerFile 옵션, 시트 조회/삭제"],
        ["정형 수학 추출", "/api/structured-math-sheets", "202 + jobId 비동기 추출, /jobs/{jobId} 폴링, LaTeX 전사 및 도형 분리"],
        ["시험지", "/api/exams", "DRAFT 생성/수정, AI 변형본 생성, 게시(PUBLISHED), 마감(CLOSED), 삭제"],
        ["응시/채점", "/api/attempts", "응시 시작/재개, 제출 및 자동 채점, 결과/이력 조회, 관리자 응시 내역 관리"],
        ["공개 시험", "/api/practice/exams", "PUBLISHED 시험만 학생에게 노출"],
    ],
    [30 * mm, 48 * mm, None],
)

h2("시험 흐름")
p("문항 등록/추출 → 임베딩/유사 검색 → 시험지 구성(DRAFT) → 게시(PUBLISHED) → 응시 시작/제출 → 자동 채점 → 결과 분석/오답노트 → 마감(CLOSED)")

h1("6. 기타 API")
table(
    ["영역", "Controller / API"],
    [
        ["AI 채팅/학습", "AiChatController, LearningAgentController, RealtimeController (/api/ai, /api/agents, /api/realtime)"],
        ["어휘", "EnglishVocabularyController"],
        ["파일", "UploadController: S3 업로드 및 presigned URL"],
        ["사용자/RBAC", "UserManagementController, UserApiKeyController, RoleController, PermissionController, PermissionCategoryController"],
        ["UI/캐릭터", "MenuController (/api/menus), SiteSettingController (/api/site-settings), CharacterController: AI 에이전트 NPC"],
    ],
    [32 * mm, None],
)

h1("7. 배포/외부 연동")
kv(
    [
        ("운영", "Frontend S3 + CloudFront(443), Backend EC2 + systemd(4301), Nginx Reverse Proxy, PostgreSQL Docker + pgvector(5436)"),
        ("AWS S3", "region ap-northeast-2, prefix english-agent-hub, presign 300s"),
        ("OpenAI", "Chat gpt-5-mini, Embedding text-embedding-3-small, 번역 gpt-5-nano, STT gpt-4o-mini-transcribe, Realtime gpt-realtime-2 voice marin"),
        ("업로드 제한", "multipart 25MB"),
        ("주의", "BeautyBook에서 인계된 인프라라 일부 S3 버킷명/잔재에 beauty-book 흔적이 있어도 정상"),
    ],
    c0=32 * mm,
)

story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.5, color=LINE))
p("EnglishAgentHub 기술 스펙 명세서 간결판 · 2026-06-23", SMALL)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("AppleGothic", 7.5)
    canvas.setFillColor(GREY)
    canvas.line(18 * mm, 15 * mm, A4[0] - 18 * mm, 15 * mm)
    canvas.drawString(18 * mm, 10.5 * mm, "EnglishAgentHub · 기술 스펙 간결판")
    canvas.drawRightString(A4[0] - 18 * mm, 10.5 * mm, str(doc.page))
    canvas.restoreState()


doc = SimpleDocTemplate(
    OUT,
    pagesize=A4,
    leftMargin=18 * mm,
    rightMargin=18 * mm,
    topMargin=18 * mm,
    bottomMargin=19 * mm,
    title="EnglishAgentHub 기술 스펙 명세서 간결판",
    author="EnglishAgentHub",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
