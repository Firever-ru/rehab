import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

// Fraction (0..1) crop rectangle geometry, shared by the crop tool below and
// used to keep the "Сбросить кадр" reset in sync with what the backend does
// for a freshly uploaded photo: the largest aspect-ratio rectangle that fits
// centered inside the full image.
function defaultCrop(naturalW, naturalH, aspect) {
  const imageAspect = naturalW / naturalH;
  let w;
  let h;
  if (imageAspect > aspect) {
    h = 1;
    w = aspect / imageAspect;
  } else {
    w = 1;
    h = imageAspect / aspect;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

// Opposite-corner anchor + outward sign for each of the 4 resize handles.
const CORNER_ANCHOR = {
  'top-left': { anchor: 'bottom-right', sx: -1, sy: -1 },
  'top-right': { anchor: 'bottom-left', sx: 1, sy: -1 },
  'bottom-right': { anchor: 'top-left', sx: 1, sy: 1 },
  'bottom-left': { anchor: 'top-right', sx: -1, sy: 1 },
};

const MIN_CROP_FRACTION = 0.12;

/**
 * A real "photo app" style crop tool: shows the whole source photo and lets
 * the admin drag an aspect-locked rectangle around on top of it — move it by
 * dragging inside, resize it (keeping the 16:9 / 9:16 ratio) by dragging any
 * of the 4 corners, exactly like cropping a photo on a phone.
 */
function CropTool({ src, aspect, aspectLabel, crop, onChange }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNatural(null);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!natural) {
    return <div className="crop-canvas crop-canvas-loading">Загружаем фото…</div>;
  }

  const imageAspect = natural.w / natural.h;

  function pointerFraction(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerDown(e) {
    if (e.target.closest('.crop-handle')) return;
    if (!e.target.closest('.crop-box')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      type: 'move',
      pointerId: e.pointerId,
      start: pointerFraction(e),
      crop: { ...crop },
    };
    setDragging(true);
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const pointer = pointerFraction(e);

    if (drag.type === 'move') {
      const dx = pointer.x - drag.start.x;
      const dy = pointer.y - drag.start.y;
      const x = Math.max(0, Math.min(1 - drag.crop.w, drag.crop.x + dx));
      const y = Math.max(0, Math.min(1 - drag.crop.h, drag.crop.y + dy));
      onChange({ ...drag.crop, x, y });
      return;
    }

    const { anchorX, anchorY, sx, sy } = drag;
    const maxW = Math.min(1, aspect / imageAspect);
    const maxWx = sx > 0 ? 1 - anchorX : anchorX;
    const maxHy = sy > 0 ? 1 - anchorY : anchorY;
    const maxWy = maxHy * aspect / imageAspect;
    const maxWBound = Math.max(MIN_CROP_FRACTION, Math.min(maxW, maxWx, maxWy));

    const diagX = Math.max(0, sx > 0 ? pointer.x - anchorX : anchorX - pointer.x);
    const diagY = Math.max(0, sy > 0 ? pointer.y - anchorY : anchorY - pointer.y);
    const desiredW = Math.max(diagX, diagY * aspect / imageAspect);
    const w = Math.max(MIN_CROP_FRACTION, Math.min(maxWBound, desiredW));
    const h = w * imageAspect / aspect;
    const x = sx > 0 ? anchorX : anchorX - w;
    const y = sy > 0 ? anchorY : anchorY - h;
    onChange({ x, y, w, h });
  }

  function endDrag(e) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
    setDragging(false);
  }

  function handleCornerDown(handle) {
    return (e) => {
      e.stopPropagation();
      e.currentTarget.closest('.crop-canvas').setPointerCapture(e.pointerId);
      const { anchor, sx, sy } = CORNER_ANCHOR[handle];
      const anchorX = anchor.includes('right') ? crop.x + crop.w : crop.x;
      const anchorY = anchor.includes('bottom') ? crop.y + crop.h : crop.y;
      dragRef.current = { type: 'resize', pointerId: e.pointerId, anchorX, anchorY, sx, sy };
      setDragging(true);
    };
  }

  return (
    <div
      ref={canvasRef}
      className={`crop-canvas ${dragging ? 'is-dragging' : ''}`}
      style={{ aspectRatio: `${natural.w} / ${natural.h}` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img src={src} alt="Исходное фото" draggable="false" className="crop-canvas-img" />

      <div className="crop-dim" style={{ left: 0, top: 0, right: 0, height: `${crop.y * 100}%` }} />
      <div className="crop-dim" style={{ left: 0, bottom: 0, right: 0, height: `${(1 - crop.y - crop.h) * 100}%` }} />
      <div className="crop-dim" style={{ left: 0, top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` }} />
      <div className="crop-dim" style={{ right: 0, top: `${crop.y * 100}%`, width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%` }} />

      <div
        className="crop-box"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
      >
        <span className="crop-grid-v" /><span className="crop-grid-v" />
        <span className="crop-grid-h" /><span className="crop-grid-h" />
        {['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((handle) => (
          <span key={handle} className={`crop-handle crop-handle-${handle}`} onPointerDown={handleCornerDown(handle)} />
        ))}
      </div>
      <div className="crop-help">{aspectLabel} — тяните за угол, чтобы изменить размер, или за рамку, чтобы сдвинуть</div>
    </div>
  );
}

const EMPTY_CONTENT = {
  title: '',
  description: '',
  description_2: '',
  description_3: '',
  quotes: [],
  hero_image: null,
  hero_source_image: null,
  hero_mobile_image: null,
  hero_crop_x: 0,
  hero_crop_y: 0,
  hero_crop_w: 1,
  hero_crop_h: 1,
  hero_mobile_crop_x: 0,
  hero_mobile_crop_y: 0,
  hero_mobile_crop_w: 1,
  hero_mobile_crop_h: 1,
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
  const [cropMode, setCropMode] = useState('desktop');
  const [notice, setNotice] = useState('');

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
        hero_crop_x: content.hero_crop_x,
        hero_crop_y: content.hero_crop_y,
        hero_crop_w: content.hero_crop_w,
        hero_crop_h: content.hero_crop_h,
        hero_mobile_crop_x: content.hero_mobile_crop_x,
        hero_mobile_crop_y: content.hero_mobile_crop_y,
        hero_mobile_crop_w: content.hero_mobile_crop_w,
        hero_mobile_crop_h: content.hero_mobile_crop_h,
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
      setContent((c) => ({ ...c, ...saved }));
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

            {(content.hero_source_image || content.hero_image) && (() => {
              const mobile = cropMode === 'mobile';
              const xKey = mobile ? 'hero_mobile_crop_x' : 'hero_crop_x';
              const yKey = mobile ? 'hero_mobile_crop_y' : 'hero_crop_y';
              const wKey = mobile ? 'hero_mobile_crop_w' : 'hero_crop_w';
              const hKey = mobile ? 'hero_mobile_crop_h' : 'hero_crop_h';
              const aspect = mobile ? 9 / 16 : 16 / 9;
              const previewSrc = content.hero_source_image || content.hero_image;
              const crop = {
                x: content[xKey] ?? 0,
                y: content[yKey] ?? 0,
                w: content[wKey] ?? 1,
                h: content[hKey] ?? 1,
              };

              const updateCrop = (next) =>
                setContent((c) => ({ ...c, [xKey]: next.x, [yKey]: next.y, [wKey]: next.w, [hKey]: next.h }));

              return (
                <>
                  <div className="crop-mode-switch">
                    <button type="button" className={cropMode === 'desktop' ? 'active' : ''} onClick={() => setCropMode('desktop')}>
                      Компьютер
                    </button>
                    <button type="button" className={cropMode === 'mobile' ? 'active' : ''} onClick={() => setCropMode('mobile')}>
                      Телефон
                    </button>
                  </div>

                  <CropTool
                    key={`${previewSrc}-${cropMode}`}
                    src={previewSrc}
                    aspect={aspect}
                    aspectLabel={mobile ? 'Телефон · 9:16' : 'Компьютер · 16:9'}
                    crop={crop}
                    onChange={updateCrop}
                  />

                  <div className="image-controls">
                    <button
                      type="button"
                      className="outline crop-reset"
                      onClick={() => {
                        const img = new Image();
                        img.onload = () => {
                          updateCrop(defaultCrop(img.naturalWidth, img.naturalHeight, aspect));
                        };
                        img.src = previewSrc;
                      }}
                    >
                      Сбросить кадр
                    </button>
                  </div>
                  <p className="field-hint">
                    Для одного и того же исходного фото задаётся отдельный кадр для компьютера и телефона: выделите на фото область, которая попадёт на сайт. Рамка всегда сохраняет пропорции 16:9 (компьютер) или 9:16 (телефон) — можно только двигать её и менять размер за углы, как при обрезке фото на телефоне.
                  </p>
                </>
              );
            })()}
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
