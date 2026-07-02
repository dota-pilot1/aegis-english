# AEGIS English Tauri

English Agent Hub web app의 데스크톱 버전입니다. 현재 백엔드 API를 재사용하는 Tauri 2 + Vite + React 앱입니다.

## Run

```bash
npm install
npm run tauri dev
```

기본 API URL은 `http://localhost:3301`입니다. 인증이 필요한 API는 앱 왼쪽 설정 영역에 웹 로그인 토큰을 넣어 사용합니다.

## Build

```bash
npm run build
npm run tauri build
```

## Scope

- 영어 회화 에이전트 선택
- 텍스트 채팅
- 이미지 첨부
- 한영 모드, 히스토리, 피드백 탭
- 백엔드 미연결 시 로컬 데모 모드
