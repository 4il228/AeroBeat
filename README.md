# AeroBeat — Rhythm Experience

Браузерная музыкальная ритм-игра в эстетике **Frutiger Aero** с автоматической генерацией beatmap из аудиофайлов, серверным хранилищем треков и системой авторизации.

---

## Содержание

- [Описание проекта](#описание-проекта)
- [Скриншот](#скриншот)
- [Технологический стек](#технологический-стек)
- [Файловая структура](#файловая-структура)
- [Быстрый старт](#быстрый-старт)
- [Архитектура](#архитектура)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Взаимодействие Frontend ↔ Backend](#взаимодействие-frontend--backend)
- [Игровая механика](#игровая-механика)
  - [Конфигурация](#конфигурация)
  - [Система нот и позиционирование](#система-нот-и-позиционирование)
  - [Детекция попаданий](#детекция-попаданий)
  - [Система очков](#система-очков)
  - [Object Pooling](#object-pooling)
  - [Freeze Phase и Countdown](#freeze-phase-и-countdown)
- [Аудио-модули](#аудио-модули)
  - [AudioPlayer (Web Audio API)](#audioplayer-web-audio-api)
  - [Menu Music](#menu-music)
  - [Volume Control](#volume-control)
  - [Beatmap Analyzer](#beatmap-analyzer)
- [Экраны и навигация](#экраны-и-навигация)
  - [Схема навигации](#схема-навигации)
  - [Главное меню](#главное-меню)
  - [Загрузка](#загрузка)
  - [Геймплей](#геймплей)
  - [Результаты](#результаты)
  - [Профиль](#профиль)
  - [Bottom Nav Bar](#bottom-nav-bar)
- [Авторизация](#авторизация)
  - [Безопасность](#безопасность)
  - [Клиентский модуль Auth](#клиентский-модуль-auth)
- [Серверная часть (Backend)](#серверная-часть-backend)
  - [Express Server](#express-server)
  - [База данных SQLite](#база-данных-sqlite)
  - [REST API — Треки](#rest-api--треки)
  - [REST API — Авторизация](#rest-api--авторизация)
  - [Дедупликация файлов](#дедупликация-файлов)
- [Дизайн-система (Frutiger Aero)](#дизайн-система-frutiger-aero)
  - [Палитра цветов](#палитра-цветов)
  - [Типографика](#типографика)
  - [Glassmorphism](#glassmorphism)
  - [Кнопки](#кнопки)
  - [Прогресс-бар](#прогресс-бар)
  - [Ноты (water-drop)](#ноты-water-drop)
  - [Рецепторы](#рецепторы)
  - [Анимации](#анимации)
  - [Фон (Aurora Background)](#фон-aurora-background)
- [Формат Beatmap](#формат-beatmap)
- [Модуль анализа треков (Phase 8)](#модуль-анализа-треков-phase-8)
  - [Пайплайн алгоритма](#пайплайн-алгоритма)
  - [Формат выходных данных](#формат-выходных-данных)
  - [Интеграция](#интеграция)
- [Тестирование](#тестирование)
- [Известные проблемы](#известные-проблемы)
- [Roadmap](#roadmap)
- [License](#license)

---

## Описание проекта

**AeroBeat** — это ритм-игра, вдохновлённая эстетикой Frutiger Aero середины 2000-х. Игрок загружает аудиофайл (MP3, OGG, WAV, FLAC), система автоматически анализирует его и генерирует ритм-карту (beatmap), после чего начинается геймплей: ноты падают сверху вниз к рецепторам, а игрок должен нажимать клавиши D/F/J/K в такт музыке.

**Ключевые особенности:**
- Автоматическая генерация beatmap из любого аудиофайла
- Визуальная эстетика Frutiger Aero (glassmorphism, glossy-кнопки, aurora-фон)
- Воспроизведение аудио через Web Audio API (субмиллисекундная точность)
- Система авторизации (JWT) с профилем и статистикой
- Серверное хранилище треков с REST API (Express + SQLite)
- Дедупликация аудиофайлов по SHA-256 хешу
- Система评分 с комбо, множителями, accuracy и грейдами
- Pause система, drag & drop, responsive design
- Тестирование через Vitest

**Целевой пользователь:** Казуальный игрок. Минимальный порог вхождения, интуитивно понятный UI.

---

## Скриншот

См. `prototype/screen.png` — визуальный референс проекта.

---

## Технологический стек

### Frontend

| Технология | Назначение |
|-----------|-----------|
| HTML5 | Семантическая разметка |
| CSS3 | Глобальные стили, CSS-переменные, `@keyframes` анимации, glassmorphism |
| Tailwind CSS (CDN) | Утилитарные стили, адаптивность |
| JavaScript (ES2022+) | Vanilla JS, модули (`export`/`import`), `class`, `async/await` |
| Web Audio API | `AudioContext`, `AudioBuffer`, `AudioBufferSourceNode`, `GainNode` |
| Google Fonts (CDN) | Plus Jakarta Sans, Work Sans |
| Material Symbols Outlined | Иконки (Google Fonts CDN) |

### Backend

| Пакет | Назначение |
|-------|-----------|
| Node.js (≥18 LTS) | Рантайм |
| Express.js | HTTP фреймворк, REST API |
| better-sqlite3 | SQLite — файловая БД, zero-config, WAL mode |
| multer | Загрузка multipart/form-data |
| cors | Разрешение кросс-доменных запросов |
| bcryptjs | Хеширование паролей (pure JS) |
| jsonwebtoken | JWT-токены (создание/верификация) |
| express-rate-limit | Rate limiting на auth-эндпоинтах |

### Тестирование

| Инструмент | Версия |
|-----------|--------|
| Vitest | ^1.6.0 |

---

## Файловая структура

```
aerobeat/
├── index.html                  # Точка входа (фронтенд)
├── package.json                # Зависимости backend + scripts
├── css/
│   └── style.css               # Глобальные стили, CSS-переменные, анимации, glassmorphism
├── js/
│   ├── app.js                  # Точка входа: инициализация, game loop, keyboard input, hit feedback
│   ├── auth/
│   │   └── auth.js             # JWT-токен, register/login/logout, reactive UI
│   ├── audio/
│   │   ├── player.js           # Web Audio API player (load/play/pause/stop/seek/volume)
│   │   └── menuMusic.js        # Web Audio API player для фоновой музыки меню (loop + fade)
│   ├── game/
│   │   ├── conductor.js        # Спавн/деспавн нот, синхронизация с временем, freeze phase, game loop
│   │   ├── note.js             # Note DOM-элемент + Object Pooling (60 элементов)
│   │   ├── receptor.js         # Receptor DOM-элемент + flash-эффект + позиционирование
│   │   ├── hitDetection.js     # categorizeHit, isHitValid, константы окон (Perfect/Good/Miss)
│   │   └── scoring.js          # Очки, комбо, множитель, accuracy, grade
│   └── ui/
│       ├── screens.js          # Переключение экранов (menu/loading/gameplay/results/profile)
│       ├── menu.js             # Главное меню: bubbles, file input, drag-drop
│       ├── loading.js          # Экран загрузки + progress bar
│       ├── hud.js              # In-game HUD (score, combo, progress, song title)
│       ├── results.js          # Экран результатов + grade glow
│       ├── profile.js          # Экран профиля: авторизация/регистрация + профиль
│       ├── notifications.js    # Toast-уведомления (ошибки, статус)
│       └── volumeControl.js    # Вертикальный слайдер громкости (Frutiger Aero стиль)
├── server/
│   ├── server.js               # Express server, middleware, static files, маршруты API
│   ├── db.js                   # SQLite: инициализация, schema (tracks, users), migrations
│   ├── routes/
│   │   ├── tracks.js           # CRUD /api/tracks (GET list, GET :id, POST publish, DELETE :id)
│   │   └── auth.js             # Авторизация: POST register, POST login, GET me, PUT profile
│   ├── uploads/
│   │   └── tracks/             # Хранилище аудиофайлов ({SHA-256 hash}.{ext})
│   └── aerobeat.db             # SQLite database файл (WAL mode)
├── assets/
│   ├── audio/
│   │   ├── main-theme.mp3      # Фоновая музыка меню
│   │   └── click-sfx.mp3       # Звук клика по кнопкам
│   └── icons/
│       └── favicon.png         # Favicon приложения
├── prototype/
│   ├── code.html               # Визуальный референс (единственный источник визуала)
│   ├── DESIGN.md               # Дизайн-система (палитра, типографика, компоненты)
│   └── screen.png              # Скриншот прототипа
├── tests/
│   ├── hitDetection.test.js    # Тесты детекции хитов (6 tests)
│   ├── scoring.test.js         # Тесты скоринга (16 tests)
│   └── auth.test.js            # Тесты авторизации (13 tests)
├── SPEC.md                     # Полная спецификация проекта
└── SUB_SPEC.md                 # Спецификация модуля анализа треков
```

---

## Быстрый старт

### Установка зависимостей

```bash
npm install
```

### Запуск сервера

```bash
npm run server
# или
npm start
```

Сервер запускается на `http://localhost:3000`.

### Запуск тестов

```bash
npm test
# или (watch mode)
npm run test:watch
```

### Использование

1. Откройте `http://localhost:3000` в браузере.
2. Загрузите аудиофайл (drag & drop или кнопка Upload).
3. Дождитесь генерации beatmap (прогресс-бар).
4. Играйте: нажимайте **D**, **F**, **J**, **K** когда ноты достигают рецепторов.

---

## Архитектура

### Frontend

Frontend построен на чистом Vanilla JS без фреймворков. Модульная архитектура с ES-модулями (`export`/`import`). Общение между модулями — через колбэки и события.

**Ключевые принципы:**
- **Web Audio API только** — никаких `<audio>` элементов. `AudioContext.currentTime` — единственный источник времени для синхронизации.
- **CSS-анимации优先** — ноты, рецепторы, HUD — DOM-элементы с `position: absolute` + `transform: translateY()`. Анимации через CSS `transition` и `@keyframes`.
- **Синхронизация — математика, не кадры** — позиция ноты ВСЕГДА вычисляется на основе `audioPlayer.currentTime`, не привязана к FPS.
- **Object Pooling** — пул из 60 DOM-элементов для нот (избегаем `createElement`/`remove` в game loop).

### Backend

Backend — Express.js сервер с REST API и SQLite базой данных.

**Ключевые принципы:**
- **SQLite — zero config** — файл БД `server/aerobeat.db` создаётся автоматически. WAL mode для конкурентного доступа.
- **Дедупликация по хешу** — SHA-256 от содержимого файла. Один файл = одна запись на диске.
- **Beatmap хранится в БД** — JSON сериализуется в текстовую колонку. При загрузке трека beatmap десериализуется без повторного анализа.
- **Multer для загрузки** — валидация: `.mp3`, `.ogg`, `.wav`, `.flac`. Макс. размер: 50MB.
- **CORS включён** — frontend может быть на любом порту.

### Взаимодействие Frontend ↔ Backend

- **Протокол:** HTTP REST API (JSON).
- **Порты:** Frontend — любой (dev-сервер или file://), Backend — `:3000`.
- **Коммуникация:** `fetch()` из браузера → Express API → SQLite / filesystem.

---

## Игровая механика

### Конфигурация

```javascript
const CONFIG = {
  LANE_COUNT: 4,
  LANE_KEYS: ['d', 'f', 'j', 'k'],
  LEAD_TIME: 2.0,           // сек — время полёта ноты
  NOTE_SPEED: 400,          // px/sec
  DESPAWN_TIME: 1.0,        // сек после прохождения рецептора
  HIT_WINDOW: 0.12,         // сек — макс. delta для попадания
  PERFECT_WINDOW: 0.050,    // сек (50мс)
  GOOD_WINDOW: 0.120,       // сек (120мс)
  INPUT_IGNORE_THRESHOLD: 0.5,
  POOL_SIZE: 60,            // max DOM-элементов нот одновременно
  FREEZE_OFFSET_PX: 100,    // px — первая нота замораживается на этом расстоянии выше рецептора
  FREEZE_DURATION: 3,       // сек — время freeze перед стартом игры
};
```

### Система нот и позиционирование

Ноты — DOM-элементы с `position: absolute`. Позиция вычисляется математически:

```javascript
const timeUntilHit = note.hitTime - audioPlayer.currentTime;
const noteY = receptorY - (timeUntilHit * NOTE_SPEED);
noteElement.style.transform = `translateY(${noteY}px)`;
```

**Деспавн:** когда `timeUntilHit < -DESPAWN_TIME` — нота удаляется из пула (`display: none`).

**Оптимизация:** итерация прерывается (`break`) при `timeUntilHit > LEAD_TIME` — ноты дальше в будущем не проверяются.

### Детекция попаданий

| Зона | Окно (мс) | Описание |
|------|----------|----------|
| Perfect | ≤ 50 | Идеальное попадание |
| Good | ≤ 120 | Хорошее попадание |
| Miss | > 120 | Промах |

При нажатии клавиши:
1. `tryHit(lane)` ищет ближайшую **видимую** unhit ноту на дорожке.
2. Проверка `delta <= HIT_WINDOW` (120мс).
3. `categorizeHit(delta)` определяет зону.
4. Начисляются очки, обновляется комбо.

### Система очков

| Зона | Базовые очки | Множитель |
|------|-------------|-----------|
| Perfect | 300 | `1 + floor(combo / 50)` |
| Good | 100 | `1 + floor(combo / 50)` |
| Miss | 0 | Комбо сбрасывается |

**Accuracy:** `(perfect + good) / total_notes * 100`

**Grade:** S (≥95%), A (≥85%), B (≥70%), C (≥50%), D (<50%)

### Object Pooling

Пул из 60 предсозданных DOM-элементов (div'ов). При спавне — `display: block` + привязка к индексу. При деспавне — `display: none`. Избегаем `document.createElement` / `element.remove()` в game loop — это вызывает GC.

### Freeze Phase и Countdown

Перед стартом игры — 3-секундная фаза заморозки:
1. Вычисляется `freezeTime = max(0, firstNote.time - FREEZE_OFFSET_PX / NOTE_SPEED)`.
2. Ноты позиционируются **один раз** без despawn/miss логики.
3. Клавиши не работают (`inputEnabled = false`).
4. Отображается countdown overlay (3→2→1) с pop-анимацией.
5. По истечении: очистка, `audioPlayer.seek(freezeTime)`, запуск `update()`.

---

## Аудио-модули

### AudioPlayer (Web Audio API)

```javascript
class AudioPlayer {
  ctx        // AudioContext (создаётся при init())
  source     // AudioBufferSourceNode
  gainNode   // GainNode (для volume)
  buffer     // AudioBuffer
  startTime  // ctx.currentTime when play() called
  pauseOffset
  playing
  _volume    // Master volume 0–1
}
```

**Ключевые моменты:**
- `AudioContext` создаётся только после user gesture (autoplay policy).
- `AudioContext.currentTime` — высокоточный timestamp (sub-millisecond).
- `pause()` сохраняет позицию ДО установки `playing = false`.
- `GainNode` между source и destination для управления громкостью.
- Поддержка play/pause/stop/seek/volume.

### Menu Music

Web Audio API плеер для фоновой музыки меню:
- `AudioBufferSourceNode` с `loop = true` для бесконечного повтора.
- Два `GainNode`: `masterGain` (общая громкость) × `fadeGain` (fade-in/out).
- `fadeIn(duration, targetVolume)` — плавное нарастание через `linearRampToValueAtTime`.
- `fadeOut(duration)` — плавное затухание до 0.
- Громкость по умолчанию: 0.35 (тише игрового аудио).

### Volume Control

Вертикальный слайдер громкости в стиле Frutiger Aero:
- Custom HTML: vertical `<input type="range">` с кастомными CSS-стилями.
- Иконка динамика: `volume_off` / `volume_mute` / `volume_down` / `volume_up`.
- Fill track: зелёный градиент поднимается снизу вверх.
- Persistent: громкость сохраняется в `localStorage` (`aerobeat-master-volume`).
- Дефолтная громкость: 0.75.
- Управляет `audioPlayer.volume` и `menuMusic.volume` одновременно.

### Beatmap Analyzer

Модуль автоматической генерации beatmap из аудиофайла (планируется в Фазе 8).

**Вход:** `File` объект + `onProgress` callback.
**Выход:** `{ metadata: {...}, notes: [...] }`.

См. [Модуль анализа треков](#модуль-анализа-треков-phase-8) ниже.

---

## Экраны и навигация

### Схема навигации

```
Menu → Loading → Gameplay → Results → Menu
                    ↑ (stop button) ↵

              Profile ←──── Menu (bottom nav)
                    ↓ (login/register or view profile)
```

Каждый экран — `<section>` с `class="hidden"`. Переключение через JS (`screens.js` → `navigate(screenId)`).

### Главное меню

- Анимированные пузырьки (25 `div.bubble` с `@keyframes float-up`).
- Кнопка загрузки файла (input или drag & drop).
- Нижняя навигационная панель.

### Загрузка

- Прогресс-бар (liquid-fill, glassmorphism).
- Отображение BPM после анализа.

### Геймплей

- **Game viewport:** perspective track с 4 дорожками.
- **HUD:** score, combo, progress bar, song title.
- **Рецепторы:** 4 стеклянных колодца с клавишами D/F/J/K.
- **Ноты:** water-drop стиль, падают сверху вниз.
- **Hit feedback:** floating text (Perfect!/Good/Miss) + particles.
- **Пауза:** по Escape, overlay с Resume/Quit кнопками.
- **Stop button:** выход в меню во время игры.
- **Volume control:** вертикальный слайдер справа.

### Результаты

- Glass-панель `rounded-[3rem]`.
- Grade: `text-[140px]` с градиентом и glow.
- Двухколоночная раскладка: stats слева, grade справа.

### Профиль

**Два состояния:**
1. **Неавторизован:** Формы Login/Register с переключением вкладок.
2. **Авторизован:** Профиль с аватаром, статистикой, историей игр, кнопкой Logout.

### Bottom Nav Bar

- **Play** (активный) — переход в главное меню.
- **Library** — заглушка (Coming soon).
- **Social** — заглушка (Coming soon).
- **Profile** — переход на экран профиля.

---

## Авторизация

### Безопасность

| Мероприятие | Реализация |
|-------------|-----------|
| Хеширование паролей | `bcryptjs`, salt rounds: 12 |
| JWT-токены | `jsonwebtoken`, срок жизни: 7 дней |
| Хранение токена | `localStorage` (`aerobeat-jwt`) |
| Rate limiting | 20 попыток регистрация/входа в минуту на IP |
| Валидация username | 3–20 символов, regex `/^[a-zA-Z0-9_-]+$/` |
| Валидация пароля | Минимум 6 символов |
| Защита от раскрытия | Ошибки не раскрывают существование пользователя |

### Клиентский модуль Auth

```javascript
class Auth {
    token       // localStorage('aerobeat-jwt')
    user        // { id, username, display_name, ... }
    _listeners  // подписчики на изменение состояния

    async init()                              // проверка токена при запуске
    async register(username, password, email) // POST /api/auth/register
    async login(username, password)           // POST /api/auth/login
    logout()                                  // удаление токена
    onChange(callback)                         // подписка на изменение
}
```

**Auto-login:** При загрузке страницы `auth.init()` проверяет токен — если валиден, загружает данные пользователя.

**Reactive UI:** `auth.onChange(callback)` — все UI-компоненты подписываются и перерисовываются.

---

## Серверная часть (Backend)

### Express Server

```javascript
// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(ROOT));                    // Frontend
app.use('/uploads', express.static('uploads'));   // Audio files

// API Routes
app.use('/api/tracks', tracksRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', ...);
```

**Порт:** 3000 (настраивается через `process.env.PORT`).

### База данных SQLite

**Файл:** `server/aerobeat.db` (WAL mode, foreign keys ON).

**Таблица `tracks`:**

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | INTEGER PK | Автоинкремент |
| title | TEXT | Название трека |
| artist | TEXT | Исполнитель (default: 'Unknown') |
| bpm | REAL | Вычисленный BPM |
| duration | REAL | Длительность (сек) |
| file_path | TEXT UNIQUE | Путь к файлу на диске |
| file_size | INTEGER | Размер в байтах |
| file_hash | TEXT UNIQUE | SHA-256 хеш (дедупликация) |
| note_count | INTEGER | Количество нот |
| beatmap | TEXT | JSON beatmap (сериализованный) |
| created_at | TEXT | Дата создания |
| updated_at | TEXT | Дата обновления |

**Таблица `users`:**

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | INTEGER PK | Автоинкремент |
| username | TEXT UNIQUE | Логин (3–20 символов) |
| email | TEXT UNIQUE | Email (опционально) |
| password_hash | TEXT | bcrypt hash пароля |
| display_name | TEXT | Отображаемое имя |
| created_at | TEXT | Дата регистрации |

### REST API — Треки

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| `GET` | `/api/tracks` | Список всех треков (без beatmap) |
| `GET` | `/api/tracks/:id` | Полные данные трека + beatmap JSON |
| `POST` | `/api/tracks` | Публикация нового трека (multipart/form-data) |
| `DELETE` | `/api/tracks/:id` | Удаление трека (БД + файл на диске) |

**POST /api/tracks — multipart/form-data:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| audio | File | Да | Аудиофайл (.mp3, .ogg, .wav, .flac) |
| title | String | Да | Название трека |
| artist | String | Да | Исполнитель |
| bpm | Number | Да | Вычисленный BPM |
| duration | Number | Да | Длительность в секундах |
| beatmap | String | Да | JSON beatmap (сериализованный) |

**Ошибки:**
- 400 — невалидные данные.
- 409 — дубликат файла (тот же SHA-256 хеш).
- 500 — ошибка сервера.

### REST API — Авторизация

| Метод | Эндпоинт | Описание | Авторизация |
|-------|----------|----------|-------------|
| `POST` | `/api/auth/register` | Регистрация | Нет |
| `POST` | `/api/auth/login` | Вход | Нет |
| `GET` | `/api/auth/me` | Текущий пользователь | Да |
| `PUT` | `/api/auth/profile` | Обновление профиля | Да |
| `POST` | `/api/auth/change-password` | Смена пароля | Да |

**Middleware:**
- `authenticateToken` — проверяет JWT, добавляет `req.user`.
- `optionalAuth` — не блокирует, добавляет `req.user = null` если токена нет.

### Дедупликация файлов

1. При загрузке файла вычисляется SHA-256 хеш.
2. Проверяется наличие `file_hash` в БД.
3. Если файл уже существует — возвращается 409 Conflict с `track_id` существующего трека.
4. Если новый — файл сохраняется в `uploads/tracks/{hash}.{ext}`.

---

## Дизайн-система (Frutiger Aero)

Визуальная референс — `prototype/code.html` + `prototype/DESIGN.md`. Любая реализация должна на 100% воспроизводить визуал из прототипа.

### Палитра цветов

| Переменная | Значение | Назначение |
|-----------|---------|-----------|
| `primary` | `#00658d` | Основной цвет (интерактивные элементы) |
| `primary-container` | `#00aeef` | Контейнеры, акценты |
| `secondary` | `#426900` | Вторичный цвет (успех) |
| `secondary-container` | `#b8f568` | Зелёные акценты, Perfect индикаторы |
| `surface` | `#f9f9ff` | Фон поверхностей |
| `on-surface` | `#001b3c` | Текст на поверхностях |
| `error` | `#ba1a1a` | Ошибки, Miss индикаторы |

### Типографика

| Стиль | Шрифт | Размер | Вес |
|-------|-------|--------|-----|
| display-lg | Plus Jakarta Sans | 48px | 700 |
| headline-md | Plus Jakarta Sans | 24px | 600 |
| body-lg | Work Sans | 18px | 400 |
| body-md | Work Sans | 16px | 400 |
| label-sm | Work Sans | 12px | 600 |

### Glassmorphism

```css
.aero-glass {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.3);
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 51, 102, 0.15),
              inset 0 0 8px rgba(255, 255, 255, 0.3);
}
```

### Кнопки

- Градиент `linear-gradient(to bottom, top_color, bottom_color)`.
- Gloss overlay: `::before` pseudo-element — белый эллиптический градиент сверху (40% высоты).
- `border: 1.5px solid rgba(255, 255, 255, 0.8)`.
- `box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15), inset 0 -6px 12px rgba(0, 0, 0, 0.1), inset 0 2px 4px rgba(255, 255, 255, 0.9)`.
- `:active` → `transform: scale(0.96)`, inner shadow.

### Прогресс-бар

- Капсула: glass-контейнер `rounded-full`.
- Fill: `linear-gradient(to bottom, #b8f568, #426900, #b8f568)`.
- Specular highlight: белая полоса по центру (`::after` pseudo-element).

### Ноты (water-drop)

```css
.note {
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff 0%, #00aeef 60%, #004c6b 100%);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3),
              inset -2px -2px 6px rgba(0, 0, 0, 0.2);
  will-change: transform; /* GPU-ускорение */
}
```

### Рецепторы

- `backdrop-filter: blur(20px)`, `border: 4px solid rgba(0, 101, 141, 0.2)`.
- `box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.15)`.
- Клавиша по центру (D/F/J/K).
- **Flash-эффект:** при попадании — `border-color: rgba(184, 245, 104, 0.8)` + `box-shadow: 0 0 20px rgba(184, 245, 104, 0.5)` на 120мс.

### Анимации

| Анимация | Описание |
|----------|----------|
| `float-up` | Пузырьки в меню (25 элементов) |
| `hit-float` | Floating text (Perfect!/Good/Miss) — translateY(-60px) + scale(1.2) + opacity 0 |
| `particle-burst` | Искры при попадании (8 зелёных для Perfect, 4 голубых для Good) |
| `aurora-shift` | Движение aurora ribbon-слоёв (20–25s infinite alternate) |
| `pulse-countdown` | Пульсирующее кольцо countdown overlay |

### Фон (Aurora Background)

- Animated aurora gradient + 5 ribbon layers (`.aurora-ribbon`).
- CSS-анимация `aurora-shift` (20–25s infinite alternate).
- Цвета ribbon: green (`rgba(184, 245, 104, 0.35)`), blue (`rgba(0, 174, 239, 0.3)`), white (`rgba(255, 255, 255, 0.2)`).

---

## Формат Beatmap

```json
{
  "version": 1,
  "metadata": {
    "title": "My Song",
    "artist": "Unknown",
    "bpm": 128.0,
    "offset": 0.0,
    "duration": 180.0,
    "noteCount": 412
  },
  "notes": [
    { "time": 1.25, "lane": 0 },
    { "time": 1.60, "lane": 2 }
  ]
}
```

- `notes[i].time`: float, секунды от начала трека.
- `notes[i].lane`: int, 0..3 (колонки D, F, J, K).

**Маппинг дорожек:**
| Lane | Клавиша | Частотная полоса |
|------|---------|-----------------|
| 0 | D | Low (бочка) |
| 1 | F | Mid (вокал/лиды) |
| 2 | J | Snare (снейр/хлопки) |
| 3 | K | Hi (хайхеты/цимбалы) |

---

## Модуль анализа треков (Phase 8)

### Пайплайн алгоритма

7-фазный пайплайн генерации beatmap из аудиофайла:

| Фаза | Название | Описание |
|------|---------|----------|
| 1 | Decoding | Получение моно PCM из AudioBuffer |
| 2 | Transient Filtering | Изоляция кика (low-pass 100Hz) и снейра (band-pass 2500Hz) через OfflineAudioContext |
| 3 | Envelope Follower | Выпрямление + IIR-сглаживание (α=0.05) |
| 4 | Attack Detection | Первая производная огибающей, half-wave rectification |
| 5 | Peak Picking | Локальные максимумы с плавающим порогом, debounce 50мс |
| 6 | BPM + Grid | Автокорреляция, квантование к сетке 1/4 и 1/8 долей (макс. сдвиг 30мс) |
| 7 | Pattern Generator | Маппинг на D/F/J/K: чередование, лестницы, триллы, аккорды на сильную долю |

**Ключевые особенности:**
- **Логарифмическая производная** — выделение атак перкуссии (Log-Energy Derivative).
- **Micro-snapping** — подстройка нот под реальные акустические пики (±20мс от сетки).
- **Hand-Balance Tracker** — чередование рук (D/F ↔ J/K) на быстрых потоках.

### Формат выходных данных

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

### Интеграция

```javascript
// js/app.js — handleFileLoad()
currentBeatmap = await buildBeatmap(file, (progress) => {
    setLoadingProgress(progress);
});
setBpmLabel(`${currentBeatmap.metadata.bpm} BPM DETECTED`);
```

**Модуль:** `js/audio/beatmapBuilder.js` (новый файл по спецификации `SUB_SPEC.md`).

---

## Тестирование

**Фреймворк:** Vitest v1.6.0.

### Запуск

```bash
npm test            # одиночный запуск
npm run test:watch  # watch mode
```

### Покрытие

| Файл тестов | Модуль | Количество тестов |
|-------------|--------|-------------------|
| `tests/hitDetection.test.js` | Детекция попаданий | 6 |
| `tests/scoring.test.js` | Система очков | 16 |
| `tests/auth.test.js` | Авторизация | 13 |

**Все тесты зелёные.**

### Примеры тестов

```javascript
// scoring.test.js
test('processHit returns correct score for perfect hit', () => {
  const state = createScoringState();
  const result = processHit(state, 'perfect');
  expect(result.score).toBe(300);
  expect(result.combo).toBe(1);
});

// hitDetection.test.js
test('categorizeHit returns perfect for delta < 50ms', () => {
  expect(categorizeHit(0.03)).toBe('perfect');
  expect(categorizeHit(0.08)).toBe('good');
  expect(categorizeHit(0.2)).toBe('miss');
});
```

---

## Известные проблемы

1. **Анализатор удалён:** модуль `js/audio/analyzer.js` удалён. Новый анализатор будет создан в Фазе 8 (модуль `beatmapBuilder.js`). Без анализатора gameplay не запускается (нет beatmap для спавна нот).

2. **Фон отличается от прототипа:** в SPEC указан `linear-gradient(135deg, #c6e7ff 0%, #00aeef 40%, #004c6b 100%)`, в коде реализован aurora gradient с ribbon-слоями. Визуально красивее, но не совпадает с прототипом.

3. **Social — заглушка:** кнопка Social в bottom nav bar не имеет функционала (показывает toast «Coming soon»).

4. **Library — заглушка:** кнопка Library в bottom nav bar не имеет функционала (показывает toast «Coming soon»).

---

## Roadmap

| Фаза | Описание | Статус |
|------|----------|--------|
| 1 | Инфраструктура и базовый HTML | **DONE** |
| 2 | Аудио-модули (player) | **DONE** |
| 3 | Игровая механика (conductor, notes, hit detection, scoring) | **DONE** |
| 4 | Экраны и навигация (UI-модули) | **DONE** |
| 5 | Сервер и база данных (Express, SQLite, REST API) | **DONE** |
| 6 | Авторизация и профиль | **DONE** |
| 7 | Polish и VFX (particles, hit feedback, pause, volume, menu music) | **DONE** |
| 8 | Анализатор треков (beatmapBuilder.js) | **TODO** |
| 9 | История игр и результаты | **TODO** |

---

## Правила разработки

### Frontend

1. **Прототип — закон.** Визуал должен на 100% совпадать с `prototype/code.html`.
2. **Web Audio API только.** Никаких `<audio>` элементов. `AudioContext.currentTime` — единственный источник времени.
3. **CSS-анимации优先.** Для движения нот, fade, particles — CSS `transform` + `transition`/`@keyframes`.
4. **Минимум зависимостей.** Tailwind CDN, Google Fonts CDN. Больше ничего.
5. **Чистый JS.** Без фреймворков. Vanilla JS + DOM.
6. **Ошибки в UI.** Никаких `alert()` — только стилизованные toast.
7. **Нет блокирующих операций.** Аудио-операции — `async/await`. Main thread никогда не блокируется.

### Backend

8. **SQLite — zero config.** Файл БД создаётся автоматически. WAL mode.
9. **Дедупликация по хешу.** SHA-256 от содержимого файла.
10. **Beatmap хранится в БД.** JSON сериализуется в текстовую колонку.
11. **Multer для загрузки.** Валидация форматов и размера.
12. **CORS включён.** Frontend может быть на любом порту.
13. **Ошибки → JSON.** Все API-ответы — JSON с полем `error` при ошибке.

### Модульность

- Каждый модуль — ES module (`export`/`import`).
- Минимум зависимостей между модулями.
- Общение через колбэки/события, не через прямые ссылки на DOM из игровой логики.
- Исключение: `app.js` — главный координатор.

### Документирование

- JSDoc для каждого публичного метода и класса.
- Inline-комментарии для нетривиальных алгоритмов.
- Единый стиль: `/** Description */` для JSDoc, `//` для inline.

---

## License

Частный проект. Все права защищены.
