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

const formVazio = () => ({
  modelo: '', cor: '', armazenamento: '', bateria: '',
  observacoes: '', valor_avaliado: '', valor_pretendido: '',
});

const novoApVazio = () => ({
  modelo: '', cor: '', armazenamento: '', bateria: '',
  observacoes: '', valor_avaliado: '', valor_pretendido: '',
});

const venderVazio = (ap) => ({
  valor_venda: ap?.valor_pretendido ? String(ap.valor_pretendido) : '',
  data: hoje(),
  pagamento: '',
});

export default function Upgrade() {
  const { clienteAtivo, setLancamentos } = useApp();
  const [aparelhos, setAparelhos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [erro, setErro]           = useState('');

  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroMes, setFiltroMes]       = useState('');
  const [busca, setBusca]               = useState('');

  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(formVazio());
  const [formErro, setFormErro]   = useState('');
  const [salvando, setSalvando]   = useState(false);

  const [venderModal, setVenderModal]       = useState(null);
  const [venderForm, setVenderForm]         = useState(venderVazio(null));
  const [venderErro, setVenderErro]         = useState('');
  const [venderSalvando, setVenderSalvando] = useState(false);
  const [comUpgrade, setComUpgrade]         = useState(false);
  const [novoApForm, setNovoApForm]         = useState(novoApVazio());

  const [confirmExcluir, setConfirmExcluir] = useState(null);

  useEffect(() => { if (clienteAtivo) carregar(); }, [clienteAtivo]);

  async function carregar() {
    setLoading(true);
    try {
      const data = await API.listarAparelhos(clienteAtivo.id);
      setAparelhos(data);
    } catch { setErro('Erro ao carregar aparelhos'); }
    finally { setLoading(false); }
  }

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(aparelhos.map(a => a.criado_em.slice(0, 7)));
    return [...set].sort().reverse();
  }, [aparelhos]);

  const filtrados = useMemo(() => {
    let lista = aparelhos;
    if (filtroStatus) lista = lista.filter(a => a.statusAuto === filtroStatus);
    if (filtroMes)   lista = lista.filter(a => a.criado_em.slice(0, 7) === filtroMes);
    if (busca) {
      const b = busca.toLowerCase();
      lista = lista.filter(a =>
        (a.modelo||'').toLowerCase().includes(b) ||
        (a.cor||'').toLowerCase().includes(b) ||
        (a.email_aparelho||'').toLowerCase().includes(b)
      );
    }
    return lista;
  }, [aparelhos, filtroStatus, filtroMes, busca]);

  const resumo = useMemo(() => {
    const emEstoque = aparelhos.filter(a => a.status === 'estoque');
    const vendidos  = aparelhos.filter(a => a.status === 'vendido' && a.vendido_em);
    let pme = null;
    if (vendidos.length > 0) {
      const totalDias = vendidos.reduce((s, a) => {
        const dias = Math.max(0, Math.floor((new Date(a.vendido_em) - new Date(a.criado_em)) / (1000 * 60 * 60 * 24)));
        return s + dias;
      }, 0);
      pme = Math.round(totalDias / vendidos.length);
    } else if (emEstoque.length > 0) {
      const totalDias = emEstoque.reduce((s, a) => {
        const dias = Math.max(0, Math.floor((Date.now() - new Date(a.criado_em)) / (1000 * 60 * 60 * 24)));
        return s + dias;
      }, 0);
      pme = Math.round(totalDias / emEstoque.length);
    }
    return {
      total:    emEstoque.length,
      noPrazo:  emEstoque.filter(a => a.statusAuto === 'NO PRAZO').length,
      atencao:  emEstoque.filter(a => ['ALERTA','ATENÇÃO','URGENTE'].includes(a.statusAuto)).length,
      vendidos: vendidos.length,
      lucroProj: emEstoque.reduce((s, a) =>
        a.valor_pretendido && a.valor_avaliado
          ? s + parseFloat(a.valor_pretendido) - parseFloat(a.valor_avaliado)
          : s, 0),
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
      valor_avaliado:   ap.valor_avaliado   != null ? String(ap.valor_avaliado)  : '',
      valor_pretendido: ap.valor_pretendido  != null ? String(ap.valor_pretendido) : '',
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
        bateria:          form.bateria          ? parseInt(form.bateria)          : null,
        observacoes:      form.observacoes      || null,
        valor_avaliado:   form.valor_avaliado   ? parseFloat(form.valor_avaliado)  : null,
        valor_pretendido: form.valor_pretendido ? parseFloat(form.valor_pretendido): null,
      };
      if (modal === 'novo') {
        const novo = await API.criarAparelho(clienteAtivo.id, dados);
        setAparelhos(prev => [novo, ...prev]);
      } else {
        const atualizado = await API.editarAparelho(clienteAtivo.id, modal.id, dados);
        setAparelhos(prev => prev.map(a => a.id === modal.id ? atualizado : a));
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
    setVenderSalvando(true); setVenderErro('');
    try {
      const atualizado = await API.venderAparelho(clienteAtivo.id, venderModal.id, {
        valor_venda: parseFloat(venderForm.valor_venda),
        data:        venderForm.data,
        pagamento:   venderForm.pagamento || null,
      });
      let novosAparelhos = aparelhos.map(a => a.id === venderModal.id ? atualizado : a);
      if (comUpgrade) {
        const novo = await API.criarAparelho(clienteAtivo.id, {
          modelo:           novoApForm.modelo,
          cor:              novoApForm.cor              || null,
          armazenamento:    novoApForm.armazenamento    || null,
          bateria:          novoApForm.bateria          ? parseInt(novoApForm.bateria)          : null,
          observacoes:      novoApForm.observacoes      || null,
          valor_avaliado:   novoApForm.valor_avaliado   ? parseFloat(novoApForm.valor_avaliado)  : null,
          valor_pretendido: novoApForm.valor_pretendido ? parseFloat(novoApForm.valor_pretendido): null,
        });
        novosAparelhos = [novo, ...novosAparelhos];
      }
      setAparelhos(novosAparelhos);
      const novosLans = await API.listarLancamentos(clienteAtivo.id);
      setLancamentos(novosLans);
      setVenderModal(null);
    } catch (err) { setVenderErro(err.message); }
    finally { setVenderSalvando(false); }
  }

  if (!clienteAtivo) return (
    <div className="upgrade-page">
      <div className="empty-state"><div>Selecione um cliente para ver o Controle de Upgrade</div></div>
    </div>
  );

  const lucroVendaPreview = venderModal && venderForm.valor_venda && venderModal.valor_avaliado
    ? parseFloat(venderForm.valor_venda) - parseFloat(venderModal.valor_avaliado)
    : null;

  return (
    <div className="upgrade-page">
      <div className="upgrade-header">
        <div>
          <h2>Controle de Upgrade</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>Gestão de aparelhos em estoque</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Aparelho</button>
      </div>

      {/* Cards de resumo */}
      <div className="upgrade-cards">
        <div className="upgrade-card">
          <div className="upgrade-card-label">Em estoque</div>
          <div className="upgrade-card-valor">{resumo.total}</div>
        </div>
        <div className="upgrade-card">
          <div className="upgrade-card-label">No prazo</div>
          <div className="upgrade-card-valor" style={{ color: 'var(--entrada)' }}>{resumo.noPrazo}</div>
        </div>
        <div className="upgrade-card">
          <div className="upgrade-card-label">Alerta / Urgente</div>
          <div className="upgrade-card-valor" style={{ color: resumo.atencao > 0 ? '#f97316' : 'var(--text)' }}>{resumo.atencao}</div>
        </div>
        <div className="upgrade-card">
          <div className="upgrade-card-label">Vendidos</div>
          <div className="upgrade-card-valor">{resumo.vendidos}</div>
        </div>
        <div className="upgrade-card">
          <div className="upgrade-card-label">Lucro projetado</div>
          <div className="upgrade-card-valor" style={{ color: 'var(--entrada)', fontSize: 18 }}>{fmt(resumo.lucroProj)}</div>
        </div>
        <div className="upgrade-card">
          <div className="upgrade-card-label">PME</div>
          <div className="upgrade-card-valor" style={{ color: resumo.pme != null && resumo.pme > 10 ? '#f97316' : 'var(--text)' }}>
            {resumo.pme != null ? `${resumo.pme}d` : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
            {resumo.vendidos > 0 ? 'média dos vendidos' : 'média em estoque'}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="upgrade-filtros">
        <input className="search-box" placeholder="🔍 Buscar modelo, cor..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select className="filter-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos os meses</option>
          {mesesDisponiveis.map(m => {
            const [ano, mes] = m.split('-');
            const label = new Date(parseInt(ano), parseInt(mes) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
          })}
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="empty-state"><div>Carregando...</div></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📱</div>
          <div>{aparelhos.length === 0 ? 'Nenhum aparelho cadastrado. Clique em "+ Novo Aparelho" para começar.' : 'Nenhum aparelho encontrado com os filtros atuais.'}</div>
        </div>
      ) : (
        <div className="table-panel" style={{ marginTop: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Cor</th>
                  <th>GB</th>
                  <th>Bateria</th>
                  <th>Vlr. Avaliado</th>
                  <th>Vlr. Pretendido</th>
                  <th>Lucro Proj.</th>
                  <th>Entrada</th>
                  <th>Dias</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(ap => {
                  const cfg = STATUS_CFG[ap.statusAuto] || STATUS_CFG['NO PRAZO'];
                  const dias = Math.max(0, Math.floor((Date.now() - new Date(ap.criado_em)) / (1000 * 60 * 60 * 24)));
                  const lucroProj = ap.valor_pretendido && ap.valor_avaliado
                    ? parseFloat(ap.valor_pretendido) - parseFloat(ap.valor_avaliado)
                    : null;
                  return (
                    <tr key={ap.id}>
                      <td style={{ fontWeight: 600 }}>
                        {ap.modelo}
                        {ap.observacoes && (
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', fontWeight: 400 }}>{ap.observacoes}</span>
                        )}
                      </td>
                      <td>{ap.cor || '—'}</td>
                      <td>{ap.armazenamento || '—'}</td>
                      <td>
                        {ap.bateria != null
                          ? <span style={{ color: ap.bateria < 80 ? '#f59e0b' : 'var(--text)' }}>{ap.bateria}%</span>
                          : '—'}
                      </td>
                      <td style={{ color: 'var(--saida)' }}>{ap.valor_avaliado != null ? fmt(ap.valor_avaliado) : '—'}</td>
                      <td>{ap.valor_pretendido != null ? fmt(ap.valor_pretendido) : '—'}</td>
                      <td style={{ color: lucroProj != null ? (lucroProj >= 0 ? 'var(--entrada)' : 'var(--saida)') : 'var(--text2)', fontWeight: lucroProj != null ? 700 : 400 }}>
                        {lucroProj != null ? fmt(lucroProj) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmtData(ap.criado_em.slice(0,10))}</td>
                      <td style={{ color: dias >= 15 ? 'var(--saida)' : dias >= 7 ? '#f59e0b' : 'var(--text2)', fontWeight: dias >= 7 && ap.status !== 'vendido' ? 700 : 400 }}>
                        {ap.status === 'vendido' ? '—' : `${dias}d`}
                      </td>
                      <td>
                        <span style={{ background: cfg.bg, color: cfg.cor, borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {ap.statusAuto}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {ap.status === 'estoque' && (
                            <button className="btn btn-primary btn-sm" onClick={() => abrirVender(ap)} style={{ fontSize: 12 }}>
                              Vender
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(ap)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmExcluir(ap)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {erro && <div style={{ color: 'var(--saida)', fontSize: 13 }}>{erro}</div>}

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
                <div className="form-grid">
                  <div className="field span2">
                    <label>Modelo *</label>
                    <input type="text" placeholder="ex: iPhone 13 Pro" value={form.modelo} onChange={e => setForm(f => ({...f, modelo: e.target.value}))} autoFocus />
                  </div>
                  <div className="field">
                    <label>Cor</label>
                    <input type="text" placeholder="ex: Meia-noite" value={form.cor} onChange={e => setForm(f => ({...f, cor: e.target.value}))} />
                  </div>
                  <div className="field">
                    <label>Armazenamento</label>
                    <select value={form.armazenamento} onChange={e => setForm(f => ({...f, armazenamento: e.target.value}))}>
                      <option value="">— selecione —</option>
                      {['64GB','128GB','256GB','512GB','1TB'].map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Saúde da Bateria (%)</label>
                    <input type="number" min="0" max="100" placeholder="ex: 87" value={form.bateria} onChange={e => setForm(f => ({...f, bateria: e.target.value}))} />
                  </div>
                  <div className="field">
                    <label>Valor Avaliado / CMV (R$)</label>
                    <input type="number" step="0.01" placeholder="0,00" value={form.valor_avaliado} onChange={e => setForm(f => ({...f, valor_avaliado: e.target.value}))} />
                  </div>
                  <div className="field">
                    <label>Valor de Venda Pretendido (R$)</label>
                    <input type="number" step="0.01" placeholder="0,00" value={form.valor_pretendido} onChange={e => setForm(f => ({...f, valor_pretendido: e.target.value}))} />
                  </div>
                  {form.valor_avaliado && form.valor_pretendido && (
                    <div className="field span2">
                      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 20, fontSize: 13 }}>
                        <span>CMV: <strong style={{ color: 'var(--saida)' }}>{fmt(parseFloat(form.valor_avaliado))}</strong></span>
                        <span>Venda: <strong>{fmt(parseFloat(form.valor_pretendido))}</strong></span>
                        <span>Lucro proj.: <strong style={{ color: (parseFloat(form.valor_pretendido) - parseFloat(form.valor_avaliado)) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                          {fmt(parseFloat(form.valor_pretendido) - parseFloat(form.valor_avaliado))}
                        </strong></span>
                      </div>
                    </div>
                  )}
                  <div className="field span2">
                    <label>Observações (estado físico)</label>
                    <input type="text" placeholder="ex: Tela com marquinha, caixa original..." value={form.observacoes} onChange={e => setForm(f => ({...f, observacoes: e.target.value}))} />
                  </div>
                </div>
                {formErro && <div className="form-erro">{formErro}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
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
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  <strong>{venderModal.modelo}</strong>
                  {venderModal.armazenamento && ` · ${venderModal.armazenamento}`}
                  {venderModal.cor && ` · ${venderModal.cor}`}
                  {venderModal.valor_avaliado && <span style={{ color: 'var(--text2)' }}> · CMV: {fmt(venderModal.valor_avaliado)}</span>}
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="field span2">
                    <label>Valor de Venda (R$) *</label>
                    <input type="number" step="0.01" placeholder="0,00" value={venderForm.valor_venda}
                      onChange={e => setVenderForm(f => ({...f, valor_venda: e.target.value}))} autoFocus />
                  </div>
                  {lucroVendaPreview != null && (
                    <div className="field span2">
                      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, display: 'flex', gap: 20 }}>
                        <span>Lucro real: <strong style={{ color: lucroVendaPreview >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(lucroVendaPreview)}</strong></span>
                        <span>Margem: <strong>{parseFloat(venderForm.valor_venda) > 0 ? (lucroVendaPreview / parseFloat(venderForm.valor_venda) * 100).toFixed(1) + '%' : '—'}</strong></span>
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
                    <input type="checkbox" checked={comUpgrade} onChange={e => setComUpgrade(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    Vendido com upgrade? (cliente entregou outro aparelho)
                  </label>
                </div>

                {comUpgrade && (
                  <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Aparelho recebido no upgrade
                    </div>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field span2">
                        <label>Modelo *</label>
                        <input type="text" placeholder="ex: iPhone 13 Pro" value={novoApForm.modelo} onChange={e => setNovoApForm(f => ({...f, modelo: e.target.value}))} />
                      </div>
                      <div className="field">
                        <label>Cor</label>
                        <input type="text" placeholder="ex: Meia-noite" value={novoApForm.cor} onChange={e => setNovoApForm(f => ({...f, cor: e.target.value}))} />
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
                        <input type="number" min="0" max="100" placeholder="ex: 87" value={novoApForm.bateria} onChange={e => setNovoApForm(f => ({...f, bateria: e.target.value}))} />
                      </div>
                      <div className="field">
                        <label>Vlr. Avaliado / CMV (R$)</label>
                        <input type="number" step="0.01" placeholder="0,00" value={novoApForm.valor_avaliado} onChange={e => setNovoApForm(f => ({...f, valor_avaliado: e.target.value}))} />
                      </div>
                      <div className="field span2">
                        <label>Vlr. Pretendido (R$)</label>
                        <input type="number" step="0.01" placeholder="0,00" value={novoApForm.valor_pretendido} onChange={e => setNovoApForm(f => ({...f, valor_pretendido: e.target.value}))} />
                      </div>
                      <div className="field span2">
                        <label>Observações</label>
                        <input type="text" placeholder="ex: Tela com marquinha, caixa original..." value={novoApForm.observacoes} onChange={e => setNovoApForm(f => ({...f, observacoes: e.target.value}))} />
                      </div>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
                  A venda será lançada automaticamente no financeiro como Receita de Vendas e o CMV como saída.
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