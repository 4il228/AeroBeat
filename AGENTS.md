# Инструкции для ИИ-Агента (Разработчик)

## Контекст
Ты — senior fullstack-разработчик и game-developer. Твоя задача — поддержка, доработка и финализация музыкальной ритм-игры **AeroBeat** в эстетике Frutiger Aero с серверным хранилищем треков и базой данных.

## Связанная документация
- `SPEC.md` — архитектура, формат beatmap, конфигурация, план по фазам.
- `SUB_SPEC.md` — **спецификация модуля анализа треков.** Фазовая декомпозиция алгоритма beatmap builder (7 фаз: Decoding → Filtering → Envelope → Derivative → Peak Picking → BPM Grid → Pattern Generator).
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
- Ошибки (битый файл, формат не поддерживается) — стилизованные toast (`notifications.js`).
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
│   │   ├── player.js       # Web Audio API player (load(file))
│   │   └── menuMusic.js    # Web Audio API player для фоновой музыки меню (loop + fade)
│   ├── auth/
│   │   └── auth.js         # JWT-токен, register/login/logout, reactive UI
│   ├── game/
│   │   ├── conductor.js    # Спавн/деспавн, позиционирование, game loop, freeze phase
│   │   ├── note.js         # Note DOM-элемент, Object Pooling (60 элементов)
│   │   ├── receptor.js     # Receptor DOM + flash + позиционирование (getLaneX, getReceptorY)
│   │   ├── hitDetection.js # categorizeHit, isHitValid, константы окон
│   │   └── scoring.js      # Очки, комбо, множитель, accuracy, grade
│   └── ui/
│       ├── screens.js      # Переключение экранов (hidden class toggle)
│       ├── menu.js         # Главное меню: bubbles, file input, drag-drop
│       ├── loading.js      # Загрузка + progress bar
│       ├── hud.js          # In-game HUD (score, combo, progress, song title)
│       ├── results.js      # Результаты (grade glow, stats)
│       ├── profile.js      # Экран профиля: авторизация/регистрация + профиль
│       ├── notifications.js # Toast-уведомления (ошибки, статус)
│       └── volumeControl.js # Вертикальный слайдер громкости (Frutiger Aero стиль)
server/
│   ├── server.js           # Express server, middleware, static files, маршруты
│   ├── db.js               # SQLite: init, schema (tracks, users tables), migrations
│   ├── routes/
│   │   ├── tracks.js       # CRUD /api/tracks (GET list, GET :id, POST publish, DELETE :id)
│   │   └── auth.js         # Авторизация: POST register, POST login, GET me, PUT profile
│   ├── uploads/
│   │   └── tracks/         # Хранилище аудиофайлов ({SHA-256 hash}.{ext})
│   └── aerobeat.db         # SQLite database файл (WAL mode)
assets/
│   ├── audio/
│   │   ├── main-theme.mp3  # Фоновая музыка меню
│   │   └── click-sfx.mp3   # Звук клика по кнопкам
│   └── icons/
│       └── favicon.png     # Favicon приложения
prototype/
│   ├── code.html           # Визуальный референс (единственный источник визуала)
│   ├── DESIGN.md           # Дизайн-система (палитра, типографика, компоненты)
│   └── screen.png          # Скриншот прототипа
tests/
│   ├── hitDetection.test.js # Тесты детекции хитов (6 tests, все зелёные)
│   ├── scoring.test.js     # Тесты скоринга (16 tests, все зелёные)
│   └── auth.test.js        # Тесты авторизации (13 tests, все зелёные)
SUB_SPEC.md             # Спецификация модуля анализа треков (7 фаз)
package.json            # Зависимости backend + scripts
```

### 8. Модульность
- Каждый модуль — ES module (`export`/`import`).
- Минимум зависимостей между модулями. `player.js` не знает про `conductor.js`, `conductor.js` не знает про `ui/`.
- Общение через колбэки/события, не через прямые ссылки на DOM из игровой логики.
- Исключение: `app.js` — главный координатор, который связывает все модули вместе.

### 9. Документирование
- JSDoc для каждого публичного метода и класса.
- Inline-комментарии для нетривиальных алгоритмов.
- Единый стиль: `/** Description */` для JSDoc, `//` для inline.

### 10. Тестирование
- Фреймворк: **Vitest** (v1.6.0, `devDependencies`).
- Тесты в `tests/`.
- Запуск: `npm test` или `npx vitest run`.
- Критичные модули (hit detection, scoring, auth) — покрыты тестами.

## Процесс выполнения задач

1. Строго по фазам из `SPEC.md`.
2. При доработках: сначала писать тесты, потом реализация, потом проверять `npm test`.
3. В конце изменений:
   - Запустить `npm test` и убедиться что все тесты зелёные.
4. Не упрощать визуал «для скорости». Frutiger Aero — это 50% продукта.
5. Блокеры документировать, не обходить «любой ценой».

## Текущее состояние проекта

### Статус фаз

