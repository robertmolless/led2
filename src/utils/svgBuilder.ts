/**
 * Построение SVG разметки схемы LED-экрана.
 *
 * Функция намеренно возвращает строку, а не JSX: эта же разметка идёт и в DOM
 * (через dangerouslySetInnerHTML), и в экспорт PNG/JPEG/PDF.
 */
import type {
  CalculatedResult,
  ProjectConfig,
  PortGroup,
  CabinetCell,
  SideName
} from "../types";
import { getPresetById } from "../data/cabinetPresets";
import { formatKw, formatKg } from "./calculations";

// Палитра.
const C = {
  bg: "#ffffff",
  gridLine: "#d4d4d4",
  gridLineMajor: "#9ca3af",
  border: "#111827",
  text: "#111827",
  textMuted: "#374151",
  signal: "#2563eb",   // синий
  power: "#f97316",    // оранжевый
  uFill: "#22c55e",    // зелёный U
  uText: "#ffffff",
  bFill: "#facc15",    // жёлтый B
  bText: "#111827",
  leg: "#111827",
  warn: "#dc2626"
};

// Поля и базовые размеры.
const PADDING = 80;
const TECH_BLOCK_WIDTH = 380;
const LEGEND_HEIGHT = 70;
const LEGS_GAP = 56;
const LEG_RADIUS = 18;
const TOP_LABEL_GAP = 56;
const LEFT_LABEL_GAP = 42;
const CABINET_LABEL_FONT = 14;
const BASE_LINE_W = 4;
// Внешний отступ от плашки U/B до сетки (чтобы плашка не прилипала вплотную).
const BADGE_GAP = 2;

interface BuildOptions {
  config: ProjectConfig;
  result: CalculatedResult;
}

type Side = SideName;

/** Логическая сторона, обратная заданной. */
function oppositeSide(s: Side): Side {
  switch (s) {
    case "left":   return "right";
    case "right":  return "left";
    case "top":    return "bottom";
    case "bottom": return "top";
  }
}

/**
 * Сторона кабинета `from`, в которую он «передаёт» сигнал на `to`.
 * Например, если `to` правее `from` — сигнал уходит «вправо».
 */
function dirFromTo(from: CabinetCell, to: CabinetCell): Side {
  if (to.col > from.col) return "right";
  if (to.col < from.col) return "left";
  if (to.row > from.row) return "top";
  if (to.row < from.row) return "bottom";
  return "right";
}

/** При виде «спереди» зеркалится только по X. */
function visualSide(logical: Side, flipX: boolean): Side {
  if (!flipX) return logical;
  if (logical === "left") return "right";
  if (logical === "right") return "left";
  return logical;
}

/**
 * Главная функция: возвращает строку SVG.
 */
