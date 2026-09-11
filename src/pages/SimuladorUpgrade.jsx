import { useState, useEffect } from 'react';
import { fmt } from '../services/utils';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';

const MODELOS_DEF = [
  // iPhone 11
  { modelo: 'iPhone 11 64GB seminovo',           preco: 1099,  cmv: 900   },
  { modelo: 'iPhone 11 128GB seminovo',          preco: 1299,  cmv: 1080  },
  // iPhone 12
  { modelo: 'iPhone 12 64GB seminovo',           preco: 1599,  cmv: 1380  },
  { modelo: 'iPhone 12 128GB seminovo',          preco: 1799,  cmv: 1580  },
  { modelo: 'iPhone 12 Pro Max 128GB seminovo',  preco: 2299,  cmv: 2080  },
  { modelo: 'iPhone 12 Pro Max 256GB seminovo',  preco: 2499,  cmv: 2280  },
  // iPhone 13
  { modelo: 'iPhone 13 128GB seminovo',          preco: 2299,  cmv: 2080  },
  { modelo: 'iPhone 13 256GB seminovo',          preco: 2499,  cmv: 2280  },
  { modelo: 'iPhone 13 Pro 256GB seminovo',      preco: 2899,  cmv: 2680  },
  { modelo: 'iPhone 13 Pro Max 256GB seminovo',  preco: 3199,  cmv: 2980  },
  // iPhone 14
  { modelo: 'iPhone 14 128GB seminovo',          preco: 2899,  cmv: 2680  },
  { modelo: 'iPhone 14 Plus 128GB seminovo',     preco: 3199,  cmv: 2980  },
  { modelo: 'iPhone 14 Pro 256GB seminovo',      preco: 3499,  cmv: 3280  },
  { modelo: 'iPhone 14 Pro Max 128GB seminovo',  preco: 3799,  cmv: 3570  },
  { modelo: 'iPhone 14 Pro Max 256GB seminovo',  preco: 4099,  cmv: 3860  },
  // iPhone 15
  { modelo: 'iPhone 15 128GB lacrado',           preco: 4599,  cmv: 4390  },
  { modelo: 'iPhone 15 128GB seminovo',          preco: 3299,  cmv: 3080  },
  { modelo: 'iPhone 15 Plus 256GB seminovo',     preco: 3799,  cmv: 3580  },
  { modelo: 'iPhone 15 Pro 256GB seminovo',      preco: 4599,  cmv: 4380  },
  { modelo: 'iPhone 15 Pro Max 256GB seminovo',  preco: 5199,  cmv: 4980  },
  // iPhone 16
  { modelo: 'iPhone 16 128GB lacrado',           preco: 5499,  cmv: 5280  },
  { modelo: 'iPhone 16 128GB seminovo',          preco: 4199,  cmv: 3980  },
  { modelo: 'iPhone 16 Plus 256GB lacrado',      preco: 6299,  cmv: 6050  },
  { modelo: 'iPhone 16 Pro 256GB lacrado',       preco: 7499,  cmv: 7250  },
  { modelo: 'iPhone 16 Pro 256GB seminovo',      preco: 5599,  cmv: 5380  },
  { modelo: 'iPhone 16 Pro Max 256GB lacrado',   preco: 8499,  cmv: 8200  },
  { modelo: 'iPhone 16 Pro Max 256GB seminovo',  preco: 5890,  cmv: 5690  },
  // iPhone 17
  { modelo: 'iPhone 17 256GB lacrado',           preco: 6499,  cmv: 6250  },
  { modelo: 'iPhone 17 Plus 256GB lacrado',      preco: 7499,  cmv: 7200  },
  { modelo: 'iPhone 17 Pro 256GB lacrado',       preco: 7999,  cmv: 7750  },
  { modelo: 'iPhone 17 Pro 512GB lacrado',       preco: 9499,  cmv: 9200  },
  { modelo: 'iPhone 17 Pro Max 256GB lacrado',   preco: 8999,  cmv: 8700  },
  { modelo: 'iPhone 17 Pro Max 512GB lacrado',   preco: 10999, cmv: 10650 },
  { modelo: 'iPhone 17 Pro Max 1TB lacrado',     preco: 12999, cmv: 12600 },
];

