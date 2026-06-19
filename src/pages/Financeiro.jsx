import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { CMVCATS, SGA_CATS, NAOOP_CATS, getSubcats } from '../services/constants';
import { fmt, fmtPct, hoje, MESES, MESES_FULL } from '../services/utils';
import './Financeiro.css';

// ── DRE CALCULATION ──────────────────────────────────────────────────────────
function calcDREMes(lancamentos, pfx) {
  const lm  = lancamentos.filter(l => l.data.startsWith(pfx));
  const ent = (cat, sub) => lm.filter(l => l.tipo === 'Entrada' && l.categoria === cat && (!sub || l.subcategoria === sub)).reduce((a,l) => a+l.valor, 0);
  const sai = (cat)      => lm.filter(l => l.tipo === 'Saída'   && l.categoria === cat).reduce((a,l) => a+l.valor, 0);
  const qua = (cat)      => lm.filter(l => l.categoria === cat).reduce((a,l) => a+l.valor, 0);

  const subscricao  = ent('Aparelhos') + ent('Acessórios') + ent('Assistência Técnica') + ent('Outros Produtos');
  const recNaoOp    = ent('Receitas Não-Operacionais');
  const recBruta    = subscricao + recNaoOp;
  const deducoesDiretas = lm.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a, l) => a + (l.valor - l.valorRecebido), 0);
  const deducoes    = sai('Deduções das Vendas') + deducoesDiretas;
  const recLiquida  = recBruta - deducoes;
  const cmvInd      = sai('Custos Variáveis Indiretos');
  const cmvDir      = qua('Custos Variáveis Diretos');
  const cmvTotal    = cmvInd + cmvDir;
  const lucroBruto  = recLiquida - cmvTotal;
  const margContrib = recBruta > 0 ? (lucroBruto / recBruta * 100) : null;
  const ocupacao    = sai('Despesas com Ocupação');
  const pessoal     = sai('Despesas com Pessoal');
  const variaveis   = sai('Despesas Variáveis');
  const softwares   = sai('Softwares / Tecnologias');
  const terceiros   = sai('Serviços Terceirizados');
  const sga         = ocupacao + pessoal + variaveis + softwares + terceiros;
  const pontoEq     = (margContrib && margContrib > 0) ? (sga / (margContrib / 100)) : null;
  const ebitda      = lucroBruto - sga;
  const margEbitda  = recBruta > 0 ? (ebitda / recBruta * 100) : null;
  const recFin      = ent('Receitas Não-Operacionais', 'Aplicações Fora da Companhia');
  const despJuros   = sai('Dívidas / Empréstimos');
  const despNaoOp   = sai('Saídas Não-Operacionais');
  const resFin      = recFin - despJuros - despNaoOp;

  return {
    subscricao, recNaoOp, recBruta, deducoes, recLiquida,
    cmvInd, cmvDir, cmvTotal, lucroBruto, margContrib, pontoEq,
    ocupacao, pessoal, variaveis, softwares, terceiros, sga,
    ebitda, margEbitda, recFin, despJuros, despNaoOp, resFin,
  };
}

