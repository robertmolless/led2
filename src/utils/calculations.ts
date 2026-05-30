import type {
  CabinetCell,
  CabinetPreset,
  CalculatedResult,
  ProjectConfig
} from "../types";
import { getPresetById } from "../data/cabinetPresets";
import { buildPortGroups } from "./routing";

const EPS = 1e-6;

function fmtNum(n: number): string {
  // Аккуратный вывод числа с двумя знаками без хвостовых нулей.
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(parseFloat(n.toFixed(3)));
}

/**
 * Возвращает «физические» размеры кабинета с учётом выбранной ориентации.
 * Если пресет квадратный или не поворачивается — ориентация игнорируется.
 */
export function resolveCabinetDims(preset: CabinetPreset, orientation: "horizontal" | "vertical") {
  const isVertical = preset.orientable && orientation === "vertical";
  return {
    widthM: isVertical ? preset.heightMeters : preset.widthMeters,
    heightM: isVertical ? preset.widthMeters : preset.heightMeters,
    pixelW: isVertical ? preset.pixelHeight : preset.pixelWidth,
    pixelH: isVertical ? preset.pixelWidth : preset.pixelHeight
  };
}

function calcLegs(screenWidthM: number, manual: number, mode: "auto" | "manual"): number {
  if (mode === "manual") return Math.max(0, Math.floor(manual));
  // Эмпирическое правило: одна стойка примерно на каждый метр ширины,
  // но не меньше двух.
  return Math.max(2, Math.ceil(screenWidthM));
}

export function calculateProject(config: ProjectConfig): CalculatedResult {
  const preset = getPresetById(config.cabinetPresetId);
  const dims = resolveCabinetDims(preset, config.orientation);

  const screenW = config.screenWidthMeters;
  const screenH = config.screenHeightMeters;

  // Сетка кабинетов.
  const rawCountX = screenW / dims.widthM;
  const rawCountY = screenH / dims.heightM;
  const cabinetCountX = Math.max(0, Math.floor(rawCountX + EPS));
  const cabinetCountY = Math.max(0, Math.floor(rawCountY + EPS));

  const totalCabinetsOneScreen = cabinetCountX * cabinetCountY;
  const screenCount = Math.max(1, Math.floor(config.screenCount));
  const totalCabinetsAllScreens = totalCabinetsOneScreen * screenCount;

  // Пиксели.
  const pixelsPerCabinet = dims.pixelW * dims.pixelH;
  const resolutionX = cabinetCountX * dims.pixelW;
  const resolutionY = cabinetCountY * dims.pixelH;
  const totalPixelsOneScreen = totalCabinetsOneScreen * pixelsPerCabinet;
  const totalPixelsAllScreens = totalPixelsOneScreen * screenCount;

  // Порты.
  const maxCabinetsPerPort = Math.max(
    1,
    Math.floor(preset.maxPixelsPerPort / pixelsPerCabinet)
  );

  // Построение реальной матрицы кабинетов (в метрах, начало координат — левый-нижний угол экрана).
  const cabinets: CabinetCell[] = [];
  for (let row = 0; row < cabinetCountY; row++) {
    for (let col = 0; col < cabinetCountX; col++) {
      cabinets.push({
        id: `r${row}c${col}`,
        row,
        col,
        x: col * dims.widthM,
        y: row * dims.heightM,
        width: dims.widthM,
        height: dims.heightM,
        pixelWidth: dims.pixelW,
        pixelHeight: dims.pixelH,
        pixelsTotal: pixelsPerCabinet,
        powerWatts: preset.powerWatts,
        weightKg: preset.weightKg
      });
    }
  }

  // Группировка по портам — отдаём в utils/routing.
  const ports = buildPortGroups(
    cabinets,
    cabinetCountX,
    cabinetCountY,
    maxCabinetsPerPort,
    pixelsPerCabinet,
    preset.maxPixelsPerPort,
    config.signalRoutingMode
  );

  const portsNeededOneScreen = ports.length;
  const portsNeededAllScreens = portsNeededOneScreen * screenCount;

  const averagePortLoadPercent =
    ports.length === 0
      ? 0
      : ports.reduce((s, p) => s + p.loadPercent, 0) / ports.length;
  const maxPortLoadPercent =
    ports.length === 0 ? 0 : Math.max(...ports.map((p) => p.loadPercent));

  // Мощность.
  const totalPowerWattsOneScreen = totalCabinetsOneScreen * preset.powerWatts;
  const totalPowerKwOneScreen = totalPowerWattsOneScreen / 1000;
  const totalPowerWattsAllScreens = totalPowerWattsOneScreen * screenCount;
  const totalPowerKwAllScreens = totalPowerWattsAllScreens / 1000;

  // Вес.
  const totalWeightKgOneScreen = totalCabinetsOneScreen * preset.weightKg;
  const totalWeightKgAllScreens = totalWeightKgOneScreen * screenCount;

  // Стойки.
  const legsCount = calcLegs(screenW, config.manualLegs, config.legsMode);

  // Предупреждения.
  const warnings: string[] = [];

  if (Math.abs(rawCountX - Math.round(rawCountX)) > 1e-3) {
    warnings.push(
      `Ширина экрана (${fmtNum(screenW)} м) не делится нацело на ширину кабинета (${fmtNum(dims.widthM)} м). ` +
        `Используется ${cabinetCountX} кабинетов = ${fmtNum(cabinetCountX * dims.widthM)} м.`
    );
  }
  if (Math.abs(rawCountY - Math.round(rawCountY)) > 1e-3) {
    warnings.push(
      `Высота экрана (${fmtNum(screenH)} м) не делится нацело на высоту кабинета (${fmtNum(dims.heightM)} м). ` +
        `Используется ${cabinetCountY} кабинетов = ${fmtNum(cabinetCountY * dims.heightM)} м.`
    );
  }
  if (cabinetCountX === 0 || cabinetCountY === 0) {
    warnings.push("Экран слишком маленький — кабинеты не помещаются.");
  }
  ports.forEach((p) => {
    if (p.isOverLimit) {
      warnings.push(
        `Порт ${p.portNumber} перегружен: ${p.pixels.toLocaleString("ru-RU")} px > лимита ${preset.maxPixelsPerPort.toLocaleString("ru-RU")} px.`
      );
    }
  });

  return {
    cabinetWidthM: dims.widthM,
    cabinetHeightM: dims.heightM,
    cabinetPixelW: dims.pixelW,
    cabinetPixelH: dims.pixelH,

    cabinetCountX,
    cabinetCountY,
    totalCabinetsOneScreen,
    totalCabinetsAllScreens,

    resolutionX,
    resolutionY,
    pixelsPerCabinet,
    totalPixelsOneScreen,
    totalPixelsAllScreens,

    maxCabinetsPerPort,
    portsNeededOneScreen,
    portsNeededAllScreens,
    averagePortLoadPercent,
    maxPortLoadPercent,

    totalPowerWattsOneScreen,
    totalPowerKwOneScreen,
    totalPowerWattsAllScreens,
    totalPowerKwAllScreens,
    totalWeightKgOneScreen,
    totalWeightKgAllScreens,

    legsCount,
    warnings,
    ports,
    cabinets
  };
}

export function formatKw(kw: number): string {
  if (kw >= 10) return `${kw.toFixed(1)} кВт`;
  return `${kw.toFixed(3)} кВт`;
}

export function formatKg(kg: number): string {
  return `${Math.round(kg).toLocaleString("ru-RU")} кг`;
}
