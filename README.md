# LED Scheme Builder

Офлайн PWA для автоматического построения технических схем LED-экранов.
Пользователь вводит только размеры экрана и количество экранов — приложение
само считает кабинеты, разрешение, мощность, вес, порты NovaStar и рисует
готовую SVG-схему в стиле инженерного чертежа.

Реализован базовый MVP на пресете **P2.6** (0.5×0.5 и 1×0.5), архитектура
рассчитана на дальнейшее расширение (P3, P3.9, P4, кастомные пресеты,
секционные L/C/R экраны, ручное редактирование цепочек портов).

- **Без сервера и backend.** Все расчёты в браузере.
- **Без авторизации, без БД, без платных API.**
- **Работает офлайн** после первой загрузки.
- **PWA** — можно «Добавить на экран Домой» на iPhone.
- **Деплой одной кнопкой** на GitHub Pages.

---

## Содержание

1. [Запуск локально](#1-запуск-локально)
2. [Сборка production-билда](#2-сборка-production-билда)
3. [Проверка PWA](#3-проверка-pwa)
4. [Деплой на GitHub Pages](#4-деплой-на-github-pages)
5. [Открытие на iPhone и установка на экран «Домой»](#5-открытие-на-iphone)
6. [Проверка офлайн-режима](#6-проверка-офлайн-режима)
7. [Архитектура проекта](#7-архитектура-проекта)
8. [Расширение: новые пресеты](#8-расширение-новые-пресеты)

---

## 1. Запуск локально

Понадобится Node.js 18+ и npm.

```bash
git clone https://github.com/<your-user>/<your-repo>.git
cd <your-repo>
npm install
npm run dev
```

Откроется http://localhost:5173.

В режиме dev service worker НЕ регистрируется в браузере как PWA (это
сделано специально, чтобы dev-перезагрузки не кэшировались). PWA проверяется
на production-сборке — см. ниже.

---

## 2. Сборка production-билда

```bash
npm run build
npm run preview
```

`npm run build` соберёт SPA в каталог `dist/`.
`npm run preview` поднимет статический сервер на http://localhost:4173 и
позволит проверить готовую сборку локально.

Если вы публикуете под подкаталог (типичный случай GitHub Pages —
`https://user.github.io/repo/`), укажите имя репозитория через переменную
окружения `REPO_NAME` при сборке:

```bash
REPO_NAME=led-screen-builder npm run build
```

Это превратит base path сборки в `/led-screen-builder/`. На локальном
preview можно проверить с тем же REPO_NAME.

> **Зачем это нужно.** Если оставить base = `/`, GitHub Pages не найдёт
> JS/CSS, потому что они будут запрашиваться по `/assets/...` вместо
> `/repo/assets/...`. Поэтому `vite.config.ts` читает `REPO_NAME` из env.

---

## 3. Проверка PWA

1. Соберите production-билд: `npm run build`.
2. Поднимите preview: `npm run preview`.
3. Откройте http://localhost:4173 в Chrome или Safari.
4. В DevTools → **Application** → **Service Workers** должен быть
   зарегистрирован `service-worker.js`.
5. В **Application** → **Manifest** должны корректно загрузиться название,
   иконки 192/512, theme_color.
6. В **Lighthouse** → запустить аудит PWA — должно пройти.

---

## 4. Деплой на GitHub Pages

### Вариант А: автоматический деплой через GitHub Actions (рекомендуемый)

В репозитории уже есть `.github/workflows/deploy.yml`. Что нужно сделать:

1. Создайте репозиторий на GitHub.
2. Запушьте проект:
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
3. В настройках репозитория: **Settings → Pages → Build and deployment →
   Source: GitHub Actions**.
4. Каждый push в `main` будет автоматически собирать сайт и публиковать
   его на `https://<user>.github.io/<repo>/`.

Workflow сам подставит `REPO_NAME = <repo>` в build, так что base path
получится правильным без ручной настройки.

### Вариант Б: ручной деплой через ветку `gh-pages`

```bash
REPO_NAME=<repo> npm run build
# скопировать содержимое dist/ в gh-pages ветку любым удобным способом,
# например с помощью пакета gh-pages или вручную.
```

После этого в **Settings → Pages → Source: Deploy from a branch**, выбрать
`gh-pages` / `/ (root)`.

---

## 5. Открытие на iPhone

Чтобы установить приложение на iPhone как PWA:

1. Откройте сайт `https://<user>.github.io/<repo>/` в **Safari** (важно — не в
   Chrome).
2. Подождите, пока сайт полностью загрузится.
3. Нажмите кнопку **Поделиться** (квадрат со стрелкой вверх).
4. Прокрутите вниз и выберите **На экран «Домой»** (Add to Home Screen).
5. Подтвердите имя «LED Builder» и нажмите **Добавить**.
6. На рабочем столе появится иконка LED Builder.
7. Запускайте приложение с этой иконки — оно откроется в standalone-режиме
   (без адресной строки), как обычное приложение.

---

## 6. Проверка офлайн-режима

После первого открытия service worker кэширует ассеты:

1. Запустите приложение хотя бы один раз с интернетом.
2. Включите **Авиарежим** на iPhone (или отключите Wi-Fi/3G).
3. Откройте приложение с экрана «Домой».
4. Приложение должно открыться, считать схемы и экспортировать PDF/PNG/JPEG
   полностью офлайн.

В Chrome это проверяется в DevTools → **Network → Offline**.

> При новом релизе сайт обновится автоматически при следующем онлайн-открытии
> благодаря network-first стратегии для навигационных запросов.

---

## 7. Архитектура проекта

```
src/
  main.tsx                # точка входа, регистрирует SW
  App.tsx                 # корневой компонент, состояние и тулбар
  types.ts                # все доменные TypeScript-типы
  styles.css              # стили mobile-first
  data/
    cabinetPresets.ts     # пресеты P2.6 (расширяемо)
  utils/
    calculations.ts       # расчёты кабинетов/портов/мощности
    routing.ts            # группировка кабинетов по портам (4 режима)
    svgBuilder.ts         # построение SVG-схемы
    exportPdf.ts          # экспорт PDF (jsPDF)
    exportPng.ts          # экспорт PNG
    exportJpeg.ts         # экспорт JPEG
    raster.ts             # общий SVG→Canvas→Blob
    storage.ts            # localStorage для проектов
    defaults.ts           # дефолтная конфигурация
  components/
    AppShell.tsx          # каркас layout
    InputPanel.tsx        # параметры
    ResultsPanel.tsx      # сводка
    SchemeSvg.tsx         # рендер SVG в DOM
    ProjectManager.tsx    # модалка проектов
    Warnings.tsx          # вывод предупреждений

public/
  manifest.webmanifest    # PWA-манифест
  service-worker.js       # SW: precache + stale-while-revalidate
  .nojekyll               # отключение Jekyll на GitHub Pages
  icons/                  # иконки 192/512/maskable

.github/workflows/deploy.yml   # автодеплой на GitHub Pages
vite.config.ts                  # base из REPO_NAME
```

### Ключевые формулы (см. `utils/calculations.ts`)

```
cabinetCountX           = floor(screenWidthMeters / cabinetWidthMeters)
cabinetCountY           = floor(screenHeightMeters / cabinetHeightMeters)
totalCabinetsOneScreen  = cabinetCountX * cabinetCountY
totalCabinetsAllScreens = totalCabinetsOneScreen * screenCount

pixelsPerCabinet        = cabinetPixelWidth * cabinetPixelHeight
resolutionX             = cabinetCountX * cabinetPixelWidth
resolutionY             = cabinetCountY * cabinetPixelHeight
totalPixelsOneScreen    = totalCabinetsOneScreen * pixelsPerCabinet

maxCabinetsPerPort      = floor(maxPixelsPerPort / pixelsPerCabinet)
portsNeededOneScreen    = (см. routing.ts — с учётом режима разводки)

totalPowerWattsOneScreen = totalCabinetsOneScreen * cabinetPowerWatts
totalWeightKgOneScreen   = totalCabinetsOneScreen * cabinetWeightKg

portLoadPixels  = cabinetsInPort * pixelsPerCabinet
portLoadPercent = portLoadPixels / maxPixelsPerPort * 100
```

### Контрольные расчёты

Для **P2.6 0.5×0.5** и экрана 12×5 м:

| Параметр | Значение |
|---|---|
| Кабинеты | 24×10 = 240 |
| Разрешение | 4608×1920 |
| Порты | 15 |
| Макс. на порт | 17 |
| Мощность | 30 кВт |
| Вес | 1656 кг |

Для **P2.6 1×0.5** и экрана 12×5 м:

| Параметр | Значение |
|---|---|
| Кабинеты | 12×10 = 120 |
| Разрешение | 4608×1920 |
| Порты | 15 |
| Макс. на порт | 8 |
| Мощность | 30 кВт |
| Вес | 1440 кг |

---

## 8. Расширение: новые пресеты

Чтобы добавить новый пресет (P3, P3.9, P4, или произвольный), просто
добавьте объект в `src/data/cabinetPresets.ts`:

```ts
{
  id: "p3-0.5x0.5",
  name: "P3 0.5×0.5",
  pixelPitch: "P3",
  widthMeters: 0.5,
  heightMeters: 0.5,
  pixelWidth: 168,    // например
  pixelHeight: 168,
  powerWatts: 110,
  weightKg: 7,
  maxPixelsPerPort: 650_000,
  orientable: false
}
```

UI автоматически подхватит пресет в выпадающем списке, формулы расчёта
не меняются.

### Что ещё предусмотрено архитектурой

- Несколько режимов разводки сигнала (`horizontal_rows`, `snake_rows`,
  `vertical_columns`, `snake_columns`) — `utils/routing.ts`.
- Раздельная отрисовка линий сигнала и питания (со смещением, чтобы не
  сливались) — `utils/svgBuilder.ts`.
- Вид сзади / спереди (зеркалирование по X) — реализовано.
- Backup-точки `B` опционально — есть.
- Экспорт PDF (jsPDF, A4/A3 landscape), PNG (2×), JPEG — есть.
- Хранение нескольких проектов в localStorage с дублированием и удалением.
- Архитектура подготовлена для будущего:
  - секционные экраны L/C/R/LL/RR/CENTER (отдельная конфигурация секций);
  - ручное перетаскивание U/B (включить click-handler по SVG);
  - ручное редактирование цепочек портов (хранить дополнительный override
    поверх auto-routing);
  - разные процессоры NovaStar — поле `maxPixelsPerPort` уже в пресете;
  - экспорт/импорт JSON проекта (тривиально через `storage.ts`).

---

## Лицензия

Внутренний инструмент. Свободно используйте, модифицируйте и распространяйте.
