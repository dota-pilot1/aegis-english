# Tauri 앱 배포 운영

AEGIS English 데스크톱 앱 릴리즈를 만들고 검증하는 절차다.

## 배포 대상

- GitHub repo: `dota-pilot1/aegis-english`
- 최신 릴리즈: `https://github.com/dota-pilot1/aegis-english/releases/latest`
- 운영 API: `https://dxline-tallent.com`
- Tauri 앱 Origin: `tauri://localhost`

## 사전 조건

GitHub Actions에서 macOS, Windows 번들을 만들려면 아래 secrets가 필요하다.

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

macOS에서 Gatekeeper 경고 없이 열리게 하려면 Apple 서명/공증 secrets도 필요하다.

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_ID
APPLE_PASSWORD
APPLE_TEAM_ID
```

Apple secrets 값 자체는 Git에 올리지 않는다. 로컬 전용 메모는 `배포 가이드/로컬_Apple_서명_공증_메모.md`에 둔다.

현재 secret 등록 여부는 아래 명령으로 확인한다.

```bash
gh secret list --repo dota-pilot1/aegis-english
```

`APPLE_*` secrets가 없으면 GitHub Actions의 macOS job은 앱 빌드 후 코드서명 단계에서 실패한다. 로컬 Mac keychain에 Developer ID 인증서가 있으면 로컬 빌드는 가능하지만, GitHub runner에는 인증서가 없으므로 repo secrets 등록이 필요하다.

2026-07-03 기준 확인된 상태:

- `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`는 등록되어 있어 Windows 릴리즈 빌드는 성공한다.
- `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`는 `aegis-english` repo에 등록해야 한다.
- 로컬 keychain에는 `Developer ID Application: Hyunseok oh (5PRM3RRTSH)` identity가 있다.

## 운영 API 확인

배포 앱은 로컬 서버가 아니라 운영 API를 바라봐야 한다.

```bash
cd english-agent-hub-tauri
npm run build
strings dist/assets/*.js | grep -E "dxline-tallent|localhost:3301|localhost:4301" || true
```

정상 기준:

- `https://dxline-tallent.com`이 보여야 한다.
- 릴리즈 빌드에서 `localhost:3301`, `localhost:4301`이 API 기본값으로 남아 있으면 안 된다.

## Tauri HTTP 권한 확인

운영 API를 Tauri HTTP plugin으로 호출하려면 capability에 운영 도메인이 들어 있어야 한다.

파일:

```text
english-agent-hub-tauri/src-tauri/capabilities/default.json
```

필수 항목:

```json
{
  "identifier": "http:default",
  "allow": [{ "url": "https://dxline-tallent.com/*" }]
}
```

## 운영 백엔드 CORS 확인

Tauri 앱 로그인은 브라우저와 Origin이 다르다. 운영 백엔드 `.env`에는 웹 도메인과 Tauri Origin이 같이 들어가야 한다.

EC2 파일:

```text
/home/ubuntu/english-agent-hub/.env
```

필수 값:

```env
ALLOWED_ORIGIN=https://dxline-tallent.com,tauri://localhost,http://tauri.localhost
```

변경 후:

```bash
sudo systemctl restart englishagenthub
```

검증:

```bash
curl -i -s -X OPTIONS "https://dxline-tallent.com/api/auth/login" \
  -H "Origin: tauri://localhost" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" | sed -n '1,80p'

curl -i -s -X POST "https://dxline-tallent.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: tauri://localhost" \
  --data '{"email":"terecal@daum.net","password":"test1234"}' | sed -n '1,80p'
```

정상 기준:

- `HTTP/2 200`
- `access-control-allow-origin: tauri://localhost`

## 릴리즈 절차

1. 변경사항을 main에 반영한다.
2. 버전을 올린다.

```bash
cd english-agent-hub-tauri
npm version patch --no-git-tag-version
```

`english-agent-hub-tauri/src-tauri/tauri.conf.json`의 `version`도 같은 값으로 맞춘다.

3. 로컬 검증을 실행한다.

```bash
npm run build
cd src-tauri
cargo check
```

4. 커밋 후 태그를 푸시한다.

```bash
git add english-agent-hub-tauri/package.json english-agent-hub-tauri/package-lock.json english-agent-hub-tauri/src-tauri/tauri.conf.json
git commit -m "Release AEGIS English v0.1.x"
git tag v0.1.x
git push origin main
git push origin v0.1.x
```

5. GitHub Actions 릴리즈 workflow 성공을 확인한다.

```bash
gh run list --repo dota-pilot1/aegis-english --limit 5
gh release view v0.1.x --repo dota-pilot1/aegis-english
```

## 설치 후 검증

macOS:

```bash
codesign -dv --verbose=4 "/Applications/AEGIS English.app" 2>&1 | sed -n '1,120p'
spctl -a -vv "/Applications/AEGIS English.app"
```

공증 전 테스트 빌드라면 quarantine 때문에 열리지 않을 수 있다. 일반 배포판은 `source=Notarized Developer ID`가 나와야 한다.

앱 내부 검증:

- 로그인 성공
- 좌하단 앱 버전이 최신 릴리즈와 일치
- 문제 관리 과목 수와 문제 수가 운영 웹과 일치
- 문제 상세 진입 가능
- 로그아웃 후 재로그인 가능

## 흔한 문제

### 로그인 403

대부분 운영 백엔드 CORS 문제다.

- 앱은 운영 API를 호출하고 있는지 확인한다.
- `ALLOWED_ORIGIN`에 `tauri://localhost`가 있는지 확인한다.
- `englishagenthub` 재시작 후 curl로 `access-control-allow-origin`을 확인한다.

### 앱이 로컬 데이터를 보는 것처럼 보임

- 오래된 `/Applications/AEGIS English.app`이 실행 중인지 확인한다.
- 좌하단 버전이 최신 릴리즈인지 확인한다.
- `strings`로 번들 안의 API URL을 확인한다.

### macOS에서 열 수 없음

Apple Developer ID 서명/공증이 안 된 빌드다.

- 테스트만 할 때는 quarantine 제거로 열 수 있다.
- 외부 배포는 Apple secrets 등록 후 새 릴리즈를 만들어야 한다.

GitHub Actions 로그에 아래 메시지가 나오면 repo의 Apple certificate secret이 없거나 잘못된 것이다.

```text
security: SecKeychainItemImport: One or more parameters passed to a function were not valid.
failed codesign application: failed to import keychain certificate
```

해결은 `APPLE_CERTIFICATE`에 p12 파일을 base64 인코딩한 값을 넣고, `APPLE_CERTIFICATE_PASSWORD`에 p12 export 비밀번호를 넣는 것이다.

### 릴리즈 asset은 있는데 앱이 업데이트되지 않음

- 같은 이름의 오래된 앱을 `/Applications`에서 삭제한다.
- DMG에서 새 앱을 다시 복사한다.
- 앱 좌하단 버전을 확인한다.
