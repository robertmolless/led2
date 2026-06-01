import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectConfig, ProjectResult } from "../types";
import {
  PATTERN_LABELS,
  buildCabinetPxGrid,
  type PatternId,
  type PatternOptions
} from "../utils/testPatterns";
import {
  exportTestPatternPng,
  renderPreview
} from "../utils/exportTestPattern";

interface Props {
  open: boolean;
  onClose: () => void;
  config: ProjectConfig;
  result: ProjectResult;
}

type ScreenChoice =
  | { kind: "combined" }
  | { kind: "screen"; index: number };

const PATTERNS: PatternId[] = [
  "pixel_grid",
  "checkerboard",
  "solid",
  "grayscale_ramp",
  "color_bars",
  "geometry",
  "cabinet_grid",
  "info"
];

/** Пресеты сплошных цветов для проверки uniformity / dead pixels. */
const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: "#ffffff", label: "Белый 100%" },
  { value: "#808080", label: "Серый 50%" },
  { value: "#404040", label: "Серый 25%" },
  { value: "#000000", label: "Чёрный" },
  { value: "#ff0000", label: "Красный" },
  { value: "#00ff00", label: "Зелёный" },
  { value: "#0000ff", label: "Синий" },
  { value: "#ffff00", label: "Жёлтый" },
  { value: "#00ffff", label: "Циан" },
  { value: "#ff00ff", label: "Маджента" }
];

