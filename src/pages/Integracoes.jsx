import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';

const INTEGRACOES_FUTURAS = [
  { id: 'bling',        nome: 'Bling',          descricao: 'ERP e emissão de NF-e',              logo: '🟦', em_breve: true },
  { id: 'nfe',          nome: 'NF-e',            descricao: 'Emissão de nota fiscal eletrônica',  logo: '🧾', em_breve: true },
  { id: 'open_finance', nome: 'Open Finance',    descricao: 'Conexão direta com bancos',          logo: '🏦', em_breve: true },
];

export default function Integracoes() {
  const { clienteAtivo } = useApp();

  const [mpConfigurado, setMpConfigurado]   = useState(null);
  const [mpChaveInput, setMpChaveInput]     = useState('');
  const [mpEditando, setMpEditando]         = useState(false);
  const [mpSalvando, setMpSalvando]         = useState(false);
  const [mpRemovendo, setMpRemovendo]       = useState(false);
  const [mpMsg, setMpMsg]                   = useState('');
  const [mpErro, setMpErro]                 = useState('');
  const [confirmarRemover, setConfirmarRemover] = useState(false);

  useEffect(() => {
    if (!clienteAtivo) return;
    setMpMsg(''); setMpErro('');
    API.mpStatus(clienteAtivo.id)
      .then(({ configurado }) => setMpConfigurado(configurado))
      .catch(() => setMpConfigurado(false));
  }, [clienteAtivo?.id]);

  async function salvarChave(e) {
    e.preventDefault();
    if (!mpChaveInput.trim()) return;
    setMpSalvando(true); setMpMsg(''); setMpErro('');
    try {
      await API.mpSalvarChave(clienteAtivo.id, mpChaveInput.trim());
      setMpConfigurado(true);
      setMpEditando(false);
      setMpChaveInput('');
      setMpMsg('Integração ativada com sucesso!');
    } catch (err) {
      setMpErro(err.message || 'Erro ao salvar chave');
    } finally {
      setMpSalvando(false);
    }
  }

  async function removerIntegracao() {
    setMpRemovendo(true); setMpMsg(''); setMpErro('');
    try {
      await API.mpRemoverChave(clienteAtivo.id);
      setMpConfigurado(false);
      setConfirmarRemover(false);
      setMpMsg('Integração removida.');
    } catch (err) {
      setMpErro(err.message || 'Erro ao remover integração');
    } finally {
      setMpRemovendo(false);
    }
  }

  if (!clienteAtivo) {
    return (
      <div style={{ padding: 32, color: 'var(--text2)', fontSize: 14 }}>
        Selecione um cliente para gerenciar integrações.
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: 720 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>Integrações</h2>
      <p style={{ margin: '0 0 28px', color: 'var(--text2)', fontSize: 13 }}>
        Conecte a Souz Finance às plataformas que você já usa na loja.
      </p>

      {/* ── Mercado Phone ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={logoBox}>
            <img src="/mp-logo.png" alt="Mercado Phone"
              style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8 }}
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
            />
            <span style={{ display: 'none', fontSize: 28 }}>📱</span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Mercado Phone</span>
              {mpConfigurado === null && (
                <span style={badgeStyle('var(--text2)')}>Verificando...</span>
              )}
              {mpConfigurado === true && (
                <span style={badgeStyle('var(--entrada)')}>● Ativo</span>
              )}
              {mpConfigurado === false && (
                <span style={badgeStyle('var(--text2)')}>Não conectado</span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)', lineHeight: 1.4 }}>
              Sincroniza automaticamente as vendas do Mercado Phone com os lançamentos da loja.
              As vendas aparecem como pendentes na aba Lançamentos para você confirmar.
            </p>
          </div>
        </div>

        {/* Mensagens */}
        {mpMsg  && <div style={msgStyle('var(--entrada)')}>{mpMsg}</div>}
        {mpErro && <div style={msgStyle('var(--saida)')}>{mpErro}</div>}

        {/* Ações quando configurado */}
        {mpConfigurado === true && !mpEditando && !confirmarRemover && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button style={btnSecStyle} onClick={() => { setMpEditando(true); setMpMsg(''); setMpErro(''); }}>
              Trocar chave de API
            </button>
            <button style={btnDangerStyle} onClick={() => { setConfirmarRemover(true); setMpMsg(''); setMpErro(''); }}>
              Remover integração
            </button>
          </div>
        )}

        {/* Confirmar remoção */}
        {confirmarRemover && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text)' }}>
              Tem certeza? As vendas futuras do Mercado Phone não serão mais sincronizadas.
              Os lançamentos já importados permanecem intactos.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnDangerStyle} onClick={removerIntegracao} disabled={mpRemovendo}>
                {mpRemovendo ? 'Removendo...' : 'Confirmar remoção'}
              </button>
              <button style={btnSecStyle} onClick={() => setConfirmarRemover(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Form: nova chave (configurado = false OU editando) */}
        {(mpConfigurado === false || mpEditando) && !confirmarRemover && (
          <form onSubmit={salvarChave} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, color: 'var(--text2)' }}>
              Cole aqui a chave de API do Mercado Phone:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={mpChaveInput}
                onChange={e => setMpChaveInput(e.target.value)}
                placeholder="sk-..."
                style={inputStyle}
                autoComplete="off"
                required
              />
              <button type="submit" style={btnPrimStyle} disabled={mpSalvando || !mpChaveInput.trim()}>
                {mpSalvando ? 'Salvando...' : 'Conectar'}
              </button>
              {mpEditando && (
                <button type="button" style={btnSecStyle} onClick={() => { setMpEditando(false); setMpChaveInput(''); }}>
                  Cancelar
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text2)' }}>
              Encontre a chave em Mercado Phone → Configurações → API.
            </p>
          </form>
        )}
      </div>

      {/* ── Integrações futuras ── */}
      <h3 style={{ margin: '32px 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Em breve
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {INTEGRACOES_FUTURAS.map(int => (
          <div key={int.id} style={{ ...cardStyle, opacity: 0.6, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ ...logoBox, fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {int.logo}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{int.nome}</span>
                  <span style={badgeStyle('var(--text2)')}>Em breve</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text2)' }}>{int.descricao}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '20px 20px',
  marginBottom: 0,
};

const logoBox = {
  width: 52,
  height: 52,
  background: 'var(--surface2)',
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const inputStyle = {
  flex: 1,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'monospace',
};

const btnPrimStyle = {
  padding: '9px 18px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnSecStyle = {
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnDangerStyle = {
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid var(--saida)',
  background: 'transparent',
  color: 'var(--saida)',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function badgeStyle(color) {
  return {
    fontSize: 11,
    fontWeight: 600,
    color,
    background: `${color}18`,
    borderRadius: 20,
    padding: '2px 8px',
    border: `1px solid ${color}40`,
  };
}

function msgStyle(color) {
  return {
    marginTop: 12,
    padding: '10px 14px',
    borderRadius: 8,
    background: `${color}15`,
    color,
    fontSize: 13,
    border: `1px solid ${color}40`,
  };
}
