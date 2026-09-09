import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function AdminLogin() {
  const nav = useNavigate();
  const [login, setLogin] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/login', { login, password: pass });
      nav('/admin/dashboard');
    } catch (err) {
      setError(err.status === 401 ? 'Неверный логин или пароль.' : 'Не удалось войти. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-page">
      <form className="admin-login" onSubmit={submit}>
        <span className="eyebrow">СЛУЖЕБНЫЙ ВХОД</span>
        <h1>Админ-панель</h1>
        <label>
          Логин
          <input value={login} onChange={(e) => setLogin(e.target.value)} required disabled={loading} />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            disabled={loading}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="gold-button" disabled={loading}>
          {loading ? 'Входим…' : 'Войти'}
        </button>
        <a href="/" className="back">
          ← На сайт
        </a>
      </form>
    </main>
  );
}
