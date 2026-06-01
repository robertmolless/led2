/**
 * Генераторы тест-паттернов для LED-экранов.
 *
 * ВАЖНО: все паттерны рисуются ПИКСЕЛЬ-В-ПИКСЕЛЬ. Это значит:
 *   - canvas.width/height задаются АТРИБУТАМИ в физических пикселях (не CSS);
 *   - imageSmoothingEnabled = false;
 *   - все координаты — целочисленные, без субпиксельных дрейфов;
 *   - линии шириной 1px рисуются через fillRect, а не stroke (чтобы не было
 *     antialiasing на стыках при дробном offset).
 *
 * Каждый паттерн — чистая функция (ctx, w, h, opts) => void. Никаких сайд-эффектов.
 */

import type { ScreenResult } from "../types";

export type PatternId =
  | "pixel_grid"      // тонкая сетка 1px (как Resolume)
  | "checkerboard"   // шахматка с настраиваемой клеткой
  | "solid"           // сплошной цвет
  | "grayscale_ramp" // градиент 0..255 + ступени
  | "color_bars"      // SMPTE-style цветные полосы
  | "geometry"        // окружности, диагонали, кресты (центрирование/геометрия)
  | "cabinet_grid"    // границы кабинетов + нумерация (из расчёта)
  | "info";           // экран с инфо: имя, разрешение, pitch

export interface PatternOptions {
  /** Сплошной цвет (для pattern=solid). HEX вида #RRGGBB. */
  solidColor?: string;
  /** Размер клетки шахматки в пикселях. */
  checkerSize?: number;
  /** Шаг сетки для pixel_grid. 1 = чистый 1px пиксель. */
  gridStep?: number;
  /** Подписи к информационному паттерну. */
  info?: {
    screenName?: string;
    pitch?: string;
    moduleName?: string;
    projectName?: string;
  };
  /** Для cabinet_grid: массив кабинетов с пиксельными координатами. */
  cabinetGrid?: CabinetPxRect[];
}

