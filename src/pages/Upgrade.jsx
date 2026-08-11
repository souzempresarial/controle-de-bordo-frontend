import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { fmt, fmtData, hoje } from '../services/utils';
import './Upgrade.css';

const STATUS_CFG = {
  'NO PRAZO': { cor: 'var(--entrada)',  bg: '#16a34a18' },
  'ALERTA':   { cor: '#f59e0b',         bg: '#f59e0b18' },
  'ATENÇÃO':  { cor: '#f97316',         bg: '#f9731618' },
  'URGENTE':  { cor: 'var(--saida)',    bg: '#f03e3e18' },
  'VENDIDO':  { cor: 'var(--text2)',    bg: 'var(--surface2)' },
};

const STATUS_ORDEM = { 'URGENTE': 4, 'ATENÇÃO': 3, 'ALERTA': 2, 'NO PRAZO': 1, 'VENDIDO': 0 };

const STATUS_CARD_CLASS = {
  'URGENTE':  'up-card-urgente',
  'ATENÇÃO':  'up-card-atencao',
  'ALERTA':   'up-card-alerta',
  'NO PRAZO': 'up-card-no-prazo',
  'VENDIDO':  'up-card-vendido',
};

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const formVazio = () => ({
  modelo: '', cor: '', armazenamento: '', bateria: '',
  observacoes: '', valor_avaliado: '', valor_pretendido: '',
  data_entrada: hoje(), imei: '',
});

const novoApVazio = () => ({
  modelo: '', cor: '', armazenamento: '', bateria: '',
  observacoes: '', valor_avaliado: '', valor_pretendido: '',
});

const venderVazio = (ap) => ({
  valor_venda:    ap?.valor_pretendido ? String(ap.valor_pretendido) : '',
  data:           hoje(),
  pagamento:      '',
  valor_recebido: '',
});

