# Спецификация проекта: AeroBeat

## 1. Описание проекта
Музыкальная ритм-игра в эстетике Frutiger Aero. Ключевая механика: автоматическая генерация ритм-карты (beatmap) на основе загружённого пользователем аудиофайла, воспроизведение в браузере.

**Целевой пользователь:** Казуальный игрок. Минимальный порог вхождения, интуитивно понятный UI.
**Ключевая визуальная механика:** Рецепторы (хитбоксы) постоянно видимы в нижней части экрана. Ноты падают сверху вниз к ним.

## 2. Технологический стек

### 2.1. Frontend (браузер)
- **Платформа:** Браузер (Chrome/Edge/Firefox).
- **Язык:** JavaScript (ES2022+), HTML5, CSS3.
- **UI:** Tailwind CSS (CDN), Google Fonts (Plus Jakarta Sans, Work Sans), Material Symbols Outlined (иконки).
- **Аудио:**
  - **Воспроизведение:** `Web Audio API` (`AudioContext`, `AudioBufferSourceNode`, `GainNode`) — нативная точность `currentTime`, поддержка громкости.
  - **Анализ:** `Web Audio API` (`AudioContext.decodeAudioData`) → IIR-фильтрация по частотным полосам → RMS energy → onset detection в каждой полосе → ноты привязаны к реальным звуковым событиям.
  - **Фоновая музыка меню:** `AudioContext` + `AudioBufferSourceNode(loop=true)` + `GainNode` для fade-in/out.
- **Рендеринг:** DOM-элементы + CSS-анимации (`transform`, `transition`, `@keyframes`). Canvas не требуется — ноты это CSS-элементы с `position: absolute` и `transform: translateY()`.
- **Тестирование:** Vitest v1.6.0.

### 2.2. Backend (сервер)
- **Рантайм:** Node.js (≥18 LTS).
- **Фреймворк:** Express.js — REST API.
- **База данных:** SQLite через `better-sqlite3` — простая, zero-config, файл БД хранится рядом с сервером (`server/aerobeat.db`, WAL mode).
- **Хранилище файлов:** Локальная файловая система (`uploads/tracks/` для аудио, имена файлов — SHA-256 хеш + расширение).
- **Загрузка файлов:** `multer` — multipart/form-data. Валидация: `.mp3`, `.ogg`, `.wav`, `.flac`. Макс. размер: 50MB.
- **CORS:** `cors` middleware для разрешения запросов с frontend.
- **Сборка:** Не требуется. `npm run server` запускает сервер.

