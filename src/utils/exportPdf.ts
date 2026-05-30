import { jsPDF } from "jspdf";
import { rasterizeSvg, sanitize } from "./raster";

export type PdfPaper = "a4" | "a3";

interface PdfOptions {
  paper?: PdfPaper;
}

/**
 * Экспорт схемы в PDF. По умолчанию — A4 landscape.
 *
 * Алгоритм: рендерим SVG в высокую растровую картинку (PNG), затем вписываем
 * её в лист с сохранением пропорций. Для инженерной схемы это даёт
 * идеальный вид при печати.
 */
export async function exportPdf(
  svg: string,
  projectName: string,
  opts: PdfOptions = {}
): Promise<void> {
  const paper = opts.paper ?? "a4";

  const pngBlob = await rasterizeSvg(svg, "png", {
    scale: 2,
    quality: 1,
    background: "#ffffff"
  });
  const pngDataUrl = await blobToDataUrl(pngBlob);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: paper
  });

  // Размер листа.
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;

  // Натуральные размеры картинки.
  const dims = await getImageDims(pngDataUrl);
  const ratio = dims.w / dims.h;

  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;

  let drawW = availW;
  let drawH = availW / ratio;
  if (drawH > availH) {
    drawH = availH;
    drawW = availH * ratio;
  }
  const drawX = (pageW - drawW) / 2;
  const drawY = (pageH - drawH) / 2;

  pdf.addImage(pngDataUrl, "PNG", drawX, drawY, drawW, drawH);
  pdf.save(`led-scheme-${sanitize(projectName || "project")}.pdf`);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
