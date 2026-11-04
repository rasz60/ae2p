# 테스트 서버 + Claude 작업실

관리자가 포털의 **Claude 작업실**(`/admin/builder`)에서 채팅 · 이미지 · 파일로 요청하면, 테스트 서버에서 Claude 가 코드를 고치고
타입체크 → 빌드 → pm2 재기동까지 합니다. 운영 서버는 건드리지 않습니다.

```
브라우저 (포털 /admin/builder)
   │  POST /api/builder/chat (multipart) → SSE 로 진행 상황
   ▼
테스트 서버 ae2p-dev.duckdns.org
   ├─ Caddy  /api/builder/* → 127.0.0.1:8095
   ├─ pm2 ae2p-builder     (server/builder.ts, Claude Agent SDK)
   │     └─ Claude: ~/ae2p 를 고치고 npm run build, pm2 restart ae2p-portal-api …
   └─ pm2 ae2p-portal-api  (재기동 대상)
```

- 작업실은 `.env` 에 `BUILDER_ENABLED=true` 가 있을 때만 뜹니다. 운영 서버 `.env` 에는 넣지 않습니다.
- 메뉴(계정 메뉴 > Claude 작업실)는 `VITE_BUILDER_ENABLED=true` 로 빌드한 웹에만 보입니다.
- 안전장치: 관리자만, 한 번에 하나의 작업, 작업 폴더 밖 · `.env` · SSH 키 접근 차단, `sudo` · `git push` · 다른 서버 접속 ·
  pm2 삭제 · 작업실 자신의 재시작 차단(PreToolUse 훅), Claude 에는 비밀 환경변수를 넘기지 않음, 요청당 비용 · 턴 상한.
  **훅은 실수를 막는 장치이지 완전한 격리가 아닙니다.** 그래서 테스트 서버에서만 돌리고, 아래 7단계(sudo 끄기)를 권합니다.

---

## 0. 먼저 내 PC 에서 써 보기 (선택)

테스트 서버가 생기기 전에도 로컬에서 작업실을 띄워 볼 수 있습니다. 이 경우 Claude 는 **이 PC 의 portal 폴더를 직접 고칩니다.**

```bash
# portal/.env 에 추가
BUILDER_ENABLED=true
VITE_BUILDER_ENABLED=true
# (선택) 다른 폴더에서 작업시키려면: BUILDER_WORK_DIR=C:/Users/devsi/ae2p-sandbox

npm run dev           # 웹  http://localhost:5173
npm run dev:server    # 포털 API
npm run dev:builder   # 작업실 http://127.0.0.1:8095 (watch 없음: Claude 가 서버 코드를 고쳐도 작업이 끊기지 않게)
```

관리자 계정으로 로그인 → 계정 메뉴 → **Claude 작업실**. `ANTHROPIC_API_KEY` 가 없으면 이 PC 의 Claude Code 로그인을 씁니다.

---

## 1. A1 인스턴스 확보 (용량 부족 대응)

오사카 리전은 가용성 도메인이 하나뿐이라, "용량 부족"이 나면 빈자리가 생길 때까지 다시 시도하는 수밖에 없습니다.
콘솔에서 몇 번 시도해 보고, 안 되면 **운영 서버에서 자동 재시도 스크립트**를 돌립니다.

