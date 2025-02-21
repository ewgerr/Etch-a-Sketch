const container = document.getElementById('container');
const gridSize = 16;

function createGrid() {
    for (let i = 0; i < gridSize * gridSize; i++) {
        const gridItem = document.createElement('div');
        gridItem.classList.add('grid-item');
        container.appendChild(gridItem);
    }
}

createGrid();