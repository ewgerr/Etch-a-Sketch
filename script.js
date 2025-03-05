const container = document.getElementById('container');
const resizeButton = document.getElementById('resize-button');
const maxGridSize = 100; 
function createGrid(size) {
    container.innerHTML = ''; 
    const containerSize = container.clientWidth; 
    const itemSize = containerSize / size; 

    for (let i = 0; i < size * size; i++) {
        const gridItem = document.createElement('div');
        gridItem.classList.add('grid-item');
        gridItem.style.width = `${itemSize}px`;
        gridItem.style.height = `${itemSize}px`;

        
        gridItem.addEventListener('mouseenter', () => {
            gridItem.classList.add('hovered');
        });

        gridItem.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            gridItem.classList.add('hover');
        });

        gridItem.addEventListener('touchmove', (e) => {
            e.preventDefault(); 
            const touch = e.touches[0]; 
            const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY); 
            if (elementUnderTouch && elementUnderTouch.classList.contains('grid-item')) {
                elementUnderTouch.classList.add('hovered'); 
            }
        });

        container.appendChild(gridItem);
    }
}


function promptGridSize() {
    let size = parseInt(prompt('Введіть кількість квадратів на сторону (максимум 100):', 16));

  
    if (isNaN(size) || size <= 0 || size > maxGridSize) {
        alert('Будь ласка, введіть число від 1 до 100.');
        return;
    }

    createGrid(size);
}

createGrid(16);

resizeButton.addEventListener('click', promptGridSize);

window.addEventListener('resize', () => {
    const currentSize = Math.sqrt(container.children.length); 
    createGrid(currentSize); 
});
document.addEventListener('DOMContentLoaded', () => {
    const colorPicker = document.getElementById('colorPicker');
    const container = document.getElementById('container');

    container.addEventListener('mouseover', (event) => {
        if (event.target.classList.contains('grid-item')) {
            event.target.style.backgroundColor = colorPicker.value;
        }
    });
});