const TRADEIN_DEF = [
  // iPhone 11
  { modelo: 'iPhone 11 64GB seminovo',           valor: 700   },
  { modelo: 'iPhone 11 128GB seminovo',          valor: 850   },
  // iPhone 12
  { modelo: 'iPhone 12 64GB seminovo',           valor: 1100  },
  { modelo: 'iPhone 12 128GB seminovo',          valor: 1300  },
  { modelo: 'iPhone 12 Pro Max 128GB seminovo',  valor: 1600  },
  { modelo: 'iPhone 12 Pro Max 256GB seminovo',  valor: 1800  },
  // iPhone 13
  { modelo: 'iPhone 13 128GB seminovo',          valor: 1700  },
  { modelo: 'iPhone 13 256GB seminovo',          valor: 1900  },
  { modelo: 'iPhone 13 Pro 256GB seminovo',      valor: 2200  },
  { modelo: 'iPhone 13 Pro Max 256GB seminovo',  valor: 2500  },
  // iPhone 14
  { modelo: 'iPhone 14 128GB seminovo',          valor: 2200  },
  { modelo: 'iPhone 14 Plus 128GB seminovo',     valor: 2500  },
  { modelo: 'iPhone 14 Pro 256GB seminovo',      valor: 2800  },
  { modelo: 'iPhone 14 Pro Max 128GB seminovo',  valor: 3000  },
  { modelo: 'iPhone 14 Pro Max 256GB seminovo',  valor: 3300  },
  // iPhone 15
  { modelo: 'iPhone 15 128GB lacrado',           valor: 3800  },
  { modelo: 'iPhone 15 128GB seminovo',          valor: 2700  },
  { modelo: 'iPhone 15 Plus 256GB seminovo',     valor: 3000  },
  { modelo: 'iPhone 15 Pro 256GB seminovo',      valor: 3600  },
  { modelo: 'iPhone 15 Pro Max 256GB seminovo',  valor: 4200  },
  // iPhone 16
  { modelo: 'iPhone 16 128GB lacrado',           valor: 4500  },
  { modelo: 'iPhone 16 128GB seminovo',          valor: 3500  },
  { modelo: 'iPhone 16 Plus 256GB lacrado',      valor: 5200  },
  { modelo: 'iPhone 16 Pro 256GB lacrado',       valor: 6200  },
  { modelo: 'iPhone 16 Pro 256GB seminovo',      valor: 4600  },
  { modelo: 'iPhone 16 Pro Max 256GB lacrado',   valor: 7000  },
  { modelo: 'iPhone 16 Pro Max 256GB seminovo',  valor: 4900  },
  // iPhone 17
  { modelo: 'iPhone 17 256GB lacrado',           valor: 5500  },
  { modelo: 'iPhone 17 Plus 256GB lacrado',      valor: 6200  },
  { modelo: 'iPhone 17 Pro 256GB lacrado',       valor: 6800  },
  { modelo: 'iPhone 17 Pro 512GB lacrado',       valor: 8000  },
  { modelo: 'iPhone 17 Pro Max 256GB lacrado',   valor: 7500  },
  { modelo: 'iPhone 17 Pro Max 512GB lacrado',   valor: 9200  },
  { modelo: 'iPhone 17 Pro Max 1TB lacrado',     valor: 10800 },
];

const AVARIAS_DEF = { bateria: 120, tela: 250, traseira: 150 };
const CFG_DEF     = { comissaoFixa: 20, taxaVariavel: 10, margemMinima: 500 };
const GRADES_DEF  = [
  { id: 'A', nome: 'Grade A', descricao: 'Perfeito — sem riscos, bateria >85%, peças originais', pct: 100 },
  { id: 'B', nome: 'Grade B', descricao: 'Bom — riscos leves, bateria 75–85%, sem danos graves', pct: 80  },
  { id: 'C', nome: 'Grade C', descricao: 'Regular — riscos visíveis, bateria <75% ou danos',    pct: 60  },
];

const TAXAS = [
  { label: 'Débito (1.5%)',          pct: 1.5  },
  { label: 'Crédito 1x (2.5%)',      pct: 2.5  },
  { label: 'Crédito 2–6x (3.5%)',    pct: 3.5  },
  { label: 'Crédito 7–12x (4.5%)',   pct: 4.5  },
  { label: 'Personalizado',          pct: null },
];

