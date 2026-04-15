import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import './Financeiro.css';

const fmt    = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v) => v !== null && v !== undefined ? v.toFixed(2) + '%' : '—';
const hoje   = () => new Date().toISOString().slice(0, 10);

const MESES     = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const MESES_FULL= ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CMVCATS   = ['Custos Variáveis Diretos'];

// ── DRE ────────────────────────────────────────────────────────────────────────
function calcDREMes(lancamentos, pfx) {
  const lm  = lancamentos.filter(l => l.data.startsWith(pfx));
  const ent = (cat) => lm.filter(l => l.tipo === 'Entrada' && l.categoria === cat).reduce((a,l) => a+l.valor, 0);
  const sai = (cat) => lm.filter(l => l.tipo === 'Saída'   && l.categoria === cat).reduce((a,l) => a+l.valor, 0);
  const qua = (cat) => lm.filter(l => l.categoria === cat).reduce((a,l) => a+l.valor, 0);

  const subscricao = ent('Aparelhos') + ent('Acessórios') + ent('Assistência Técnica') + ent('Outros Produtos');
  const recNaoOp   = ent('Receitas Não-Operacionais');
  const recBruta   = subscricao + recNaoOp;
  const deducoes   = sai('Deduções das Vendas');
  const recLiquida = recBruta - deducoes;
  const cmvInd     = sai('Custos Variáveis Indiretos');
  const cmvDir     = qua('Custos Variáveis Diretos');
  const cmvTotal   = cmvInd + cmvDir;
  const lucroBruto = recLiquida - cmvTotal;
  const margContrib = recBruta > 0 ? (lucroBruto / recBruta * 100) : null;
  const ocupacao   = sai('Despesas com Ocupação');
  const pessoal    = sai('Despesas com Pessoal');
  const variaveis  = sai('Despesas Variáveis');
  const softwares  = sai('Softwares / Tecnologias');
  const terceiros  = sai('Serviços Terceirizados');
  const sga        = ocupacao + pessoal + variaveis + softwares + terceiros;
  const ebitda     = lucroBruto - sga;
  const margEbitda = recBruta > 0 ? (ebitda / recBruta * 100) : null;
  const recFin     = 0;
  const despJuros  = sai('Dívidas / Empréstimos');
  const despNaoOp  = sai('Saídas Não-Operacionais');
  const resFin     = recFin - despJuros - despNaoOp;
  const lucroLiq   = ebitda + resFin;
  const margLiq    = recBruta > 0 ? (lucroLiq / recBruta * 100) : null;

  return { subscricao, recNaoOp, recBruta, deducoes, recLiquida,
           cmvInd, cmvDir, cmvTotal, lucroBruto, margContrib,
           ocupacao, pessoal, variaveis, softwares, terceiros, sga,
           ebitda, margEbitda, despJuros, despNaoOp, resFin,
           lucroLiq, margLiq };
}