### 2.3. Взаимодействие Frontend ↔ Backend
- **Протокол:** HTTP REST API (JSON).
- **Порты:** Frontend — любой (dev-сервер или file://), Backend — `:3000`.
- **Коммуникация:** `fetch()` из браузера → Express API → SQLite / filesystem.

## 3. Визуальный референс
Единственный источник истины для UI/UX: **`prototype/code.html`** + **`prototype/DESIGN.md`**.
Любая реализация должна на 100% воспроизводить визуал из прототипа.

## 4. Архитектура системы

### 4.1. Файловая структура
```
index.html              # Точка входа (фронтенд)
css/
│   └── style.css       # Глобальные стили, CSS-переменные, анимации, glassmorphism
js/
│   ├── app.js          # Точка входа: инициализация, game loop, keyboard input, hit feedback
│   ├── auth/
│   │   └── auth.js     # Класс Auth: JWT-токен, register/login/logout, reactive UI
│   ├── audio/
│   │   ├── player.js       # Web Audio API player (load(file))
│   │   └── menuMusic.js    # Web Audio API player для фоновой музыки меню (loop + fade)
│   ├── game/
│   │   ├── conductor.js    # Спавн/деспавн нот, синхронизация с временем, freeze phase, game loop
│   │   ├── note.js         # Note DOM-элемент + Object Pooling (60 элементов)
│   │   ├── receptor.js     # Receptor DOM-элемент + flash-эффект + позиционирование
│   │   ├── hitDetection.js # categorizeHit, isHitValid, константы окон
│   │   └── scoring.js      # Очки, комбо, множитель, accuracy, grade
│   └── ui/
│       ├── screens.js      # Переключение экранов (menu/loading/gameplay/results/profile)
│       ├── menu.js         # Главное меню: bubbles, file input, drag-drop
│       ├── loading.js      # Экран загрузки + прогресс-бар
│       ├── hud.js          # In-game HUD (score, combo, progress, song title)
│       ├── results.js      # Экран результатов + grade glow
│       ├── profile.js      # Экран профиля: авторизация/регистрация + профиль
│       ├── notifications.js # Toast/модалки ошибок
│       └── volumeControl.js # Вертикальный слайдер громкости (Frutiger Aero)
server/
│   ├── server.js           # Express server, middleware, static files, маршруты API
│   ├── db.js               # SQLite: инициализация, schema, migrations
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
│   ├── code.html           # Визуальный референс
│   ├── DESIGN.md           # Дизайн-система
│   └── screen.png          # Скриншот прототипа
tests/
│   ├── hitDetection.test.js # 6 tests — все зелёные
│   ├── scoring.test.js     # 16 tests — все зелёные
│   └── auth.test.js        # 13 tests — все зелёные
package.json            # Зависимости backend + scripts (express, better-sqlite3, multer, cors, bcryptjs, jsonwebtoken, express-rate-limit)
```

### 4.2. Модуль Audio Analyzer (`js/audio/analyzer.js`)

**Статус:** Модуль удалён. Будет переписан с нуля.

**Назначение:** Анализ аудиофайла и генерация beatmap (массива нот с таймингами и дорожками).

**Вход:** `File` объект (из `<input type="file">` или drag-and-drop).
**Выход:** Beatmap object (см. 4.6).

**Требования к новой реализации:**
1. Приём `File` объекта + callback прогресса.
2. Декодирование аудио через `AudioContext.decodeAudioData()`.
3. Анализ энергии по частотным полосам → detection onsets → генерация нот.
4. Маппинг частотных полос на 4 дорожки (D/F/J/K).
5. BPM-детекция для метаданных.
6. Кэширование в `localStorage` для повторных загрузок того же файла.
7. Возврат объекта `{ metadata: {...}, notes: [...] }` (формат см. 4.11).
8. Обработка ошибок через UI (toast), не console.

**Пока анализатор не создан:** `handleFileLoad` в `app.js` устанавливает `currentBeatmap = null` и gameplay не запускает ноты.

### 4.3. Модуль Audio Player (`js/audio/player.js`)

**Реализация на Web Audio API:**

```javascript
class AudioPlayer {
  constructor() {
    this.ctx = null;        // AudioContext (создаётся при init())
    this.source = null;     // AudioBufferSourceNode
    this.gainNode = null;   // GainNode (для volume)
    this.buffer = null;     // AudioBuffer
    this.startTime = 0;     // ctx.currentTime when play() called
    this.pauseOffset = 0;
    this.playing = false;
    this._volume = 1;       // Master volume 0–1
  }

  init()   { /* new AudioContext() + GainNode — вызывать только после user gesture */ }
  async load(file) { /* File → arrayBuffer → decodeAudioData → this.buffer */ }
  async play()     { /* source.start(0, pauseOffset); startTime = ctx.currentTime; resume AudioContext if suspended */ }
  stop()    { /* source.stop(); playing = false; pauseOffset = 0 */ }
  pause()   { /* source.stop(); pauseOffset = raw position; playing = false */ }
  seek(t)   { /* Перезапуск source с新的 pauseOffset (если playing) */ }

  get currentTime() {
    if (!this.ctx) return 0;
    return this.playing
      ? this.ctx.currentTime - this.startTime + this.pauseOffset
      : this.pauseOffset;
  }

  get duration() { return this.buffer ? this.buffer.duration : 0; }

  set volume(v) { /* Установка gainNode.gain.value */ }
  get volume() { return this._volume; }
}
```

**Ключевые моменты:**
- `AudioContext` создаётся только после user gesture (autoplay policy).
- `AudioContext.currentTime` — высокоточный timestamp (sub-millisecond).
- `pause()` сохраняет позицию ДО установки `playing = false` (иначе getter вернёт старый `pauseOffset`).
- `GainNode` между source и destination для управления громкостью.
- Не блокирует main thread.
- Поддержка play/pause/seek.

### 4.4. Модуль Menu Music (`js/audio/menuMusic.js`)

Web Audio API плеер для фоновой музыки меню.

**Ключевые особенности:**
- `AudioBufferSourceNode` с `loop = true` для бесконечного повтора.
- Два `GainNode`: `masterGain` (общая громкость) × `fadeGain` (fade-in/out).
- `fadeIn(duration, targetVolume)` — плавное нарастание через `linearRampToValueAtTime`.
- `fadeOut(duration)` — плавное затухание до 0. Source продолжает крутиться в цикле тихо — `fadeIn` может плавно вернуть громкость.
- `AudioContext` создаётся только при первом user interaction.
- `load(url)` — загрузка аудио по URL через `fetch`.
- Громкость по умолчанию: 0.35 (тише игрового аудио).

### 4.5. Модуль Conductor (`js/game/conductor.js`)

Синхронизирует текущее время аудио с позициями нот. Поддерживает фазу freeze перед стартом игры.

**Логика `processNotes(currentTime, suppressMisses)`:**
1. **Спавн:** Если `timeUntilHit <= LEAD_TIME` и нота ещё не создана → создать DOM-элемент из пула.
2. **Позиция:** `y = receptorY - (timeUntilHit * NOTE_SPEED)` (CSS `transform: translateY(y)`). Центрирование по лену: `el.style.left = x - 20px`.
3. **Видимость:** Если `y >= 0` → нота добавляется в `visibleNotes` (доступна для хитов).
4. **Деспавн/Miss:** Если `timeUntilHit < -DESPAWN_TIME`:
   - Если нота была видна (`visibleNotes`) → засчитывается miss, вызывается `onMiss`.
   - Если нота не была видна (не влезла в пулл или за пределами экрана) → тихий пропуск.
5. **Оптимизация:** Итерация прерывается (`break`) при `timeUntilHit > LEAD_TIME` — ноты дальше в будущем не проверяются.

**Фаза Freeze (`startFreeze(duration, onComplete)`):**
1. Вычисляется `freezeTime = max(0, firstNote.time - FREEZE_OFFSET_PX / NOTE_SPEED)` — время аудио, при котором первая нота находится на `FREEZE_OFFSET_PX` (100px) выше рецептора.
2. `positionFrozen(freezeTime)` — позиционирует ноты **один раз** без despawn/miss логики. Ноты заморожены.
3. Клавиши не работают (`inputEnabled = false`).
4. По истечении `duration` (3 сек): `clearAllNotes()`, `processedNotes.clear()`, `visibleNotes.clear()`, `audioPlayer.seek(freezeTime)`, запуск `update()` + вызов `onComplete`.

**Конец игры:** `currentTime >= duration` и все ноты обработаны → `onGameEnd`.

**Публичный API:**
```javascript
conductor.start()
conductor.stop()
conductor.startFreeze(duration, onComplete)
conductor.tryHit(lane) → { hit, noteIndex, delta, note }
conductor.markHit(noteIndex)
conductor.getProgress() → 0..1
conductor.running → boolean
```

### 4.6. Модуль Hit Detection (`js/game/hitDetection.js`)

```javascript
const PERFECT_WINDOW = 0.050;  // сек (50мс)
const GOOD_WINDOW = 0.120;     // сек (120мс)
const INPUT_IGNORE_THRESHOLD = 0.5;

function categorizeHit(delta) {
  if (delta <= PERFECT_WINDOW) return 'perfect';
  if (delta <= GOOD_WINDOW) return 'good';
  return 'miss';
}

function isHitValid(delta) {
  return delta < INPUT_IGNORE_THRESHOLD;
}
```

При нажатии клавиши:
1. `tryHit(lane)` ищет ближайшую **видимую** (`visibleNotes`) unhit ноту на дорожке.
2. Проверка `delta <= HIT_WINDOW` (120мс) — нота должна быть рядом с рецептором.
3. `categorizeHit(delta)` определяет зону (perfect/good).
4. Начислить очки, обновить комбо.

### 4.7. Модуль Scoring (`js/game/scoring.js`)

| Зона     | Базовые очки | Множитель |
|----------|-------------|-----------|
| Perfect  | 300         | `1 + floor(combo / 50)` |
| Good     | 100         | `1 + floor(combo / 50)` |
| Miss     | 0           | — (combo сбрасывается) |

**Accuracy:** `(perfect + good) / total_notes * 100`.
**Grade:** S (≥95%), A (≥85%), B (≥70%), C (≥50%), D (<50%).

**Публичный API:**
```javascript
createScoringState() → state
processHit(state, hitType) → { score, combo, multiplier, addedScore }
calculateAccuracy(state) → 0..100
determineGrade(accuracy) → 'S'|'A'|'B'|'C'|'D'
formatScore(score) → '00000'..string
```

### 4.8. Модуль Note Pooling (`js/game/note.js`)

Пул из 60 DOM-элементов (div.note). При спавне — `display: block` + привязка к индексу. При деспавне — `display: none`.

```javascript
initNotes(container, positions, poolSize = 60)
spawnNote(noteIndex, lane) → HTMLElement|null
updateNotePosition(el, y)
despawnNote(noteIndex)
getActiveNote(noteIndex) → HTMLElement|undefined
clearAllNotes()
```

### 4.9. Модуль Receptor (`js/game/receptor.js`)

Управление рецепторами (4 стеклянных колодца в нижней части экрана).

```javascript
initReceptors(laneCount = 4)       // Query DOM для .receptor[data-lane="0..3"]
flashReceptor(lane)                 // Вспышка border-color при попадании (120мс)
getLaneX(lane, notesContainer) → px // Центр X рецептора относительно notes-container
getReceptorY(notesContainer) → px   // Центр Y рецептора
```

### 4.10. Параметры конфигурации

```javascript
const CONFIG = {
  LANE_COUNT: 4,
  LANE_KEYS: ['d', 'f', 'j', 'k'],
  LEAD_TIME: 2.0,           // сек — время полёта ноты
  NOTE_SPEED: 400,          // px/sec
  DESPAWN_TIME: 1.0,        // сек после прохождения рецептора
  HIT_WINDOW: 0.12,         // сек — макс. delta для попадания (совпадает с GOOD_WINDOW)
  PERFECT_WINDOW: 0.050,    // сек (50мс)
  GOOD_WINDOW: 0.120,       // сек (120мс)
  INPUT_IGNORE_THRESHOLD: 0.5,
  POOL_SIZE: 60,            // max DOM-элементов нот одновременно
  FREEZE_OFFSET_PX: 100,    // px — первая нота замораживается на этом расстоянии выше рецептора
  FREEZE_DURATION: 3,       // сек — время freeze перед стартом игры
};
```

### 4.11. Формат Beatmap

```json
{
  "metadata": {
    "title": "My Song",
    "artist": "Unknown",
    "bpm": 128.0,
    "offset": 0.0,
    "duration": 180.0
  },
  "notes": [
    { "time": 1.25, "track": 0 },
    { "time": 1.60, "track": 2 }
  ]
}
```

- `notes[i].time`: float, секунды от начала трека.
- `notes[i].track`: int, 0..3 (колонки D, F, J, K) — назначается анализатором по частотной полосе:
  - 0 (D): low (бочка)
  - 1 (F): mid (вокал/лиды)
  - 2 (J): snare (снейр/хлопки)
  - 3 (K): hi (хайхеты/цимбалы)

### 4.12. Серверная база данных (SQLite)

**Схема таблицы `tracks`:**

```sql
CREATE TABLE tracks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL DEFAULT 'Unknown',
  bpm         REAL NOT NULL,
  duration    REAL NOT NULL,
  file_path   TEXT NOT NULL UNIQUE,     -- путь к аудиофайлу на диске
  file_size   INTEGER NOT NULL,         -- размер в байтах
  file_hash   TEXT NOT NULL UNIQUE,     -- SHA-256 хеш файла (дедупликация)
  note_count  INTEGER NOT NULL DEFAULT 0,
  beatmap     TEXT,                      -- JSON beatmap (сериализованный)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tracks_hash ON tracks(file_hash);
CREATE INDEX idx_tracks_artist ON tracks(artist);
CREATE INDEX idx_tracks_title ON tracks(title);
```

**Принципы хранения:**
- Аудиофайл сохраняется на диск в `uploads/tracks/` с именем `{SHA-256 hash}.{ext}`. Это обеспечивает дедупликацию: один и тот же файл не сохраняется дважды.
- Beatmap (JSON с нотами) сериализуется и хранится в колонке `beatmap` таблицы `tracks`. При загрузке трека beatmap десериализуется и передаётся клиенту — анализ не повторяется.
- BPM вычисляется на клиенте при первом анализе и сохраняется в БД вместе с beatmap.
- SQLite работает в WAL mode для конкурентного доступа.

### 4.13. REST API

#### `GET /api/tracks` — список всех треков
**Ответ:**
```json
{
  "tracks": [
    {
      "id": 1,
      "title": "My Song",
      "artist": "Unknown",
      "bpm": 128.0,
      "duration": 180.0,
      "note_count": 342,
      "created_at": "2025-01-15T12:00:00Z"
    }
  ]
}
```
- Поля `file_path`, `file_hash`, `beatmap` — не отдаются в списке (оптимизация).

#### `GET /api/tracks/:id` — полные данные трека (включая beatmap)
**Ответ:**
```json
{
  "id": 1,
  "title": "My Song",
  "artist": "Unknown",
  "bpm": 128.0,
  "duration": 180.0,
  "file_path": "uploads/tracks/{hash}.mp3",
  "note_count": 342,
  "beatmap": { "metadata": {...}, "notes": [...] },
  "created_at": "2025-01-15T12:00:00Z"
}
```

#### `POST /api/tracks` — публикация нового трека
**Тело запроса (multipart/form-data):**
| Поле       | Тип     | Обязательно | Описание |
|-----------|---------|-------------|----------|
| `audio`   | File    | Да          | Аудиофайл (.mp3, .ogg, .wav, .flac) |
| `title`   | String  | Да          | Название трека |
| `artist`  | String  | Да          | Исполнитель |
| `bpm`     | Number  | Да          | Вычисленный BPM (от клиента) |
| `duration`| Number  | Да          | Длительность в секундах |
| `beatmap` | String  | Да          | JSON beatmap (сериализованный) |

**Логика сервера:**
1. Принять файл через `multer`.
2. Вычислить SHA-256 хеш файла.
3. Проверить дедупликацию: если `file_hash` уже есть в БД → вернуть 409 Conflict с `track_id` существующего трека.
4. Сохранить файл на диск в `uploads/tracks/{hash}.{ext}`.
5. Вставить запись в таблицу `tracks`.
6. Вернуть 201 Created с `{ id, title, artist }`.

**Ошибки:**
- 400 — невалидные данные (нет обязательных полей, unsupported format).
- 409 — дубликат файла (тот же хеш). Ответ включает `{ track_id, title, artist }` существующего трека.
- 500 — ошибка сервера.

#### `DELETE /api/tracks/:id` — удаление трека
- Удаляет запись из БД и файл с диска.
- Вернуть 200 OK `{ success: true }` или 404 Not Found.

#### `GET /api/health` — health check
```json
{ "status": "ok", "timestamp": "2025-01-15T12:00:00Z" }
```

### 4.14. Модуль Volume Control (`js/ui/volumeControl.js`)

Вертикальный слайдер громкости в стиле Frutiger Aero, расположенный справа от game viewport.

**Ключевые особенности:**
- Custom HTML: vertical `<input type="range">` с кастомными CSS-стилями (WebKit + Mozilla).
- Иконка динамика: `volume_off` / `volume_mute` / `volume_down` / `volume_up` в зависимости от уровня.
- Fill track: зелёный градиент поднимается снизу вверх.
- Persistent: громкость сохраняется в `localStorage` (`aerobeat-master-volume`).
- Дефолтная громкость: 0.75.
- Управляет `audioPlayer.volume` и `menuMusic.volume` одновременно.

### 4.15. Навигация между экранами

```
Menu → Loading → Gameplay → Results → Menu
                    ↑ (stop button) ↵

              Profile ←──── Menu (bottom nav)
                    ↓ (login/register or view profile)
```

Каждый экран — `<section>` с `class="hidden"`. Переключение через JS (`screens.js` → `navigate(screenId)`).

**Bottom Nav Bar:** Play (активный), Library (заглушка — Coming soon), Social (заглушка — Coming soon), Profile.

### 4.16. Авторизация и система пользователей

#### 4.16.1. Обзор
Система авторизации по логину и паролю с JWT-токенами. Авторизация не является обязательной — приложение полностью функционально без аккаунта. Зарегистрированные пользователи получают:
- Сохранение истории игр на сервере (score, accuracy, grade).
- Профиль с общей статистикой (total games, average accuracy, favorite track).
- Публикация треков привязывается к пользователю (owner_id).

#### 4.16.2. Безопасность — приоритет

**Хеширование паролей:**
- Библиотека: `bcryptjs` (pure JS, без нативных зависимостей — работает на любом хостинге).
- Salt rounds: 12 (оптимальный баланс скорость/безопасность).
- Пароль **никогда** не хранится в открытом виде. Даже администратор не может его прочитать.

**JWT-токены:**
- Библиотека: `jsonwebtoken`.
- Secret: `process.env.JWT_SECRET` или fallback-значение при разработке (`aerobeat-dev-secret-change-in-prod`).
- Срок жизни токена: 7 дней (`expiresIn: '7d'`).
- Токен хранится в `localStorage` на клиенте (`aerobeat-jwt`).
- При каждом API-запросе, требующем авторизации, токен передаётся в заголовке `Authorization: Bearer <token>`.

**Защита от атак:**
- Rate limiting на auth-эндпоинтах: max 20 попыток регистрации/входа в минуту с одного IP (`express-rate-limit`).
- Валидация username: 3–20 символов, только `[a-zA-Z0-9_-]`.
- Валидация пароля: минимум 6 символов.
- Все ошибки возвращаются в формате `{ error: "message" }` — никогда не раскрывать, существует ли пользователь.

**Middleware `authenticateToken`:**
```javascript
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user; // { id, username, iat, exp }
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}
```

**Middleware `optionalAuth`:** Аналогичный `authenticateToken`, но не блокирует запрос — просто добавляет `req.user = null` если токена нет. Используется для эндпоинтов, которые работают по-разному для авторизованных/неавторизованных пользователей.

#### 4.16.3. Схема БД — таблица `users`

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

**Поля:**
- `username` — уникальный логин (3–20 символов, `[a-zA-Z0-9_-]`).
- `email` — опциональный email (для будущего восстановления пароля).
- `password_hash` — bcrypt hash пароля (60 символов).
- `display_name` — отображаемое имя (по умолчанию = username).

#### 4.16.4. REST API — Авторизация

##### `POST /api/auth/register` — регистрация нового пользователя

**Тело запроса (JSON):**
```json
{
  "username": "player1",
  "password": "secret123",
  "email": "player1@example.com"  // опционально
}
```

**Валидация:**
- `username`: обязательно, 3–20 символов, regex `/^[a-zA-Z0-9_-]+$/`.
- `password`: обязательно, минимум 6 символов.
- `email`: опционально, валидный формат если передан.

**Логика сервера:**
1. Проверить уникальность `username` → если занят: 409 `{ error: 'Username already taken' }`.
2. Проверить уникальность `email` (если передан) → если занят: 409 `{ error: 'Email already registered' }`.
3. `bcrypt.hash(password, 12)` → сохранить в `users`.
4. Создать JWT: `jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' })`.
5. Вернуть 201: `{ token, user: { id, username, display_name } }`.

**Ошибки:**
- 400 — невалидные данные.
- 409 — username/email уже заняты.
- 429 — слишком много попыток (rate limit).
- 500 — ошибка сервера.

##### `POST /api/auth/login` — вход в аккаунт

**Тело запроса (JSON):**
```json
{
  "username": "player1",
  "password": "secret123"
}
```

**Логика сервера:**
1. Найти пользователя по `username`.
2. Если не найден: 401 `{ error: 'Invalid username or password' }`. **Никогда** не уточнять, что именно неверно.
3. `bcrypt.compare(password, user.password_hash)` → если false: 401 `{ error: 'Invalid username or password' }`.
4. Создать JWT: `jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' })`.
5. Вернуть 200: `{ token, user: { id, username, display_name } }`.

##### `GET /api/auth/me` — текущий пользователь (защищённый)

**Заголовок:** `Authorization: Bearer <token>`

**Ответ (200):**
```json
{
  "id": 1,
  "username": "player1",
  "display_name": "Player One",
  "email": "player1@example.com",
  "created_at": "2025-01-15T12:00:00Z"
}
```

**Ошибки:**
- 401 — токен не передан.
- 403 — токен невалиден/истёк.

##### `PUT /api/auth/profile` — обновление профиля (защищённый)

**Тело запроса (JSON):**
```json
{
  "display_name": "Player One",
  "email": "newemail@example.com"
}
```

**Логика:**
- `display_name`: optional, 1–30 символов.
- `email`: optional, валидный формат, уникальность проверяется.
- Вернуть 200: `{ user: { id, username, display_name, email } }`.

##### `POST /api/auth/change-password` — смена пароля (защищённый)

**Тело запроса (JSON):**
```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

**Логика:**
1. Проверить `currentPassword` через `bcrypt.compare`.
2. Если верный → `bcrypt.hash(newPassword, 12)` → обновить в БД.
3. Вернуть 200: `{ success: true }`.

#### 4.16.5. Клиентский модуль авторизации (`js/auth/auth.js`)

```javascript
class Auth {
    constructor() {
        this.token = localStorage.getItem('aerobeat-jwt');
        this.user = null;
        this._listeners = [];
    }

    /** Проверить валидность токена при запуске */
    async init() {
        if (!this.token) return;
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.ok) {
                this.user = await res.json();
                this._notify();
            } else {
                this.logout(); // токен протух
            }
        } catch { /* offline или сервер недоступен — оставляем как есть */ }
    }

    async register(username, password, email) { /* POST /api/auth/register */ }
    async login(username, password) { /* POST /api/auth/login */ }
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('aerobeat-jwt');
        this._notify();
    }

    /** Подписка на изменение состояния авторизации */
    onChange(callback) { this._listeners.push(callback); }
    _notify() { this._listeners.forEach(cb => cb(this.user)); }
}
```

**Хранение токена:** `localStorage` с ключом `aerobeat-jwt`. При logout — удаление.

**Auto-login:** При загрузке страницы `auth.init()` проверяет токен — если валиден, загружает данные пользователя.

**Reactive UI:** `auth.onChange(callback)` — колбэк вызывается при login/logout. Все UI-компоненты (Profile screen, nav bar) подписываются и перерисовываются.

#### 4.16.6. Зависимости (package.json)

Добавлены в `dependencies`:
```json
{
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "express-rate-limit": "^7.1.5"
}
```

- `bcryptjs` — pure JS bcrypt (без нативных зависимостей, работает везде).
- `jsonwebtoken` — JWT создание и верификация.
- `express-rate-limit` — rate limiting middleware.

### 4.17. Схема БД — таблица `game_results`

Хранение результатов каждой игры для истории и статистики профиля.

```sql
CREATE TABLE game_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  track_id      INTEGER,
  track_title   TEXT NOT NULL,
  score         INTEGER NOT NULL,
  accuracy      REAL NOT NULL,       -- 0..100
  grade         TEXT NOT NULL,       -- 'S', 'A', 'B', 'C', 'D'
  max_combo     INTEGER NOT NULL,
  perfect_count INTEGER NOT NULL,
  good_count    INTEGER NOT NULL,
  miss_count    INTEGER NOT NULL,
  total_notes   INTEGER NOT NULL,
  played_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

