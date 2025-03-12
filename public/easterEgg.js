let keysPressed = {};

document.addEventListener('keydown', function(event) {
    keysPressed[event.key] = true;

    if (keysPressed['X'] && keysPressed['D'] && keysPressed['U'] || keysPressed['Х'] && keysPressed['Д'] && keysPressed['У'] || keysPressed['x'] && keysPressed['d'] && keysPressed['u'] ) {
        activateConfetti();
    }
});

document.addEventListener('keyup', function(event) {
    keysPressed[event.key] = false;
});

function activateConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.id = 'confettiContainer';
    confettiContainer.style.position = 'fixed';
    confettiContainer.style.top = '0';
    confettiContainer.style.left = '0';
    confettiContainer.style.width = '100%';
    confettiContainer.style.height = '100%';
    confettiContainer.style.pointerEvents = 'none';
    confettiContainer.style.zIndex = '1000';
    document.body.appendChild(confettiContainer);

    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.animationDelay = `${Math.random() * 3}s`;
        confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
        document.body.removeChild(confettiContainer);
    }, 5000); // Конфетті зникає через 5 секунд
}