### 1-1. 새 서버용 SSH 키 (내 PC)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ae2p-test -C ae2p-test
scp ~/.ssh/ae2p-test.pub ubuntu@ae2p.duckdns.org:~/
scp deploy/oci-a1-retry.sh deploy/oci-a1-retry.env.example ubuntu@ae2p.duckdns.org:~/
```

### 1-2. OCI CLI 설치 · 인증 (운영 서버)

```bash
sudo apt install -y python3-venv
python3 -m venv ~/oci-cli && ~/oci-cli/bin/pip install oci-cli
~/oci-cli/bin/oci setup config
```

`setup config` 가 묻는 값:
- **User OCID**: 콘솔 오른쪽 위 프로필 → 내 프로필 → OCID 복사
- **Tenancy OCID**: 프로필 → 테넌시 → OCID 복사
- **Region**: `ap-osaka-1`
- 새 API 키를 만들지 → `Y` (나머지는 Enter)

끝나면 공개키를 콘솔에 등록합니다: 내 프로필 → **API 키 → API 키 추가 → 공개 키 붙여넣기**에 아래 출력을 붙여 넣습니다.

```bash
cat ~/.oci/oci_api_key_public.pem
~/oci-cli/bin/oci iam availability-domain list --query 'data[].name'   # 인증 확인 + AD 이름
```

### 1-3. 스크립트 값 채우기 (운영 서버)

```bash
C=<테넌시 OCID>
~/oci-cli/bin/oci network subnet list --compartment-id $C --query 'data[].{name:"display-name",id:id}' --output table
~/oci-cli/bin/oci compute image list --compartment-id $C --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
  --shape VM.Standard.A1.Flex --sort-by TIMECREATED --sort-order DESC --limit 1 --query 'data[0].{name:"display-name",id:id}'

cp ~/oci-a1-retry.env.example ~/a1-retry.env && nano ~/a1-retry.env
```

`COMPARTMENT_ID`(테넌시 OCID), `SUBNET_ID`(운영 서버와 같은 서브넷 — 보안 목록에 80/443 이 이미 열려 있음), `IMAGE_ID`, `AD`,
`SSH_KEY_FILE=/home/ubuntu/ae2p-test.pub` 를 채웁니다. 사양 기본값은 1 OCPU / 6GB 입니다.

### 1-4. 돌리기

```bash
nohup bash ~/oci-a1-retry.sh ~/a1-retry.env > ~/a1-retry.log 2>&1 &
tail -f ~/a1-retry.log        # 보기만 끝낼 때 Ctrl+C (스크립트는 계속 돈다)
pkill -f oci-a1-retry.sh      # 멈추기
```

3분 간격으로 시도하고, 성공하거나 같은 이름(`ae2p-test`)의 인스턴스가 생기면 스스로 멈춥니다. 성공하면 콘솔에서 **공인 IP** 를 확인합니다.

---

## 2. 서버 기본 설정 (테스트 서버)

```bash
ssh -i ~/.ssh/ae2p-test ubuntu@<공인 IP>

sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Seoul

# 스왑 2GB — 빌드와 Claude 가 겹칠 때 메모리 부족 방지
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Oracle Ubuntu 이미지는 iptables 가 80/443 을 막는다
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Caddy 가 /home/ubuntu/ae2p/dist 를 읽을 수 있게
chmod o+x /home/ubuntu
```

**DuckDNS**: `ae2p-dev` 서브도메인을 만들고 테스트 서버 공인 IP 를 넣습니다.

## 3. Node · pm2 · Caddy

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
npm i -g pm2
pm2 startup        # 출력되는 sudo 명령을 그대로 한 번 실행

sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 4. 저장소 · .env

운영 서버와 같은 방식(읽기 전용 Deploy key)으로 받습니다. 키는 운영 서버 것과 따로 만듭니다.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ae2p_deploy -N "" -C ae2p-test-deploy
cat ~/.ssh/ae2p_deploy.pub     # → GitHub rasz60/ae2p → Settings → Deploy keys → Add (Allow write access 는 끄기)
cat >> ~/.ssh/config <<'EOF'
Host github-ae2p
  HostName github.com
  IdentityFile ~/.ssh/ae2p_deploy
  IdentitiesOnly yes
EOF
git clone git@github-ae2p:rasz60/ae2p.git ~/ae2p
git config --global user.name "ae2p builder" && git config --global user.email "builder@ae2p-dev"
```

`.env` 는 운영 서버 것을 복사해 와서(내 PC 를 거쳐 `scp`) 아래만 바꿉니다.

```bash
PUBLIC_URL=https://ae2p-dev.duckdns.org
BUILDER_ENABLED=true
VITE_BUILDER_ENABLED=true
ANTHROPIC_API_KEY=          # 5단계 참고
BUILDER_MAX_BUDGET_USD=5    # 요청 한 번의 비용 상한
```

