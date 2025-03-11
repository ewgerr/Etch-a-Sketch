document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    const usernameButton = document.getElementById('usernameButton');
    const colorPicker = document.getElementById('customColor'); // Використовуємо тільки нижній вибір кольору

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
                        } else {
                            alert(result.message);
                        }
                    } catch (error) {
                        console.error('Error:', error);
                    }
                } else if (!data.loggedIn) {
                    alert('Будь ласка, увійдіть в акаунт, щоб замальовувати клітинки.');
                }
            });

            createGrid(gridSize);
        });
});