export function TestPatternModal({ open, onClose, config, result }: Props) {
  const [choice, setChoice] = useState<ScreenChoice>(
    result.screens.length > 1 ? { kind: "combined" } : { kind: "screen", index: 0 }
  );
  const [pattern, setPattern] = useState<PatternId>("pixel_grid");
  const [solidColor, setSolidColor] = useState<string>("#ffffff");
  const [checkerSize, setCheckerSize] = useState<number>(32);
  const [gridStep, setGridStep] = useState<number>(8);

  // Ручное переопределение разрешения (выключено по умолчанию — берём из расчёта).
  const [manualResolution, setManualResolution] = useState(false);
  const [manualW, setManualW] = useState<number>(1920);
  const [manualH, setManualH] = useState<number>(1080);

  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  // Эффективные параметры выбранного источника (разрешение, имя, кабинеты).
  const source = useMemo(() => {
    if (choice.kind === "combined") {
      return {
        width: result.combinedResolutionX,
        height: result.combinedResolutionY,
        name: "ВСЕ ЭКРАНЫ",
        cabinetGrid: [], // объединённая сетка кабинетов не строится — экраны
                         // имеют независимые системы координат
        canUseCabinetGrid: false
      };
    }
    const s = result.screens[choice.index];
    if (!s) {
      return { width: 1920, height: 1080, name: "—", cabinetGrid: [], canUseCabinetGrid: false };
    }
    return {
      width: s.resolutionX,
      height: s.resolutionY,
      name: s.name,
      cabinetGrid: buildCabinetPxGrid(s),
      canUseCabinetGrid: true
    };
  }, [choice, result]);

  // Финальные размеры (с учётом возможного ручного override).
  const exportW = manualResolution ? Math.max(1, Math.floor(manualW)) : source.width;
  const exportH = manualResolution ? Math.max(1, Math.floor(manualH)) : source.height;

  // Cabinet grid имеет смысл только для конкретного экрана и без ручного
  // переопределения разрешения (иначе координаты кабинетов уплывут).
  const cabinetGridAvailable = source.canUseCabinetGrid && !manualResolution;

  // Если пользователь выбрал cabinet_grid, но переключился на combined —
  // мягко переключаем паттерн на info, чтобы не было пустого результата.
  useEffect(() => {
    if (pattern === "cabinet_grid" && !cabinetGridAvailable) {
      setPattern("info");
    }
  }, [pattern, cabinetGridAvailable]);

  const patternOptions: PatternOptions = useMemo(() => {
    const moduleName = result.moduleName;
    const pitch = result.pixelPitch;
    return {
      solidColor,
      checkerSize,
      gridStep,
      info: {
        projectName: config.projectName,
        screenName: source.name,
        pitch,
        moduleName
      },
      cabinetGrid: source.cabinetGrid
    };
  }, [solidColor, checkerSize, gridStep, config.projectName, source, result.moduleName, result.pixelPitch]);

  // Перерисовка превью при изменении параметров.
  useEffect(() => {
    if (!open) return;
    const c = previewRef.current;
    if (!c) return;
    renderPreview(c, exportW, exportH, pattern, patternOptions);
  }, [open, exportW, exportH, pattern, patternOptions]);

  if (!open) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      const baseName = [
        "testpattern",
        config.projectName || "project",
        source.name,
        pattern
      ]
        .filter(Boolean)
        .join("-");
      await exportTestPatternPng({
        width: exportW,
        height: exportH,
        patternId: pattern,
        patternOptions,
        fileBaseName: baseName
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Для cabinet_grid отдельный набор разрешений — менять нельзя (привязка к расчёту).
  const isCabinetGrid = pattern === "cabinet_grid";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal testpattern-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Генератор тест-карт</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="testpattern-body">
          <div className="testpattern-form">
            {/* Источник: экран или объединённый канвас */}
            <div className="field">
              <label className="field-label">Источник</label>
              <select
                className="select-input"
                value={choice.kind === "combined" ? "combined" : String(choice.index)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "combined") setChoice({ kind: "combined" });
                  else setChoice({ kind: "screen", index: parseInt(v, 10) });
                }}
              >
                {result.screens.length > 1 && (
                  <option value="combined">
                    Все экраны ({result.combinedResolutionX}×{result.combinedResolutionY})
                  </option>
                )}
                {result.screens.map((s, i) => (
                  <option key={s.id} value={String(i)}>
                    {s.name} ({s.resolutionX}×{s.resolutionY})
                  </option>
                ))}
              </select>
            </div>

            {/* Паттерн */}
            <div className="field">
              <label className="field-label">Тип паттерна</label>
              <select
                className="select-input"
                value={pattern}
                onChange={(e) => setPattern(e.target.value as PatternId)}
              >
                {PATTERNS.map((p) => (
                  <option
                    key={p}
                    value={p}
                    disabled={p === "cabinet_grid" && !cabinetGridAvailable}
                  >
                    {PATTERN_LABELS[p]}
                    {p === "cabinet_grid" && !cabinetGridAvailable ? " — недоступно" : ""}
                  </option>
                ))}
              </select>
              {pattern === "cabinet_grid" && (
                <div className="field-hint">
                  Границы и номера кабинетов из расчёта. Полезно для проверки
                  стыков и подписей при приёмке.
                </div>
              )}
            </div>

            {/* Разрешение */}
            <div className="field">
              <label className="field-label">Разрешение</label>
              <div className="testpattern-resolution-row">
                <input
                  type="checkbox"
                  id="tp-manual"
                  checked={manualResolution}
                  disabled={isCabinetGrid}
                  onChange={(e) => setManualResolution(e.target.checked)}
                />
                <label htmlFor="tp-manual" className="checkbox-label">
                  Вручную
                </label>
                <input
                  type="number"
                  className="num-input"
                  min={1}
                  max={16384}
                  value={manualResolution ? manualW : exportW}
                  disabled={!manualResolution || isCabinetGrid}
                  onChange={(e) => setManualW(parseInt(e.target.value || "0", 10))}
                />
                <span className="dim-x">×</span>
                <input
                  type="number"
                  className="num-input"
                  min={1}
                  max={16384}
                  value={manualResolution ? manualH : exportH}
                  disabled={!manualResolution || isCabinetGrid}
                  onChange={(e) => setManualH(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div className="field-hint">
                По умолчанию — точное разрешение выбранного экрана.
                Файл будет PNG ровно этого размера, пиксель в пиксель.
              </div>
            </div>

            {/* Параметры паттернов */}
            {pattern === "solid" && (
              <div className="field">
                <label className="field-label">Цвет</label>
                <div className="testpattern-color-row">
                  <input
                    type="color"
                    value={solidColor}
                    onChange={(e) => setSolidColor(e.target.value)}
                  />
                  <select
                    className="select-input"
                    value={solidColor}
                    onChange={(e) => setSolidColor(e.target.value)}
                  >
                    {COLOR_PRESETS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label} ({c.value})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {pattern === "checkerboard" && (
              <div className="field">
                <label className="field-label">Размер клетки (px)</label>
                <div className="testpattern-preset-row">
                  {[1, 2, 4, 8, 16, 32, 64, 128].map((s) => (
                    <button
                      key={s}
                      className={`btn small ${checkerSize === s ? "primary" : ""}`}
                      onClick={() => setCheckerSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pattern === "pixel_grid" && (
              <div className="field">
                <label className="field-label">Шаг сетки (px)</label>
                <div className="testpattern-preset-row">
                  {[1, 2, 4, 8, 16, 32, 64].map((s) => (
                    <button
                      key={s}
                      className={`btn small ${gridStep === s ? "primary" : ""}`}
                      onClick={() => setGridStep(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="field-hint">
                  Шаг 1 = чистая 1px шахматка для проверки масштаба «1:1».
                </div>
              </div>
            )}
          </div>

          {/* Превью */}
          <div className="testpattern-preview-wrap">
            <div className="testpattern-preview-label">
              Превью · {exportW}×{exportH}
            </div>
            <canvas
              ref={previewRef}
              className="testpattern-preview"
              width={420}
              height={240}
            />
          </div>
        </div>

        <div className="modal-actions testpattern-actions">
          <button className="btn" onClick={onClose}>Закрыть</button>
          <button
            className="btn primary"
            onClick={handleExport}
            disabled={busy}
          >
            {busy ? "Создаю PNG…" : `Скачать PNG ${exportW}×${exportH}`}
          </button>
        </div>
      </div>
    </div>
  );
}
