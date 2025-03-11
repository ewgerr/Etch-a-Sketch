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