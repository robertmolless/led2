/**
 * Построение SVG разметки схемы LED-экрана.
 *
 * Функция намеренно возвращает строку, а не JSX: эта же разметка идёт и в DOM
 * (через dangerouslySetInnerHTML), и в экспорт PNG/JPEG/PDF.
 */
import type { CalculatedResult, ProjectConfig, PortGroup, CabinetCell } from "../types";
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
const LEGS_GAP = 56;        // расстояние от низа сетки до центра «ноги»
const LEG_RADIUS = 18;
const TOP_LABEL_GAP = 56;
const LEFT_LABEL_GAP = 42;
const CABINET_LABEL_FONT = 14;
const BASE_LINE_W = 4;

interface BuildOptions {
  config: ProjectConfig;
  result: CalculatedResult;
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
  // примерно постоянная (1600 px видимой сетки), но не слишком крупная.
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
  // На референсе с видом спереди слева 1..20, на виде сзади тоже 1..24,
  // но цепочки сигнала рисуются с правильной стороны входа. Зеркалим только содержимое сетки.
  const flipX = config.viewMode === "front";

  // Координаты центра ячейки (row, col).
  // row=0 — нижний ряд. На SVG ось Y «вниз», поэтому нижний ряд имеет y = gridBottom - cellH/2.
  const cellCenter = (row: number, col: number) => {
    const visualCol = flipX ? nx - 1 - col : col;
    const cx = gridLeft + visualCol * cellW + cellW / 2;
    const cy = gridBottom - row * cellH - cellH / 2;
    return { cx, cy };
  };
  // Левая граница ячейки (для U/B блоков, размещаемых «прилипшими» к ряду слева/справа).
  const cellLeftCenter = (row: number, col: number) => {
    const visualCol = flipX ? nx - 1 - col : col;
    const cx = gridLeft + visualCol * cellW;
    const cy = gridBottom - row * cellH - cellH / 2;
    return { cx, cy };
  };
  const cellRightCenter = (row: number, col: number) => {
    const visualCol = flipX ? nx - 1 - col : col;
    const cx = gridLeft + visualCol * cellW + cellW;
    const cy = gridBottom - row * cellH - cellH / 2;
    return { cx, cy };
  };

  // === Накапливаем SVG-элементы. ===
  const parts: string[] = [];

  // Фон и рамка листа.
  parts.push(
    `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="${C.bg}"/>`
  );

  // Заголовок «Вид сзади / Вид спереди».
  const viewLabel = config.viewMode === "back" ? "Вид сзади" : "Вид спереди";
  parts.push(
    `<text x="${gridLeft + gridW / 2}" y="${PADDING + 28}" text-anchor="middle" font-family="system-ui, -apple-system, Arial" font-size="22" fill="${C.text}">${viewLabel}</text>`
  );

