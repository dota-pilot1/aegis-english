# GitHub Actions Secrets 등록 가이드

AEGIS English Tauri 앱을 GitHub Actions에서 자동 배포하려면 Repository secrets를 등록해야 한다.

GitHub 화면:

```text
https://github.com/dota-pilot1/aegis-english/settings/secrets/actions
```

경로:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

## 현재 등록된 값

2026-07-03 기준으로 아래 2개는 이미 등록되어 있다.

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

이 2개는 Tauri updater 산출물 서명용이다. Apple 앱 서명/공증과는 별개다.

## 추가 등록이 필요한 Apple secrets

macOS 앱을 Gatekeeper 경고 없이 열리게 하려면 아래 6개를 추가해야 한다.

| Secret name | 넣어야 하는 값 | 비고 |
| --- | --- | --- |
| `APPLE_CERTIFICATE` | Developer ID Application 인증서 `.p12` 파일을 base64 인코딩한 문자열 | 값이 길다. 줄바꿈 없이 넣는 것을 권장 |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` export 시 설정한 비밀번호 | Apple 계정 비밀번호가 아님 |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Hyunseok oh (5PRM3RRTSH)` | 로컬 keychain 기준 identity |
| `APPLE_ID` | Apple Developer 계정 이메일 | 예: Apple ID 로그인 이메일 |
| `APPLE_PASSWORD` | Apple ID app-specific password | 실제 Apple ID 비밀번호가 아님 |
| `APPLE_TEAM_ID` | `5PRM3RRTSH` | Developer Team ID |

## p12 파일 만들기

Mac의 Keychain Access에서 export한다.

1. `Keychain Access` 실행
2. 왼쪽에서 `login` keychain 선택
3. `My Certificates` 선택
4. `Developer ID Application: Hyunseok oh (5PRM3RRTSH)` 인증서 선택
5. 인증서와 private key가 같이 포함된 항목을 우클릭
6. `Export ...` 선택
7. 파일 형식은 `.p12`
8. export 비밀번호 설정

주의:

- `.p12` 파일은 Git에 올리지 않는다.
- 등록이 끝나면 임시 `.p12` 파일은 삭제한다.

## APPLE_CERTIFICATE 값 만들기

터미널에서 `.p12` 파일을 base64로 바꾼다.

```bash
base64 -i /path/to/DeveloperIDApplication.p12 | pbcopy
```

이후 GitHub에서 `APPLE_CERTIFICATE` secret을 만들고, 클립보드 값을 붙여넣는다.

줄바꿈 문제가 생기면 아래처럼 한 줄로 만든다.

```bash
base64 -i /path/to/DeveloperIDApplication.p12 | tr -d '\n' | pbcopy
```

## gh CLI로 등록하는 방법

값을 직접 터미널에 입력할 수 있다.

```bash
gh secret set APPLE_CERTIFICATE --repo dota-pilot1/aegis-english
gh secret set APPLE_CERTIFICATE_PASSWORD --repo dota-pilot1/aegis-english
gh secret set APPLE_SIGNING_IDENTITY --repo dota-pilot1/aegis-english
gh secret set APPLE_ID --repo dota-pilot1/aegis-english
gh secret set APPLE_PASSWORD --repo dota-pilot1/aegis-english
gh secret set APPLE_TEAM_ID --repo dota-pilot1/aegis-english
```

고정값은 아래처럼 넣어도 된다.

```bash
printf 'Developer ID Application: Hyunseok oh (5PRM3RRTSH)' | gh secret set APPLE_SIGNING_IDENTITY --repo dota-pilot1/aegis-english
printf '5PRM3RRTSH' | gh secret set APPLE_TEAM_ID --repo dota-pilot1/aegis-english
```

## 등록 확인

```bash
gh secret list --repo dota-pilot1/aegis-english
```

정상 등록 기준:

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_ID
APPLE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_TEAM_ID
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

## 등록 후 배포

Apple secrets를 등록한 뒤에는 Apple 서명/공증 env를 workflow에 다시 켜고 새 버전을 태그로 배포한다.

예:

```bash
git tag v0.1.7
git push origin v0.1.7
```

정상 macOS 배포 기준:

```bash
spctl -a -vv "/Applications/AEGIS English.app"
```

결과에 아래처럼 나와야 한다.

```text
source=Notarized Developer ID
```

