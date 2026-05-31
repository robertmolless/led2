/**
 * Построение SVG разметки схемы LED-проекта.
 *
 * Особенности этой версии:
 *  - позиционирование ячеек МЕТРИЧЕСКОЕ (по cell.x/y/width/height) — это
 *    позволяет рисовать экраны со СМЕШАННЫМИ по высоте рядами (0.5×1 + 0.5×0.5);
 *  - плашки U и B рисуются ВНУТРИ модулей (в первой/последней ячейке порта);
 *  - сигнал идёт строго линиями (ряд или колонка), без змеек;
 *  - в шапке выводится рекомендованный/выбранный процессор.
 */
import type {
  ProjectConfig,
  ProjectResult,
  ScreenResult,
  PortGroup,
  CabinetCell,
  ProcessorRecommendation
} from "../types";
import { formatKw, formatKg } from "./calculations";

const C = {
  bg: "#ffffff",
  gridLine: "#d4d4d4",
  border: "#111827",
  text: "#111827",
  textMuted: "#374151",
  signal: "#2563eb",
  power: "#f97316",
  uFill: "#22c55e",
  uText: "#ffffff",
  bFill: "#facc15",
  bText: "#111827",
  leg: "#111827",
  warn: "#dc2626"
};

const PADDING = 40;
const HEADER_GAP = 28;
const SCREEN_GAP = 64;
const LABEL_H = 40;
const LEGS_GAP = 40;
const LEG_R = 14;
const CAPTION_GAP = 26;
const CAPTION_LINE = 17;
const CAPTION_LINES = 6;

interface BuildOptions {
  config: ProjectConfig;
  result: ProjectResult;
  recommendation?: ProcessorRecommendation;
}

