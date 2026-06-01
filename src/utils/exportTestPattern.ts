/**
 * Экспорт тест-карты в PNG ровно того размера, что задано.
 * Используется ОТДЕЛЬНЫЙ канвас (а не растеризация SVG, как у схем),
 * чтобы гарантировать pixel-perfect: 1 пиксель canvas == 1 пиксель PNG.
 */

import { renderPattern, type PatternId, type PatternOptions } from "./testPatterns";
import { sanitize } from "./raster";

export interface ExportTestPatternOpts {
  width: number;
  height: number;
  patternId: PatternId;
  patternOptions?: PatternOptions;
  /** Базовое имя файла без расширения. */
  fileBaseName: string;
}

/**
 * Создаёт offscreen-канвас, рисует паттерн и скачивает PNG.
 * Возвращает Promise, который резолвится после нажатия "скачать".
 */
export async function exportTestPatternPng(opts: ExportTestPatternOpts): Promise<void> {
  const w = Math.max(1, Math.floor(opts.width));
  const h = Math.max(1, Math.floor(opts.height));

  // Защита: огромные канвасы (>16384px по стороне) браузер может не вытянуть.
  // В таких случаях лучше предупредить пользователя.
  const MAX_DIM = 16384;
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

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob вернул null."))),
      "image/png"
      // Качество для PNG не учитывается — формат lossless.
    );
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(opts.fileBaseName)}-${w}x${h}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Версия для превью: рисует на ПЕРЕДАННЫЙ canvas, масштабируя без AA.
 * Используется для показа paттерна в маленьком окошке в модалке.
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
  // на target. Так у нас будет ТОЧНОЕ превью того, что попадёт в финальный PNG.
  // Но при огромных размерах (например 16000×9000) — это уже долго.
  // Поэтому: если оригинал слишком велик, рендерим в УМЕНЬШЕННЫЙ канвас.
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

  // Для cabinet_grid и info нужно скорректировать координаты под уменьшенный
  // размер, иначе номера будут не на месте. Скейлим вручную.
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

  // Теперь масштабируем offscreen на target. Используем nearest neighbor.
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  // Сохраняем aspect ratio.
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