function DRE({ lancamentos, clienteAtivo }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const [ano, setAno] = useState(anoAtual);

  const mv = useMemo(() =>
    MESES.map((_, i) => calcDREMes(lancamentos, `${ano}-${String(i+1).padStart(2,'0')}`)),
    [lancamentos, ano]
  );

  const S  = (k) => mv.reduce((a, v) => a + (v[k] || 0), 0);
  const tRecBruta  = S('recBruta');
  const tLucroBruto = S('lucroBruto');
  const tSga       = S('sga');
  const tEbitda    = S('ebitda');
  const tLucroLiq  = S('lucroLiq');
  const tRecLiq    = S('recLiquida');
  const tCmv       = S('cmvTotal');

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

  const RowPct = ({ label, vals, tot }) => (
    <tr className="row-pct">
      <td style={{ paddingLeft: 8, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>{label}</td>
      {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{dp(v)}</td>)}
      <td style={{ textAlign: 'right' }}>{dp(tot)}</td>
    </tr>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="card-label">Receita Bruta {ano}</div>
            <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(tRecBruta)}</div>
          </div>
          <div className="card">
            <div className="card-label">Lucro Bruto</div>
            <div className="card-value" style={{ color: tLucroBruto >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(tLucroBruto)}</div>
            <div className="card-sub">{tRecBruta > 0 ? fmtPct(tLucroBruto / tRecBruta * 100) : '—'}</div>
          </div>
          <div className="card">
            <div className="card-label">EBITDA</div>
            <div className="card-value" style={{ color: tEbitda >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(tEbitda)}</div>
            <div className="card-sub">{tRecBruta > 0 ? fmtPct(tEbitda / tRecBruta * 100) : '—'}</div>
          </div>
          <div className="card">
            <div className="card-label">Lucro Líquido</div>
            <div className="card-value" style={{ color: tLucroLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(tLucroLiq)}</div>
            <div className="card-sub">{tRecBruta > 0 ? fmtPct(tLucroLiq / tRecBruta * 100) : '—'}</div>
          </div>
        </div>
        <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
          {anos.map(a => <option key={a}>{a}</option>)}
        </select>
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
              <RowMed label="(+) Receitas Não-Operacionais" vals={mv.map(v => v.recNaoOp)} tot={S('recNaoOp')} />
              <RowMed label="(-) Deduções das Vendas" vals={mv.map(v => v.deducoes)} tot={S('deducoes')} neg />
              <RowBig label="(=) RECEITA LÍQUIDA" vals={mv.map(v => v.recLiquida)} tot={tRecLiq} />
              <RowBig label="(-) CMV — Custo de Mercadoria Vendida" vals={mv.map(v => v.cmvTotal)} tot={tCmv} neg />
              <RowMed label="(-) Custos Variáveis Indiretos" vals={mv.map(v => v.cmvInd)} tot={S('cmvInd')} neg />
              <RowMed label="(-) Custos Variáveis Diretos" vals={mv.map(v => v.cmvDir)} tot={S('cmvDir')} neg />
              <RowBig label="(=) LUCRO BRUTO" vals={mv.map(v => v.lucroBruto)} tot={tLucroBruto} />
              <RowPct label="Margem de Contribuição (%)" vals={mv.map(v => v.margContrib)} tot={tRecBruta > 0 ? tLucroBruto / tRecBruta * 100 : null} />
              <RowBig label="(-) Despesas SG&A" vals={mv.map(v => v.sga)} tot={tSga} neg />
              <RowMed label="(-) Despesas com Ocupação" vals={mv.map(v => v.ocupacao)} tot={S('ocupacao')} neg />
              <RowMed label="(-) Despesas com Pessoal" vals={mv.map(v => v.pessoal)} tot={S('pessoal')} neg />
              <RowMed label="(-) Despesas Variáveis" vals={mv.map(v => v.variaveis)} tot={S('variaveis')} neg />
              <RowMed label="(-) Softwares / Tecnologias" vals={mv.map(v => v.softwares)} tot={S('softwares')} neg />
              <RowMed label="(-) Serviços Terceirizados" vals={mv.map(v => v.terceiros)} tot={S('terceiros')} neg />
              <RowBig label="(=) LUCRO OPERACIONAL (EBITDA)" vals={mv.map(v => v.ebitda)} tot={tEbitda} />
              <RowPct label="Margem EBITDA (%)" vals={mv.map(v => v.margEbitda)} tot={tRecBruta > 0 ? tEbitda / tRecBruta * 100 : null} />
              <RowMed label="(-) Despesas Financeiras [Juros/Empréstimos]" vals={mv.map(v => v.despJuros)} tot={S('despJuros')} neg />
              <RowMed label="(-) Despesas Não-Operacionais" vals={mv.map(v => v.despNaoOp)} tot={S('despNaoOp')} neg />
              <RowBig label="(=) LUCRO LÍQUIDO" vals={mv.map(v => v.lucroLiq)} tot={tLucroLiq} final />
              <RowPct label="Margem Líquida (%)" vals={mv.map(v => v.margLiq)} tot={tRecBruta > 0 ? tLucroLiq / tRecBruta * 100 : null} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── FLUXO DE CAIXA ──────────────────────────────────────────────────────────────
const DFC_LINHAS = [
  { tipo: 'grupo', label: 'RECEITAS OPERACIONAIS' },
  { tipo: 'cat', label: 'Aparelhos',           cat: 'Aparelhos' },
  { tipo: 'cat', label: 'Acessórios',          cat: 'Acessórios' },
  { tipo: 'cat', label: 'Assistência Técnica', cat: 'Assistência Técnica' },
  { tipo: 'cat', label: 'Outros Produtos',     cat: 'Outros Produtos' },
  { tipo: 'grupo', label: 'RECEITAS NÃO-OPERACIONAIS' },
  { tipo: 'cat', label: 'Receitas Não-Operacionais', cat: 'Receitas Não-Operacionais' },
  { tipo: 'grupo', label: 'SAÍDAS OPERACIONAIS' },
  { tipo: 'cat', label: 'Fornecedores (Estoque)',     cat: 'Fornecedores (Estoque)' },
  { tipo: 'cat', label: 'Deduções das Vendas',        cat: 'Deduções das Vendas' },
  { tipo: 'cat', label: 'CMV — Diretos',              cat: 'Custos Variáveis Diretos' },
  { tipo: 'cat', label: 'CMV — Indiretos',            cat: 'Custos Variáveis Indiretos' },
  { tipo: 'cat', label: 'Despesas com Ocupação',      cat: 'Despesas com Ocupação' },
  { tipo: 'cat', label: 'Despesas com Pessoal',       cat: 'Despesas com Pessoal' },
  { tipo: 'cat', label: 'Despesas Variáveis',         cat: 'Despesas Variáveis' },
  { tipo: 'cat', label: 'Softwares / Tecnologias',    cat: 'Softwares / Tecnologias' },
  { tipo: 'cat', label: 'Serviços Terceirizados',     cat: 'Serviços Terceirizados' },
  { tipo: 'grupo', label: 'SAÍDAS NÃO-OPERACIONAIS' },
  { tipo: 'cat', label: 'Dívidas / Empréstimos',      cat: 'Dívidas / Empréstimos' },
  { tipo: 'cat', label: 'Saídas Não-Operacionais',    cat: 'Saídas Não-Operacionais' },
  { tipo: 'grupo', label: 'INVESTIMENTOS' },
  { tipo: 'cat', label: 'Investimentos',               cat: 'Investimentos' },
];

function FluxoCaixa({ lancamentos, clienteAtivo }) {
  const anoAtual = hoje().slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(anoAtual);
    return [...set].sort().reverse();
  }, [lancamentos, anoAtual]);

  const [ano, setAno]           = useState(anoAtual);
  const [saldoInicial, setSaldo] = useState(0);
  const [saldoMes, setSaldoMes]  = useState(0);
  const [modalSI, setModalSI]    = useState(false);
  const [siValor, setSiValor]    = useState('');
  const [siMes, setSiMes]        = useState(0);

  const lancDFC = useMemo(() =>
    lancamentos.filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente')),
    [lancamentos]
  );

  const valDFC = (l) => l.tipo === 'Entrada' ? (l.valorRecebido ?? l.valor) : l.valor;

  const mv = useMemo(() =>
    MESES.map((_, i) => {
      const pfx = `${ano}-${String(i+1).padStart(2,'0')}`;
      const lm  = lancDFC.filter(l => l.data.startsWith(pfx));
      const ent = lm.filter(l => l.tipo === 'Entrada').reduce((a,l) => a + valDFC(l), 0);
      const sai = lm.filter(l => l.tipo === 'Saída').reduce((a,l) => a + valDFC(l), 0);
      const catVal = (cat) => lm.filter(l => l.categoria === cat).reduce((a,l) => a + valDFC(l), 0);
      return { ent, sai, saldo: ent - sai, catVal };
    }),
    [lancDFC, ano]
  );

  // Saldo acumulado
  const saldoAcum = useMemo(() => {
    let acum = 0;
    return mv.map((m, i) => {
      if (i === siMes && saldoInicial > 0) acum = saldoInicial;
      acum += m.saldo;
      return acum;
    });
  }, [mv, saldoInicial, siMes]);

  async function salvarSaldoInicial() {
    const valor = parseFloat(siValor) || 0;
    const mes   = parseInt(siMes);
    setSaldo(valor);
    setSaldoMes(mes);
    try {
      await API.salvarSaldo(clienteAtivo.id, ano, { valor, mes });
    } catch (err) { console.error(err); }
    setModalSI(false);
  }

  const d = (v, cor) => v === 0
    ? <span style={{ color: 'var(--text2)' }}>—</span>
    : <span style={{ color: cor || (v >= 0 ? 'var(--entrada)' : 'var(--saida)'), fontWeight: 600 }}>{fmt(v)}</span>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="cards" style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="card-label">Total Entradas {ano}</div>
            <div className="card-value" style={{ color: 'var(--entrada)' }}>{fmt(mv.reduce((a,m) => a+m.ent, 0))}</div>
          </div>
          <div className="card">
            <div className="card-label">Total Saídas {ano}</div>
            <div className="card-value" style={{ color: 'var(--saida)' }}>{fmt(mv.reduce((a,m) => a+m.sai, 0))}</div>
          </div>
          <div className="card">
            <div className="card-label">Saldo Líquido {ano}</div>
            <div className="card-value" style={{ color: mv.reduce((a,m)=>a+m.saldo,0) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
              {fmt(mv.reduce((a,m) => a+m.saldo, 0))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setModalSI(true)}>Saldo Inicial</button>
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
              {/* Entradas */}
              <tr className="row-big">
                <td>ENTRADAS TOTAL</td>
                {mv.map((m, i) => <td key={i} style={{ textAlign: 'right' }}>{d(m.ent, 'var(--entrada)')}</td>)}
                <td style={{ textAlign: 'right' }}>{d(mv.reduce((a,m)=>a+m.ent,0), 'var(--entrada)')}</td>
              </tr>
              {/* Saídas */}
              <tr className="row-big">
                <td>SAÍDAS TOTAL</td>
                {mv.map((m, i) => <td key={i} style={{ textAlign: 'right' }}>{d(m.sai, 'var(--saida)')}</td>)}
                <td style={{ textAlign: 'right' }}>{d(mv.reduce((a,m)=>a+m.sai,0), 'var(--saida)')}</td>
              </tr>
              {/* Saldo */}
              <tr className="row-final">
                <td>SALDO DO MÊS</td>
                {mv.map((m, i) => <td key={i} style={{ textAlign: 'right' }}>{d(m.saldo)}</td>)}
                <td style={{ textAlign: 'right' }}>{d(mv.reduce((a,m)=>a+m.saldo,0))}</td>
              </tr>
              {/* Saldo acumulado */}
              <tr className="row-big">
                <td>SALDO ACUMULADO</td>
                {saldoAcum.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{d(v)}</td>)}
                <td style={{ textAlign: 'right' }}>—</td>
              </tr>

              {/* Linhas por categoria */}
              {DFC_LINHAS.map((linha, li) => {
                if (linha.tipo === 'grupo') {
                  return (
                    <tr key={li} className="row-big" style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={14} style={{ color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {linha.label}
                      </td>
                    </tr>
                  );
                }
                const vals = mv.map(m => m.catVal(linha.cat));
                const tot  = vals.reduce((a,v) => a+v, 0);
                if (!vals.some(v => v !== 0) && tot === 0) return null;
                return (
                  <tr key={li} className="row-med">
                    <td style={{ paddingLeft: 20 }}>{linha.label}</td>
                    {vals.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{d(v)}</td>)}
                    <td style={{ textAlign: 'right' }}>{d(tot)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Saldo Inicial */}
      {modalSI && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSI(false)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Saldo Inicial — {ano}</h3>
              <button className="modal-close" onClick={() => setModalSI(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label>Mês</label>
                  <select value={siMes} onChange={e => setSiMes(e.target.value)}>
                    {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Valor (R$)</label>
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

// ── PÁGINA FINANCEIRO ───────────────────────────────────────────────────────────
export default function Financeiro() {
  const { lancamentos, clienteAtivo } = useApp();
  const [aba, setAba] = useState('dre');

  return (
    <div className="financeiro-page">
      <div className="abas">
        <button className={`aba-btn ${aba === 'dre' ? 'active' : ''}`} onClick={() => setAba('dre')}>DRE</button>
        <button className={`aba-btn ${aba === 'fluxo' ? 'active' : ''}`} onClick={() => setAba('fluxo')}>Fluxo de Caixa</button>
      </div>

      {aba === 'dre'   && <DRE lancamentos={lancamentos} clienteAtivo={clienteAtivo} />}
      {aba === 'fluxo' && <FluxoCaixa lancamentos={lancamentos} clienteAtivo={clienteAtivo} />}
    </div>
  );
}