CREATE INDEX idx_results_user ON game_results(user_id);
CREATE INDEX idx_results_track ON game_results(track_id);
CREATE INDEX idx_results_played ON game_results(played_at);
```

**Принципы:**
- `user_id` — обязательный (результат привязан к пользователю).
- `track_id` — опциональный (NULL если трек удалён из Library).
- `track_title` — дублируется для случая, если трек будет удалён (история сохраняется).
- `ON DELETE CASCADE` для user → если пользователь удалён, его результаты удаляются.
- `ON DELETE SET NULL` для track → если трек удалён, `track_id` становится NULL, но `track_title` остаётся.

### 4.18. REST API — Результаты игр

##### `POST /api/results` — сохранить результат игры (защищённый)

**Тело запроса (JSON):**
```json
{
  "track_id": 1,
  "track_title": "My Song",
  "score": 125000,
  "accuracy": 92.5,
  "grade": "A",
  "max_combo": 150,
  "perfect_count": 280,
  "good_count": 40,
  "miss_count": 12,
  "total_notes": 332
}
```

**Логика:**
1. `authenticateToken` → `req.user.id`.
2. Валидация обязательных полей.
3. Вставка в `game_results`.
4. Вернуть 201: `{ id, played_at }`.

**Примечание:** Если пользователь не авторизован — фронтенд не отправляет запрос (игра работает без сохранения истории).

##### `GET /api/users/:id/history` — история игр пользователя (публичный)

**Ответ (200):**
```json
{
  "history": [
    {
      "id": 1,
      "track_title": "My Song",
      "score": 125000,
      "accuracy": 92.5,
      "grade": "A",
      "max_combo": 150,
      "played_at": "2025-01-15T12:00:00Z"
    }
  ]
}
```

- Сортировка: `played_at DESC` (новые сверху).
- Лимит: последние 50 игр (пагинация не требуется на данном этапе).
- Поля `perfect_count`, `good_count`, `miss_count`, `total_notes` не отдаются в списке (оптимизация).

##### `GET /api/users/:id/stats` — статистика пользователя (публичный)

**Ответ (200):**
```json
{
  "total_games": 42,
  "average_accuracy": 87.3,
  "best_grade": "S",
  "total_perfects": 8500,
  "favorite_track": "My Song",
  "joined_at": "2025-01-15T12:00:00Z"
}
```

- `total_games` — количество сыгранных игр.
- `average_accuracy` — средняя accuracy по всем играм.
- `best_grade` — лучший полученный грейд (S > A > B > C > D).
- `total_perfects` — общее количество perfect попаданий.
- `favorite_track` — трек, в котором больше всего игр (или NULL).
- `joined_at` — дата регистрации.

### 4.19. Экран Profile

**Назначение:** Управление аккаунтом, просмотр профиля и истории игр.

#### 4.19.1. Два состояния экрана

**Состояние 1: Неавторизованный пользователь**
Отображается форма авторизации/регистрации с переключением между вкладками.

**Состояние 2: Авторизованный пользователь**
Отображается профиль с информацией и историей игр.

#### 4.19.2. HTML-структура (добавить в `index.html`)

```html
<!-- 6. Profile Screen -->
<section class="hidden absolute inset-0 flex flex-col z-10" id="screen-profile">
    <!-- Заголовок + Back button (единый для обоих состояний) -->
    <div class="flex justify-between items-center p-6 pb-2">
        <h3 class="font-display-lg text-3xl text-primary-container font-extrabold italic">Profile</h3>
        <button class="glossy-button bg-gradient-to-b from-primary-container to-primary ..." id="profile-back">
            <span class="relative z-10 flex items-center gap-2">
                <span class="material-symbols-outlined text-lg">arrow_back</span>
                Back to menu
            </span>
        </button>
    </div>

    <!-- Состояние 1: Auth forms (показывается если !auth.isLoggedIn) -->
    <div class="flex-grow overflow-y-auto px-6 pb-6" id="profile-auth-view">
        <!-- Табы Login / Register -->
        <div class="flex gap-2 mb-6">
            <button class="glossy-button ... tab-active" id="tab-login">Login</button>
            <button class="glossy-button ... tab-inactive" id="tab-register">Register</button>
        </div>

        <!-- Login Form -->
        <div class="aero-glass rounded-[2rem] p-8 border-2 border-white/60" id="login-form">
            <div class="space-y-5">
                <div>
                    <label class="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest font-bold block mb-1.5">Username</label>
                    <input type="text" id="login-username" required minlength="3" maxlength="20"
                        class="w-full aero-glass rounded-xl px-5 py-3 font-body-md text-on-surface border border-white/50 focus:border-white/80 focus:outline-none transition-colors bg-white/20" />
                </div>
                <div>
                    <label class="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest font-bold block mb-1.5">Password</label>
                    <input type="password" id="login-password" required minlength="6"
                        class="w-full aero-glass rounded-xl px-5 py-3 font-body-md text-on-surface border border-white/50 focus:border-white/80 focus:outline-none transition-colors bg-white/20" />
                </div>
                <button type="submit" class="glossy-button bg-gradient-to-b from-secondary-container to-secondary text-white font-headline-md px-10 py-3 rounded-full shadow-xl text-lg hover:scale-105 active:scale-95 w-full">
                    <span class="relative z-10">Login</span>
                </button>
            </div>
        </div>

        <!-- Register Form (скрыт по умолчанию) -->
        <div class="aero-glass rounded-[2rem] p-8 border-2 border-white/60 hidden" id="register-form">
            <div class="space-y-5">
                <div>
                    <label class="font-label-sm ...">Username</label>
                    <input type="text" id="register-username" required minlength="3" maxlength="20"
                        class="w-full aero-glass rounded-xl px-5 py-3 ..." />
                    <span class="font-label-sm text-on-surface-variant/50 text-[10px] mt-1 block">3–20 characters, letters, numbers, _ -</span>
                </div>
                <div>
                    <label class="font-label-sm ...">Password</label>
                    <input type="password" id="register-password" required minlength="6"
                        class="w-full aero-glass rounded-xl px-5 py-3 ..." />
                    <span class="font-label-sm text-on-surface-variant/50 text-[10px] mt-1 block">Minimum 6 characters</span>
                </div>
                <div>
                    <label class="font-label-sm ...">Email (optional)</label>
                    <input type="email" id="register-email"
                        class="w-full aero-glass rounded-xl px-5 py-3 ..." />
                </div>
                <button type="submit" class="glossy-button bg-gradient-to-b from-secondary-container to-secondary text-white font-headline-md px-10 py-3 rounded-full shadow-xl text-lg hover:scale-105 active:scale-95 w-full">
                    <span class="relative z-10">Create Account</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Состояние 2: Profile view (показывается если auth.isLoggedIn) -->
    <div class="flex-grow overflow-y-auto px-6 pb-6 hidden" id="profile-user-view">
        <!-- User info card -->
        <div class="aero-glass rounded-[2rem] p-8 border-2 border-white/60 mb-6">
            <div class="flex items-center gap-6">
                <!-- Avatar circle -->
                <div class="w-20 h-20 rounded-full bg-gradient-to-br from-primary-container to-secondary flex items-center justify-center">
                    <span class="material-symbols-outlined text-4xl text-white">person</span>
                </div>
                <div>
                    <h2 class="font-display-lg text-2xl text-on-surface" id="profile-display-name">Player One</h2>
                    <p class="font-body-md text-on-surface-variant" id="profile-username">@player1</p>
                    <p class="font-label-sm text-on-surface-variant/50" id="profile-joined">Joined Jan 2025</p>
                </div>
            </div>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="aero-glass rounded-2xl p-5 border border-white/50 text-center">
                <span class="font-display-lg text-3xl text-secondary" id="stat-total-games">0</span>
                <p class="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest mt-1">Games</p>
            </div>
            <div class="aero-glass rounded-2xl p-5 border border-white/50 text-center">
                <span class="font-display-lg text-3xl text-primary-container" id="stat-avg-accuracy">0%</span>
                <p class="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest mt-1">Avg Accuracy</p>
            </div>
            <div class="aero-glass rounded-2xl p-5 border border-white/50 text-center">
                <span class="font-display-lg text-3xl text-yellow-500" id="stat-best-grade">—</span>
                <p class="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest mt-1">Best Grade</p>
            </div>
            <div class="aero-glass rounded-2xl p-5 border border-white/50 text-center">
                <span class="font-display-lg text-3xl text-on-surface" id="stat-total-perfects">0</span>
                <p class="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest mt-1">Perfects</p>
            </div>
        </div>

        <!-- Game history -->
        <h4 class="font-headline-md text-lg text-on-surface mb-4">Recent Games</h4>
        <div class="space-y-3" id="profile-history-list">
            <!-- Динамически заполняется карточками результатов -->
        </div>
        <div class="hidden text-center py-8" id="profile-history-empty">
            <span class="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-3">sports_esports</span>
            <p class="font-body-md text-on-surface-variant/60">No games played yet.</p>
        </div>

        <!-- Logout button -->
        <button class="glossy-button bg-gradient-to-b from-red-400 to-red-600 text-white font-headline-md px-10 py-3 rounded-full shadow-xl text-lg hover:scale-105 active:scale-95 w-full mt-6" id="profile-logout">
            <span class="relative z-10 flex items-center gap-2 justify-center">
                <span class="material-symbols-outlined text-xl">logout</span>
                Logout
            </span>
        </button>
    </div>
