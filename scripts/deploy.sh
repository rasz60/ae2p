#!/usr/bin/env bash
# Oracle 서버에서 실행하는 배포 스크립트. GitHub Actions(.github/workflows/deploy.yml)가 SSH 로 부르고,
# 서버에서 직접 실행해도 된다:  bash ~/ae2p/scripts/deploy.sh
# 빌드가 실패하면 pm2 와 dist 를 건드리지 않고 멈춘다.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# 비대화형 SSH 세션은 ~/.bashrc 를 읽지 않으므로 nvm 으로 설치한 node/pm2 를 직접 잡는다
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  set -u
fi

echo "== $(date '+%F %T') 배포 시작 ($(git rev-parse --short HEAD))"
git fetch --quiet origin main
git merge --ff-only origin/main
echo "== 코드: $(git rev-parse --short HEAD)"

npm ci --no-audit --no-fund
npm run build

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "== $(date '+%F %T') 배포 완료"
