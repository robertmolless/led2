import type { CabinetPreset } from "../types";

/**
 * Модули для экрана P2.6.
 *
 * В текущей версии поддерживается одна версия экрана — P2.6, и два модуля:
 *   - 0.5×0.5 (квадратный, не поворачивается);
 *   - 0.5×1   (вертикальный, монтируется ТОЛЬКО вертикально — orientable=false).
 *
 * Архитектура (поле pixelPitch + список) рассчитана на лёгкое добавление
 * P3 / P3.9 / P4 в дальнейшем — нужно просто добавить новые объекты сюда.
 */
export const CABINET_PRESETS: CabinetPreset[] = [
  {
    id: "p26-0.5x0.5",
    name: "P2.6 0.5×0.5",
    pixelPitch: "P2.6",
    widthMeters: 0.5,
    heightMeters: 0.5,
    pixelWidth: 192,
    pixelHeight: 192,
    powerWatts: 125,
    weightKg: 6.9,
    maxPixelsPerPort: 650_000,
    orientable: false
  },
  {
    id: "p26-0.5x1",
    name: "P2.6 0.5×1",
    pixelPitch: "P2.6",
    // Модуль монтируется ТОЛЬКО вертикально (0.5 м ширина × 1 м высота).
    widthMeters: 0.5,
    heightMeters: 1.0,
    pixelWidth: 192,
    pixelHeight: 384,
    powerWatts: 250,
    weightKg: 12,
    maxPixelsPerPort: 650_000,
    // Поворот запрещён — горизонтальный монтаж этого модуля невозможен.
    orientable: false
  }
];

export const DEFAULT_PRESET_ID = "p26-0.5x0.5";

/**
 * Совместимость со старыми id (для уже сохранённых в localStorage проектов).
 * При прошлой версии модуль 0.5×1 хранился как "p26-1x0.5".
 */
const LEGACY_PRESET_ID_MAP: Record<string, string> = {
  "p26-1x0.5": "p26-0.5x1"
};

export function canonicalPresetId(id: string): string {
  return LEGACY_PRESET_ID_MAP[id] ?? id;
}

export function getPresetById(id: string): CabinetPreset {
  const canonical = canonicalPresetId(id);
  const preset = CABINET_PRESETS.find((p) => p.id === canonical);
  if (!preset) {
    // На случай если в localStorage остался id от удалённого пресета.
    return CABINET_PRESETS[0];
  }
  return preset;
}