</section>
```

#### 4.19.3. UI-компонент: карточка результата в истории

```html
<div class="aero-glass rounded-2xl p-4 border border-white/50 flex items-center justify-between">
    <div class="flex-1">
        <p class="font-headline-md text-on-surface text-sm">My Song</p>
        <p class="font-label-sm text-on-surface-variant/60 text-[10px]">Jan 15, 2025</p>
    </div>
    <div class="flex items-center gap-4">
        <div class="text-right">
            <p class="font-body-md text-on-surface font-bold">125,000</p>
            <p class="font-label-sm text-on-surface-variant/60 text-[10px]">92.5%</p>
        </div>
        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-200 to-orange-400 flex items-center justify-center">
            <span class="font-display-lg text-xl font-black text-white drop-shadow">A</span>
        </div>
    </div>
</div>
```

#### 4.19.4. Клиентская логика (`js/ui/profile.js`)

```javascript
export function initProfile(auth) {
    auth.onChange(user => renderProfile(user));

    // Tab switching (Login / Register)
    // Login: click → auth.login(username, password)
    // Register: click → auth.register(username, password, email)
    // Logout: click → auth.logout()
    // History loading: GET /api/users/:id/history
    // Stats loading: GET /api/users/:id/stats
}

function renderProfile(user) {
    if (user) {
        // Show profile-user-view, hide profile-auth-view
        // Fill display_name, username, stats
        // Load history
    } else {
        // Show profile-auth-view, hide profile-user-view
        // Reset forms
    }
}
```

#### 4.19.5. Интеграция с `app.js`

```javascript
// В DOMContentLoaded:
import { Auth } from './auth/auth.js';
import { initProfile } from './ui/profile.js';

