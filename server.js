const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet'); 
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fs = require('fs').promises; 
const compression = require('compression');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

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

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT,
        google_id TEXT UNIQUE
    )
`, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('Users table initialized');
});

const credentialsPath = path.join(__dirname, 'config', 'client_secret.json');
let credentials;

(async () => {
    try {
        await fs.access(credentialsPath);
        credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

        const clientID = process.env.GOOGLE_CLIENT_ID || credentials.web?.client_id;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || credentials.web?.client_secret;
        const callbackURL = process.env.GOOGLE_CALLBACK_URL || credentials.web?.redirect_uris[0];

        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error('clientID, clientSecret або callbackURL відсутні.');
        }

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

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use((req, res, next) => {
    console.log('Session data:', req.session);
    next();
});

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    console.log('Deserializing user with id:', id);
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
        if (err) {
            console.error('Error deserializing user:', err);
            return done(err);
        }
        if (!row) {
            console.error('User not found during deserialization');
            return done(null, false);
        }
        console.log('User deserialized:', row);
        done(null, row);
    });
});

function queryDatabase(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database query error:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function isAuthenticated(req, res, next) {
    console.log('Session data during authentication:', req.session);
    if (req.session && req.session.userId) {
        return next(); 
    } else {
        return res.status(401).json({ success: false, message: 'Ви повинні увійти в систему, щоб отримати доступ.' });
    }
}

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/users/login.html' }),
    (req, res) => {
        console.log('User after Google login:', req.user); 
        req.session.userId = req.user.id;
        console.log('Session after Google login:', req.session); 
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
        const users = await queryDatabase("SELECT id, username, password FROM users WHERE username = ?", [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Невірне ім\'я користувача або пароль' });
        }

        const match = await bcrypt.compare(password, users[0].password);
        if (match) {
            req.session.userId = users[0].id;
            res.redirect('/');
        } else {
            res.status(401).json({ message: 'Невірне ім\'я користувача або пароль' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Внутрішня помилка сервера');
    }
});

const userLastPaintTime = {};
const grids = {};
const gridFilePath = path.join(__dirname, 'public', 'grid.json');

app.post('/paint', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { cellId, color, gridSize } = req.body;

        if (!cellId || !color || !gridSize) {
            return res.status(400).json({ success: false, message: 'Invalid input data' });
        }

        const currentTime = Date.now();

        if (!userLastPaintTime[userId] || currentTime - userLastPaintTime[userId] >= 60000) {
            db.run(
                `INSERT INTO grid (cell_id, color, grid_size, user_id) 
                 VALUES (?, ?, ?, ?) 
                 ON CONFLICT(cell_id, grid_size) 
                 DO UPDATE SET color = ?, user_id = ?`,
                [cellId, color, gridSize, userId, color, userId],
                async (err) => {
                    if (err) {
                        console.error('Error updating grid:', err);
                        return res.status(500).json({ success: false, message: 'Internal server error' });
                    }

                    userLastPaintTime[userId] = currentTime;

                    // Оновлення досягнень
                    await updateAchievements(userId);

                    broadcastGridUpdate({ cellId, color });

                    res.status(200).json({ success: true, message: 'Квадратик успішно зафарбовано' });
                }
            );
        } else {
            const timeLeft = 60000 - (currentTime - userLastPaintTime[userId]);
            const secondsLeft = Math.ceil(timeLeft / 1000);
            res.status(429).json({
                success: false,
                message: `Почекайте ${secondsLeft} секунд перед наступним зафарбуванням.`,
                timeLeft: secondsLeft,
            });
        }
    } catch (error) {
        console.error('Error handling /paint:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/grid/:size', isAuthenticated, async (req, res) => {
    try {
        const gridSize = parseInt(req.params.size, 10);
        const query = `
            SELECT cell_id, color
            FROM grid
            WHERE grid_size = ?
        `;
        const gridData = await queryDatabase(query, [gridSize]);

        const formattedData = {};
        gridData.forEach(cell => {
            formattedData[cell.cell_id] = cell.color;
        });

        res.status(200).json(formattedData);
    } catch (error) {
        console.error('Error fetching grid data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/grid', async (req, res) => {
    try {
        const query = `
            SELECT cell_id, color, grid_size, user_id
            FROM grid
        `;
        const gridData = await queryDatabase(query);

        res.status(200).json(gridData);
    } catch (error) {
        console.error('Error fetching grid data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/leaderboard', async (req, res) => {
    try {
        const query = `
            SELECT u.username, COUNT(g.cell_id) AS painted_cells
            FROM users u
            LEFT JOIN grid g ON u.id = g.user_id
            GROUP BY u.username
            ORDER BY painted_cells DESC
        `;
        const leaderboard = await queryDatabase(query);

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/users/login.html');
    });
});

app.get('/check-session', (req, res) => {
    if (req.session.userId) {
        db.get("SELECT username FROM users WHERE id = ?", [req.session.userId], (err, row) => {
            if (err) {
                console.error('Error fetching username:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            if (row) {
                res.json({ loggedIn: true, username: row.username });
            } else {
                res.json({ loggedIn: false });
            }
        });
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

app.get('/painted-cells', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId; 
        const query = `
            SELECT COUNT(*) AS painted_cells
            FROM grid
            WHERE user_id = ?
        `;
        const result = await queryDatabase(query, [userId]);
        res.status(200).json({ paintedCells: result[0].painted_cells });
    } catch (error) {
        console.error('Error fetching painted cells count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/stats', isAuthenticated, async (req, res) => {
    try {
        const totalCellsQuery = `
            SELECT COUNT(*) AS total_cells FROM grid
        `;
        const popularColorQuery = `
            SELECT color, COUNT(color) AS count
            FROM grid
            GROUP BY color
            ORDER BY count DESC
            LIMIT 1
        `;
        const topUsersQuery = `
            SELECT u.username, COUNT(g.cell_id) AS painted_cells
            FROM users u
            LEFT JOIN grid g ON u.id = g.user_id
            GROUP BY u.username
            ORDER BY painted_cells DESC
            LIMIT 3
        `;

        const totalCellsResult = await queryDatabase(totalCellsQuery);
        const popularColorResult = await queryDatabase(popularColorQuery);
        const topUsersResult = await queryDatabase(topUsersQuery);

        res.status(200).json({
            totalCells: totalCellsResult[0]?.total_cells || 0,
            popularColor: popularColorResult[0]?.color || 'N/A',
            topUsers: topUsersResult.map(user => user.username),
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/achievements', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        const query = `
            SELECT painted_100_cells, used_all_colors, spent_one_hour
            FROM achievements
            WHERE user_id = ?
        `;
        const result = await queryDatabase(query, [userId]);

        if (result.length === 0) {
            return res.status(404).json({ error: 'Achievements not found for user' });
        }

        res.status(200).json(result[0]);
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/user-stats/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const userQuery = `
            SELECT id FROM users WHERE username = ?
        `;
        const userResult = await queryDatabase(userQuery, [username]);

        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = userResult[0].id;

        const statsQuery = `
            SELECT COUNT(*) AS painted_cells, 
                   (SELECT color FROM grid WHERE user_id = ? GROUP BY color ORDER BY COUNT(color) DESC LIMIT 1) AS popular_color
            FROM grid
            WHERE user_id = ?
        `;
        const statsResult = await queryDatabase(statsQuery, [userId, userId]);

        const achievementsQuery = `
            SELECT painted_100_cells, used_all_colors, spent_one_hour
            FROM achievements
            WHERE user_id = ?
        `;
        const achievementsResult = await queryDatabase(achievementsQuery, [userId]);

        res.status(200).json({
            paintedCells: statsResult[0]?.painted_cells || 0,
            popularColor: statsResult[0]?.popular_color || 'N/A',
            achievements: achievementsResult[0] || {
                painted_100_cells: false,
                used_all_colors: false,
                spent_one_hour: false,
            },
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/update-time', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { elapsedTime } = req.body; // Час у мілісекундах

        const query = `
            INSERT INTO user_time (user_id, total_time)
            VALUES (?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET total_time = total_time + ?
        `;
        await queryDatabase(query, [userId, elapsedTime, elapsedTime]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error updating user time:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/get-time', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        const query = `
            SELECT total_time
            FROM user_time
            WHERE user_id = ?
        `;
        const result = await queryDatabase(query, [userId]);

        res.status(200).json({ totalTime: result[0]?.total_time || 0 });
    } catch (error) {
        console.error('Error fetching user time:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        console.log(`Serving file: ${filePath}`);
    }
}));

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

const users = {}; // Зберігає підключених користувачів

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data);
            console.log('Sender username:', ws.username);

            if (data.type === 'register') {
                if (!data.username) {
                    ws.send(JSON.stringify({ error: 'Username is required for registration.' }));
                    return;
                }
                users[data.username] = ws;
                ws.username = data.username;
                console.log(`User registered: ${data.username}`);
            } else if (data.type === 'message') {
                if (!ws.username || !data.message) {
                    console.error('Invalid message data:', data);
                    return;
                }
                if (data.to) {
                    const recipient = users[data.to];
                    if (recipient) {
                        recipient.send(JSON.stringify({
                            from: ws.username,
                            message: data.message,
                            private: true,
                        }));
                    } else {
                        ws.send(JSON.stringify({
                            error: `User ${data.to} is not online.`,
                        }));
                    }
                    ws.send(JSON.stringify({
                        from: ws.username,
                        message: data.message,
                        private: true,
                    }));
                } else {
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                from: ws.username,
                                message: data.message,
                            }));
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`User disconnected: ${ws.username}`);
        delete users[ws.username];
    });
});

function broadcastGridUpdate(update) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(update));
        }
    });
}

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

async function handleCellClick(event) {
    if (!event.target.classList.contains('cell')) return;

    const currentTime = Date.now();
    if (isRequestInProgress) {
        alert('Зачекайте, поки попередній запит завершиться.');
        return;
    }

    const cell = event.target;
    const cellId = cell.id;
    const color = colorPicker.value;

    try {
        isRequestInProgress = true;

        const response = await fetch('/paint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, cellId, color, gridSize }),
        });

        const result = await response.json();

        if (response.ok) {
            cell.style.backgroundColor = color;
            lastRequestTime = currentTime;

            paintedCellsCount++;
            counterElement.textContent = `Зафарбовані клітинки: ${paintedCellsCount}`;

            if (paintedCellsCount >= paintedCellsThreshold && !isEasterEggTriggered) {
                isEasterEggTriggered = true;
                activateRainbowTheme();
                showCongratulations();
            }
        } else {
            if (response.status === 401) {
                alert('Ви повинні увійти в систему, щоб зафарбовувати клітинки.');
            } else if (result.timeLeft) {
                alert(`Почекайте ${result.timeLeft} секунд перед наступним зафарбуванням.`);
            } else {
                alert(result.message);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Сталася помилка. Спробуйте ще раз.');
    } finally {
        isRequestInProgress = false;
    }
}

async function updateAchievements(userId) {
    try {
        // Перевірка досягнення "Зафарбувати 100 клітинок"
        const paintedCellsQuery = `
            SELECT COUNT(*) AS painted_cells
            FROM grid
            WHERE user_id = ?
        `;
        const paintedCellsResult = await queryDatabase(paintedCellsQuery, [userId]);
        const painted100Cells = paintedCellsResult[0]?.painted_cells >= 100;

        // Перевірка досягнення "Використати всі доступні кольори"
        const usedColorsQuery = `
            SELECT DISTINCT color
            FROM grid
            WHERE user_id = ?
        `;
        const usedColorsResult = await queryDatabase(usedColorsQuery, [userId]);
        const allColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        const usedAllColors = allColors.every(color =>
            usedColorsResult.some(row => row.color === color)
        );

        // Перевірка досягнення "Провести 1 годину на сайті"
        const sessionStartTime = req.session.startTime || Date.now();
        const elapsedTime = (Date.now() - sessionStartTime) / (1000 * 60 * 60); // Час у годинах
        const spentOneHour = elapsedTime >= 1;

        // Оновлення досягнень у базі даних
        const updateQuery = `
            INSERT INTO achievements (user_id, painted_100_cells, used_all_colors, spent_one_hour)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id)
            DO UPDATE SET
                painted_100_cells = ?,
                used_all_colors = ?,
                spent_one_hour = ?
        `;
        await queryDatabase(updateQuery, [
            userId,
            painted100Cells,
            usedAllColors,
            spentOneHour,
            painted100Cells,
            usedAllColors,
            spentOneHour,
        ]);
    } catch (error) {
        console.error('Error updating achievements:', error);
    }
}