  // Подписи столбцов (сверху).
  for (let col = 0; col < nx; col++) {
    const visualCol = flipX ? nx - 1 - col : col;
    const cx = gridLeft + visualCol * cellW + cellW / 2;
    const labelY = gridTop - 14;
    // На больших сетках показываем не каждый номер, чтобы не сливалось.
    if (nx > 30 && col % 2 === 1) continue;
    parts.push(
      `<text x="${cx}" y="${labelY}" text-anchor="middle" font-family="system-ui" font-size="${CABINET_LABEL_FONT}" fill="${C.textMuted}">${col + 1}</text>`
    );
  }
  // Подписи строк (слева).
  for (let row = 0; row < ny; row++) {
    const cy = gridBottom - row * cellH - cellH / 2 + 5;
    const labelX = gridLeft - 18;
    parts.push(
      `<text x="${labelX}" y="${cy}" text-anchor="middle" font-family="system-ui" font-size="${CABINET_LABEL_FONT}" fill="${C.textMuted}">${row + 1}</text>`
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

  // Номера кабинетов внутри ячеек (если включено).
  if (config.showCabinetNumbers) {
    for (let row = 0; row < ny; row++) {
      for (let col = 0; col < nx; col++) {
        const { cx, cy } = cellCenter(row, col);
        parts.push(
          `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="system-ui" font-size="11" fill="${C.textMuted}">${row + 1}.${col + 1}</text>`
        );
      }
    }
  }

  // === Сигнал и питание — по портам. ===
  const portStrokeW = clamp(BASE_LINE_W, 2, 5);
  // Сдвиг линий питания и сигнала внутри ячейки относительно центра, чтобы не сливались.
  const signalOffset = -Math.min(cellH * 0.18, 12);
  const powerOffset = +Math.min(cellH * 0.18, 12);

  result.ports.forEach((port) => {
    drawPort(parts, port, {
      flipX,
      nx,
      cellCenter,
      cellLeftCenter,
      cellRightCenter,
      signalRoutingMode: config.signalRoutingMode,
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
      // Равномерно распределяем по ширине сетки.
      const t = legs === 1 ? 0.5 : i / (legs - 1);
      const lx = gridLeft + t * gridW;
      // Стойки — квадратные «башмаки» как на референсе.
      const size = LEG_RADIUS * 1.8;
      parts.push(
        `<rect x="${lx - size / 2}" y="${legY - size / 2}" width="${size}" height="${size}" fill="${C.leg}"/>`
      );
    }
  }

  // === Технический блок справа. ===
  const techLines = buildTechLines(config, result, preset.name);
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

  // Предупреждения (если есть) — красным под техблоком.
  if (result.warnings.length > 0) {
    parts.push(
      `<g font-family="system-ui" font-size="12" fill="${C.warn}">`
    );
    let wy = ty + 8;
    parts.push(
      `<text x="${techLeft}" y="${wy}" font-weight="700" fill="${C.warn}">Предупреждения:</text>`
    );
    wy += 18;
    result.warnings.slice(0, 6).forEach((w) => {
      // Лёгкий перенос длинных строк.
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
  cellCenter: (r: number, c: number) => { cx: number; cy: number };
  cellLeftCenter: (r: number, c: number) => { cx: number; cy: number };
  cellRightCenter: (r: number, c: number) => { cx: number; cy: number };
  signalRoutingMode: ProjectConfig["signalRoutingMode"];
  portStrokeW: number;
  signalOffset: number;
  powerOffset: number;
  backupEnabled: boolean;
  cellW: number;
  cellH: number;
  showPortNumbers: boolean;
}

function drawPort(parts: string[], port: PortGroup, ctx: DrawPortCtx) {
  if (port.cabinets.length === 0) return;
  const first = port.cabinets[0];
  const last = port.cabinets[port.cabinets.length - 1];

  // Центры для линии сигнала.
  const signalPoints = port.cabinets.map((c) => {
    const { cx, cy } = ctx.cellCenter(c.row, c.col);
    return { x: cx, y: cy + ctx.signalOffset };
  });
  // Центры для линии питания.
  const powerPoints = port.cabinets.map((c) => {
    const { cx, cy } = ctx.cellCenter(c.row, c.col);
    return { x: cx, y: cy + ctx.powerOffset };
  });

  const portColorOver = port.isOverLimit ? C.warn : null;

  // Сигнал.
  parts.push(
    `<polyline points="${signalPoints.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${portColorOver ?? C.signal}" stroke-width="${ctx.portStrokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  // Питание (смещение).
  parts.push(
    `<polyline points="${powerPoints.map((p) => `${round(p.x)},${round(p.y)}`).join(" ")}" fill="none" stroke="${C.power}" stroke-width="${ctx.portStrokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  // U — в начале цепочки. Размещаем «прилипшим» к стороне ряда.
  // Для horizontal_rows: U слева, B справа (если backup), как в референсе.
  // Для vertical_columns / snake_columns: U снизу, B сверху.
  const uSize = Math.min(ctx.cellH * 0.7, 36);

  let uX = 0, uY = 0, bX = 0, bY = 0;
  if (
    ctx.signalRoutingMode === "horizontal_rows" ||
    ctx.signalRoutingMode === "snake_rows"
  ) {
    // U на стороне, противоположной flipX-зеркалу: ставим у левого края первого кабинета.
    const fEdge = ctx.flipX ? ctx.cellRightCenter(first.row, first.col) : ctx.cellLeftCenter(first.row, first.col);
    uX = fEdge.cx - (ctx.flipX ? -uSize / 2 : uSize / 2);
    uY = fEdge.cy;
    const lEdge = ctx.flipX ? ctx.cellLeftCenter(last.row, last.col) : ctx.cellRightCenter(last.row, last.col);
    bX = lEdge.cx + (ctx.flipX ? -uSize / 2 : uSize / 2);
    bY = lEdge.cy;
  } else {
    // Вертикальные режимы: U снизу первого кабинета, B сверху последнего.
    const f = ctx.cellCenter(first.row, first.col);
    uX = f.cx;
    uY = f.cy + ctx.cellH / 2 + uSize / 2 + 2;
    const l = ctx.cellCenter(last.row, last.col);
    bX = l.cx;
    bY = l.cy - ctx.cellH / 2 - uSize / 2 - 2;
  }

  // Рисуем U.
  parts.push(squareBadge(uX, uY, uSize, C.uFill, "U", C.uText));

  // Номер порта рядом с U.
  if (ctx.showPortNumbers) {
    let labelX = uX;
    let labelY = uY + uSize * 0.9;
    let anchor = "middle";
    if (
      ctx.signalRoutingMode === "horizontal_rows" ||
      ctx.signalRoutingMode === "snake_rows"
    ) {
      labelX = ctx.flipX ? uX + uSize / 2 + 6 : uX - uSize / 2 - 6;
      labelY = uY + 4;
      anchor = ctx.flipX ? "start" : "end";
    }
    parts.push(
      `<text x="${labelX}" y="${labelY}" text-anchor="${anchor}" font-family="system-ui" font-size="13" fill="${C.text}" font-weight="600">P${port.portNumber}</text>`
    );
  }

  // B (только при включённом backup).
  if (ctx.backupEnabled) {
    parts.push(squareBadge(bX, bY, uSize, C.bFill, "B", C.bText));
  }
}

function squareBadge(cx: number, cy: number, size: number, fill: string, text: string, textColor: string): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  return `<g>
    <rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" fill="${fill}" stroke="${C.border}" stroke-width="1"/>
    <text x="${round(cx)}" y="${round(cy + size * 0.18)}" text-anchor="middle" font-family="system-ui" font-size="${round(size * 0.55)}" font-weight="700" fill="${textColor}">${text}</text>
  </g>`;
}

function drawLegend(parts: string[], x: number, y: number) {
  const items: Array<{ render: string; label: string }> = [
    {
      render: `<line x1="${x}" y1="${y}" x2="${x + 40}" y2="${y}" stroke="${C.power}" stroke-width="4"/>`,
      label: "Питание"
    },
    {
      render: `<line x1="${x + 160}" y1="${y}" x2="${x + 200}" y2="${y}" stroke="${C.signal}" stroke-width="4"/>`,
      label: "Сигнал"
    },
    {
      render: squareBadge(x + 320, y, 22, C.uFill, "U", C.uText),
      label: "Up / ввод сигнал"
    },
    {
      render: squareBadge(x + 480, y, 22, C.bFill, "B", C.bText),
      label: "Backup"
    },
    {
      render: `<rect x="${x + 600}" y="${y - 10}" width="20" height="20" fill="${C.leg}"/>`,
      label: "Опорная стойка"
    }
  ];
  parts.push(`<g font-family="system-ui" font-size="14" fill="${C.text}">`);
  parts.push(items[0].render);
  parts.push(`<text x="${x + 50}" y="${y + 5}">${items[0].label}</text>`);
  parts.push(items[1].render);
  parts.push(`<text x="${x + 210}" y="${y + 5}">${items[1].label}</text>`);
  parts.push(items[2].render);
  parts.push(`<text x="${x + 340}" y="${y + 5}">${items[2].label}</text>`);
  parts.push(items[3].render);
  parts.push(`<text x="${x + 500}" y="${y + 5}">${items[3].label}</text>`);
  parts.push(items[4].render);
  parts.push(`<text x="${x + 630}" y="${y + 5}">${items[4].label}</text>`);
  parts.push(`</g>`);
}

function buildTechLines(
  config: ProjectConfig,
  r: CalculatedResult,
  presetName: string
): string[] {
  const lines: string[] = [];
  lines.push(`Пресет кабинета: ${presetName}`);
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
  lines.push(`Макс. кабинетов на порт: ${r.maxCabinetsPerPort}`);
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
