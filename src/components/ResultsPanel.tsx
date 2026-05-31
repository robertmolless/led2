import type { ProjectConfig, ProjectResult, ScreenResult, ProcessorRecommendation, PatchPlan, ScreenPatch } from "../types";
import { formatKg, formatKw } from "../utils/calculations";
import { formatPortsSlash, buildLinkInfo } from "../utils/processor";

interface Props {
  config: ProjectConfig;
  result: ProjectResult;
  recommendation?: ProcessorRecommendation;
  patchPlan?: PatchPlan;
}

export function ResultsPanel({ config, result, patchPlan }: Props) {
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
          <Row
            k="Кофры"
            v={`${result.cases.total}${casesDetail(result)}`}
          />
          <Row k="Силовые вводы" v={`${result.powerInputs} (16А)`} />
          <Row k="Линии данных" v={`${result.dataLines}${result.backupEnabled ? " (с backup)" : ""}`} />
          {patchPlan && (
            <Row k="Выходы HDMI" v={patchPlan.units.length} />
          )}
          {patchPlan && (
            <Row k="Процессоры" v={summarizeModels(patchPlan)} />
          )}
        </ul>
      </section>

      {/* Выходы и линки */}
      {patchPlan && patchPlan.units.length > 0 && (
        <section className="result-section">
          <h3>Выходы / линки</h3>
          {buildLinkInfo(patchPlan).lines.map((l, i) => (
            <div key={i} className="link-line">{l}</div>
          ))}
        </section>
      )}

      {/* Патч-лист по процессорам */}
      {patchPlan && patchPlan.units.length > 0 && (
        <section className="result-section">
          <h3>Патч ({config.processorMode === "manual" ? "ручной выбор" : "авто"})</h3>
          {patchPlan.warnings.map((w, i) => (
            <div key={i} className="patch-warn">⚠ {w}</div>
          ))}
          {patchPlan.units.map((u) => (
            <div key={u.index} className={`patch-unit ${u.overflow ? "over" : ""}`}>
              <div className="patch-unit-head">
                Проц №{u.index}: {u.processor.name}
                <span className="patch-unit-ports">{u.usedPorts}/{u.processor.portCount} порт.</span>
              </div>
              {u.screenIds.map((sid) => {
                const sp = patchPlan.perScreen[sid];
                const sc = result.screens.find((s) => s.id === sid);
                if (!sp || !sc) return null;
                return <PatchScreen key={sid} name={sc.name} sp={sp} backup={config.backupEnabled} />;
              })}
            </div>
          ))}
        </section>
      )}

      {result.screens.map((s) => (
        <ScreenBlock key={s.id} s={s} />
      ))}
    </div>
  );
}

function PatchScreen({ name, sp, backup }: { name: string; sp: ScreenPatch; backup: boolean }) {
  return (
    <div className="patch-screen">
      <div className="patch-screen-name">{name} · {sp.processorName} · {sp.edid}</div>
      <div className="patch-ports">
        <span className="patch-up">{formatPortsSlash(sp.upPorts)} UP</span>
        {backup && sp.backupPorts.length > 0 && (
          <span className="patch-bk">{formatPortsSlash(sp.backupPorts)} BACKUP</span>
        )}
      </div>
      <div className="patch-mode">MODE: {sp.mode}</div>
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

function casesDetail(r: ProjectResult): string {
  const parts: string[] = [];
  if (r.modulesByType.tall > 0) parts.push(`0.5×1: ${r.cases.tall}`);
  if (r.modulesByType.half > 0) parts.push(`0.5×0.5: ${r.cases.half}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function strip(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(parseFloat(n.toFixed(2)));
}

function summarizeModels(plan: PatchPlan): string {
  const counts = new Map<string, number>();
  plan.units.forEach((u) => counts.set(u.processor.name, (counts.get(u.processor.name) ?? 0) + 1));
  return Array.from(counts.entries()).map(([n, c]) => `${c}× ${n}`).join(", ") || "—";
}

function Row({ k, v, warn }: { k: string; v: React.ReactNode; warn?: boolean }) {
  return (
    <li className={warn ? "warn-row" : ""}>
      <span className="kv-k">{k}</span>
      <span className="kv-v">{v}</span>
    </li>
  );
}
