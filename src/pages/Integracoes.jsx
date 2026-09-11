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

  const [chaves, setChaves]             = useState([]);
  const [carregando, setCarregando]     = useState(false);
  const [adicionando, setAdicionando]   = useState(false);
  const [novoNome, setNovoNome]         = useState('');
  const [novaChave, setNovaChave]       = useState('');
  const [salvando, setSalvando]         = useState(false);
  const [removendoId, setRemovendoId]   = useState(null);
  const [confirmRemover, setConfirmRemover] = useState(null);
  const [msg, setMsg]                   = useState('');
  const [erro, setErro]                 = useState('');

  useEffect(() => {
    if (!clienteAtivo) return;
    carregarChaves();
  }, [clienteAtivo?.id]);

  async function carregarChaves() {
    setCarregando(true);
    try {
      const data = await API.mpListarChaves(clienteAtivo.id);
      setChaves(data);
    } catch {
      setChaves([]);
    } finally {
      setCarregando(false);
    }
  }

  async function adicionar(e) {
    e.preventDefault();
    if (!novaChave.trim()) return;
    setSalvando(true); setMsg(''); setErro('');
    try {
      await API.mpAdicionarChave(clienteAtivo.id, novoNome.trim() || 'Principal', novaChave.trim());
      setMsg('Chave adicionada com sucesso!');
      setAdicionando(false);
      setNovoNome('');
      setNovaChave('');
      await carregarChaves();
    } catch (err) {
      setErro(err.message || 'Erro ao adicionar chave');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id) {
    setRemovendoId(id); setMsg(''); setErro('');
    try {
      await API.mpRemoverChave(clienteAtivo.id, id);
      setMsg('Chave removida.');
      setConfirmRemover(null);
      await carregarChaves();
    } catch (err) {
      setErro(err.message || 'Erro ao remover');
    } finally {
      setRemovendoId(null);
    }
  }

  if (!clienteAtivo) {
    return (
      <div style={{ padding: 32, color: 'var(--text2)', fontSize: 14 }}>
        Selecione um cliente para gerenciar integrações.
      </div>
    );
  }

  const ativas = chaves.filter(c => c.ativa);

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
              {carregando && <span style={badgeStyle('var(--text2)')}>Verificando...</span>}
              {!carregando && ativas.length > 0 && (
                <span style={badgeStyle('var(--entrada)')}>● {ativas.length} chave{ativas.length > 1 ? 's' : ''} ativa{ativas.length > 1 ? 's' : ''}</span>
              )}
              {!carregando && ativas.length === 0 && (
                <span style={badgeStyle('var(--text2)')}>Não conectado</span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)', lineHeight: 1.4 }}>
              Sincroniza automaticamente as vendas do Mercado Phone com os lançamentos da loja.
              Suporta múltiplas chaves — uma por unidade ou conta.
            </p>
          </div>
        </div>

        {/* Mensagens */}
        {msg  && <div style={msgStyle('var(--entrada)')}>{msg}</div>}
        {erro && <div style={msgStyle('var(--saida)')}>{erro}</div>}

        {/* Lista de chaves */}
        {chaves.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chaves.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--surface2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace', marginTop: 2 }}>
                    {c.api_key_masked}
                  </div>
                </div>
                {confirmRemover === c.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Confirmar?</span>
                    <button
                      style={btnDangerStyle}
                      onClick={() => remover(c.id)}
                      disabled={removendoId === c.id}
                    >
                      {removendoId === c.id ? '...' : 'Sim, remover'}
                    </button>
                    <button style={btnSecStyle} onClick={() => setConfirmRemover(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    style={{ ...btnSecStyle, fontSize: 12, padding: '5px 10px' }}
                    onClick={() => { setConfirmRemover(c.id); setMsg(''); setErro(''); }}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Form adicionar nova chave */}
        {adicionando ? (
          <form onSubmit={adicionar} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Nome da unidade (ex: Loja Centro)"
                style={{ ...inputStyle, flex: '0 0 200px' }}
                autoComplete="off"
              />
              <input
                type="password"
                value={novaChave}
                onChange={e => setNovaChave(e.target.value)}
                placeholder="Chave de API (sk-...)"
                style={{ ...inputStyle, flex: 1 }}
                autoComplete="off"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btnPrimStyle} disabled={salvando || !novaChave.trim()}>
                {salvando ? 'Salvando...' : 'Adicionar'}
              </button>
              <button type="button" style={btnSecStyle} onClick={() => { setAdicionando(false); setNovoNome(''); setNovaChave(''); setErro(''); }}>
                Cancelar
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text2)' }}>
              Encontre a chave em Mercado Phone → Configurações → API.
            </p>
          </form>
        ) : (
          <button
            style={{ ...btnSecStyle, marginTop: 16 }}
            onClick={() => { setAdicionando(true); setMsg(''); setErro(''); }}
          >
            + Adicionar chave
          </button>
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
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--saida)',
  background: 'transparent',
  color: 'var(--saida)',
  fontSize: 12,
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