export function buildSchemeSvg({ config, result, recommendation }: BuildOptions): string {
  const screens = result.screens;
  if (screens.length === 0) return emptySvg("Нет экранов. Добавьте хотя бы один экран.");
  const renderable = screens.filter((s) => s.cabinetCountX > 0 && s.cabinetCountY > 0);
  if (renderable.length === 0) return emptySvg("Все экраны слишком малы — модули не помещаются.");

  const flipX = config.viewMode === "front";

  const targetWidth = 1500;
  const totalMetersWidth = renderable.reduce((s, r) => s + r.actualWidthM, 0);
  const gapsWidth = (renderable.length - 1) * SCREEN_GAP;
  const scale = clamp((targetWidth - gapsWidth) / Math.max(0.1, totalMetersWidth), 40, 220);

  const maxGridH = renderable.reduce((m, r) => Math.max(m, r.actualHeightM * scale), 0);

  const headerLines = buildAllLines(config, result, recommendation);
  const headerH = Math.max(headerLines.length * 20 + 24, config.showLegend ? 150 : 0);

  const gridsTop = PADDING + headerH + HEADER_GAP + LABEL_H;
  const gridsBottom = gridsTop + maxGridH;
  const legsY = gridsBottom + LEGS_GAP;
  const captionTop = legsY + LEG_R * 2 + CAPTION_GAP;
  const captionBottom = captionTop + CAPTION_LINES * CAPTION_LINE;

  const parts: string[] = [];
  parts.push(`__BG__`);

  let cursorX = PADDING;
  let maxRight = PADDING;

  renderable.forEach((screen) => {
    const gridW = screen.actualWidthM * scale;
    const gridLeft = cursorX;
    const gridBottomY = gridsBottom;

    drawScreen(parts, screen, config, {
      flipX,
      scale,
      gridLeft,
      gridBottomY,
      actualWidthM: screen.actualWidthM,
      actualHeightM: screen.actualHeightM,
      legsY,
      captionTop
    });

    maxRight = gridLeft + gridW;
    cursorX = gridLeft + gridW + SCREEN_GAP;
  });

  drawHeader(parts, headerLines, PADDING, PADDING);
  if (config.showLegend) {
    drawLegend(parts, PADDING, PADDING + headerLines.length * 20 + 16);
  }

  const svgW = Math.max(maxRight, PADDING + 420) + PADDING;
  const svgH = captionBottom + PADDING;

  const bg = `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="${C.bg}"/>`;
  const body = parts.join("\n").replace("__BG__", bg);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" preserveAspectRatio="xMidYMid meet">
    ${body}
  </svg>`;
}

// ===========================================================================

interface ScreenLayout {
  flipX: boolean;
  scale: number;
  gridLeft: number;
  gridBottomY: number;
  actualWidthM: number;
  actualHeightM: number;
  legsY: number;
  captionTop: number;
}

/** Прямоугольник ячейки на холсте, вычисленный из её МЕТРИЧЕСКИХ координат. */
function cellRect(cell: CabinetCell, L: ScreenLayout) {
  const visualX = L.flipX ? L.actualWidthM - cell.x - cell.width : cell.x;
  const x = L.gridLeft + visualX * L.scale;
  const y = L.gridBottomY - (cell.y + cell.height) * L.scale;
  const w = cell.width * L.scale;
  const h = cell.height * L.scale;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function drawScreen(
  parts: string[],
  screen: ScreenResult,
  config: ProjectConfig,
  L: ScreenLayout
) {
  const gridW = L.actualWidthM * L.scale;
  const gridH = L.actualHeightM * L.scale;
  const gridTop = L.gridBottomY - gridH;

  // Название экрана.
  parts.push(
    `<text x="${round(L.gridLeft + gridW / 2)}" y="${round(gridTop - 14)}" text-anchor="middle" font-family="system-ui, -apple-system, Arial" font-size="26" font-weight="700" fill="${C.text}">${escapeXml(screen.name)}</text>`
  );

  // Подписи столбцов (по индексу колонки).
  const nx = screen.cabinetCountX;
  const colW = screen.cabinetWidthM * L.scale;
  for (let col = 0; col < nx; col++) {
    if (nx > 24 && col % 2 === 1 && col !== nx - 1) continue;
    const visualCol = L.flipX ? nx - 1 - col : col;
    const cx = L.gridLeft + visualCol * colW + colW / 2;
    parts.push(
      `<text x="${round(cx)}" y="${round(gridTop - 2)}" text-anchor="middle" font-family="system-ui" font-size="12" fill="${C.textMuted}">${col + 1}</text>`
    );
  }
  // Подписи рядов (берём по одной ячейке из каждого ряда, col=0).
  const rowCells = screen.cabinets.filter((c) => c.col === 0).sort((a, b) => a.row - b.row);
  rowCells.forEach((c) => {
    const r = cellRect(c, L);
    parts.push(
      `<text x="${round(L.gridLeft - 14)}" y="${round(r.cy)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="12" fill="${C.textMuted}">${c.row + 1}</text>`
    );
  });

  // Сетка — рисуем каждую ячейку по её метрике (поддержка смешанных рядов).
  parts.push(`<g stroke="${C.gridLine}" stroke-width="1" fill="none">`);
  screen.cabinets.forEach((c) => {
    const r = cellRect(c, L);
    parts.push(`<rect x="${round(r.x)}" y="${round(r.y)}" width="${round(r.w)}" height="${round(r.h)}"/>`);
  });
  parts.push(`</g>`);
  parts.push(
    `<rect x="${round(L.gridLeft)}" y="${round(gridTop)}" width="${round(gridW)}" height="${round(gridH)}" fill="none" stroke="${C.border}" stroke-width="2"/>`
  );

  if (config.showCabinetNumbers) {
    screen.cabinets.forEach((c) => {
      const r = cellRect(c, L);
      parts.push(
        `<text x="${round(r.cx)}" y="${round(r.cy)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="10" fill="${C.textMuted}">${c.row + 1}.${c.col + 1}</text>`
      );
    });
  }

  // Сигнал/питание по портам.
  screen.ports.forEach((port) => {
    drawPort(parts, port, config, L);
  });

  // Стойки.
  if (screen.legsCount > 0) {
    for (let i = 0; i < screen.legsCount; i++) {
      const t = screen.legsCount === 1 ? 0.5 : i / (screen.legsCount - 1);
      const lx = L.gridLeft + t * gridW;
      const size = LEG_R * 1.8;
      parts.push(
        `<rect x="${round(lx - size / 2)}" y="${round(L.legsY - size / 2)}" width="${round(size)}" height="${round(size)}" fill="${C.leg}"/>`
      );
    }
  }

  // Подпись параметров под экраном.
  const cap = buildScreenCaption(screen);
  let cy = L.captionTop;
  parts.push(`<g font-family="system-ui, -apple-system, Arial" font-size="13" fill="${C.text}">`);
  cap.forEach((line, i) => {
    parts.push(
      `<text x="${round(L.gridLeft)}" y="${round(cy)}" font-weight="${i === 0 ? 700 : 400}">${escapeXml(line)}</text>`
    );
    cy += CAPTION_LINE;
  });
  parts.push(`</g>`);
}

