import { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import ApplicationForm from '../components/ApplicationForm.jsx';
import { api } from '../lib/api.js';
import heroFallback from '../assets/hero.jfif';

const DEFAULT_CONTENT = {
  title: 'Реабилитационный центр «Второе дыхание»',
  description: 'Помогаем вернуться к устойчивой и самостоятельной жизни.',
  quotes: ['Иногда новая жизнь начинается с одного честного решения.'],
  hero_image: null,
};

const DEFAULT_CONTACTS = {
  phone: '+7 (993) 030-00-44',
  email: 'vtoroe.dyhanie.centr@gmail.com',
  vk: 'https://m.vk.ru/vtoroe_dyhanie_centr',
  instagram: 'vtoroe_dyhanie_centr',
};

const values = [
  ['01', 'ПОМОЩЬ', 'Профессиональная поддержка на каждом этапе'],
  ['02', 'ИНДИВИДУАЛЬНЫЙ ПОДХОД', 'Программа реабилитации для каждого человека'],
  ['03', 'ВОССТАНОВЛЕНИЕ', 'Комплексная работа для души и тела'],
  ['04', 'НОВАЯ ЖИЗНЬ', 'Возвращаем веру в себя и строим будущее вместе'],
];

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

  return (
    <div id="top" className="page">
      <Header phone={contacts.phone} />

      <section className="hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-title">
            Реабилитационный
            <br />
            <strong>центр «Второе дыхание»</strong>
          </div>
          <p>Шанс. Поддержка. Новая жизнь.</p>
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
          <p>{content.description}</p>
          <p>Мы рядом на каждом этапе пути. Бережно, уважительно и без лишних обещаний.</p>
          <button className="text-link" onClick={() => setOpen(true)}>
            Получить консультацию <span>→</span>
          </button>
        </div>
      </section>

      <section id="values" className="values">
        <div className="section-head">
          <span className="eyebrow">НАШ ПОДХОД</span>
          <h2>
            Ты можешь. <i>Мы рядом.</i>
          </h2>
        </div>
        <div className="values-grid">
          {values.map(([n, t, d]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="quote">
        <div>«{quote}»</div>
      </section>

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
        </div>
      </section>

      <footer>© 2026 «Второе дыхание» · Реабилитационный центр в Новосибирске</footer>

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
