import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  value: number;
  onChange: (n: number) => void;
  /** Целое число (шаг 1, цифровая клавиатура без точки). */
  integer?: boolean;
  /** Минимум — применяется только при потере фокуса, чтобы не мешать вводу. */
  min?: number;
  /** Максимум — применяется при потере фокуса. */
  max?: number;
  /** Подсказка под полем. */
  hint?: string;
}

/** Преобразует число в строку для отображения (русская запятая для дробей). */
function toText(n: number, integer?: boolean): string {
  if (!isFinite(n)) return "";
  if (integer) return String(Math.round(n));
  // Дроби показываем с запятой, целые — без хвоста.
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

/**
 * Числовое поле, корректно работающее на iOS/Android:
 *  - принимает И запятую, И точку как десятичный разделитель;
 *  - не «съедает» промежуточный ввод («1,» / «1.» / пустую строку);
 *  - font-size 16px (см. styles.css) — iOS не зумит при фокусе;
 *  - inputMode даёт нужную клавиатуру (цифровую/десятичную).
 */
export function NumericField({ label, value, onChange, integer, min, max, hint }: Props) {
  const [text, setText] = useState(() => toText(value, integer));
  const focusedRef = useRef(false);

  // Если значение изменилось извне (загрузка проекта, «Новый») и поле не в
  // фокусе — синхронизируем отображаемый текст.
  useEffect(() => {
    if (!focusedRef.current) setText(toText(value, integer));
  }, [value, integer]);

  const parse = (raw: string): number | null => {
    const normalized = raw.replace(",", ".").trim();
    if (normalized === "" || normalized === "." || normalized === "-") return null;
    const n = integer ? parseInt(normalized, 10) : parseFloat(normalized);
    return isNaN(n) ? null : n;
  };

  const handleChange = (raw: string) => {
    let cleaned: string;
    if (integer) {
      cleaned = raw.replace(/[^\d]/g, "");
    } else {
      // Оставляем цифры и разделители, затем удерживаем только ПЕРВЫЙ разделитель
      // (последующие точки/запятые отбрасываем, цифры сохраняем).
      const s = raw.replace(/[^\d.,]/g, "");
      const firstSep = s.search(/[.,]/);
      cleaned =
        firstSep === -1
          ? s
          : s.slice(0, firstSep + 1) + s.slice(firstSep + 1).replace(/[.,]/g, "");
    }
    setText(cleaned);
    const n = parse(cleaned);
    if (n !== null) onChange(n);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    let n = parse(text);
    if (n === null) n = value; // пустое поле — откатываемся к текущему значению
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    onChange(n);
    setText(toText(n, integer));
  };

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        enterKeyHint="done"
        autoComplete="off"
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
