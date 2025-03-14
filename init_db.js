const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT,
        google_id TEXT
    )`);
});

db.close();