/** ae:p 로고. 어두운 테마에선 어두운 배경용 파일로 바꿔 낀다 */
export function Brand({ kind, height }: { kind: 'wordmark' | 'mark'; height: number }) {
  return (
    <picture className="brand">
      <source srcSet={`/brand/${kind}-dark.svg`} media="(prefers-color-scheme: dark)" />
      <img src={`/brand/${kind}.svg`} alt="ae:p takecare" height={height} />
    </picture>
  );
}
