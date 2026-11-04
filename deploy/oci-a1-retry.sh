#!/usr/bin/env bash
# Oracle Cloud A1(ARM) 인스턴스를 용량이 생길 때까지 계속 만들어 본다. "Out of host capacity" 가 날 때 쓴다.
# 24시간 켜져 있는 운영 서버에서 돌리면 된다 (가벼운 CLI 호출뿐이라 운영에는 영향 없음):
#   cp deploy/oci-a1-retry.env.example ~/a1-retry.env && nano ~/a1-retry.env   # 값 채우기
#   nohup bash deploy/oci-a1-retry.sh ~/a1-retry.env > ~/a1-retry.log 2>&1 &
#   tail -f ~/a1-retry.log                                                     # 진행 보기 (Ctrl+C 로 보기만 끝)
# 멈추기: pkill -f oci-a1-retry.sh
#
# 같은 이름의 인스턴스가 이미 있으면 만들지 않고 끝낸다 (무료 한도를 넘겨 두 대가 생기는 것을 막는다).
set -uo pipefail

ENV_FILE="${1:-$HOME/a1-retry.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

: "${COMPARTMENT_ID:?COMPARTMENT_ID 가 필요합니다}" "${SUBNET_ID:?SUBNET_ID 가 필요합니다}" "${IMAGE_ID:?IMAGE_ID 가 필요합니다}"
: "${AD:?AD(가용성 도메인 이름)가 필요합니다}" "${SSH_KEY_FILE:?SSH_KEY_FILE(공개키 경로)이 필요합니다}"
NAME="${NAME:-ae2p-test}"
OCPUS="${OCPUS:-1}"
MEMORY_GB="${MEMORY_GB:-6}"
BOOT_GB="${BOOT_GB:-50}"
INTERVAL="${INTERVAL:-180}"
OCI="${OCI:-oci}"
# CLI 자체 재시도는 끈다: 실패하면 바로 돌아와야 429(요청 과다)를 피하고, 간격은 이 스크립트가 정한다
OCI_OPTS=(--no-retry)
AUTH_FAILS=0

log() { echo "$(date '+%F %T') $*"; }

exists() {
  local n
  n=$("$OCI" "${OCI_OPTS[@]}" compute instance list --compartment-id "$COMPARTMENT_ID" --display-name "$NAME" \
    --query 'length(data[?"lifecycle-state"!=`TERMINATED` && "lifecycle-state"!=`TERMINATING`])' --raw-output 2>/dev/null)
  [ "${n:-0}" != "0" ]
}

log "시작: $NAME (A1 ${OCPUS} OCPU / ${MEMORY_GB}GB, 부트 ${BOOT_GB}GB), ${INTERVAL}초 간격"
try=0
while true; do
  try=$((try + 1))
  if exists; then
    log "같은 이름의 인스턴스가 이미 있어요 — 끝냅니다. 콘솔에서 공인 IP 를 확인하세요."
    exit 0
  fi
  out=$("$OCI" "${OCI_OPTS[@]}" compute instance launch \
    --availability-domain "$AD" \
    --compartment-id "$COMPARTMENT_ID" \
    --shape VM.Standard.A1.Flex \
    --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
    --image-id "$IMAGE_ID" \
    --subnet-id "$SUBNET_ID" \
    --assign-public-ip true \
    --display-name "$NAME" \
    --boot-volume-size-in-gbs "$BOOT_GB" \
    --ssh-authorized-keys-file "$SSH_KEY_FILE" 2>&1)
  # echo | grep -q 는 쓰지 않는다: grep -q 가 먼저 끝나면 echo 가 SIGPIPE 를 맞고, pipefail 때문에 매치돼도 실패로 처리된다
  if grep -q '"lifecycle-state"' <<< "$out"; then
    log "성공 (${try}번째 시도). 몇 분 뒤 콘솔 > 컴퓨트 > 인스턴스에서 공인 IP 를 확인하세요."
    echo "$out" | grep -E '"(id|lifecycle-state)"' | head -3
    exit 0
  fi
  if grep -q 'NotAuthenticated' <<< "$out"; then
    # 요청이 몰린 직후에는 401 이 섞여 오기도 한다. 계속되면 진짜 인증 문제
    AUTH_FAILS=$((AUTH_FAILS + 1))
    if [ "$AUTH_FAILS" -ge 5 ]; then
      log "${try}번째: 인증 실패가 5번 연속이라 멈춥니다 (~/.oci/config 와 콘솔의 API 키를 확인하세요)"
      exit 1
    fi
    log "${try}번째: 인증 오류 (${AUTH_FAILS}/5) — ${INTERVAL}초 뒤 다시"
    sleep "$INTERVAL"
    continue
  fi
  AUTH_FAILS=0
  if grep -qiE '"status": (429|500|502|503)|Out of host capacity|capacity|TooManyRequests|InternalError|timed out' <<< "$out"; then
    log "${try}번째: 용량 없음 — ${INTERVAL}초 뒤 다시"
  else
    log "${try}번째: 다른 오류라서 멈춥니다 (설정 값을 확인하세요)"
    echo "$out" | tail -15
    exit 1
  fi
  sleep "$INTERVAL"
done
