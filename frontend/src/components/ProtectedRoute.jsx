import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // checking | ok | denied

  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/me')
      .then(() => !cancelled && setStatus('ok'))
      .catch(() => !cancelled && setStatus('denied'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return <div className="admin-page"><p style={{ color: '#766f63' }}>Проверяем доступ…</p></div>;
  }

  if (status === 'denied') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
