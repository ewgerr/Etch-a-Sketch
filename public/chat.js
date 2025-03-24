const socket = new WebSocket(`ws://${window.location.host}`);

socket.addEventListener('open', async () => {
    try {
        // Запит імені користувача з сервера
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
    try {
        const data = JSON.parse(event.data);
        const chatLog = document.getElementById('chatLog');

        // Фільтр для некоректних повідомлень
        if (!data.from || !data.message) {
            console.warn('Отримано некоректне повідомлення:', data);
            return;
        }

        // Обробка помилок
        if (data.error) {
            alert(data.error);
            return; // Не додаємо помилку в чат
        }

        // Обробка приватних повідомлень
        if (data.private) {
            chatLog.innerHTML += `<div><strong>Приватне від ${data.from}:</strong> ${data.message}</div>`;
            return;
        }

        // Обробка загальних повідомлень
        chatLog.innerHTML += `<div><strong>${data.from}:</strong> ${data.message}</div>`;
        chatLog.scrollTop = chatLog.scrollHeight; // Прокрутка вниз
    } catch (error) {
        console.error('Error processing WebSocket message:', error);
    }
});

socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
    alert('Сталася помилка з WebSocket-з\'єднанням.');
});

socket.addEventListener('close', () => {
    alert('WebSocket-з\'єднання закрито.');
});

document.addEventListener('DOMContentLoaded', () => {
    const toggleChatButton = document.getElementById('toggleChatButton');
    const chatSection = document.getElementById('chatSection');
    const messageInput = document.getElementById('messageInput');
    const recipientInput = document.getElementById('recipientInput');
    const sendButton = document.getElementById('sendButton');
    const chatLog = document.getElementById('chatLog');

    // Логіка відкриття/закриття чату
    toggleChatButton.addEventListener('click', () => {
        chatSection.classList.toggle('hidden');
        toggleChatButton.textContent = chatSection.classList.contains('hidden') ? 'Відкрити чат' : 'Закрити чат';
    });

    // Відправка повідомлення
    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        const recipient = recipientInput.value.trim();

        if (message) {
            socket.send(JSON.stringify({
                type: 'message',
                to: recipient || null, // Якщо поле отримувача порожнє, відправляємо всім
                message,
            }));

            const messageElement = document.createElement('div');
            //messageElement.textContent = `Ви: ${message}`;
            messageElement.classList.add('message', 'sender');
            chatLog.appendChild(messageElement);

            messageInput.value = '';
            chatLog.scrollTop = chatLog.scrollHeight; 
        }
    });

   
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });
});