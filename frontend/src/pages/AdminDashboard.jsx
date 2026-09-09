import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const EMPTY_CONTENT = {
  title: '',
  description: '',
  description_2: '',
  description_3: '',
  quotes: [],
  hero_image: null,
  hero_source_image: null,
  hero_position_x: 50,
  hero_position_y: 50,
  hero_zoom: 100,
};

export default function AdminDashboard() {
  const nav = useNavigate();

  const [content, setContent] = useState(EMPTY_CONTENT);
  const [contacts, setContacts] = useState({ phone: '', email: '', vk: '', instagram: '' });
  const [applications, setApplications] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [contentSaving, setContentSaving] = useState(false);
  const [contactsSaving, setContactsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const cropRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    api.get('/content').then(setContent).catch(() => {});
    api.get('/contacts').then(setContacts).catch(() => {});
    loadApplications();
  }, []);

  function loadApplications(from = '', to = '') {
    const params = new URLSearchParams();
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    const qs = params.toString();
    api.get(`/applications${qs ? `?${qs}` : ''}`).then(setApplications).catch(() => {});
  }

  function flash(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  }

  async function saveContent() {
    setContentSaving(true);
    try {
      const saved = await api.put('/content', {
        title: content.title,
        description: content.description,
        description_2: content.description_2,
        description_3: content.description_3,
        quotes: content.quotes.filter((q) => q.trim() !== ''),
        hero_position_x: Number(content.hero_position_x),
        hero_position_y: Number(content.hero_position_y),
        hero_zoom: Number(content.hero_zoom),
      });
      setContent((c) => ({ ...c, ...saved }));
      flash('Изменения сохранены');
    } catch {
      flash('Не удалось сохранить. Попробуйте ещё раз.');
    } finally {
      setContentSaving(false);
    }
  }

  async function saveContacts() {
    setContactsSaving(true);
    try {
      await api.put('/contacts', contacts);
      flash('Контакты сохранены');
    } catch {
      flash('Не удалось сохранить контакты.');
    } finally {
      setContactsSaving(false);
    }
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const saved = await api.post('/content/hero-image', form);
      setContent((c) => ({ ...c, hero_image: saved.hero_image, hero_source_image: saved.hero_source_image || saved.hero_image, hero_position_x: 50, hero_position_y: 50, hero_zoom: 100 }));
      flash('Фото обновлено. Настройте кадрирование и сохраните изменения.');
    } catch {
      flash('Не удалось загрузить фото (JPEG/PNG/WEBP, до 8 МБ).');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function updateQuote(index, value) {
    setContent((c) => {
      const quotes = [...c.quotes];
      quotes[index] = value;
      return { ...c, quotes };
    });
  }

  function removeQuote(index) {
    setContent((c) => ({ ...c, quotes: c.quotes.filter((_, i) => i !== index) }));
  }

  function addQuote() {
    setContent((c) => ({ ...c, quotes: [...c.quotes, ''] }));
  }

  async function deleteRange() {
    if (!dateFrom || !dateTo) {
      flash('Укажите обе даты периода.');
      return;
    }
    if (!window.confirm('Удалить все заявки за выбранный период? Это необратимо.')) return;
    try {
      await api.del(`/applications?date_from=${dateFrom}&date_to=${dateTo}`);
      flash('Заявки за период удалены');
      loadApplications(dateFrom, dateTo);
    } catch {
      flash('Не удалось удалить заявки.');
    }
  }

  async function downloadExcel() {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const res = await fetch(`/api/applications/export?${params.toString()}`, { credentials: 'include' });
    if (!res.ok) {
      flash('Не удалось скачать файл.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applications.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    try {
      await api.post('/auth/logout', {});
    } finally {
      nav('/admin');
    }
  }

  return (
    <main className="dashboard">
      <aside>
        <b>ВТОРОЕ ДЫХАНИЕ</b>
        <nav>
          <a href="#content">Главная</a>
          <a href="#contacts">Контакты</a>
          <a href="#requests">Заявки</a>
        </nav>
        <Link to="/">← На сайт</Link>
      </aside>

      <section className="dash-main">
        <header>
          <div>
            <span className="eyebrow">СЛУЖЕБНЫЙ РАЗДЕЛ</span>
          </div>
          <button className="outline" onClick={logout}>Выйти</button>
        </header>

        {notice && <p className="dash-notice">{notice}</p>}

        <section id="content" className="panel">
          <h2>Главная страница</h2>

          <label>
            Заголовок
            <input value={content.title} onChange={(e) => setContent((c) => ({ ...c, title: e.target.value }))} />
          </label>

          <label>
            Описание 1
            <textarea
              value={content.description}
              onChange={(e) => setContent((c) => ({ ...c, description: e.target.value }))}
              placeholder="Введите текст. Пустая строка между строками создаёт новый абзац."
            />
          </label>

          <label>
            Описание 2
            <textarea
              value={content.description_2}
              onChange={(e) => setContent((c) => ({ ...c, description_2: e.target.value }))}
              placeholder="Дополнительный блок текста"
            />
          </label>

          <label>
            Описание 3
            <textarea
              value={content.description_3}
              onChange={(e) => setContent((c) => ({ ...c, description_3: e.target.value }))}
              placeholder="Ещё один блок текста"
            />
          </label>

          <label>Цитаты</label>
          {content.quotes.map((q, i) => (
            <div className="quote-row" key={i}>
              <textarea value={q} onChange={(e) => updateQuote(i, e.target.value)} />
              <button type="button" className="outline" onClick={() => removeQuote(i)}>Удалить</button>
            </div>
          ))}
          <button type="button" className="outline" onClick={addQuote}>+ Добавить цитату</button>

          <div className="image-editor">
            <label>
              Главное фото
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploading} />
            </label>

            {(content.hero_source_image || content.hero_image) && (
              <>
                <div
                  ref={cropRef}
                  className={`hero-cropper ${dragRef.current ? 'is-dragging' : ''}`}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragRef.current = {
                      pointerId: e.pointerId,
                      startX: e.clientX,
                      startY: e.clientY,
                      x: Number(content.hero_position_x) || 50,
                      y: Number(content.hero_position_y) || 50,
                    };
                    e.currentTarget.classList.add('is-dragging');
                  }}
                  onPointerMove={(e) => {
                    const drag = dragRef.current;
                    const box = cropRef.current;
                    if (!drag || !box || e.pointerId !== drag.pointerId) return;
                    const rect = box.getBoundingClientRect();
                    const sensitivity = 100 / Math.max(1, rect.width);
                    const nextX = Math.max(0, Math.min(100, drag.x - (e.clientX - drag.startX) * sensitivity));
                    const nextY = Math.max(0, Math.min(100, drag.y - (e.clientY - drag.startY) * sensitivity));
                    setContent((c) => ({ ...c, hero_position_x: Math.round(nextX), hero_position_y: Math.round(nextY) }));
                  }}
                  onPointerUp={(e) => {
                    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
                    e.currentTarget.classList.remove('is-dragging');
                  }}
                  onPointerCancel={(e) => {
                    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
                    e.currentTarget.classList.remove('is-dragging');
                  }}
                >
                  <img
                    src={content.hero_source_image || content.hero_image}
                    alt="Предпросмотр главного фото"
                    draggable="false"
                    style={{
                      '--hero-position-x': `${content.hero_position_x}%`,
                      '--hero-position-y': `${content.hero_position_y}%`,
                      '--hero-zoom': `${(content.hero_zoom ?? 100) / 100}`,
                    }}
                  />
                  <div className="crop-frame" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="crop-help">Перетаскивайте фото для кадрирования</div>
                </div>

                <div className="image-controls">
                  <label>
                    Масштаб: {content.hero_zoom}%
                    <input
                      type="range" min="100" max="220" value={content.hero_zoom}
                      onChange={(e) => setContent((c) => ({ ...c, hero_zoom: Number(e.target.value) }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="outline crop-reset"
                    onClick={() => setContent((c) => ({ ...c, hero_position_x: 50, hero_position_y: 50, hero_zoom: 100 }))}
                  >
                    Сбросить кадр
                  </button>
                </div>
                <p className="field-hint">Зажмите фото и перетащите его. Рамка показывает, какая область попадёт на сайт. На телефоне работает пальцем.</p>
              </>
            )}
          </div>

          <button className="gold-button" onClick={saveContent} disabled={contentSaving}>
            {contentSaving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </section>

        <section id="contacts" className="panel">
          <h2>Контакты</h2>
          <div className="two">
            <label>
              Телефон
              <input value={contacts.phone} onChange={(e) => setContacts((c) => ({ ...c, phone: e.target.value }))} />
            </label>
            <label>
              Email
              <input value={contacts.email} onChange={(e) => setContacts((c) => ({ ...c, email: e.target.value }))} />
            </label>
            <label>
              VK
              <input value={contacts.vk} onChange={(e) => setContacts((c) => ({ ...c, vk: e.target.value }))} />
            </label>
            <label>
              Instagram
              <input value={contacts.instagram} onChange={(e) => setContacts((c) => ({ ...c, instagram: e.target.value }))} />
              <small className="field-hint">Meta признана экстремистской организацией; её деятельность запрещена на территории РФ.</small>
            </label>
          </div>
          <button className="gold-button" onClick={saveContacts} disabled={contactsSaving}>
            {contactsSaving ? 'Сохраняем…' : 'Сохранить контакты'}
          </button>
        </section>

        <section id="requests" className="panel">
          <div className="panel-title">
            <h2>Заявки</h2>
            <button className="outline" onClick={downloadExcel}>Скачать Excel</button>
          </div>
          <div className="filters">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <button className="outline" onClick={() => loadApplications(dateFrom, dateTo)}>Показать</button>
            <button className="outline" onClick={deleteRange}>Удалить за период</button>
          </div>
          <table>
            <thead><tr><th>Имя</th><th>Телефон</th><th>Дата</th></tr></thead>
            <tbody>
              {applications.length === 0 && <tr><td colSpan={3}>Заявок пока нет</td></tr>}
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.phone}</td>
                  <td>{new Date(a.created_at).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