export default function Upgrade() {
  const { clienteAtivo, setLancamentos } = useApp();
  const [aparelhos, setAparelhos]             = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [erro, setErro]                       = useState('');
  const [busca, setBusca]                     = useState('');
  const [mostrarVendidos, setMostrarVendidos] = useState(false);
  const [toast, setToast]                     = useState(null);

  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(formVazio());
  const [formErro, setFormErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [venderModal, setVenderModal]       = useState(null);
  const [venderForm, setVenderForm]         = useState(venderVazio(null));
  const [venderErro, setVenderErro]         = useState('');
  const [venderSalvando, setVenderSalvando] = useState(false);
  const [comUpgrade, setComUpgrade]         = useState(false);
  const [novoApForm, setNovoApForm]         = useState(novoApVazio());

  const [confirmExcluir, setConfirmExcluir] = useState(null);

  useEffect(() => { if (clienteAtivo) carregar(); }, [clienteAtivo]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function carregar() {
    setLoading(true);
    try {
      const data = await API.listarAparelhos(clienteAtivo.id);
      setAparelhos(data);
    } catch { setErro('Erro ao carregar aparelhos'); }
    finally { setLoading(false); }
  }

  const filtrados = useMemo(() => {
    let lista = aparelhos;
    if (busca) {
      const b = busca.toLowerCase();
      lista = lista.filter(a =>
        (a.modelo||'').toLowerCase().includes(b) ||
        (a.cor||'').toLowerCase().includes(b) ||
        (a.email_aparelho||'').toLowerCase().includes(b)
      );
    }
    return [...lista].sort((a, b) => {
      const oa = STATUS_ORDEM[a.statusAuto] ?? 1;
      const ob = STATUS_ORDEM[b.statusAuto] ?? 1;
      if (oa !== ob) return ob - oa;
      return new Date(a.criado_em) - new Date(b.criado_em);
    });
  }, [aparelhos, busca]);

  const emEstoque = useMemo(() => filtrados.filter(a => a.status === 'estoque'), [filtrados]);
  const vendidos  = useMemo(() => filtrados.filter(a => a.status === 'vendido'),  [filtrados]);

  const resumo = useMemo(() => {
    const estoqueAll  = aparelhos.filter(a => a.status === 'estoque');
    const vendidosAll = aparelhos.filter(a => a.status === 'vendido' && a.vendido_em);
    let pme = null;
    if (vendidosAll.length > 0) {
      const total = vendidosAll.reduce((s, a) => s + Math.max(0, Math.floor((new Date(a.vendido_em) - new Date(a.criado_em)) / 86400000)), 0);
      pme = Math.round(total / vendidosAll.length);
    } else if (estoqueAll.length > 0) {
      const total = estoqueAll.reduce((s, a) => s + Math.max(0, Math.floor((Date.now() - new Date(a.criado_em)) / 86400000)), 0);
      pme = Math.round(total / estoqueAll.length);
    }
    return {
      total:     estoqueAll.length,
      alerta:    estoqueAll.filter(a => ['ALERTA','ATENÇÃO','URGENTE'].includes(a.statusAuto)).length,
      urgente:   estoqueAll.filter(a => a.statusAuto === 'URGENTE').length,
      vendidos:  vendidosAll.length,
      lucroProj: estoqueAll.reduce((s, a) =>
        a.valor_pretendido && a.valor_avaliado
          ? s + parseFloat(a.valor_pretendido) - parseFloat(a.valor_avaliado) : s, 0),
      pme,
    };
  }, [aparelhos]);

  function abrirNovo() { setModal('novo'); setForm(formVazio()); setFormErro(''); }

  function abrirEditar(ap) {
    setModal(ap);
    setForm({
      modelo:           ap.modelo || '',
      cor:              ap.cor || '',
      armazenamento:    ap.armazenamento || '',
      bateria:          ap.bateria != null ? String(ap.bateria) : '',
      observacoes:      ap.observacoes || '',
      valor_avaliado:   ap.valor_avaliado   != null ? String(ap.valor_avaliado)   : '',
      valor_pretendido: ap.valor_pretendido  != null ? String(ap.valor_pretendido) : '',
      data_entrada:     ap.criado_em ? ap.criado_em.slice(0, 10) : hoje(),
      imei:             ap.imei || '',
    });
    setFormErro('');
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.modelo) { setFormErro('Informe o modelo'); return; }
    setSalvando(true); setFormErro('');
    try {
      const dados = {
        modelo:           form.modelo,
        cor:              form.cor              || null,
        armazenamento:    form.armazenamento    || null,
        bateria:          form.bateria          ? parseInt(form.bateria)           : null,
        observacoes:      form.observacoes      || null,
        valor_avaliado:   form.valor_avaliado   ? parseFloat(form.valor_avaliado)  : null,
        valor_pretendido: form.valor_pretendido ? parseFloat(form.valor_pretendido): null,
        data_entrada:     form.data_entrada     || null,
        imei:             form.imei             || null,
      };
      if (modal === 'novo') {
        const novo = await API.criarAparelho(clienteAtivo.id, dados);
        setAparelhos(prev => [novo, ...prev]);
        setToast({ msg: 'Aparelho adicionado ao estoque', type: 'success' });
      } else {
        const upd = await API.editarAparelho(clienteAtivo.id, modal.id, dados);
        setAparelhos(prev => prev.map(a => a.id === modal.id ? upd : a));
        setToast({ msg: 'Aparelho atualizado', type: 'success' });
      }
      setModal(null);
    } catch (err) { setFormErro(err.message); }
    finally { setSalvando(false); }
  }

  async function excluir(id) {
    try {
      await API.excluirAparelho(clienteAtivo.id, id);
      setAparelhos(prev => prev.filter(a => a.id !== id));
      setConfirmExcluir(null);
      setToast({ msg: 'Aparelho excluído', type: 'success' });
    } catch (err) { setErro(err.message); }
  }

  function abrirVender(ap) {
    setVenderModal(ap);
    setVenderForm(venderVazio(ap));
    setVenderErro('');
    setComUpgrade(false);
    setNovoApForm(novoApVazio());
  }

  async function confirmarVenda(e) {
    e.preventDefault();
    if (!venderForm.valor_venda) { setVenderErro('Informe o valor de venda'); return; }
    if (comUpgrade && !novoApForm.modelo) { setVenderErro('Informe o modelo do aparelho recebido'); return; }
    if (comUpgrade && !venderForm.valor_recebido) { setVenderErro('Informe o valor recebido em dinheiro/Pix'); return; }
    if (comUpgrade && parseFloat(venderForm.valor_recebido) >= parseFloat(venderForm.valor_venda)) {
      setVenderErro('Valor recebido deve ser menor que o valor de venda'); return;
    }
    setVenderSalvando(true); setVenderErro('');
    try {
      const recebido   = comUpgrade && venderForm.valor_recebido ? parseFloat(venderForm.valor_recebido) : null;
      const upgradeVal = recebido != null ? parseFloat(venderForm.valor_venda) - recebido : null;
      const atualizado = await API.venderAparelho(clienteAtivo.id, venderModal.id, {
        valor_venda:    parseFloat(venderForm.valor_venda),
        data:           venderForm.data,
        pagamento:      venderForm.pagamento || null,
        valor_recebido: recebido,
      });
      let novosAparelhos = aparelhos.map(a => a.id === venderModal.id ? atualizado : a);
      if (comUpgrade) {
        const cmvAparelho = novoApForm.valor_avaliado ? parseFloat(novoApForm.valor_avaliado) : upgradeVal;
        const novo = await API.criarAparelho(clienteAtivo.id, {
          modelo:           novoApForm.modelo,
          cor:              novoApForm.cor           || null,
          armazenamento:    novoApForm.armazenamento || null,
          bateria:          novoApForm.bateria       ? parseInt(novoApForm.bateria)            : null,
          observacoes:      novoApForm.observacoes   || null,
          valor_avaliado:   cmvAparelho,
          valor_pretendido: novoApForm.valor_pretendido ? parseFloat(novoApForm.valor_pretendido) : null,
        });
        novosAparelhos = [novo, ...novosAparelhos];
      }
      setAparelhos(novosAparelhos);
      const novosLans = await API.listarLancamentos(clienteAtivo.id);
      setLancamentos(novosLans);
      setVenderModal(null);
      setToast({ msg: `Venda de ${venderModal.modelo} registrada com sucesso`, type: 'success' });
    } catch (err) { setVenderErro(err.message); }
    finally { setVenderSalvando(false); }
  }

  if (!clienteAtivo) return (
    <div className="up-page">
      <div className="empty-state"><div>Selecione um cliente para ver o Controle de Upgrade</div></div>
    </div>
  );

  const lucroVendaPreview = venderModal && venderForm.valor_venda && venderModal.valor_avaliado
    ? parseFloat(venderForm.valor_venda) - parseFloat(venderModal.valor_avaliado)
    : null;

  function renderCard(ap) {
    const cfg     = STATUS_CFG[ap.statusAuto] || STATUS_CFG['NO PRAZO'];
    const vendido = ap.status === 'vendido';
    const dias    = vendido && ap.vendido_em
      ? Math.max(0, Math.floor((new Date(ap.vendido_em) - new Date(ap.criado_em)) / 86400000))
      : Math.max(0, Math.floor((Date.now() - new Date(ap.criado_em)) / 86400000));
    const lucroProj = ap.valor_pretendido && ap.valor_avaliado
      ? parseFloat(ap.valor_pretendido) - parseFloat(ap.valor_avaliado) : null;
    const margem = lucroProj != null && ap.valor_pretendido
      ? (lucroProj / parseFloat(ap.valor_pretendido) * 100).toFixed(1) : null;
    const diasColor = vendido ? 'var(--text2)'
      : dias >= 15 ? 'var(--saida)'
      : dias >= 7  ? '#f59e0b'
      : 'var(--entrada)';
    const cardClass = STATUS_CARD_CLASS[ap.statusAuto] || 'up-card-no-prazo';
    const specs = [ap.armazenamento, ap.cor].filter(Boolean).join(' · ');

    return (
      <div key={ap.id} className={`up-card ${cardClass}`}>
        <div className="up-card-dias">
          <span className="up-card-dias-num" style={{ color: diasColor }}>{dias}</span>
          <span className="up-card-dias-suf">dias</span>
        </div>

        <div className="up-card-body">
          <div className="up-card-top">
            <div className="up-card-info">
              <div className="up-card-modelo">{ap.modelo}</div>
              {(specs || ap.bateria != null) && (
                <div className="up-card-specs">
                  {specs}
                  {ap.bateria != null && (
                    <span style={{ color: ap.bateria < 80 ? '#f59e0b' : 'inherit' }}>
                      {specs ? ' · ' : ''}Bat. {ap.bateria}%
                    </span>
                  )}
                </div>
              )}
              {ap.imei && <div className="up-card-obs">IMEI: {ap.imei}</div>}
              {ap.observacoes && <div className="up-card-obs">{ap.observacoes}</div>}
            </div>
            <div className="up-card-meta">
              <span className="up-status-pill" style={{ background: cfg.bg, color: cfg.cor }}>{ap.statusAuto}</span>
              <span className="up-card-entrada">
                {vendido && ap.vendido_em
                  ? `Vendido ${fmtData(ap.vendido_em.slice(0, 10))}`
                  : `Entrada ${fmtData(ap.criado_em.slice(0, 10))}`}
              </span>
            </div>
          </div>

          <div className="up-card-bottom">
            <div className="up-card-valores">
              {ap.valor_avaliado != null && (
                <span>CMV <strong style={{ color: 'var(--saida)' }}>{fmt(parseFloat(ap.valor_avaliado))}</strong></span>
              )}
              {ap.valor_pretendido != null && (
                <span>{vendido ? 'Vendido por' : 'Pretendido'} <strong>{fmt(parseFloat(ap.valor_pretendido))}</strong></span>
              )}
              {lucroProj != null && (
                <span>
                  {vendido ? 'Lucro' : 'Lucro proj.'}{' '}
                  <strong style={{ color: lucroProj >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                    {lucroProj >= 0 ? '+' : ''}{fmt(lucroProj)}{margem != null ? ` (${margem}%)` : ''}
                  </strong>
                </span>
              )}
            </div>
            <div className="up-card-acoes">
              {!vendido && (
                <button className="btn btn-primary btn-sm" onClick={() => abrirVender(ap)}>Vender</button>
              )}
              <button className="btn btn-ghost btn-sm up-icon-btn" onClick={() => abrirEditar(ap)} title="Editar">
                <IconEdit />
              </button>
              <button className="btn btn-ghost btn-sm up-icon-btn" style={{ color: 'var(--danger)' }} onClick={() => setConfirmExcluir(ap)} title="Excluir">
                <IconTrash />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="up-page">

      {/* Header */}
      <div className="up-header">
        <div>
          <h2>Controle de Upgrade</h2>
          <p className="up-subtitle">Gestão de aparelhos em estoque</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Aparelho</button>
      </div>

      {/* Alert banner */}
      {resumo.urgente > 0 && (
        <div className="up-alert">
          ⚠ {resumo.urgente} aparelho{resumo.urgente > 1 ? 's' : ''} {resumo.urgente > 1 ? 'estão' : 'está'} há mais de 15 dias em estoque
        </div>
      )}

      {/* Stats */}
      <div className="up-stats">
        <div className="up-stat">
          <span className="up-stat-num">{resumo.total}</span>
          <span className="up-stat-label">Em estoque</span>
        </div>
        <div className={`up-stat ${resumo.alerta > 0 ? 'up-stat-warn' : ''}`}>
          <span className="up-stat-num">{resumo.alerta}</span>
          <span className="up-stat-label">Em alerta</span>
        </div>
        <div className="up-stat">
          <span className="up-stat-num">{resumo.pme != null ? `${resumo.pme}d` : '—'}</span>
          <span className="up-stat-label">PME {resumo.vendidos > 0 ? '(vendidos)' : '(estoque)'}</span>
        </div>
        <div className="up-stat">
          <span className="up-stat-num up-stat-green">{fmt(resumo.lucroProj)}</span>
          <span className="up-stat-label">Lucro projetado</span>
        </div>
      </div>

      {/* Busca */}
      <input
        className="search-box"
        placeholder="🔍 Buscar modelo, cor..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        style={{ maxWidth: 320 }}
      />

      {/* Lista em estoque */}
      {loading ? (
        <div className="empty-state"><div>Carregando...</div></div>
      ) : emEstoque.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📱</div>
          <div>
            {aparelhos.filter(a => a.status === 'estoque').length === 0
              ? 'Nenhum aparelho em estoque. Clique em "+ Novo Aparelho" para começar.'
              : 'Nenhum aparelho encontrado.'}
          </div>
        </div>
      ) : (
        <div className="up-list">{emEstoque.map(renderCard)}</div>
      )}

      {/* Vendidos — escondidos por padrão */}
      {vendidos.length > 0 && (
        <>
          <button className="up-vendidos-btn" onClick={() => setMostrarVendidos(v => !v)}>
            {mostrarVendidos ? '▲' : '▼'} Vendidos ({vendidos.length})
          </button>
          {mostrarVendidos && <div className="up-list">{vendidos.map(renderCard)}</div>}
        </>
      )}

      {erro && <div style={{ color: 'var(--saida)', fontSize: 13 }}>{erro}</div>}

      {/* Toast */}
      {toast && (
        <div className={`up-toast ${toast.type === 'error' ? 'up-toast-error' : ''}`}>
          {toast.type !== 'error' && <span className="up-toast-icon">✓</span>}
          {toast.msg}
        </div>
      )}

      {/* Modal Novo / Editar */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{modal === 'novo' ? 'Novo Aparelho' : 'Editar Aparelho'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={salvar}>
              <div className="modal-body">

                <div className="up-form-section">
                  <div className="up-form-section-label">Identificação</div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Modelo *</label>
                      <input type="text" placeholder="ex: iPhone 13 Pro" value={form.modelo}
                        onChange={e => setForm(f => ({...f, modelo: e.target.value}))} autoFocus />
                    </div>
                    <div className="field">
                      <label>IMEI</label>
                      <input type="text" placeholder="ex: 353879234567890" value={form.imei}
                        onChange={e => setForm(f => ({...f, imei: e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Data de Entrada</label>
                      <input type="date" value={form.data_entrada}
                        onChange={e => setForm(f => ({...f, data_entrada: e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Armazenamento</label>
                      <select value={form.armazenamento} onChange={e => setForm(f => ({...f, armazenamento: e.target.value}))}>
                        <option value="">— selecione —</option>
                        {['64GB','128GB','256GB','512GB','1TB'].map(g => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Cor</label>
                      <input type="text" placeholder="ex: Meia-noite" value={form.cor}
                        onChange={e => setForm(f => ({...f, cor: e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Saúde da Bateria (%)</label>
                      <input type="number" min="0" max="100" placeholder="ex: 87" value={form.bateria}
                        onChange={e => setForm(f => ({...f, bateria: e.target.value}))} />
                    </div>
                    <div className="field span2">
                      <label>Observações (estado físico)</label>
                      <input type="text" placeholder="ex: Tela com marquinha, caixa original..." value={form.observacoes}
                        onChange={e => setForm(f => ({...f, observacoes: e.target.value}))} />
                    </div>
                  </div>
                </div>

                <div className="up-form-section">
                  <div className="up-form-section-label">Valores</div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Valor Avaliado / CMV (R$)</label>
                      <input type="number" step="0.01" placeholder="0,00" value={form.valor_avaliado}
                        onChange={e => setForm(f => ({...f, valor_avaliado: e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Valor de Venda Pretendido (R$)</label>
                      <input type="number" step="0.01" placeholder="0,00" value={form.valor_pretendido}
                        onChange={e => setForm(f => ({...f, valor_pretendido: e.target.value}))} />
                    </div>
                    {form.valor_avaliado && form.valor_pretendido && (
                      <div className="field span2">
                        <div className="up-preview-row">
                          <span>CMV <strong style={{ color: 'var(--saida)' }}>{fmt(parseFloat(form.valor_avaliado))}</strong></span>
                          <span className="up-preview-arrow">→</span>
                          <span>Venda <strong>{fmt(parseFloat(form.valor_pretendido))}</strong></span>
                          <span className="up-preview-arrow">=</span>
                          <span>Lucro <strong style={{ color: (parseFloat(form.valor_pretendido) - parseFloat(form.valor_avaliado)) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                            {fmt(parseFloat(form.valor_pretendido) - parseFloat(form.valor_avaliado))}
                          </strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {formErro && <div className="form-erro">{formErro}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vender */}
      {venderModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !venderSalvando && setVenderModal(null)}>
          <div className="modal-box modal-small" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div className="modal-header">
              <h3>Registrar Venda</h3>
              <button className="modal-close" onClick={() => !venderSalvando && setVenderModal(null)}>✕</button>
            </div>
            <form onSubmit={confirmarVenda} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>

                <div className="up-vender-info">
                  <div className="up-vender-nome">{venderModal.modelo}</div>
                  <div className="up-vender-specs">
                    {[venderModal.armazenamento, venderModal.cor].filter(Boolean).join(' · ')}
                    {venderModal.valor_avaliado && <span> · CMV: {fmt(parseFloat(venderModal.valor_avaliado))}</span>}
                  </div>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="field span2">
                    <label>Valor de Venda (R$) *</label>
                    <input type="number" step="0.01" placeholder="0,00" value={venderForm.valor_venda}
                      onChange={e => setVenderForm(f => ({...f, valor_venda: e.target.value}))} autoFocus />
                  </div>
                  {lucroVendaPreview != null && (
                    <div className="field span2">
                      <div className="up-preview-row">
                        <span>Lucro real <strong style={{ color: lucroVendaPreview >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(lucroVendaPreview)}</strong></span>
                        <span>Margem <strong>{parseFloat(venderForm.valor_venda) > 0 ? (lucroVendaPreview / parseFloat(venderForm.valor_venda) * 100).toFixed(1) + '%' : '—'}</strong></span>
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <label>Data da Venda</label>
                    <input type="date" value={venderForm.data} onChange={e => setVenderForm(f => ({...f, data: e.target.value}))} />
                  </div>
                  <div className="field">
                    <label>Forma de Pagamento</label>
                    <select value={venderForm.pagamento} onChange={e => setVenderForm(f => ({...f, pagamento: e.target.value}))}>
                      <option value="">—</option>
                      <option>Dinheiro</option><option>Pix</option><option>Crédito</option>
                      <option>Débito</option><option>Transferência</option><option>Outro</option>
                    </select>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={comUpgrade} onChange={e => setComUpgrade(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    Vendido com upgrade? (cliente entregou outro aparelho)
                  </label>
                </div>

                {comUpgrade && (
                  <>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field span2">
                        <label>Valor recebido em Pix / Dinheiro (R$) *</label>
                        <input
                          type="number" step="0.01" placeholder="0,00"
                          value={venderForm.valor_recebido}
                          onChange={e => {
                            const recebido = e.target.value;
                            setVenderForm(f => ({ ...f, valor_recebido: recebido }));
                            if (venderForm.valor_venda && recebido && !novoApForm.valor_avaliado) {
                              const upg = parseFloat(venderForm.valor_venda) - parseFloat(recebido);
                              if (upg > 0) setNovoApForm(f => ({ ...f, valor_avaliado: String(upg) }));
                            }
                          }}
                        />
                      </div>
                      {venderForm.valor_recebido && venderForm.valor_venda &&
                        parseFloat(venderForm.valor_recebido) > 0 &&
                        parseFloat(venderForm.valor_recebido) < parseFloat(venderForm.valor_venda) && (
                        <div className="field span2">
                          <div className="up-preview-row">
                            <span>Caixa (DFC) <strong style={{ color: 'var(--entrada)' }}>{fmt(parseFloat(venderForm.valor_recebido))}</strong></span>
                            <span>Aparelho recebido <strong>{fmt(parseFloat(venderForm.valor_venda) - parseFloat(venderForm.valor_recebido))}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="up-form-section">
                      <div className="up-form-section-label">Aparelho recebido no upgrade</div>
                      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="field span2">
                          <label>Modelo *</label>
                          <input type="text" placeholder="ex: iPhone 13 Pro" value={novoApForm.modelo}
                            onChange={e => setNovoApForm(f => ({...f, modelo: e.target.value}))} />
                        </div>
                        <div className="field">
                          <label>Cor</label>
                          <input type="text" placeholder="ex: Meia-noite" value={novoApForm.cor}
                            onChange={e => setNovoApForm(f => ({...f, cor: e.target.value}))} />
                        </div>
                        <div className="field">
                          <label>Armazenamento</label>
                          <select value={novoApForm.armazenamento} onChange={e => setNovoApForm(f => ({...f, armazenamento: e.target.value}))}>
                            <option value="">— selecione —</option>
                            {['64GB','128GB','256GB','512GB','1TB'].map(g => <option key={g}>{g}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Bateria (%)</label>
                          <input type="number" min="0" max="100" placeholder="ex: 87" value={novoApForm.bateria}
                            onChange={e => setNovoApForm(f => ({...f, bateria: e.target.value}))} />
                        </div>
                        <div className="field">
                          <label>Vlr. Avaliado / CMV (R$)</label>
                          <input type="number" step="0.01" placeholder="0,00" value={novoApForm.valor_avaliado}
                            onChange={e => setNovoApForm(f => ({...f, valor_avaliado: e.target.value}))} />
                        </div>
                        <div className="field span2">
                          <label>Vlr. Pretendido (R$)</label>
                          <input type="number" step="0.01" placeholder="0,00" value={novoApForm.valor_pretendido}
                            onChange={e => setNovoApForm(f => ({...f, valor_pretendido: e.target.value}))} />
                        </div>
                        <div className="field span2">
                          <label>Observações</label>
                          <input type="text" placeholder="ex: Tela com marquinha, caixa original..." value={novoApForm.observacoes}
                            onChange={e => setNovoApForm(f => ({...f, observacoes: e.target.value}))} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
                  {comUpgrade
                    ? 'DRE: faturamento pelo valor total da venda. DFC: apenas o valor recebido em dinheiro/Pix entra no caixa.'
                    : 'A venda será lançada automaticamente no financeiro como Receita de Vendas e o CMV como saída.'}
                </p>
                {venderErro && <div className="form-erro">{venderErro}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setVenderModal(null)} disabled={venderSalvando}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={venderSalvando}>
                  {venderSalvando ? 'Registrando...' : 'Confirmar Venda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {confirmExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluir(null)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Excluir Aparelho</h3>
              <button className="modal-close" onClick={() => setConfirmExcluir(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>
                Excluir <strong style={{ color: 'var(--text)' }}>{confirmExcluir.modelo}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => excluir(confirmExcluir.id)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