// ── DRE ──────────────────────────────────────────────────────────────────────
function DRE({ lancamentos, clienteAtivo, metasCache, setMetasCache }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const mesAtual = parseInt(hoje().slice(5, 7)) - 1;
  const [ano, setAno]               = useState(anoAtual);
  const [mesFiltro, setMesFiltro]   = useState(mesAtual);
  const [expandedRows, setExpanded] = useState(new Set());

  function toggleExpand(cat) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  const getManual = useCallback((mesIdx, campo) => {
    const mk = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`;
    return metasCache[mk]?.[campo] || 0;
  }, [ano, metasCache]);

  async function salvarManual(mesIdx, campo, valor) {
    const mk = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`;
    const v  = parseFloat(valor) || 0;
    setMetasCache(prev => ({ ...prev, [mk]: { ...(prev[mk] || {}), [campo]: v } }));
    try { await API.salvarMeta(clienteAtivo.id, { mes_chave: mk, campo, valor: v }); } catch(e) { console.error(e); }
  }

  const mv = useMemo(() =>
    MESES.map((_, i) => {
      const base   = calcDREMes(lancamentos, `${ano}-${String(i + 1).padStart(2, '0')}`);
      const dep    = getManual(i, 'depreciacao');
      const irpj   = getManual(i, 'irpj');
      const lair   = base.ebitda + base.resFin - dep;
      const lucroLiq = lair - irpj;
      const margLiq  = base.recBruta > 0 ? (lucroLiq / base.recBruta * 100) : null;
      return { ...base, dep, irpj, lair, lucroLiq, margLiq };
    }),
    [lancamentos, ano, getManual]
  );

  const S = (k) => mv.reduce((a, v) => a + (v[k] || 0), 0);
  const tRecBruta = S('recBruta'), tLucroBruto = S('lucroBruto');
  const tSga      = S('sga'),      tEbitda     = S('ebitda');
  const tLucroLiq = S('lucroLiq'), tRecLiq     = S('recLiquida');
  const tCmv      = S('cmvTotal'), tResFin     = S('resFin');
  const tLair     = S('lair');

  const cm = mv[mesFiltro] || {};
  const cRecBruta   = cm.recBruta   || 0;
  const cLucroBruto = cm.lucroBruto || 0;
  const cEbitda     = cm.ebitda     || 0;
  const cLucroLiq   = cm.lucroLiq   || 0;

  const d  = (v) => v === 0 ? <span style={{ color: 'var(--text2)' }}>—</span>
    : <span style={{ color: v >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{v < 0 ? `(${fmt(-v)})` : fmt(v)}</span>;
  const dn = (v) => v === 0 ? <span style={{ color: 'var(--text2)' }}>—</span>
    : <span style={{ color: 'var(--saida)' }}>{fmt(v)}</span>;
  const dp = (v) => v === null ? <span style={{ color: 'var(--text2)' }}>—</span>
    : <span style={{ color: v >= 0 ? 'var(--entrada)' : 'var(--saida)', fontStyle: 'italic' }}>{fmtPct(v)}</span>;

  const RowBig = ({ label, vals, tot, neg = false, final = false }) => (
    <tr className={`row-big ${final ? 'row-final' : ''}`}>
      <td>{label}</td>
      {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{neg ? dn(v) : d(v)}</td>)}
      <td style={{ textAlign: 'right' }}>{neg ? dn(tot) : d(tot)}</td>
    </tr>
  );

  const RowMed = ({ label, vals, tot, neg = false }) => {
    if (!vals.some(v => v !== 0) && tot === 0) return null;
    return (
      <tr className="row-med">
        <td style={{ paddingLeft: 20 }}>{label}</td>
        {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{neg ? dn(v) : d(v)}</td>)}
        <td style={{ textAlign: 'right' }}>{neg ? dn(tot) : d(tot)}</td>
      </tr>
    );
  };

  const RowExp = ({ label, cat, vals, tot, neg = false, tipo = 'Saída' }) => {
    const subs    = getSubcats(cat);
    const hasSubs = subs.length > 0;
    const isExp   = expandedRows.has(cat);
    if (!vals.some(v => v !== 0) && tot === 0) return null;
    const fn = neg ? dn : d;

    const subcatRows = isExp ? subs.flatMap(sub => {
      const subVals = MESES.map((_, i) => {
        const pfx = `${ano}-${String(i + 1).padStart(2, '0')}`;
        const lm  = lancamentos.filter(l => l.data.startsWith(pfx) && l.categoria === cat && l.subcategoria === sub);
        if (tipo === 'Entrada') return lm.filter(l => l.tipo === 'Entrada').reduce((a,l) => a+l.valor, 0);
        if (tipo === 'Saída')   return lm.filter(l => l.tipo === 'Saída').reduce((a,l) => a+l.valor, 0);
        return lm.reduce((a,l) => a+l.valor, 0);
      });
      const subTot = subVals.reduce((a,b) => a+b, 0);
      if (!subVals.some(v => v !== 0) && subTot === 0) return [];
      return [(
        <tr key={sub} className="row-sub">
          <td style={{ paddingLeft: 36, fontSize: 11, color: 'var(--text2)', borderLeft: '2px solid #22c55e33' }}>{sub}</td>
          {subVals.map((v, i) => <td key={i} style={{ textAlign: 'right', fontSize: 11 }}>{fn(v)}</td>)}
          <td style={{ textAlign: 'right', fontSize: 11 }}>{fn(subTot)}</td>
        </tr>
      )];
    }) : [];

    return (
      <>
        <tr className="row-med" style={hasSubs ? { cursor: 'pointer' } : {}} onClick={() => hasSubs && toggleExpand(cat)}>
          <td style={{ paddingLeft: 20 }}>
            {hasSubs
              ? <span style={{ marginRight: 6, fontSize: 9, display: 'inline-block', transform: isExp ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--text2)' }}>▶</span>
              : <span style={{ display: 'inline-block', width: 15 }} />
            }
            {label}
          </td>
          {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{fn(v)}</td>)}
          <td style={{ textAlign: 'right' }}>{fn(tot)}</td>
        </tr>
        {subcatRows}
      </>
    );
  };

  const RowPct = ({ label, vals, tot }) => (
    <tr className="row-pct">
      <td style={{ paddingLeft: 8, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>{label}</td>
      {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{dp(v)}</td>)}
      <td style={{ textAlign: 'right' }}>{dp(tot)}</td>
    </tr>
  );

  const RowEdit = ({ label, campo }) => (
    <tr className="row-med">
      <td style={{ paddingLeft: 20, color: 'var(--text2)' }}>{label}</td>
      {MESES.map((_, i) => (
        <td key={i} style={{ textAlign: 'right' }}>
          <input
            key={`${ano}-${campo}-${i}`}
            type="number"
            defaultValue={getManual(i, campo) || ''}
            placeholder="—"
            min="0" step="0.01"
            className="dre-input"
            onBlur={e => salvarManual(i, campo, e.target.value)}
          />
        </td>
      ))}
      <td style={{ textAlign: 'right' }}>{dn(S(campo))}</td>
    </tr>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="card-label">Receita Bruta — {MESES[mesFiltro]}</div>
            <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(cRecBruta)}</div>
          </div>
          <div className="card">
            <div className="card-label">Lucro Bruto — {MESES[mesFiltro]}</div>
            <div className="card-value" style={{ color: cLucroBruto >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(cLucroBruto)}</div>
            <div className="card-sub">{cRecBruta > 0 ? fmtPct(cLucroBruto / cRecBruta * 100) : '—'}</div>
          </div>

          <div className="card">
            <div className="card-label">Lucro Líquido — {MESES[mesFiltro]}</div>
            <div className="card-value" style={{ color: cLucroLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(cLucroLiq)}</div>
            <div className="card-sub">{cRecBruta > 0 ? fmtPct(cLucroLiq / cRecBruta * 100) : '—'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="period-select" value={ano} onChange={e => { setAno(e.target.value); setExpanded(new Set()); }}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="table-panel">
        <div style={{ overflowX: 'auto' }}>
          <table className="dre-table">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>DRE — Resultado do Exercício</th>
                {MESES.map(m => <th key={m} style={{ textAlign: 'right', minWidth: 90 }}>{m}</th>)}
                <th style={{ textAlign: 'right', minWidth: 100 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <RowBig label="RECEITA BRUTA" vals={mv.map(v => v.recBruta)} tot={tRecBruta} />
              <RowMed label="(+) Receita Operacional" vals={mv.map(v => v.subscricao)} tot={S('subscricao')} />
              <RowExp label="(+) Receitas Não-Operacionais" cat="Receitas Não-Operacionais" vals={mv.map(v => v.recNaoOp)} tot={S('recNaoOp')} tipo="Entrada" />
              <RowExp label="(-) Deduções das Vendas" cat="Deduções das Vendas" vals={mv.map(v => v.deducoes)} tot={S('deducoes')} neg />
              <RowBig label="(=) RECEITA LÍQUIDA" vals={mv.map(v => v.recLiquida)} tot={tRecLiq} />
              <RowBig label="(-) CMV — Custo de Mercadoria Vendida" vals={mv.map(v => v.cmvTotal)} tot={tCmv} neg />
              <RowExp label="(-) Custos Variáveis Indiretos" cat="Custos Variáveis Indiretos" vals={mv.map(v => v.cmvInd)} tot={S('cmvInd')} neg />
              <RowExp label="(-) Custos Variáveis Diretos" cat="Custos Variáveis Diretos" vals={mv.map(v => v.cmvDir)} tot={S('cmvDir')} neg tipo={null} />
              <RowBig label="(=) LUCRO BRUTO" vals={mv.map(v => v.lucroBruto)} tot={tLucroBruto} />
              <RowPct label="Margem de Contribuição (%)" vals={mv.map(v => v.margContrib)} tot={tRecBruta > 0 ? tLucroBruto / tRecBruta * 100 : null} />
              <tr className="row-pct">
                <td style={{ paddingLeft: 8, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>Ponto de Equilíbrio</td>
                {mv.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{v.pontoEq !== null ? d(v.pontoEq) : <span style={{ color: 'var(--text2)' }}>—</span>}</td>)}
                <td style={{ textAlign: 'right' }}>{tLucroBruto > 0 && tRecBruta > 0 ? d(tSga / (tLucroBruto / tRecBruta)) : <span style={{ color: 'var(--text2)' }}>—</span>}</td>
              </tr>
              <RowBig label="(-) Despesas SG&A" vals={mv.map(v => v.sga)} tot={tSga} neg />
              <RowExp label="(-) Despesas com Ocupação"   cat="Despesas com Ocupação"   vals={mv.map(v => v.ocupacao)}  tot={S('ocupacao')}  neg />
              <RowExp label="(-) Despesas com Pessoal"    cat="Despesas com Pessoal"    vals={mv.map(v => v.pessoal)}   tot={S('pessoal')}   neg />
              <RowExp label="(-) Despesas Variáveis"      cat="Despesas Variáveis"      vals={mv.map(v => v.variaveis)} tot={S('variaveis')} neg />
              <RowExp label="(-) Softwares / Tecnologias" cat="Softwares / Tecnologias" vals={mv.map(v => v.softwares)} tot={S('softwares')} neg />
              <RowExp label="(-) Serviços Terceirizados"  cat="Serviços Terceirizados"  vals={mv.map(v => v.terceiros)} tot={S('terceiros')} neg />
              <RowBig label="(=) LUCRO OPERACIONAL (EBITDA)" vals={mv.map(v => v.ebitda)} tot={tEbitda} />
              <RowPct label="Margem EBITDA (%)" vals={mv.map(v => v.margEbitda)} tot={tRecBruta > 0 ? tEbitda / tRecBruta * 100 : null} />
              <RowMed label="(=) Resultado Financeiro" vals={mv.map(v => v.resFin)} tot={tResFin} />
              <RowMed label="(+) Receitas Financeiras [Aplic. fora da Cia]" vals={mv.map(v => v.recFin)} tot={S('recFin')} />
              <RowExp label="(-) Despesas Financeiras [Juros/Empréstimos]" cat="Dívidas / Empréstimos"    vals={mv.map(v => v.despJuros)} tot={S('despJuros')} neg />
              <RowExp label="(-) Despesas Não-Operacionais"                cat="Saídas Não-Operacionais" vals={mv.map(v => v.despNaoOp)} tot={S('despNaoOp')} neg />
              <RowEdit label="(-) Depreciação" campo="depreciacao" />
              <RowBig label="(=) LUCRO ANTES DO IR (LAIR)" vals={mv.map(v => v.lair)} tot={tLair} />
              <RowEdit label="(-) Imposto sobre Lucro (IRPJ)" campo="irpj" />
              <RowBig label="(=) LUCRO LÍQUIDO" vals={mv.map(v => v.lucroLiq)} tot={tLucroLiq} final />
              <RowPct label="Margem Líquida (%)" vals={mv.map(v => v.margLiq)} tot={tRecBruta > 0 ? tLucroLiq / tRecBruta * 100 : null} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── FLUXO DE CAIXA ────────────────────────────────────────────────────────────
const DFC_GRUPOS = [
  {
    sep: 'ENTRADAS',
    grupos: [
      { label: 'RECEITAS OPERACIONAIS',     cats: ['Aparelhos','Acessórios','Assistência Técnica','Outros Produtos'] },
      { label: 'RECEITAS NÃO-OPERACIONAIS', cats: ['Receitas Não-Operacionais'] },
    ],
  },
  {
    sep: 'SAÍDAS',
    grupos: [
      { label: 'SAÍDAS OPERACIONAIS', cats: ['Fornecedores (Estoque)','Deduções das Vendas','Custos Variáveis Diretos','Custos Variáveis Indiretos','Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Softwares / Tecnologias','Serviços Terceirizados'] },
      { label: 'SAÍDAS NÃO-OPERACIONAIS', cats: ['Saídas Não-Operacionais','Dívidas / Empréstimos'] },
      { label: 'INVESTIMENTOS', cats: ['Investimentos'] },
      { label: 'PERMUTA / UPGRADE', cats: ['Permuta - Upgrade'] },
    ],
  },
];

function FluxoCaixa({ lancamentos, clienteAtivo }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const mesAtual = parseInt(hoje().slice(5, 7)) - 1;
  const [ano, setAno]         = useState(anoAtual);
  const [mesFiltro, setMes]   = useState(mesAtual);
  const [saldoInicial, setSI] = useState(0);
  const [saldoMes, setSIMes]  = useState(0);
  const [modalSI, setModalSI] = useState(false);
  const [siValor, setSiValor] = useState('');
  const [siMes, setSiMes]     = useState(0);

  useEffect(() => {
    if (!clienteAtivo) return;
    API.buscarSaldo(clienteAtivo.id, ano)
      .then(r => { if (r) { setSI(r.valor || 0); setSIMes(r.mes || 0); } })
      .catch(() => {});
  }, [clienteAtivo, ano]);

  const lancDFC = useMemo(() =>
    lancamentos.filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente')),
    [lancamentos]
  );

  const mv = useMemo(() =>
    MESES.map((_, i) => {
      const pfx       = `${ano}-${String(i + 1).padStart(2, '0')}`;
      const lm        = lancDFC.filter(l => l.data.startsWith(pfx));
      const ent          = lm.filter(l => l.tipo === 'Entrada').reduce((a,l) => a + l.valor, 0);
      const dedInline    = lm.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a,l) => a + (l.valor - l.valorRecebido), 0);
      const upgradeInline = lm.filter(l => l.tipo === 'Entrada' && l.valorUpgrade > 0).reduce((a,l) => a + l.valorUpgrade, 0);
      const sai          = lm.filter(l => l.tipo === 'Saída').reduce((a,l) => a + l.valor, 0) + dedInline + upgradeInline;
      const catVal    = (cat) => {
        if (cat === 'Permuta - Upgrade') return upgradeInline;
        const base = lm.filter(l => l.categoria === cat).reduce((a,l) => a + l.valor, 0);
        return cat === 'Deduções das Vendas' ? base + dedInline : base;
      };
      const subVal = (cat, sub) => lancamentos.filter(l => l.data.startsWith(pfx) && l.categoria === cat && l.subcategoria === sub).reduce((a,l) => a + l.valor, 0);
      return { ent, sai, saldo: ent - sai, catVal, subVal };
    }),
    [lancDFC, lancamentos, ano]
  );

  const saldoAcum = useMemo(() => {
    let acum = 0;
    return mv.map((m, i) => {
      if (i === saldoMes && saldoInicial > 0) acum = saldoInicial;
      acum += m.saldo;
      return acum;
    });
  }, [mv, saldoInicial, saldoMes]);

  async function salvarSaldoInicial() {
    const valor = parseFloat(siValor) || 0;
    const mes   = parseInt(siMes);
    setSI(valor); setSIMes(mes);
    try { await API.salvarSaldo(clienteAtivo.id, ano, { valor, mes }); } catch(e) { console.error(e); }
    setModalSI(false);
  }

  const d = (v, cor) => v === 0
    ? <span style={{ color: 'var(--text2)' }}>—</span>
    : <span style={{ color: cor || (v >= 0 ? 'var(--entrada)' : 'var(--saida)'), fontWeight: 600 }}>{fmt(v)}</span>;

  const totEnt = mv.reduce((a,m) => a+m.ent, 0);
  const totSai = mv.reduce((a,m) => a+m.sai, 0);
  const totSaldo = totEnt - totSai;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          {saldoInicial > 0 && (
            <div className="card">
              <div className="card-label">Saldo Inicial</div>
              <div className="card-value" style={{ color: 'var(--accent)' }}>{fmt(saldoInicial)}</div>
              <div className="card-sub">A partir de {MESES_FULL[saldoMes]}</div>
            </div>
          )}
          <div className="card">
            <div className="card-label">Entradas DFC — {MESES[mesFiltro]}</div>
            <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(mv[mesFiltro]?.ent || 0)}</div>
          </div>
          <div className="card">
            <div className="card-label">Saídas DFC — {MESES[mesFiltro]}</div>
            <div className="card-value" style={{ color: 'var(--saida)' }}>{fmt(mv[mesFiltro]?.sai || 0)}</div>
          </div>
          <div className="card">
            <div className="card-label">Saldo Final — {MESES[mesFiltro]}</div>
            <div className="card-value" style={{ color: (mv[mesFiltro]?.saldo ?? 0) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
              {fmt(mv[mesFiltro]?.saldo ?? 0)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={mesFiltro} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSiValor(saldoInicial || ''); setSiMes(saldoMes); setModalSI(true); }}>
            {saldoInicial > 0 ? `Saldo Inicial: ${fmt(saldoInicial)}` : 'Saldo Inicial'}
          </button>
        </div>
      </div>

      <div className="table-panel">
        <div style={{ overflowX: 'auto' }}>
          <table className="dre-table">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Fluxo de Caixa</th>
                {MESES.map(m => <th key={m} style={{ textAlign: 'right', minWidth: 90 }}>{m}</th>)}
                <th style={{ textAlign: 'right', minWidth: 100 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="row-big">
                <td>ENTRADAS TOTAL</td>
                {mv.map((m, i) => <td key={i} style={{ textAlign: 'right' }}>{d(m.ent, 'var(--entrada)')}</td>)}
                <td style={{ textAlign: 'right' }}>{d(totEnt, 'var(--entrada)')}</td>
              </tr>
              <tr className="row-big">
                <td>SAÍDAS TOTAL</td>
                {mv.map((m, i) => <td key={i} style={{ textAlign: 'right' }}>{d(m.sai, 'var(--saida)')}</td>)}
                <td style={{ textAlign: 'right' }}>{d(totSai, 'var(--saida)')}</td>
              </tr>
              <tr className="row-final">
                <td>SALDO DO MÊS</td>
                {mv.map((m, i) => <td key={i} style={{ textAlign: 'right' }}>{d(m.saldo)}</td>)}
                <td style={{ textAlign: 'right' }}>{d(totSaldo)}</td>
              </tr>
              {DFC_GRUPOS.map(({ sep, grupos }) => (
                <>
                  <tr key={sep} className="row-sep">
                    <td colSpan={14}>{sep}</td>
                  </tr>
                  {grupos.map(({ label, cats }) => {
                    const grupoVals = mv.map(m => cats.reduce((a, c) => a + m.catVal(c), 0));
                    const grupoTot  = grupoVals.reduce((a,b) => a+b, 0);
                    if (!grupoVals.some(v => v !== 0) && grupoTot === 0) return null;
                    return (
                      <>
                        <tr key={label} className="row-big" style={{ borderTop: '2px solid var(--border)' }}>
                          <td>{label}</td>
                          {grupoVals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{d(v)}</td>)}
                          <td style={{ textAlign: 'right' }}>{d(grupoTot)}</td>
                        </tr>
                        {cats.map(cat => {
                          const catVals = mv.map(m => m.catVal(cat));
                          const catTot  = catVals.reduce((a,b) => a+b, 0);
                          if (!catVals.some(v => v !== 0) && catTot === 0) return null;
                          const subs = getSubcats(cat);
                          return (
                            <>
                              <tr key={cat} className="row-med">
                                <td style={{ paddingLeft: 20, color: 'var(--text2)' }}>{cat}</td>
                                {catVals.map((v, i) => <td key={i} style={{ textAlign: 'right', color: 'var(--text2)' }}>{v ? fmt(v) : '—'}</td>)}
                                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{catTot ? fmt(catTot) : '—'}</td>
                              </tr>
                              {subs.map(sub => {
                                const subVals = mv.map(m => m.subVal(cat, sub));
                                const subTot  = subVals.reduce((a,b) => a+b, 0);
                                if (!subVals.some(v => v !== 0) && subTot === 0) return null;
                                return (
                                  <tr key={sub}>
                                    <td style={{ paddingLeft: 36, fontSize: 11, color: 'var(--text2)', borderLeft: '2px solid #22c55e22' }}>{sub}</td>
                                    {subVals.map((v, i) => <td key={i} style={{ textAlign: 'right', fontSize: 11, color: 'var(--text2)' }}>{v ? fmt(v) : '—'}</td>)}
                                    <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--text2)' }}>{subTot ? fmt(subTot) : '—'}</td>
                                  </tr>
                                );
                              })}
                            </>
                          );
                        })}
                      </>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalSI && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSI(false)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Saldo Inicial — {ano}</h3>
              <button className="modal-close" onClick={() => setModalSI(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
                Valor em caixa no início do acompanhamento. Será o ponto de partida do Fluxo de Caixa.
              </p>
              <div className="form-grid">
                <div className="field">
                  <label>Mês de Início</label>
                  <select value={siMes} onChange={e => setSiMes(parseInt(e.target.value))}>
                    {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Valor em Caixa (R$)</label>
                  <input type="number" step="0.01" placeholder="0,00" value={siValor} onChange={e => setSiValor(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalSI(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarSaldoInicial}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BALANÇO PATRIMONIAL ───────────────────────────────────────────────────────
function Balanco({ lancamentos }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const mesAtual = hoje().slice(5, 7);
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState(mesAtual);

  const periodo = `${ano}-${mes}`;

  const dados = useMemo(() => {
    const lancAteAno = lancamentos.filter(l => l.data.slice(0, 7) <= periodo);
    const lancDFC    = lancAteAno.filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'));
    const entDFC        = lancDFC.filter(l => l.tipo === 'Entrada').reduce((a,l) => a + l.valor, 0);
    const dedInline     = lancDFC.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a,l) => a + (l.valor - l.valorRecebido), 0);
    const upgradeInline = lancDFC.filter(l => l.tipo === 'Entrada' && l.valorUpgrade > 0).reduce((a,l) => a + l.valorUpgrade, 0);
    const saiDFC        = lancDFC.filter(l => l.tipo === 'Saída').reduce((a,l) => a + l.valor, 0) + dedInline + upgradeInline;
    const caixa         = entDFC - saiDFC;

    const totalAReceber = lancAteAno.filter(l =>
      l.tipo === 'Entrada' && l.status === 'Pendente' && !l.isCMV && !CMVCATS.includes(l.categoria)
    ).reduce((a,l) => a + l.valor, 0);

    const totalFornecPago = lancAteAno.filter(l =>
      l.tipo === 'Saída' && l.categoria === 'Fornecedores (Estoque)' && l.status === 'Confirmado'
    ).reduce((a,l) => a + l.valor, 0);

    const totalCMVRec    = lancAteAno.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a,l) => a + l.valor, 0);
    const estoque        = Math.max(0, totalFornecPago - totalCMVRec);
    const upgradeEstoque = lancAteAno.filter(l => l.tipo === 'Entrada' && l.valorUpgrade > 0).reduce((a,l) => a + l.valorUpgrade, 0);
    const totalAtivo     = Math.max(0, caixa) + totalAReceber + estoque + upgradeEstoque;

    const aPagar           = lancamentos.filter(l => l.tipo === 'Saída' && l.status === 'Pendente' && !l.isCMV && !CMVCATS.includes(l.categoria));
    const totalFornecPagar = aPagar.filter(l => l.categoria === 'Fornecedores (Estoque)').reduce((a,l) => a+l.valor, 0);
    const totalOutrasPagar = aPagar.filter(l => l.categoria !== 'Fornecedores (Estoque)').reduce((a,l) => a+l.valor, 0);
    const totalPassivo     = totalFornecPagar + totalOutrasPagar;
    const pl               = totalAtivo - totalPassivo;
    const endividamento    = totalAtivo > 0 ? (totalPassivo / totalAtivo * 100) : 0;

    return { caixa, totalAReceber, estoque, upgradeEstoque, totalAtivo, totalFornecPago, totalCMVRec, totalFornecPagar, totalOutrasPagar, totalPassivo, pl, endividamento };
  }, [lancamentos, periodo]);

  const { caixa, totalAReceber, estoque, upgradeEstoque, totalAtivo, totalFornecPago, totalCMVRec, totalFornecPagar, totalOutrasPagar, totalPassivo, pl, endividamento } = dados;

  const Linha = ({ label, val, indent = false, neg = false }) => {
    const cor = val === 0 ? 'var(--text2)' : neg ? 'var(--saida)' : val > 0 ? 'var(--entrada)' : 'var(--saida)';
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
        <span style={{ paddingLeft: indent ? 16 : 0, color: indent ? 'var(--text2)' : 'var(--text)' }}>{label}</span>
        <span style={{ color: cor, fontWeight: 600 }}>{fmt(val)}</span>
      </div>
    );
  };

  const LinhaTotal = ({ label, val, final = false }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 4, borderTop: `${final ? 2 : 1}px solid var(--border)`, fontSize: 13, fontWeight: 700 }}>
      <span>{label}</span>
      <span style={{ color: val >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(val)}</span>
    </div>
  );

  const Grupo = ({ label }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, padding: '12px 0 4px', marginTop: 4 }}>{label}</div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="card-label">Total Ativo</div>
            <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(totalAtivo)}</div>
            <div className="card-sub">Recursos totais</div>
          </div>
          <div className="card">
            <div className="card-label">Total Passivo</div>
            <div className="card-value" style={{ color: 'var(--saida)' }}>{fmt(totalPassivo)}</div>
            <div className="card-sub">Obrigações</div>
          </div>
          <div className="card">
            <div className="card-label">Patrimônio Líquido</div>
            <div className="card-value" style={{ color: pl >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(pl)}</div>
            <div className="card-sub">Ativo − Passivo</div>
          </div>
          <div className="card">
            <div className="card-label">Endividamento</div>
            <div className="card-value" style={{ color: endividamento < 50 ? 'var(--entrada)' : endividamento < 80 ? 'var(--warn)' : 'var(--saida)' }}>{fmtPct(endividamento)}</div>
            <div className="card-sub">Passivo / Ativo</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={mes} onChange={e => setMes(e.target.value)}>
            {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </select>
          <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="table-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>ATIVO</h3>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Acumulado até {MESES[parseInt(mes) - 1]}/{ano}</span>
          </div>
          <Grupo label="Ativo Circulante" />
          <Linha label="Caixa e Equivalentes" val={Math.max(0, caixa)} indent />
          <Linha label="Contas a Receber" val={totalAReceber} indent />
          <Linha label="Estoque Estimado" val={estoque} indent />
          <div style={{ fontSize: 11, color: 'var(--text2)', paddingLeft: 16, paddingBottom: 6 }}>
            Fornecedores pagos {fmt(totalFornecPago)} − CMV reconhecido {fmt(totalCMVRec)}
          </div>
          {upgradeEstoque > 0 && <Linha label="Controle de Upgrade" val={upgradeEstoque} indent />}
          {caixa < 0 && <div style={{ fontSize: 11, color: 'var(--warn)', paddingLeft: 16, paddingBottom: 6 }}>⚠ Saldo de caixa negativo: {fmt(caixa)}</div>}
          <LinhaTotal label="TOTAL ATIVO" val={totalAtivo} final />
        </div>

        <div className="table-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>PASSIVO + PL</h3>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Acumulado até {ano}</span>
          </div>
          <Grupo label="Passivo Circulante" />
          <Linha label="Fornecedores a Pagar" val={totalFornecPagar} indent neg />
          <Linha label="Outras Contas a Pagar" val={totalOutrasPagar} indent neg />
          <LinhaTotal label="TOTAL PASSIVO" val={totalPassivo} />
          <Grupo label="Patrimônio Líquido" />
          <Linha label="Resultado Acumulado" val={pl} indent neg={pl < 0} />
          <LinhaTotal label="TOTAL PASSIVO + PL" val={totalAtivo} final />
        </div>
      </div>

      {totalAtivo > 0 && (
        <div className="table-panel" style={{ padding: '16px 20px', marginTop: 0 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Composição do Ativo</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['Caixa', Math.max(0, caixa), '#22c55e'], ['A Receber', totalAReceber, '#f59e0b'], ['Estoque', estoque, '#16a34a'], ['Upgrade', upgradeEstoque, '#8b5cf6']].filter(([, val]) => val > 0).map(([label, val, cor]) => {
              const pct = totalAtivo > 0 ? (val / totalAtivo * 100) : 0;
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text2)' }}>{label}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(val)} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CONTROLE DE UPGRADE ───────────────────────────────────────────────────────
function ControleUpgrade({ lancamentos }) {
  const anoAtual = hoje().slice(0, 4);
  const mesAtual = hoje().slice(5, 7);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState('');

  const upgrades = useMemo(() => {
    return lancamentos
      .filter(l => l.tipo === 'Entrada' && l.valorUpgrade > 0 && l.data.startsWith(ano) && (mes === '' || l.data.startsWith(`${ano}-${mes}`)))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, ano, mes]);

  const totalQtd = upgrades.reduce((a, l) => a + (l.qtdUpgrade || l.quantidade || 1), 0);
  const totalVal = upgrades.reduce((a, l) => a + l.valorUpgrade, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="card-label">Quantidade de Upgrades</div>
            <div className="card-value" style={{ color: 'var(--accent)' }}>{totalQtd} und</div>
            <div className="card-sub">aparelhos recebidos no período</div>
          </div>
          <div className="card">
            <div className="card-label">Total Upgrades (R$)</div>
            <div className="card-value" style={{ color: '#8b5cf6' }}>{fmt(totalVal)}</div>
            <div className="card-sub">valor em estoque dos aparelhos</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={mes} onChange={e => setMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </select>
          <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="table-panel">
        {upgrades.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📦</div>
            <div>Nenhum upgrade registrado no período</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Modelo</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: 'right' }}>Valor da Venda</th>
                  <th style={{ textAlign: 'right' }}>Valor do Upgrade</th>
                  <th style={{ textAlign: 'right' }}>Pago em Dinheiro</th>
                </tr>
              </thead>
              <tbody>
                {upgrades.map(l => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.data.split('-').reverse().join('/')}</td>
                    <td style={{ fontWeight: 600 }}>{l.subcategoria || l.categoria || '—'}</td>
                    <td style={{ color: 'var(--text2)' }}>{l.descricao || '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--entrada)', fontWeight: 700 }}>{fmt(l.valor)}</td>
                    <td style={{ textAlign: 'right', color: '#8b5cf6', fontWeight: 700 }}>{fmt(l.valorUpgrade)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--entrada)', fontWeight: 700 }}>{fmt(l.valor - l.valorUpgrade)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ paddingTop: 8, color: 'var(--text2)' }}>TOTAL — {totalQtd} aparelho{totalQtd !== 1 ? 's' : ''}</td>
                  <td style={{ textAlign: 'right', paddingTop: 8, color: '#8b5cf6' }}>{fmt(totalVal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PROJEÇÃO ──────────────────────────────────────────────────────────────────
function Projecao({ lancamentos, clienteAtivo, metasCache, setMetasCache }) {
  const hj     = hoje();
  const anoN   = parseInt(hj.slice(0, 4));
  const mesN   = parseInt(hj.slice(5, 7));
  const pfx    = hj.slice(0, 7);
  const nomeMes = MESES_FULL[mesN - 1];

  const [editando, setEditando] = useState(null);
  const [metaValor, setMetaValor] = useState('');

  const getMeta = (campo) => metasCache[pfx]?.[campo] || 0;

  async function salvarMeta() {
    const v  = parseFloat(metaValor) || 0;
    const campo = editando.campo;
    setMetasCache(prev => ({ ...prev, [pfx]: { ...(prev[pfx] || {}), [campo]: v } }));
    try { await API.salvarMeta(clienteAtivo.id, { mes_chave: pfx, campo, valor: v }); } catch(e) { console.error(e); }
    setEditando(null);
  }

  const proj = useMemo(() => {
    const lm  = lancamentos.filter(l => l.data.startsWith(pfx));
    const fat = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a,l) => a+l.valor, 0);
    const cmv = lancamentos.filter(l => l.data.startsWith(pfx) && (l.isCMV || CMVCATS.includes(l.categoria))).reduce((a,l) => a+l.valor, 0);
    const sga = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a,l) => a+l.valor, 0);
    const naoOp = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a,l) => a+l.valor, 0);
    const lucroLiq = fat - cmv - sga - naoOp;

    const diasNoMes  = new Date(anoN, mesN, 0).getDate();
    const hoje_d     = new Date();
    const diaAtual   = (hoje_d.getFullYear() === anoN && hoje_d.getMonth() + 1 === mesN) ? hoje_d.getDate() : diasNoMes;
    const diasPassados  = Math.max(1, diaAtual);
    const diasRestantes = diasNoMes - diasPassados;

    const vendas = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV);
    const uni    = vendas.reduce((a,l) => a + (l.quantidade || 1), 0);
    const ticket = uni > 0 ? fat / uni : 0;

    const ritmo      = diasPassados > 0 ? fat / diasPassados : 0;
    const projFat    = fat + ritmo * diasRestantes;
    const projLucro  = projFat > 0 && fat > 0 ? projFat * (lucroLiq / fat) : 0;
    const projUni    = uni > 0 ? Math.round(uni / diasPassados * diasNoMes) : 0;
    const projTicket = projUni > 0 ? projFat / projUni : ticket;

    return { fat, lucroLiq, uni, ticket, diasNoMes, diasPassados, diasRestantes, projFat, projLucro, projUni, projTicket, ritmo };
  }, [lancamentos, pfx, anoN, mesN]);

  const MetricCard = ({ titulo, campo, atual, proj: projVal, cor, isMoney = true }) => {
    const meta = getMeta(campo);
    const ref  = meta || projVal || 1;
    const pAt  = Math.min(100, ref > 0 ? (atual / ref * 100) : 0);
    const pPr  = Math.min(100, ref > 0 ? (projVal / ref * 100) : 0);
    const barCor = projVal >= (meta || projVal) ? '#22c55e' : projVal >= (meta || projVal) * 0.8 ? '#f59e0b' : '#f03e3e';
    const fmtV = (v) => isMoney ? fmt(v) : Math.round(v).toString();

    return (
      <div className="table-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5 }}>{titulo}</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditando({ campo, titulo }); setMetaValor(meta || ''); }}>✏️ Meta</button>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: cor }}>{fmtV(atual)}</div>
        <div style={{ position: 'relative', height: 14, background: 'var(--surface2)', borderRadius: 7, overflow: 'hidden', margin: '10px 0 4px' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pPr}%`, background: `${barCor}44`, borderRadius: 7 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pAt}%`, background: barCor, borderRadius: 7 }} />
          {meta > 0 && <div style={{ position: 'absolute', right: 0, top: 0, width: 2, height: '100%', background: 'var(--text)', opacity: .4 }} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)' }}>
          <span>Atual: <strong style={{ color: barCor }}>{fmtV(atual)}</strong></span>
          <span>Projeção: <strong style={{ color: barCor }}>{fmtV(projVal)}</strong></span>
          {meta > 0 && <span>Meta: <strong style={{ color: 'var(--text)' }}>{fmtV(meta)}</strong></span>}
        </div>
      </div>
    );
  };

  const ritmoCor = proj.projFat >= (getMeta('meta_fat') || proj.projFat) ? '#22c55e' : proj.projFat >= (getMeta('meta_fat') || proj.projFat) * 0.8 ? '#f59e0b' : '#f03e3e';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="table-panel" style={{ padding: '16px 20px', borderLeft: `4px solid ${ritmoCor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Projeção de Fechamento</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{nomeMes} {anoN}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{proj.diasPassados} dias passados · {proj.diasRestantes} restantes</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ritmoCor }}>Ritmo: {fmt(proj.ritmo)}/dia</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <MetricCard titulo="Faturamento"       campo="meta_fat"    atual={proj.fat}      proj={proj.projFat}    cor="#22c55e" />
        <MetricCard titulo="Lucro Líquido"     campo="meta_lucro"  atual={proj.lucroLiq} proj={proj.projLucro}  cor={proj.lucroLiq >= 0 ? '#3b82f6' : '#f03e3e'} />
        <MetricCard titulo="Unidades Vendidas" campo="meta_uni"    atual={proj.uni}      proj={proj.projUni}    cor="#f59e0b" isMoney={false} />
        <MetricCard titulo="Ticket Médio"      campo="meta_ticket" atual={proj.ticket}   proj={proj.projTicket} cor="#8b5cf6" />
      </div>

      {editando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Meta — {editando.titulo}</h3>
              <button className="modal-close" onClick={() => setEditando(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Valor da Meta</label>
                <input type="number" step="0.01" placeholder="0,00" value={metaValor} onChange={e => setMetaValor(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && salvarMeta()} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarMeta}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PÁGINA FINANCEIRO ─────────────────────────────────────────────────────────
export default function Financeiro() {
  const { lancamentos, clienteAtivo, metasCache, setMetasCache } = useApp();
  const [aba, setAba] = useState('dre');

  return (
    <div className="financeiro-page">
      <div className="abas">
        <button className={`aba-btn ${aba === 'dre'    ? 'active' : ''}`} onClick={() => setAba('dre')}>DRE</button>
        <button className={`aba-btn ${aba === 'fluxo'  ? 'active' : ''}`} onClick={() => setAba('fluxo')}>Fluxo de Caixa</button>
        <button className={`aba-btn ${aba === 'balanco' ? 'active' : ''}`} onClick={() => setAba('balanco')}>Balanço Patrimonial</button>
        <button className={`aba-btn ${aba === 'upgrade' ? 'active' : ''}`} onClick={() => setAba('upgrade')}>Controle de Upgrade</button>
        <button className={`aba-btn ${aba === 'proj'    ? 'active' : ''}`} onClick={() => setAba('proj')}>Projeção</button>
      </div>

      {aba === 'dre'     && <DRE     lancamentos={lancamentos} clienteAtivo={clienteAtivo} metasCache={metasCache} setMetasCache={setMetasCache} />}
      {aba === 'fluxo'   && <FluxoCaixa lancamentos={lancamentos} clienteAtivo={clienteAtivo} />}
      {aba === 'balanco'  && <Balanco lancamentos={lancamentos} />}
      {aba === 'upgrade'  && <ControleUpgrade lancamentos={lancamentos} />}
      {aba === 'proj'     && <Projecao lancamentos={lancamentos} clienteAtivo={clienteAtivo} metasCache={metasCache} setMetasCache={setMetasCache} />}
    </div>
  );
}
