document.addEventListener('DOMContentLoaded', () => {
    const colorPicker = document.getElementById('customColor');
    let selectedColor = colorPicker.value;

    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (event) => {
            if (event.target.classList.contains('custom-color')) {
                selectedColor = colorPicker.value;
            } else {
                selectedColor = event.target.getAttribute('data-color');
            }
            colorPicker.value = selectedColor;
        });
    });

    colorPicker.addEventListener('input', (event) => {
        selectedColor = event.target.value;
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const colorPalette = document.getElementById('colorPalette');
    const toggleButton = document.getElementById('togglePalette'); 

    toggleButton.addEventListener('click', () => {
        colorPalette.classList.toggle('open'); 

        if (colorPalette.classList.contains('open')) {
            toggleButton.textContent = 'Сховати палітру';
        } else {
            toggleButton.textContent = 'Показати палітру';
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('togglePalette');

    setTimeout(() => {
        toggleButton.classList.remove('hidden');
        toggleButton.classList.add('visible');
    }, 2000);
});