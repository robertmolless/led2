import type { ProjectConfig, ScreenConfig } from "../types";
import {
  CABINET_PRESETS,
  canonicalPresetId,
  getPresetById
} from "../data/cabinetPresets";
import { NumericField } from "./NumericField";
import { makeDefaultScreen, makeStageLCRConfig } from "../utils/defaults";

interface Props {
  config: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
}

export function InputPanel({ config, onChange }: Props) {
  const preset = getPresetById(config.cabinetPresetId);
  const presetIdForSelect = canonicalPresetId(config.cabinetPresetId);
  const patch = (p: Partial<ProjectConfig>) => onChange({ ...config, ...p });

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
          <span>Модуль</span>
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
          <input
            type="checkbox"
            checked={config.backupEnabled}
            onChange={(e) => patch({ backupEnabled: e.target.checked })}
          />
          <span>Backup включён</span>
        </label>

        <label className="field field-checkbox">
          <input
            type="checkbox"
            checked={config.showCabinetNumbers}
            onChange={(e) => patch({ showCabinetNumbers: e.target.checked })}
          />
          <span>Показывать номера модулей</span>
        </label>

        <label className="field field-checkbox">
          <input
            type="checkbox"
            checked={config.showPortNumbers}
            onChange={(e) => patch({ showPortNumbers: e.target.checked })}
          />
          <span>Показывать номера портов</span>
        </label>

        <label className="field field-checkbox">
          <input
            type="checkbox"
            checked={config.showLegend}
            onChange={(e) => patch({ showLegend: e.target.checked })}
          />
          <span>Показывать легенду</span>
        </label>
      </div>

      <div className="screens-head">
        <h2 className="panel-title" style={{ margin: 0 }}>
          Экраны ({config.screens.length})
        </h2>
        <button
          type="button"
          className="btn small"
          onClick={() => onChange({ ...makeStageLCRConfig(), projectName: config.projectName, cabinetPresetId: config.cabinetPresetId })}
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
            orientable={preset.orientable}
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
          <div><dt>Лимит порта</dt><dd>{preset.maxPixelsPerPort.toLocaleString("ru-RU")} px</dd></div>
        </dl>
      </div>
    </div>
  );
}

interface CardProps {
  screen: ScreenConfig;
  index: number;
  total: number;
  orientable: boolean;
  onChange: (p: Partial<ScreenConfig>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

function ScreenCard({ screen, index, total, orientable, onChange, onRemove, onMove }: CardProps) {
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

        {orientable && (
          <label className="field">
            <span>Ориентация модуля</span>
            <select value={screen.orientation} onChange={(e) => onChange({ orientation: e.target.value as ScreenConfig["orientation"] })}>
              <option value="horizontal">Горизонтальная</option>
              <option value="vertical">Вертикальная</option>
            </select>
          </label>
        )}

        <label className="field">
          <span>Разводка сигнала</span>
          <select value={screen.signalRoutingMode} onChange={(e) => onChange({ signalRoutingMode: e.target.value as ScreenConfig["signalRoutingMode"] })}>
            <option value="horizontal_rows">Горизонтально по рядам</option>
            <option value="snake_rows">Змейка по рядам</option>
            <option value="vertical_columns">Вертикально по колонкам</option>
            <option value="snake_columns">Змейка по колонкам</option>
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

        <label className="field">
          <span>Сторона backup</span>
          <select value={screen.backupSide} onChange={(e) => onChange({ backupSide: e.target.value as ScreenConfig["backupSide"] })}>
            <option value="opposite">Противоположно</option>
            <option value="left">Слева</option>
            <option value="right">Справа</option>
            <option value="top">Сверху</option>
            <option value="bottom">Снизу</option>
          </select>
        </label>

        <label className="field">
          <span>Стойки</span>
          <select value={screen.legsMode} onChange={(e) => onChange({ legsMode: e.target.value as ScreenConfig["legsMode"] })}>
            <option value="auto">Автоматически</option>
            <option value="manual">Вручную</option>
          </select>
        </label>

        {screen.legsMode === "manual" && (
          <NumericField label="Стоек, шт" value={screen.manualLegs} integer min={0} onChange={(n) => onChange({ manualLegs: n })} />
        )}
      </div>
    </div>
  );
}
