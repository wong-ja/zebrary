document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');

  showRegister.addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginError.classList.add('hidden');
  });

  showLogin.addEventListener('click', function (e) {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    registerError.classList.add('hidden');
  });

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    loginError.classList.add('hidden');
    var username = document.getElementById('login-username').value;
    var password = document.getElementById('login-password').value;
    try {
      var res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password }),
        credentials: 'include',
      });
      var data = await res.json();
      if (!res.ok) {
        loginError.textContent = data.error;
        loginError.classList.remove('hidden');
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      loginError.textContent = 'Network error';
      loginError.classList.remove('hidden');
    }
  });

  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    registerError.classList.add('hidden');
    var username = document.getElementById('register-username').value;
    var email = document.getElementById('register-email').value;
    var password = document.getElementById('register-password').value;
    try {
      var res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, email: email || undefined, password: password }),
        credentials: 'include',
      });
      var data = await res.json();
      if (!res.ok) {
        registerError.textContent = data.error;
        registerError.classList.remove('hidden');
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      registerError.textContent = 'Network error';
      registerError.classList.remove('hidden');
    }
  });
});
