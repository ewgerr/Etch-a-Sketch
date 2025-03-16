const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

db.serialize(() => {
    // Створення таблиці користувачів
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT,
        google_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('Users table created successfully');
    });

    // Створення таблиці сітки
    db.run(`CREATE TABLE IF NOT EXISTS grid (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cell_id TEXT NOT NULL,
        color TEXT NOT NULL,
        grid_size INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cell_id, grid_size),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating grid table:', err);
        else console.log('Grid table created successfully');
    });

    // Створення індексів для оптимізації запитів
    db.run(`CREATE INDEX IF NOT EXISTS idx_grid_user_id ON grid (user_id)`, (err) => {
        if (err) console.error('Error creating index on grid table:', err);
        else console.log('Index on grid table created successfully');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`, (err) => {
        if (err) console.error('Error creating index on users table:', err);
        else console.log('Index on users table created successfully');
    });
});

db.close((err) => {
    if (err) console.error('Error closing the database:', err);
    else console.log('Database connection closed');
});