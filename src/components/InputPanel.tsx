import { useState } from "react";
import type { ProjectConfig, ScreenConfig, ProcessorRecommendation, PatchPlan } from "../types";
import {
  CABINET_PRESETS,
  canonicalPresetId,
  getPresetById,
  isTallModule
} from "../data/cabinetPresets";
import { PROCESSORS } from "../data/processors";
import { NumericField } from "./NumericField";
import { makeDefaultScreen, makeStageLCRConfig } from "../utils/defaults";

interface Props {
  config: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
  recommendation?: ProcessorRecommendation;
  patchPlan?: PatchPlan;
}

export function InputPanel({ config, onChange, recommendation, patchPlan }: Props) {
  const preset = getPresetById(config.cabinetPresetId);
  const presetIdForSelect = canonicalPresetId(config.cabinetPresetId);
  const tall = isTallModule(preset);
  const patch = (p: Partial<ProjectConfig>) => onChange({ ...config, ...p });

  const [showWhy, setShowWhy] = useState(false);

  const updateScreen = (id: string, p: Partial<ScreenConfig>) =>
    patch({ screens: config.screens.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const addScreen = () => {
    const n = config.screens.length + 1;
    patch({ screens: [...config.screens, makeDefaultScreen({ name: `Экран ${n}` })] });
  };
  const removeScreen = (id: string) => {
    if (config.screens.length <= 1) return;
    patch({ screens: config.screens.filter((s) => s.id !== id) });
  };
  const moveScreen = (id: string, dir: -1 | 1) => {
    const arr = [...config.screens];
    const i = arr.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    patch({ screens: arr });
  };

  return (
    <div className="panel input-panel">
      <h2 className="panel-title">Проект</h2>

      <div className="form-grid">
        <label className="field">
          <span>Название проекта</span>
          <input
            type="text"
            value={config.projectName}
            onChange={(e) => patch({ projectName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Основной модуль</span>
          <select
            value={presetIdForSelect}
            onChange={(e) => patch({ cabinetPresetId: e.target.value })}
          >
            {CABINET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Вид</span>
          <select
            value={config.viewMode}
            onChange={(e) => patch({ viewMode: e.target.value as ProjectConfig["viewMode"] })}
          >
            <option value="front">Из зала (спереди)</option>
            <option value="back">Сзади</option>
          </select>
        </label>

        <label className="field field-checkbox">
          <input type="checkbox" checked={config.backupEnabled} onChange={(e) => patch({ backupEnabled: e.target.checked })} />
          <span>Backup включён</span>
        </label>
        <label className="field field-checkbox">
          <input type="checkbox" checked={config.showCabinetNumbers} onChange={(e) => patch({ showCabinetNumbers: e.target.checked })} />
          <span>Показывать номера модулей</span>
        </label>
        <label className="field field-checkbox">
          <input type="checkbox" checked={config.showPortNumbers} onChange={(e) => patch({ showPortNumbers: e.target.checked })} />
          <span>Показывать номера портов</span>
        </label>
        <label className="field field-checkbox">
          <input type="checkbox" checked={config.showLegend} onChange={(e) => patch({ showLegend: e.target.checked })} />
          <span>Показывать легенду</span>
        </label>
      </div>

      {/* ===== Процессор ===== */}
      <div className="processor-block">
        <div className="processor-head">
          <h3 className="panel-title" style={{ margin: 0 }}>Процессор</h3>
          <button
            type="button"
            className="why-btn"
            onClick={() => setShowWhy((v) => !v)}
            title="Почему этот процессор?"
            aria-label="Почему этот процессор?"
          >?</button>
        </div>

        <label className="field">
          <span>Подбор</span>
          <select
            value={config.processorMode}
            onChange={(e) => patch({ processorMode: e.target.value as ProjectConfig["processorMode"] })}
          >
            <option value="auto">Автоматически</option>
            <option value="manual">Вручную (одна модель)</option>
          </select>
          <small className="field-hint">
            {config.processorMode === "auto"
              ? "Под каждый процессор подбирается своя модель; экраны паку­ются по портам."
              : "Выбранная модель применяется ко всем процессорам проекта."}
          </small>
        </label>

        {config.processorMode === "manual" && (
          <label className="field">
            <span>Модель</span>
            <select
              value={config.processorId}
              onChange={(e) => patch({ processorId: e.target.value })}
            >
              {PROCESSORS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.portCount} порт</option>
              ))}
            </select>
          </label>
        )}

        {/* Фактическая раскладка по процессорам (упаковка по портам). */}
        {patchPlan && patchPlan.units.length > 0 && (
          <div className="processor-units">
            {patchPlan.warnings.map((w, i) => (
              <div key={i} className="processor-result over"><div className="processor-name">⚠ {w}</div></div>
            ))}
            {patchPlan.units.map((u) => (
              <div key={u.index} className={`processor-result ${u.overflow ? "over" : ""}`}>
                <div className="processor-name">Проц №{u.index}: {u.processor.name}</div>
                <div className="processor-spec">
                  {u.screenNames.join(", ")} · {u.usedPorts}/{u.processor.portCount} порт
                </div>
              </div>
            ))}
          </div>
        )}

        {showWhy && (
          <div className="why-box">
            <strong>Как считается:</strong>
            <ul>
              <li>Порты: ряд = порт (без змеек); с backup число удваивается.</li>
              <li><b>Авто:</b> экраны упаковываются на процессор, пока хватает портов и пикселей; кончились — берётся следующий.</li>
              <li><b>Вручную:</b> для каждого экрана выбирается свой процессор в его карточке.</li>
              <li><b>Кофры:</b> 0.5×0.5 — 8 шт в кофре, 0.5×1 — 6 шт. Число = округление вверх (модули÷вместимость).</li>
              <li><b>Силовые вводы:</b> мощность ÷ 3.5 кВт (16 А), округление вверх.</li>
              <li><b>Линии данных:</b> число портов × 2 при backup (по кабелю на порт).</li>
              <li><b>Выходы HDMI:</b> по одному на каждый процессор; несколько экранов на одном — LINK SPLIT.</li>
              {recommendation && recommendation.reasons.slice(0, 1).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="why-note">
              Лимит одного порта NovaStar — 650 000 px. Полная ёмкость = порты × 650k.
            </div>
          </div>
        )}
      </div>

      <div className="screens-head">
        <h2 className="panel-title" style={{ margin: 0 }}>
          Экраны ({config.screens.length})
        </h2>
        <button
          type="button"
          className="btn small"
          onClick={() => onChange({ ...makeStageLCRConfig(), projectName: config.projectName, cabinetPresetId: config.cabinetPresetId, processorMode: config.processorMode, processorId: config.processorId })}
          title="Быстрый пресет: Левый / Центр / Правый"
        >
          Сцена L/C/R
        </button>
      </div>

      <div className="screen-cards">
        {config.screens.map((screen, idx) => (
          <ScreenCard
            key={screen.id}
            screen={screen}
            index={idx}
            total={config.screens.length}
            showFill={tall}
            manualMode={config.processorMode === "manual"}
            defaultProcessorId={config.processorId}
            onChange={(p) => updateScreen(screen.id, p)}
            onRemove={() => removeScreen(screen.id)}
            onMove={(d) => moveScreen(screen.id, d)}
          />
        ))}
      </div>

      <button type="button" className="btn add-screen-btn" onClick={addScreen}>
        + Добавить экран
      </button>

      <div className="preset-info">
        <h3>Параметры модуля</h3>
        <dl>
          <div><dt>Версия</dt><dd>{preset.pixelPitch}</dd></div>
          <div><dt>Размер</dt><dd>{preset.widthMeters}×{preset.heightMeters} м</dd></div>
          <div><dt>Разрешение</dt><dd>{preset.pixelWidth}×{preset.pixelHeight} px</dd></div>
          <div><dt>Потребление</dt><dd>{preset.powerWatts} Вт</dd></div>
          <div><dt>Вес</dt><dd>{preset.weightKg} кг</dd></div>
          <div><dt>Лимит порта</dt><dd>650 000 px</dd></div>
        </dl>
        {tall && (
          <div className="module-hint">
            Модуль 0.5×1 — высокий. Если высота экрана не кратна 1 м, сверху можно
            докинуть ряд модулей 0.5×0.5 (тумблер «Добор 0.5» в карточке экрана).
          </div>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  screen: ScreenConfig;
  index: number;
  total: number;
  showFill: boolean;
  manualMode: boolean;
  defaultProcessorId: string;
  onChange: (p: Partial<ScreenConfig>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

function ScreenCard({ screen, index, total, showFill, manualMode, defaultProcessorId, onChange, onRemove, onMove }: CardProps) {
  // Режим разводки: показываем только линейные (без змеек). Старые значения
  // snake_* отображаем как их линейные аналоги.
  const routing =
    screen.signalRoutingMode === "vertical_columns" || screen.signalRoutingMode === "snake_columns"
      ? "vertical_columns"
      : "horizontal_rows";

  return (
    <div className="screen-card">
      <div className="screen-card-head">
        <input
          className="screen-name"
          type="text"
          value={screen.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={`Экран ${index + 1}`}
        />
        <div className="screen-card-actions">
          <button type="button" className="btn small ghost" disabled={index === 0} onClick={() => onMove(-1)} title="Выше">↑</button>
          <button type="button" className="btn small ghost" disabled={index === total - 1} onClick={() => onMove(1)} title="Ниже">↓</button>
          <button type="button" className="btn small danger" disabled={total <= 1} onClick={onRemove} title="Удалить экран">×</button>
        </div>
      </div>

      <div className="form-grid">
        <div className="two-col">
          <NumericField label="Ширина, м" value={screen.widthMeters} min={0.5} onChange={(n) => onChange({ widthMeters: n })} />
          <NumericField label="Высота, м" value={screen.heightMeters} min={0.5} onChange={(n) => onChange({ heightMeters: n })} />
        </div>

        <label className="field">
          <span>Разводка сигнала</span>
          <select
            value={routing}
            onChange={(e) => onChange({ signalRoutingMode: e.target.value as ScreenConfig["signalRoutingMode"] })}
          >
            <option value="horizontal_rows">Горизонтально в линию</option>
            <option value="vertical_columns">Вертикально в линию</option>
          </select>
        </label>

        <label className="field">
          <span>Сторона ввода сигнала</span>
          <select value={screen.signalInputSide} onChange={(e) => onChange({ signalInputSide: e.target.value as ScreenConfig["signalInputSide"] })}>
            <option value="left">Слева</option>
            <option value="right">Справа</option>
            <option value="top">Сверху</option>
            <option value="bottom">Снизу</option>
          </select>
        </label>

        {showFill && (
          <label className="field field-checkbox">
            <input
              type="checkbox"
              checked={screen.fillHalfModules !== false}
              onChange={(e) => onChange({ fillHalfModules: e.target.checked })}
            />
            <span>Добор 0.5 (докидывать ряд 0.5×0.5)</span>
          </label>
        )}

        {manualMode && (
          <label className="field">
            <span>Процессор экрана</span>
            <select
              value={screen.processorId ?? defaultProcessorId}
              onChange={(e) => onChange({ processorId: e.target.value })}
            >
              {PROCESSORS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="field-note">
          Ноги: авто — 1 шт на 1 метр ширины ({screen.widthMeters > 0 ? Math.max(1, Math.round(screen.widthMeters)) : 0} шт), ставятся внутри.
        </div>
      </div>
    </div>
  );
}