export function buildSchemeSvg({ config, result }: BuildOptions): string {
  const preset = getPresetById(config.cabinetPresetId);

  const { cabinetCountX: nx, cabinetCountY: ny, cabinetWidthM, cabinetHeightM } = result;

  if (nx === 0 || ny === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="800" height="200">
      <rect width="100%" height="100%" fill="${C.bg}"/>
      <text x="400" y="100" text-anchor="middle" font-family="system-ui" font-size="20" fill="${C.warn}">
        Невозможно собрать схему: задайте корректные размеры экрана.
      </text>
    </svg>`;
  }

  // Подбираем масштаб «метр → пиксель» так, чтобы общая ширина SVG была
  // примерно постоянная (~1600 px видимой сетки), но не слишком крупная.
  const targetGridWidth = 1600;
  const pxPerMeter = clamp(targetGridWidth / (nx * cabinetWidthM), 40, 220);
  const cellW = cabinetWidthM * pxPerMeter;
  const cellH = cabinetHeightM * pxPerMeter;

  const gridW = nx * cellW;
  const gridH = ny * cellH;

  // Координаты сетки.
  const gridLeft = PADDING + LEFT_LABEL_GAP;
  const gridTop = PADDING + TOP_LABEL_GAP;
  const gridRight = gridLeft + gridW;
  const gridBottom = gridTop + gridH;

  // Технический блок справа от сетки.
  const techLeft = gridRight + 40;
  const techTop = gridTop;

  // Полный размер SVG.
  const svgW = techLeft + TECH_BLOCK_WIDTH + PADDING;
  const svgH = gridBottom + LEGS_GAP + LEG_RADIUS * 2 + LEGEND_HEIGHT + PADDING;

  // Зеркалирование при «виде спереди» — переворачиваем сетку и подписи по X.
  const flipX = config.viewMode === "front";

  // Центры ячеек в screen-координатах с учётом flipX.
  const cellCenter = (row: number, col: number) => {
    const visualCol = flipX ? nx - 1 - col : col;
    const cx = gridLeft + visualCol * cellW + cellW / 2;
    const cy = gridBottom - row * cellH - cellH / 2;
    return { cx, cy };
  };

  // Центр любой из 4 граней ячейки в screen-координатах (visualSide — уже после flipX).
  const edgeCenter = (row: number, col: number, vSide: Side) => {
    const { cx, cy } = cellCenter(row, col);
    const hw = cellW / 2;
    const hh = cellH / 2;
    switch (vSide) {
      case "left":   return { cx: cx - hw, cy };
      case "right":  return { cx: cx + hw, cy };
      case "top":    return { cx, cy: cy - hh };
      case "bottom": return { cx, cy: cy + hh };
    }
  };

  // === Накапливаем SVG-элементы. ===
  const parts: string[] = [];

  // Фон.
  parts.push(`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="${C.bg}"/>`);

  // Заголовок «Вид сзади / Вид спереди».
  const viewLabel = config.viewMode === "back" ? "Вид сзади" : "Вид спереди";
  parts.push(
    `<text x="${gridLeft + gridW / 2}" y="${PADDING + 28}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, Arial" font-size="22" fill="${C.text}">${viewLabel}</text>`
  );

  // Подписи столбцов (сверху).
  for (let col = 0; col < nx; col++) {
    const visualCol = flipX ? nx - 1 - col : col;
    const cx = gridLeft + visualCol * cellW + cellW / 2;
    const labelY = gridTop - 16;
    // На больших сетках показываем не каждый номер, чтобы не сливалось,
    // но всегда показываем первый и последний.
    if (nx > 30 && col % 2 === 1 && col !== nx - 1) continue;
    parts.push(
      `<text x="${cx}" y="${labelY}" text-anchor="middle" dominant-baseline="alphabetic" font-family="system-ui" font-size="${CABINET_LABEL_FONT}" fill="${C.textMuted}">${col + 1}</text>`
    );
  }
  // Подписи строк (слева).
  for (let row = 0; row < ny; row++) {
    const cy = gridBottom - row * cellH - cellH / 2;
    const labelX = gridLeft - 18;
    parts.push(
      `<text x="${labelX}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="${CABINET_LABEL_FONT}" fill="${C.textMuted}">${row + 1}</text>`
    );
  }

  // Сетка кабинетов — фоном.
  parts.push(`<g stroke="${C.gridLine}" stroke-width="1" fill="none">`);
  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const visualCol = flipX ? nx - 1 - col : col;
      const x = gridLeft + visualCol * cellW;
      const y = gridBottom - row * cellH - cellH;
      parts.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}"/>`);
    }
  }
  parts.push(`</g>`);

  // Внешняя рамка экрана.
  parts.push(
    `<rect x="${gridLeft}" y="${gridTop}" width="${gridW}" height="${gridH}" fill="none" stroke="${C.border}" stroke-width="2"/>`
  );

  // Номера кабинетов внутри ячеек.
  if (config.showCabinetNumbers) {
    for (let row = 0; row < ny; row++) {
      for (let col = 0; col < nx; col++) {
        const { cx, cy } = cellCenter(row, col);
        parts.push(
          `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="11" fill="${C.textMuted}">${row + 1}.${col + 1}</text>`
        );
      }
    }
  }

  // === Сигнал и питание — по портам. ===
  const portStrokeW = clamp(BASE_LINE_W, 2, 5);
  const signalOffset = -Math.min(cellH * 0.18, 12);
  const powerOffset = +Math.min(cellH * 0.18, 12);

  result.ports.forEach((port) => {
    drawPort(parts, port, {
      flipX,
      nx,
      ny,
      cellCenter,
      edgeCenter,
      signalInputSide: config.signalInputSide,
      portStrokeW,
      signalOffset,
      powerOffset,
      backupEnabled: config.backupEnabled,
      cellW,
      cellH,
      showPortNumbers: config.showPortNumbers
    });
  });

  // === Стойки снизу. ===
  const legs = result.legsCount;
  if (legs > 0) {
    const legY = gridBottom + LEGS_GAP;
    for (let i = 0; i < legs; i++) {
      const t = legs === 1 ? 0.5 : i / (legs - 1);
      const lx = gridLeft + t * gridW;
      const size = LEG_RADIUS * 1.8;
      parts.push(
        `<rect x="${lx - size / 2}" y="${legY - size / 2}" width="${size}" height="${size}" fill="${C.leg}"/>`
      );
    }
  }

  // === Технический блок справа. ===
  const techLines = buildTechLines(config, result, preset.name, preset.pixelPitch);
  parts.push(
    `<g font-family="system-ui, -apple-system, Arial" font-size="14" fill="${C.text}">`
  );
  let ty = techTop + 10;
  parts.push(
    `<text x="${techLeft}" y="${ty}" font-size="16" font-weight="700">${escapeXml(config.projectName || "Проект")}</text>`
  );
  ty += 24;
  techLines.forEach((line) => {
    parts.push(`<text x="${techLeft}" y="${ty}">${escapeXml(line)}</text>`);
    ty += 20;
  });
  parts.push(`</g>`);

  // Предупреждения.
  if (result.warnings.length > 0) {
    parts.push(`<g font-family="system-ui" font-size="12" fill="${C.warn}">`);
    let wy = ty + 8;
    parts.push(
      `<text x="${techLeft}" y="${wy}" font-weight="700" fill="${C.warn}">Предупреждения:</text>`
    );
    wy += 18;
    result.warnings.slice(0, 6).forEach((w) => {
      const wrapped = wrapText(w, 48);
      wrapped.forEach((line) => {
        parts.push(`<text x="${techLeft}" y="${wy}">• ${escapeXml(line)}</text>`);
        wy += 16;
      });
    });
    parts.push(`</g>`);
  }

  // === Легенда снизу. ===
  if (config.showLegend) {
    const legendY = gridBottom + LEGS_GAP + LEG_RADIUS * 2 + 40;
    drawLegend(parts, gridLeft, legendY);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" preserveAspectRatio="xMidYMid meet">
    ${parts.join("\n")}
  </svg>`;
}

// ===========================================================================

interface DrawPortCtx {
  flipX: boolean;
  nx: number;
  ny: number;
  cellCenter: (r: number, c: number) => { cx: number; cy: number };
  edgeCenter: (r: number, c: number, vSide: Side) => { cx: number; cy: number };
  signalInputSide: Side;
  portStrokeW: number;
  signalOffset: number;
  powerOffset: number;
  backupEnabled: boolean;
  cellW: number;
  cellH: number;
  showPortNumbers: boolean;
}

/**
 * Возвращает «логическую» сторону кабинета, на которую нужно поставить плашку U
 * (со стороны входа сигнала в первый кабинет порта) и плашку B
 * (со стороны выхода сигнала из последнего кабинета порта).
 *
 * Логика: если в цепочке порта >=2 кабинетов, направление однозначно
 * определяется парой соседних кабинетов. Для одиночного кабинета — берём
 * сторону ввода сигнала из конфига как fallback.
 */
function computeUBSides(
  port: PortGroup,
  fallback: Side
): { uSide: Side; bSide: Side } {
  const arr = port.cabinets;
  let uSide: Side;
  let bSide: Side;

  if (arr.length >= 2) {
    // Куда уходит сигнал из первого кабинета.
    const firstOutDir = dirFromTo(arr[0], arr[1]);
    // U стоит на противоположной стороне (туда вошёл сигнал).
    uSide = oppositeSide(firstOutDir);

    // Откуда сигнал пришёл в последний кабинет.
    const lastInDir = dirFromTo(arr[arr.length - 1], arr[arr.length - 2]);
    // B стоит на противоположной — там, куда сигнал бы пошёл дальше.
    bSide = oppositeSide(lastInDir);
  } else {
    uSide = fallback;
    bSide = oppositeSide(fallback);
  }
  return { uSide, bSide };
}

/**
 * Позиция центра плашки (квадрата), прилипшей снаружи к указанной грани
 * кабинета. visualSide — уже с учётом flipX.
 */
function placeBadge(
  edge: { cx: number; cy: number },
  size: number,
  visualSide: Side
): { cx: number; cy: number } {
  const half = size / 2 + BADGE_GAP;
  switch (visualSide) {
    case "left":   return { cx: edge.cx - half, cy: edge.cy };
    case "right":  return { cx: edge.cx + half, cy: edge.cy };
    case "top":    return { cx: edge.cx, cy: edge.cy - half };
    case "bottom": return { cx: edge.cx, cy: edge.cy + half };
  }
}

function drawPort(parts: string[], port: PortGroup, ctx: DrawPortCtx) {
  if (port.cabinets.length === 0) return;
  const first = port.cabinets[0];
  const last = port.cabinets[port.cabinets.length - 1];

  // Линия сигнала через центры (с лёгким Y-смещением, чтобы не сливалось с питанием).
  const signalPoints = port.cabinets.map((c) => {
    const { cx, cy } = ctx.cellCenter(c.row, c.col);
    return { x: cx, y: cy + ctx.signalOffset };
  });
  const powerPoints = port.cabinets.map((c) => {
    const { cx, cy } = ctx.cellCenter(c.row, c.col);
    return { x: cx, y: cy + ctx.powerOffset };
  });

  const portColorOver = port.isOverLimit ? C.warn : null;

  // Сигнал.
  parts.push(
    `<polyline points="${signalPoints.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${portColorOver ?? C.signal}" stroke-width="${ctx.portStrokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  // Питание.
  parts.push(
    `<polyline points="${powerPoints.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${C.power}" stroke-width="${ctx.portStrokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  // === Размещение U и B ===
  // 1) Логические стороны определяем по реальному направлению цепочки.
  const { uSide, bSide } = computeUBSides(port, ctx.signalInputSide);
  // 2) Переводим их в визуальные с учётом flipX (зеркало по X для вида спереди).
  const uVisual = visualSide(uSide, ctx.flipX);
  const bVisual = visualSide(bSide, ctx.flipX);

  // 3) Размер плашки. Базируемся на меньшей из сторон ячейки, чтобы не вылезать.
  const uSize = clamp(Math.min(ctx.cellW, ctx.cellH) * 0.55, 22, 40);

  // 4) Центры плашек — снаружи нужной грани.
  const uEdge = ctx.edgeCenter(first.row, first.col, uVisual);
  const uPos = placeBadge(uEdge, uSize, uVisual);
  parts.push(squareBadge(uPos.cx, uPos.cy, uSize, C.uFill, "U", C.uText));

  // Номер порта рядом с U — со стороны, противоположной кабинету.
  if (ctx.showPortNumbers) {
    const off = uSize / 2 + 6;
    let lx = uPos.cx, ly = uPos.cy;
    let anchor: "start" | "end" | "middle" = "middle";
    let baseline: "central" | "alphabetic" | "hanging" = "central";
    switch (uVisual) {
      case "left":   lx = uPos.cx - off; anchor = "end";    baseline = "central"; break;
      case "right":  lx = uPos.cx + off; anchor = "start";  baseline = "central"; break;
      case "top":    ly = uPos.cy - off; anchor = "middle"; baseline = "alphabetic"; break;
      case "bottom": ly = uPos.cy + off; anchor = "middle"; baseline = "hanging"; break;
    }
    parts.push(
      `<text x="${round(lx)}" y="${round(ly)}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-family="system-ui" font-size="13" fill="${C.text}" font-weight="600">P${port.portNumber}</text>`
    );
  }

  // B (только при включённом backup) — на стороне выхода из последнего кабинета.
  if (ctx.backupEnabled) {
    const bEdge = ctx.edgeCenter(last.row, last.col, bVisual);
    const bPos = placeBadge(bEdge, uSize, bVisual);
    parts.push(squareBadge(bPos.cx, bPos.cy, uSize, C.bFill, "B", C.bText));
  }
}

