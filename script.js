const container = document.getElementById('container');
const gridSize = 16;

function createGrid() {
    for (let i = 0; i < gridSize * gridSize; i++) {
        const gridItem = document.createElement('div');
        gridItem.classList.add('grid-item');

        // Додаємо обробник події для наведення миші
        gridItem.addEventListener('mouseenter', () => {
            gridItem.classList.add('hovered');
        });

        container.appendChild(gridItem);
    }
}

createGrid();
