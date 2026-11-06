import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Icone from '../components/Icone';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { CMVCATS, SGA_CATS, NAOOP_CATS, getSubcats } from '../services/constants';
import { calcDREBase } from '../services/dre';
import { fmt, fmtPct, hoje, MESES, MESES_FULL, upgradeNoCaixa } from '../services/utils';
import ImportarPatrimonio, { OrigemPatrimonio } from '../components/ImportarPatrimonio';
import SaldoContas from '../components/SaldoContas';
import { caixaNoDia1, proximoMes } from '../services/caixa';
import { competenciaDe, abertaNoFimDe, fimDoMes } from '../services/competencia';
import './Financeiro.css';

// ── DRE CALCULATION ──────────────────────────────────────────────────────────
// ── DRE ──────────────────────────────────────────────────────────────────────
// Abre a tabela com o mês selecionado como última coluna visível, mostrando os meses anteriores ao lado
function useRolarParaMes(mesFiltro, ano, dados) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const th = el?.querySelector(`th[data-mes="${mesFiltro}"]`);
    if (!th) return;
    const fim = th.getBoundingClientRect().right - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollLeft = Math.max(0, fim - el.clientWidth + 8);
  }, [mesFiltro, ano, dados]);
  return ref;
}

function TituloComSetas({ titulo, scrollRef }) {
  const rolar = dir => {
    const el = scrollRef.current;
    const col = el?.querySelector('th[data-mes]')?.offsetWidth || 100;
    el?.scrollBy({ left: dir * col * 3, behavior: 'smooth' });
  };
  return (
    <div className="dre-titulo">
      <span>{titulo}</span>
      <span className="dre-setas">
        <button type="button" onClick={() => rolar(-1)} aria-label="Meses anteriores" title="Meses anteriores">‹</button>
        <button type="button" onClick={() => rolar(1)} aria-label="Próximos meses" title="Próximos meses">›</button>
      </span>
    </div>
  );
}

const QUARTERS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];