export interface CabinetPxRect {
  /** 1-based номер кабинета. */
  number: number;
  /** Левый-верхний угол В ПИКСЕЛЯХ экрана. */
  x: number;
  y: number;
  /** Размер кабинета в пикселях. */
  w: number;
  h: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Утилиты

/** Очистить канвас сплошным цветом. */
function fill(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

/** Безопасный целочисленный fillRect — гарантирует pixel-perfect рисование. */
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** Тонкая 1px линия через fillRect (не stroke — чтобы избежать antialiasing). */
function hLine(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string) {
  ctx.fillStyle = color;
  px(ctx, x, y, len, 1);
}
function vLine(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string) {
  ctx.fillStyle = color;
  px(ctx, x, y, 1, len);
}

/** Bresenham-подобная линия (целые пиксели), для диагоналей без AA. */
function lineBres(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  color: string
) {
  ctx.fillStyle = color;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = Math.round(x0), y = Math.round(y0);
  const X1 = Math.round(x1), Y1 = Math.round(y1);
  for (;;) {
    ctx.fillRect(x, y, 1, 1);
    if (x === X1 && y === Y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** Окружность Брезенхема — без antialiasing, чистый 1px. */
function circleBres(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, color: string
) {
  ctx.fillStyle = color;
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  let x = r, y = 0;
  let err = 1 - x;
  while (x >= y) {
    ctx.fillRect(cx + x, cy + y, 1, 1);
    ctx.fillRect(cx + y, cy + x, 1, 1);
    ctx.fillRect(cx - y, cy + x, 1, 1);
    ctx.fillRect(cx - x, cy + y, 1, 1);
    ctx.fillRect(cx - x, cy - y, 1, 1);
    ctx.fillRect(cx - y, cy - x, 1, 1);
    ctx.fillRect(cx + y, cy - x, 1, 1);
    ctx.fillRect(cx + x, cy - y, 1, 1);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 1. PIXEL GRID — тонкая сетка с шагом N px

function drawPixelGrid(ctx: CanvasRenderingContext2D, w: number, h: number, opts: PatternOptions) {
  const step = Math.max(1, Math.floor(opts.gridStep ?? 8));
  fill(ctx, w, h, "#000000");
  // Светлые точки/линии каждые step.
  ctx.fillStyle = "#ffffff";
  if (step === 1) {
    // Чисто шахматка 1×1 (точки на чётных).
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) ctx.fillRect(x, y, 1, 1);
    }
  } else {
    for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 1, h);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 2. CHECKERBOARD

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number, opts: PatternOptions) {
  const size = Math.max(1, Math.floor(opts.checkerSize ?? 32));
  fill(ctx, w, h, "#000000");
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const odd = ((Math.floor(x / size) + Math.floor(y / size)) & 1) === 1;
      if (odd) ctx.fillRect(x, y, Math.min(size, w - x), Math.min(size, h - y));
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 3. SOLID COLOR

function drawSolid(ctx: CanvasRenderingContext2D, w: number, h: number, opts: PatternOptions) {
  fill(ctx, w, h, opts.solidColor ?? "#ffffff");
}

// ───────────────────────────────────────────────────────────────────────────
// 4. GRAYSCALE RAMP — плавный градиент + ступени 16 и 64.
//
// Сверху — непрерывный gradient 0→255 (ImageData).
// Снизу — 16-step bar и 64-step bar для проверки bit depth и гаммы.

function drawGrayscaleRamp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fill(ctx, w, h, "#000000");

  // Делим высоту на 3 секции: smooth, 16-step, 64-step.
  const smoothH = Math.floor(h * 0.55);
  const step16H = Math.floor(h * 0.225);
  const step64H = h - smoothH - step16H;

  // === Smooth gradient ===
  const img = ctx.createImageData(w, smoothH);
  for (let x = 0; x < w; x++) {
    const v = Math.round((x / Math.max(1, w - 1)) * 255);
    for (let y = 0; y < smoothH; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // === 16 steps ===
  const stepCount16 = 16;
  for (let i = 0; i < stepCount16; i++) {
    const x0 = Math.round((i / stepCount16) * w);
    const x1 = Math.round(((i + 1) / stepCount16) * w);
    const v = Math.round((i / (stepCount16 - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x0, smoothH, x1 - x0, step16H);
  }

  // === 64 steps ===
  const stepCount64 = 64;
  for (let i = 0; i < stepCount64; i++) {
    const x0 = Math.round((i / stepCount64) * w);
    const x1 = Math.round(((i + 1) / stepCount64) * w);
    const v = Math.round((i / (stepCount64 - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x0, smoothH + step16H, x1 - x0, step64H);
  }

  // Тонкие разделители между секциями.
  hLine(ctx, 0, smoothH, w, "#ff4040");
  hLine(ctx, 0, smoothH + step16H, w, "#ff4040");
}

// ───────────────────────────────────────────────────────────────────────────
// 5. COLOR BARS — SMPTE-подобные вертикальные полосы.

function drawColorBars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Цвета (75% saturation, классика).
  const bars: [string, string][] = [
    ["#bfbfbf", "Gray"],
    ["#bfbf00", "Yellow"],
    ["#00bfbf", "Cyan"],
    ["#00bf00", "Green"],
    ["#bf00bf", "Magenta"],
    ["#bf0000", "Red"],
    ["#0000bf", "Blue"]
  ];

  const upperH = Math.floor(h * 0.75);
  const lowerH = h - upperH;
  const barW = w / bars.length;

  // Верхняя часть — основные полосы.
  for (let i = 0; i < bars.length; i++) {
    const x0 = Math.round(i * barW);
    const x1 = Math.round((i + 1) * barW);
    ctx.fillStyle = bars[i][0];
    ctx.fillRect(x0, 0, x1 - x0, upperH);
  }

  // Нижняя часть — Pluge + чёрные/белые опорные уровни.
  const pluges: string[] = ["#0000bf", "#000000", "#bf00bf", "#000000", "#00bfbf", "#000000", "#bfbfbf"];
  for (let i = 0; i < pluges.length; i++) {
    const x0 = Math.round(i * barW);
    const x1 = Math.round((i + 1) * barW);
    ctx.fillStyle = pluges[i];
    ctx.fillRect(x0, upperH, x1 - x0, lowerH);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 6. GEOMETRY — окружность, диагонали, кресты (как Resolume).

function drawGeometry(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Фон: тёмно-серая шахматка 32×32 — как референс.
  const size = 32;
  fill(ctx, w, h, "#404040");
  ctx.fillStyle = "#606060";
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const odd = ((Math.floor(x / size) + Math.floor(y / size)) & 1) === 1;
      if (odd) ctx.fillRect(x, y, Math.min(size, w - x), Math.min(size, h - y));
    }
  }

  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const r = Math.floor(Math.min(w, h) * 0.45);

  // Диагонали (через весь канвас от угла к углу).
  lineBres(ctx, 0, 0, w - 1, h - 1, "#ffffff");
  lineBres(ctx, w - 1, 0, 0, h - 1, "#ffffff");

  // Центральный крест.
  hLine(ctx, 0, cy, w, "#ffffff");
  vLine(ctx, cx, 0, h, "#ffffff");

  // Окружности (главная + внутренняя для контроля).
  circleBres(ctx, cx, cy, r, "#ffffff");
  circleBres(ctx, cx, cy, Math.floor(r / 2), "#ffffff");

  // Угловые метки L-shape для проверки геометрии до самого края.
  const cornerLen = Math.min(80, Math.floor(Math.min(w, h) * 0.08));
  const corners: [number, number][] = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  for (const [x, y] of corners) {
    const sx = x === 0 ? 1 : -1;
    const sy = y === 0 ? 1 : -1;
    ctx.fillStyle = "#ff4040";
    for (let i = 0; i < cornerLen; i++) {
      ctx.fillRect(x + sx * i, y, 1, 1);
      ctx.fillRect(x, y + sy * i, 1, 1);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 7. CABINET GRID — границы кабинетов + нумерация.

function drawCabinetGrid(ctx: CanvasRenderingContext2D, w: number, h: number, opts: PatternOptions) {
  fill(ctx, w, h, "#101010");
  const cabs = opts.cabinetGrid ?? [];
  if (cabs.length === 0) {
    // Фолбэк: просто рамка по периметру.
    ctx.fillStyle = "#ff4040";
    ctx.fillRect(0, 0, w, 2);
    ctx.fillRect(0, h - 2, w, 2);
    ctx.fillRect(0, 0, 2, h);
    ctx.fillRect(w - 2, 0, 2, h);
    return;
  }

  // Чередуем тёмные/чуть светлее кабинеты — как шашки, чтобы стыки были видны.
  for (let i = 0; i < cabs.length; i++) {
    const c = cabs[i];
    const tone = (i & 1) ? "#1a1a1a" : "#262626";
    ctx.fillStyle = tone;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }

  // Границы кабинетов — яркие 1px красные.
  ctx.fillStyle = "#ff3030";
  for (const c of cabs) {
    // top / bottom / left / right
    ctx.fillRect(c.x, c.y, c.w, 1);
    ctx.fillRect(c.x, c.y + c.h - 1, c.w, 1);
    ctx.fillRect(c.x, c.y, 1, c.h);
    ctx.fillRect(c.x + c.w - 1, c.y, 1, c.h);
  }

  // Номера кабинетов по центру каждого.
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const c of cabs) {
    // Размер шрифта — пропорционально кабинету, ограниченный сверху.
    const fontPx = Math.max(14, Math.min(Math.floor(Math.min(c.w, c.h) * 0.35), 96));
    ctx.font = `bold ${fontPx}px -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
    ctx.fillText(String(c.number), c.x + c.w / 2, c.y + c.h / 2);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 8. INFO — крупный текст с разрешением, pitch'ем, именем экрана.

function drawInfo(ctx: CanvasRenderingContext2D, w: number, h: number, opts: PatternOptions) {
  fill(ctx, w, h, "#000000");

  // Тонкая сетка 64px для ориентации.
  ctx.fillStyle = "#181818";
  for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 1, h);

  // Центральный крест.
  ctx.fillStyle = "#404040";
  hLine(ctx, 0, Math.floor(h / 2), w, "#404040");
  vLine(ctx, Math.floor(w / 2), 0, h, "#404040");

  // Текст.
  const info = opts.info ?? {};
  const lines: string[] = [];
  if (info.projectName) lines.push(info.projectName);
  if (info.screenName) lines.push(info.screenName);
  lines.push(`${w} × ${h}`);
  if (info.pitch || info.moduleName) {
    lines.push([info.pitch, info.moduleName].filter(Boolean).join(" · "));
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Главное число — резолюция. Масштабируем шрифт под ширину.
  const mainFont = Math.max(48, Math.floor(Math.min(w / 8, h / 4)));
  const subFont = Math.max(20, Math.floor(mainFont * 0.35));
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Раскладка: над крестом — имя проекта/экрана, под — разрешение и модуль.
  ctx.font = `bold ${subFont}px -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
  if (info.projectName) {
    ctx.fillText(info.projectName, cx, cy - mainFont * 0.8 - subFont);
  }
  if (info.screenName) {
    ctx.fillText(info.screenName, cx, cy - mainFont * 0.8);
  }

  ctx.font = `bold ${mainFont}px -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
  ctx.fillText(`${w} × ${h}`, cx, cy + mainFont * 0.1);

  ctx.font = `${subFont}px -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
  const bottomLine = [info.pitch, info.moduleName].filter(Boolean).join(" · ");
  if (bottomLine) {
    ctx.fillText(bottomLine, cx, cy + mainFont * 0.7 + subFont * 0.2);
  }

  // Угловые метки координат — для проверки cropping.
  ctx.font = `${Math.max(14, Math.floor(subFont * 0.6))}px -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
  ctx.fillStyle = "#ff4040";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("0, 0", 8, 8);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`${w - 1}, 0`, w - 8, 8);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`0, ${h - 1}`, 8, h - 8);
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${w - 1}, ${h - 1}`, w - 8, h - 8);
}

// ───────────────────────────────────────────────────────────────────────────
// Диспетчер.

export function renderPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: PatternId,
  opts: PatternOptions = {}
): void {
  // Pixel-perfect режим.
  ctx.imageSmoothingEnabled = false;
  // Сброс трансформации на случай повторного использования контекста.
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  switch (id) {
    case "pixel_grid":     return drawPixelGrid(ctx, w, h, opts);
    case "checkerboard":   return drawCheckerboard(ctx, w, h, opts);
    case "solid":          return drawSolid(ctx, w, h, opts);
    case "grayscale_ramp": return drawGrayscaleRamp(ctx, w, h);
    case "color_bars":     return drawColorBars(ctx, w, h);
    case "geometry":       return drawGeometry(ctx, w, h);
    case "cabinet_grid":   return drawCabinetGrid(ctx, w, h, opts);
    case "info":           return drawInfo(ctx, w, h, opts);
  }
}

/** Человекочитаемые названия паттернов (для UI). */
export const PATTERN_LABELS: Record<PatternId, string> = {
  pixel_grid:     "Пиксельная сетка",
  checkerboard:   "Шахматка",
  solid:          "Сплошной цвет",
  grayscale_ramp: "Градации серого",
  color_bars:     "Цветные полосы",
  geometry:       "Геометрия / центрирование",
  cabinet_grid:   "Сетка кабинетов с нумерацией",
  info:           "Инфо: разрешение / имя"
};

// ───────────────────────────────────────────────────────────────────────────
// Хелпер: построить cabinetGrid в пиксельных координатах из ScreenResult.
//
// Координаты Y в ScreenResult — снизу вверх (от 0 у пола), а в canvas — сверху
// вниз. Поэтому делаем переворот по Y.

export function buildCabinetPxGrid(s: ScreenResult): CabinetPxRect[] {
  if (!s.cabinets || s.cabinets.length === 0) return [];
  // Считаем количество кабинетов в ряду — для нумерации согласованно с расчётом.
  // Просто нумеруем по rasterindex (col-by-row сверху-вниз, лево-направо).
  const sorted = [...s.cabinets].sort((a, b) => {
    if (b.row !== a.row) return b.row - a.row; // верх (большие row) первыми
    return a.col - b.col;
  });

  const pxPerMeterX = s.resolutionX / Math.max(1e-6, s.actualWidthM);
  const pxPerMeterY = s.resolutionY / Math.max(1e-6, s.actualHeightM);

  const result: CabinetPxRect[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    // x: c.x — левый-нижний; canvas X идёт слева направо — совпадает.
    const xPx = Math.round(c.x * pxPerMeterX);
    // y: в данных c.y — нижняя граница (снизу). В canvas верх = 0.
    //    верхняя граница = actualHeight - (c.y + c.height).
    const yTopMeters = s.actualHeightM - (c.y + c.height);
    const yPx = Math.round(yTopMeters * pxPerMeterY);
    const wPx = Math.round(c.width * pxPerMeterX);
    const hPx = Math.round(c.height * pxPerMeterY);
    result.push({
      number: i + 1,
      x: xPx,
      y: yPx,
      w: wPx,
      h: hPx
    });
  }
  return result;
}