// ===========================================================================

function drawPort(parts: string[], port: PortGroup, config: ProjectConfig, L: ScreenLayout) {
  if (port.cabinets.length === 0) return;
  const cells = port.cabinets;
  const first = cells[0];
  const last = cells[cells.length - 1];

  // Определяем направление линии: горизонтальная (один ряд) или вертикальная (одна колонка).
  const isHorizontal = first.row === last.row;
  const stroke = 3;

  // Смещение сигнала/питания перпендикулярно линии, чтобы не сливались.
  const rects = cells.map((c) => cellRect(c, L));
  const cellMin = Math.min(rects[0].w, rects[0].h);
  const off = Math.min(cellMin * 0.16, 11);

  const sigPts = rects.map((r) =>
    isHorizontal ? { x: r.cx, y: r.cy - off } : { x: r.cx - off, y: r.cy }
  );
  const pwrPts = rects.map((r) =>
    isHorizontal ? { x: r.cx, y: r.cy + off } : { x: r.cx + off, y: r.cy }
  );

  const sigColor = port.isOverLimit ? C.warn : C.signal;
  parts.push(
    `<polyline points="${sigPts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${sigColor}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  parts.push(
    `<polyline points="${pwrPts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${C.power}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  // U/B — ВНУТРИ модулей (в первой/последней ячейке порта).
  const firstRect = rects[0];
  const lastRect = rects[rects.length - 1];

  const uSize = clamp(Math.min(firstRect.w, firstRect.h) * 0.66, 13, 34);
  const bSize = clamp(Math.min(lastRect.w, lastRect.h) * 0.66, 13, 34);

  // U в центре первой ячейки.
  parts.push(squareBadge(firstRect.cx, firstRect.cy, uSize, C.uFill, "U", C.uText));

  if (config.showPortNumbers) {
    // Номер порта — рядом с U, со стороны входа сигнала.
    const lx = isHorizontal ? firstRect.cx : firstRect.cx;
    const ly = isHorizontal ? firstRect.cy - uSize / 2 - 8 : firstRect.cy - uSize / 2 - 8;
    parts.push(
      `<text x="${round(lx)}" y="${round(ly)}" text-anchor="middle" dominant-baseline="alphabetic" font-family="system-ui" font-size="12" fill="${C.text}" font-weight="700">P${port.portNumber}</text>`
    );
  }

  // B в центре последней ячейки (если backup включён и порт не из одной ячейки,
  // иначе B сел бы поверх U — в этом случае ставим B всё равно, но это вырожденный порт).
  if (config.backupEnabled) {
    parts.push(squareBadge(lastRect.cx, lastRect.cy, bSize, C.bFill, "B", C.bText));
  }
}

function squareBadge(cx: number, cy: number, size: number, fill: string, text: string, textColor: string): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  return `<g>
    <rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" rx="3" ry="3" fill="${fill}" stroke="${C.border}" stroke-width="1.5"/>
    <text x="${round(cx)}" y="${round(cy)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, Arial" font-size="${round(size * 0.6)}" font-weight="700" fill="${textColor}">${text}</text>
  </g>`;
}

function drawHeader(parts: string[], lines: string[], x: number, y: number) {
  parts.push(`<g font-family="system-ui, -apple-system, Arial" font-size="14" fill="${C.text}">`);
  let ty = y + 12;
  lines.forEach((line, i) => {
    parts.push(
      `<text x="${x}" y="${ty}" font-size="${i === 0 ? 16 : 14}" font-weight="${i === 0 ? 700 : 400}">${escapeXml(line)}</text>`
    );
    ty += i === 0 ? 24 : 20;
  });
  parts.push(`</g>`);
}