| Фаза | Описание | Статус |
|------|----------|--------|
| 1 | Инфраструктура и базовый HTML | **DONE** |
| 2 | Аудио-модули (player) | **DONE** (analyzer удалён — будет переписан) |
| 3 | Игровая механика (conductor, notes, hit detection, scoring) | **DONE** |
| 4 | Экраны и навигация (UI-модули) | **DONE** |
| 5 | Сервер и база данных (Express, SQLite, REST API) | **DONE** |
| 6 | Авторизация и профиль | **DONE** |
| 7 | Polish и VFX (particles, hit feedback, pause, volume, menu music) | **DONE** |
| 8 | Анализатор треков | **TODO** — `SUB_SPEC.md`, модуль `beatmapBuilder.js` |
| 9 | История игр и результаты | **TODO** |

### Что реализовано
- **Menu Music** (`js/audio/menuMusic.js`) — Web Audio API плеер для фоновой музыки с loop и fade-in/fade-out.
- **Volume Control** (`js/ui/volumeControl.js`) — вертикальный слайдер громкости в стиле Frutiger Aero, с persistent volume в localStorage.
- **Pause System** — пауза по Escape, overlay с Resume/Quit кнопками.
- **Hit Feedback** — floating text (Perfect!/Good/Miss) с анимацией вверх + fade.
- **Particles** — зелёные/голубые искры при Perfect/Good попаданиях (CSS `@keyframes particle-burst`).
- **Receptor Flash** — вспышка бордюра рецептора при попадании.
- **Drag & Drop** — загрузка файла через drag на game viewport.
- **Bottom Navigation Bar** — навигационная панель с Play/Library/Social/Profile.
- **Aurora Background** — анимированный градиентный фон с ribbon-слоями.
- **Responsive Design** — адаптивные стили для `max-width: 768px` и `max-width: 480px`.
- **Click SFX** — звук клика по кнопкам.
- **JWT Авторизация** — регистрация, вход, профиль.

### Known Issues

1. **Анализатор удалён:** модуль `js/audio/analyzer.js` удалён. Новый анализатор будет создан в Фазе 8 по спецификации `SUB_SPEC.md` (модуль `beatmapBuilder.js`). Без анализатора gameplay не запускается (нет beatmap для спавна нот).

2. **Фон отличается от прототипа:** в SPEC указан `linear-gradient(135deg, #c6e7ff 0%, #00aeef 40%, #004c6b 100%)`, в коде реализован aurora gradient с ribbon-слоями. Визуально красивее, но не совпадает с прототипом.

3. **Social/Profile кнопки — заглушки:** в bottom nav bar кнопка Social не имеет функционала.

## Модуль анализа треков (Phase 8)

**Спецификация:** `SUB_SPEC.md` — полная фазовая декомпозиция алгоритма.

**Модуль:** `js/audio/beatmapBuilder.js` (новый файл, не путать со старым `analyzer.js`).

**Краткое описание пайплайна (7 фаз):**
1. **Decoding** — получение моно PCM из AudioBuffer.
2. **Transient Filtering** — изоляция кика (low-pass 100Hz) и снейра (band-pass 2500Hz) через OfflineAudioContext.
3. **Envelope Follower** — выпрямление + IIR-сглаживание (α=0.05).
4. **Attack Detection** — первая производная огибающей, half-wave rectification.
5. **Peak Picking** — локальные максимумы с плавающим порогом, debounce 50мс.
6. **BPM + Grid** — автокорреляция, квантование к сетке 1/4 и 1/8 долей (макс. сдвиг 30мс).
7. **Pattern Generator** — маппинг на D/F/J/K: чередование, лестницы, триллы, аккорды на сильную долю.

**Формат выхода:**
```json
{
  "version": 1,
  "metadata": { "bpm": 174.0, "offset": 0.125, "noteCount": 412 },
  "notes": [
    { "time": 1.125, "lane": 0 },
    { "time": 1.470, "lane": 2 }
  ]
}
```

**Интеграция с `app.js`:** `handleFileLoad()` вызывает `buildBeatmap(file, onProgress)`, результат сохраняется в `currentBeatmap`. Констант `lanes` = 4 (D/F/J/K).

**Тестирование:** Каждая фаза тестируется отдельно. Использовать синтетические данные (метроном-волна) для верификации пиков. Тесты в `tests/beatmapBuilder.test.js`.

## Экспорт API

### Frontend → Backend
- `GET /api/tracks` — список треков (light: id, title, artist, bpm, duration, note_count, created_at)
- `GET /api/tracks/:id` — полные данные трека + beatmap JSON + file_path
- `POST /api/tracks` — публикация трека (multipart/form-data: audio + title + artist + bpm + duration + beatmap JSON)
- `DELETE /api/tracks/:id` — удаление трека (БД + файл на диске)
- `GET /api/health` — health check

### Frontend state
- `currentBeatmap` — текущий beatmap объект (null пока анализатор не создан)
- `currentFile` — `File` объект локально загруженного трека
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
