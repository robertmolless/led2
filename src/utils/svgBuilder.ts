/**
 * Построение SVG разметки схемы LED-проекта.
 *
 * Проект может содержать НЕСКОЛЬКО независимых экранов — они рисуются в ряд,
 * каждый со своей сеткой, разводкой сигнала/питания, плашками U/B и стойками,
 * с подписью параметров под ним. Сверху — сводный блок «ALL» и легенда.
 *
 * Возвращается строка (а не JSX): эта же разметка идёт и в DOM, и в экспорт.
 */
import type {
  ProjectConfig,
  ProjectResult,
  ScreenResult,
  PortGroup,
  CabinetCell,
  SideName
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
const HEADER_GAP = 28;       // между шапкой и зоной экранов
const SCREEN_GAP = 64;       // между соседними экранами
const LABEL_H = 40;          // высота строки с названием экрана над сеткой
const LEGS_GAP = 40;         // от низа сетки до стоек
const LEG_R = 14;            // радиус стойки
const CAPTION_GAP = 26;      // от стоек до подписи
const CAPTION_LINE = 17;     // высота строки подписи
const CAPTION_LINES = 6;     // сколько строк в подписи под экраном
const BADGE_GAP = 2;

type Side = SideName;

function oppositeSide(s: Side): Side {
  return s === "left" ? "right" : s === "right" ? "left" : s === "top" ? "bottom" : "top";
}
function dirFromTo(from: CabinetCell, to: CabinetCell): Side {
  if (to.col > from.col) return "right";
  if (to.col < from.col) return "left";
  if (to.row > from.row) return "top";
  if (to.row < from.row) return "bottom";
  return "right";
}
function visualSide(logical: Side, flipX: boolean): Side {
  if (!flipX) return logical;
  if (logical === "left") return "right";
  if (logical === "right") return "left";
  return logical;
}

interface BuildOptions {
  config: ProjectConfig;
  result: ProjectResult;
}

export function buildSchemeSvg({ config, result }: BuildOptions): string {
  const screens = result.screens;
  if (screens.length === 0) {
    return emptySvg("Нет экранов. Добавьте хотя бы один экран.");
  }
  const renderable = screens.filter((s) => s.cabinetCountX > 0 && s.cabinetCountY > 0);
  if (renderable.length === 0) {
    return emptySvg("Все экраны слишком малы — модули не помещаются.");
  }

  const flipX = config.viewMode === "front";

  // Общий масштаб «метр → px»: подбираем так, чтобы суммарная ширина всех
  // экранов с зазорами уложилась примерно в targetWidth.
  const targetWidth = 1500;
  const totalMetersWidth = renderable.reduce((s, r) => s + r.actualWidthM, 0);
  const gapsWidth = (renderable.length - 1) * SCREEN_GAP;
  const scale = clamp(
    (targetWidth - gapsWidth) / Math.max(0.1, totalMetersWidth),
    40,
    220
  );

  const maxGridH = renderable.reduce(
    (m, r) => Math.max(m, r.actualHeightM * scale),
    0
  );

  // Шапка слева: сводный блок + легенда.
  const headerLines = buildAllLines(config, result);
  const headerH = Math.max(
    headerLines.length * 20 + 24,
    config.showLegend ? 150 : 0
  );

  // Вертикальная раскладка зон.
  const gridsTop = PADDING + headerH + HEADER_GAP + LABEL_H;
  const gridsBottom = gridsTop + maxGridH; // общая нижняя линия всех сеток
  const legsY = gridsBottom + LEGS_GAP;
  const captionTop = legsY + LEG_R * 2 + CAPTION_GAP;
  const captionBottom = captionTop + CAPTION_LINES * CAPTION_LINE;

  // Горизонтальная раскладка экранов.
  const parts: string[] = [];
  parts.push(`__BG__`); // плейсхолдер фона — размеры посчитаем в конце

  let cursorX = PADDING;
  let maxRight = PADDING;

  renderable.forEach((screen) => {
    const cellW = screen.cabinetWidthM * scale;
    const cellH = screen.cabinetHeightM * scale;
    const gridW = screen.cabinetCountX * cellW;
    const gridH = screen.cabinetCountY * cellH;
    const gridLeft = cursorX;
    const gridTop = gridsBottom - gridH; // нижнее выравнивание
    const gridBottomY = gridsBottom;

    drawScreen(parts, screen, config, {
      flipX,
      gridLeft,
      gridTop,
      gridBottomY,
      cellW,
      cellH,
      legsY,
      captionTop
    });

    maxRight = gridLeft + gridW;
    cursorX = gridLeft + gridW + SCREEN_GAP;
  });

  // Шапка (после расчёта, чтобы знать ширину при необходимости).
  drawHeader(parts, headerLines, PADDING, PADDING);
  if (config.showLegend) {
    drawLegend(parts, PADDING, PADDING + headerLines.length * 20 + 16);
  }

  const svgW = Math.max(maxRight, PADDING + 380) + PADDING;
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
  gridLeft: number;
  gridTop: number;
  gridBottomY: number;
  cellW: number;
  cellH: number;
  legsY: number;
  captionTop: number;
}

function drawScreen(
  parts: string[],
  screen: ScreenResult,
  config: ProjectConfig,
  L: ScreenLayout
) {
  const nx = screen.cabinetCountX;
  const ny = screen.cabinetCountY;
  const gridW = nx * L.cellW;
  const gridH = ny * L.cellH;

  // Центр ячейки (с учётом flipX по X).
  const cellCenter = (row: number, col: number) => {
    const visualCol = L.flipX ? nx - 1 - col : col;
    const cx = L.gridLeft + visualCol * L.cellW + L.cellW / 2;
    const cy = L.gridBottomY - row * L.cellH - L.cellH / 2;
    return { cx, cy };
  };
  const edgeCenter = (row: number, col: number, vSide: Side) => {
    const { cx, cy } = cellCenter(row, col);
    const hw = L.cellW / 2;
    const hh = L.cellH / 2;
    switch (vSide) {
      case "left": return { cx: cx - hw, cy };
      case "right": return { cx: cx + hw, cy };
      case "top": return { cx, cy: cy - hh };
      case "bottom": return { cx, cy: cy + hh };
    }
  };

  // Название экрана над сеткой.
  parts.push(
    `<text x="${round(L.gridLeft + gridW / 2)}" y="${round(L.gridTop - 14)}" text-anchor="middle" dominant-baseline="alphabetic" font-family="system-ui, -apple-system, Arial" font-size="26" font-weight="700" fill="${C.text}">${escapeXml(screen.name)}</text>`
  );

  // Подписи столбцов/строк.
  for (let col = 0; col < nx; col++) {
    if (nx > 24 && col % 2 === 1 && col !== nx - 1) continue;
    const visualCol = L.flipX ? nx - 1 - col : col;
    const cx = L.gridLeft + visualCol * L.cellW + L.cellW / 2;
    parts.push(
      `<text x="${round(cx)}" y="${round(L.gridTop - 2)}" text-anchor="middle" font-family="system-ui" font-size="12" fill="${C.textMuted}">${col + 1}</text>`
    );
  }
  for (let row = 0; row < ny; row++) {
    const cy = L.gridBottomY - row * L.cellH - L.cellH / 2;
    parts.push(
      `<text x="${round(L.gridLeft - 14)}" y="${round(cy)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="12" fill="${C.textMuted}">${row + 1}</text>`
    );
  }

  // Сетка.
  parts.push(`<g stroke="${C.gridLine}" stroke-width="1" fill="none">`);
  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const x = L.gridLeft + col * L.cellW;
      const y = L.gridBottomY - row * L.cellH - L.cellH;
      parts.push(`<rect x="${round(x)}" y="${round(y)}" width="${round(L.cellW)}" height="${round(L.cellH)}"/>`);
    }
  }
  parts.push(`</g>`);
  parts.push(
    `<rect x="${round(L.gridLeft)}" y="${round(L.gridTop)}" width="${round(gridW)}" height="${round(gridH)}" fill="none" stroke="${C.border}" stroke-width="2"/>`
  );

  if (config.showCabinetNumbers) {
    for (let row = 0; row < ny; row++) {
      for (let col = 0; col < nx; col++) {
        const { cx, cy } = cellCenter(row, col);
        parts.push(
          `<text x="${round(cx)}" y="${round(cy)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="10" fill="${C.textMuted}">${row + 1}.${col + 1}</text>`
        );
      }
    }
  }

  // Сигнал и питание по портам.
  const portStrokeW = 3;
  const signalOffset = -Math.min(L.cellH * 0.18, 12);
  const powerOffset = +Math.min(L.cellH * 0.18, 12);
  const uSize = clamp(Math.min(L.cellW, L.cellH) * 0.55, 20, 38);

  screen.ports.forEach((port) => {
    drawPort(parts, port, {
      cellCenter,
      edgeCenter,
      flipX: L.flipX,
      signalInputSide: screen.signalInputSide,
      portStrokeW,
      signalOffset,
      powerOffset,
      backupEnabled: config.backupEnabled,
      uSize,
      showPortNumbers: config.showPortNumbers
    });
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

interface DrawPortCtx {
  cellCenter: (r: number, c: number) => { cx: number; cy: number };
  edgeCenter: (r: number, c: number, vSide: Side) => { cx: number; cy: number };
  flipX: boolean;
  signalInputSide: Side;
  portStrokeW: number;
  signalOffset: number;
  powerOffset: number;
  backupEnabled: boolean;
  uSize: number;
  showPortNumbers: boolean;
}

function computeUBSides(port: PortGroup, fallback: Side): { uSide: Side; bSide: Side } {
  const arr = port.cabinets;
  if (arr.length >= 2) {
    const firstOut = dirFromTo(arr[0], arr[1]);
    const lastIn = dirFromTo(arr[arr.length - 1], arr[arr.length - 2]);
    return { uSide: oppositeSide(firstOut), bSide: oppositeSide(lastIn) };
  }
  return { uSide: fallback, bSide: oppositeSide(fallback) };
}

function placeBadge(edge: { cx: number; cy: number }, size: number, vSide: Side) {
  const half = size / 2 + BADGE_GAP;
  switch (vSide) {
    case "left": return { cx: edge.cx - half, cy: edge.cy };
    case "right": return { cx: edge.cx + half, cy: edge.cy };
    case "top": return { cx: edge.cx, cy: edge.cy - half };
    case "bottom": return { cx: edge.cx, cy: edge.cy + half };
  }
}

function drawPort(parts: string[], port: PortGroup, ctx: DrawPortCtx) {
  if (port.cabinets.length === 0) return;
  const first = port.cabinets[0];
  const last = port.cabinets[port.cabinets.length - 1];

  const signalPoints = port.cabinets.map((c) => {
    const { cx, cy } = ctx.cellCenter(c.row, c.col);
    return { x: cx, y: cy + ctx.signalOffset };
  });
  const powerPoints = port.cabinets.map((c) => {
    const { cx, cy } = ctx.cellCenter(c.row, c.col);
    return { x: cx, y: cy + ctx.powerOffset };
  });

  const overColor = port.isOverLimit ? C.warn : null;
  parts.push(
    `<polyline points="${signalPoints.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${overColor ?? C.signal}" stroke-width="${ctx.portStrokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  parts.push(
    `<polyline points="${powerPoints.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${C.power}" stroke-width="${ctx.portStrokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  const { uSide, bSide } = computeUBSides(port, ctx.signalInputSide);
  const uVisual = visualSide(uSide, ctx.flipX);
  const bVisual = visualSide(bSide, ctx.flipX);

  const uEdge = ctx.edgeCenter(first.row, first.col, uVisual);
  const uPos = placeBadge(uEdge, ctx.uSize, uVisual);
  parts.push(squareBadge(uPos.cx, uPos.cy, ctx.uSize, C.uFill, "U", C.uText));

  if (ctx.showPortNumbers) {
    const off = ctx.uSize / 2 + 6;
    let lx = uPos.cx, ly = uPos.cy;
    let anchor: "start" | "end" | "middle" = "middle";
    let baseline: "central" | "alphabetic" | "hanging" = "central";
    switch (uVisual) {
      case "left": lx = uPos.cx - off; anchor = "end"; break;
      case "right": lx = uPos.cx + off; anchor = "start"; break;
      case "top": ly = uPos.cy - off; baseline = "alphabetic"; break;
      case "bottom": ly = uPos.cy + off; baseline = "hanging"; break;
    }
    parts.push(
      `<text x="${round(lx)}" y="${round(ly)}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-family="system-ui" font-size="12" fill="${C.text}" font-weight="600">P${port.portNumber}</text>`
    );
  }

  if (ctx.backupEnabled) {
    const bEdge = ctx.edgeCenter(last.row, last.col, bVisual);
    const bPos = placeBadge(bEdge, ctx.uSize, bVisual);
    parts.push(squareBadge(bPos.cx, bPos.cy, ctx.uSize, C.bFill, "B", C.bText));
  }
}

function squareBadge(cx: number, cy: number, size: number, fill: string, text: string, textColor: string): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  return `<g>
    <rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" fill="${fill}" stroke="${C.border}" stroke-width="1"/>
    <text x="${round(cx)}" y="${round(cy)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, Arial" font-size="${round(size * 0.55)}" font-weight="700" fill="${textColor}">${text}</text>
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

function buildAllLines(config: ProjectConfig, r: ProjectResult): string[] {
  const lines: string[] = [];
  lines.push(`${config.projectName || "Проект"} — ${r.pixelPitch}`);
  lines.push(
    `ALL: ${stripZero(r.combinedWidthM)}×${stripZero(r.combinedHeightM)} м (${r.combinedResolutionX}×${r.combinedResolutionY})`
  );
  lines.push(`Экранов: ${r.screenCount} · Модулей: ${r.totalCabinets}`);
  lines.push(`Энергопотребление: ${formatKw(r.totalPowerKw)}`);
  lines.push(`Вес: ${formatKg(r.totalWeightKg)}`);
  lines.push(`Портов всего: ${r.totalPorts} · Ноги: ${r.totalLegs}`);
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
