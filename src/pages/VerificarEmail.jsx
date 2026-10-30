import { useEffect, useState } from 'react';
import Icone from '../components/Icone';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '../services/api';

export default function VerificarEmail() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const [status, setStatus] = useState('verificando'); // 'verificando' | 'ok' | 'erro'
  const [msg, setMsg]       = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('erro'); setMsg('Link inválido.'); return; }
    API.verificarEmail(token)
      .then(data => { setStatus('ok'); setMsg(data.mensagem || 'E-mail verificado!'); })
      .catch(err => { setStatus('erro'); setMsg(err.message || 'Erro inesperado. Tente novamente.'); });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 32px', maxWidth: 420, width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <img src="/logo.png" alt="SOUZ Finance" style={{ height: 48, objectFit: 'contain', margin: '0 auto' }} />

        {status === 'verificando' && (
          <>
            <p style={{ fontSize: 15, color: 'var(--text2)' }}>Verificando seu e-mail...</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ color: 'var(--entrada)' }}><Icone nome="checkRedondo" tamanho={44} traco={1.6} /></div>
            <h2 style={{ margin: 0, fontSize: 20 }}>E-mail verificado!</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)' }}>{msg}</p>
            <button
              onClick={() => navigate('/login')}
              style={{ background: 'var(--destaque)', color: 'var(--destaque-texto)', border: 'none', borderRadius: 999, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Fazer login
            </button>
          </>
        )}

        {status === 'erro' && (
          <>
            <div style={{ color: 'var(--saida)' }}><Icone nome="alerta" tamanho={44} traco={1.6} /></div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Link inválido ou expirado</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)' }}>{msg}</p>
            <button
              onClick={() => navigate('/login')}
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px', fontSize: 15, cursor: 'pointer' }}
            >
              Voltar ao login
            </button>
          </>
        )}
      </div>
    </div>
  );
}