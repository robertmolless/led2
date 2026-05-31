import type { ProjectConfig } from "../types";
import {
  CABINET_PRESETS,
  canonicalPresetId,
  getPresetById
} from "../data/cabinetPresets";
import { NumericField } from "./NumericField";

interface Props {
  config: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
}

export function InputPanel({ config, onChange }: Props) {
  const preset = getPresetById(config.cabinetPresetId);
  // Канонический id (с маппингом legacy → актуальный) — для корректного value у <select>.
  const presetIdForSelect = canonicalPresetId(config.cabinetPresetId);

  const patch = (p: Partial<ProjectConfig>) => onChange({ ...config, ...p });

  return (
    <div className="panel input-panel">
      <h2 className="panel-title">Параметры экрана</h2>

      <div className="form-grid">
        <label className="field">
          <span>Название проекта</span>
          <input
            type="text"
            value={config.projectName}
            onChange={(e) => patch({ projectName: e.target.value })}
          />
        </label>

        <NumericField
          label="Ширина экрана, м"
          value={config.screenWidthMeters}
          onChange={(n) => patch({ screenWidthMeters: n })}
          min={0.5}
          hint="Можно вводить через запятую или точку"
        />

        <NumericField
          label="Высота экрана, м"
          value={config.screenHeightMeters}
          onChange={(n) => patch({ screenHeightMeters: n })}
          min={0.5}
        />

        <NumericField
          label="Количество экранов"
          value={config.screenCount}
          onChange={(n) => patch({ screenCount: n })}
          integer
          min={1}
        />

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

        {preset.orientable && (
          <label className="field">
            <span>Ориентация модуля</span>
            <select
              value={config.orientation}
              onChange={(e) => patch({ orientation: e.target.value as ProjectConfig["orientation"] })}
            >
              <option value="horizontal">Горизонтальная</option>
              <option value="vertical">Вертикальная</option>
            </select>
          </label>
        )}

        <label className="field">
          <span>Разводка сигнала</span>
          <select
            value={config.signalRoutingMode}
            onChange={(e) => patch({ signalRoutingMode: e.target.value as ProjectConfig["signalRoutingMode"] })}
          >
            <option value="horizontal_rows">Горизонтально по рядам</option>
            <option value="snake_rows">Змейка по рядам</option>
            <option value="vertical_columns">Вертикально по колонкам</option>
            <option value="snake_columns">Змейка по колонкам</option>
          </select>
        </label>

        <label className="field">
          <span>Разводка питания</span>
          <select
            value={config.powerRoutingMode}
            onChange={(e) => patch({ powerRoutingMode: e.target.value as ProjectConfig["powerRoutingMode"] })}
          >
            <option value="same_as_signal">Как сигнал</option>
            <option value="horizontal_rows">Горизонтально</option>
            <option value="vertical_columns">Вертикально</option>
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

        <label className="field">
          <span>Сторона ввода сигнала</span>
          <select
            value={config.signalInputSide}
            onChange={(e) => patch({ signalInputSide: e.target.value as ProjectConfig["signalInputSide"] })}
          >
            <option value="left">Слева</option>
            <option value="right">Справа</option>
            <option value="top">Сверху</option>
            <option value="bottom">Снизу</option>
          </select>
        </label>

        <label className="field">
          <span>Сторона backup</span>
          <select
            value={config.backupSide}
            onChange={(e) => patch({ backupSide: e.target.value as ProjectConfig["backupSide"] })}
          >
            <option value="opposite">Противоположно</option>
            <option value="left">Слева</option>
            <option value="right">Справа</option>
            <option value="top">Сверху</option>
            <option value="bottom">Снизу</option>
          </select>
        </label>

        <label className="field">
          <span>Количество стоек</span>
          <select
            value={config.legsMode}
            onChange={(e) => patch({ legsMode: e.target.value as ProjectConfig["legsMode"] })}
          >
            <option value="auto">Автоматически</option>
            <option value="manual">Вручную</option>
          </select>
        </label>

        {config.legsMode === "manual" && (
          <NumericField
            label="Стоек, шт"
            value={config.manualLegs}
            onChange={(n) => patch({ manualLegs: n })}
            integer
            min={0}
          />
        )}

        <label className="field">
          <span>Вид</span>
          <select
            value={config.viewMode}
            onChange={(e) => patch({ viewMode: e.target.value as ProjectConfig["viewMode"] })}
          >
            <option value="back">Сзади</option>
            <option value="front">Спереди</option>
          </select>
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

      <div className="preset-info">
        <h3>Параметры модуля</h3>
        <dl>
          <div><dt>Версия</dt><dd>{preset.pixelPitch}</dd></div>
          <div><dt>Размер</dt><dd>{preset.widthMeters}×{preset.heightMeters} м</dd></div>
          <div><dt>Разрешение</dt><dd>{preset.pixelWidth}×{preset.pixelHeight} px</dd></div>
          <div><dt>Пикселей</dt><dd>{(preset.pixelWidth * preset.pixelHeight).toLocaleString("ru-RU")} px</dd></div>
          <div><dt>Потребление</dt><dd>{preset.powerWatts} Вт</dd></div>
          <div><dt>Вес</dt><dd>{preset.weightKg} кг</dd></div>
          <div><dt>Лимит порта</dt><dd>{preset.maxPixelsPerPort.toLocaleString("ru-RU")} px</dd></div>
        </dl>
      </div>
    </div>
  );
}
