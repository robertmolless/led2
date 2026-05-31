import type { ProjectConfig, ScreenConfig } from "../types";
import { DEFAULT_PRESET_ID } from "../data/cabinetPresets";

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/** Создаёт экран с разумными значениями по умолчанию. */
export function makeDefaultScreen(partial?: Partial<ScreenConfig>): ScreenConfig {
  return {
    id: uid("scr"),
    name: "Экран 1",
    widthMeters: 7,
    heightMeters: 3,
    orientation: "horizontal",
    signalRoutingMode: "snake_rows",
    signalInputSide: "left",
    backupSide: "opposite",
    legsMode: "auto",
    manualLegs: 6,
    ...partial
  };
}

export function makeDefaultConfig(): ProjectConfig {
  return {
    projectName: "Новый проект",
    cabinetPresetId: DEFAULT_PRESET_ID,
    // Для сценических сборок схему смотрят «из зала» — вид спереди.
    viewMode: "front",
    powerRoutingMode: "same_as_signal",
    backupEnabled: true,
    showCabinetNumbers: true,
    showPortNumbers: true,
    showLegend: true,
    screens: [makeDefaultScreen({ name: "Центр" })]
  };
}

/** Быстрый пресет: три экрана (Левый / Центр / Правый) — типовая сцена. */
export function makeStageLCRConfig(): ProjectConfig {
  const base = makeDefaultConfig();
  return {
    ...base,
    projectName: "Сцена L/C/R",
    screens: [
      makeDefaultScreen({ name: "Левый", widthMeters: 3, heightMeters: 2.5, signalInputSide: "left" }),
      makeDefaultScreen({ name: "Центр", widthMeters: 5, heightMeters: 3, signalInputSide: "left" }),
      makeDefaultScreen({ name: "Правый", widthMeters: 3, heightMeters: 2.5, signalInputSide: "right" })
    ]
  };
}
