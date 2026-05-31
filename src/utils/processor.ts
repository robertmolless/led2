import type { Processor, ProcessorRecommendation, ProjectResult } from "../types";
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
