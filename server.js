const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./db/users.db');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 тиждень
}));

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT username FROM users WHERE username = ?", [username], (err, row) => {
        if (row) {
            return res.send('Користувач вже існує');
        } else {
            db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], (err) => {
                if (err) {
                    return res.send('Помилка при реєстрації');
                }
                req.session.user = username; // Зберігаємо користувача в сесії
                res.redirect('/'); // Перенаправляємо на головну сторінку
            });
        }
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT username, password FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            req.session.user = username;
            return res.redirect('/'); // Перенаправляємо на головну сторінку
        } else {
            res.send('Невірне ім\'я користувача або пароль');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login'); // Перенаправляємо на сторінку входу
});

app.get('/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

// Серверуєм статичні дані з деректорії "public"
app.use(express.static(path.join(__dirname, 'public')));

const grids = {};
const userLastPaintTime = {};

app.post('/paint', (req, res) => {
    const { userId, cellId, color, gridSize } = req.body;
    const currentTime = Date.now();

    if (!userLastPaintTime[userId] || currentTime - userLastPaintTime[userId] >= 60000) {
        if (!grids[gridSize]) {
            grids[gridSize] = {};
        }
        grids[gridSize][cellId] = color;
        userLastPaintTime[userId] = currentTime;
        res.status(200).send({ success: true, message: 'Квадратик успішно зафарбовано' });
    } else {
        res.status(429).send({ success: false, message: 'Щоб зафарбувати наступний квадратик вам потрібно почекати 1 хвилину' });
    }
});

app.get('/grid/:size', (req, res) => {
    const gridSize = req.params.size;
    res.status(200).send(grids[gridSize] || {});
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});