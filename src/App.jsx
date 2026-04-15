import { useState } from 'react';
import Login from './pages/Login';

export default function App() {
  const [usuario, setUsuario] = useState(() => {
    const token = localStorage.getItem('cb_token');
    const papel = localStorage.getItem('cb_papel');
    const nome  = localStorage.getItem('cb_nome');
    return token ? { token, papel, nome } : null;
  });

  function handleLogin(dados) {
    setUsuario(dados);
  }

  function handleLogout() {
    localStorage.removeItem('cb_token');
    localStorage.removeItem('cb_papel');
    localStorage.removeItem('cb_nome');
    localStorage.removeItem('cb_cliente_id');
    setUsuario(null);
  }

  if (!usuario) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ color: '#f0f8f2', padding: '40px', fontFamily: 'sans-serif' }}>
      <p>Olá, <strong>{usuario.nome}</strong>! ({usuario.papel})</p>
      <button
        onClick={handleLogout}
        style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        Sair
      </button>
    </div>
  );
}