/**
 * Квадратная плашка с буквой по центру. Использует dominant-baseline="central"
 * для корректной вертикальной центровки текста во всех браузерах и при экспорте.
 */
function squareBadge(
  cx: number,
  cy: number,
  size: number,
  fill: string,
  text: string,
  textColor: string
): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  return `<g>
    <rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" fill="${fill}" stroke="${C.border}" stroke-width="1"/>
    <text x="${round(cx)}" y="${round(cy)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, Arial" font-size="${round(size * 0.55)}" font-weight="700" fill="${textColor}">${text}</text>
  </g>`;
}

function drawLegend(parts: string[], x: number, y: number) {
  parts.push(`<g font-family="system-ui" font-size="14" fill="${C.text}">`);
  // Питание.
  parts.push(
    `<line x1="${x}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="${C.power}" stroke-width="4"/>`
  );
  parts.push(
    `<text x="${x + 50}" y="${y}" dominant-baseline="central">Питание</text>`
  );
  // Сигнал.
  parts.push(
    `<line x1="${x + 160}" y1="${y}" x2="${x + 200}" y2="${y}" stroke="${C.signal}" stroke-width="4"/>`
  );
  parts.push(
    `<text x="${x + 210}" y="${y}" dominant-baseline="central">Сигнал</text>`
  );
  // U.
  parts.push(squareBadge(x + 320, y, 22, C.uFill, "U", C.uText));
  parts.push(
    `<text x="${x + 340}" y="${y}" dominant-baseline="central">Up / вход сигнала</text>`
  );
  // B.
  parts.push(squareBadge(x + 510, y, 22, C.bFill, "B", C.bText));
  parts.push(
    `<text x="${x + 530}" y="${y}" dominant-baseline="central">Backup</text>`
  );
  // Стойка.
  parts.push(
    `<rect x="${x + 620}" y="${y - 10}" width="20" height="20" fill="${C.leg}"/>`
  );
  parts.push(
    `<text x="${x + 650}" y="${y}" dominant-baseline="central">Опорная стойка</text>`
  );
  parts.push(`</g>`);
}

