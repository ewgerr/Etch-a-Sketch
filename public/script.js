document.addEventListener('DOMContentLoaded', () => {
    fetch('/check-session')
        .then(response => response.json())
        .then(data => {
            if (!data.loggedIn) {
                document.getElementById('logoutButton').style.display = 'none';
            } else {
                document.getElementById('logoutButton').style.display = 'block';
            }

            const container = document.getElementById('container');
            const colorPicker = document.getElementById('colorPicker');
            const resizeButton = document.getElementById('resize-button');
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

            resizeButton.addEventListener('click', () => {
                const newSize = parseInt(prompt('Введіть кількість квадратів на сторону (максимум 100):', gridSize));
                if (!isNaN(newSize) && newSize > 0 && newSize <= 100) {
                    gridSize = newSize;
                    createGrid(gridSize);
                } else {
                    alert('Будь ласка, введіть число від 1 до 100.');
                }
            });

            createGrid(gridSize);

            document.getElementById('logoutButton').addEventListener('click', () => {
                fetch('/logout')
                    .then(() => {
                        window.location.href = '/index.html';
                    });
            });
        });
});