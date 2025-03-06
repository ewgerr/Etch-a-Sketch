const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');

app.use(bodyParser.json());
app.use(cors());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});