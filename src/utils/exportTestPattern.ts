/**
 * Экспорт тест-карты в PNG / JPEG / PDF ровно того размера, что задано.
 *
 * Используется ОТДЕЛЬНЫЙ канвас (а не растеризация SVG, как у схем),
 * чтобы гарантировать pixel-perfect: 1 пиксель canvas == 1 пиксель файла.
 *
 * PDF: страница ровно W×H в пикселях (а не A4). Для тест-карт это
 * единственно правильный режим — иначе разрешение «теряется» в листе.
 */

import { jsPDF } from "jspdf";
import { renderPattern, type PatternId, type PatternOptions } from "./testPatterns";
import { sanitize } from "./raster";

export type TestPatternFormat = "png" | "jpeg" | "pdf";

export interface ExportTestPatternOpts {
  width: number;
  height: number;
  patternId: PatternId;
  patternOptions?: PatternOptions;
  /** Базовое имя файла без расширения. */
  fileBaseName: string;
  /** Качество JPEG в [0..1]. По умолчанию 0.95 — достаточно для тест-карт. */
  jpegQuality?: number;
}

/**
 * Защита от слишком больших канвасов: разные браузеры поддерживают разный
 * максимальный размер canvas. Safari исторически — 4096 для iOS, Chrome — 32767,
 * Firefox — 16384. Берём пересечение safe-зоны.
 */
const MAX_DIM = 16384;

/** Создаёт offscreen-канвас с отрендеренным паттерном. Pixel-perfect. */
function renderToCanvas(opts: ExportTestPatternOpts): HTMLCanvasElement {
  const w = Math.max(1, Math.floor(opts.width));
  const h = Math.max(1, Math.floor(opts.height));

  if (w > MAX_DIM || h > MAX_DIM) {
    throw new Error(
      `Слишком большое разрешение: ${w}×${h}. ` +
      `Максимум, поддерживаемый браузером — ${MAX_DIM}px по стороне.`
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;   // АТРИБУТЫ — это и есть физические пиксели результата.
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context недоступен.");

  renderPattern(ctx, w, h, opts.patternId, opts.patternOptions ?? {});
  return canvas;
}

/** Сохраняет blob как файл с подходящим именем. */
function downloadBlob(blob: Blob, fileBaseName: string, w: number, h: number, ext: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(fileBaseName)}-${w}x${h}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PNG-экспорт. */
async function exportPng(opts: ExportTestPatternOpts): Promise<void> {
  const canvas = renderToCanvas(opts);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob вернул null."))),
      "image/png"
    );
  });
  downloadBlob(blob, opts.fileBaseName, canvas.width, canvas.height, "png");
}

/** JPEG-экспорт. */
async function exportJpeg(opts: ExportTestPatternOpts): Promise<void> {
  const canvas = renderToCanvas(opts);
  const quality = opts.jpegQuality ?? 0.95;
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob вернул null."))),
      "image/jpeg",
      quality
    );
  });
  downloadBlob(blob, opts.fileBaseName, canvas.width, canvas.height, "jpg");
}

/**
 * PDF-экспорт. Страница ровно W×H в пикселях. Внутрь встраиваем PNG
 * (lossless — паттерны с резкими краями нельзя сжимать JPEG-ом, появятся
 * артефакты вокруг тонких линий).
 */
async function exportPdf(opts: ExportTestPatternOpts): Promise<void> {
  const canvas = renderToCanvas(opts);
  const w = canvas.width;
  const h = canvas.height;
  const dataUrl = canvas.toDataURL("image/png");

  // unit: "px" в jsPDF означает 1 unit = 1 user-space unit (1/72 inch как
  // базовая PDF-единица интерпретируется через px → внутреннее преобразование).
  // Задавая format: [w, h], получаем страницу ровно w×h в этих единицах,
  // и addImage(..., 0, 0, w, h) укладывает картинку без скейлинга.
  const pdf = new jsPDF({
    orientation: w >= h ? "landscape" : "portrait",
    unit: "px",
    format: [w, h],
    // Сжатие потоков (PNG внутри уже сжат, это про общие PDF-стримы).
    compress: true,
    // hotfix: jsPDF старая логика px→unit. С 'px' jsPDF умолчанию = 72 dpi.
    hotfixes: ["px_scaling"]
  });

  pdf.addImage(dataUrl, "PNG", 0, 0, w, h, undefined, "FAST");
  pdf.save(`${sanitize(opts.fileBaseName)}-${w}x${h}.pdf`);
}

/** Единая точка входа. Диспатчит по формату. */
export async function exportTestPattern(
  opts: ExportTestPatternOpts,
  format: TestPatternFormat
): Promise<void> {
  switch (format) {
    case "png":  return exportPng(opts);
    case "jpeg": return exportJpeg(opts);
    case "pdf":  return exportPdf(opts);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Превью.

/**
 * Рисует паттерн на ПЕРЕДАННЫЙ canvas, масштабируя без AA.
 * Используется для показа паттерна в маленьком окошке в модалке.
 */
export function renderPreview(
  targetCanvas: HTMLCanvasElement,
  fullWidth: number,
  fullHeight: number,
  patternId: PatternId,
  patternOptions: PatternOptions = {}
): void {
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  // Сначала рендерим оригинальный размер в offscreen-канвас, потом масштабируем
  // на target. При огромных размерах рендерим в УМЕНЬШЕННЫЙ канвас для скорости.
  const MAX_SOURCE = 2048;
  let renderW = fullWidth;
  let renderH = fullHeight;
  const ratio = Math.min(1, MAX_SOURCE / Math.max(fullWidth, fullHeight));
  if (ratio < 1) {
    renderW = Math.max(1, Math.floor(fullWidth * ratio));
    renderH = Math.max(1, Math.floor(fullHeight * ratio));
  }

  const off = document.createElement("canvas");
  off.width = renderW;
  off.height = renderH;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;

  // Координаты cabinetGrid привязаны к оригинальному разрешению, поэтому при
  // уменьшении источника скейлим их пропорционально.
  let scaledOpts = patternOptions;
  if (ratio < 1 && patternOptions.cabinetGrid) {
    scaledOpts = {
      ...patternOptions,
      cabinetGrid: patternOptions.cabinetGrid.map((c) => ({
        number: c.number,
        x: Math.round(c.x * ratio),
        y: Math.round(c.y * ratio),
        w: Math.max(1, Math.round(c.w * ratio)),
        h: Math.max(1, Math.round(c.h * ratio))
      }))
    };
  }

  renderPattern(offCtx, renderW, renderH, patternId, scaledOpts);

  // Теперь масштабируем offscreen на target. Nearest neighbor.
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  // Сохраняем aspect ratio в превью.
  const targetRatio = targetCanvas.width / targetCanvas.height;
  const sourceRatio = renderW / renderH;
  let dw = targetCanvas.width;
  let dh = targetCanvas.height;
  if (sourceRatio > targetRatio) {
    dh = Math.round(targetCanvas.width / sourceRatio);
  } else {
    dw = Math.round(targetCanvas.height * sourceRatio);
  }
  const dx = Math.round((targetCanvas.width - dw) / 2);
  const dy = Math.round((targetCanvas.height - dh) / 2);
  ctx.drawImage(off, dx, dy, dw, dh);
}
