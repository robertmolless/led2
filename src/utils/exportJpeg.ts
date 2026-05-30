import { rasterizeAndDownload } from "./raster";

export async function exportJpeg(svg: string, projectName: string): Promise<void> {
  await rasterizeAndDownload({
    svg,
    fileBaseName: `led-scheme-${projectName || "project"}`,
    format: "jpeg",
    scale: 2,
    quality: 0.92,
    background: "#ffffff"
  });
}
