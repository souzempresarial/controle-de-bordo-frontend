import { useState } from 'react';
import { API } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import './Login.css';

export default function Login({ onLogin }) {
  const [tela, setTela]       = useState('login'); // 'login' | 'registro' | 'pendente'
  const [email, setEmail]     = useState('');
  const [senha, setSenha]     = useState('');
  const [nome, setNome]       = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro]       = useState('');
  const [info, setInfo]       = useState('');
  const [loading, setLoading] = useState(false);
  const { tema, toggleTema }  = useTheme();

  function irPara(t) { setTela(t); setErro(''); setInfo(''); }

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !senha) { setErro('Preencha email e senha'); return; }
    setLoading(true); setErro('');
    try {
      const data = await API.login({ email, senha });
      sessionStorage.setItem('cb_papel',     data.papel);
      sessionStorage.setItem('cb_nome',      data.nome || '');
      if (data.clienteId) sessionStorage.setItem('cb_cliente_id', String(data.clienteId));
      onLogin(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistro(e) {
    e.preventDefault();
    if (!nome || !email || !senha) { setErro('Preencha todos os campos'); return; }
    if (senha !== confirma) { setErro('As senhas não coincidem'); return; }
    if (senha.length < 6)   { setErro('Senha deve ter no mínimo 6 caracteres'); return; }
    setLoading(true); setErro('');
    try {
      await API.registrar({ nome, email, senha });
      setTela('pendente');
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReenviar() {
    if (!email) { setErro('Digite seu e-mail para reenviar'); return; }
    setLoading(true); setErro(''); setInfo('');
    try {
      await API.reenviarVerificacao(email);
      setInfo('Novo link enviado. Verifique sua caixa de entrada.');
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <button className="login-tema-btn" onClick={toggleTema} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
        {tema === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="SOUZ Finance" className="login-logo" />
          {tela === 'login'    && <p>Faça login para acessar sua conta</p>}
          {tela === 'registro' && <p>Crie sua conta gratuitamente</p>}
          {tela === 'pendente' && <p>Verifique seu e-mail</p>}
        </div>

        {/* ── Login ── */}
        {tela === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Senha</label>
              <input type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} />
            </div>
            {erro && <div className="login-erro">{erro}</div>}
            <button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
            <p style={{ textAlign: 'center', fontSize: 13, marginTop: 12, color: 'var(--text2)' }}>
              Não tem conta?{' '}
              <button type="button" onClick={() => irPara('registro')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 600 }}>
                Criar conta
              </button>
            </p>
          </form>
        )}

        {/* ── Registro ── */}
        {tela === 'registro' && (
          <form onSubmit={handleRegistro} className="login-form">
            <div className="field">
              <label>Nome</label>
              <input type="text" placeholder="Seu nome ou da empresa" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Senha</label>
              <input type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} />
            </div>
            <div className="field">
              <label>Confirmar senha</label>
              <input type="password" placeholder="••••••••" value={confirma} onChange={e => setConfirma(e.target.value)} />
            </div>
            {erro && <div className="login-erro">{erro}</div>}
            <button type="submit" disabled={loading}>{loading ? 'Criando conta...' : 'Criar conta'}</button>
            <p style={{ textAlign: 'center', fontSize: 13, marginTop: 12, color: 'var(--text2)' }}>
              Já tem conta?{' '}
              <button type="button" onClick={() => irPara('login')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 600 }}>
                Fazer login
              </button>
            </p>
          </form>
        )}

        {/* ── Pendente verificação ── */}
        {tela === 'pendente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6 }}>
              Enviamos um link de verificação para <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              Clique no link para ativar sua conta.
            </p>
            {erro  && <div className="login-erro">{erro}</div>}
            {info  && <div style={{ color: 'var(--entrada)', fontSize: 13, textAlign: 'center' }}>{info}</div>}
            <button onClick={handleReenviar} disabled={loading} style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14 }}>
              {loading ? 'Enviando...' : 'Reenviar e-mail'}
            </button>
            <button type="button" onClick={() => irPara('login')}
              style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
              Voltar ao login
            </button>
          </div>
        )}

        <div className="login-footer">SOUZ Empresarial</div>
      </div>
    </div>
  );
}