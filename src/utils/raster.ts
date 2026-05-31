/**
 * Растровый экспорт SVG → Canvas → Blob.
 * Используется как PNG, так и JPEG.
 */

interface RasterOpts {
  svg: string;
  fileBaseName: string;
  format: "png" | "jpeg" | "webp";
  /** Множитель разрешения относительно исходного SVG (PNG/JPEG). */
  scale?: number;
  /** Качество JPEG, 0..1. */
  quality?: number;
  /** Цвет фона при сохранении (важно для JPEG, у которого нет прозрачности). */
  background?: string;
}

export async function rasterizeAndDownload(opts: RasterOpts): Promise<void> {
  const { svg, fileBaseName, format } = opts;
  const scale = opts.scale ?? 2;
  const quality = opts.quality ?? 0.92;
  const background = opts.background ?? "#ffffff";

  const blob = await rasterizeSvg(svg, format, { scale, quality, background });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext = format === "jpeg" ? "jpg" : format === "webp" ? "webp" : "png";
  a.download = `${sanitize(fileBaseName)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function rasterizeSvg(
  svg: string,
  format: "png" | "jpeg" | "webp",
  o: { scale: number; quality: number; background: string }
): Promise<Blob> {
  // Извлекаем width/height из тега svg. preserveAspectRatio оставляем.
  const widthMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
  const w = widthMatch ? parseFloat(widthMatch[1]) : 1600;
  const h = heightMatch ? parseFloat(heightMatch[1]) : 900;

  // Кодируем SVG в data URL.
  const encoded =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(svg.replace(/\n/g, ""));

  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = encoded;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * o.scale);
  canvas.height = Math.round(h * o.scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context недоступен.");
  ctx.fillStyle = o.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("toBlob вернул null."));
      },
      mime,
      o.quality
    );
  });
}

export function sanitize(name: string): string {
  return (name || "led-scheme")
    .trim()
    .replace(/[^a-zA-Z0-9-_а-яА-Я ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "led-scheme";
}
