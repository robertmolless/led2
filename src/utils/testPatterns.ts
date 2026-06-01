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
  | "installer"       // универсальная карта в стиле Resolume — всё в одном
  | "pixel_grid"      // тонкая сетка 1px
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

/** Ограничение значения диапазоном [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
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

/** Рамка 1px вокруг прямоугольника (через fillRect, без AA). */
function strokeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
  ctx.fillRect(Math.round(x), Math.round(y + h - 1), Math.round(w), 1);
  ctx.fillRect(Math.round(x), Math.round(y), 1, Math.round(h));
  ctx.fillRect(Math.round(x + w - 1), Math.round(y), 1, Math.round(h));
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
// 6b. INSTALLER — универсальная карта в стиле Resolume.
//
// Совмещает в одном кадре:
//   • фоновую серую шахматку для оценки контраста и стыков;
//   • вертикальную HSV-радугу слева — для проверки полной цветовой палитры
//     в одной точке экрана (сатурация, плавность переходов);
//   • B/W градиент-квадрат справа сверху — для проверки гаммы в тенях и
//     светах одновременно (видны ли все ступени около чёрного и белого);
//   • концентрические окружности + сплошные диагонали + пунктирный крест;
//   • крупный текст «WIDTH × HEIGHT» по центру;
//   • снизу — frequency response (вертикальные линии разной плотности 1/2/3/4/8
//     px), индикатор алиасинга и мипмапов;
//   • ещё ниже — горизонтальная палитра дискретных цветов;
//   • L-маркеры в углах для проверки cropping.

/**
 * HSV (h: 0..1, s: 0..1, v: 0..1) → CSS-цвет rgb(r,g,b).
 * Используется для генерации радуги. Без AA — рисуем полосами.
 */
