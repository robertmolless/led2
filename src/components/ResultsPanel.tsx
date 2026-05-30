import type { CalculatedResult, ProjectConfig } from "../types";
import { formatKg, formatKw } from "../utils/calculations";

interface Props {
  config: ProjectConfig;
  result: CalculatedResult;
}

export function ResultsPanel({ config, result }: Props) {
  const multi = config.screenCount > 1;
  return (
    <div className="panel results-panel">
      <h2 className="panel-title">Расчёт</h2>

      <section className="result-section">
        <h3>На один экран</h3>
        <ul className="kv">
          <Row k="Модули" v={`${result.cabinetCountX} × ${result.cabinetCountY}`} />
          <Row k="Всего модулей" v={result.totalCabinetsOneScreen} />
          <Row k="Разрешение" v={`${result.resolutionX} × ${result.resolutionY}`} />
          <Row k="Всего пикселей" v={result.totalPixelsOneScreen.toLocaleString("ru-RU")} />
          <Row k="Порты NovaStar" v={result.portsNeededOneScreen} />
          <Row k="Макс. модулей на порт" v={result.maxCabinetsPerPort} />
          <Row k="Мощность" v={formatKw(result.totalPowerKwOneScreen)} />
          <Row k="Вес" v={formatKg(result.totalWeightKgOneScreen)} />
          <Row k="Средняя загрузка порта" v={`${result.averagePortLoadPercent.toFixed(1)}%`} />
          <Row k="Макс. загрузка порта" v={`${result.maxPortLoadPercent.toFixed(1)}%`}
            warn={result.maxPortLoadPercent > 100} />
          <Row k="Ноги" v={result.legsCount} />
        </ul>
      </section>

      {multi && (
        <section className="result-section">
          <h3>На все экраны (×{config.screenCount})</h3>
          <ul className="kv">
            <Row k="Всего модулей" v={result.totalCabinetsAllScreens} />
            <Row k="Всего пикселей" v={result.totalPixelsAllScreens.toLocaleString("ru-RU")} />
            <Row k="Суммарно портов" v={result.portsNeededAllScreens} />
            <Row k="Суммарная мощность" v={formatKw(result.totalPowerKwAllScreens)} />
            <Row k="Суммарный вес" v={formatKg(result.totalWeightKgAllScreens)} />
          </ul>
        </section>
      )}

      {result.ports.length > 0 && (
        <section className="result-section">
          <h3>Порты</h3>
          <div className="ports-list">
            {result.ports.map((p) => (
              <div key={p.portNumber} className={`port-row ${p.isOverLimit ? "over" : ""}`}>
                <div className="port-num">P{p.portNumber}</div>
                <div className="port-info">
                  <div>{p.cabinets.length} мод. / {p.pixels.toLocaleString("ru-RU")} px</div>
                  <div className="port-bar">
                    <div
                      className="port-bar-fill"
                      style={{ width: `${Math.min(p.loadPercent, 100)}%` }}
                    />
                  </div>
                  <div className="port-load">{p.loadPercent.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: React.ReactNode; warn?: boolean }) {
  return (
    <li className={warn ? "warn-row" : ""}>
      <span className="kv-k">{k}</span>
      <span className="kv-v">{v}</span>
    </li>
  );
}
