import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { CMVCATS, DEDUCOES_CATS, getCatsPorTipo, getSubcats, CATEGORIAS_CMV, getCmvSubAuto } from '../services/constants';
import { fmt, fmtPct, fmtData, hoje, MESES } from '../services/utils';
import './Dashboard.css';

function mesAnterior(mes) {
  const [ano, m] = mes.split('-');
  if (parseInt(m) === 1) return `${parseInt(ano) - 1}-12`;
  return `${ano}-${String(parseInt(m) - 1).padStart(2, '0')}`;
}

function calcularTotais(lista) {
  let entradas = 0, saidas = 0;
  lista
    .filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && l.status !== 'Pendente')
    .forEach(l => {
      if (l.tipo === 'Entrada') entradas += l.valorRecebido ?? l.valor;
      else if (l.tipo === 'Saída') saidas += l.valor;
    });
  return { entradas, saidas, saldo: entradas - saidas };
}

const formVazio = () => ({
  data: hoje(), tipo: 'Saída', valor: '', descricao: '', categoria: '',
  subcategoria: '', pagamento: '', status: 'Confirmado', obs: '', quantidade: '',
  deducao: '', cmvValor: '', cmvCat: 'Custos Variáveis Diretos', cmvSub: '',
});

export default function Dashboard() {
  const { lancamentos, setLancamentos, clienteAtivo } = useApp();
  const navigate = useNavigate();

  const mesAtual = hoje().slice(0, 7);
  const [mes, setMes] = useState(mesAtual.slice(5, 7));
  const [ano, setAno] = useState(mesAtual.slice(0, 4));

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId]   = useState(null);
  const [editandoCMV, setEditandoCMV] = useState(null);
  const [form, setForm]               = useState(formVazio);
  const [salvando, setSalvando]       = useState(false);
  const [erroForm, setErroForm]       = useState('');
  const [confirmando, setConfirmando] = useState(null);

  const cats    = getCatsPorTipo(form.tipo);
  const subcats = getSubcats(form.categoria);
  const cmvCats = CATEGORIAS_CMV;
  const cmvSubs = getSubcats(form.cmvCat);

  const periodo = `${ano}-${mes}`;
  const prevMes = mesAnterior(periodo);

  const anos = useMemo(() => {
    const set = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    set.add(hoje().slice(0, 4));
    return [...set].sort().reverse();
  }, [lancamentos]);

  const diaAtual  = parseInt(hoje().slice(8, 10));
  const eMesAtual = periodo === mesAtual;

  const lm    = useMemo(() => lancamentos.filter(l => l.data.startsWith(periodo)), [lancamentos, periodo]);
  const lprev = useMemo(() => lancamentos.filter(l => {
    if (!l.data.startsWith(prevMes)) return false;
    if (eMesAtual) return parseInt(l.data.slice(8, 10)) <= diaAtual;
    return true;
  }), [lancamentos, prevMes, eMesAtual, diaAtual]);

  const tm       = calcularTotais(lm);
  const tp       = calcularTotais(lprev);
  const fat      = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const fatPrev  = lprev.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const cmvMes   = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const cmvPrev  = lprev.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
  const deducoes     = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const recLiq       = fat - deducoes;
  const deducoesPrev = lprev.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
  const recLiqPrev   = fatPrev - deducoesPrev;
  const gastos     = lm.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.categoria !== 'Fornecedores (Estoque)').reduce((a, l) => a + l.valor, 0);
  const gastosPrev = lprev.filter(l => l.tipo === 'Saída' && !l.isCMV && !CMVCATS.includes(l.categoria) && l.categoria !== 'Fornecedores (Estoque)').reduce((a, l) => a + l.valor, 0);

  const margBruta     = fat > 0     ? ((recLiq - cmvMes) / fat * 100) : 0;
  const margBrutaPrev = fatPrev > 0 ? ((recLiqPrev - cmvPrev) / fatPrev * 100) : 0;

  const lucroBruto  = recLiq - cmvMes;
  const margemBruta = fat > 0 ? (lucroBruto / fat * 100) : null;
  const vendas      = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.status !== 'Pendente');
  const aparelhos   = vendas.filter(l => l.categoria === 'Aparelhos');
  const unidades    = aparelhos.reduce((a, l) => a + (l.quantidade || 1), 0);
  const ticket      = vendas.length > 0 ? fat / vendas.reduce((a, l) => a + (l.quantidade || 1), 0) : null;
  const cmvPct      = fat > 0 ? (cmvMes / fat * 100) : null;
  const roi         = cmvMes > 0 ? (lucroBruto / cmvMes * 100) : null;

  const fatAp         = aparelhos.reduce((a, l) => a + l.valor, 0);
  const apGrupoIds    = new Set(aparelhos.filter(l => l.grupoId).map(l => l.grupoId));
  const cmvAp         = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && apGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const dedAp         = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.grupoId && apGrupoIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);

  const aparelhosPrev  = lprev.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.status !== 'Pendente' && l.categoria === 'Aparelhos');
  const unidadesPrev   = aparelhosPrev.reduce((a, l) => a + (l.quantidade || 1), 0);
  const fatApPrev      = aparelhosPrev.reduce((a, l) => a + l.valor, 0);
  const apGrupoIdsPrev = new Set(aparelhosPrev.filter(l => l.grupoId).map(l => l.grupoId));
  const cmvApPrev      = lprev.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && apGrupoIdsPrev.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
  const dedApPrev      = lprev.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.grupoId && apGrupoIdsPrev.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);

  const lucPorAp      = unidades > 0 ? (fatAp - cmvAp - dedAp) / unidades : 0;
  const lucPorApPrev  = unidadesPrev > 0 ? (fatApPrev - cmvApPrev - dedApPrev) / unidadesPrev : 0;
  const lucPorApDelta = lucPorApPrev > 0 ? ((lucPorAp - lucPorApPrev) / lucPorApPrev * 100) : null;

  const corMar = margemBruta === null ? 'var(--text2)' : margemBruta >= 30 ? 'var(--entrada)' : margemBruta >= 15 ? 'var(--warn)' : 'var(--saida)';
  const corCMV = cmvPct === null ? 'var(--text2)' : cmvPct <= 60 ? 'var(--entrada)' : cmvPct <= 75 ? 'var(--warn)' : 'var(--saida)';
  const corROI = roi === null ? 'var(--text2)' : roi >= 50 ? 'var(--entrada)' : roi >= 20 ? 'var(--warn)' : 'var(--saida)';

  const [sortCol, setSortCol] = useState('data');
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function sortIcon(col) {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const resumoProdutos = useMemo(() => {
    const entradas = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && l.status !== 'Pendente');
    const map = {};
    entradas.forEach(l => {
      const key = l.subcategoria || l.categoria || 'Outro';
      if (!map[key]) map[key] = { produto: key, unidades: 0, faturamento: 0, lucro: 0 };
      map[key].unidades    += (l.quantidade || 1);
      map[key].faturamento += l.valor;
      const cmvL = l.grupoId ? lm.filter(x => x.grupoId === l.grupoId && (x.isCMV || CMVCATS.includes(x.categoria))).reduce((a, x) => a + x.valor, 0) : 0;
      const dedL = l.grupoId ? lm.filter(x => x.grupoId === l.grupoId && x.tipo === 'Saída' && DEDUCOES_CATS.includes(x.categoria)).reduce((a, x) => a + x.valor, 0) : 0;
      map[key].lucro += l.valor - cmvL - dedL;
    });
    return Object.values(map).filter(p => p.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento);
  }, [lm]);

  const semCMV = useMemo(() => {
    const lista = lm.filter(l => !(l.isCMV && l.grupoId)).slice(0, 50);
    return [...lista].sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol === 'valor') { va = parseFloat(va); vb = parseFloat(vb); }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [lm, sortCol, sortDir]);

  function setField(campo, valor) {
    setForm(f => {
      const novo = { ...f, [campo]: valor };
      if (campo === 'tipo')        { novo.categoria = ''; novo.subcategoria = ''; novo.cmvValor = ''; novo.cmvCat = 'Custos Variáveis Diretos'; novo.cmvSub = ''; }
      if (campo === 'categoria')   { novo.subcategoria = ''; novo.cmvSub = getCmvSubAuto(valor, ''); }
      if (campo === 'subcategoria'){ novo.cmvSub = getCmvSubAuto(f.categoria, valor); }
      if (campo === 'cmvCat')      { novo.cmvSub = ''; }
      return novo;
    });
  }

  function abrirNovo() {
    setEditandoId(null);
    setForm(formVazio());
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(l) {
    const cmv = l.grupoId ? lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV) : null;
    setEditandoId(l.id);
    setEditandoCMV(cmv || null);
    setForm({
      data: l.data || hoje(),
      tipo: l.tipo,
      valor: l.valor,
      descricao: l.descricao,
      categoria: l.categoria,
      subcategoria: l.subcategoria || '',
      pagamento: l.pagamento || '',
      status: l.status,
      obs: l.obs || '',
      quantidade: l.quantidade || '',
      deducao: l.valorRecebido != null ? String(parseFloat(l.valor) - parseFloat(l.valorRecebido)) : '',
      cmvValor: cmv ? cmv.valor : '',
      cmvCat:   cmv ? (cmv.categoria || '') : '',
      cmvSub:   cmv ? (cmv.subcategoria || '') : '',
    });
    setErroForm('');
    setModalAberto(true);
  }

  function fecharModal() { setModalAberto(false); setEditandoId(null); setEditandoCMV(null); }

  async function salvar() {
    if (!form.valor || parseFloat(form.valor) <= 0) { setErroForm('Informe o valor'); return; }
    if (!form.categoria) { setErroForm('Selecione a categoria'); return; }

    setSalvando(true);
    setErroForm('');
    try {
      if (editandoId) {
        const editando     = lancamentos.find(l => l.id === editandoId);
        const valorBruto    = parseFloat(form.valor);
        const deducaoRaw    = parseFloat(form.deducao);
        const deducao       = !isNaN(deducaoRaw) && deducaoRaw > 0 && deducaoRaw < valorBruto ? deducaoRaw : null;
        const valorRecebido = deducao !== null ? valorBruto - deducao : null;
        const isEnt        = form.tipo === 'Entrada';

        let grupoId    = editando?.grupoId || null;
        let atualizadoCMV = null;
        let novoCMV    = null;

        if (isEnt && form.cmvValor && parseFloat(form.cmvValor) > 0) {
          if (editandoCMV) {
            atualizadoCMV = await API.editarLancamento(editandoCMV.id, {
              data: form.data, tipo: 'Saída', valor: parseFloat(form.cmvValor),
              categoria: form.cmvCat || editandoCMV.categoria,
              subcategoria: form.cmvSub || editandoCMV.subcategoria,
              descricao: editandoCMV.descricao, pagamento: form.pagamento,
              status: form.status, obs: editandoCMV.obs,
            });
          } else {
            grupoId = grupoId || ('g' + Date.now());
            novoCMV = await API.criarLancamento(clienteAtivo.id, {
              tipo: 'Saída', valor: parseFloat(form.cmvValor), data: form.data,
              categoria: form.cmvCat, subcategoria: form.cmvSub,
              descricao: 'CMV — ' + form.descricao, pagamento: form.pagamento,
              status: form.status, obs: 'CMV vinculado ao #' + String(editandoId).padStart(3, '0'),
              grupo_id: grupoId, is_cmv: true,
            });
          }
        }

        const atualizado = await API.editarLancamento(editandoId, {
          data: form.data, tipo: form.tipo, valor: valorBruto,
          categoria: form.categoria, subcategoria: form.subcategoria,
          descricao: form.descricao, pagamento: form.pagamento,
          status: form.status, obs: form.obs,
          quantidade: isEnt ? (parseInt(form.quantidade) || null) : null,
          valor_recebido: valorRecebido, grupo_id: grupoId,
        });

        setLancamentos(prev => {
          let lista = prev.map(l => {
            if (l.id === editandoId) return { ...l, ...atualizado, grupoId, valorRecebido };
            if (atualizadoCMV && l.id === editandoCMV.id) return { ...l, ...atualizadoCMV };
            return l;
          });
          if (novoCMV) lista = [novoCMV, ...lista];
          return lista;
        });
      } else {
        const cmvValor = form.tipo === 'Entrada' ? (parseFloat(form.cmvValor) || 0) : 0;

        const quantidade    = form.tipo === 'Entrada' ? (parseInt(form.quantidade) || null) : null;
        const valorBruto    = parseFloat(form.valor);
        const deducaoRaw    = parseFloat(form.deducao);
        const deducao       = !isNaN(deducaoRaw) && deducaoRaw > 0 && deducaoRaw < valorBruto ? deducaoRaw : null;
        const valorRecebido = deducao !== null ? valorBruto - deducao : null;
        const grupoId       = (cmvValor > 0 || deducao !== null) ? ('g' + Date.now()) : null;

        const isCmvDireto = CMVCATS.includes(form.categoria);
        const novo = await API.criarLancamento(clienteAtivo.id, {
          tipo: form.tipo, valor: valorBruto, data: form.data,
          categoria: form.categoria, subcategoria: form.subcategoria,
          descricao: form.descricao, pagamento: form.pagamento,
          status: form.status, obs: form.obs,
          quantidade, valor_recebido: valorRecebido, grupo_id: grupoId,
          is_cmv: isCmvDireto || undefined,
        });

        let novosLans = [novo];

        if (cmvValor > 0) {
          const cmv = await API.criarLancamento(clienteAtivo.id, {
            tipo: 'Saída', valor: cmvValor, data: form.data,
            categoria: form.cmvCat, subcategoria: form.cmvSub,
            descricao: 'CMV — ' + form.descricao,
            pagamento: form.pagamento, status: form.status,
            obs: 'CMV vinculado ao #' + String(novo.id).padStart(3, '0'),
            grupo_id: grupoId, is_cmv: true,
          });
          novosLans = [cmv, ...novosLans];
        }


        setLancamentos(prev => [...novosLans, ...prev]);
        setForm(f => ({
          ...formVazio(),
          data: f.data,
          tipo: f.tipo,
          pagamento: f.pagamento,
          status: f.status,
        }));
        setErroForm('');
        return;
      }
      fecharModal();
    } catch (err) {
      setErroForm(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    try {
      await API.excluirLancamento(clienteAtivo.id, id);
      setLancamentos(prev => {
        const sem = prev.filter(l => l.id !== id);
        const pais = new Set(sem.filter(l => l.grupoId && !l.isCMV).map(l => l.grupoId));
        const orfaos = sem.filter(l => l.isCMV && !pais.has(l.grupoId));
        orfaos.forEach(o => API.excluirLancamento(clienteAtivo.id, o.id));
        return sem.filter(l => !l.isCMV || pais.has(l.grupoId));
      });
    } catch (err) {
      console.error(err);
    }
    setConfirmando(null);
  }

  const isEntrada = form.tipo === 'Entrada';
  const margemPreview = isEntrada && form.valor && form.cmvValor
    ? { lucro: parseFloat(form.valor) - parseFloat(form.cmvValor), margem: ((parseFloat(form.valor) - parseFloat(form.cmvValor)) / parseFloat(form.valor) * 100).toFixed(2) }
    : null;

  return (
    <div className="dashboard">
      {/* Seletor de período */}
      <div className="period-row">
        <span className="period-label">Período</span>
        <select className="period-select" value={mes} onChange={e => setMes(e.target.value)}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
            <option key={m} value={m}>
              {new Date(2024, i).toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
            </option>
          ))}
        </select>
        <select className="period-select" value={ano} onChange={e => setAno(e.target.value)}>
          {anos.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* 4 KPI cards */}
      <div className="dash-kpis">
        {[
          {
            label: 'Faturamento',
            value: fmt(fat),
            cor: '#22c55e',
            sub: fatPrev > 0 ? `Mês anterior: ${fmt(fatPrev)}` : 'Sem dados anteriores',
            delta: fatPrev > 0 ? ((fat - fatPrev) / fatPrev * 100) : null,
          },
          {
            label: 'Gastos Totais',
            value: fmt(gastos),
            cor: '#ef4444',
            sub: gastosPrev > 0 ? `Mês anterior: ${fmt(gastosPrev)}` : 'Sem dados anteriores',
            delta: gastosPrev > 0 ? ((gastos - gastosPrev) / gastosPrev * 100) : null,
            deltaInverso: true,
          },
          {
            label: 'Lucro por Aparelho',
            value: unidades > 0 ? fmt(lucPorAp) : '—',
            cor: '#8b5cf6',
            sub: lucPorApPrev > 0 ? `Mês anterior: ${fmt(lucPorApPrev)}` : 'Sem dados anteriores',
            delta: lucPorApDelta,
          },
          {
            label: 'Aparelhos Vendidos',
            value: String(unidades),
            cor: '#3b82f6',
            sub: unidadesPrev > 0 ? `Mês anterior: ${unidadesPrev} un.` : 'Sem dados anteriores',
            delta: unidadesPrev > 0 ? ((unidades - unidadesPrev) / unidadesPrev * 100) : null,
          },
        ].map(({ label, value, cor, sub, delta, deltaInverso }) => {
          const deltaOk = delta !== null && delta !== undefined;
          const deltaPos = deltaInverso ? delta < 0 : delta >= 0;
          return (
            <div key={label} className="dash-kpi-card" style={{ borderLeft: `4px solid ${cor}` }}>
              <div className="dash-kpi-label">{label}</div>
              <div className="dash-kpi-value" style={{ color: cor }}>{value}</div>
              <div className="dash-kpi-footer">
                {deltaOk && (
                  <span style={{ color: deltaPos ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: 11 }}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                  </span>
                )}
                <span className="dash-kpi-sub">{sub}</span>
              </div>
            </div>
          );
        })}
      </div>


      {/* Resumo de Produtos */}
      {resumoProdutos.length > 0 && (
        <div className="table-panel">
          <div className="table-header">
            <h2>Resumo de Produtos</h2>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{MESES[parseInt(mes) - 1]} {ano}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th style={{ textAlign: 'right' }}>Unidades</th>
                <th style={{ textAlign: 'right' }}>Faturamento</th>
                <th style={{ textAlign: 'right' }}>Ticket Médio</th>
                <th style={{ textAlign: 'right' }}>Lucro Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {resumoProdutos.map(p => (
                <tr key={p.produto}>
                  <td style={{ fontWeight: 600 }}>{p.produto}</td>
                  <td style={{ textAlign: 'right' }}>{p.unidades}</td>
                  <td style={{ textAlign: 'right', color: 'var(--entrada)', fontWeight: 700 }}>{fmt(p.faturamento)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(p.faturamento / p.unidades)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: p.lucro >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(p.lucro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Botão novo lançamento */}
      <div>
        <button className="btn btn-primary" onClick={abrirNovo}>
          ＋ Novo Lançamento
        </button>
      </div>

      {/* Tabela de últimos lançamentos */}
      <div className="table-panel">
        <div className="table-header">
          <h2>Últimos lançamentos</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lancamentos')}>Ver todos →</button>
        </div>

        {semCMV.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <div>Nenhum lançamento neste período</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {[['data','Data'],['tipo','Tipo'],['categoria','Categoria'],['subcategoria','Subcategoria'],['descricao','Descrição'],['status','Status']].map(([col, label]) => (
                    <th key={col} onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {label}{sortIcon(col)}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('valor')}>Valor{sortIcon('valor')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {semCMV.map(l => {
                  const cmv = l.grupoId ? lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV) : null;
                  return (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                      <td><span className={`tipo-badge tipo-${l.tipo}`}>{l.tipo}</span></td>
                      <td>{l.categoria}</td>
                      <td style={{ color: 'var(--text2)' }}>{l.subcategoria || '—'}</td>
                      <td>
                        {l.descricao}
                        {cmv && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                            <span style={{ background: '#f03e3e18', color: 'var(--saida)', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>CMV {fmt(cmv.valor)}</span>
                            <span style={{ color: (l.valor - cmv.valor) >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>Lucro {fmt(l.valor - cmv.valor)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: l.status === 'Pendente' ? 'var(--warn)' : 'var(--text2)' }}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: l.tipo === 'Entrada' ? 'var(--entrada)' : l.tipo === 'Saída' ? 'var(--saida)' : 'var(--transferencia)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {l.tipo === 'Entrada' ? '+' : l.tipo === 'Saída' ? '-' : ''}{fmt(l.valor)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(l)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmando(l)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo Lançamento */}
      {modalAberto && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && fecharModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editandoId ? `Editar Lançamento #${String(editandoId).padStart(3,'0')}` : 'Novo Lançamento'}</h3>
              <button className="modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label>Data</label>
                  <input type="date" value={form.data} onChange={e => setField('data', e.target.value)} />
                </div>
                <div className="field">
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={e => setField('tipo', e.target.value)} disabled={!!editandoId}>
                    <option>Entrada</option><option>Saída</option><option>Transferência</option>
                  </select>
                </div>
                <div className="field">
                  <label>{isEntrada ? 'Valor Venda (R$)' : 'Valor (R$)'}</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setField('valor', e.target.value)} />
                </div>
                {isEntrada && (
                  <div className="field">
                    <label>Dedução (R$)</label>
                    <input type="number" step="0.01" placeholder="taxa, desconto... (deixe vazio se não houver)" value={form.deducao} onChange={e => setField('deducao', e.target.value)} />
                  </div>
                )}
                <div className="field">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={e => setField('categoria', e.target.value)}>
                    <option value="">— selecione —</option>
                    {Object.entries(cats).map(([cat, subs]) =>
                      subs === null
                        ? <option key={cat} disabled style={{ color: 'var(--text2)', fontSize: 11 }}>{cat}</option>
                        : <option key={cat}>{cat}</option>
                    )}
                  </select>
                </div>
                <div className="field">
                  <label>Subcategoria</label>
                  <select value={form.subcategoria} onChange={e => setField('subcategoria', e.target.value)}>
                    <option value="">— selecione —</option>
                    {subcats.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field span2">
                  <label>Descrição</label>
                  <input type="text" placeholder="Descrição do lançamento" value={form.descricao} onChange={e => setField('descricao', e.target.value)} />
                </div>
                <div className="field">
                  <label>Pagamento</label>
                  <select value={form.pagamento} onChange={e => setField('pagamento', e.target.value)}>
                    <option value="">—</option>
                    <option>Dinheiro</option><option>Pix</option><option>Crédito</option>
                    <option>Débito</option><option>Boleto</option><option>Transferência</option><option>Outro</option>
                  </select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setField('status', e.target.value)}>
                    <option>Confirmado</option><option>Pendente</option>
                  </select>
                </div>
                {isEntrada && (
                  <div className="field">
                    <label>Quantidade</label>
                    <input type="number" placeholder="1" value={form.quantidade} onChange={e => setField('quantidade', e.target.value)} />
                  </div>
                )}
                <div className="field span2">
                  <label>Observações</label>
                  <input type="text" placeholder="Opcional" value={form.obs} onChange={e => setField('obs', e.target.value)} />
                </div>
              </div>

              {isEntrada && (
                <div className="cmv-section">
                  <div className="cmv-titulo">Custo da Mercadoria Vendida (CMV)</div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Valor CMV (R$)</label>
                      <input type="number" step="0.01" placeholder="0,00" value={form.cmvValor} onChange={e => setField('cmvValor', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Subcategoria CMV</label>
                      <select value={form.cmvSub} onChange={e => setField('cmvSub', e.target.value)}>
                        <option value="">— selecione —</option>
                        {cmvSubs.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  {margemPreview && (
                    <div className="margem-preview">
                      <span>Receita: <strong>{fmt(parseFloat(form.valor))}</strong></span>
                      <span>CMV: <strong style={{ color: 'var(--saida)' }}>{fmt(parseFloat(form.cmvValor))}</strong></span>
                      <span>Lucro: <strong style={{ color: margemPreview.lucro >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(margemPreview.lucro)}</strong></span>
                      <span>Margem: <strong style={{ color: margemPreview.margem >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{margemPreview.margem}%</strong></span>
                    </div>
                  )}
                </div>
              )}

              {erroForm && <div className="form-erro">{erroForm}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {confirmando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmando(null)}>
          <div className="modal-box modal-small">
            <div className="modal-header">
              <h3>Excluir Lançamento</h3>
              <button className="modal-close" onClick={() => setConfirmando(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                Excluir <strong style={{ color: 'var(--text)' }}>#{String(confirmando.id).padStart(3,'0')} — {confirmando.descricao}</strong> ({fmt(confirmando.valor)})?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmando(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => excluir(confirmando.id)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
