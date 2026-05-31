import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectConfig, SavedProject } from "./types";
import { makeDefaultConfig } from "./utils/defaults";
import { calculateProject } from "./utils/calculations";
import { AppShell } from "./components/AppShell";
import { InputPanel } from "./components/InputPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { Warnings } from "./components/Warnings";
import { SchemeSvg } from "./components/SchemeSvg";
import { ProjectManager } from "./components/ProjectManager";
import { exportPdf } from "./utils/exportPdf";
import { exportPng } from "./utils/exportPng";
import { exportJpeg } from "./utils/exportJpeg";
import { exportWebp } from "./utils/exportWebp";
import { setCurrentId, getCurrentId, getProjectById } from "./utils/storage";
import { canonicalPresetId } from "./data/cabinetPresets";
import { resolveProcessor, buildPatchPlan } from "./utils/processor";
import { makeDefaultScreen } from "./utils/defaults";
import type { ScreenConfig } from "./types";

/**
 * Нормализует загруженную конфигурацию:
 *  - маппит устаревшие id пресетов;
 *  - мигрирует СТАРЫЙ формат (один экран + screenCount) в массив screens.
 */
function normalizeConfig(raw: any): ProjectConfig {
  const cabinetPresetId = canonicalPresetId(raw?.cabinetPresetId ?? "p26-0.5x0.5");

  if (Array.isArray(raw?.screens) && raw.screens.length > 0) {
    const screens: ScreenConfig[] = raw.screens.map((s: any, i: number) =>
      makeDefaultScreen({ ...s, name: s?.name ?? `Экран ${i + 1}` })
    );
    return {
      projectName: raw.projectName ?? "Проект",
      cabinetPresetId,
      viewMode: raw.viewMode ?? "front",
      powerRoutingMode: raw.powerRoutingMode ?? "same_as_signal",
      backupEnabled: raw.backupEnabled ?? true,
      showCabinetNumbers: raw.showCabinetNumbers ?? true,
      showPortNumbers: raw.showPortNumbers ?? true,
      showLegend: raw.showLegend ?? true,
      processorMode: raw.processorMode ?? "auto",
      processorId: raw.processorId ?? "vx1000",
      screens
    };
  }

  // Старый формат — один экран × screenCount.
  const count = Math.max(1, Math.floor(raw?.screenCount ?? 1));
  const w = raw?.screenWidthMeters ?? 7;
  const h = raw?.screenHeightMeters ?? 3;
  const screens: ScreenConfig[] = Array.from({ length: count }, (_, i) =>
    makeDefaultScreen({
      name: count === 1 ? "Экран 1" : `Экран ${i + 1}`,
      widthMeters: w,
      heightMeters: h,
      orientation: raw?.orientation ?? "horizontal",
      signalRoutingMode: raw?.signalRoutingMode ?? "snake_rows",
      signalInputSide: raw?.signalInputSide ?? "left",
      backupSide: raw?.backupSide ?? "opposite",
      legsMode: raw?.legsMode ?? "auto",
      manualLegs: raw?.manualLegs ?? 6
    })
  );
  return {
    projectName: raw?.projectName ?? "Проект",
    cabinetPresetId,
    viewMode: raw?.viewMode ?? "front",
    powerRoutingMode: raw?.powerRoutingMode ?? "same_as_signal",
    backupEnabled: raw?.backupEnabled ?? true,
    showCabinetNumbers: raw?.showCabinetNumbers ?? true,
    showPortNumbers: raw?.showPortNumbers ?? true,
    showLegend: raw?.showLegend ?? true,
    processorMode: raw?.processorMode ?? "auto",
    processorId: raw?.processorId ?? "vx1000",
    screens
  };
}

