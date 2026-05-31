import type {
  Processor,
  ProcessorRecommendation,
  ProjectResult,
  ProjectConfig,
  PatchPlan,
  ProcessorUnit,
  ScreenPatch,
  ScreenResult,
  SignalRoutingMode,
  SideName
} from "../types";
import { PROCESSORS_BY_CAPACITY, getProcessorById } from "../data/processors";

/**
 * Подбор процессора под рассчитанный проект.
 *
 * Логика «как думают мозги»:
 *  Контроллер должен одновременно:
 *   1) иметь портов НЕ МЕНЬШЕ, чем требуется под сигнал (totalPorts);
 *   2) тянуть суммарное число пикселей (totalPixels ≤ maxTotalPixels);
 *   3) укладываться в макс. ширину/высоту канвы (combinedResolution).
 *
 *  Берём минимально достаточный (самый дешёвый/младший) процессор из списка,
 *  отсортированного по ёмкости. Если ни один не тянет в одиночку — сообщаем,
 *  сколько штук понадобится (каскад/несколько контроллеров).
 */
export function recommendProcessor(result: ProjectResult): ProcessorRecommendation {
  const needPorts = result.totalPorts;
  const needPixels = result.totalPixels;
  const needW = result.combinedResolutionX;
  const needH = result.combinedResolutionY;

  const reasons: string[] = [];

  const fits = (p: Processor) =>
    p.portCount >= needPorts &&
    p.maxTotalPixels >= needPixels &&
    p.maxWidth >= needW &&
    p.maxHeight >= needH;

  const chosen = PROCESSORS_BY_CAPACITY.find(fits);

  if (chosen) {
    reasons.push(
      `Нужно портов: ${needPorts}. У ${chosen.name} — ${chosen.portCount} порт(ов). ✔`
    );
    reasons.push(
      `Нужно пикселей: ${needPixels.toLocaleString("ru-RU")}. Ёмкость ${chosen.name}: ${chosen.maxTotalPixels.toLocaleString("ru-RU")}. ✔`
    );
    reasons.push(
      `Канва ${needW}×${needH} укладывается в макс. ${chosen.maxWidth}×${chosen.maxHeight}. ✔`
    );
    const headroomPx = Math.round((1 - needPixels / chosen.maxTotalPixels) * 100);
    const headroomPorts = chosen.portCount - needPorts;
    reasons.push(
      `Запас: ${headroomPx}% по пикселям, ${headroomPorts} свободных порт(ов).`
    );
    return {
      processor: chosen,
      unitsNeeded: 1,
      fits: true,
      reasons
    };
  }

  // Ни один не тянет в одиночку — берём самый мощный и считаем количество.
  const top = PROCESSORS_BY_CAPACITY[PROCESSORS_BY_CAPACITY.length - 1];
  const unitsByPorts = Math.ceil(needPorts / top.portCount);
  const unitsByPixels = Math.ceil(needPixels / top.maxTotalPixels);
  const unitsNeeded = Math.max(unitsByPorts, unitsByPixels, 1);

  reasons.push(
    `Ни один контроллер не тянет проект в одиночку.`
  );
  reasons.push(
    `Требуется портов ${needPorts}, пикселей ${needPixels.toLocaleString("ru-RU")}.`
  );
  reasons.push(
    `Рекомендуется ${unitsNeeded}× ${top.name} (по ${top.portCount} порт., ${top.maxTotalPixels.toLocaleString("ru-RU")} px каждый).`
  );
  if (needW > top.maxWidth || needH > top.maxHeight) {
    reasons.push(
      `Внимание: канва ${needW}×${needH} превышает макс. ${top.maxWidth}×${top.maxHeight} даже у топового — нужна разбивка на зоны.`
    );
  }

  return {
    processor: top,
    unitsNeeded,
    fits: false,
    reasons
  };
}

/**
 * Готовит данные процессора для отображения, учитывая ручной выбор.
 * Если processorMode === "manual" и id валиден — возвращает выбранный вручную
 * процессор, но всё равно считает, влезает ли проект (для предупреждений).
 */
