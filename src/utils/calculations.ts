import type {
  CabinetCell,
  CabinetPreset,
  ProjectConfig,
  ProjectResult,
  ScreenConfig,
  ScreenResult
} from "../types";
import {
  getPresetById,
  getHalfFillPreset,
  isTallModule
} from "../data/cabinetPresets";
import { PORT_PIXEL_LIMIT } from "../data/processors";
import { buildPortGroups } from "./routing";

const EPS = 1e-6;

function fmtNum(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(parseFloat(n.toFixed(3)));
}

function calcLegs(screenWidthM: number, manual: number, mode: "auto" | "manual"): number {
  if (mode === "manual") return Math.max(0, Math.floor(manual));
  return Math.max(2, Math.ceil(screenWidthM));
}

/**
 * Определение рядов экрана. Возвращает список рядов снизу вверх; каждый ряд
 * знает свою высоту (м), пиксельную высоту и какой модуль использует.
 *
 * Если основной модуль — «метровый» (0.5×1) и включён fillHalfModules, то при
 * остатке высоты ~0.5 м сверху докидывается ряд модулей 0.5×0.5.
 */
interface RowDef {
  yStart: number;      // нижняя граница ряда, м
  heightM: number;     // высота ряда, м
  preset: CabinetPreset;
}

function buildRows(
  screenH: number,
  base: CabinetPreset,
  fillHalf: boolean
): { rows: RowDef[]; remainderWarn: boolean } {
  const rows: RowDef[] = [];
  let remainderWarn = false;

  if (isTallModule(base) && fillHalf) {
    // Метровый модуль + докидывание половинок.
    const fullRows = Math.floor(screenH / 1.0 + EPS);
    let y = 0;
    for (let i = 0; i < fullRows; i++) {
      rows.push({ yStart: y, heightM: 1.0, preset: base });
      y += 1.0;
    }
    const remainder = screenH - fullRows * 1.0;
    if (remainder >= 0.5 - 1e-3) {
      // влезает ряд 0.5
      const half = getHalfFillPreset(base.pixelPitch);
      rows.push({ yStart: y, heightM: 0.5, preset: half });
      y += 0.5;
      if (remainder - 0.5 > 1e-3) remainderWarn = true;
    } else if (remainder > 1e-3) {
      remainderWarn = true;
    }
  } else {
    // Однородный экран из одного модуля.
    const n = Math.floor(screenH / base.heightMeters + EPS);
    let y = 0;
    for (let i = 0; i < n; i++) {
      rows.push({ yStart: y, heightM: base.heightMeters, preset: base });
      y += base.heightMeters;
    }
    if (Math.abs(screenH / base.heightMeters - Math.round(screenH / base.heightMeters)) > 1e-3) {
      remainderWarn = true;
    }
  }

  return { rows, remainderWarn };
}

/**
 * Расчёт ОДНОГО экрана. Поддерживает смешанные по высоте ряды.
 */
