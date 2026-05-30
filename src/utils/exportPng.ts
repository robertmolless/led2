import { rasterizeAndDownload } from "./raster";

export async function exportPng(svg: string, projectName: string): Promise<void> {
  await rasterizeAndDownload({
    svg,
    fileBaseName: `led-scheme-${projectName || "project"}`,
    format: "png",
    scale: 2,
    background: "#ffffff"
  });
}
