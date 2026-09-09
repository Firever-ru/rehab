import { useState } from 'react';
import { api } from '../lib/api.js';

function formatPhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (!digits.startsWith('7')) digits = '7' + digits;
  digits = digits.slice(0, 11);

  const parts = [
    digits.slice(1, 4),
    digits.slice(4, 7),
    digits.slice(7, 9),
    digits.slice(9, 11),
  ];

  let result = '+7';
  if (digits.length > 1) result += ` (${parts[0]}`;
  if (digits.length >= 4) result += `) ${parts[1]}`;
  if (digits.length >= 7) result += `-${parts[2]}`;
  if (digits.length >= 9) result += `-${parts[3]}`;
  return result;
}

export default function ApplicationForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 11) {
      setError('Проверьте номер телефона.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/applications', { name: name.trim(), phone });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить заявку. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="application-form">
        <div className="success">
          <div className="success-mark">✓</div>
          <h3>Заявка принята</h3>
          <p>Спасибо. Мы свяжемся с вами по указанному номеру.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="application-form" onSubmit={submit}>
      <label>
        Ваше имя
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Имя"
          maxLength={120}
          disabled={loading}
        />
      </label>
      <label>
        Номер телефона
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          required
          placeholder="+7 (___) ___-__-__"
          inputMode="tel"
          disabled={loading}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="gold-button" type="submit" disabled={loading}>
        {loading ? 'Отправляем…' : 'Оставить заявку'}
      </button>
    </form>
  );
}
