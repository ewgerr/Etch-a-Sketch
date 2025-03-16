document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    const usernameButton = document.getElementById('usernameButton');
    const colorPicker = document.getElementById('customColor');
    const counterElement = document.getElementById('paintedCellsCounter');
    const container = document.getElementById('container');
    const cellSize = 20; // Розмір клітинки
    const paintedCellsThreshold = 1000; // Поріг для пасхалки
    let paintedCellsCount = 0; // Лічильник зафарбованих клітинок
    let isEasterEggTriggered = false;

    let userId = null;
    let gridSize = 50; // Розмір сітки (кількість клітинок в рядку або стовпці)

    let isRequestInProgress = false; // Флаг для перевірки активного запиту
    let lastRequestTime = 0; // Час останнього успішного запиту

    const socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
        console.log('WebSocket connection established');
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };

    socket.onmessage = (event) => {
        const update = JSON.parse(event.data);

        const cell = document.getElementById(update.cellId);
        if (cell) {
            cell.style.backgroundColor = update.color;
        } else {
            console.warn(`Cell with ID ${update.cellId} not found`);
        }
    };

    async function fetchGrid(size) {
        try {
            const response = await fetch(`/grid/${size}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching grid:', error);
            return {};
        }
    }

    async function createGrid(size) {
        container.innerHTML = '';
        try {
            const gridData = await fetchGrid(size);

            const fragment = document.createDocumentFragment();
            container.style.width = `${cellSize * size}px`;
            container.style.height = `${cellSize * size}px`;

            for (let i = 0; i < size * size; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.id = `cell-${i}`;
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                if (gridData[`cell-${i}`]) {
                    cell.style.backgroundColor = gridData[`cell-${i}`];
                }
                fragment.appendChild(cell);
            }
            container.appendChild(fragment);
        } catch (error) {
            console.error('Error creating grid:', error);
            alert('Не вдалося завантажити сітку. Спробуйте ще раз.');
        }
    }

    async function handleCellClick(event) {
        if (!event.target.classList.contains('cell')) return;

        const currentTime = Date.now();
        if (isRequestInProgress || currentTime - lastRequestTime < 60000) {
            const timeLeft = Math.ceil((60000 - (currentTime - lastRequestTime)) / 1000);
            alert(`Зачекайте ${timeLeft} секунд перед наступним зафарбуванням.`);
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

    function activateRainbowTheme() {
        document.body.classList.add('rainbow-theme');

        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => cell.classList.add('rotate'));

        setTimeout(() => {
            document.body.classList.remove('rainbow-theme');
            cells.forEach(cell => cell.classList.remove('rotate'));
        }, 5000);
    }

    function showCongratulations() {
        const congratsMessage = document.createElement('div');
        congratsMessage.innerText = 'Юху! Вітаю це ваша перша 1000 клітинок! Ви круті!';
        Object.assign(congratsMessage.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            zIndex: '1000',
            fontSize: '2rem',
            textAlign: 'center',
            animation: 'pop-in 0.5s ease-out',
        });

        document.body.appendChild(congratsMessage);

        for (let i = 0; i < 50; i++) { 
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.backgroundColor = getRandomColor();
            confetti.style.animationDelay = `${Math.random() * 3}s`;
            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 3000);
        }

        setTimeout(() => document.body.removeChild(congratsMessage), 5000);
    }

    function getRandomColor() {
        const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#8b00ff'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    async function fetchPaintedCells() {
        try {
            const response = await fetch('/painted-cells');
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Користувач не авторизований');
                    alert('Ви повинні увійти в систему, щоб переглянути кількість зафарбованих клітинок.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.paintedCells;
        } catch (error) {
            console.error('Error fetching painted cells count:', error);
            return 0;
        }
    }

    async function init() {
        try {
            const sessionResponse = await fetch('/check-session');
            const sessionData = await sessionResponse.json();

            if (sessionData.loggedIn) {
                usernameButton.textContent = sessionData.username; 
                logoutButton.style.display = 'block';

                paintedCellsCount = await fetchPaintedCells();
                counterElement.textContent = `Зафарбовані клітинки: ${paintedCellsCount}`;
            } else {
                usernameButton.textContent = 'Username';
                logoutButton.style.display = 'none';
            }

            await createGrid(gridSize);

            container.addEventListener('click', handleCellClick);
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await fetch('/logout');
            window.location.href = '/index.html';
        });
    }

    if (!container) {
        console.error('Container element not found');
        return;
    }

    init();
});

fetch('/grid')
    .then(response => response.json())
    .then(data => {
        data.forEach(cell => {
            const cellElement = document.getElementById(cell.cell_id);
            if (cellElement) {
                cellElement.style.backgroundColor = cell.color;
            }
        });
    })
    .catch(error => console.error('Error loading grid:', error));

    fetch('/leaderboard')
    .then(response => response.json())
    .then(data => {
        const leaderboardElement = document.getElementById('leaderboard');
        leaderboardElement.innerHTML = ''; 

        data.forEach((entry, index) => {
            const row = document.createElement('tr');

            let rankClass = '';
            if (index === 0) rankClass = 'gold';
            else if (index === 1) rankClass = 'silver';
            else if (index === 2) rankClass = 'bronze';

            row.classList.add(rankClass);

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${entry.username}</td>
                <td>${entry.painted_cells}</td>
            `;
            leaderboardElement.appendChild(row);
        });
    })
    .catch(error => console.error('Error loading leaderboard:', error));