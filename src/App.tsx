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
import { setCurrentId, getCurrentId, getProjectById } from "./utils/storage";

export function App() {
  const [config, setConfig] = useState<ProjectConfig>(() => {
    // Восстановление черновика из localStorage.
    try {
      const draft = localStorage.getItem("led-scheme-builder.draft");
      if (draft) return JSON.parse(draft) as ProjectConfig;
    } catch {}
    // Иначе если в storage есть «текущий» проект — открываем его.
    const cid = getCurrentId();
    if (cid) {
      const p = getProjectById(cid);
      if (p) return p.config;
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
    setConfig(p.config);
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
    return buildSchemeSvg({ config, result });
  };
  const handleExportPdf = () => withBusy("PDF…", async () => exportPdf(await getSvg(), config.projectName));
  const handleExportPng = () => withBusy("PNG…", async () => exportPng(await getSvg(), config.projectName));
  const handleExportJpeg = () => withBusy("JPEG…", async () => exportJpeg(await getSvg(), config.projectName));

  const toolbar = (
    <>
      <button className="btn ghost mobile-only" onClick={() => setSidebarOpen("inputs")}>⚙</button>
      <button className="btn" onClick={handleNew}>Новый</button>
      <button className="btn primary" onClick={() => setPmOpen(true)}>Проекты</button>
      <div className="toolbar-spacer" />
      <button className="btn" disabled={!!busy} onClick={handleExportPdf}>
        {busy === "PDF…" ? "..." : "PDF"}
      </button>
      <button className="btn" disabled={!!busy} onClick={handleExportPng}>
        {busy === "PNG…" ? "..." : "PNG"}
      </button>
      <button className="btn" disabled={!!busy} onClick={handleExportJpeg}>
        {busy === "JPEG…" ? "..." : "JPEG"}
      </button>
      <button className="btn ghost mobile-only" onClick={() => setSidebarOpen("results")}>Σ</button>
    </>
  );

  return (
    <>
      <AppShell
        title="LED Scheme Builder"
        toolbar={toolbar}
        inputs={<InputPanel config={config} onChange={setConfig} />}
        results={<ResultsPanel config={config} result={result} />}
        warnings={<Warnings warnings={result.warnings} />}
        scheme={
          <SchemeSvg
            config={config}
            result={result}
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
              <InputPanel config={config} onChange={setConfig} />
            ) : (
              <ResultsPanel config={config} result={result} />
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