function drawLegend(parts: string[], x: number, y: number) {
  parts.push(`<g font-family="system-ui" font-size="13" fill="${C.text}">`);
  let yy = y;
  const row = (draw: () => void) => { draw(); yy += 24; };
  row(() => {
    parts.push(`<line x1="${x}" y1="${yy}" x2="${x + 36}" y2="${yy}" stroke="${C.power}" stroke-width="4"/>`);
    parts.push(`<text x="${x + 46}" y="${yy}" dominant-baseline="central">Питание</text>`);
  });
  row(() => {
    parts.push(`<line x1="${x}" y1="${yy}" x2="${x + 36}" y2="${yy}" stroke="${C.signal}" stroke-width="4"/>`);
    parts.push(`<text x="${x + 46}" y="${yy}" dominant-baseline="central">Сигнал</text>`);
  });
  row(() => {
    parts.push(squareBadge(x + 11, yy, 20, C.uFill, "U", C.uText));
    parts.push(`<text x="${x + 30}" y="${yy}" dominant-baseline="central">Up / вход сигнала</text>`);
  });
  row(() => {
    parts.push(squareBadge(x + 11, yy, 20, C.bFill, "B", C.bText));
    parts.push(`<text x="${x + 30}" y="${yy}" dominant-baseline="central">Backup</text>`);
  });
  row(() => {
    parts.push(`<rect x="${x + 1}" y="${yy - 9}" width="18" height="18" fill="${C.leg}"/>`);
    parts.push(`<text x="${x + 30}" y="${yy}" dominant-baseline="central">Опорная стойка</text>`);
  });
  parts.push(`</g>`);
}

function buildAllLines(config: ProjectConfig, r: ProjectResult, rec?: ProcessorRecommendation): string[] {
  const lines: string[] = [];
  lines.push(`${config.projectName || "Проект"} — ${r.pixelPitch}`);
  lines.push(
    `ALL: ${stripZero(r.combinedWidthM)}×${stripZero(r.combinedHeightM)} м (${r.combinedResolutionX}×${r.combinedResolutionY})`
  );
  lines.push(`Экранов: ${r.screenCount} · Модулей: ${r.totalCabinets}`);
  lines.push(`Энергопотребление: ${formatKw(r.totalPowerKw)} · Вес: ${formatKg(r.totalWeightKg)}`);
  lines.push(`Портов всего: ${r.totalPorts} · Ноги: ${r.totalLegs}`);
  if (rec) {
    const units = rec.unitsNeeded > 1 ? `${rec.unitsNeeded}× ` : "";
    const flag = rec.fits ? "" : " (не хватает — см. предупреждения)";
    lines.push(`Процессор: ${units}${rec.processor.name}${flag}`);
  }
  lines.push(`Вид: ${config.viewMode === "front" ? "из зала (спереди)" : "сзади"}`);
  return lines;
}

function buildScreenCaption(s: ScreenResult): string[] {
  return [
    `${s.name}: ${stripZero(s.actualWidthM)}×${stripZero(s.actualHeightM)} м (${s.resolutionX}×${s.resolutionY})`,
    `Модули ${s.cabinetCountX}×${s.cabinetCountY} = ${s.totalCabinets}`,
    `Порты (сигнал): ${s.portsNeeded}`,
    `Энергопотребление: ${formatKw(s.totalPowerKw)}`,
    `Вес: ${formatKg(s.totalWeightKg)}`,
    `Ноги: ${s.legsCount}`
  ];
}

function emptySvg(msg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="800" height="200">
    <rect width="100%" height="100%" fill="${C.bg}"/>
    <text x="400" y="100" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="18" fill="${C.warn}">${escapeXml(msg)}</text>
  </svg>`;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function round(n: number) { return Math.round(n * 100) / 100; }
function stripZero(n: number) {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(parseFloat(n.toFixed(2)));
}
function escapeXml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
