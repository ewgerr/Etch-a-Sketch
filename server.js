// Run: node server.js
// Open: http://localhost:3000

const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./db/users.db');

// Завантаження облікових даних з JSON-файлу
const credentialsPath = path.join(__dirname, 'config', 'client_secret_688153368834-778vah488vibusrgr5rsihq9cpfga1un.apps.googleusercontent.com.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 тиждень
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
        if (!err) {
            done(null, row);
        } else {
            done(err, null);
        }
    });
});

passport.use(new GoogleStrategy({
    clientID: credentials.web.client_id,
    clientSecret: credentials.web.client_secret,
    callbackURL: credentials.web.redirect_uris[0]
}, (token, tokenSecret, profile, done) => {
    db.get("SELECT * FROM users WHERE google_id = ?", [profile.id], (err, row) => {
        if (row) {
            return done(null, row);
        } else {
            db.run("INSERT INTO users (google_id, username) VALUES (?, ?)", [profile.id, profile.displayName], function(err) {
                if (err) {
                    return done(err);
                }
                db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err, row) => {
                    if (err) {
                        return done(err);
                    }
                    return done(null, row);
                });
            });
        }
    });
}));

// Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/users/login.html' }),
    (req, res) => {
        req.session.user = req.user.username; // Збереження сесії користувача
        res.redirect('/');
    }
);

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT username FROM users WHERE username = ?", [username], async (err, row) => {
        if (row) {
            return res.send('Користувач з таким іменем вже існує');
        } else {
            try {
                const hashedPassword = await bcrypt.hash(password, 10); // Хешування пароля
                db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (err) => {
                    if (err) {
                        return res.send('Помилка при реєстрації');
                    }
                    req.session.user = username; 
                    res.redirect('/'); 
                });
            } catch (error) {
                return res.send('Помилка при хешуванні пароля');
            }
        }
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Перевірка імені користувача:', username);//це потрібно буде видалити 
    db.get("SELECT username, password FROM users WHERE username = ?", [username], async (err, row) => {
        if (row) {
            const match = await bcrypt.compare(password, row.password); // Перевірка пароля
            if (match) {
                req.session.user = username;
                return res.redirect('/');
            } else {
                res.status(401).json({ message: 'Невірне ім\'я користувача або пароль' });
            }
        } else {
            res.status(401).json({ message: 'Невірне ім\'я користувача або пароль' });
        }
    });
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

const grids = {}; // Кеш для сіток

app.post('/paint', (req, res) => {
    console.log('Отримані дані:', req.body); // Додайте цей рядок
    const { changes, gridSize } = req.body;

    if (!changes || !Array.isArray(changes)) {
        return res.status(400).send({ success: false, message: 'Invalid data format' });
    }

    if (!grids[gridSize]) {
        grids[gridSize] = {};
    }

    changes.forEach(({ cellId, color }) => {
        grids[gridSize][cellId] = color;
    });

    res.status(200).send({ success: true });
});

app.get('/grid/:size', (req, res) => {
    const gridSize = req.params.size;
    res.status(200).send(grids[gridSize] || {});
});


// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});