document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    const usernameInput = document.getElementById('username');
    const usernameError = document.getElementById('usernameError');
    const passwordInput = document.getElementById('password');
    const passwordRequirements = {
        length: document.getElementById('length'),
        uppercase: document.getElementById('uppercase'),
        lowercase: document.getElementById('lowercase'),
        number: document.getElementById('number')
    };

    usernameInput.addEventListener('input', () => {
        const username = usernameInput.value;

        // Перевірка наявності користувача з таким ім'ям
        if (username.length > 0) {
            fetch(`/check-username?username=${username}`)
                .then(response => response.json())
                .then(data => {
                    if (data.exists) {
                        usernameInput.classList.add('invalid');
                        usernameInput.classList.remove('valid');
                        usernameError.style.display = 'block';
                    } else {
                        usernameInput.classList.remove('invalid');
                        usernameInput.classList.add('valid');
                        usernameError.style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        } else {
            usernameInput.classList.remove('valid');
            usernameInput.classList.add('invalid');
            usernameError.style.display = 'none';
        }
    });

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;

        // Перевірка довжини
        if (password.length >= 8) {
            passwordRequirements.length.classList.remove('invalid');
            passwordRequirements.length.classList.add('valid');
        } else {
            passwordRequirements.length.classList.remove('valid');
            passwordRequirements.length.classList.add('invalid');
        }

        // Перевірка великої літери
        if (/[A-Z]/.test(password)) {
            passwordRequirements.uppercase.classList.remove('invalid');
            passwordRequirements.uppercase.classList.add('valid');
        } else {
            passwordRequirements.uppercase.classList.remove('valid');
            passwordRequirements.uppercase.classList.add('invalid');
        }

        // Перевірка малої літери
        if (/[a-z]/.test(password)) {
            passwordRequirements.lowercase.classList.remove('invalid');
            passwordRequirements.lowercase.classList.add('valid');
        } else {
            passwordRequirements.lowercase.classList.remove('valid');
            passwordRequirements.lowercase.classList.add('invalid');
        }

        // Перевірка цифри
        if (/\d/.test(password)) {
            passwordRequirements.number.classList.remove('invalid');
            passwordRequirements.number.classList.add('valid');
        } else {
            passwordRequirements.number.classList.remove('valid');
            passwordRequirements.number.classList.add('invalid');
        }

        // Підсвічування поля вводу паролю
        if (password.length > 0) {
            if (password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) {
                passwordInput.classList.remove('invalid');
                passwordInput.classList.add('valid');
            } else {
                passwordInput.classList.remove('valid');
                passwordInput.classList.add('invalid');
            }
        } else {
            passwordInput.classList.remove('valid');
            passwordInput.classList.add('invalid');
        }
    });

    form.addEventListener('submit', (event) => {
        const username = usernameInput.value;
        const password = passwordInput.value;
        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;

        if (username.length === 0 || usernameInput.classList.contains('invalid')) {
            event.preventDefault();
            usernameInput.classList.add('invalid');
        } else {
            usernameInput.classList.remove('invalid');
            usernameInput.classList.add('valid');
        }

        if (!passwordPattern.test(password)) {
            event.preventDefault();
            passwordInput.classList.add('invalid');
        } else {
            passwordInput.classList.remove('invalid');
            passwordInput.classList.add('valid');
        }
    });
});