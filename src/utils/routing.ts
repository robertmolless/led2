import type { CabinetCell, PortGroup, SignalRoutingMode } from "../types";

/**
 * Группирует кабинеты по портам NovaStar в соответствии с выбранным режимом разводки.
 *
 * Соглашение: row=0 — нижний ряд (как на инженерных схемах в референсах,
 * где «1» снизу). col=0 — левый столбец.
 *
 * - horizontal_rows: каждый ряд — отдельная цепочка, все идут слева направо.
 *   Если в ряду больше maxPerPort кабинетов — ряд разбивается на несколько портов.
 * - snake_rows: чётные ряды слева→направо, нечётные справа→налево.
 *   Между рядами не «разрывается», набивается до maxPerPort.
 * - vertical_columns: каждая колонка — отдельная цепочка снизу вверх.
 * - snake_columns: колонки змейкой (1-я снизу вверх, 2-я сверху вниз, …).
 */
export function buildPortGroups(
  cabinets: CabinetCell[],
  countX: number,
  countY: number,
  maxPerPort: number,
  pixelsPerCabinet: number,
  maxPixelsPerPort: number,
  mode: SignalRoutingMode
): PortGroup[] {
  if (countX === 0 || countY === 0) return [];

  // Создаём индекс быстрого доступа: cellAt(row, col).
  const cellAt = (row: number, col: number): CabinetCell | undefined =>
    cabinets.find((c) => c.row === row && c.col === col);

  // Получаем последовательность кабинетов в порядке прохода и список «жёстких разрывов» —
  // позиций, на которых новый кабинет ДОЛЖЕН начать новый порт (например когда мы
  // переходим на следующий ряд в режиме horizontal_rows).
  const sequence: CabinetCell[] = [];
  const hardBreakBefore = new Set<number>(); // индексы в sequence

  switch (mode) {
    case "horizontal_rows": {
      for (let row = 0; row < countY; row++) {
        const rowStart = sequence.length;
        if (rowStart > 0) hardBreakBefore.add(rowStart);
        for (let col = 0; col < countX; col++) {
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      }
      break;
    }
    case "snake_rows": {
      for (let row = 0; row < countY; row++) {
        const leftToRight = row % 2 === 0;
        for (let i = 0; i < countX; i++) {
          const col = leftToRight ? i : countX - 1 - i;
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      }
      break;
    }
    case "vertical_columns": {
      for (let col = 0; col < countX; col++) {
        const colStart = sequence.length;
        if (colStart > 0) hardBreakBefore.add(colStart);
        for (let row = 0; row < countY; row++) {
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      }
      break;
    }
    case "snake_columns": {
      for (let col = 0; col < countX; col++) {
        const bottomToTop = col % 2 === 0;
        for (let i = 0; i < countY; i++) {
          const row = bottomToTop ? i : countY - 1 - i;
          const c = cellAt(row, col);
          if (c) sequence.push(c);
        }
      }
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
