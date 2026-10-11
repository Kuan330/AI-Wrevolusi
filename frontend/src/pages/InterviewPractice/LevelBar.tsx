/** Four steps, filled up to the level. The level is always also written in words next to it, so this is decoration only. */
export default function LevelBar({ level }: { level: number }) {
  return <span className="ip-bar" aria-hidden="true">{[1, 2, 3, 4].map(step => <i key={step} className={step <= Math.round(level) ? "on" : ""} />)}</span>;
}