function hsvCss(h: number, s: number, v: number): string {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

/** Пунктирная горизонтальная линия. dash = длина штриха, gap = длина пропуска. */
function hLineDashed(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, len: number,
  dash: number, gap: number, color: string
) {
  ctx.fillStyle = color;
  let i = 0;
  while (i < len) {
    ctx.fillRect(x + i, y, Math.min(dash, len - i), 1);
    i += dash + gap;
  }
}
/** Пунктирная вертикальная линия. */
function vLineDashed(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, len: number,
  dash: number, gap: number, color: string
) {
  ctx.fillStyle = color;
  let i = 0;
  while (i < len) {
    ctx.fillRect(x, y + i, 1, Math.min(dash, len - i));
    i += dash + gap;
  }
}

function drawInstaller(ctx: CanvasRenderingContext2D, w: number, h: number, opts: PatternOptions) {
  // ─────────────────────────────────────────────────────────────────────────
  //  ПРИВЯЗКА К СЕТКЕ. Вся карта строится на шахматке с клеткой `cell`.
  //  Каждый блок занимает ЦЕЛОЕ число клеток и выровнен по сетке; между
  //  блоками — отступы кратные клетке. Геометрия (диагонали/крест/окружности)
  //  рисуется ПОД блоками — блоки рисуются поверх непрозрачно, поэтому линии
  //  «обрываются» на границах блоков, как в Resolume.
  // ─────────────────────────────────────────────────────────────────────────
  const cell = clamp(Math.round(Math.min(w, h) / 16), 14, 64);
  const cols = Math.max(8, Math.floor(w / cell));
  const rows = Math.max(6, Math.floor(h / cell));
  const gx = (c: number) => Math.round(c * cell);
  const gy = (r: number) => Math.round(r * cell);

  // ─── 1. Фон-шахматка (два серых тона) на всю площадь ────────────────────
  fill(ctx, w, h, "#5a5a5a");
  ctx.fillStyle = "#3c3c3c";
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const odd = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) === 1;
      if (odd) ctx.fillRect(x, y, Math.min(cell, w - x), Math.min(cell, h - y));
    }
  }

  // ─── 2. Геометрия ПОД блоками: диагонали, пунктирный крест, окружности ───
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const r1 = Math.floor(Math.min(w, h) * 0.44);
  const r2 = Math.floor(r1 * 0.55);
  lineBres(ctx, 0, 0, w - 1, h - 1, "#ffffff");
  lineBres(ctx, w - 1, 0, 0, h - 1, "#ffffff");
  const dash = Math.max(5, Math.floor(Math.min(w, h) / 90));
  hLineDashed(ctx, 0, cy, w, dash, dash, "#ffffff");
  vLineDashed(ctx, cx, 0, h, dash, dash, "#ffffff");
  circleBres(ctx, cx, cy, r1, "#ffffff");
  circleBres(ctx, cx, cy, r2, "#ffffff");

  // ─── Раскладка блоков в КЛЕТКАХ ─────────────────────────────────────────
  const hsvWc = clamp(Math.round(cols * 0.09), 2, 6);
  const hsvXc = 1;
  const hsvTopc = clamp(Math.round(rows * 0.14), 1, rows - 4);
  const hsvHc = clamp(Math.round(rows * 0.46), 3, rows - hsvTopc - 3);

  const bwSidec = clamp(Math.round(rows * 0.34), 3, Math.min(cols - 4, rows - 3));
  const bwXc = cols - bwSidec - 1;
  const bwYc = 1;

  const lblWc = clamp(Math.round(cols * 0.46), 6, cols - 4);
  const lblHc = clamp(Math.round(rows * 0.26), 3, rows - 4);
  const lblXc = Math.round((cols - lblWc) / 2);
  const lblYc = Math.round((rows - lblHc) / 2);

  const zebXc = hsvXc + hsvWc + 1;
  let zebTopc = Math.max(Math.round(rows * 0.62), lblYc + lblHc + 1);
  const zebHc = clamp(Math.round(rows * 0.06), 1, 3);
  const zebWc = cols - 1 - zebXc;

  const palXc = 1;
  const palWc = cols - 2;
  let palTopc = Math.max(Math.round(rows * 0.82), zebTopc + zebHc + 1, hsvTopc + hsvHc + 1);
  const palHc = clamp(Math.round(rows * 0.05), 1, 2);
  if (palTopc + palHc > rows - 1) palTopc = rows - 1 - palHc;
  if (zebTopc + zebHc > palTopc - 1) zebTopc = Math.max(lblYc + lblHc + 1, palTopc - zebHc - 1);

  // ─── 3. HSV-радуга ──────────────────────────────────────────────────────
  {
    const x = gx(hsvXc), y = gy(hsvTopc), bw = gx(hsvXc + hsvWc) - x, bh = gy(hsvTopc + hsvHc) - y;
    for (let i = 0; i < bh; i++) {
      const hue = i / Math.max(1, bh - 1);
      ctx.fillStyle = hsvCss(hue, 1, 1);
      ctx.fillRect(x, y + i, bw, 1);
    }
    strokeRect(ctx, x, y, bw, bh, "#000000");
  }

  // ─── 4. B/W градиент-квадрат ────────────────────────────────────────────
  {
    const x = gx(bwXc), y = gy(bwYc), bw = gx(bwXc + bwSidec) - x, bh = gy(bwYc + bwSidec) - y;
    const img = ctx.createImageData(bw, bh);
    for (let yy = 0; yy < bh; yy++) {
      const v = Math.round((yy / Math.max(1, bh - 1)) * 255);
      for (let xx = 0; xx < bw; xx++) {
        const idx = (yy * bw + xx) * 4;
        img.data[idx] = v; img.data[idx + 1] = v; img.data[idx + 2] = v; img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, x, y);
    strokeRect(ctx, x, y, bw, bh, "#000000");
  }

  // ─── 5. Зебра (1/2/3/4/8 px) с подписями на чёрных таблетках ────────────
  {
    const x = gx(zebXc), y = gy(zebTopc), bw = gx(zebXc + zebWc) - x, bh = gy(zebTopc + zebHc) - y;
    const widths = [1, 2, 3, 4, 8];
    const secW = bw / widths.length;
    for (let s2 = 0; s2 < widths.length; s2++) {
      const pxW = widths[s2];
      const xs = Math.round(x + s2 * secW);
      const xe = Math.round(x + (s2 + 1) * secW);
      ctx.fillStyle = "#000000";
      ctx.fillRect(xs, y, xe - xs, bh);
      ctx.fillStyle = "#ffffff";
      for (let xx = xs; xx < xe; xx += pxW * 2) {
        ctx.fillRect(xx, y, Math.min(pxW, xe - xx), bh);
      }
      const lblFont = clamp(Math.round(bh * 0.5), 10, 22);
      ctx.font = `bold ${lblFont}px -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const txt = `${pxW}px`;
      const tw = Math.ceil(ctx.measureText(txt).width) + 8;
      const th = lblFont + 6;
      ctx.fillStyle = "#000000";
      ctx.fillRect(xs + 3, y + Math.round((bh - th) / 2), tw, th);
      ctx.fillStyle = "#ffff00";
      ctx.fillText(txt, xs + 7, y + Math.round(bh / 2) + 1);
    }
    strokeRect(ctx, x, y, bw, bh, "#000000");
  }

  // ─── 6. Палитра дискретных цветов ───────────────────────────────────────
  {
    const x = gx(palXc), y = gy(palTopc), bw = gx(palXc + palWc) - x, bh = gy(palTopc + palHc) - y;
    const colors = [
      "#ff0000", "#ff7f00", "#ffff00", "#7fff00", "#00ff00", "#00ff7f",
      "#00ffff", "#007fff", "#0000ff", "#7f00ff", "#ff00ff", "#ff007f",
      "#ffffff", "#cccccc", "#999999", "#666666", "#333333", "#000000"
    ];
    const sw = bw / colors.length;
    for (let i = 0; i < colors.length; i++) {
      const xs = Math.round(x + i * sw);
      const xe = Math.round(x + (i + 1) * sw);
      ctx.fillStyle = colors[i];
      ctx.fillRect(xs, y, xe - xs, bh);
    }
    strokeRect(ctx, x, y, bw, bh, "#000000");
  }

  // ─── 7. Центральная плашка с инфо ───────────────────────────────────────
  {
    const x = gx(lblXc), y = gy(lblYc), bw = gx(lblXc + lblWc) - x, bh = gy(lblYc + lblHc) - y;
    ctx.fillStyle = "rgba(10,12,20,0.82)";
    ctx.fillRect(x, y, bw, bh);
    strokeRect(ctx, x, y, bw, bh, "#ffffff");

    const info = opts.info;
    ctx.textAlign = "center";
    const nameParts = [info?.projectName, info?.screenName].filter(Boolean) as string[];
    const maxTextW = bw - cell; // поля по половине клетки с каждой стороны
    const fam = `-apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;

    // Подгоняем размер шрифта под ширину плашки, чтобы текст не вылезал.
    const fit = (text: string, base: number, bold: boolean): number => {
      let f = base;
      while (f > 9) {
        ctx.font = `${bold ? "bold " : ""}${f}px ${fam}`;
        if (ctx.measureText(text).width <= maxTextW) break;
        f -= 1;
      }
      return f;
    };

    let mainFont = clamp(Math.round(bh * 0.30), 18, 96);
    const resText = `${w} × ${h}`;
    mainFont = fit(resText, mainFont, true);
    const subFont = clamp(Math.round(mainFont * 0.5), 12, 48);

    if (nameParts.length > 0) {
      const nf = fit(nameParts.join(" · "), subFont, false);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = `${nf}px ${fam}`;
      ctx.textBaseline = "middle";
      ctx.fillText(nameParts.join(" · "), x + bw / 2, y + Math.round(bh * 0.28));
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${mainFont}px ${fam}`;
    ctx.textBaseline = "middle";
    ctx.fillText(resText, x + bw / 2, y + Math.round(bh * 0.52));

    const bottom = [info?.pitch, info?.moduleName].filter(Boolean).join(" · ");
    if (bottom) {
      const bf = fit(bottom, subFont, false);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = `${bf}px ${fam}`;
      ctx.fillText(bottom, x + bw / 2, y + Math.round(bh * 0.76));
    }
  }

  // ─── 8. Угловые L-маркеры + координаты ──────────────────────────────────
  const cornerLen = Math.min(cell * 2, Math.floor(Math.min(w, h) * 0.06));
  const corners: [number, number][] = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  ctx.fillStyle = "#ff4040";
  for (const [x, y] of corners) {
    const sx = x === 0 ? 1 : -1;
    const sy = y === 0 ? 1 : -1;
    for (let i = 0; i < cornerLen; i++) {
      ctx.fillRect(x + sx * i, y, 1, 1);
      ctx.fillRect(x, y + sy * i, 1, 1);
    }
  }
  ctx.fillStyle = "#ff4040";
  const cf = Math.max(10, Math.floor(Math.min(w, h) / 120));
  ctx.font = `${cf}px -apple-system, "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
  ctx.textAlign = "left";  ctx.textBaseline = "top";    ctx.fillText("0, 0", cornerLen + 4, 4);
  ctx.textAlign = "right"; ctx.textBaseline = "top";    ctx.fillText(`${w - 1}, 0`, w - cornerLen - 4, 4);
  ctx.textAlign = "left";  ctx.textBaseline = "bottom"; ctx.fillText(`0, ${h - 1}`, cornerLen + 4, h - 4);
  ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(`${w - 1}, ${h - 1}`, w - cornerLen - 4, h - 4);
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
    case "installer":      return drawInstaller(ctx, w, h, opts);
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
  installer:      "Универсальная (Resolume-style)",
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
