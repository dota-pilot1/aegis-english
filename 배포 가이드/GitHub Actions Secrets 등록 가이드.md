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

2026-07-03 기준으로 아래 값은 이미 등록되어 있다.

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_ID
APPLE_SIGNING_IDENTITY
APPLE_TEAM_ID
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

아직 등록해야 하는 값은 아래 1개다.

```text
APPLE_PASSWORD
```

`APPLE_PASSWORD`는 Apple ID 실제 비밀번호가 아니라 app-specific password다.

## APPLE_PASSWORD 발급

Apple Account 화면:

```text
https://account.apple.com/account/manage
```

경로:

```text
Sign-In and Security -> App-Specific Passwords -> Generate an app-specific password
```

권장 label:

```text
AEGIS English GitHub Actions
```

발급된 값을 GitHub Repository secret `APPLE_PASSWORD`로 등록한다.

GitHub 화면:

```text
https://github.com/dota-pilot1/aegis-english/settings/secrets/actions
```

또는 CLI:

```bash
gh secret set APPLE_PASSWORD --repo dota-pilot1/aegis-english
```

## 로컬 복붙용 파일

값이 필요한 경우 로컬 전용 파일을 확인한다. 이 파일은 git에 올라가지 않는다.

```text
배포 가이드/Apple_secrets_복붙용.md
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