export function resolveProcessor(
  result: ProjectResult,
  mode: "auto" | "manual",
  manualId: string
): ProcessorRecommendation {
  if (mode === "manual") {
    const p = getProcessorById(manualId);
    if (p) {
      const needPorts = result.totalPorts;
      const needPixels = result.totalPixels;
      const fitsPorts = p.portCount >= needPorts;
      const fitsPixels = p.maxTotalPixels >= needPixels;
      const fitsCanvas = p.maxWidth >= result.combinedResolutionX && p.maxHeight >= result.combinedResolutionY;
      const reasons: string[] = [];
      reasons.push(`Выбран вручную: ${p.name}.`);
      reasons.push(
        `Порты: нужно ${needPorts}, есть ${p.portCount}. ${fitsPorts ? "✔" : "✘ не хватает!"}`
      );
      reasons.push(
        `Пиксели: нужно ${needPixels.toLocaleString("ru-RU")}, ёмкость ${p.maxTotalPixels.toLocaleString("ru-RU")}. ${fitsPixels ? "✔" : "✘ перегруз!"}`
      );
      reasons.push(
        `Канва ${result.combinedResolutionX}×${result.combinedResolutionY} / макс. ${p.maxWidth}×${p.maxHeight}. ${fitsCanvas ? "✔" : "✘"}`
      );
      const unitsByPorts = Math.ceil(needPorts / p.portCount);
      const unitsByPixels = Math.ceil(needPixels / p.maxTotalPixels);
      const unitsNeeded = Math.max(unitsByPorts, unitsByPixels, 1);
      if (unitsNeeded > 1) {
        reasons.push(`Чтобы покрыть проект, потребуется ${unitsNeeded}× ${p.name}.`);
      }
      return {
        processor: p,
        unitsNeeded,
        fits: fitsPorts && fitsPixels && fitsCanvas,
        reasons
      };
    }
  }
  return recommendProcessor(result);
}

// ===========================================================================
//  ПАТЧ-ПЛАН: группировка экранов по процессорам (упаковка по ресурсам портов)
// ===========================================================================

/** Сколько портов нужно экрану: UP + (опц.) BACKUP. */
function screenPortsNeeded(s: ScreenResult, backup: boolean): number {
  return s.portsNeeded * (backup ? 2 : 1);
}

