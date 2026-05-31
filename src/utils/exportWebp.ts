import { rasterizeAndDownload } from "./raster";

/** Экспорт схемы в WebP — лёгкий формат для веба. */
export async function exportWebp(svg: string, projectName: string): Promise<void> {
  await rasterizeAndDownload({
    svg,
    fileBaseName: `led-scheme-${projectName || "project"}`,
    format: "webp",
    scale: 2,
    quality: 0.9,
    background: "#ffffff"
  });
}
