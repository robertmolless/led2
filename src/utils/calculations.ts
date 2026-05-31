import type {
  CabinetCell,
  CabinetPreset,
  ProjectConfig,
  ProjectResult,
  ScreenConfig,
  ScreenResult
} from "../types";
import { getPresetById } from "../data/cabinetPresets";
import { buildPortGroups } from "./routing";

const EPS = 1e-6;

function fmtNum(n: number): string {
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
  return Math.max(2, Math.ceil(screenWidthM));
}

/**
 * Расчёт ОДНОГО экрана. Полностью независим от других экранов проекта.
 */
export function calculateScreen(
  screen: ScreenConfig,
  preset: CabinetPreset,
  signalRoutingMode = screen.signalRoutingMode
): ScreenResult {
  const dims = resolveCabinetDims(preset, screen.orientation);

  const screenW = screen.widthMeters;
  const screenH = screen.heightMeters;

  const rawCountX = screenW / dims.widthM;
  const rawCountY = screenH / dims.heightM;
  const cabinetCountX = Math.max(0, Math.floor(rawCountX + EPS));
  const cabinetCountY = Math.max(0, Math.floor(rawCountY + EPS));

  const totalCabinets = cabinetCountX * cabinetCountY;

  const pixelsPerCabinet = dims.pixelW * dims.pixelH;
  const resolutionX = cabinetCountX * dims.pixelW;
  const resolutionY = cabinetCountY * dims.pixelH;
  const totalPixels = totalCabinets * pixelsPerCabinet;

  const maxCabinetsPerPort = Math.max(
    1,
    Math.floor(preset.maxPixelsPerPort / pixelsPerCabinet)
  );

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

  const ports = buildPortGroups(
    cabinets,
    cabinetCountX,
    cabinetCountY,
    maxCabinetsPerPort,
    pixelsPerCabinet,
    preset.maxPixelsPerPort,
    signalRoutingMode,
    screen.signalInputSide
  );

  const portsNeeded = ports.length;
  const averagePortLoadPercent =
    ports.length === 0 ? 0 : ports.reduce((s, p) => s + p.loadPercent, 0) / ports.length;
  const maxPortLoadPercent =
    ports.length === 0 ? 0 : Math.max(...ports.map((p) => p.loadPercent));

  const totalPowerWatts = totalCabinets * preset.powerWatts;
  const totalWeightKg = totalCabinets * preset.weightKg;
  const legsCount = calcLegs(screenW, screen.manualLegs, screen.legsMode);

  const warnings: string[] = [];
  if (Math.abs(rawCountX - Math.round(rawCountX)) > 1e-3) {
    warnings.push(
      `Ширина (${fmtNum(screenW)} м) не делится нацело на ширину модуля (${fmtNum(dims.widthM)} м) → ` +
        `${cabinetCountX} мод. = ${fmtNum(cabinetCountX * dims.widthM)} м.`
    );
  }
  if (Math.abs(rawCountY - Math.round(rawCountY)) > 1e-3) {
    warnings.push(
      `Высота (${fmtNum(screenH)} м) не делится нацело на высоту модуля (${fmtNum(dims.heightM)} м) → ` +
        `${cabinetCountY} мод. = ${fmtNum(cabinetCountY * dims.heightM)} м.`
    );
  }
  if (cabinetCountX === 0 || cabinetCountY === 0) {
    warnings.push("Экран слишком маленький — модули не помещаются.");
  }
  ports.forEach((p) => {
    if (p.isOverLimit) {
      warnings.push(
        `Порт ${p.portNumber} перегружен: ${p.pixels.toLocaleString("ru-RU")} px > лимита ${preset.maxPixelsPerPort.toLocaleString("ru-RU")} px.`
      );
    }
  });

  return {
    id: screen.id,
    name: screen.name,
    signalInputSide: screen.signalInputSide,
    requestedWidthM: screenW,
    requestedHeightM: screenH,
    cabinetWidthM: dims.widthM,
    cabinetHeightM: dims.heightM,
    cabinetPixelW: dims.pixelW,
    cabinetPixelH: dims.pixelH,
    cabinetCountX,
    cabinetCountY,
    totalCabinets,
    resolutionX,
    resolutionY,
    pixelsPerCabinet,
    totalPixels,
    actualWidthM: cabinetCountX * dims.widthM,
    actualHeightM: cabinetCountY * dims.heightM,
    maxCabinetsPerPort,
    portsNeeded,
    averagePortLoadPercent,
    maxPortLoadPercent,
    totalPowerWatts,
    totalPowerKw: totalPowerWatts / 1000,
    totalWeightKg,
    legsCount,
    warnings,
    ports,
    cabinets
  };
}

/**
 * Расчёт всего проекта: каждый экран считается отдельно, затем агрегируются
 * суммарные показатели и габариты «ALL» (экраны в ряд: ширина суммируется,
 * высота — максимум).
 */
export function calculateProject(config: ProjectConfig): ProjectResult {
  const preset = getPresetById(config.cabinetPresetId);
  const screens = config.screens.map((s) => calculateScreen(s, preset));

  const totalCabinets = screens.reduce((s, r) => s + r.totalCabinets, 0);
  const totalPixels = screens.reduce((s, r) => s + r.totalPixels, 0);
  const totalPowerKw = screens.reduce((s, r) => s + r.totalPowerKw, 0);
  const totalWeightKg = screens.reduce((s, r) => s + r.totalWeightKg, 0);
  const totalPorts = screens.reduce((s, r) => s + r.portsNeeded, 0);
  const totalLegs = screens.reduce((s, r) => s + r.legsCount, 0);

  const combinedWidthM = screens.reduce((s, r) => s + r.actualWidthM, 0);
  const combinedHeightM = screens.reduce((m, r) => Math.max(m, r.actualHeightM), 0);
  const combinedResolutionX = screens.reduce((s, r) => s + r.resolutionX, 0);
  const combinedResolutionY = screens.reduce((m, r) => Math.max(m, r.resolutionY), 0);

  const warnings: string[] = [];
  screens.forEach((r) => {
    r.warnings.forEach((w) => warnings.push(`[${r.name}] ${w}`));
  });

  return {
    screens,
    screenCount: screens.length,
    totalCabinets,
    totalPixels,
    totalPowerKw,
    totalWeightKg,
    totalPorts,
    totalLegs,
    combinedWidthM,
    combinedHeightM,
    combinedResolutionX,
    combinedResolutionY,
    warnings,
    pixelPitch: preset.pixelPitch,
    moduleName: preset.name
  };
}

export function formatKw(kw: number): string {
  if (kw >= 10) return `${kw.toFixed(1)} кВт`;
  return `${kw.toFixed(3)} кВт`;
}

export function formatKg(kg: number): string {
  return `${Math.round(kg).toLocaleString("ru-RU")} кг`;
}