function buildTechLines(
  config: ProjectConfig,
  r: CalculatedResult,
  presetName: string,
  pixelPitch: string
): string[] {
  const lines: string[] = [];
  // Раньше здесь было «Пресет кабинета: …». Заменено на пользовательскую
  // терминологию: версия экрана + тип модуля.
  lines.push(`Версия экрана: ${pixelPitch}`);
  lines.push(`Модуль: ${presetName}`);
  lines.push(
    `Экран: ${stripZero(config.screenWidthMeters)}×${stripZero(config.screenHeightMeters)} м`
  );
  lines.push(`Количество экранов: ${config.screenCount}`);
  lines.push(`Модули на экран: ${r.cabinetCountX}×${r.cabinetCountY}`);
  lines.push(`Всего модулей на экран: ${r.totalCabinetsOneScreen}`);
  if (config.screenCount > 1) {
    lines.push(`Всего модулей на все: ${r.totalCabinetsAllScreens}`);
  }
  lines.push(`Разрешение экрана: ${r.resolutionX}×${r.resolutionY} px`);
  lines.push(
    `Пикселей на экран: ${r.totalPixelsOneScreen.toLocaleString("ru-RU")}`
  );
  if (config.screenCount > 1) {
    lines.push(
      `Пикселей всего: ${r.totalPixelsAllScreens.toLocaleString("ru-RU")}`
    );
  }
  lines.push(`Энергопотребление: ${formatKw(r.totalPowerKwOneScreen)}`);
  if (config.screenCount > 1) {
    lines.push(`Энергопотребление всего: ${formatKw(r.totalPowerKwAllScreens)}`);
  }
  lines.push(`Вес экрана: ${formatKg(r.totalWeightKgOneScreen)}`);
  if (config.screenCount > 1) {
    lines.push(`Вес всего: ${formatKg(r.totalWeightKgAllScreens)}`);
  }
  lines.push(`Порты NovaStar на экран: ${r.portsNeededOneScreen}`);
  if (config.screenCount > 1) {
    lines.push(`Порты всего: ${r.portsNeededAllScreens}`);
  }
  lines.push(`Макс. модулей на порт: ${r.maxCabinetsPerPort}`);
  lines.push(`Лимит порта: 650 000 px`);
  lines.push(`Ноги: ${r.legsCount}`);
  lines.push(`Вид: ${config.viewMode === "back" ? "сзади" : "спереди"}`);
  return lines;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
function stripZero(n: number) {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(parseFloat(n.toFixed(2)));
}
function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function wrapText(s: string, maxLen: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxLen) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur ? cur + " " : "") + w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
