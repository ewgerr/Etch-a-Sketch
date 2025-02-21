const container = document.getElementById('container');
const resizeButton = document.getElementById('resize-button');
const maxGridSize = 100; // Максимальний розмір сітки

// Функція для створення сітки
function createGrid(size) {
    container.innerHTML = ''; // Очистити контейнер
    const containerSize = container.clientWidth; // Ширина контейнера
    const itemSize = containerSize / size; // Розмір одного квадрата

    for (let i = 0; i < size * size; i++) {
        const gridItem = document.createElement('div');
        gridItem.classList.add('grid-item');
        gridItem.style.width = `${itemSize}px`;
        gridItem.style.height = `${itemSize}px`;

        // Додаємо обробник події для наведення миші
        gridItem.addEventListener('mouseenter', () => {
            gridItem.classList.add('hovered');
        });

        // Додаємо обробники подій для сенсорних пристроїв
        gridItem.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Запобігаємо прокрутці сторінки
            gridItem.classList.add('hovered');
        });

        gridItem.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Запобігаємо прокрутці сторінки
            const touch = e.touches[0]; // Отримуємо перший дотик
            const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY); // Елемент під дотиком
            if (elementUnderTouch && elementUnderTouch.classList.contains('grid-item')) {
                elementUnderTouch.classList.add('hovered'); // Змінюємо колір елемента
            }
        });

        container.appendChild(gridItem);
    }
}

// Функція для запиту розміру сітки у користувача
function promptGridSize() {
    let size = parseInt(prompt('Введіть кількість квадратів на сторону (максимум 100):', 16));

    // Перевірка введення
    if (isNaN(size) || size <= 0 || size > maxGridSize) {
        alert('Будь ласка, введіть число від 1 до 100.');
        return;
    }

    createGrid(size); // Створити нову сітку
}

// Створення сітки за замовчуванням (16x16)
createGrid(16);

// Додаємо обробник події для кнопки
resizeButton.addEventListener('click', promptGridSize);

// Адаптація сітки при зміні розміру вікна
window.addEventListener('resize', () => {
    const currentSize = Math.sqrt(container.children.length); // Поточний розмір сітки
    createGrid(currentSize); // Перестворюємо сітку з поточним розміром
});