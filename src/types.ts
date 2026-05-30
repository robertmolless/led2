// Все доменные типы приложения.

export interface CabinetPreset {
  id: string;
  name: string;            // например "P2.6 0.5×0.5"
  pixelPitch: string;      // "P2.6"
  widthMeters: number;     // физический размер кабинета
  heightMeters: number;
  pixelWidth: number;      // разрешение кабинета (база — без поворота)
  pixelHeight: number;
  powerWatts: number;      // мощность одного кабинета
  weightKg: number;        // вес одного кабинета
  maxPixelsPerPort: number;// лимит NovaStar порта в пикселях
  /**
   * Можно ли менять ориентацию (true для 1×0.5, false для 0.5×0.5).
   */
  orientable: boolean;
}

export type Orientation = "horizontal" | "vertical";

export type SignalRoutingMode =
  | "horizontal_rows"
  | "snake_rows"
  | "vertical_columns"
  | "snake_columns";

export type PowerRoutingMode =
  | "horizontal_rows"
  | "vertical_columns"
  | "same_as_signal";

export type SideName = "left" | "right" | "top" | "bottom";
export type BackupSide = "opposite" | SideName;

export type LegsMode = "auto" | "manual";

export type ViewMode = "front" | "back";

export interface ProjectConfig {
  projectName: string;
  screenWidthMeters: number;
  screenHeightMeters: number;
  screenCount: number;
  cabinetPresetId: string;
  orientation: Orientation;
  signalRoutingMode: SignalRoutingMode;
  powerRoutingMode: PowerRoutingMode;
  backupEnabled: boolean;
  signalInputSide: SideName;
  backupSide: BackupSide;
  legsMode: LegsMode;
  manualLegs: number;
  viewMode: ViewMode;
  showCabinetNumbers: boolean;
  showPortNumbers: boolean;
  showLegend: boolean;
}

export interface CabinetCell {
  id: string;          // например "r0c0"
  row: number;         // 0..cabinetCountY-1, 0 — нижний ряд
  col: number;         // 0..cabinetCountX-1, 0 — левый столбец
  x: number;           // x в метрах, левый-нижний угол кабинета
  y: number;           // y в метрах, левый-нижний угол кабинета
  width: number;       // ширина в метрах
  height: number;      // высота в метрах
  pixelWidth: number;
  pixelHeight: number;
  pixelsTotal: number;
  powerWatts: number;
  weightKg: number;
}

export interface PortGroup {
  portNumber: number;
  cabinets: CabinetCell[];
  pixels: number;
  loadPercent: number;
  isOverLimit: boolean;
}

export interface CalculatedResult {
  // Геометрия
  cabinetWidthM: number;
  cabinetHeightM: number;
  cabinetPixelW: number;
  cabinetPixelH: number;

  cabinetCountX: number;
  cabinetCountY: number;
  totalCabinetsOneScreen: number;
  totalCabinetsAllScreens: number;

  resolutionX: number;
  resolutionY: number;
  pixelsPerCabinet: number;
  totalPixelsOneScreen: number;
  totalPixelsAllScreens: number;

  // Порты
  maxCabinetsPerPort: number;
  portsNeededOneScreen: number;
  portsNeededAllScreens: number;
  averagePortLoadPercent: number;
  maxPortLoadPercent: number;

  // Мощность и вес
  totalPowerWattsOneScreen: number;
  totalPowerKwOneScreen: number;
  totalPowerWattsAllScreens: number;
  totalPowerKwAllScreens: number;
  totalWeightKgOneScreen: number;
  totalWeightKgAllScreens: number;

  legsCount: number;

  warnings: string[];
  ports: PortGroup[];
  cabinets: CabinetCell[];
}

export interface SavedProject {
  id: string;
  createdAt: number;
  updatedAt: number;
  config: ProjectConfig;
}
