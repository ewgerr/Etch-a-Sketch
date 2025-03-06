const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)");
});

db.close();