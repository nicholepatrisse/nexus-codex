export function CharacterProgress({ startingLevel, currentLevel, xp }: { startingLevel: number; currentLevel: number; xp: number }) {
  return <>
    <div><dt className="text-sm text-text-muted">Starting level</dt><dd className="mt-1 font-semibold">{startingLevel}</dd></div>
    <div><dt className="text-sm text-text-muted">Current level</dt><dd className="mt-1 font-semibold">{currentLevel}</dd></div>
    <div><dt className="text-sm text-text-muted">XP</dt><dd className="mt-1 font-semibold">{xp}</dd></div>
  </>;
}
