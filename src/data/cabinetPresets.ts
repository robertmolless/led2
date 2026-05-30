import type { CabinetPreset } from "../types";

/**
 * Базовые пресеты кабинетов.
 * Архитектура рассчитана на лёгкое добавление P3 / P3.9 / P4 и кастомных
 * пресетов — нужно просто добавить новые объекты сюда.
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
    id: "p26-1x0.5",
    name: "P2.6 1×0.5",
    pixelPitch: "P2.6",
    widthMeters: 1.0,
    heightMeters: 0.5,
    pixelWidth: 384,
    pixelHeight: 192,
    powerWatts: 250,
    weightKg: 12,
    maxPixelsPerPort: 650_000,
    orientable: true
  }
];

export const DEFAULT_PRESET_ID = "p26-0.5x0.5";

export function getPresetById(id: string): CabinetPreset {
  const preset = CABINET_PRESETS.find((p) => p.id === id);
  if (!preset) {
    // На случай если в localStorage остался id от удалённого пресета.
    return CABINET_PRESETS[0];
  }
  return preset;
}
