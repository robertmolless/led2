import type { ProjectConfig, ProjectResult, ScreenResult } from "../types";
import { formatKg, formatKw } from "../utils/calculations";

interface Props {
  config: ProjectConfig;
  result: ProjectResult;
}

export function ResultsPanel({ result }: Props) {
  const multi = result.screenCount > 1;
  return (
    <div className="panel results-panel">
      <h2 className="panel-title">Расчёт</h2>

      <section className="result-section">
        <h3>Итог по проекту{multi ? ` (${result.screenCount} экр.)` : ""}</h3>
        <ul className="kv">
          <Row k="Габарит ALL" v={`${strip(result.combinedWidthM)} × ${strip(result.combinedHeightM)} м`} />
          <Row k="Разрешение ALL" v={`${result.combinedResolutionX} × ${result.combinedResolutionY}`} />
          <Row k="Всего модулей" v={result.totalCabinets} />
          <Row k="Всего пикселей" v={result.totalPixels.toLocaleString("ru-RU")} />
          <Row k="Портов всего" v={result.totalPorts} />
          <Row k="Мощность" v={formatKw(result.totalPowerKw)} />
          <Row k="Вес" v={formatKg(result.totalWeightKg)} />
          <Row k="Ноги" v={result.totalLegs} />
        </ul>
      </section>

      {result.screens.map((s) => (
        <ScreenBlock key={s.id} s={s} />
      ))}
    </div>
  );
}

function ScreenBlock({ s }: { s: ScreenResult }) {
  return (
    <section className="result-section">
      <h3>{s.name}</h3>
      <ul className="kv">
        <Row k="Размер" v={`${strip(s.actualWidthM)} × ${strip(s.actualHeightM)} м`} />
        <Row k="Модули" v={`${s.cabinetCountX} × ${s.cabinetCountY} = ${s.totalCabinets}`} />
        <Row k="Разрешение" v={`${s.resolutionX} × ${s.resolutionY}`} />
        <Row k="Порты" v={s.portsNeeded} />
        <Row k="Макс. модулей на порт" v={s.maxCabinetsPerPort} />
        <Row k="Мощность" v={formatKw(s.totalPowerKw)} />
        <Row k="Вес" v={formatKg(s.totalWeightKg)} />
        <Row k="Макс. загрузка порта" v={`${s.maxPortLoadPercent.toFixed(1)}%`} warn={s.maxPortLoadPercent > 100} />
        <Row k="Ноги" v={s.legsCount} />
      </ul>

      {s.ports.length > 0 && (
        <div className="ports-list">
          {s.ports.map((p) => (
            <div key={p.portNumber} className={`port-row ${p.isOverLimit ? "over" : ""}`}>
              <div className="port-num">P{p.portNumber}</div>
              <div className="port-info">
                <div>{p.cabinets.length} мод. / {p.pixels.toLocaleString("ru-RU")} px</div>
                <div className="port-bar">
                  <div className="port-bar-fill" style={{ width: `${Math.min(p.loadPercent, 100)}%` }} />
                </div>
                <div className="port-load">{p.loadPercent.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function strip(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(parseFloat(n.toFixed(2)));
}

function Row({ k, v, warn }: { k: string; v: React.ReactNode; warn?: boolean }) {
  return (
    <li className={warn ? "warn-row" : ""}>
      <span className="kv-k">{k}</span>
      <span className="kv-v">{v}</span>
    </li>
  );
}