export function App() {
  const [config, setConfig] = useState<ProjectConfig>(() => {
    // Восстановление черновика из localStorage.
    try {
      const draft = localStorage.getItem("led-scheme-builder.draft");
      if (draft) return normalizeConfig(JSON.parse(draft) as ProjectConfig);
    } catch {}
    // Иначе если в storage есть «текущий» проект — открываем его.
    const cid = getCurrentId();
    if (cid) {
      const p = getProjectById(cid);
      if (p) return normalizeConfig(p.config);
    }
    return makeDefaultConfig();
  });

  const [currentId, setCurId] = useState<string | null>(() => getCurrentId());
  const [pmOpen, setPmOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<"none" | "inputs" | "results">("none");

  const svgRef = useRef<string>("");

  // Автосохранение черновика.
  useEffect(() => {
    localStorage.setItem("led-scheme-builder.draft", JSON.stringify(config));
  }, [config]);

  // Расчёт.
  const result = useMemo(() => calculateProject(config), [config]);
  const recommendation = useMemo(
    () => resolveProcessor(result, config.processorMode, config.processorId),
    [result, config.processorMode, config.processorId]
  );
  const patchPlan = useMemo(() => buildPatchPlan(config, result), [config, result]);

  const handleNew = () => {
    if (confirm("Создать новый проект? Текущие несохранённые изменения будут потеряны.")) {
      setConfig(makeDefaultConfig());
      setCurId(null);
      setCurrentId(null);
    }
  };

  const handleSavedFromManager = (id: string) => {
    setCurId(id);
    setCurrentId(id);
  };
  const handleLoad = (p: SavedProject) => {
    setConfig(normalizeConfig(p.config));
    setCurId(p.id);
    setCurrentId(p.id);
    setPmOpen(false);
  };

  const withBusy = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert("Ошибка экспорта: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const getSvg = async () => {
    if (svgRef.current) return svgRef.current;
    // Защита: если ref ещё не успел заполниться, собираем SVG прямо здесь.
    const { buildSchemeSvg } = await import("./utils/svgBuilder");
    return buildSchemeSvg({ config, result, recommendation, patchPlan });
  };
  const handleExportPdf = () => withBusy("PDF…", async () => exportPdf(await getSvg(), config.projectName));
  const handleExportPng = () => withBusy("PNG…", async () => exportPng(await getSvg(), config.projectName));
  const handleExportJpeg = () => withBusy("JPEG…", async () => exportJpeg(await getSvg(), config.projectName));
  const handleExportWebp = () => withBusy("WebP…", async () => exportWebp(await getSvg(), config.projectName));

  const toolbar = (
    <>
      <button className="btn ghost mobile-only" onClick={() => setSidebarOpen("inputs")}>⚙</button>
      <button className="btn" onClick={handleNew}>Новый</button>
      <button className="btn primary" onClick={() => setPmOpen(true)}>Проекты</button>
      <div className="toolbar-spacer" />
      {busy ? (
        <button className="btn primary" disabled>{busy}</button>
      ) : (
        <select
          className="export-select"
          defaultValue=""
          aria-label="Экспорт"
          onChange={(e) => {
            const f = e.target.value;
            e.target.value = "";
            if (f === "pdf") handleExportPdf();
            else if (f === "png") handleExportPng();
            else if (f === "jpeg") handleExportJpeg();
            else if (f === "webp") handleExportWebp();
          }}
        >
          <option value="" disabled hidden>Экспорт</option>
          <option value="pdf">PDF</option>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP (лёгкий)</option>
        </select>
      )}
      <button className="btn ghost mobile-only" onClick={() => setSidebarOpen("results")}>Σ</button>
    </>
  );

  return (
    <>
      <AppShell
        toolbar={toolbar}
        inputs={<InputPanel config={config} onChange={setConfig} recommendation={recommendation} patchPlan={patchPlan} />}
        results={<ResultsPanel config={config} result={result} recommendation={recommendation} patchPlan={patchPlan} />}
        warnings={<Warnings warnings={result.warnings} />}
        scheme={
          <SchemeSvg
            config={config}
            result={result}
            recommendation={recommendation}
            patchPlan={patchPlan}
            onSvgReady={(s) => {
              svgRef.current = s;
            }}
          />
        }
      />

      {/* Мобильные оверлеи */}
      {sidebarOpen !== "none" && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen("none")}>
          <div className="mobile-overlay-inner" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSidebarOpen("none")}>×</button>
            {sidebarOpen === "inputs" ? (
              <InputPanel config={config} onChange={setConfig} recommendation={recommendation} patchPlan={patchPlan} />
            ) : (
              <ResultsPanel config={config} result={result} recommendation={recommendation} patchPlan={patchPlan} />
            )}
          </div>
        </div>
      )}

      <ProjectManager
        open={pmOpen}
        onClose={() => setPmOpen(false)}
        config={config}
        currentId={currentId}
        onLoad={handleLoad}
        onSaved={handleSavedFromManager}
      />
    </>
  );
}
