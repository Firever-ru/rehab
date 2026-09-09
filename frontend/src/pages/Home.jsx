import { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import ApplicationForm from '../components/ApplicationForm.jsx';
import { api } from '../lib/api.js';
import heroFallback from '../assets/hero.jfif';

const DEFAULT_CONTENT = {
  title: 'Реабилитационный центр «Второе дыхание»',
  description: 'Помогаем вернуться к устойчивой и самостоятельной жизни.',
  description_2: '',
  description_3: '',
  quotes: ['Иногда новая жизнь начинается с одного честного решения.'],
  hero_image: null,
  hero_position_x: 50,
  hero_position_y: 50,
  hero_zoom: 100,
};

const DEFAULT_CONTACTS = {
  phone: '+7 (993) 030-00-44',
  email: 'vtoroe.dyhanie.centr@gmail.com',
  vk: 'https://m.vk.ru/vtoroe_dyhanie_centr',
  instagram: 'vtoroe_dyhanie_centr',
};

function renderParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((paragraph, index) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

export default function Home() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [contacts, setContacts] = useState(DEFAULT_CONTACTS);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    api.get('/content').then(setContent).catch(() => {});
    api.get('/contacts').then(setContacts).catch(() => {});
  }, []);

  useEffect(() => {
    if (content.quotes.length < 2) return;
    const id = setInterval(() => setQuoteIndex((i) => (i + 1) % content.quotes.length), 7000);
    return () => clearInterval(id);
  }, [content.quotes.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const heroImage = content.hero_image || heroFallback;
  const quote = content.quotes[quoteIndex] || DEFAULT_CONTENT.quotes[0];
  const telHref = `tel:${contacts.phone.replace(/[^\d+]/g, '')}`;
  const instagramUrl = contacts.instagram.startsWith('http')
    ? contacts.instagram
    : `https://instagram.com/${contacts.instagram}`;

  const heroStyle = {
    '--hero-position-x': `${content.hero_position_x ?? 50}%`,
    '--hero-position-y': `${content.hero_position_y ?? 50}%`,
    '--hero-zoom': `${content.hero_zoom ?? 100}%`,
  };

  return (
    <div id="top" className="page">
      <Header phone={contacts.phone} />

      <section className="quote quote-top">
        <div>«{quote}»</div>
      </section>

      <section className="hero" style={heroStyle}>
        <img className="hero-image" src={heroImage} alt={content.title || 'Второе дыхание'} />
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">
            {content.title || 'Реабилитационный центр «Второе дыхание»'}
          </h1>
          <button className="hero-button" onClick={() => setOpen(true)}>
            Оставить заявку <span>→</span>
          </button>
        </div>
      </section>

      <section id="about" className="intro">
        <div>
          <span className="eyebrow">ВТОРОЕ ДЫХАНИЕ</span>
          <h1>
            Путь к новой жизни
            <br />
            <i>начинается с шага</i>
          </h1>
        </div>
        <div className="intro-text">
          {renderParagraphs(content.description)}
          <button className="text-link" onClick={() => setOpen(true)}>
            Получить консультацию <span>→</span>
          </button>
        </div>
      </section>

      {(content.description_2 || content.description_3) && (
        <section className="descriptions">
          {content.description_2 && (
            <article>
              <span className="eyebrow">ВОССТАНОВЛЕНИЕ</span>
              <h2>Шаг за шагом</h2>
              <div className="description-text">{renderParagraphs(content.description_2)}</div>
            </article>
          )}
          {content.description_3 && (
            <article>
              <span className="eyebrow">ПОДДЕРЖКА</span>
              <h2>Мы рядом</h2>
              <div className="description-text">{renderParagraphs(content.description_3)}</div>
            </article>
          )}
        </section>
      )}

      <section id="application" className="application">
        <div>
          <span className="eyebrow">ПЕРВЫЙ ШАГ</span>
          <h2>
            Не обязательно
            <br />
            <i>проходить путь одному</i>
          </h2>
          <p>Оставьте имя и номер телефона. Специалист свяжется с вами и ответит на вопросы.</p>
        </div>
        <ApplicationForm />
      </section>

      <section id="contacts" className="contacts">
        <div>
          <span className="eyebrow">КОНТАКТЫ</span>
          <h2>
            Свяжитесь
            <br />
            <i>с нами</i>
          </h2>
        </div>
        <div className="contact-list">
          <a href={telHref}>{contacts.phone}</a>
          <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
          <a href={contacts.vk} target="_blank" rel="noreferrer">
            VK · {contacts.vk.replace('https://m.vk.ru/', '')}
          </a>
          <a href={instagramUrl} target="_blank" rel="noreferrer">
            Instagram · {contacts.instagram}
          </a>
          <small className="social-note">Meta признана экстремистской организацией; её деятельность запрещена на территории РФ.</small>
        </div>
      </section>

      <footer>© 2026 «Второе дыхание»</footer>

      {open && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Форма заявки"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="modal-box">
            <button className="close" aria-label="Закрыть" onClick={() => setOpen(false)}>
              ×
            </button>
            <span className="eyebrow">ПЕРВЫЙ ШАГ</span>
            <h2>Оставить заявку</h2>
            <p>Мы свяжемся с вами и ответим на вопросы.</p>
            <ApplicationForm />
          </div>
        </div>
      )}
    </div>
  );
}
