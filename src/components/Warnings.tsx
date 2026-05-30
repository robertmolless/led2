interface Props {
  warnings: string[];
}

export function Warnings({ warnings }: Props) {
  if (warnings.length === 0) return null;
  return (
    <div className="warnings">
      <strong>Предупреждения:</strong>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
