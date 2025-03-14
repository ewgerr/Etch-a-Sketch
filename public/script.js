document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    const usernameButton = document.getElementById('usernameButton');
    const colorPicker = document.getElementById('customColor'); // Використовуємо тільки нижній вибір кольору
    const counterElement = document.getElementById('paintedCellsCounter');

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            fetch('/logout')
                .then(() => {
                    window.location.href = '/index.html';
                });
        });
    }

    fetch('/check-session')
        .then(response => response.json())
        .then(data => {
            if (data.loggedIn) {
                usernameButton.textContent = data.username;
                document.getElementById('logoutButton').style.display = 'block';
            } else {
                usernameButton.textContent = 'Username';
                document.getElementById('logoutButton').style.display = 'none';
            }

            const container = document.getElementById('container');
            if (!container) {
                console.error('Елемент container не знайдено!');
                return;
            }
            const userId = 'user-' + Math.random().toString(36).substr(2, 9); 
            let gridSize = 200; // Стандартний розмір сітки
            const cellSize = 20; // Постійний розмір клітинки

            async function fetchGrid(size) {
                try {
                    const response = await fetch(`/grid/${size}`);
                    const gridData = await response.json();
                    return gridData;
                } catch (error) {
                    console.error('Error fetching grid:', error);
                    return {};
                }
            }

            async function createGrid(size) {
                container.innerHTML = '';
                const gridData = await fetchGrid(size);

                container.style.width = `${cellSize * size}px`;
                container.style.height = `${cellSize * size}px`;

                const fragment = document.createDocumentFragment(); // Використання DocumentFragment

                for (let i = 0; i < size * size; i++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    cell.id = 'cell-' + i;
                    cell.style.width = `${cellSize}px`;
                    cell.style.height = `${cellSize}px`;
                    if (gridData['cell-' + i]) {
                        cell.style.backgroundColor = gridData['cell-' + i];
                    }
                    fragment.appendChild(cell); // Додаємо клітинку до фрагмента
                }

                container.appendChild(fragment); // Додаємо всі клітинки за один раз
            }

            // Додавання лічильника зафарбованих клітинок
            let paintedCellsCount = 0;
            const paintedCellsThreshold = 1000; // Кількість клітинок для активації пасхалки
            let isEasterEggActive = false;
            let isEasterEggTriggered = false;

            const changes = [];

            let lastPaintTime = 0; // Ініціалізація змінної

            container.addEventListener('click', (event) => {
                const currentTime = Date.now();

                // Перевірка затримки в 1 хвилину
                if (currentTime - lastPaintTime < 60000) {
                    alert('Щоб зафарбувати наступний квадратик, вам потрібно почекати 1 хвилину');
                    return;
                }

                if (event.target.classList.contains('cell')) {
                    const cellId = event.target.id;
                    const color = colorPicker.value;

                    fetch('/paint', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId, // Використовуємо постійний userId
                            changes: [{ cellId, color }],
                            gridSize: 100 // Розмір сітки
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            console.log(data.message);
                            event.target.style.backgroundColor = color;

                            // Оновлюємо час останнього кліку
                            lastPaintTime = currentTime;
                        } else {
                            alert(data.message);
                        }
                    })
                    .catch(error => {
                        console.error('Помилка:', error);
                    });
                }
            });

            createGrid(gridSize);
        });

    const container = document.getElementById('container');

    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) { // Перевірка на два пальці
            isDragging = true;
            startX = e.touches[0].pageX - container.offsetLeft;
            startY = e.touches[0].pageY - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
        }
    });

    container.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 2) return; // Перевірка на два пальці
        e.preventDefault();
        const x = e.touches[0].pageX - container.offsetLeft;
        const y = e.touches[0].pageY - container.offsetTop;
        const walkX = (x - startX) * 2; // швидкість прокрутки
        const walkY = (y - startY) * 2; // швидкість прокрутки
        container.scrollLeft = scrollLeft - walkX;
        container.scrollTop = scrollTop - walkY;
    });

    container.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Додавання обробки дотику для одного пальця для прокрутки сторінки
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].pageX;
            startY = e.touches[0].pageY;
            scrollLeft = window.scrollX;
            scrollTop = window.scrollY;
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const x = e.touches[0].pageX;
        const y = e.touches[0].pageY;
        const walkX = (x - startX); // швидкість прокрутки
        const walkY = (y - startY); // швидкість прокрутки
        window.scrollTo(scrollLeft - walkX, scrollTop - walkY);
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });
});

function activateRainbowTheme() {
    document.body.classList.add('rainbow-theme');
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.add('rotate');
    });
    setTimeout(() => {
        document.body.classList.remove('rainbow-theme');
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('rotate');
        });
    }, 5000); // Пасхалка активна 5 секунд
}

function showCongratulations() {
    const congratsMessage = document.createElement('div');
    congratsMessage.innerText = 'Юху! Вітаю це ваша перша 1000 клітинок! Ви круті!';
    congratsMessage.style.position = 'fixed';
    congratsMessage.style.top = '50%';
    congratsMessage.style.left = '50%';
    congratsMessage.style.transform = 'translate(-50%, -50%)';
    congratsMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    congratsMessage.style.color = 'white';
    congratsMessage.style.padding = '20px';
    congratsMessage.style.borderRadius = '10px';
    congratsMessage.style.zIndex = '1000';
    congratsMessage.style.fontSize = '2rem';
    congratsMessage.style.textAlign = 'center';
    congratsMessage.style.animation = 'pop-in 0.5s ease-out';

    document.body.appendChild(congratsMessage);

    // Додавання конфеті
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        document.body.appendChild(confetti);
    }

    setTimeout(() => {
        document.body.removeChild(congratsMessage);
        document.querySelectorAll('.confetti').forEach(confetti => {
            document.body.removeChild(confetti);
        });
    }, 5000); // Повідомлення зникає через 5 секунд
}

fetch('/paint', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        changes: [
            { cellId: 'cell-1', color: '#ff0000' },
            { cellId: 'cell-2', color: '#00ff00' }
        ],
        gridSize: 50 //Тут також має бути розмір сітки
    })
})
.then(response => response.json())
.then(data => {
    console.log('Відповідь сервера:', data);
})
.catch(error => {
    console.error('Помилка:', error);
});