function DRE({ lancamentos, clienteAtivo, metasCache, setMetasCache, mesFiltro, setMesFiltro, ano, setAno }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);


  const [expandedRows, setExpanded] = useState(new Set());
  const [mostrarAH, setMostrarAH]   = useState(false);
  const [visao, setVisao]           = useState(() => Math.floor(mesFiltro / 3)); // 0 a 3 = Q1 a Q4, ou 'ano'
  useEffect(() => { setVisao(v => (v === 'ano' ? v : Math.floor(mesFiltro / 3))); }, [mesFiltro]);
  const colunas = useMemo(() => (visao === 'ano'
    ? QUARTERS.map((meses, q) => ({ rotulo: `Q${q + 1}`, meses }))
    : QUARTERS[visao].map(i => ({ rotulo: MESES[i], meses: [i] }))), [visao]);
  const ultimoMesComDados = ano < anoAtual ? 11 : ano > anoAtual ? -1 : Number(hoje().slice(5, 7)) - 1;

  // Análise Horizontal: variação contra o mês anterior. Em linhas de custo (neg), subir é ruim.
  const AH = ({ vals, i, neg }) => {
    if (!mostrarAH || i === 0 || colunas[i].meses[0] > ultimoMesComDados) return null;
    const ant = vals[i - 1], atual = vals[i];
    if (!ant) return null;
    const pct = (atual - ant) / Math.abs(ant) * 100;
    const bom = neg ? pct < 0 : pct > 0;
    const cor = Math.abs(pct) < 0.05 ? 'var(--text2)' : bom ? 'var(--entrada)' : 'var(--saida)';
    const seta = pct > 0 ? '▲' : pct < 0 ? '▼' : '';
    return (
      <div className="ah-var" style={{ color: cor }}>
        {seta} {Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </div>
    );
  };

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
    const mk       = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`;
    const v        = parseFloat(valor) || 0;
    const anterior = metasCache;
    setMetasCache(mc => ({ ...mc, [mk]: { ...(mc[mk] || {}), [campo]: v } }));
    try {
      await API.salvarMeta(clienteAtivo.id, { mes_chave: mk, campo, valor: v });
    } catch(e) {
      console.error(e);
      setMetasCache(anterior);
    }
  }

  // Mesma conta para um mês ou vários: as margens saem do período inteiro, não da soma dos percentuais
  const resultado = useCallback(meses => {
    const prefixos = meses.map(i => `${ano}-${String(i + 1).padStart(2, '0')}`);
    const base = calcDREBase(lancamentos.filter(l => prefixos.some(p => l.data.startsWith(p))));
    const dep  = meses.reduce((a, i) => a + getManual(i, 'depreciacao'), 0);
    const irpj = meses.reduce((a, i) => a + getManual(i, 'irpj'), 0);
    const lair = base.ebitda + base.resFin - dep;
    const lucroLiq = lair - irpj;
    const margLiq  = base.recBruta > 0 ? (lucroLiq / base.recBruta * 100) : null;
    return { ...base, dep, irpj, lair, lucroLiq, margLiq };
  }, [lancamentos, ano, getManual]);

  const mv = useMemo(() => MESES.map((_, i) => resultado([i])), [resultado]);
  const cv = useMemo(() => colunas.map(c => resultado(c.meses)), [colunas, resultado]);
  const tv = useMemo(() => resultado(colunas.flatMap(c => c.meses)), [colunas, resultado]);

  const S = (k) => tv[k] || 0;
  const tRecBruta   = S('recBruta'),    tLucroBruto   = S('lucroBruto');
  const tSga         = S('sga'),         tEbitda       = S('ebitda');
  const tLucroLiq    = S('lucroLiq'),    tRecLiq       = S('recLiquida');
  const tCmv         = S('cmvTotal'),    tResFin       = S('resFin');
  const tLair        = S('lair');
  const tContribuicao = S('contribuicao');
  const tCustosVarInd = S('custosVarInd');

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
      {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{neg ? dn(v) : d(v)}<AH vals={vals} i={i} neg={neg} /></td>)}
      <td style={{ textAlign: 'right' }}>{neg ? dn(tot) : d(tot)}</td>
    </tr>
  );

  const RowMed = ({ label, vals, tot, neg = false }) => {
    if (!vals.some(v => v !== 0) && tot === 0) return null;
    return (
      <tr className="row-med">
        <td style={{ paddingLeft: 20 }}>{label}</td>
        {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{neg ? dn(v) : d(v)}<AH vals={vals} i={i} neg={neg} /></td>)}
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
      const subVals = colunas.map(({ meses }) => {
        const prefixos = meses.map(i => `${ano}-${String(i + 1).padStart(2, '0')}`);
        const lm  = lancamentos.filter(l => prefixos.some(p => l.data.startsWith(p)) && l.categoria === cat && l.subcategoria === sub);
        if (tipo === 'Entrada') return lm.filter(l => l.tipo === 'Entrada').reduce((a,l) => a+l.valor, 0);
        if (tipo === 'Saída')   return lm.filter(l => l.tipo === 'Saída').reduce((a,l) => a+l.valor, 0);
        return lm.reduce((a,l) => a+l.valor, 0);
      });
      const subTot = subVals.reduce((a,b) => a+b, 0);
      if (!subVals.some(v => v !== 0) && subTot === 0) return [];
      return [(
        <tr key={sub} className="row-sub">
          <td style={{ paddingLeft: 36, fontSize: 11, color: 'var(--text2)', borderLeft: '2px solid color-mix(in srgb, var(--entrada) 20%, transparent)' }}>{sub}</td>
          {subVals.map((v, i) => <td key={i} style={{ textAlign: 'right', fontSize: 11 }}>{fn(v)}<AH vals={subVals} i={i} neg={neg} /></td>)}
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
          {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{fn(v)}<AH vals={vals} i={i} neg={neg} /></td>)}
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

  // Só se digita mês a mês: na visão por ano o trimestre mostra a soma
  const RowEdit = ({ label, campo, chave }) => (
    <tr className="row-med">
      <td style={{ paddingLeft: 20, color: 'var(--text2)' }}>{label}</td>
      {colunas.map(({ meses }, c) => (
        <td key={c} style={{ textAlign: 'right' }}>
          {meses.length === 1 ? (
            <input
              key={`${ano}-${campo}-${meses[0]}`}
              type="number"
              defaultValue={getManual(meses[0], campo) || ''}
              placeholder="—"
              min="0" step="0.01"
              className="dre-input"
              onBlur={e => salvarManual(meses[0], campo, e.target.value)}
            />
          ) : dn(cv[c][chave])}
        </td>
      ))}
      <td style={{ textAlign: 'right' }}>{dn(S(chave))}</td>
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
        <div className="dre-period-select" style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="period-select" value={ano} onChange={e => { setAno(e.target.value); setExpanded(new Set()); }}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
          <button
            type="button"
            className={`ah-toggle ${mostrarAH ? 'ativo' : ''}`}
            onClick={() => setMostrarAH(v => !v)}
            aria-pressed={mostrarAH}
            title="Análise Horizontal: variação de cada linha em relação à coluna anterior"
          >
            AH %
          </button>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-header">
          <h2>DRE — Resultado do Exercício</h2>
          <div className="dre-visoes" role="group" aria-label="Período da tabela">
            {QUARTERS.map((meses, q) => (
              <button key={q} type="button" className={visao === q ? 'ativo' : ''} aria-pressed={visao === q} title={`${MESES[meses[0]]} a ${MESES[meses[2]]}`} onClick={() => setVisao(q)}>Q{q + 1}</button>
            ))}
            <button type="button" className={visao === 'ano' ? 'ativo' : ''} aria-pressed={visao === 'ano'} title="Os quatro trimestres do ano" onClick={() => setVisao('ano')}>Ano</button>
          </div>
        </div>
        <div className="dre-scroll">
          <table className="dre-table">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>Conta</th>
                {colunas.map(c => <th key={c.rotulo} className={c.meses.includes(mesFiltro) ? 'mes-ativo' : ''} style={{ textAlign: 'right', minWidth: 110 }}>{c.rotulo}</th>)}
                <th style={{ textAlign: 'right', minWidth: 120 }}>{visao === 'ano' ? 'TOTAL' : `TOTAL Q${visao + 1}`}</th>
              </tr>
            </thead>
            <tbody>
              <RowBig label="RECEITA BRUTA" vals={cv.map(v => v.recBruta)} tot={tRecBruta} />
              <RowExp label="(+) Aparelhos"           cat="Aparelhos"           vals={cv.map(v => v.aparelhos)}   tot={S('aparelhos')}   tipo="Entrada" />
              <RowExp label="(+) Acessórios"          cat="Acessórios"          vals={cv.map(v => v.acessorios)}  tot={S('acessorios')}  tipo="Entrada" />
              <RowExp label="(+) Assistência Técnica" cat="Assistência Técnica" vals={cv.map(v => v.assistencia)} tot={S('assistencia')} tipo="Entrada" />
              <RowExp label="(+) Outros Produtos"     cat="Outros Produtos"     vals={cv.map(v => v.outrosProd)}  tot={S('outrosProd')}  tipo="Entrada" />
              <RowExp label="(+) Receitas Não-Operacionais" cat="Receitas Não-Operacionais" vals={cv.map(v => v.recNaoOp)} tot={S('recNaoOp')} tipo="Entrada" />
              <RowExp label="(-) Deduções das Vendas" cat="Deduções das Vendas" vals={cv.map(v => v.deducoes)} tot={S('deducoes')} neg />
              <RowBig label="(=) RECEITA LÍQUIDA" vals={cv.map(v => v.recLiquida)} tot={tRecLiq} />
              <RowBig label="(-) CMV — Custo de Mercadoria Vendida" vals={cv.map(v => v.cmvTotal)} tot={tCmv} neg />
              <RowExp label="(-) Custos Variáveis Diretos" cat="Custos Variáveis Diretos" vals={cv.map(v => v.cmvDir)} tot={S('cmvDir')} neg tipo={null} />
              <RowBig label="(=) LUCRO BRUTO" vals={cv.map(v => v.lucroBruto)} tot={tLucroBruto} />
              <RowExp label="(-) Custos Variáveis Indiretos" cat="Custos Variáveis Indiretos" vals={cv.map(v => v.custosVarInd)} tot={tCustosVarInd} neg />
              <RowBig label="(=) MARGEM DE CONTRIBUIÇÃO" vals={cv.map(v => v.contribuicao)} tot={tContribuicao} />
              <RowPct label="Margem de Contribuição (%)" vals={cv.map(v => v.margContrib)} tot={tRecBruta > 0 ? tContribuicao / tRecBruta * 100 : null} />
              <tr className="row-pct">
                <td style={{ paddingLeft: 8, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>Ponto de Equilíbrio</td>
                {cv.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{v.pontoEq !== null ? d(v.pontoEq) : <span style={{ color: 'var(--text2)' }}>—</span>}</td>)}
                <td style={{ textAlign: 'right' }}>{tContribuicao > 0 && tRecBruta > 0 ? d(tSga / (tContribuicao / tRecBruta)) : <span style={{ color: 'var(--text2)' }}>—</span>}</td>
              </tr>
              <RowBig label="(-) Despesas SG&A" vals={cv.map(v => v.sga)} tot={tSga} neg />
              <RowExp label="(-) Despesas com Ocupação"   cat="Despesas com Ocupação"   vals={cv.map(v => v.ocupacao)}  tot={S('ocupacao')}  neg />
              <RowExp label="(-) Despesas com Pessoal"    cat="Despesas com Pessoal"    vals={cv.map(v => v.pessoal)}   tot={S('pessoal')}   neg />
              <RowExp label="(-) Despesas Variáveis"      cat="Despesas Variáveis"      vals={cv.map(v => v.variaveis)} tot={S('variaveis')} neg />
              <RowExp label="(-) Marketing"              cat="Marketing"              vals={cv.map(v => v.marketing)} tot={S('marketing')} neg />
              <RowExp label="(-) Softwares / Tecnologias" cat="Softwares / Tecnologias" vals={cv.map(v => v.softwares)} tot={S('softwares')} neg />
              <RowExp label="(-) Serviços Terceirizados"  cat="Serviços Terceirizados"  vals={cv.map(v => v.terceiros)} tot={S('terceiros')} neg />
              <RowExp label="(-) Impostos"              cat="Impostos"              vals={cv.map(v => v.impostos)} tot={S('impostos')} neg />
              <RowBig label="(=) LUCRO OPERACIONAL (EBITDA)" vals={cv.map(v => v.ebitda)} tot={tEbitda} />
              <RowPct label="Margem EBITDA (%)" vals={cv.map(v => v.margEbitda)} tot={tRecBruta > 0 ? tEbitda / tRecBruta * 100 : null} />
              <RowMed label="(=) Resultado Financeiro" vals={cv.map(v => v.resFin)} tot={tResFin} />
              <RowMed label="(+) Receitas Financeiras [Aplic. fora da Cia]" vals={cv.map(v => v.recFin)} tot={S('recFin')} />
              <RowExp label="(-) Despesas Financeiras [Juros/Empréstimos]" cat="Dívidas / Empréstimos"    vals={cv.map(v => v.despJuros)} tot={S('despJuros')} neg />
              <RowExp label="(-) Despesas Não-Operacionais"                cat="Saídas Não-Operacionais" vals={cv.map(v => v.despNaoOp)} tot={S('despNaoOp')} neg />
              <RowEdit label="(-) Depreciação" campo="depreciacao" chave="dep" />
              <RowBig label="(=) LUCRO ANTES DO IR (LAIR)" vals={cv.map(v => v.lair)} tot={tLair} />
              <RowEdit label="(-) Imposto sobre Lucro (IRPJ)" campo="irpj" chave="irpj" />
              <RowBig label="(=) LUCRO LÍQUIDO" vals={cv.map(v => v.lucroLiq)} tot={tLucroLiq} final />
              <RowPct label="Margem Líquida (%)" vals={cv.map(v => v.margLiq)} tot={tRecBruta > 0 ? tLucroLiq / tRecBruta * 100 : null} />
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
      { label: 'APORTES E TRANSFERÊNCIAS',  cats: ['Aportes e Transferências'] },
    ],
  },
  {
    sep: 'SAÍDAS',
    grupos: [
      { label: 'SAÍDAS OPERACIONAIS', cats: ['Fornecedores (Estoque)','Deduções das Vendas','Custos Variáveis Diretos','Custos Variáveis Indiretos','Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Marketing','Softwares / Tecnologias','Serviços Terceirizados','Impostos'] },
      { label: 'SAÍDAS NÃO-OPERACIONAIS', cats: ['Saídas Não-Operacionais','Dívidas / Empréstimos'] },
      { label: 'INVESTIMENTOS', cats: ['Investimentos'] },
    ],
  },
];

function FluxoCaixa({ lancamentos, clienteAtivo, mesFiltro, setMesFiltro, ano, setAno }) {
  const scrollRef = useRolarParaMes(mesFiltro, ano, lancamentos);
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);


  // Saldo das contas no dia 1 de cada mês informado: [{ mes, total }]
  const [totaisContas, setTotaisContas] = useState([]);
  const [modalSaldo, setModalSaldo]     = useState(false);

  useEffect(() => {
    if (!clienteAtivo || modalSaldo) return;   // recarrega ao fechar a janela do saldo
    API.fechamentoTotais(clienteAtivo.id)
      .then(r => setTotaisContas(r || []))
      .catch(() => setTotaisContas([]));
  }, [clienteAtivo, modalSaldo]);

  const lancDFC = useMemo(() =>
    lancamentos.filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente')),
    [lancamentos]
  );

  const mv = useMemo(() =>
    MESES.map((_, i) => {
      const pfx       = `${ano}-${String(i + 1).padStart(2, '0')}`;
      const lm        = lancDFC.filter(l => l.data.startsWith(pfx));
      const entBruto     = lm.filter(l => l.tipo === 'Entrada').reduce((a,l) => a + l.valor, 0);
      const dedInline    = lm.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a,l) => a + (l.valor - l.valorRecebido), 0);
      const upgradeInline = lm.reduce((a,l) => a + upgradeNoCaixa(l), 0);
      const ent          = entBruto - upgradeInline;
      const sai          = lm.filter(l => l.tipo === 'Saída').reduce((a,l) => a + l.valor, 0) + dedInline;
      const catVal    = (cat) => {
        if (cat === 'Permuta - Upgrade') return 0;
        const base = lm.filter(l => l.categoria === cat).reduce((a, l) => {
          const val = (l.tipo === 'Entrada' && (l.valorUpgrade || 0) > 0)
            ? l.valor - upgradeNoCaixa(l)
            : l.valor;
          return a + val;
        }, 0);
        return cat === 'Deduções das Vendas' ? base + dedInline : base;
      };
      const subVal = (cat, sub) => lm.filter(l => l.categoria === cat && l.subcategoria === sub).reduce((a, l) => {
        const val = l.valor - upgradeNoCaixa(l);
        return a + val;
      }, 0);
      return { ent, sai, saldo: ent - sai, catVal, subVal };
    }),
    [lancDFC, lancamentos, ano]
  );

  const d = (v, cor) => v === 0
    ? <span style={{ color: 'var(--text2)' }}>—</span>
    : <span style={{ color: cor || (v >= 0 ? 'var(--entrada)' : 'var(--saida)'), fontWeight: 600 }}>{fmt(v)}</span>;

  const totEnt = mv.reduce((a,m) => a+m.ent, 0);
  const totSai = mv.reduce((a,m) => a+m.sai, 0);
  const totSaldo = totEnt - totSai;

  // Evolução do caixa a partir do primeiro saldo das contas informado (dia 1 do mês).
  // Início = saldo informado no dia 1 (ou o calculado desde o último informado); Final pelo sistema = Início + Saldo do mês;
  // Saldo real = contas no dia 1 do mês seguinte; Diferença = real − sistema (dinheiro que os lançamentos não explicam).
  const evolucao = useMemo(() => {
    const mesAtual = hoje().slice(0, 7);
    const informado = Object.fromEntries(totaisContas.map(t => [t.mes, t.total]));
    return mv.map((m, i) => {
      const ym = `${ano}-${String(i + 1).padStart(2, '0')}`;
      if (ym > mesAtual) return null;
      const base = caixaNoDia1(lancamentos, totaisContas, ym);
      if (!base) return null;
      const fim  = base.valor + m.saldo;
      const real = informado[proximoMes(ym)] ?? null;
      return { ini: base.valor, informado: base.informado, fim, real, dif: real == null ? null : real - fim };
    });
  }, [mv, totaisContas, lancamentos, ano]);
  const evoValidas = evolucao.filter(Boolean);
  const evoIni     = evoValidas[0]?.ini;
  const evoUltima  = evoValidas[evoValidas.length - 1];
  const evoReal    = [...evoValidas].reverse().find(e => e.real != null)?.real;
  const evoDifTot  = evoValidas.some(e => e.dif != null) ? evoValidas.reduce((a, e) => a + (e.dif || 0), 0) : null;
  const evoMes     = evolucao[mesFiltro];
  const s = v => v == null ? <span style={{ color: 'var(--text2)' }}>—</span> : d(v);


  return (
    <div>
      <div className="dfc-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          {evoMes && (
            <div className="card">
              <div className="card-label">Saldo nas contas — início de {MESES[mesFiltro]}</div>
              <div className="card-value" style={{ color: 'var(--accent)' }}>{fmt(evoMes.ini)}</div>
              <div className="card-sub">{evoMes.informado ? 'Informado em Saldo das contas' : 'Calculado pelo sistema'}</div>
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
            <div className="card-label">Saldo do Mês — {MESES[mesFiltro]}</div>
            <div className="card-value" style={{ color: (mv[mesFiltro]?.saldo ?? 0) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
              {fmt(mv[mesFiltro]?.saldo ?? 0)}
            </div>
          </div>
          {evoMes && (
            <div className="card">
              <div className="card-label">Saldo final — {MESES[mesFiltro]}</div>
              <div className="card-value" style={{ color: 'var(--accent)' }}>{fmt(evoMes.real ?? evoMes.fim)}</div>
              <div className="card-sub" style={evoMes.dif != null && Math.abs(evoMes.dif) > Math.max(50, (mv[mesFiltro]?.ent || 0) * 0.01) ? { color: 'var(--saida)' } : undefined}>
                {evoMes.dif == null ? 'Pelo sistema (saldo do dia 1 seguinte não informado)'
                  : Math.abs(evoMes.dif) <= Math.max(50, (mv[mesFiltro]?.ent || 0) * 0.01) ? 'Real das contas · bate com o sistema'
                  : `Real das contas · ${evoMes.dif > 0 ? 'sobrou' : 'faltou'} ${fmt(Math.abs(evoMes.dif))}`}
              </div>
            </div>
          )}
        </div>
        <div className="dfc-controls" style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setModalSaldo(true)} title="Saldo de cada conta no início e no fim do mês">Saldo das contas</button>
        </div>
      </div>

      <div className="table-panel">
        <div className="dre-scroll" ref={scrollRef}>
          <table className="dre-table">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}><TituloComSetas titulo="Fluxo de Caixa" scrollRef={scrollRef} /></th>
                {MESES.map((m, i) => <th key={m} data-mes={i} className={i === mesFiltro ? 'mes-ativo' : ''} style={{ textAlign: 'right', minWidth: 90 }}>{m}</th>)}
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
                    <td>{sep}</td><td colSpan={13} />
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
                                    <td style={{ paddingLeft: 36, fontSize: 11, color: 'var(--text2)', borderLeft: '2px solid color-mix(in srgb, var(--entrada) 13%, transparent)' }}>{sub}</td>
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
              <tr className="row-sep">
                <td>EVOLUÇÃO DO CAIXA</td><td colSpan={13} />
              </tr>
              {!evoValidas.length ? (
                <tr>
                  <td colSpan={14} style={{ color: 'var(--text2)', fontSize: 12 }}>
                    Informe quanto a loja tem em cada conta no início do mês (botão “Saldo das contas”) para acompanhar o caixa.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="row-big">
                    <td>SALDO INICIAL (CONTAS)</td>
                    {evolucao.map((e, i) => <td key={i} style={{ textAlign: 'right' }}>{s(e?.ini)}</td>)}
                    <td style={{ textAlign: 'right' }}>{s(evoIni)}</td>
                  </tr>
                  <tr className="row-med">
                    <td style={{ paddingLeft: 20, color: 'var(--text2)' }}>Saldo final pelo sistema</td>
                    {evolucao.map((e, i) => <td key={i} style={{ textAlign: 'right', color: 'var(--text2)' }}>{e ? fmt(e.fim) : '—'}</td>)}
                    <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{evoUltima ? fmt(evoUltima.fim) : '—'}</td>
                  </tr>
                  <tr className="row-final">
                    <td>SALDO REAL NAS CONTAS</td>
                    {evolucao.map((e, i) => <td key={i} style={{ textAlign: 'right' }}>{s(e?.real)}</td>)}
                    <td style={{ textAlign: 'right' }}>{s(evoReal)}</td>
                  </tr>
                  <tr className="row-med">
                    <td style={{ paddingLeft: 20, color: 'var(--text2)' }} title="Saldo real − saldo pelo sistema. Positivo: entrou dinheiro sem lançamento. Negativo: saiu dinheiro sem lançamento.">Diferença (real − sistema)</td>
                    {evolucao.map((e, i) => <td key={i} style={{ textAlign: 'right' }}>{s(e?.dif)}</td>)}
                    <td style={{ textAlign: 'right' }}>{s(evoDifTot)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalSaldo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSaldo(false)}>
          <div className="modal-box fech-modal" role="dialog" aria-label="Saldo das contas">
            <div className="modal-header">
              <h3>Saldo das contas</h3>
              <button className="modal-close" onClick={() => setModalSaldo(false)} aria-label="Fechar">✕</button>
            </div>
            <div className="modal-body">
              <SaldoContas lancamentos={lancamentos} clienteAtivo={clienteAtivo} mesFiltro={mesFiltro} setMesFiltro={setMesFiltro} ano={ano} setAno={setAno} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BALANÇO PATRIMONIAL ───────────────────────────────────────────────────────
// Foto do último dia do mês escolhido. O Ativo vem dos Recursos em Capital (caixa, estoque do Mercado Phone,
// reserva), das contas a receber e dos investimentos lançados. O Passivo vem da Gestão de Contas por
// competência: entra o que pertence ao mês ou antes e ainda estava em aberto no fim do mês.
const CAPITAL_CAMPOS = [
  { campo: 'cap_caixa',               label: 'Capital líquido em caixa' },
  { campo: 'cap_estoque_aparelhos',   label: 'Capital em estoque — aparelhos' },
  { campo: 'cap_estoque_acessorios',  label: 'Capital em estoque — acessórios' },
  { campo: 'cap_manutencao',          label: 'Aparelhos em manutenção' },
  { campo: 'cap_reserva',             label: 'Reserva de emergência' },
  { campo: 'cap_receber',             label: 'Outros valores a receber' },
  { campo: 'cap_imobilizado',         label: 'Bens anteriores ao sistema (imobilizado)' },
];

// Grupo do Passivo de cada categoria de conta a pagar
const GRUPO_PASSIVO = {
  'Fornecedores (Estoque)':     'Fornecedores',
  'Custos Variáveis Diretos':   'Fornecedores',
  'Despesas com Pessoal':       'Salários e encargos',
  'Impostos':                   'Impostos',
  'Despesas com Ocupação':      'Aluguel e contas da loja',
  'Serviços Terceirizados':     'Serviços e sistemas',
  'Softwares / Tecnologias':    'Serviços e sistemas',
};
const ORDEM_PASSIVO = ['Fornecedores', 'Salários e encargos', 'Impostos', 'Aluguel e contas da loja', 'Serviços e sistemas', 'Outras contas a pagar'];

const somaMeses = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const valorConta = c => parseFloat(c.valor || 0);

function Balanco({ lancamentos, clienteAtivo, mesFiltro, setMesFiltro, ano, setAno }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const mes = String(mesFiltro + 1).padStart(2, '0');
  const [capitalCache, setCapitalCache] = useState({});
  const [modalCapital, setModalCapital] = useState(false);
  const [capitalForm, setCapitalForm] = useState({});
  const [salvandoCap, setSalvandoCap] = useState(false);
  const [contas, setContas]       = useState([]);
  const [aberta, setAberta]       = useState(null); // linha com o detalhe aberto

  const periodo = `${ano}-${mes}`;

  useEffect(() => {
    if (!clienteAtivo?.id) return;
    API.listarContas(clienteAtivo.id).then(setContas).catch(() => {});
  }, [clienteAtivo]);

  // Caixa no fim do mês = saldo das contas no dia 1 do mês seguinte (informado ou calculado pelo sistema)
  const [totaisContas, setTotaisContas] = useState([]);
  useEffect(() => {
    if (!clienteAtivo?.id) return;
    API.fechamentoTotais(clienteAtivo.id).then(r => setTotaisContas(r || [])).catch(() => setTotaisContas([]));
  }, [clienteAtivo]);
  const caixaContas = useMemo(() => caixaNoDia1(lancamentos, totaisContas, proximoMes(periodo)), [lancamentos, totaisContas, periodo]);

  useEffect(() => {
    if (!clienteAtivo?.id || capitalCache[periodo] !== undefined) return;
    API.buscarCapital(clienteAtivo.id, periodo)
      .then(d => setCapitalCache(prev => ({ ...prev, [periodo]: d })))
      .catch(() => setCapitalCache(prev => ({ ...prev, [periodo]: {} })));
  }, [clienteAtivo, periodo]);

  const capital = capitalCache[periodo] || {};
  const getCapital = (campo) => capital[campo] || 0;

  // null · 'escolha' (card de origem) · 'mp' (API do Mercado Phone) · 'arquivo' (planilha em arquivoImport)
  const [importando, setImportando] = useState(null);
  const [arquivoImport, setArquivoImport] = useState(null);
  const [importInfo, setImportInfo] = useState(null);
  useEffect(() => {
    if (!clienteAtivo?.id) return;
    setImportInfo(null);
    API.patrimonioResumo(clienteAtivo.id, periodo).then(setImportInfo).catch(() => {});
  }, [clienteAtivo, periodo]);

  function patrimonioSalvo(novoCapital, itens) {
    setCapitalCache(prev => ({ ...prev, [periodo]: { ...(prev[periodo] || {}), ...novoCapital } }));
    setImportInfo({ itens, importado_em: new Date().toISOString() });
    setImportando(null);
    setArquivoImport(null);
  }

  function abrirModalCapital() {
    const form = {};
    CAPITAL_CAMPOS.forEach(({ campo }) => { form[campo] = capital[campo] != null ? String(capital[campo]) : ''; });
    setCapitalForm(form);
    setModalCapital(true);
  }

  async function salvarCapital() {
    if (!clienteAtivo?.id) return;
    setSalvandoCap(true);
    try {
      await Promise.all(
        CAPITAL_CAMPOS.map(({ campo }) =>
          API.salvarCapital(clienteAtivo.id, periodo, { campo, valor: parseFloat(capitalForm[campo]) || 0 })
        )
      );
      const novo = {};
      CAPITAL_CAMPOS.forEach(({ campo }) => { novo[campo] = parseFloat(capitalForm[campo]) || 0; });
      setCapitalCache(prev => ({ ...prev, [periodo]: novo }));
      setModalCapital(false);
    } catch(e) { console.error(e); }
    finally { setSalvandoCap(false); }
  }

  const b = useMemo(() => {
    const fim = fimDoMes(periodo);
    const limiteCurto = somaMeses(periodo, 12); // até 12 meses = circulante
    const item = (descricao, data, valor, extra = '') => ({ descricao: descricao || '—', data: String(data || '').slice(0, 10), valor, extra });

    // ATIVO — contas a receber em aberto no fim do mês (+ lançamentos de entrada pendentes)
    const receber = [
      ...contas.filter(c => c.tipo === 'receber' && competenciaDe(c) <= periodo && abertaNoFimDe(c, periodo))
        .map(c => item(c.descricao, c.vencimento, valorConta(c), 'vence')),
      ...lancamentos.filter(l => l.tipo === 'Entrada' && l.status === 'Pendente' && l.data <= fim && !l.isCMV && !CMVCATS.includes(l.categoria))
        .map(l => item(l.descricao || l.subcategoria, l.data, l.valor, 'lançamento pendente')),
    ];
    // Investimentos lançados (equipamentos, reformas, veículos…) até o fim do mês, pelo valor pago, sem depreciação
    const imobilizado = lancamentos.filter(l => l.tipo === 'Saída' && l.categoria === 'Investimentos' && l.data <= fim)
      .map(l => item(l.descricao || l.subcategoria, l.data, l.valor, l.subcategoria));

    // PASSIVO — contas a pagar (menos empréstimos) por competência, em aberto no fim do mês
    const grupos = Object.fromEntries(ORDEM_PASSIVO.map(g => [g, []]));
    contas.filter(c => c.tipo === 'pagar' && c.categoria !== 'Dívidas / Empréstimos' && competenciaDe(c) <= periodo && abertaNoFimDe(c, periodo))
      .forEach(c => grupos[GRUPO_PASSIVO[c.categoria] || 'Outras contas a pagar'].push(item(c.descricao, c.vencimento, valorConta(c), 'vence')));
    lancamentos.filter(l => l.tipo === 'Saída' && l.status === 'Pendente' && l.data <= fim && !l.isCMV && !CMVCATS.includes(l.categoria) && l.categoria !== 'Dívidas / Empréstimos')
      .forEach(l => grupos[GRUPO_PASSIVO[l.categoria] || 'Outras contas a pagar'].push(item(l.descricao || l.subcategoria, l.data, l.valor, 'lançamento pendente')));

    // Empréstimos: o saldo devedor é o principal (sem os juros futuros) das parcelas em aberto no fim do mês.
    // Entra a partir do mês da contratação (o mês antes da 1ª parcela). Vencendo em até 12 meses = curto prazo
    const parcelasEmp = contas.filter(c => c.tipo === 'pagar' && c.categoria === 'Dívidas / Empréstimos');
    const primeiraPorEmp = {};
    parcelasEmp.forEach(c => {
      const emp = String(c.descricao || '').split(' — Parcela')[0];
      const venc = String(c.vencimento || '').slice(0, 7);
      if (venc && (!primeiraPorEmp[emp] || venc < primeiraPorEmp[emp])) primeiraPorEmp[emp] = venc;
    });
    const empAbertas = parcelasEmp.filter(c => {
      const primeira = primeiraPorEmp[String(c.descricao || '').split(' — Parcela')[0]];
      return primeira && somaMeses(primeira, -1) <= periodo && abertaNoFimDe(c, periodo);
    }).map(c => ({ ...item(c.descricao, c.vencimento, valorConta(c) - parseFloat(c.valor_juros || 0), 'vence'), mes: String(c.vencimento || '').slice(0, 7) }));
    const empCurto = empAbertas.filter(p => p.mes <= limiteCurto);
    const empLongo = empAbertas.filter(p => p.mes > limiteCurto);

    const soma = lista => lista.reduce((a, x) => a + x.valor, 0);
    const passivoCirc = [
      ...ORDEM_PASSIVO.map(g => ({ chave: 'p:' + g, label: g, itens: grupos[g] })),
      { chave: 'p:emp', label: 'Empréstimos (próximos 12 meses)', itens: empCurto },
    ].map(l => ({ ...l, valor: soma(l.itens) }));
    const passivoLongo = [{ chave: 'p:empl', label: 'Empréstimos (após 12 meses)', itens: empLongo, valor: soma(empLongo) }];

    return { receber, imobilizado, passivoCirc, passivoLongo, totReceber: soma(receber), totImobilizado: soma(imobilizado) };
  }, [lancamentos, periodo, contas]);

  // Linhas do Ativo: manuais (Recursos em Capital) + calculadas, com detalhe quando vêm de outra tela
  const ativoCirc = [
    caixaContas
      ? { chave: 'a:caixa', label: 'Capital líquido em caixa', valor: caixaContas.valor, sempre: true,
          origem: caixaContas.informado ? 'Saldo das contas informado no dia 1 do mês seguinte' : 'Saldo das contas informado + entradas − saídas lançadas',
          itens: caixaContas.partes.map(p => ({
            descricao: p.tipo === 'informado' ? 'Saldo das contas informado' : `Saldo do mês no Fluxo de Caixa (${MESES_FULL[Number(p.mes.slice(5)) - 1].toLowerCase()})`,
            data: p.tipo === 'informado' ? `${p.mes}-01` : fimDoMes(p.mes), valor: p.valor, extra: '' })) }
      : { chave: 'a:caixa', label: 'Capital líquido em caixa', valor: getCapital('cap_caixa'), sempre: true },
    { chave: 'a:rec',    label: 'Contas a receber',          valor: b.totReceber, itens: b.receber, origem: 'Gestão de Contas', sempre: true },
    { chave: 'a:recm',   label: 'Outros valores a receber',  valor: getCapital('cap_receber') },
    { chave: 'a:ap',     label: 'Capital em estoque — aparelhos',  valor: getCapital('cap_estoque_aparelhos'), sempre: true },
    { chave: 'a:ac',     label: 'Capital em estoque — acessórios', valor: getCapital('cap_estoque_acessorios'), sempre: true },
    { chave: 'a:man',    label: 'Aparelhos em manutenção',   valor: getCapital('cap_manutencao') },
    { chave: 'a:res',    label: 'Reserva de emergência',     valor: getCapital('cap_reserva') },
  ];
  const ativoNaoCirc = [
    { chave: 'a:imob',   label: 'Investimentos lançados',    valor: b.totImobilizado, itens: b.imobilizado, origem: 'Lançamentos em Investimentos' },
    { chave: 'a:imobm',  label: 'Bens anteriores ao sistema', valor: getCapital('cap_imobilizado') },
  ];
  const soma = linhas => linhas.reduce((a, l) => a + l.valor, 0);
  const totAtivoCirc = soma(ativoCirc), totAtivoNaoCirc = soma(ativoNaoCirc);
  const totalAtivo = totAtivoCirc + totAtivoNaoCirc;
  const totPassCirc = soma(b.passivoCirc), totPassLongo = soma(b.passivoLongo);
  const totalPassivo = totPassCirc + totPassLongo;
  const pl = totalAtivo - totalPassivo;
  const endividamento = totalAtivo > 0 ? (totalPassivo / totalAtivo * 100) : 0;
  const liquidez = totPassCirc > 0 ? totAtivoCirc / totPassCirc : null;

  const Linha = ({ l, neg = false }) => {
    const temDetalhe = l.itens?.length > 0;
    const estaAberta = aberta === l.chave;
    if (!l.valor && !temDetalhe && !l.sempre) return null; // as linhas principais aparecem mesmo zeradas
    return (
      <>
        <div
          className={`bp-linha ${temDetalhe ? 'bp-clicavel' : ''}`}
          role={temDetalhe ? 'button' : undefined}
          tabIndex={temDetalhe ? 0 : undefined}
          aria-expanded={temDetalhe ? estaAberta : undefined}
          onClick={temDetalhe ? () => setAberta(estaAberta ? null : l.chave) : undefined}
          onKeyDown={temDetalhe ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberta(estaAberta ? null : l.chave); } } : undefined}
        >
          <span className="bp-rotulo">
            {temDetalhe && <span className={`bp-seta ${estaAberta ? 'aberta' : ''}`}>›</span>}
            {l.label}
            {temDetalhe && <span className="bp-qtd">{l.itens.length}</span>}
          </span>
          <span className="bp-valor" style={{ color: l.valor === 0 ? 'var(--text2)' : neg ? 'var(--saida)' : 'var(--text)' }}>{fmt(l.valor)}</span>
        </div>
        {estaAberta && (
          <div className="bp-detalhe">
            {l.origem && <div className="bp-detalhe-origem">Origem: {l.origem}</div>}
            {[...l.itens].sort((x, y) => x.data.localeCompare(y.data)).map((it, i) => (
              <div key={i} className="bp-detalhe-item">
                <span className="bp-detalhe-desc">{it.descricao}</span>
                <span className="bp-detalhe-data">{it.data ? `${it.extra === 'vence' ? 'vence ' : ''}${it.data.split('-').reverse().join('/')}` : ''}{it.extra && it.extra !== 'vence' ? ` · ${it.extra}` : ''}</span>
                <span className="bp-detalhe-valor">{fmt(it.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  const Subtotal = ({ label, val }) => (
    <div className="bp-subtotal"><span>{label}</span><span>{fmt(val)}</span></div>
  );
  const Grupo = ({ label }) => <div className="bp-grupo">{label}</div>;
  const nomeMes = `${MESES_FULL[parseInt(mes) - 1]}/${ano}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="card-label">Total Ativo</div>
            <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(totalAtivo)}</div>
            <div className="card-sub">Bens e direitos</div>
          </div>
          <div className="card">
            <div className="card-label">Total Passivo</div>
            <div className="card-value" style={{ color: 'var(--saida)' }}>{fmt(totalPassivo)}</div>
            <div className="card-sub">Obrigações em aberto</div>
          </div>
          <div className="card">
            <div className="card-label">Patrimônio Líquido</div>
            <div className="card-value" style={{ color: pl >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(pl)}</div>
            <div className="card-sub">Ativo − Passivo</div>
          </div>
          <div className="card">
            <div className="card-label">Endividamento</div>
            <div className="card-value" style={{ color: endividamento < 50 ? 'var(--entrada)' : endividamento < 80 ? 'var(--warn)' : 'var(--saida)' }}>{totalAtivo > 0 ? fmtPct(endividamento) : '—'}</div>
            <div className="card-sub">{liquidez != null ? `Liquidez corrente ${liquidez.toFixed(2).replace('.', ',')}` : 'Passivo / Ativo'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="bp-grid">
        <div className="table-panel bp-painel">
          <div className="bp-cabecalho">
            <h3>ATIVO</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setImportando('escolha')}><Icone nome="baixar" tamanho={13} /> Importar Patrimônio</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={abrirModalCapital}><Icone nome="editar" tamanho={13} /> Editar</button>
            </div>
          </div>
          {importInfo?.itens > 0 && (
            <div className="bp-nota">
              Estoque importado do Mercado Phone em {new Date(importInfo.importado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {importInfo.itens} itens aprovados
            </div>
          )}
          <Grupo label="Ativo Circulante" />
          {ativoCirc.map(l => <Linha key={l.chave} l={l} />)}
          <Subtotal label="Total Circulante" val={totAtivoCirc} />
          <Grupo label="Ativo Não Circulante" />
          {ativoNaoCirc.map(l => <Linha key={l.chave} l={l} />)}
          {totAtivoNaoCirc === 0 && <div className="bp-vazio">Nenhum investimento lançado</div>}
          <Subtotal label="Total Não Circulante" val={totAtivoNaoCirc} />
          <div className="bp-total"><span>TOTAL ATIVO</span><span style={{ color: 'var(--entrada)' }}>{fmt(totalAtivo)}</span></div>
        </div>

        <div className="table-panel bp-painel">
          <div className="bp-cabecalho">
            <h3>PASSIVO + PL</h3>
            <span className="bp-nota" style={{ margin: 0 }}>Em aberto em {fimDoMes(periodo).split('-').reverse().join('/')}</span>
          </div>
          <Grupo label="Passivo Circulante" />
          {b.passivoCirc.map(l => <Linha key={l.chave} l={{ ...l, origem: 'Gestão de Contas' }} neg />)}
          {totPassCirc === 0 && <div className="bp-vazio">Nenhuma conta a pagar em aberto neste mês</div>}
          <Subtotal label="Total Circulante" val={totPassCirc} />
          <Grupo label="Passivo Não Circulante" />
          {b.passivoLongo.map(l => <Linha key={l.chave} l={{ ...l, origem: 'Gestão de Contas' }} neg />)}
          {totPassLongo === 0 && <div className="bp-vazio">Sem dívidas de longo prazo</div>}
          <Subtotal label="Total Não Circulante" val={totPassLongo} />
          <Grupo label="Patrimônio Líquido" />
          <div className="bp-linha">
            <span className="bp-rotulo">Patrimônio do dono (Ativo − Passivo)</span>
            <span className="bp-valor" style={{ color: pl >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(pl)}</span>
          </div>
          <div className="bp-total"><span>TOTAL PASSIVO + PL</span><span>{fmt(totalPassivo + pl)}</span></div>
        </div>
      </div>

      {importando === 'escolha' && (
        <OrigemPatrimonio
          clienteId={clienteAtivo.id}
          onMP={() => setImportando('mp')}
          onArquivo={a => { setArquivoImport(a); setImportando('arquivo'); }}
          onFechar={() => setImportando(null)}
        />
      )}
      {(importando === 'mp' || (importando === 'arquivo' && arquivoImport)) && (
        <ImportarPatrimonio clienteId={clienteAtivo.id} periodo={periodo} arquivo={importando === 'arquivo' ? arquivoImport : null}
          onFechar={() => { setImportando(null); setArquivoImport(null); }} onSalvo={patrimonioSalvo} />
      )}

      {modalCapital && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCapital(false)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Valores do Ativo — {nomeMes}</h3>
              <button className="modal-close" onClick={() => setModalCapital(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 12px' }}>
                Contas a receber e investimentos vêm sozinhos da Gestão de Contas e dos lançamentos. Aqui entra só o que o sistema não sabe.
              </p>
              <div className="form-grid">
                {CAPITAL_CAMPOS.map(({ campo, label }) => (
                  <div key={campo} className="field">
                    <label htmlFor={`cap-${campo}`}>{label}</label>
                    <input
                      id={`cap-${campo}`}
                      type="number" step="0.01" placeholder="0,00"
                      value={capitalForm[campo] || ''}
                      onChange={e => setCapitalForm(prev => ({ ...prev, [campo]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalCapital(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarCapital} disabled={salvandoCap}>
                {salvandoCap ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {totalAtivo > 0 && (
        <div className="table-panel" style={{ padding: '16px 20px', marginTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Composição do Ativo</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...ativoCirc, ...ativoNaoCirc].map((l, i) => ({ ...l, cor: ['#22c55e','#3b82f6','#06b6d4','#f59e0b','#eab308','#f03e3e','#8b5cf6','#64748b','#94a3b8'][i] })).filter(l => l.valor > 0).map(l => {
              const pct = l.valor / totalAtivo * 100;
              return (
                <div key={l.chave}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, gap: 8 }}>
                    <span style={{ color: 'var(--text2)' }}>{l.label}</span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(l.valor)} <span style={{ color: 'var(--text2)', fontWeight: 400 }}>({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: l.cor, borderRadius: 3, transition: 'width .3s' }} />
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
function ControleUpgrade({ lancamentos, ano, setAno, mesFiltro, setMesFiltro }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const mes = String(mesFiltro + 1).padStart(2, '0');
  const setMes = v => setMesFiltro(parseInt(v) - 1);
  const [diasAbertos, setDiasAbertos] = useState(new Set());

  const upgrades = useMemo(() => {
    const periodo = (l) => l.data.startsWith(ano) && (mes === '' || l.data.startsWith(`${ano}-${mes}`));
    const novos = lancamentos
      .filter(l => l.tipo === 'Entrada' && l.valorUpgrade > 0 && periodo(l))
      .map(l => ({ ...l, _valorUpgrade: l.valorUpgrade, _qtd: l.qtdUpgrade || l.quantidade || 1, _origem: 'novo' }));
    const antigos = lancamentos
      .filter(l => l.tipo === 'Saída' && l.categoria === 'Fornecedores (Estoque)' && l.subcategoria === 'Aparelhos (Upgrade)' && periodo(l))
      .map(l => ({ ...l, _valorUpgrade: l.valor, _qtd: l.quantidade || 1, _origem: 'antigo' }));
    return [...novos, ...antigos].sort((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, ano, mes]);

  // Agrupa por data
  const porDia = useMemo(() => {
    const map = new Map();
    for (const l of upgrades) {
      if (!map.has(l.data)) map.set(l.data, []);
      map.get(l.data).push(l);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [upgrades]);

  const totalQtd = upgrades.reduce((a, l) => a + l._qtd, 0);
  const totalVal = upgrades.reduce((a, l) => a + l._valorUpgrade, 0);

  function toggleDia(data) {
    setDiasAbertos(prev => {
      const next = new Set(prev);
      next.has(data) ? next.delete(data) : next.add(data);
      return next;
    });
  }

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
            <div className="icon"><Icone nome="caixa" tamanho={30} traco={1.6} /></div>
            <div>Nenhum upgrade registrado no período</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>Data</th>
                  <th>Modelo</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: 'right' }}>Valor do Upgrade</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {porDia.map(([data, itens]) => {
                  const aberto = diasAbertos.has(data);
                  const diaQtd = itens.reduce((a, l) => a + l._qtd, 0);
                  const diaVal = itens.reduce((a, l) => a + l._valorUpgrade, 0);
                  const dataFmt = data.split('-').reverse().join('/');
                  return (
                    <>
                      {/* Linha resumo do dia */}
                      <tr
                        key={`dia-${data}`}
                        onClick={() => toggleDia(data)}
                        style={{ cursor: 'pointer', background: aberto ? 'var(--surface2)' : undefined, userSelect: 'none' }}
                      >
                        <td style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, transition: 'transform .15s', transform: aberto ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', marginTop: 4 }}>▶</td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{dataFmt}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{diaQtd} aparelho{diaQtd !== 1 ? 's' : ''}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>clique para ver detalhes</td>
                        <td style={{ textAlign: 'right', color: '#8b5cf6', fontWeight: 700 }}>{fmt(diaVal)}</td>
                        <td />
                      </tr>
                      {/* Linhas detalhadas (expandidas) */}
                      {aberto && itens.map(l => (
                        <tr key={`${l._origem}-${l.id}`} style={{ background: 'var(--surface2)' }}>
                          <td />
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12, paddingLeft: 20 }}>{dataFmt}</td>
                          <td style={{ fontWeight: 600, paddingLeft: 20 }}>{l._origem === 'novo' ? (l.subcategoria || l.categoria || '—') : (l.subcategoria || '—')}</td>
                          <td style={{ color: 'var(--text2)', paddingLeft: 20 }}>{l.descricao || '—'}</td>
                          <td style={{ textAlign: 'right', color: '#8b5cf6', fontWeight: 700 }}>{fmt(l._valorUpgrade)}</td>
                          <td>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: l._origem === 'novo' ? '#8b5cf622' : 'color-mix(in srgb, var(--warn) 13%, transparent)', color: l._origem === 'novo' ? '#8b5cf6' : 'var(--warn)', fontWeight: 600 }}>
                              {l._origem === 'novo' ? 'Novo' : 'Anterior'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td />
                  <td colSpan={3} style={{ paddingTop: 8, color: 'var(--text2)' }}>TOTAL — {totalQtd} aparelho{totalQtd !== 1 ? 's' : ''}</td>
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

    const aparelhos  = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.categoria === 'Aparelhos');
    const uni        = aparelhos.reduce((a,l) => a + (l.quantidade || 1), 0);
    const fatAparelhos = aparelhos.reduce((a,l) => a + l.valor, 0);
    const fatAcess   = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.categoria === 'Acessórios').reduce((a,l) => a + l.valor, 0);
    const fatAssist  = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.categoria === 'Assistência Técnica').reduce((a,l) => a + l.valor, 0);
    const ticket     = uni > 0 ? fatAparelhos / uni : 0;

    const ritmo      = diasPassados > 0 ? fat / diasPassados : 0;
    const projFat    = fat + ritmo * diasRestantes;
    const projLucro  = projFat > 0 && fat > 0 ? projFat * (lucroLiq / fat) : 0;
    const projUni    = uni > 0 ? Math.round(uni / diasPassados * diasNoMes) : 0;
    const projTicket = projUni > 0 ? (fatAparelhos + ritmo * diasRestantes * (fatAparelhos / fat)) / projUni : ticket;

    const entCaixa  = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.status !== 'Pendente').reduce((a,l) => a + (l.valorRecebido != null ? l.valorRecebido : l.valor - upgradeNoCaixa(l)), 0);
    const saiCaixa  = lm.filter(l => l.tipo === 'Saída'  && !l.isCMV && l.status !== 'Pendente').reduce((a,l) => a + l.valor, 0);
    const caixaLiq  = entCaixa - saiCaixa;
    const projCaixa = diasPassados > 0 ? caixaLiq / diasPassados * diasNoMes : caixaLiq;

    const totalSaidas = lm.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.categoria !== 'Fornecedores (Estoque)' && l.status !== 'Pendente').reduce((a,l) => a + l.valor, 0);

    return { fat, lucroLiq, uni, ticket, fatAcess, fatAssist, caixaLiq, projCaixa, diasNoMes, diasPassados, diasRestantes, projFat, projLucro, projUni, projTicket, ritmo, totalSaidas };
  }, [lancamentos, pfx, anoN, mesN]);

  const MetricCard = ({ titulo, campo, atual, proj: projVal, cor, isMoney = true }) => {
    const meta = getMeta(campo);
    const ref  = meta || projVal || 1;
    const pAt  = Math.min(100, ref > 0 ? (atual / ref * 100) : 0);
    const pPr  = Math.min(100, ref > 0 ? (projVal / ref * 100) : 0);
    const barCor = projVal >= (meta || projVal) ? 'var(--entrada)' : projVal >= (meta || projVal) * 0.8 ? 'var(--warn)' : 'var(--saida)';
    const fmtV = (v) => isMoney ? fmt(v) : Math.round(v).toString();

    return (
      <div className="table-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text2)' }}>{titulo}</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditando({ campo, titulo }); setMetaValor(meta || ''); }}><Icone nome="editar" tamanho={13} /> Meta</button>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: cor }}>{fmtV(atual)}</div>
        <div style={{ position: 'relative', height: 14, background: 'var(--surface2)', borderRadius: 7, overflow: 'hidden', margin: '10px 0 4px' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pPr}%`, background: `color-mix(in srgb, ${barCor} 27%, transparent)`, borderRadius: 7 }} />
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

  const TetoCustosCard = () => {
    const teto  = getMeta('teto_gastos');
    const gasto = proj.totalSaidas;
    const pct   = teto > 0 ? Math.min(100, gasto / teto * 100) : 0;
    const cor   = pct >= 100 ? 'var(--saida)' : pct >= 80 ? 'var(--warn)' : 'var(--entrada)';

    return (
      <div className="table-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text2)' }}>Teto de Gastos</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditando({ campo: 'teto_gastos', titulo: 'Teto de Gastos' }); setMetaValor(teto || ''); }}><Icone nome="editar" tamanho={13} /> Definir</button>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: teto > 0 ? cor : 'var(--text)' }}>{fmt(gasto)}</div>
        {teto > 0 ? (
          <>
            <div style={{ position: 'relative', height: 14, background: 'var(--surface2)', borderRadius: 7, overflow: 'hidden', margin: '10px 0 4px' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: cor, borderRadius: 7, transition: 'width .3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)' }}>
              <span>Gasto: <strong style={{ color: cor }}>{fmt(gasto)}</strong></span>
              <span>{pct.toFixed(0)}% do teto</span>
              <span>Teto: <strong>{fmt(teto)}</strong></span>
            </div>
            {pct >= 100 && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--saida)', fontWeight: 600 }}><Icone nome="alerta" tamanho={13} /> Teto atingido!</div>}
            {pct >= 80 && pct < 100 && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}><Icone nome="alerta" tamanho={13} /> {(100 - pct).toFixed(0)}% restante do teto</div>}
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Defina um teto para controlar os gastos do mês.</div>
        )}
      </div>
    );
  };

  const ritmoCor = proj.projFat >= (getMeta('meta_fat') || proj.projFat) ? 'var(--entrada)' : proj.projFat >= (getMeta('meta_fat') || proj.projFat) * 0.8 ? 'var(--warn)' : 'var(--saida)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="table-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text2)', marginBottom: 2 }}>Projeção de Fechamento</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{nomeMes} {anoN}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{proj.diasPassados} dias passados · {proj.diasRestantes} restantes</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ritmoCor }}>Ritmo: {fmt(proj.ritmo)}/dia</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <MetricCard titulo="Faturamento"        campo="meta_fat"    atual={proj.fat}      proj={proj.projFat}    cor="var(--entrada)" />
        <MetricCard titulo="Lucro Líquido"      campo="meta_lucro"  atual={proj.lucroLiq} proj={proj.projLucro}  cor={proj.lucroLiq >= 0 ? '#3b82f6' : 'var(--saida)'} />
        <MetricCard titulo="Aparelhos Vendidos" campo="meta_uni"    atual={proj.uni}      proj={proj.projUni}    cor="var(--warn)" isMoney={false} />
        <MetricCard titulo="Ticket Médio"       campo="meta_ticket" atual={proj.ticket}   proj={proj.projTicket} cor="#8b5cf6" />
        <MetricCard titulo="Fat. Acessórios"     campo="meta_acess"   atual={proj.fatAcess}  proj={proj.fat > 0 ? proj.projFat * (proj.fatAcess / proj.fat) : proj.fatAcess}  cor="#06b6d4" />
        <MetricCard titulo="Fat. Assistência"   campo="meta_assist"  atual={proj.fatAssist} proj={proj.fat > 0 ? proj.projFat * (proj.fatAssist / proj.fat) : proj.fatAssist} cor="var(--warn)" />
        <MetricCard titulo="Geração de Caixa"  campo="meta_caixa"  atual={proj.caixaLiq}  proj={proj.projCaixa}  cor={proj.caixaLiq >= 0 ? 'var(--entrada)' : 'var(--saida)'} />
        <TetoCustosCard />
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
  const { lancamentos, clienteAtivo, metasCache, setMetasCache, periodo, setPeriodo } = useApp();
  // A aba e o mês ficam como a pessoa deixou ao sair e voltar para o Financeiro
  const [aba, setAbaEstado] = useState(() => { try { return sessionStorage.getItem('fin_aba') || 'dre'; } catch { return 'dre'; } });
  const setAba = a => { setAbaEstado(a); try { sessionStorage.setItem('fin_aba', a); } catch { /* sem storage */ } };
  const mesFiltro = parseInt(periodo.slice(5, 7)) - 1;
  const ano = periodo.slice(0, 4);
  const setMesFiltro = m => setPeriodo(`${ano}-${String(m + 1).padStart(2, '0')}`);
  const setAno = a => setPeriodo(`${a}-${periodo.slice(5, 7)}`);

  return (
    <div className="financeiro-page">
      <div className="abas">
        <button className={`aba-btn ${aba === 'dre'    ? 'active' : ''}`} onClick={() => setAba('dre')}>DRE</button>
        <button className={`aba-btn ${aba === 'fluxo'  ? 'active' : ''}`} onClick={() => setAba('fluxo')}>Fluxo de Caixa</button>
        <button className={`aba-btn ${aba === 'balanco' ? 'active' : ''}`} onClick={() => setAba('balanco')}>Balanço Patrimonial</button>
        <button className={`aba-btn ${aba === 'upgrade' ? 'active' : ''}`} onClick={() => setAba('upgrade')}>Upgrades</button>
        <button className={`aba-btn ${aba === 'proj'    ? 'active' : ''}`} onClick={() => setAba('proj')}>Projeção</button>
      </div>

      {aba === 'dre'     && <DRE     lancamentos={lancamentos} clienteAtivo={clienteAtivo} metasCache={metasCache} setMetasCache={setMetasCache} mesFiltro={mesFiltro} setMesFiltro={setMesFiltro} ano={ano} setAno={setAno} />}
      {aba === 'fluxo'   && <FluxoCaixa lancamentos={lancamentos} clienteAtivo={clienteAtivo} mesFiltro={mesFiltro} setMesFiltro={setMesFiltro} ano={ano} setAno={setAno} />}
      {aba === 'balanco'  && <Balanco lancamentos={lancamentos} clienteAtivo={clienteAtivo} mesFiltro={mesFiltro} setMesFiltro={setMesFiltro} ano={ano} setAno={setAno} />}
      {aba === 'upgrade'  && <ControleUpgrade lancamentos={lancamentos} ano={ano} setAno={setAno} mesFiltro={mesFiltro} setMesFiltro={setMesFiltro} />}
      {aba === 'proj'     && <Projecao lancamentos={lancamentos} clienteAtivo={clienteAtivo} metasCache={metasCache} setMetasCache={setMetasCache} />}
    </div>
  );
}
