const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet'); // Додатковий захист від різних атак
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fs = require('fs').promises; // Використовуємо асинхронний модуль fs.promises
const compression = require('compression');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Ініціалізація бази даних
const db = new sqlite3.Database('./db/users.db', (err) => {
    if (err) console.error('Error connecting to database:', err);
    else console.log('Connected to SQLite database');
});

db.run(`
    CREATE TABLE IF NOT EXISTS grid (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cell_id TEXT NOT NULL,
        color TEXT NOT NULL,
        grid_size INTEGER NOT NULL,
        UNIQUE(cell_id, grid_size)
    )
`, (err) => {
    if (err) console.error('Error creating grid table:', err);
    else console.log('Grid table initialized');
});

// Завантаження облікових даних Google
const credentialsPath = path.join(__dirname, 'config', 'client_secret.json');
let credentials;

(async () => {
    try {
        // Перевіряємо, чи існує файл
        await fs.access(credentialsPath);
        credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8')); // Асинхронне читання файлу

        // Завантаження даних з файлу або змінних середовища
        const clientID = process.env.GOOGLE_CLIENT_ID || credentials.web?.client_id;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || credentials.web?.client_secret;
        const callbackURL = process.env.GOOGLE_CALLBACK_URL || credentials.web?.redirect_uris[0];

        // Перевірка наявності обов'язкових полів
        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error('clientID, clientSecret або callbackURL відсутні.');
        }

        // Ініціалізація GoogleStrategy
        passport.use(new GoogleStrategy({
            clientID,
            clientSecret,
            callbackURL
        }, (token, tokenSecret, profile, done) => {
            db.get("SELECT * FROM users WHERE google_id = ?", [profile.id], (err, row) => {
                if (err) return done(err);
                if (row) return done(null, row);

                db.run("INSERT INTO users (google_id, username) VALUES (?, ?)", [profile.id, profile.displayName], function (err) {
                    if (err) return done(err);
                    db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err, row) => {
                        if (err) return done(err);
                        done(null, row);
                    });
                });
            });
        }));
    } catch (error) {
        console.error('Error loading Google credentials:', error);
        process.exit(1);
    }
})();

// Middleware
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 тиждень
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(compression());

// Passport configuration
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
        if (err) return done(err);
        done(null, row);
    });
});

// Функція для виконання запитів до бази даних
function queryDatabase(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Middleware для перевірки автентифікації
function isAuthenticated(req, res, next) {
    console.log('Перевірка автентифікації:', req.session.user);
    if (req.session && req.session.user) {
        return next(); // Користувач автентифікований
    } else {
        return res.status(401).json({ success: false, message: 'Ви повинні увійти в систему, щоб зафарбовувати клітинки.' });
    }
}

// Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/users/login.html' }),
    (req, res) => {
        req.session.user = req.user.username;
        res.redirect('/');
    }
);

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await queryDatabase("SELECT username FROM users WHERE username = ?", [username]);
        if (users.length > 0) {
            return res.status(400).send('Користувач з таким іменем вже існує');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (err) => {
            if (err) return res.status(500).send('Помилка при реєстрації');
            req.session.user = username;
            res.redirect('/');
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Внутрішня помилка сервера');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await queryDatabase("SELECT username, password FROM users WHERE username = ?", [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Невірне ім\'я користувача або пароль' });
        }

        const match = await bcrypt.compare(password, users[0].password);
        if (match) {
            req.session.user = username;
            res.redirect('/');
        } else {
            res.status(401).json({ message: 'Невірне ім\'я користувача або пароль' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Внутрішня помилка сервера');
    }
});

const userLastPaintTime = {}; // Зберігання часу останнього зафарбування для кожного користувача
const grids = {}; // Зберігання сіток у пам'яті
const gridFilePath = path.join(__dirname, 'public', 'grid.json');

// Маршрут /paint з перевіркою автентифікації
app.post('/paint', isAuthenticated, async (req, res) => {
    try {
        const { userId, cellId, color, gridSize } = req.body;

        if (!userId || !cellId || !color || !gridSize) {
            return res.status(400).json({ success: false, message: 'Invalid input data' });
        }

        const currentTime = Date.now();

        if (!userLastPaintTime[userId] || currentTime - userLastPaintTime[userId] >= 60000) {
            // Оновлюємо стан сітки в базі даних
            db.run(
                "INSERT INTO grid (cell_id, color, grid_size) VALUES (?, ?, ?) ON CONFLICT(cell_id, grid_size) DO UPDATE SET color = ?",
                [cellId, color, gridSize, color],
                (err) => {
                    if (err) {
                        console.error('Error updating grid:', err);
                        return res.status(500).json({ success: false, message: 'Internal server error' });
                    }

                    userLastPaintTime[userId] = currentTime;
                    console.log(`Користувач ${userId} зафарбував клітинку ${cellId} кольором ${color}`);
                    res.status(200).json({ success: true, message: 'Квадратик успішно зафарбовано' });
                }
            );
        } else {
            const timeLeft = 60000 - (currentTime - userLastPaintTime[userId]);
            const secondsLeft = Math.ceil(timeLeft / 1000);
            console.log(`Користувач ${userId} намагається зафарбувати клітинку ${cellId} занадто швидко. Залишилось ${secondsLeft} секунд.`);
            res.status(429).json({
                success: false,
                message: `Почекайте ${secondsLeft} секунд перед наступним зафарбуванням.`,
                timeLeft: secondsLeft
            });
        }
    } catch (error) {
        console.error('Error handling /paint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Маршрут для отримання стану сітки
app.get('/grid/:size', async (req, res) => {
    try {
        const gridSize = req.params.size;
        console.log(`Отримано запит на /grid/${gridSize}`);

        db.all("SELECT cell_id, color FROM grid WHERE grid_size = ?", [gridSize], (err, rows) => {
            if (err) {
                console.error('Error fetching grid:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            const grid = {};
            rows.forEach(row => {
                grid[row.cell_id] = row.color;
            });

            res.status(200).json(grid);
        });
    } catch (error) {
        console.error(`Error handling grid for size ${req.params.size}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/users/login.html');
});

app.get('/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, username: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/check-username', (req, res) => {
    const { username } = req.query;
    db.get("SELECT username FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        } else if (row) {
            res.json({ exists: true });
        } else {
            res.json({ exists: false });
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    ws.on('message', (message) => {
        console.log('Received:', message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Функція для надсилання оновлень клієнтам
function broadcastGridUpdate(grid) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(grid));
        }
    });
}