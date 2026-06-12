# Инструкции для ИИ-Агента (Разработчик)

## Контекст
Ты — senior fullstack-разработчик и game-developer. Твоя задача — поддержка, доработка и финализация музыкальной ритм-игры **AeroBeat** в эстетике Frutiger Aero с серверным хранилищем треков и базой данных.

## Связанная документация
- `SPEC.md` — архитектура, формат beatmap, конфигурация, план по фазам.
- `prototype/code.html` — **визуальный закон.** Каждый экран, кнопка, эффект должны на 100% воспроизводить этот прототип.
- `prototype/DESIGN.md` — дизайн-система (палитра, типографика, spacing, компоненты).

## Стек технологий
### Frontend
- **HTML5** — семантичная разметка.
- **CSS3** — Tailwind CSS (CDN), кастомные CSS-переменные, `@keyframes` анимации, glassmorphism.
- **JavaScript (ES2022+)** — Vanilla JS, без фреймворков. `class`, `async/await`, модули.
- **Web Audio API** — `AudioContext`, `AudioBuffer`, `AudioBufferSourceNode`, `GainNode` для воспроизведения и анализа аудио.
- **Шрифты:** Google Fonts CDN (Plus Jakarta Sans, Work Sans).
- **Иконки:** Material Symbols Outlined (Google Fonts CDN).

### Backend
- **Node.js** (≥18 LTS) — рантайм.
- **Express.js** — HTTP фреймворк, REST API.
- **SQLite** через `better-sqlite3` — файловая БД, zero-config.
- **Multer** — загрузка multipart/form-data.
- **CORS** — разрешение кросс-доменных запросов.
- **SHA-256** (встроенный `crypto` модуль) — хеширование файлов для дедупликации.

### Тестирование
- **Vitest** — фреймворк тестирования (v1.6.0).
- Запуск: `npm test` (или `npx vitest run`).
- Тесты в `tests/`.

## Правила написания кода

### 1. Прототип — единственный источник визуала
- Любая визуальная реализация должна на 100% совпадать с `prototype/code.html`.
- Цвета, размеры, отступы, тени, градиенты — только из прототипа или DESIGN.md.
- Если CSS-свойство не поддерживается — искать кроссбраузерный polyfill/аналог, не упрощать визуал.

### 2. Web Audio API только
- **Воспроизведение:** `AudioContext` + `AudioBufferSourceNode` + `GainNode` (для volume). Никаких `<audio>` элементов — они не дают точного `currentTime`.
- **Анализ:** `AudioContext.decodeAudioData()` → PCM → IIR-фильтрация (low/mid/snare/hi) → RMS energy → автокорреляция для BPM → генерация нот с ограничением ≤7 на экране.
- `AudioContext.currentTime` — субмиллисекундная точность, единственный источник времени для синхронизации.
- **Никогда** не создавай `AudioContext` до первого user interaction (autoplay policy).

### 3. CSS优先 для рендеринга
- Ноты, рецепторы, HUD — DOM-элементы с `position: absolute` + `transform: translateY()`.
- Анимации (fade, particles, flash) — CSS `transition` и `@keyframes`, не `requestAnimationFrame` для визуала.
- `requestAnimationFrame` — только для game loop (обновление позиций нот на основе `currentTime`).

### 4. Синхронизация — математика, не кадры
Позиция ноты ВСЕГДА вычисляется на основе текущего времени аудио:
```javascript
const timeUntilHit = note.hitTime - audioPlayer.currentTime;
const noteY = receptorY - (timeUntilHit * NOTE_SPEED);
noteElement.style.transform = `translateY(${noteY}px)`;
```
- Привязка к FPS запрещена. Нота должна двигаться плавно даже при просадках фреймрейта.
- Деспавн: когда `timeUntilHit < -DESPAWN_TIME` — удалить DOM-элемент.