/** Словесное описание обхода: «Слева направо снизу вверх» и т.п. */
function routingWords(mode: SignalRoutingMode, side: SideName): string {
  const horiz = side === "right" ? "справа налево" : "слева направо";
  const vert = side === "top" ? "сверху вниз" : "снизу вверх";
  const rowBased = mode === "horizontal_rows" || mode === "snake_rows";
  const phrase = rowBased ? `${horiz} ${vert}` : `${vert} ${horiz}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

interface Bin {
  processor: Processor;
  screens: ScreenResult[];
  ports: number;
  pixels: number;
}

/** Наименьшая модель, вмещающая экран по портам/пикселям/канве. */
function smallestModelFor(ports: number, pixels: number, w: number, h: number): Processor | undefined {
  return PROCESSORS_BY_CAPACITY.find(
    (p) => p.portCount >= ports && p.maxTotalPixels >= pixels && p.maxWidth >= w && p.maxHeight >= h
  );
}

/**
 * Строит патч-план: раскидывает экраны по процессорам, упаковывая по ресурсам
 * (порты + пиксели).
 *
 *  - AUTO: модель подбирается ПОД КАЖДЫЙ процессор отдельно (могут быть разные).
 *    Экраны идут от тяжёлого к лёгкому; каждый пытается влезть в уже открытый
 *    процессор (по его ёмкости), иначе открывается новый с минимально
 *    достаточной моделью. Так центр уезжает на крупный процессор, а боковые —
 *    на свои поменьше.
 *  - MANUAL: для ВСЕХ юнитов используется одна выбранная модель.
 *
 * Нумерация портов внутри юнита: сначала UP по всем экранам, затем BACKUP.
 */
export function buildPatchPlan(config: ProjectConfig, result: ProjectResult): PatchPlan {
  const backup = config.backupEnabled;
  const warnings: string[] = [];
  const manualModel = config.processorMode === "manual" ? getProcessorById(config.processorId) : undefined;

  const top = PROCESSORS_BY_CAPACITY[PROCESSORS_BY_CAPACITY.length - 1];

  // Экраны от тяжёлого к лёгкому (по портам) для эффективной упаковки,
  // но сохраняем исходный индекс для стабильной нумерации внутри юнита.
  const indexed = result.screens.map((s, i) => ({ s, i }));
  const order = [...indexed].sort(
    (a, b) => screenPortsNeeded(b.s, backup) - screenPortsNeeded(a.s, backup)
  );

  const bins: Bin[] = [];

  for (const { s } of order) {
    const need = screenPortsNeeded(s, backup);
    const px = s.totalPixels;

    // Пытаемся подсадить в существующий юнит (по его модели).
    const fitBin = bins.find(
      (b) =>
        b.ports + need <= b.processor.portCount &&
        b.pixels + px <= b.processor.maxTotalPixels
    );
    if (fitBin) {
      fitBin.screens.push(s);
      fitBin.ports += need;
      fitBin.pixels += px;
      continue;
    }

    // Новый юнит: модель = выбранная вручную, либо минимально достаточная.
    let model = manualModel ?? smallestModelFor(need, px, s.resolutionX, s.resolutionY);
    if (!model) {
      model = manualModel ?? top;
      warnings.push(
        `Экран «${s.name}» требует ${need} порт(ов)/${px.toLocaleString("ru-RU")} px — ` +
          `больше, чем у ${model.name} (${model.portCount} порт., ${model.maxTotalPixels.toLocaleString("ru-RU")} px). Нужна разбивка/каскад.`
      );
    }
    bins.push({ processor: model, screens: [s], ports: need, pixels: px });
  }

  // Сортируем юниты по исходному порядку их первого экрана — стабильный вывод.
  const idxOf = (id: string) => result.screens.findIndex((s) => s.id === id);
  bins.sort((a, b) => idxOf(a.screens[0].id) - idxOf(b.screens[0].id));

  const units: ProcessorUnit[] = [];
  const perScreen: Record<string, ScreenPatch> = {};

  bins.forEach((bin, i) => {
    const index = i + 1;
    const model = bin.processor;
    const overflow = bin.ports > model.portCount || bin.pixels > model.maxTotalPixels;

    // Внутри юнита экраны — в исходном порядке (для предсказуемой нумерации).
    const binScreens = [...bin.screens].sort((a, b) => idxOf(a.id) - idxOf(b.id));

    let upCounter = 1;
    const upRanges = new Map<string, number[]>();
    for (const s of binScreens) {
      const n = s.portsNeeded;
      upRanges.set(s.id, Array.from({ length: n }, (_, k) => upCounter + k));
      upCounter += n;
    }
    let bkCounter = upCounter;
    const bkRanges = new Map<string, number[]>();
    if (backup) {
      for (const s of binScreens) {
        const n = s.portsNeeded;
        bkRanges.set(s.id, Array.from({ length: n }, (_, k) => bkCounter + k));
        bkCounter += n;
      }
    }

    binScreens.forEach((s) => {
      perScreen[s.id] = {
        unitIndex: index,
        processorName: model.name,
        routingText: routingWords(s.signalRoutingMode, s.signalInputSide),
        upPorts: upRanges.get(s.id) ?? [],
        backupPorts: bkRanges.get(s.id) ?? [],
        mode: "PIXEL TO PIXEL FULL SCALE",
        edid: `${s.resolutionX}×${s.resolutionY}`
      };
    });

    units.push({
      index,
      processor: model,
      screenIds: binScreens.map((s) => s.id),
      screenNames: binScreens.map((s) => s.name),
      usedPorts: bin.ports,
      usedPixels: bin.pixels,
      overflow
    });
  });

  // Модель «по умолчанию» для сводки — самая крупная среди использованных.
  const model =
    units.length > 0
      ? units.map((u) => u.processor).sort((a, b) => b.maxTotalPixels - a.maxTotalPixels)[0]
      : manualModel ?? top;

  return { units, model, perScreen, warnings };
}

/** Краткий формат списка портов: [1,2,3,4,5,6] → "1-6", [1,2] → "1/2". */
export function formatPorts(ports: number[]): string {
  if (ports.length === 0) return "—";
  const consecutive = ports.every((p, i) => i === 0 || p === ports[i - 1] + 1);
  if (consecutive && ports.length > 2) return `${ports[0]}-${ports[ports.length - 1]}`;
  return ports.join("/");
}
