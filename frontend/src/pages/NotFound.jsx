import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="admin-page">
      <div className="admin-login" style={{ textAlign: 'center' }}>
        <span className="eyebrow">404</span>
        <h1>Страница не найдена</h1>
        <Link to="/" className="back">
          ← На главную
        </Link>
      </div>
    </main>
  );
}