### 5. Object Pooling для нот
- Пул из 60 предсозданных DOM-элементов (div'ов) — `POOL_SIZE` в конфиге.
- При спавне — переиспользовать из пула (`element.style.display = 'block'`, обновить данные).
- При деспавне — скрыть (`element.style.display = 'none'`).
- Избегай `document.createElement` / `element.remove()` в game loop — это вызывает GC.

### 6. Ошибки — всегда в UI
- Ошибки (битый файл, нет onsets, формат не поддерживается) — стилизованные toast (`notifications.js`).
- `console.error()` только для разработки. Пользователь должен видеть красивое сообщение.
- Каждая `fetch`, `decodeAudioData`, file read — обёрнута в `try/catch` с UI-fallback.

### 7. Файловая структура
```
index.html              # Точка входа (фронтенд)
css/
│   └── style.css       # Глобальные стили, CSS-переменные, анимации, glassmorphism
js/
│   ├── app.js          # Точка входа: инициализация, game loop, keyboard input, hit feedback
│   ├── audio/
│   │   ├── analyzer.js     # Frequency-band analysis, BPM (autocorrelation), beatmap builder
│   │   ├── player.js       # Web Audio API player (load(file) + loadFromBuffer(arrayBuffer))
│   │   └── menuMusic.js    # Web Audio API player для фоновой музыки меню (loop + fade)
│   ├── game/
│   │   ├── conductor.js    # Спавн/деспавн, позиционирование, game loop, freeze phase
│   │   ├── note.js         # Note DOM-элемент, Object Pooling (60 элементов)
│   │   ├── receptor.js     # Receptor DOM + flash + позиционирование (getLaneX, getReceptorY)
│   │   ├── hitDetection.js # categorizeHit, isHitValid, константы окон
│   │   └── scoring.js      # Очки, комбо, множитель, accuracy, grade
│   └── ui/
│       ├── screens.js      # Переключение экранов (hidden class toggle)
│       ├── menu.js         # Главное меню: bubbles, file input, drag-drop, library button
│       ├── loading.js      # Загрузка + progress bar + BPM label
│       ├── hud.js          # In-game HUD (score, combo, progress, song title)
│       ├── results.js      # Результаты (grade glow, stats)
│       ├── library.js      # Экран библиотеки серверных треков (search, cards, play)
│       ├── publishForm.js  # Модальная форма публикации трека на сервер
│       ├── notifications.js # Toast-уведомления (ошибки, статус)
│       └── volumeControl.js # Вертикальный слайдер громкости (Frutiger Aero стиль)
server/
│   ├── server.js           # Express server, middleware, static files, маршруты
│   ├── db.js               # SQLite: init, schema (tracks table), migrations
│   ├── routes/
│   │   ├── tracks.js       # CRUD /api/tracks (GET list, GET :id, POST publish, DELETE :id)
│   │   └── upload.js       # POST /api/upload (standalone, НЕ подключён — дублирует tracks.js)
│   ├── uploads/
│   │   └── tracks/         # Хранилище аудиофайлов ({SHA-256 hash}.{ext})
│   └── aerobeat.db         # SQLite database файл (WAL mode)
assets/
│   ├── audio/
│   │   └── main-theme.mp3  # Фоновая музыка меню
│   └── fonts/              # Пустая директория (шрифты загружаются через Google Fonts CDN)
prototype/
│   ├── code.html           # Визуальный референс (единственный источник визуала)
│   ├── DESIGN.md           # Дизайн-система (палитра, типографика, компоненты)
│   └── screen.png          # Скриншот прототипа
tests/
│   ├── analyzer.test.js    # Тесты анализатора (6 tests, все зелёные)
│   ├── hitDetection.test.js # Тесты детекции хитов (6 tests, 1 FAIL — см. Known Issues)
│   └── scoring.test.js     # Тесты скоринга (16 tests, все зелёные)
package.json            # Зависимости backend + scripts
```

### 8. Модульность
- Каждый модуль — ES module (`export`/`import`).
- Минимум зависимостей между модулями. `player.js` не знает про `conductor.js`, `conductor.js` не знает про `ui/`.
- Общение через колбэки/события, не через прямые ссылки на DOM из игровой логики.
- Исключение: `app.js` — главный координатор, который связывает все модули вместе.

### 9. Документирование
- JSDoc для каждого публичного метода и класса.
- Inline-комментарии для нетривиальных алгоритмов (frequency-band analysis, BPM detection, visibility constraint).
- Единый стиль: `/** Description */` для JSDoc, `//` для inline.

### 10. Тестирование
- Фреймворк: **Vitest** (v1.6.0, `devDependencies`).
- Тесты в `tests/`.
- Запуск: `npm test` или `npx vitest run`.
- Критичные модули (analyzer, hit detection, scoring) — покрыты тестами.
- Анализатор тестируется на синтетических данных (метроном-волну генерируют в тестах через `generateMetronomeBuffer`).
- **Known Issue:** Тест `hitDetection.test.js` → `categorizeHit` → `returns good for delta within GOOD_WINDOW` → FAIL: `expect(categorizeHit(0.05)).toBe('good')` получает `'perfect'`. Причина: 0.05 сек = 50мс = `PERFECT_WINDOW`, попадает в perfect зону. Тест некорректен — `0.05` должен ожидать `'perfect'`, а не `'good'`.

## Процесс выполнения задач

1. Строго по фазам из `SPEC.md` (все 7 фаз завершены — см. статусы ниже).
2. При доработках: сначала писать тесты, потом реализация, потом проверять `npm test`.
3. В конце изменений:
   - Запустить `npm test` и убедиться что все тесты зелёные.
   - Исправить Known Issue в `hitDetection.test.js`.
4. Не упрощать визуал «для скорости». Frutiger Aero — это 50% продукта.
5. Блокеры документировать, не обходить «любой ценой».

## Текущее состояние проекта (все фазы завершены)

### Статус фаз

| Фаза | Описание | Статус |
|------|----------|--------|
| 1 | Инфраструктура и базовый HTML | **DONE** |
| 2 | Аудио-модули (player + analyzer) | **DONE** |
| 3 | Игровая механика (conductor, notes, hit detection, scoring) | **DONE** |
| 4 | Экраны и навигация (UI-модули, 100% match prototype) | **DONE** |
| 5 | Сервер и база данных (Express, SQLite, REST API) | **DONE** |
| 6 | Публикация и Library (frontend + backend интеграция) | **DONE** |
| 7 | Polish и VFX (particles, hit feedback, pause, volume, menu music) | **DONE** |

### Что реализовано сверх исходного плана
- **Menu Music** (`js/audio/menuMusic.js`) — Web Audio API плеер для фоновой музыки с loop и fade-in/fade-out.
- **Volume Control** (`js/ui/volumeControl.js`) — вертикальный слайдер громкости в стиле Frutiger Aero, с persistent volume в localStorage.
- **Pause System** — пауза по Escape, overlay с Resume/Quit кнопками.
- **Hit Feedback** — floating text (Perfect!/Good/Miss) с анимацией вверх + fade.
- **Particles** — зелёные/голубые/белые искры при Perfect/Good попаданиях (CSS `@keyframes particle-burst`).
- **Receptor Flash** — вспышка бордюра рецептора при попадании.
- **Drag & Drop** — загрузка файла через drag на game viewport.
- **Conflict Dialog** — при публикации дубликата показывается модалка с предложением Play/Cancel.
- **Bottom Navigation Bar** — навигационная панель с Play/Library/Social/Profile (Social и Profile — заглушки).
- **Aurora Background** — анимированный градиентный фон с ribbon-слоями вместо статического из прототипа.
- **Responsive Design** — адаптивные стили для `max-width: 768px` и `max-width: 480px`.

### Known Issues и отклонения от SPEC

1. **Тест `hitDetection.test.js` FAIL:** строка 14: `expect(categorizeHit(0.05)).toBe('good')` — получает `'perfect'`. 0.05с = 50мс = PERFECT_WINDOW, попадает в perfect. **Fix:** заменить预期 на `'perfect'` или изменить значение на `0.06`.

2. **Фон отличается от прототипа:** в SPEC указан `linear-gradient(135deg, #c6e7ff 0%, #00aeef 40%, #004c6b 100%)`, в коде реализован aurora gradient с ribbon-слоями (`linear-gradient(160deg, #b8e6d0 0%, #7ec8e3 35%, #4fc3f7 70%, #81d4fa 100%)`). Визуально красивее, но не совпадает с прототипом.

3. **`upload.js` не подключён:** файл `server/routes/upload.js` существует, но НЕ импортируется в `server.js`. Функционал загрузки полностью покрыт `routes/tracks.js` → `POST /api/tracks`. `upload.js` — мёртвый код.

4. **`assets/fonts/` пустая:** шрифты загружаются через Google Fonts CDN. Локальные fallback-шрифты отсутствуют.

5. **`.gitignore` отсутствует:** файл не найден в корне проекта. Нужно создать.

6. **Hardcoded `API_BASE`:** в `library.js` и `publishForm.js` URL API захардкожен как `http://localhost:3000`. При деплое на другой порт/домен потребуется правка.

7. **Social/Profile кнопки — заглушки:** в bottom nav bar кнопки Social и Profile не имеют функционала.

8. **`node-cache` не используется:** SPEC упоминает `node-cache` для кэширования, но в `package.json` он отсутствует. Кэширование делается через `localStorage` на клиенте.

## Экспорт API

### Frontend → Backend
- `GET /api/tracks` — список треков (light: id, title, artist, bpm, duration, note_count, created_at)
- `GET /api/tracks/:id` — полные данные трека + beatmap JSON + file_path
- `POST /api/tracks` — публикация трека (multipart/form-data: audio + title + artist + bpm + duration + beatmap JSON)
- `DELETE /api/tracks/:id` — удаление трека (БД + файл на диске)
- `GET /api/health` — health check

### Frontend state
- `currentBeatmap` — текущий beatmap объект
- `currentFile` — `File` объект локально загруженного трека (null для треков из Library)
- `conductor` — текущий Conductor экземпляр
- `scoringState` — текущий scoring state
- `isPaused` — флаг паузы
- `audioPlayer` — AudioPlayer экземпляр
- `menuMusic` — MenuMusicPlayer экземпляр

## Запуск проекта

```bash
# Установка зависимостей
npm install

# Запуск сервера (включает API + раздачу статики)
npm run server

# Открыть в браузере
# http://localhost:3000

# Запуск тестов
npm test
```
