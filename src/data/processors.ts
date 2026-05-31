import type { Processor } from "../types";

/**
 * База видеопроцессоров (контроллеров) NovaStar.
 *
 * Данные взяты из официальных мануалов:
 *  - VX600       — 6 портов, 3.9 млн px (мануал 600.pdf)
 *  - VX6s        — 6 портов, 3.9 млн px, all-in-one с видеопроцессором (6s.pdf)
 *  - VX1000      — 10 портов, 6.5 млн px (1000.pdf)
 *  - VX1000 Pro  — 10 портов, 6.5 млн px (расширенная версия VX1000)
 *  - VX2000 Pro  — 20 портов, 13 млн px (2000.pdf)
 *
 * У ВСЕХ гигабитных Ethernet-портов NovaStar лимит одного порта = 650 000 px
 * (при 8 бит). Полная ёмкость = portCount × 650 000.
 *
 * Чтобы добавить новый процессор — просто добавьте объект в массив.
 */
export const PROCESSORS: Processor[] = [
  {
    id: "vx600",
    name: "NovaStar VX600",
    portCount: 6,
    maxPixelsPerPort: 650_000,
    maxTotalPixels: 3_900_000,
    maxWidth: 10_240,
    maxHeight: 8_192,
    hasVideoProcessing: true,
    note: "6 портов, all-in-one. Базовый контроллер для небольших экранов."
  },
  {
    id: "vx6s",
    name: "NovaStar VX6s",
    portCount: 6,
    maxPixelsPerPort: 650_000,
    maxTotalPixels: 3_900_000,
    maxWidth: 10_240,
    maxHeight: 8_192,
    hasVideoProcessing: true,
    note: "6 портов, all-in-one с мощным видеопроцессором (10 видеовходов)."
  },
  {
    id: "vx1000",
    name: "NovaStar VX1000",
    portCount: 10,
    maxPixelsPerPort: 650_000,
    maxTotalPixels: 6_500_000,
    maxWidth: 10_240,
    maxHeight: 8_192,
    hasVideoProcessing: true,
    note: "10 портов, 6.5 млн px. Рабочая лошадка для средних экранов."
  },
  {
    id: "vx1000pro",
    name: "NovaStar VX1000 Pro",
    portCount: 10,
    maxPixelsPerPort: 650_000,
    maxTotalPixels: 6_500_000,
    maxWidth: 10_240,
    maxHeight: 8_192,
    hasVideoProcessing: true,
    note: "10 портов, расширенная обработка по сравнению с VX1000."
  },
  {
    id: "vx2000pro",
    name: "NovaStar VX2000 Pro",
    portCount: 20,
    maxPixelsPerPort: 650_000,
    maxTotalPixels: 13_000_000,
    maxWidth: 16_384,
    maxHeight: 8_192,
    hasVideoProcessing: true,
    note: "20 портов, 13 млн px. Для больших экранов и сложных сцен."
  }
];

/** Процессоры от меньшего к большему — для подбора «минимально достаточного». */
export const PROCESSORS_BY_CAPACITY = [...PROCESSORS].sort(
  (a, b) => a.maxTotalPixels - b.maxTotalPixels || a.portCount - b.portCount
);

export function getProcessorById(id: string): Processor | undefined {
  return PROCESSORS.find((p) => p.id === id);
}

/** Лимит одного порта общий для всех (650k). Берём из первого процессора. */
export const PORT_PIXEL_LIMIT = 650_000;