export function calculateScreen(
  screen: ScreenConfig,
  preset: CabinetPreset,
  signalRoutingMode = screen.signalRoutingMode
): ScreenResult {
  const screenW = screen.widthMeters;
  const screenH = screen.heightMeters;

  // Все модули серии P2.6 имеют ширину 0.5 м → колонки считаем по 0.5.
  const colW = preset.widthMeters; // 0.5
  const colPixelW = preset.pixelWidth; // 192 (одинаково для обоих модулей)

  const rawCountX = screenW / colW;
  const cabinetCountX = Math.max(0, Math.floor(rawCountX + EPS));

  const fillHalf = screen.fillHalfModules !== false;
  const { rows, remainderWarn } = buildRows(screenH, preset, fillHalf);
  const cabinetCountY = rows.length;

  // Строим ячейки.
  const cabinets: CabinetCell[] = [];
  let resolutionY = 0;
  for (let r = 0; r < rows.length; r++) {
    const rowDef = rows[r];
    resolutionY += rowDef.preset.pixelHeight;
    for (let col = 0; col < cabinetCountX; col++) {
      cabinets.push({
        id: `r${r}c${col}`,
        row: r,
        col,
        x: col * colW,
        y: rowDef.yStart,
        width: colW,
        height: rowDef.heightM,
        pixelWidth: colPixelW,
        pixelHeight: rowDef.preset.pixelHeight,
        pixelsTotal: colPixelW * rowDef.preset.pixelHeight,
        powerWatts: rowDef.preset.powerWatts,
        weightKg: rowDef.preset.weightKg
      });
    }
  }

  const totalCabinets = cabinets.length;
  const resolutionX = cabinetCountX * colPixelW;
  const totalPixels = cabinets.reduce((s, c) => s + c.pixelsTotal, 0);

  // Лимит порта — фиксированный 650k (общий для всех процессоров NovaStar).
  const maxPixelsPerPort = PORT_PIXEL_LIMIT;
  // Теоретический максимум модулей на порт — по самому «тяжёлому» модулю в экране.
  const heaviestPix = cabinets.reduce((m, c) => Math.max(m, c.pixelsTotal), preset.pixelWidth * preset.pixelHeight);
  const maxCabinetsPerPort = Math.max(1, Math.floor(maxPixelsPerPort / heaviestPix));

  const ports = buildPortGroups(
    cabinets,
    cabinetCountX,
    cabinetCountY,
    maxPixelsPerPort,
    signalRoutingMode,
    screen.signalInputSide
  );

  const portsNeeded = ports.length;
  const averagePortLoadPercent =
    ports.length === 0 ? 0 : ports.reduce((s, p) => s + p.loadPercent, 0) / ports.length;
  const maxPortLoadPercent =
    ports.length === 0 ? 0 : Math.max(...ports.map((p) => p.loadPercent));

  const totalPowerWatts = cabinets.reduce((s, c) => s + c.powerWatts, 0);
  const totalWeightKg = cabinets.reduce((s, c) => s + c.weightKg, 0);
  const legsCount = calcLegs(screenW, screen.manualLegs, screen.legsMode);

  // Фактическая высота — сумма высот рядов.
  const actualHeightM = rows.reduce((s, r) => s + r.heightM, 0);

  const warnings: string[] = [];
  if (Math.abs(rawCountX - Math.round(rawCountX)) > 1e-3) {
    warnings.push(
      `Ширина (${fmtNum(screenW)} м) не делится нацело на 0.5 м → ` +
        `${cabinetCountX} мод. = ${fmtNum(cabinetCountX * colW)} м.`
    );
  }
  if (remainderWarn) {
    warnings.push(
      `Высота (${fmtNum(screenH)} м) не собирается ровно из модулей → ` +
        `факт. ${fmtNum(actualHeightM)} м.`
    );
  }
  if (cabinetCountX === 0 || cabinetCountY === 0) {
    warnings.push("Экран слишком маленький — модули не помещаются.");
  }
  // Отметим смешанный экран как информацию.
  const hasMixed = rows.some((r) => r.heightM !== rows[0].heightM);
  if (hasMixed) {
    const halfRows = rows.filter((r) => Math.abs(r.heightM - 0.5) < 1e-6).length;
    warnings.push(
      `Смешанная сборка: добавлен ряд 0.5×0.5 (${halfRows} ряд) для добора высоты.`
    );
  }
  ports.forEach((p) => {
    if (p.isOverLimit) {
      warnings.push(
        `Порт ${p.portNumber} перегружен: ${p.pixels.toLocaleString("ru-RU")} px > лимита ${maxPixelsPerPort.toLocaleString("ru-RU")} px.`
      );
    }
  });

  return {
    id: screen.id,
    name: screen.name,
    signalInputSide: screen.signalInputSide,
    requestedWidthM: screenW,
    requestedHeightM: screenH,
    cabinetWidthM: colW,
    cabinetHeightM: rows.length > 0 ? rows[0].heightM : preset.heightMeters,
    cabinetPixelW: colPixelW,
    cabinetPixelH: rows.length > 0 ? rows[0].preset.pixelHeight : preset.pixelHeight,
    cabinetCountX,
    cabinetCountY,
    totalCabinets,
    resolutionX,
    resolutionY,
    pixelsPerCabinet: colPixelW * preset.pixelHeight,
    totalPixels,
    actualWidthM: cabinetCountX * colW,
    actualHeightM,
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
