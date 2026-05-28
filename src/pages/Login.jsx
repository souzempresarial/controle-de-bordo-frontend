import { useState } from 'react';
import { API } from '../services/api';
import './Login.css';

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
      const data = await API.login({ email, senha });

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
          <div className="login-logo-wrap">
            <img src="/logo.png" alt="SOUZ Finance" className="login-logo-img" />
          </div>
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
          SOUZ Empresarial
        </div>
      </div>
    </div>
  );
}