**Supabase** → Authentication → URL Configuration → Redirect URLs 에 `https://ae2p-dev.duckdns.org/**` 를 추가합니다
(테스트 서버에서 로그인 · 초대 링크가 돌아올 주소).

> 지금은 운영과 같은 Supabase 프로젝트를 씁니다. 작업실은 `.env` 를 못 읽게 막지만 완전한 격리는 아니므로,
> 오래 쓸 거라면 테스트용 Supabase 프로젝트를 따로 두는 것을 권합니다.

## 5. Claude 인증

Claude 실행 파일은 `npm ci` 때 Agent SDK 와 함께 설치됩니다(linux-arm64). 인증은 둘 중 하나입니다.

- **API 키 (권장)**: [Claude Console](https://platform.claude.com) → API Keys 에서 만들어 `.env` 의 `ANTHROPIC_API_KEY` 에 넣습니다.
  사용량만큼 과금되며, Console 에서 월 지출 한도를 걸어 둘 수 있습니다.
- **구독 계정 로그인**: `curl -fsSL https://claude.ai/install.sh | bash` 로 Claude Code 를 설치하고 `claude` → `/login`.
  `ANTHROPIC_API_KEY` 를 비우면 이 로그인을 씁니다. 본인만 쓰는 도구라면 동작은 하지만,
  서버 앱에서 구독 로그인을 쓰는 것은 약관상 애매한 부분이 있으니 확인한 뒤에 쓰세요.

## 6. 빌드 · 실행 · Caddy

```bash
cd ~/ae2p
npm ci && npm run build
pm2 start ecosystem.config.cjs && pm2 save
pm2 ls                      # ae2p-portal-api, ae2p-builder 두 개가 online 이어야 한다

sudo cp ~/ae2p/deploy/Caddyfile.test /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

`https://ae2p-dev.duckdns.org` → 관리자 로그인 → 계정 메뉴 → **Claude 작업실** → 예: "홈 화면 인사말을 '좋은 하루예요'로 바꿔 줘".
Claude 가 고치고 빌드하면 새로고침해서 확인합니다.

## 7. sudo 끄기 (권장)

Oracle Ubuntu 의 `ubuntu` 계정은 비밀번호 없이 sudo 가 됩니다. 훅이 `sudo` 명령을 막지만 스크립트 파일을 거치면 우회될 수 있으니,
설정이 끝나면 비밀번호 없는 sudo 를 끕니다. 이후 직접 sudo 할 때는 정한 비밀번호를 입력합니다.

```bash
sudo passwd ubuntu                               # 비밀번호를 먼저 정한다 (잊으면 콘솔의 직렬 콘솔로 복구해야 한다)
sudo rm /etc/sudoers.d/90-cloud-init-users       # 비밀번호 없는 sudo 끄기
sudo -k && sudo true                             # 비밀번호를 묻는지 확인
```

---

## 운영하며

- **로그 · 감사**: `pm2 logs ae2p-builder` — 누가 무엇을 요청했는지, Claude 가 실행한 도구와 막힌 명령이 남습니다.
- **작업실 코드를 고쳤을 때**: Claude 는 자기 자신(`ae2p-builder`)을 재시작하지 못합니다. 화면 왼쪽 아래 **작업실 재시작**을 누릅니다.
- **운영 반영**: 테스트 서버의 Deploy key 는 읽기 전용이라 Claude 는 커밋까지만 합니다. 확인이 끝난 변경은 PC 에서 가져와 push 하면
  운영은 지금처럼 GitHub Actions 로 배포됩니다. (다음 단계: 작업실에 "브랜치 push · PR" 버튼 추가)
- **다른 앱도 고치게 하려면**: 서버에 clone 하고 `.env` 의 `BUILDER_EXTRA_DIRS` 에 절대 경로를 쉼표로 넣은 뒤 작업실을 재시작합니다.
  Go 앱(workout · careerpad)은 서버에 Go 도 설치해야 합니다.
