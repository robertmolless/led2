import type { ProjectConfig } from "../types";
import { DEFAULT_PRESET_ID } from "../data/cabinetPresets";

export function makeDefaultConfig(): ProjectConfig {
  return {
    projectName: "Новый экран",
    screenWidthMeters: 12,
    screenHeightMeters: 5,
    screenCount: 1,
    cabinetPresetId: DEFAULT_PRESET_ID,
    orientation: "horizontal",
    // snake_rows даёт минимально возможное число портов (ceil(total/maxPerPort)),
    // как требует ТЗ. horizontal_rows визуально красивее (как на референсах),
    // но при широкой строке = 2 порта на ряд = большее общее число.
    signalRoutingMode: "snake_rows",
    powerRoutingMode: "same_as_signal",
    backupEnabled: true,
    signalInputSide: "left",
    backupSide: "opposite",
    legsMode: "auto",
    manualLegs: 6,
    viewMode: "back",
    showCabinetNumbers: false,
    showPortNumbers: true,
    showLegend: true
  };
}
