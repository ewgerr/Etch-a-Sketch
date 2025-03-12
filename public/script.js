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
            const userId = 'user-' + Math.random().toString(36).substr(2, 9); 
            let gridSize = 50; // Стандартний розмір сітки

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

                const cellSize = container.clientWidth / size;

                for (let i = 0; i < size * size; i++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    cell.id = 'cell-' + i;
                    cell.style.width = `${cellSize}px`;
                    cell.style.height = `${cellSize}px`;
                    if (gridData['cell-' + i]) {
                        cell.style.backgroundColor = gridData['cell-' + i];
                    }
                    container.appendChild(cell);
                }
            }

            // Додавання лічильника зафарбованих клітинок
            let paintedCellsCount = 0;
            const paintedCellsThreshold = 1000; // Кількість клітинок для активації пасхалки

            container.addEventListener('click', async (event) => {
                if (event.target.classList.contains('cell') && data.loggedIn) {
                    const cellId = event.target.id;
                    const color = colorPicker.value;

                    try {
                        const response = await fetch('/paint', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ userId, cellId, color, gridSize })
                        });

                        const result = await response.json();
                        if (response.ok) {
                            event.target.style.backgroundColor = color;
                            if (!event.target.classList.contains('painted')) {
                                event.target.classList.add('painted');
                                paintedCellsCount++;
                                counterElement.innerText = `Зафарбовані клітинки: ${paintedCellsCount}`;
                            }

                            if (paintedCellsCount >= paintedCellsThreshold) {
                                activateRainbowTheme();
                                showCongratulations();
                                paintedCellsCount = 0; // Скидання лічильника після активації пасхалки
                                counterElement.innerText = `Зафарбовані клітинки: ${paintedCellsCount}`;
                            }
                        } else {
                            alert(result.message);
                        }
                    } catch (error) {
                        console.error('Error:', error);
                    }
                } else if (!data.loggedIn) {
                    alert('Будь ласка, увійдіть в акаунт, щоб замальовувати клітинки.Вхід знаходиться в правому верхньому кутку сторінки.');
                }
            });

            createGrid(gridSize);
        });

    const container = document.getElementById('container');

    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;

    container.addEventListener('touchstart', (e) => {
        isDragging = true;
        startX = e.touches[0].pageX - container.offsetLeft;
        startY = e.touches[0].pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
    });

    container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
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
});

function activateRainbowTheme() {
    document.body.classList.add('rainbow-theme');
    setTimeout(() => {
        document.body.classList.remove('rainbow-theme');
    }, 5000); // Пасхалка активна 5 секунд
}

function showCongratulations() {
    const congratsMessage = document.createElement('div');
    congratsMessage.innerText = 'Юху! Вітаю це ваша перша тисяча клітинок! Ви круті!';
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