const auth = new Auth();
auth.init().then(() => {
    initProfile(auth);
});
```

#### 4.19.6. Сохранение результата игры

В `handleGameEnd()` (app.js), после вычисления accuracy и grade:

```javascript
if (auth && auth.isLoggedIn) {
    try {
        await fetch('/api/results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                track_id: currentTrackId || null,
                track_title: currentBeatmap.metadata.title,
                score: scoringState.score,
                accuracy,
                grade,
                max_combo: scoringState.maxCombo,
                perfect_count: scoringState.perfectCount,
                good_count: scoringState.goodCount,
                miss_count: scoringState.missCount,
                total_notes: currentBeatmap.notes.length
            })
        });
    } catch { /* тихо — результат не критичен */ }
}
```

#### 4.19.7. Навигация

```
Bottom Nav Bar: Profile → navigate('screen-profile')
```

Profile button в nav bar:
- Если не авторизован: показывает иконку `person` (серая).
- Если авторизован: показывает иконку `person` (цветная).

## 5. UI/UX (из prototype/code.html)

### 5.1. Глобальные стили
- **Фон:** В текущей реализации — aurora gradient `linear-gradient(160deg, #b8e6d0 0%, #7ec8e3 35%, #4fc3f7 70%, #81d4fa 100%)` с анимированными ribbon-слоями. В прототипе: `linear-gradient(135deg, #c6e7ff 0%, #00aeef 40%, #004c6b 100%)`.
- **Glassmorphism:** `backdrop-filter: blur(20px)`, `background: rgba(255,255,255,0.3)`, `border: 1.5px solid rgba(255,255,255,0.5)`, `box-shadow: 0 8px 32px rgba(0,51,102,0.15), inset 0 0 8px rgba(255,255,255,0.3)`.
- **Шрифты:** Plus Jakarta Sans (display, headlines), Work Sans (body, labels).
- **Иконки:** Material Symbols Outlined (Google Fonts CDN).
- **Анимированные пузырьки:** 25 `div.bubble` с `@keyframes float-up`, абсолютное позиционирование. Варианты: standard, large, tinted.

### 5.2. Кнопки (Frutiger Aero glossy)
- Градиент `linear-gradient(to bottom, top_color, bottom_color)`.
- Gloss overlay: `::before` pseudo-element — белый эллиптический градиент сверху (40% высоты, border-radius 50%/100% 100% 0 0).
- `border: 1.5px solid rgba(255,255,255,0.8)`.
- `box-shadow: 0 6px 20px rgba(0,0,0,0.15), inset 0 -6px 12px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.9)`.
- `:active` → `transform: scale(0.96)`, inner shadow.

### 5.3. Прогресс-бар (liquid-fill)
- Капсула: glass-контейнер `rounded-full`, padding 1.5px.
- Fill: `linear-gradient(to bottom, #b8f568, #426900, #b8f568)`.
- Specular highlight: белая полоса по центру (::after pseudo-element).

### 5.4. Ноты (water-drop)
- CSS: `border-radius: 50%`, `background: radial-gradient(circle at 30% 30%, #fff 0%, #00aeef 60%, #004c6b 100%)`.
- `box-shadow: 0 4px 10px rgba(0,0,0,0.3), inset -2px -2px 6px rgba(0,0,0,0.2)`.
- `will-change: transform` для GPU-ускорения.

### 5.5. Рецепторы (glass wells)
- `backdrop-filter: blur(20px)`, `border: 4px solid rgba(0,101,141,0.2)`.
- `box-shadow: inset 0 4px 10px rgba(0,0,0,0.15)`.
- Клавиша по центру (D/F/J/K).
- **Flash-эффект:** при попадании — `border-color: rgba(184,245,104,0.8)` + `box-shadow: 0 0 20px rgba(184,245,104,0.5)` на 120мс.

### 5.6. Gameplay — perspective track
- `transform: perspective(600px) rotateX(45deg)`.
- 5 вертикальных divider-линий (`bg-white/40`).
- **Countdown overlay** (`z-index: 300`, `pointer-events: none`): полупрозрачный оверлей с пульсирующим кольцом и цифрами 3→2→1 (pop-анимация + fade). Отображается во время freeze-фазы (3 сек).

### 5.7. Results screen
- Glass-панель `rounded-[3rem]`.
- Grade: `text-[140px]`, `bg-clip-text text-transparent bg-gradient-to-b from-yellow-200 via-orange-400 to-yellow-600`.
- Glow: `blur-3xl bg-yellow-400/30` за грейдом.
- Двухколоночная раскладка: stats слева, grade справа.

### 5.8. Hit Feedback
- Floating text (`hit-text`): «Perfect!» / «Good» / «Miss» с анимацией `hit-float` (0.6s, translateY(-60px) + scale(1.2) + opacity 0).
- **Particles:** зелёные (Perfect, 8 шт.), голубые (Good, 4 шт.) искры с CSS-анимацией `particle-burst`.
- Цвета: perfect = green (`#b8f568`), good = blue (`#82cfff`), miss = error red.

### 5.9. Pause Overlay
- `backdrop-filter: blur(8px)`, `background: rgba(0,28,60,0.6)`.
- Заголовок «Paused» + две кнопки: Resume (green glossy) / Quit (red glossy).

### 5.10. Aurora Background
- Animated aurora gradient + 5 ribbon layers (`.aurora-ribbon`) с CSS-анимацией `aurora-shift` (20-25s infinite alternate).
- Цвета ribbon: green (`rgba(184,245,104,0.35)`), blue (`rgba(0,174,239,0.3)`), white (`rgba(255,255,255,0.2)`).

## 6. План выполнения по фазам

### Фаза 1: Инфраструктура и базовый HTML ✅
**Статус:** Завершена.

1. ✅ Создать `index.html` с базовой разметкой и подключением Tailwind CDN.
2. ✅ Подключить Google Fonts (Plus Jakarta Sans, Work Sans) + Material Symbols Outlined.
3. ✅ Создать `css/style.css` с CSS-переменными из DESIGN.md.
4. ✅ Создать `js/app.js` — заглушка, проверка что JS работает.
5. ✅ Tailwind config с кастомными цветами, шрифтами, spacing.

### Фаза 2: Аудио-модули ✅ (анализатор удалён, будет переписан)
**Статус:** Завершена (без анализатора).

1. ✅ **`js/audio/player.js`** — AudioPlayer на Web Audio API с GainNode для volume.
2. ~~**`js/audio/analyzer.js`**~~ — **Удалён.** Будет создан новый модуль в Фазе 8.

### Фаза 3: Игровая механика ✅
**Статус:** Завершена.

1. ✅ **`js/game/conductor.js`** — спавн/деспавн, позиционирование нот, трекинг видимости, фаза freeze, early break оптимизация.
2. ✅ **`js/game/note.js`** — Object Pooling (60 элементов).
3. ✅ **`js/game/receptor.js`** — рецепторы + flash-эффект + getLaneX/getReceptorY.
4. ✅ **`js/game/hitDetection.js`** — categorizeHit, isHitValid, константы окон.
5. ✅ **`js/game/scoring.js`** — очки, комбо, множитель, accuracy, grade.
6. ✅ **Freeze phase** — 3-секундная заморозка нот перед стартом.
7. ✅ **Countdown overlay** — визуальный отсчёт 3→2→1.
8. ✅ **Тесты:** `tests/scoring.test.js` (16 tests), `tests/hitDetection.test.js` (6 tests).

### Фаза 4: Экраны и навигация ✅
**Статус:** Завершена.

1. ✅ **`js/ui/screens.js`** — переключение экранов + `setOnLeaveGameplay`.
2. ✅ **`js/ui/menu.js`** — bubbles, file input, drag-drop.
3. ✅ **`js/ui/loading.js`** — progress bar.
4. ✅ **`js/ui/hud.js`** — score, combo, progress, song title.
5. ✅ **`js/ui/results.js`** — grade glow, stats layout.
6. ✅ **`js/ui/notifications.js`** — toast-уведомления.
7. ✅ **Drag & Drop** — загрузка файла через drag на game viewport.
8. ✅ **Bottom Nav Bar** — Play, Library (заглушка), Social (заглушка), Profile.

### Фаза 5: Сервер и база данных ✅
**Статус:** Завершена.

1. ✅ **`package.json`** — зависимости: `express`, `better-sqlite3`, `multer`, `cors`. Скрипты: `server`, `test`.
2. ✅ **`server/db.js`** — инициализация SQLite, schema tracks, WAL mode, foreign keys.
3. ✅ **`server/server.js`** — Express server, middleware (CORS, JSON, URL-encoded), static files, маршруты.
4. ✅ **`server/routes/tracks.js`** — CRUD:
   - `GET /api/tracks` — список треков (без beatmap, без file_path).
   - `GET /api/tracks/:id` — полные данные + beatmap JSON + file_path.
   - `POST /api/tracks` — публикация (multer + SHA-256 дедупликация + 409 Conflict).
   - `DELETE /api/tracks/:id` — удаление (файл + запись).
5. ✅ **Static serving:** Express раздаёт корень проекта + `uploads/`.
6. ✅ **Health check:** `GET /api/health`.

### Фаза 6: Авторизация и профиль ✅
**Статус:** Завершена.

1. ✅ **`server/db.js`** — таблица `users` (id, username, email, password_hash, display_name, created_at) + индексы.
2. ✅ **`server/routes/auth.js`** — `POST /register`, `POST /login`, `GET /me`, `PUT /profile`, middleware `authenticateToken`, rate limiting (20 req/min).
3. ✅ **`server/server.js`** — auth-роутер подключён на `/api/auth`.
4. ✅ **`js/auth/auth.js`** — класс `Auth`: JWT в localStorage (`aerobeat-jwt`), init/register/login/logout, onChange.
5. ✅ **`js/ui/profile.js`** — экран Profile: login/register forms (tab switching), profile view (avatar, username, logout).
6. ✅ **`index.html`** — `<section id="screen-profile">` с auth forms и profile view.
7. ✅ **`js/ui/screens.js`** — `'screen-profile'` в `SCREEN_IDS`.
8. ✅ **`js/app.js`** — Auth init, initProfile(auth), nav bar Profile → navigate, Social → toast.
9. ✅ **`tests/auth.test.js`** — 13 tests: register/login/me/middleware.

### Фаза 7: Polish и VFX ✅
**Статус:** Завершена.

1. ✅ **Hit feedback:** floating text (Perfect!/Good/Miss) с анимацией вверх + fade.
2. ✅ **Particles:** зелёные (Perfect) и голубые (Good) искры (CSS-анимации).
3. ✅ **Receptor flash:** вспышка border-color при попадании (120мс).
4. ✅ **Stop button:** выход в меню во время игры.
5. ✅ **Pause system:** Escape = пауза, Resume/Quit overlay.
6. ✅ **Volume control:** вертикальный слайдер справа от viewport, persistent volume.
7. ✅ **Menu music:** фоновая музыка с loop и fade-in/out (`assets/audio/main-theme.mp3`).
8. ✅ **Drag & Drop:** загрузка файла через drag.
9. ✅ **Responsive Design:** адаптивные стили для 768px и 480px.
10. ✅ **Aurora Background:** анимированный gradient с ribbon-слоями.
11. ✅ **Click SFX:** звук клика по кнопкам.

### Фаза 8: Анализатор треков
**Статус:** Не реализована.

**Контекст:** Предыдущий анализатор (`js/audio/analyzer.js`) удалён. Нужно создать новый модуль генерации beatmap из аудиофайла.

**Зависимости:** Нет. Работает на чистом Web Audio API.

---

#### 8.1. Требования к модулю `js/audio/analyzer.js`

**Вход:** `File` объект + `onProgress` callback.
**Выход:** Beatmap object `{ metadata: {...}, notes: [...] }`.

**Алгоритм (базовый):**
1. `File` → `ArrayBuffer` → `AudioContext.decodeAudioData()`.
2. Извлечение PCM из `AudioBuffer.getChannelData(0)`.
3. Анализ энергии по частотным полосам (IIR-фильтры или FFT).
4. Detection onsets в каждой полосе.
5. Маппинг полос на 4 дорожки (D/F/J/K).
6. BPM-детекция для метаданных.
7. Кэширование в `localStorage`.

**Ключевые константы:**
- `LANE_MIN_GAP`: 0.09 сек — мин. интервал между нотами на одном лене.
- `GLOBAL_MIN_GAP`: 0.04 сек — мин. интервал между любыми нотами.

**Ошибки:** Всегда показывать в UI (toast), не в console.

---

#### 8.2. Интеграция с `app.js`

В `handleFileLoad()`:
```javascript
currentBeatmap = await generateBeatmap(file, (progress) => {
    setLoadingProgress(progress);
});
setBpmLabel(`${currentBeatmap.metadata.bpm} BPM DETECTED`);
```

---

#### 8.3. Тесты

**Файл:** `tests/analyzer.test.js`

Тесты на синтетических данных (метроном-волна):
1. `generateBeatmap` возвращает beatmap с metadata и notes.
2. Ноты имеют time и track.
3. onProgress callback вызывается.
4. Кэширование работает (второй вызов из кеша).
5. `getCachedBeatmap` возвращает null для нового файла.
6. `cacheBeatmap` сохраняет и извлекает.

---

#### 8.4. Чеклист для агента

1. **`js/audio/analyzer.js`** — создать модуль.
2. **`tests/analyzer.test.js`** — написать тесты.
3. **`js/app.js`** — подключить `generateBeatmap` в `handleFileLoad`.
4. **`npm test`** — все тесты зелёные.
5. **SPEC.md** — обновить статус Фазы 8 на ✅ DONE.

### Фаза 9: История игр и результаты
**Статус:** Не реализована.

**Контекст:** Базовая авторизация и профиль уже работают (Фаза 6). Сейчас при завершении игры результат не сохраняется. Нужно: сохранять результат каждой игры на сервере, показывать историю в профиле, показывать статистику.

**Зависимости:** Дополнительные пакеты не нужны — всё работает на существующих `better-sqlite3` + `jsonwebtoken`.

---

#### 9.1. Backend: таблица `game_results`

**Файл:** `server/db.js` — добавить в `initSchema()` после таблицы `users`:

```sql
CREATE TABLE IF NOT EXISTS game_results (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    track_id      INTEGER,
    track_title   TEXT NOT NULL,
    score         INTEGER NOT NULL,
    accuracy      REAL NOT NULL,
    grade         TEXT NOT NULL,
    max_combo     INTEGER NOT NULL,
    perfect_count INTEGER NOT NULL,
    good_count    INTEGER NOT NULL,
    miss_count    INTEGER NOT NULL,
    total_notes   INTEGER NOT NULL,
    played_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_results_user ON game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_track ON game_results(track_id);
CREATE INDEX IF NOT EXISTS idx_results_played ON game_results(played_at);
```

**Важно:**
- `user_id` — обязательный (результат привязан к пользователю).
- `track_id` — опциональный (NULL если трек удалён).
- `track_title` — дублируется на случай удаления трека.
- `ON DELETE CASCADE` для user, `ON DELETE SET NULL` для track.

---

#### 9.2. Backend: маршруты результатов

**Новый файл:** `server/routes/results.js`

Импорты: `Router` из `express`, `getDb` из `../db.js`, `authenticateToken` из `./auth.js`.

**Маршруты:**

##### `POST /api/results` — сохранить результат (защищённый)

Тело запроса (JSON):
```json
{
    "track_id": 1,
    "track_title": "My Song",
    "score": 125000,
    "accuracy": 92.5,
    "grade": "A",
    "max_combo": 150,
    "perfect_count": 280,
    "good_count": 40,
    "miss_count": 12,
    "total_notes": 332
}
```

Логика:
1. `authenticateToken` → `req.user.id`.
2. Валидация обязательных полей (score, accuracy, grade, max_combo, perfect_count, good_count, miss_count, total_notes).
3. `track_id` опциональный (может быть null для локальных файлов).
4. Вставка в `game_results`.
5. Вернуть 201: `{ id, played_at }`.

Ошибки:
- 400 — невалидные данные.
- 401 — не авторизован.
- 500 — ошибка сервера.

##### `GET /api/users/:id/history` — история игр (публичный)

Параметр: `id` — ID пользователя.

Ответ (200):
```json
{
    "history": [
        {
            "id": 1,
            "track_title": "My Song",
            "score": 125000,
            "accuracy": 92.5,
            "grade": "A",
            "max_combo": 150,
            "played_at": "2025-01-15T12:00:00Z"
        }
    ]
}
```

- Сортировка: `played_at DESC` (новые сверху).
- Лимит: последние 50 игр.
- Поля `perfect_count`, `good_count`, `miss_count`, `total_notes` не отдаются в списке.

##### `GET /api/users/:id/stats` — статистика пользователя (публичный)

Ответ (200):
```json
{
    "total_games": 42,
    "average_accuracy": 87.3,
    "best_grade": "S",
    "total_perfects": 8500,
    "favorite_track": "My Song",
    "joined_at": "2025-01-15T12:00:00Z"
}
```

- `total_games` — COUNT(*).
- `average_accuracy` — AVG(accuracy).
- `best_grade` — лучший грейд (S > A > B > C > D). Вычислять через CASE WHEN или на JS.
- `total_perfects` — SUM(perfect_count).
- `favorite_track` — трек с наибольшим количеством игр (GROUP BY track_title ORDER BY COUNT(*) DESC LIMIT 1).
- `joined_at` — из таблицы `users`.

---

#### 9.3. Backend: подключение роутера

**Файл:** `server/server.js`

Добавить импорт и подключение:
```javascript
import resultsRouter from './routes/results.js';
app.use('/api', resultsRouter);
```

Подключить **после** auth-роутера (нужен `authenticateToken`).

---

#### 9.4. Frontend: сохранение результата игры

**Файл:** `js/app.js` — функция `handleGameEnd()`

После вычисления `accuracy` и `grade` (после строки `showResults(...)`), добавить:

```javascript
if (auth && auth.isLoggedIn) {
    try {
        await fetch('/api/results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                track_id: currentTrackId || null,
                track_title: currentBeatmap.metadata.title,
                score: scoringState.score,
                accuracy,
                grade,
                max_combo: scoringState.maxCombo,
                perfect_count: scoringState.perfectCount,
                good_count: scoringState.goodCount,
                miss_count: scoringState.missCount,
                total_notes: currentBeatmap.notes.length
            })
        });
    } catch { /* тихо — результат не критичен */ }
}
```

**Важно:** `currentTrackId` — переменная, которая задаётся при запуске игры ( null для локальных файлов). Нужно добавить переменную `currentTrackId` в state app.js.

---

#### 9.5. Frontend: обновление Profile screen

**Файл:** `js/ui/profile.js`

В `renderProfile(user)` — когда `user` не null, после отображения базовой информации загружать историю и статистику:

```javascript
// Загрузка статистики
const statsRes = await fetch(`/api/users/${user.id}/stats`);
const stats = await statsRes.json();
// Заполнить элементы: stat-total-games, stat-avg-accuracy, stat-best-grade, stat-total-perfects

// Загрузка истории
const historyRes = await fetch(`/api/users/${user.id}/history`);
const { history } = await historyRes.json();
// Отрисовать карточки результатов в #profile-history-list
```

**HTML-элементы** (уже есть в `index.html` секции `#screen-profile`):
- `#stat-total-games` — span для числа игр.
- `#stat-avg-accuracy` — span для средней accuracy.
- `#stat-best-grade` — span для лучшего грейда.
- `#stat-total-perfects` — span для общего числа perfects.
- `#profile-history-list` — контейнер для карточек результатов.
- `#profile-history-empty` — заглушка «No games played yet».

**Карточка результата** (HTML-шаблон из SPEC 4.21.3):
```html
<div class="aero-glass rounded-2xl p-4 border border-white/50 flex items-center justify-between">
    <div class="flex-1">
        <p class="font-headline-md text-on-surface text-sm">{track_title}</p>
        <p class="font-label-sm text-on-surface-variant/60 text-[10px]">{formatted_date}</p>
    </div>
    <div class="flex items-center gap-4">
        <div class="text-right">
            <p class="font-body-md text-on-surface font-bold">{formatted_score}</p>
            <p class="font-label-sm text-on-surface-variant/60 text-[10px]">{accuracy}%</p>
        </div>
        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-200 to-orange-400 flex items-center justify-center">
            <span class="font-display-lg text-xl font-black text-white drop-shadow">{grade}</span>
        </div>
    </div>
</div>
```

Форматирование:
- `formatted_score`: число с разделителем тысяч (125000 → "125,000").
- `formatted_date`: "Jan 15, 2025" (через `Date.toLocaleDateString`).

---

#### 9.6. Тесты

**Новый файл:** `tests/results.test.js`

Тесты через Express test server (аналогично `tests/auth.test.js`):
1. `POST /api/results` — успешное сохранение / без авторизации / невалидные данные.
2. `GET /api/users/:id/history` — возвращает историю / пустая история.
3. `GET /api/users/:id/stats` — возвращает статистику / нулевая статистика.

---

#### 9.7. Чеклист для агента

1. **`server/db.js`** — добавить таблицу `game_results` + индексы в `initSchema()`.
2. **`server/routes/results.js`** — создать файл: POST /api/results, GET /api/users/:id/history, GET /api/users/:id/stats.
3. **`server/server.js`** — импортировать и подключить `resultsRouter`.
4. **`js/app.js`** — добавить `currentTrackId` в state, вызывать POST /api/results в `handleGameEnd` (если авторизован).
5. **`js/ui/profile.js`** — загружать и отображать статистику + историю в `renderProfile`.
6. **`tests/results.test.js`** — тесты для всех эндпоинтов.
7. **`npm test`** — все тесты зелёные.
8. **SPEC.md** — обновить статус Фазы 9 на ✅ DONE.

## 7. Правила разработки

### Frontend
1. **Прототип — закон.** Визуал должен на 100% совпадать с `prototype/code.html`. Если CSS-свойство недоступно — найти кроссбраузерный аналог.
2. **Web Audio API только.** Никаких сторонних библиотек для аудио. Web Audio API даёт субмиллисекундную точность.
3. **CSS-анимации优先.** Для движения нот, fade, particles — CSS `transform` + `transition`/`@keyframes`. JavaScript только для логики (позиция ноты = math).
4. **Минимум зависимостей.** Tailwind CDN, Google Fonts CDN. Больше ничего.
5. **Чистый JS.** Без фреймворков (React, Vue, etc.). Vanilla JS + DOM.
6. **Ошибки в UI.** Никаких `alert()` или `console.error()` для пользователя — только стилизованные toast.
7. **Нет блокирующих операций.** Аудио-операции — `async/await`. Main thread никогда не блокируется.
8. **API-вызовы через fetch.** Все запросы к серверу — `async/await` + `try/catch` + UI-fallback.

### Backend
9. **SQLite — zero config.** Файл БД `server/aerobeat.db` создаётся автоматически при первом запуске. WAL mode.
10. **Дедупликация по хешу.** SHA-256 от содержимого файла. Один файл = одна запись на диске.
11. **Beatmap хранится в БД.** JSON сериализуется в текстовую колонку. При загрузке трека beatmap десериализуется и передаётся клиенту без повторного анализа.
12. **Multer для загрузки.** Валидация: `.mp3`, `.ogg`, `.wav`, `.flac`. Макс. размер: 50MB. Temp файл → hash rename.
13. **CORS включён.** Frontend может быть на любом порту/API.
14. **Статика.** Express раздаёт корень проекта + `uploads/` — аудиофайлы доступны по прямому URL.
15. **Ошибки → JSON.** Все API-ответы — JSON с полем `error` при ошибке.

## 8. Known Issues

1. **Анализатор удалён:** модуль `js/audio/analyzer.js` удалён. Новый анализатор будет создан в Фазе 8. Без анализатора gameplay не запускает ноты (currentBeatmap = null).

2. **Фон отличается от прототипа:** в прототипе `linear-gradient(135deg, #c6e7ff 0%, #00aeef 40%, #004c6b 100%)`, в реализации — aurora gradient с ribbon-слоями. Визуально красивее, но не совпадает с референсом.

3. **Social — заглушка:** кнопка Social в bottom nav bar не имеет функционала (показывает toast «Coming soon»).

4. **Library — заглушка:** кнопка Library в bottom nav bar не имеет функционала (показывает toast «Coming soon»).
