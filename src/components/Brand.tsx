/** ae:p 로고. 어두운 테마에선 어두운 배경용 파일로 바꿔 낀다 */
export function Brand({ kind, height }: { kind: 'wordmark' | 'mark'; height: number }) {
  return (
    <picture className="brand">
      <source srcSet={`/brand/${kind}-dark.svg`} media="(prefers-color-scheme: dark)" />
      <img src={`/brand/${kind}.svg`} alt="ae:p takecare" height={height} />
    </picture>
  );
}

/** 바깥 배경의 흐릿한 원들 (브랜드 시안의 파스텔 배경) */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <i className="blob blob-1" />
      <i className="blob blob-2" />
      <i className="blob blob-3" />
    </div>
  );
}
