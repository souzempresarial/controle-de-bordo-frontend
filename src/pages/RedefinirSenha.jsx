import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import PasswordInput from '../components/PasswordInput';
import './Login.css';

export default function RedefinirSenha() {
  const [params]             = useSearchParams();
  const navigate             = useNavigate();
  const { tema, toggleTema } = useTheme();
  const [novaSenha, setNovaSenha]   = useState('');
  const [confirma, setConfirma]     = useState('');
  const [erro, setErro]             = useState('');
  const [sucesso, setSucesso]       = useState(false);
  const [loading, setLoading]       = useState(false);

  const token = params.get('token');

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!novaSenha || !confirma) { setErro('Preencha os dois campos'); return; }
    if (novaSenha !== confirma)  { setErro('As senhas não coincidem'); return; }
    if (novaSenha.length < 6)    { setErro('Senha deve ter no mínimo 6 caracteres'); return; }
    setLoading(true); setErro('');
    try {
      await API.redefinirSenhaPorToken(token, novaSenha);
      setSucesso(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setErro(err.message || 'Erro ao redefinir senha. Tente novamente.');
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
          <p>{sucesso ? 'Senha redefinida!' : 'Criar nova senha'}</p>
        </div>

        {sucesso ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
              Sua senha foi redefinida com sucesso. Redirecionando para o login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label>Nova senha</label>
              <PasswordInput placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
            </div>
            <div className="field">
              <label>Confirmar senha</label>
              <PasswordInput placeholder="••••••••" value={confirma} onChange={e => setConfirma(e.target.value)} />
            </div>
            {erro && <div className="login-erro">{erro}</div>}
            <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
          </form>
        )}

        <div className="login-footer">SOUZ Empresarial</div>
      </div>
    </div>
  );
}
