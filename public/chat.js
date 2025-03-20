const socket = new WebSocket(`ws://${window.location.host}`);

socket.addEventListener('open', async () => {
    try {
        // Запрашиваем имя пользователя с сервера
        const response = await fetch('/check-session');
        const data = await response.json();

        if (data.loggedIn) {
            const username = data.username;
            socket.send(JSON.stringify({ type: 'register', username }));
            console.log(`Registered as: ${username}`);
        } else {
            alert('Ви повинні увійти в систему, щоб використовувати чат.');
        }
    } catch (error) {
        console.error('Error fetching username:', error);
        alert('Сталася помилка при отриманні імені користувача.');
    }
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    const chatLog = document.getElementById('chatLog');

    if (data.error) {
        alert(data.error);
    } else if (data.private) {
        chatLog.innerHTML += `<div><strong>Приватне від ${data.from}:</strong> ${data.message}</div>`;
    } else {
        chatLog.innerHTML += `<div><strong>${data.from}:</strong> ${data.message}</div>`;
    }

    chatLog.scrollTop = chatLog.scrollHeight; // Прокрутка вниз
});

document.getElementById('sendButton').addEventListener('click', () => {
    const message = document.getElementById('messageInput').value;
    const recipient = document.getElementById('recipientInput').value;

    socket.send(JSON.stringify({
        type: 'message',
        message,
        to: recipient || null,
    }));

    document.getElementById('messageInput').value = '';
});