export default function Header({ phone = '+7 (993) 030-00-44' }) {
  const telHref = `tel:${phone.replace(/[^\d+]/g, '')}`;

  return (
    <header className="site-header">
      <nav>
        <a href="#about">О центре</a>
        <a href="#application">Заявка</a>
        <a href="#contacts">Контакты</a>
      </nav>
      <a className="header-phone" href={telHref}>
        {phone}
      </a>
    </header>
  );
}