function ls(k, d)    { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

export default function SimuladorUpgrade() {
  const { clienteAtivo } = useApp();
  const [tab, setTab]             = useState('upgrade');
  const [showCfg, setShowCfg]     = useState(false);
  const [mostrarCartao, setMostrarCartao] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [cfg, setCfg]         = useState(CFG_DEF);
  const [modelos, setModelos] = useState(MODELOS_DEF);
  const [tradeIn, setTradeIn] = useState(TRADEIN_DEF);
  const [avDef, setAvDef]     = useState(AVARIAS_DEF);
  const [grades, setGrades]   = useState(GRADES_DEF);

  useEffect(() => {
    if (!clienteAtivo?.id) { setCarregando(false); return; }
    API.getSimuladorCfg(clienteAtivo.id)
      .then(data => {
        if (data) {
          if (data.cfg)     setCfg(data.cfg);
          if (data.modelos) setModelos(data.modelos);
          if (data.tradeIn) setTradeIn(data.tradeIn);
          if (data.avarias) setAvDef(data.avarias);
          if (data.grades)  setGrades(data.grades);
        }
      })
      .catch(() => {
        // fallback: tenta localStorage se a API falhar
        const c = ls('sim_cfg', null);     if (c) setCfg(c);
        const m = ls('sim_modelos', null); if (m) setModelos(m);
        const t = ls('sim_tradein', null); if (t) setTradeIn(t);
        const a = ls('sim_avarias', null); if (a) setAvDef(a);
        const g = ls('sim_grades', null);  if (g) setGrades(g);
      })
      .finally(() => setCarregando(false));
  }, [clienteAtivo?.id]);

  // Upgrade tab
  const [modelo, setModelo]           = useState('');
  const [temTroca, setTemTroca]       = useState(false);
  const [mTroca, setMTroca]           = useState('');
  const [gradeId, setGradeId]         = useState('A');
  const [avarias, setAvarias]         = useState({ bateria: false, tela: false, traseira: false });
  const [voltaManual, setVoltaManual] = useState(false);
  const [voltaVal, setVoltaVal]       = useState('');

  // Cartão tab
  const [taxaIdx, setTaxaIdx]     = useState(1);
  const [taxaCustom, setTaxaCustom] = useState('');

  const mData     = modelos.find(m => m.modelo === modelo);
  const tiData    = tradeIn.find(m => m.modelo === mTroca);
  const gradeData = grades.find(g => g.id === gradeId) ?? grades[0];

  const avTotal = temTroca
    ? (avarias.bateria  ? avDef.bateria  : 0)
    + (avarias.tela     ? avDef.tela     : 0)
    + (avarias.traseira ? avDef.traseira : 0)
    : 0;

  const tiBase    = temTroca && tiData ? tiData.valor : 0;
  const tiVal     = Math.round(tiBase * ((gradeData?.pct ?? 100) / 100));
  const preco     = mData?.preco ?? 0;
  const cmv       = mData?.cmv   ?? 0;
  const voltaAuto = temTroca ? Math.max(0, preco - tiVal + avTotal) : preco;
  const volta     = voltaManual ? parseFloat(voltaVal || 0) : voltaAuto;

  const margem   = mData ? volta + (temTroca ? tiVal - avTotal : 0) - cmv : 0;
  const comVar   = Math.max(0, margem) * (cfg.taxaVariavel / 100);
  const comTotal = cfg.comissaoFixa + comVar;
  const maxDesc  = Math.max(0, margem - cfg.margemMinima);

  const status = !mData ? null
    : margem >= cfg.margemMinima ? 'verde'
    : margem > 0 ? 'amarelo'
    : 'vermelho';

  const taxaPct      = TAXAS[taxaIdx].pct ?? parseFloat(taxaCustom || 0);
  const taxaRs       = volta * (taxaPct / 100);
  const margemCartao = margem - taxaRs;
  const statusCartao = !mData ? null
    : margemCartao >= cfg.margemMinima ? 'verde'
    : margemCartao > 0 ? 'amarelo'
    : 'vermelho';

  function resetVolta() { setVoltaManual(false); setVoltaVal(''); }
  function handleModelo(v)  { setModelo(v); resetVolta(); }
  function handleTroca(v)   { setTemTroca(v); resetVolta(); if (!v) { setMTroca(''); setGradeId('A'); } }
  function handleAv(k, v)   { setAvarias(a => ({ ...a, [k]: v })); resetVolta(); }
  function handleVolta(v)   { setVoltaVal(v); setVoltaManual(true); }

  function salvarCfg(newCfg, newM, newTi, newAv, newGrades) {
    setCfg(newCfg); setModelos(newM); setTradeIn(newTi); setAvDef(newAv); setGrades(newGrades);
    const payload = { cfg: newCfg, modelos: newM, tradeIn: newTi, avarias: newAv, grades: newGrades };
    // cache local como fallback
    lsSet('sim_cfg', newCfg); lsSet('sim_modelos', newM); lsSet('sim_tradein', newTi);
    lsSet('sim_avarias', newAv); lsSet('sim_grades', newGrades);
    // persiste no banco vinculado ao cliente
    if (clienteAtivo?.id) API.setSimuladorCfg(clienteAtivo.id, payload).catch(() => {});
    setShowCfg(false);
  }

  if (carregando) return (
    <div className="sim-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--text2)', fontSize: 14 }}>
      Carregando configurações...
    </div>
  );

  return (
    <div className="sim-root">
      {/* Tabs + config */}
      <div className="sim-topbar">
        <div className="sim-tabs">
          <button className={`sim-tab ${tab === 'upgrade' ? 'active' : ''}`} onClick={() => setTab('upgrade')}>Upgrade</button>
          <button className={`sim-tab ${tab === 'cartao'  ? 'active' : ''}`} onClick={() => setTab('cartao')}>Cartão</button>
        </div>
        <button className="sim-cfg-btn" onClick={() => setShowCfg(true)}>⚙ Configurar</button>
      </div>

      <div className="sim-body">

        {/* ── UPGRADE TAB ── */}
        {tab === 'upgrade' && (
          <>
            <div className="sim-field">
              <label className="sim-label">MODELO</label>
              <select className="sim-select" value={modelo} onChange={e => handleModelo(e.target.value)}>
                <option value="">Selecione o modelo...</option>
                {modelos.map(m => <option key={m.modelo} value={m.modelo}>{m.modelo}</option>)}
              </select>
            </div>

            {mData && (
              <div className="sim-preco-row">
                <span className="sim-label-sm">PREÇO DE VENDA</span>
                <span className="sim-preco-big">{fmt(preco)}</span>
              </div>
            )}

            <div className="sim-toggle-card">
              <div className={`sim-toggle ${temTroca ? 'on' : ''}`} onClick={() => handleTroca(!temTroca)}>
                <div className="sim-toggle-knob" />
              </div>
              <span>Tem aparelho na troca?</span>
            </div>

            {temTroca && (
              <>
                <div className="sim-field">
                  <label className="sim-label">MODELO DO APARELHO NA TROCA</label>
                  <select className="sim-select" value={mTroca} onChange={e => { setMTroca(e.target.value); resetVolta(); }}>
                    <option value="">Selecione o modelo...</option>
                    {tradeIn.map(m => <option key={m.modelo} value={m.modelo}>{m.modelo}</option>)}
                  </select>
                  {tiData && (
                    <div className="sim-hint">Valor base na troca: <strong>{fmt(tiData.valor)}</strong></div>
                  )}
                </div>

                <div className="sim-field">
                  <label className="sim-label">CONDIÇÃO DO APARELHO</label>
                  <div className="sim-grades">
                    {grades.map(g => (
                      <button key={g.id} className={`sim-grade-btn ${gradeId === g.id ? 'active' : ''}`}
                        onClick={() => { setGradeId(g.id); resetVolta(); }}>
                        <span className="sim-grade-id">{g.id}</span>
                        <span className="sim-grade-nome">{g.nome}</span>
                        <span className="sim-grade-pct">{g.pct}%</span>
                      </button>
                    ))}
                  </div>
                  {gradeData && (
                    <div className="sim-hint">{gradeData.descricao}</div>
                  )}
                  {tiData && gradeData && gradeData.pct < 100 && (
                    <div className="sim-hint">
                      Trade-in ajustado: <strong>{fmt(tiVal)}</strong>
                      <span style={{ color: 'var(--saida)', marginLeft: 6 }}>(-{fmt(tiBase - tiVal)})</span>
                    </div>
                  )}
                </div>

                <div className="sim-field">
                  <label className="sim-label">AVARIAS ADICIONAIS</label>
                  {[
                    { k: 'bateria',  label: 'Troca de bateria'  },
                    { k: 'tela',     label: 'Troca de tela'     },
                    { k: 'traseira', label: 'Troca de traseira' },
                  ].map(({ k, label }) => (
                    <label key={k} className="sim-avaria-row">
                      <input type="checkbox" checked={avarias[k]}
                        onChange={e => handleAv(k, e.target.checked)} />
                      <span>{label}</span>
                      <span className="sim-avaria-rs">R$ {avDef[k]}</span>
                    </label>
                  ))}
                  {avTotal > 0 && (
                    <div className="sim-avaria-total">
                      Líquido do aparelho: <strong>{fmt(tiVal - avTotal)}</strong>
                    </div>
                  )}
                </div>
              </>
            )}

            {mData && (
              <div className="sim-field">
                <div className="sim-volta-header">
                  <label className="sim-label">VALOR DA VOLTA — O QUE O CLIENTE PAGA</label>
                  {!voltaManual && <span className="sim-badge">automático</span>}
                </div>
                <div className="sim-input-row">
                  <span className="sim-rs">R$</span>
                  <input
                    className="sim-input"
                    type="number"
                    step="10"
                    value={voltaManual ? voltaVal : voltaAuto}
                    onChange={e => handleVolta(e.target.value)}
                    onFocus={() => { if (!voltaManual) { setVoltaManual(true); setVoltaVal(String(voltaAuto)); } }}
                  />
                </div>
                <div className="sim-hint">Ajuste se necessário para negociar</div>
              </div>
            )}

            {mData ? (
              <>
                <div className="sim-comissao-card">
                  <div className="sim-comissao-header">
                    <span>Sua comissão progressiva</span>
                    <strong style={{ color: 'var(--primary)' }}>{fmt(comTotal)}</strong>
                  </div>
                  <div className="sim-comissao-row">
                    <span>Comissão fixa</span>
                    <span>{fmt(cfg.comissaoFixa)}</span>
                  </div>
                  <div className="sim-comissao-row">
                    <span>Comissão variável <em style={{ color: 'var(--text2)', fontSize: 12 }}>({cfg.taxaVariavel}% × {fmt(Math.max(0, margem))})</em></span>
                    <span>{fmt(comVar)}</span>
                  </div>
                </div>

                <div className={`sim-status sim-status-${status}`}>
                  <span className={`sim-dot sim-dot-${status}`} />
                  <div>
                    <div className="sim-status-title">
                      {status === 'verde'    && 'Lucro bom — pode fechar!'}
                      {status === 'amarelo'  && 'Cuidado — negocie com cuidado'}
                      {status === 'vermelho' && 'Prejuízo — não feche'}
                    </div>
                    <div className="sim-status-sub">
                      {status === 'verde' && maxDesc > 0
                        ? `Pode dar até ${fmt(maxDesc)} de desconto e continuar no verde`
                        : status === 'verde'
                        ? 'Margem no limite mínimo'
                        : status === 'amarelo'
                        ? `Margem de ${fmt(margem)} — mínimo: ${fmt(cfg.margemMinima)}`
                        : `Prejuízo de ${fmt(Math.abs(margem))}`}
                    </div>
                  </div>
                </div>

                <div className="sim-cartao-inline">
                  <button className="sim-cartao-toggle" onClick={() => setMostrarCartao(v => !v)}>
                    <span>Vai pagar no cartão?</span>
                    <span className={`sim-cartao-arrow ${mostrarCartao ? 'open' : ''}`}>›</span>
                  </button>
                  {mostrarCartao && (
                    <div className="sim-cartao-body">
                      <div className="sim-field">
                        <label className="sim-label">FORMA DE PAGAMENTO</label>
                        <select className="sim-select" value={taxaIdx} onChange={e => setTaxaIdx(Number(e.target.value))}>
                          {TAXAS.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                        </select>
                      </div>
                      {TAXAS[taxaIdx].pct === null && (
                        <div className="sim-field">
                          <label className="sim-label">TAXA PERSONALIZADA</label>
                          <div className="sim-input-row">
                            <span className="sim-rs">%</span>
                            <input className="sim-input" type="number" step="0.1" value={taxaCustom}
                              onChange={e => setTaxaCustom(e.target.value)} />
                          </div>
                        </div>
                      )}
                      <div className="sim-comissao-card">
                        <div className="sim-comissao-row">
                          <span>Taxa do cartão ({taxaPct}%)</span>
                          <span style={{ color: 'var(--saida)' }}>-{fmt(taxaRs)}</span>
                        </div>
                        <div className="sim-comissao-row" style={{ fontWeight: 600 }}>
                          <span>Margem após taxa</span>
                          <span style={{ color: margemCartao >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(margemCartao)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0 4px' }} />
                        <div className="sim-comissao-row">
                          <span>Comissão estimada</span>
                          <span>{fmt(cfg.comissaoFixa + Math.max(0, margemCartao) * (cfg.taxaVariavel / 100))}</span>
                        </div>
                      </div>
                      <div className={`sim-status sim-status-${statusCartao}`} style={{ margin: 0 }}>
                        <span className={`sim-dot sim-dot-${statusCartao}`} />
                        <div>
                          <div className="sim-status-title">
                            {statusCartao === 'verde'    && 'OK no cartão — pode fechar!'}
                            {statusCartao === 'amarelo'  && 'Cuidado — margem baixa no cartão'}
                            {statusCartao === 'vermelho' && 'Prejuízo com a taxa — cuidado'}
                          </div>
                          {taxaRs > 0 && (
                            <div className="sim-status-sub">Cobrar mais {fmt(taxaRs)} ou reduzir o desconto pra cobrir a taxa</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="sim-empty">
                <div className="sim-empty-title">Preencha os campos acima</div>
                <div className="sim-empty-sub">O resultado aparece aqui</div>
              </div>
            )}
          </>
        )}

        {/* ── CARTÃO TAB ── */}
        {tab === 'cartao' && (
          <>
            {!mData ? (
              <div className="sim-empty">
                <div className="sim-empty-title">Selecione um modelo na aba Upgrade</div>
              </div>
            ) : (
              <>
                <div className="sim-preco-row">
                  <span className="sim-label-sm">VALOR DA VOLTA</span>
                  <span className="sim-preco-big">{fmt(volta)}</span>
                </div>

                <div className="sim-field">
                  <label className="sim-label">FORMA DE PAGAMENTO</label>
                  <select className="sim-select" value={taxaIdx} onChange={e => setTaxaIdx(Number(e.target.value))}>
                    {TAXAS.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                  </select>
                </div>

                {TAXAS[taxaIdx].pct === null && (
                  <div className="sim-field">
                    <label className="sim-label">TAXA PERSONALIZADA</label>
                    <div className="sim-input-row">
                      <span className="sim-rs">%</span>
                      <input className="sim-input" type="number" step="0.1" value={taxaCustom}
                        onChange={e => setTaxaCustom(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="sim-comissao-card">
                  <div className="sim-comissao-row">
                    <span>Taxa do cartão ({taxaPct}%)</span>
                    <span style={{ color: 'var(--saida)' }}>-{fmt(taxaRs)}</span>
                  </div>
                  <div className="sim-comissao-row" style={{ fontWeight: 600 }}>
                    <span>Margem após taxa</span>
                    <span style={{ color: margemCartao >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(margemCartao)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0 4px' }} />
                  <div className="sim-comissao-row">
                    <span>Comissão estimada</span>
                    <span>{fmt(cfg.comissaoFixa + Math.max(0, margemCartao) * (cfg.taxaVariavel / 100))}</span>
                  </div>
                </div>

                <div className={`sim-status sim-status-${statusCartao}`}>
                  <span className={`sim-dot sim-dot-${statusCartao}`} />
                  <div>
                    <div className="sim-status-title">
                      {statusCartao === 'verde'    && 'OK no cartão — pode fechar!'}
                      {statusCartao === 'amarelo'  && 'Cuidado — margem baixa no cartão'}
                      {statusCartao === 'vermelho' && 'Prejuízo com a taxa — cuidado'}
                    </div>
                    <div className="sim-status-sub">
                      {taxaRs > 0 && `Cobrar mais ${fmt(taxaRs)} ou reduzir o desconto pra cobrir a taxa`}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showCfg && (
        <ConfigModal
          cfg={cfg} modelos={modelos} tradeIn={tradeIn} avDef={avDef} grades={grades}
          onSave={salvarCfg} onClose={() => setShowCfg(false)}
        />
      )}
    </div>
  );
}

function ConfigModal({ cfg, modelos, tradeIn, avDef, grades, onSave, onClose }) {
  const [c,  setC]  = useState({ ...cfg });
  const [m,  setM]  = useState(modelos.map(x => ({ ...x })));
  const [ti, setTi] = useState(tradeIn.map(x => ({ ...x })));
  const [av, setAv] = useState({ ...avDef });
  const [gr, setGr] = useState(grades.map(x => ({ ...x })));
  const [tab, setTab] = useState('comissao');

  const tabs = [
    ['comissao', 'Comissão'],
    ['grades',   'Grades'],
    ['precos',   'Preços de Venda'],
    ['tradein',  'Trade-in'],
    ['avarias',  'Avarias'],
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>Configurações do Simulador</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: 'none', border: 'none', padding: '10px 12px', fontSize: 13, cursor: 'pointer',
              color: tab === k ? 'var(--primary)' : 'var(--text2)',
              borderBottom: tab === k ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'comissao' && (
            <div className="form-grid">
              <div className="field">
                <label>Comissão fixa (R$)</label>
                <input type="number" step="1" value={c.comissaoFixa}
                  onChange={e => setC(x => ({ ...x, comissaoFixa: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="field">
                <label>Taxa variável (%)</label>
                <input type="number" step="0.5" value={c.taxaVariavel}
                  onChange={e => setC(x => ({ ...x, taxaVariavel: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="field span2">
                <label>Margem mínima — limite do verde (R$)</label>
                <input type="number" step="10" value={c.margemMinima}
                  onChange={e => setC(x => ({ ...x, margemMinima: parseFloat(e.target.value) || 0 }))} />
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>
                  Abaixo desse valor o indicador fica amarelo/vermelho. O desconto máximo é calculado para manter essa margem.
                </div>
              </div>
            </div>
          )}

          {tab === 'grades' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                Define o percentual aplicado ao valor de trade-in conforme a condição geral do aparelho.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500 }}>ID</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500 }}>Nome</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500 }}>Descrição</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>% do valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gr.map((g, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--primary)' }}>{g.id}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <input type="text" value={g.nome}
                            onChange={e => setGr(arr => arr.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                            style={{ width: 90, padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)' }} />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input type="text" value={g.descricao}
                            onChange={e => setGr(arr => arr.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))}
                            style={{ width: '100%', minWidth: 160, padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)' }} />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number" step="1" min="0" max="100" value={g.pct}
                            onChange={e => setGr(arr => arr.map((x, j) => j === i ? { ...x, pct: parseFloat(e.target.value) || 0 } : x))}
                            style={{ width: 70, textAlign: 'right', padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'precos' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                Preço de venda e CMV (custo de aquisição) por modelo.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500 }}>Modelo</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>Preço (R$)</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>CMV (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.map((mod, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text2)' }}>{mod.modelo}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number" step="10" value={mod.preco}
                            onChange={e => setM(arr => arr.map((x, j) => j === i ? { ...x, preco: parseFloat(e.target.value) || 0 } : x))}
                            style={{ width: 90, textAlign: 'right', padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)' }} />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number" step="10" value={mod.cmv}
                            onChange={e => setM(arr => arr.map((x, j) => j === i ? { ...x, cmv: parseFloat(e.target.value) || 0 } : x))}
                            style={{ width: 90, textAlign: 'right', padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'tradein' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                Valor que a loja paga pelo aparelho do cliente em bom estado (antes das deduções por avaria).
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500 }}>Modelo</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>Trade-in (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ti.map((mod, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text2)' }}>{mod.modelo}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <input type="number" step="10" value={mod.valor}
                            onChange={e => setTi(arr => arr.map((x, j) => j === i ? { ...x, valor: parseFloat(e.target.value) || 0 } : x))}
                            style={{ width: 90, textAlign: 'right', padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'avarias' && (
            <div className="form-grid">
              <div className="field">
                <label>Troca de bateria (R$)</label>
                <input type="number" step="10" value={av.bateria}
                  onChange={e => setAv(a => ({ ...a, bateria: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="field">
                <label>Troca de tela (R$)</label>
                <input type="number" step="10" value={av.tela}
                  onChange={e => setAv(a => ({ ...a, tela: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="field">
                <label>Troca de traseira (R$)</label>
                <input type="number" step="10" value={av.traseira}
                  onChange={e => setAv(a => ({ ...a, traseira: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 13 }}
            onClick={() => { if (window.confirm('Restaurar todos os preços e modelos para o padrão?')) { setM(MODELOS_DEF.map(x => ({ ...x }))); setTi(TRADEIN_DEF.map(x => ({ ...x }))); setAv({ ...AVARIAS_DEF }); setC({ ...CFG_DEF }); setGr(GRADES_DEF.map(x => ({ ...x }))); } }}>
            Restaurar padrões
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => onSave(c, m, ti, av, gr)}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
