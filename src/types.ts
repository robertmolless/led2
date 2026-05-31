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


export interface Processor {
  id: string;
  name: string;
  portCount: number;
  maxPixelsPerPort: number;
  maxTotalPixels: number;
  maxWidth: number;
  maxHeight: number;
  hasVideoProcessing: boolean;
  note: string;
}

export interface ProcessorRecommendation {
  processor: Processor;
  unitsNeeded: number;   // сколько штук такого процессора нужно (обычно 1)
  fits: boolean;         // влезает ли проект в один процессор
  reasons: string[];     // человекочитаемое объяснение «почему»
}

/**
 * Патч одного экрана внутри процессорного юнита: на каком процессоре (его
 * номер), какими портами заведён UP и BACKUP, режим и EDID.
 */
export interface ScreenPatch {
  unitIndex: number;       // номер процессора (1-based)
  processorName: string;   // "NovaStar VX1000"
  routingText: string;     // "Слева направо снизу вверх"
  upPorts: number[];       // [1,2]
  backupPorts: number[];   // [5,6] (пусто, если backup выключен)
  mode: string;            // "PIXEL TO PIXEL FULL SCALE"
  edid: string;            // "1152×960"
}

/**
 * Один физический процессор (юнит). На него может быть заведено НЕСКОЛЬКО
 * экранов — пока хватает портов и пикселей. Суть группировки — ресурсы портов.
 */
export interface ProcessorUnit {
  index: number;           // 1-based номер процессора
  processor: Processor;
  screenIds: string[];     // какие экраны заведены на этот процессор
  screenNames: string[];
  usedPorts: number;       // занято портов (UP + BACKUP)
  usedPixels: number;
  overflow: boolean;       // экран(ы) не влезают в один юнит этой модели
}

export interface PatchPlan {
  units: ProcessorUnit[];
  model: Processor;                       // выбранная модель процессора
  perScreen: Record<string, ScreenPatch>; // patch по id экрана
  warnings: string[];
}

export type ProcessorMode = "auto" | "manual";

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

/**
 * Конфигурация ОДНОГО экрана. В проекте их может быть несколько и все они
 * независимы: каждый со своими размерами, разводкой сигнала и стойками.
 */
export interface ScreenConfig {
  id: string;
  name: string;                 // "Левый", "Центр", "L", "C", "R" и т.п.
  widthMeters: number;
  heightMeters: number;
  orientation: Orientation;
  signalRoutingMode: SignalRoutingMode;
  signalInputSide: SideName;
  backupSide: BackupSide;
  legsMode: LegsMode;
  manualLegs: number;
  /**
   * Докидывать ли ряд модулей 0.5×0.5, если высота не делится нацело на 1 м
   * (актуально только когда основной модуль — 0.5×1). По умолчанию true.
   */
  fillHalfModules: boolean;
  /** Процессор для этого экрана при ручном выборе (id). Иначе берётся общий. */
  processorId?: string;
}

/**
 * Конфигурация проекта. Глобальные параметры (модуль, вид, отображение)
 * общие для всех экранов; геометрия и разводка — в массиве screens.
 */
export interface ProjectConfig {
  projectName: string;
  cabinetPresetId: string;      // общий модуль для всех экранов
  viewMode: ViewMode;           // общий вид (для сцены — «из зала» = front)
  powerRoutingMode: PowerRoutingMode;
  backupEnabled: boolean;
  showCabinetNumbers: boolean;
  showPortNumbers: boolean;
  showLegend: boolean;
  processorMode: ProcessorMode;   // авто-подбор или ручной выбор процессора
  processorId: string;            // выбранный вручную процессор (при manual)
  screens: ScreenConfig[];
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

/**
 * Результат расчёта ОДНОГО экрана.
 */
export interface ScreenResult {
  id: string;
  name: string;
  processorId?: string;        // выбранный вручную процессор экрана (если есть)
  signalInputSide: SideName;
  signalRoutingMode: SignalRoutingMode;
  requestedWidthM: number;
  requestedHeightM: number;

  cabinetWidthM: number;
  cabinetHeightM: number;
  cabinetPixelW: number;
  cabinetPixelH: number;

  cabinetCountX: number;
  cabinetCountY: number;
  totalCabinets: number;

  resolutionX: number;
  resolutionY: number;
  pixelsPerCabinet: number;
  totalPixels: number;

  // фактические размеры (целое число модулей)
  actualWidthM: number;
  actualHeightM: number;

  maxCabinetsPerPort: number;
  portsNeeded: number;
  averagePortLoadPercent: number;
  maxPortLoadPercent: number;

  totalPowerWatts: number;
  totalPowerKw: number;
  totalWeightKg: number;

  legsCount: number;

  warnings: string[];
  ports: PortGroup[];
  cabinets: CabinetCell[];
}

/**
 * Результат расчёта всего проекта: по каждому экрану + суммарные показатели.
 */
export interface ProjectResult {
  screens: ScreenResult[];

  screenCount: number;
  totalCabinets: number;
  totalPixels: number;
  totalPowerKw: number;
  totalWeightKg: number;
  totalPorts: number;
  totalLegs: number;

  // Габариты «ALL»: экраны стоят в ряд → ширина суммируется, высота берётся макс.
  combinedWidthM: number;
  combinedHeightM: number;
  combinedResolutionX: number;
  combinedResolutionY: number;

  warnings: string[]; // агрегированные, с префиксом имени экрана
  pixelPitch: string;
  moduleName: string;

  // Кофры (флайт-кейсы) по типам модулей.
  modulesByType: { half: number; tall: number };   // 0.5×0.5 и 0.5×1
  cases: { half: number; tall: number; total: number };

  // Вводные по проводам и линии данных.
  powerInputs: number;   // силовые вводы (по мощности)
  dataLines: number;     // линии данных (Ethernet к экранам), с учётом backup
  backupEnabled: boolean;
}

export interface SavedProject {
  id: string;
  createdAt: number;
  updatedAt: number;
  config: ProjectConfig;
}
