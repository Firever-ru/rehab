import { Link } from 'react-router-dom';

export default function Header({ phone = '+7 (993) 030-00-44' }) {
  const telHref = `tel:${phone.replace(/[^\d+]/g, '')}`;

  return (
    <header className="site-header">
      <a href="#top" className="mini-brand">
        <span>ВД</span>
        <b>ВТОРОЕ ДЫХАНИЕ</b>
      </a>
      <nav>
        <a href="#about">О центре</a>
        <a href="#values">Помощь</a>
        <a href="#contacts">Контакты</a>
      </nav>
      <a className="header-phone" href={telHref}>
        {phone}
      </a>
      <Link className="admin-dot" to="/admin" aria-label="Служебный вход">
        •
      </Link>
    </header>
  );
}
