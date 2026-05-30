import type { CabinetCell, PortGroup, SideName, SignalRoutingMode } from "../types";

/**
 * Группирует кабинеты по портам NovaStar в соответствии с выбранным режимом
 * разводки и стороной ввода сигнала.
 *
 * Соглашение: row=0 — нижний ряд (как на инженерных схемах в референсах,
 * где «1» снизу). col=0 — левый столбец.
 *
 * - horizontal_rows: каждый ряд — отдельная цепочка.
 *     Если signalInputSide ∈ {left,bottom} — старт снизу, ряд идёт L→R.
 *     Если signalInputSide = right            — старт снизу, ряд идёт R→L.
 *     Если signalInputSide = top              — старт сверху, ряд идёт L→R.
 *   Если в ряду больше maxPerPort кабинетов — ряд разбивается на несколько портов.
 * - snake_rows: ряды идут змейкой. Первый ряд — в направлении, заданном
 *   стороной ввода (left→R, right→L); следующий ряд в обратную сторону.
 *   Между рядами не «разрывается», набивается до maxPerPort.
 * - vertical_columns: каждая колонка — отдельная цепочка.
 *     bottom/left → колонка идёт B→T снизу-вверх;
 *     top         → колонка идёт T→B сверху-вниз;
 *     right       → колонки идут справа-налево, каждая B→T.
 * - snake_columns: колонки змейкой по аналогии со snake_rows.
 */
export function buildPortGroups(
  cabinets: CabinetCell[],
  countX: number,
  countY: number,
  maxPerPort: number,
  pixelsPerCabinet: number,
  maxPixelsPerPort: number,
  mode: SignalRoutingMode,
  signalInputSide: SideName
): PortGroup[] {
  if (countX === 0 || countY === 0) return [];

  // Индекс быстрого доступа.
  const cellAt = (row: number, col: number): CabinetCell | undefined =>
    cabinets.find((c) => c.row === row && c.col === col);

  // Параметры старта.
  // Для горизонтальных режимов первичен «лево/право» (направление ряда),
  // для вертикальных — «верх/низ» (направление колонки).
  const rightToLeft = signalInputSide === "right";
  const topToBottom = signalInputSide === "top";

  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  const rangeRev = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);

  const sequence: CabinetCell[] = [];
  const hardBreakBefore = new Set<number>();

  switch (mode) {
    case "horizontal_rows": {
      // Порядок прохода рядов: снизу-вверх по умолчанию, сверху-вниз если ввод сверху.
      const rowOrder = topToBottom ? rangeRev(countY) : range(countY);
      // Направление внутри ряда: R→L если ввод справа, иначе L→R.
      const colOrder = rightToLeft ? rangeRev(countX) : range(countX);
      for (const row of rowOrder) {
        if (sequence.length > 0) hardBreakBefore.add(sequence.length);
        for (const col of colOrder) {
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      }
      break;
    }
    case "snake_rows": {
      const rowOrder = topToBottom ? rangeRev(countY) : range(countY);
      rowOrder.forEach((row, idx) => {
        // Первый ряд идёт в «базовом» направлении (зависит от ввода);
        // нечётные — в обратном.
        const reverse = idx % 2 === 1;
        const baseRightToLeft = rightToLeft;
        const goRightToLeft = reverse ? !baseRightToLeft : baseRightToLeft;
        const colOrder = goRightToLeft ? rangeRev(countX) : range(countX);
        for (const col of colOrder) {
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      });
      break;
    }
    case "vertical_columns": {
      // Колонки: слева-направо или справа-налево.
      const colOrder = rightToLeft ? rangeRev(countX) : range(countX);
      // Внутри колонки: снизу-вверх или сверху-вниз.
      const rowOrder = topToBottom ? rangeRev(countY) : range(countY);
      for (const col of colOrder) {
        if (sequence.length > 0) hardBreakBefore.add(sequence.length);
        for (const row of rowOrder) {
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      }
      break;
    }
    case "snake_columns": {
      const colOrder = rightToLeft ? rangeRev(countX) : range(countX);
      colOrder.forEach((col, idx) => {
        const reverse = idx % 2 === 1;
        const baseTopToBottom = topToBottom;
        const goTopToBottom = reverse ? !baseTopToBottom : baseTopToBottom;
        const rowOrder = goTopToBottom ? rangeRev(countY) : range(countY);
        for (const row of rowOrder) {
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      });
      break;
    }
  }

  // Делим sequence на группы по maxPerPort, учитывая hardBreakBefore.
  const ports: PortGroup[] = [];
  let current: CabinetCell[] = [];
  let portNumber = 1;

  const flush = () => {
    if (current.length === 0) return;
    const pixels = current.length * pixelsPerCabinet;
    ports.push({
      portNumber: portNumber++,
      cabinets: current,
      pixels,
      loadPercent: (pixels / maxPixelsPerPort) * 100,
      isOverLimit: pixels > maxPixelsPerPort
    });
    current = [];
  };

  sequence.forEach((c, idx) => {
    if (hardBreakBefore.has(idx) && current.length > 0) {
      flush();
    }
    if (current.length >= maxPerPort) {
      flush();
    }
    current.push(c);
  });
  flush();

  return ports;
}
