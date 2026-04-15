import { useState } from 'react';
import './Login.css';

const API_URL = 'https://controle-de-bordo-backend-production.up.railway.app';

export default function Login({ onLogin }) {
  const [email, setEmail]     = useState('');
  const [senha, setSenha]     = useState('');
  const [erro, setErro]       = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !senha) { setErro('Preencha email e senha'); return; }

    setLoading(true);
    setErro('');

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao fazer login');

      localStorage.setItem('cb_token',     data.token);
      localStorage.setItem('cb_papel',     data.papel);
      localStorage.setItem('cb_nome',      data.nome || '');
      if (data.clienteId) localStorage.setItem('cb_cliente_id', String(data.clienteId));

      onLogin(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📊</div>
          <h1>Controle de Bordo</h1>
          <p>Faça login para acessar sua conta</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
            />
          </div>

          {erro && <div className="login-erro">{erro}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-footer">
          SOUZ Empresarial · Controle de Bordo 2.0
        </div>
      </div>
    </div>
  );
}
