import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import { CATEGORIAS_CMV, getCatsPorTipo, getSubcats, getCmvSubAuto } from '../services/constants';
import { fmt, fmtData, hoje } from '../services/utils';
import './Lancamentos.css';

const BANCOS = [
  'Banco do Brasil', 'Bradesco', 'C6 Bank', 'Caixa Econômica Federal',
  'Infinity Pay', 'Intermediadora', 'Itaú', 'Mercado Pago',
  'Nubank', 'PagBank', 'Santander', 'Sicoob', 'Sicredi', 'Stone', 'SumUp',
];

const formVazio = (l, cmv, bancoAtivo) => ({
  data: l.data || hoje(),
  tipo: l.tipo,
  valor: l.valor,
  descricao: l.descricao || '',
  categoria: l.categoria || '',
  subcategoria: l.subcategoria || '',
  pagamento: l.pagamento || '',
  status: l.status || 'Confirmado',
  obs: l.obs || '',
  quantidade: l.quantidade || '',
  deducao: l.valorRecebido != null ? String(parseFloat(l.valor) - parseFloat(l.valorRecebido)) : '',
  valorUpgrade: l.valorUpgrade != null && l.valorUpgrade > 0 ? String(l.valorUpgrade) : '',
  qtdUpgrade:   l.qtdUpgrade   != null && l.qtdUpgrade   > 0 ? String(l.qtdUpgrade)   : '',
  banco:    l.banco || bancoAtivo || '',
  cmvValor: cmv ? cmv.valor : '',
  cmvCat:   cmv ? (cmv.categoria || 'Custos Variáveis Diretos') : 'Custos Variáveis Diretos',
  cmvSub:   cmv ? (cmv.subcategoria || '') : '',
  recebimentoAnterior: false,
});

export default function Lancamentos() {
  const { lancamentos, setLancamentos, clienteAtivo } = useApp();

  const [busca, setBusca]           = useState('');
  const [filtroTipo, setFiltroTipo]   = useState('');
  const [filtroCat, setFiltroCat]     = useState('');
  const [filtroSub, setFiltroSub]     = useState('');
  const [filtroMes, setFiltroMes]     = useState('');
  const [filtroBanco, setFiltroBanco] = useState('');

  const [editando, setEditando]         = useState(null);
  const [editandoCMV, setEditandoCMV]   = useState(null);
  const [form, setForm]                 = useState(null);
  const [salvando, setSalvando]         = useState(false);
  const [erroForm, setErroForm]         = useState('');
  const [confirmando, setConfirmando]         = useState(null);
  const [confirmandoTodos, setConfirmandoTodos] = useState(false);
  const [apagandoTodos, setApagandoTodos]       = useState(false);

  const [sortCol, setSortCol] = useState('data');
  const [sortDir, setSortDir] = useState('desc');

  const [extratoModal, setExtratoModal]   = useState(false);
  const [extratoLinhas, setExtratoLinhas] = useState([]);
  const [extratoProc, setExtratoProc]     = useState(false);
  const [extratoImp, setExtratoImp]       = useState(false);
  const [extratoErro, setExtratoErro]     = useState('');
  const [extratoInicio, setExtratoInicio] = useState('');
  const [extratoFim, setExtratoFim]       = useState('');
  const [extratoBanco, setExtratoBanco]   = useState('');

  const [bancoAtivo, setBancoAtivo] = useState('');

  // Mercado Phone
  const [mpModal, setMpModal]         = useState(false);
  const [mpChave, setMpChave]         = useState('');
  const [mpConfigurado, setMpConfigurado] = useState(null); // null=carregando, true/false
  const [mpInicio, setMpInicio]       = useState('');
  const [mpFim, setMpFim]             = useState('');
  const [mpBuscando, setMpBuscando]   = useState(false);
  const [mpImportando, setMpImportando] = useState(false);
  const [mpTransacoes, setMpTransacoes] = useState([]);
  const [mpSelecionados, setMpSelecionados] = useState(new Set());
  const [mpErro, setMpErro]           = useState('');
  const [mpSucesso, setMpSucesso]     = useState('');
  const [mpFiltroTexto, setMpFiltroTexto]   = useState('');
  const [mpApenasNovas, setMpApenasNovas]   = useState(false);
  const [mpSortCol, setMpSortCol]           = useState('data');
  const [mpSortDir, setMpSortDir]           = useState('asc');

  function mpToggleSort(col) {
    setMpSortCol(c => { setMpSortDir(d => c === col ? (d === 'asc' ? 'desc' : 'asc') : 'asc'); return col; });
  }

  const [dividindo, setDividindo]           = useState(null);
  const [dividirOrigem, setDividirOrigem]   = useState(null);
  const [dividirPartes, setDividirPartes]   = useState([]);
  const [dividirErro, setDividirErro]       = useState('');
  const [dividirSalvando, setDividirSalvando] = useState(false);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function sortIcon(col) {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const bancosOrdenados = useMemo(() => {
    const freq = {};
    lancamentos.forEach(l => { if (l.banco) freq[l.banco] = (freq[l.banco] || 0) + 1; });
    return [...BANCOS].sort((a, b) => (freq[b] || 0) - (freq[a] || 0));
  }, [lancamentos]);

  const todasCats  = useMemo(() => [...new Set(lancamentos.map(l => l.categoria))].filter(Boolean).sort(), [lancamentos]);
  const todasSubs  = useMemo(() => {
    const base = filtroCat ? lancamentos.filter(l => l.categoria === filtroCat) : lancamentos;
    return [...new Set(base.map(l => l.subcategoria))].filter(Boolean).sort();
  }, [lancamentos, filtroCat]);
  const todosMeses  = useMemo(() => [...new Set(lancamentos.map(l => l.data.slice(0,7)))].sort().reverse(), [lancamentos]);
  const todosBancos = useMemo(() => [...new Set(lancamentos.map(l => l.banco).filter(Boolean))].sort(), [lancamentos]);

  const semCMV = useMemo(() => lancamentos.filter(l => !(l.isCMV && l.grupoId)), [lancamentos]);

  const filtrados = useMemo(() => {
    let lista = semCMV;
    if (filtroTipo) lista = lista.filter(l => l.tipo === filtroTipo);
    if (filtroCat)  lista = lista.filter(l => l.categoria === filtroCat);
    if (filtroSub)  lista = lista.filter(l => l.subcategoria === filtroSub);
    if (filtroMes)   lista = lista.filter(l => l.data.startsWith(filtroMes));
    if (filtroBanco) lista = lista.filter(l => l.banco === filtroBanco);
    if (busca) {
      const b = busca.toLowerCase();
      lista = lista.filter(l =>
        (l.descricao||'').toLowerCase().includes(b) ||
        (l.categoria||'').toLowerCase().includes(b) ||
        (l.subcategoria||'').toLowerCase().includes(b) ||
        String(l.id).includes(b)
      );
    }
    return lista;
  }, [semCMV, filtroTipo, filtroCat, filtroSub, filtroMes, filtroBanco, busca]);

  const filtradosOrdenados = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (sortCol === 'valor') { va = parseFloat(va); vb = parseFloat(vb); }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtrados, sortCol, sortDir]);

  const totaisFiltro = useMemo(() => {
    const entradas = filtrados.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + parseFloat(l.valorRecebido ?? l.valor), 0);
    const saidas   = filtrados.filter(l => l.tipo === 'Saída').reduce((a, l) => a + parseFloat(l.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtrados]);

  const cats     = form ? getCatsPorTipo(form.tipo) : {};
  const subcats  = form ? getSubcats(form.categoria) : [];
  const cmvCats  = CATEGORIAS_CMV;
  const cmvSubs  = form ? getSubcats(form.cmvCat) : [];

  const isEntrada = form?.tipo === 'Entrada';
  const margemPreview = isEntrada && form?.cmvValor
    ? (() => {
        const rec   = parseFloat(form.valor) || 0;
        const cmv   = parseFloat(form.cmvValor) || 0;
        const lucro = rec - cmv;
        return { lucro, margem: rec > 0 ? (lucro / rec * 100).toFixed(2) : '—' };
      })()
    : null;

  function setField(campo, valor) {
    setForm(f => {
      const novo = { ...f, [campo]: valor };
      if (campo === 'categoria')   { novo.subcategoria = ''; novo.cmvSub = getCmvSubAuto(valor, ''); if (valor !== 'Aparelhos') { novo.valorUpgrade = ''; } }
      if (campo === 'subcategoria'){ novo.cmvSub = getCmvSubAuto(f.categoria, valor); }
      if (campo === 'cmvCat')      { novo.cmvSub = ''; }
      return novo;
    });
  }

  function abrirEditar(l) {
    const cmv = l.tipo !== 'Entrada' ? null : (() => {
      if (l.grupoId) {
        const byGrupo = lancamentos.find(x => x.grupoId === l.grupoId && x.id !== l.id && (x.isCMV || x.tipo === 'Saída'));
        if (byGrupo) return byGrupo;
      }
      const byObs = lancamentos.find(x => x.id !== l.id && (x.obs || '').includes('#' + String(l.id).padStart(3, '0')));
      if (byObs) return byObs;
      if (!l.grupoId) return lancamentos.find(x =>
        x.id !== l.id && x.data === l.data && x.tipo === 'Saída' &&
        (x.isCMV || (x.descricao || '').startsWith('CMV'))
      ) || null;
      return null;
    })();
    setEditando(l);
    setEditandoCMV(cmv || null);
    setForm(formVazio(l, cmv, bancoAtivo));
    setErroForm('');
  }

  function fecharModal() {
    if (form?.banco) setBancoAtivo(form.banco);
    setEditando(null); setEditandoCMV(null); setForm(null);
  }

  async function salvar() {
    const valorNum = parseFloat(form.valor);
    if (isNaN(valorNum) || valorNum < 0) { setErroForm('Informe um valor válido (mínimo R$ 0,00)'); return; }
    if (!form.categoria) { setErroForm('Selecione a categoria'); return; }
    setSalvando(true); setErroForm('');
    try {
      const valorBruto    = parseFloat(form.valor);
      const deducaoRaw    = parseFloat(form.deducao);
      const deducao       = !isNaN(deducaoRaw) && deducaoRaw > 0 && deducaoRaw < valorBruto ? deducaoRaw : null;
      const valorRecebido = deducao !== null ? valorBruto - deducao : null;
      const upgradeVal    = parseFloat(form.valorUpgrade) > 0 ? parseFloat(form.valorUpgrade) : null;
      const qtdUpgradeVal = upgradeVal && parseInt(form.qtdUpgrade) > 0 ? parseInt(form.qtdUpgrade) : null;

      let grupoId = editando.grupoId || null;
      let atualizadoCMV = null;
      let novoCMV = null;

      let cmvExcluido = false;
      if (isEntrada && !form.recebimentoAnterior && form.cmvValor && parseFloat(form.cmvValor) > 0) {
        if (editandoCMV) {
          grupoId = editando.grupoId || editandoCMV.grupoId || ('g' + Date.now());
          atualizadoCMV = await API.editarLancamento(clienteAtivo.id, editandoCMV.id, {
            data: form.data, tipo: 'Saída',
            valor: parseFloat(form.cmvValor),
            categoria: form.cmvCat || editandoCMV.categoria,
            subcategoria: form.cmvSub || editandoCMV.subcategoria,
            descricao: editandoCMV.descricao,
            pagamento: form.pagamento, status: form.status,
            obs: editandoCMV.obs,
            grupo_id: grupoId, is_cmv: true,
          });
        } else {
          grupoId = grupoId || ('g' + Date.now());
          novoCMV = await API.criarLancamento(clienteAtivo.id, {
            tipo: 'Saída', valor: parseFloat(form.cmvValor), data: form.data,
            categoria: form.cmvCat, subcategoria: form.cmvSub,
            descricao: 'CMV — ' + form.descricao,
            pagamento: form.pagamento, status: form.status,
            obs: 'CMV vinculado ao #' + String(editando.id).padStart(3, '0'),
            grupo_id: grupoId, is_cmv: true,
          });
        }
      } else if (editandoCMV) {
        // usuário removeu CMV — exclui do banco e desvincula grupo
        await API.excluirLancamento(clienteAtivo.id, editandoCMV.id);
        grupoId = null;
        cmvExcluido = true;
      }

      let atualizado;
      try {
        atualizado = await API.editarLancamento(clienteAtivo.id, editando.id, {
          data: form.data, tipo: form.tipo, valor: valorBruto,
          categoria: form.categoria, subcategoria: form.subcategoria,
          descricao: form.descricao, pagamento: form.pagamento,
          status: form.status, obs: form.obs,
          quantidade: !isEntrada ? null : form.recebimentoAnterior ? 0 : (parseInt(form.quantidade) || null),
          valor_recebido: valorRecebido,
          grupo_id: grupoId,
          valor_upgrade: upgradeVal, qtd_upgrade: qtdUpgradeVal,
          banco: form.banco || null,
        });
      } catch (err) {
        // rollback novoCMV criado nesta operação se o lançamento principal falhou
        if (novoCMV) await API.excluirLancamento(clienteAtivo.id, novoCMV.id).catch(() => {});
        throw err;
      }

      setLancamentos(prev => {
        let lista = prev.map(l => {
          if (l.id === editando.id) return { ...l, ...atualizado, grupoId, valorRecebido, valorUpgrade: upgradeVal };
          if (atualizadoCMV && l.id === editandoCMV.id) return { ...l, ...atualizadoCMV };
          return l;
        });
        if (novoCMV) lista = [novoCMV, ...lista];
        if (cmvExcluido) lista = lista.filter(l => l.id !== editandoCMV.id);
        return lista;
      });
      fecharModal();
    } catch (err) {
      setErroForm(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirTodos() {
    setApagandoTodos(true);
    const removidos = new Set();
    try {
      for (const l of filtrados) {
        try {
          await API.excluirLancamento(clienteAtivo.id, l.id);
          removidos.add(l.id);
          const cmvPar = lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV && l.grupoId);
          if (cmvPar) {
            await API.excluirLancamento(clienteAtivo.id, cmvPar.id).catch(() => {});
            removidos.add(cmvPar.id);
          }
        } catch (err) { console.error('[excluirTodos] falha ao excluir:', err.message); }
      }
    } finally {
      if (removidos.size) setLancamentos(prev => prev.filter(l => !removidos.has(l.id)));
      setApagandoTodos(false);
      setConfirmandoTodos(false);
    }
  }

  async function excluir(id) {
    setConfirmando(null);
    try {
      await API.excluirLancamento(clienteAtivo.id, id);
      const sem    = lancamentos.filter(l => l.id !== id);
      const pais   = new Set(sem.filter(l => l.grupoId && !l.isCMV).map(l => l.grupoId));
      const orfaos = sem.filter(l => l.isCMV && !pais.has(l.grupoId));
      await Promise.allSettled(orfaos.map(o => API.excluirLancamento(clienteAtivo.id, o.id)));
      setLancamentos(sem.filter(l => !l.isCMV || pais.has(l.grupoId)));
    } catch (err) { console.error(err); }
  }


  async function processarArquivo(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    // Auto-detecta banco pelo nome do arquivo
    const nomeArq = arquivo.name.toLowerCase();
    const bancoDetectado = BANCOS.find(b => nomeArq.includes(b.toLowerCase().replace(/\s/g, '')));
    if (bancoDetectado && !extratoBanco) setExtratoBanco(bancoDetectado);
    setExtratoProc(true); setExtratoErro(''); setExtratoLinhas([]);
    try {
      const res = await API.processarExtrato(clienteAtivo.id, arquivo, extratoInicio || null, extratoFim || null);
      if (res.erro) throw new Error(res.erro);
      const sorted = (res.transacoes || []).slice().sort((a, b) => a.data.localeCompare(b.data));
      const tokens = s => (s || '').toLowerCase().replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(w => w.length > 3);
      setExtratoLinhas(sorted.map((t, i) => {
        const tValor = parseFloat(t.valor);
        const dup = lancamentos.some(l =>
          l.data === t.data &&
          Math.abs(parseFloat(l.valor) - tValor) < 0.01 &&
          tokens(l.descricao).some(w => tokens(t.descricao).includes(w))
        );
        return { ...t, _id: i, _duplicata: dup };
      }));
    } catch (err) { setExtratoErro(err.message); }
    finally { setExtratoProc(false); e.target.value = ''; }
  }

  function editarLinha(id, campo, valor) {
    setExtratoLinhas(prev => prev.map(l => {
      if (l._id !== id) return l;
      const updated = { ...l, [campo]: valor };
      if (campo === 'categoria_sugerida') updated.subcategoria_sugerida = '';
      return updated;
    }));
  }

  function abrirDividir(item, origem) {
    const desc = item.descricao || '';
    const cat  = origem === 'extrato' ? (item.categoria_sugerida || '') : (item.categoria || '');
    const sub  = origem === 'extrato' ? (item.subcategoria_sugerida || '') : (item.subcategoria || '');
    setDividindo(item);
    setDividirOrigem(origem);
    setDividirPartes([
      { descricao: desc, categoria: cat, subcategoria: sub, valor: '' },
      { descricao: desc, categoria: '', subcategoria: '', valor: '' },
    ]);
    setDividirErro('');
  }

  function setParte(i, campo, valor) {
    setDividirPartes(prev => prev.map((p, idx) => {
      if (idx !== i) return p;
      const np = { ...p, [campo]: valor };
      if (campo === 'categoria') np.subcategoria = '';
      return np;
    }));
  }

  async function confirmarDividir() {
    const total    = dividirPartes.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
    const original = parseFloat(dividindo.valor);
    if (Math.abs(total - original) > 0.01) {
      setDividirErro(`Soma das partes (${fmt(total)}) deve ser igual ao total (${fmt(original)})`);
      return;
    }
    if (dividirPartes.some(p => !p.categoria)) { setDividirErro('Selecione categoria em todas as partes'); return; }
    setDividirSalvando(true); setDividirErro('');
    try {
      if (dividirOrigem === 'extrato') {
        const base = Math.max(0, ...extratoLinhas.map(l => l._id));
        const novas = dividirPartes.map((p, i) => ({
          _id: base + i + 1,
          data: dividindo.data,
          descricao: p.descricao || dividindo.descricao,
          tipo: dividindo.tipo,
          valor: parseFloat(p.valor),
          categoria_sugerida: p.categoria,
          subcategoria_sugerida: p.subcategoria || '',
        }));
        setExtratoLinhas(prev =>
          [...prev.filter(l => l._id !== dividindo._id), ...novas]
            .sort((a, b) => a.data.localeCompare(b.data))
        );
      } else {
        const criados = [];
        for (const p of dividirPartes) {
          const novo = await API.criarLancamento(clienteAtivo.id, {
            tipo: dividindo.tipo, valor: parseFloat(p.valor), data: dividindo.data,
            categoria: p.categoria, subcategoria: p.subcategoria || '',
            descricao: p.descricao || dividindo.descricao,
            status: dividindo.status || 'Confirmado',
          });
          criados.push(novo);
        }
        try {
          await API.excluirLancamento(clienteAtivo.id, dividindo.id);
        } catch (err) {
          // rollback: exclui as partes já criadas para evitar duplicação
          await Promise.allSettled(criados.map(c => API.excluirLancamento(clienteAtivo.id, c.id)));
          throw err;
        }
        setLancamentos(prev => [...criados, ...prev.filter(l => l.id !== dividindo.id)]);
        if (editando?.id === dividindo.id) fecharModal();
      }
      setDividindo(null);
    } catch (err) {
      setDividirErro(err.message || 'Erro ao dividir');
    } finally {
      setDividirSalvando(false);
    }
  }

  async function importarExtrato() {
    setExtratoImp(true); setExtratoErro('');
    const criados = [];
    let falhas = 0;
    for (const t of extratoLinhas) {
      try {
        const novo = await API.criarLancamento(clienteAtivo.id, {
          tipo: t.tipo, valor: parseFloat(t.valor), data: t.data,
          categoria: t.categoria_sugerida || '', subcategoria: t.subcategoria_sugerida || '',
          descricao: t.descricao || '', status: 'Confirmado',
          banco: extratoBanco || null,
        });
        criados.push(novo);
      } catch (err) { console.error('[importarExtrato] falha na linha:', t, err.message); falhas++; }
    }
    if (criados.length > 0) {
      setLancamentos(prev => [...criados, ...prev]);
      API.salvarRegrasExtrato(clienteAtivo.id, extratoLinhas.filter(t => t.categoria_sugerida).map(t => ({
        descricao: t.descricao, categoria: t.categoria_sugerida, subcategoria: t.subcategoria_sugerida,
      }))).catch(() => {});
    }
    if (falhas > 0) {
      setExtratoErro(`${criados.length} importado(s) com sucesso. ${falhas} falhou(aram) — verifique e tente novamente.`);
    } else {
      setExtratoModal(false); setExtratoLinhas([]); setExtratoBanco('');
    }
    setExtratoImp(false);
  }

  async function abrirMpModal() {
    setMpModal(true); setMpTransacoes([]); setMpErro(''); setMpSucesso(''); setMpChave('');
    try {
      const { configurado } = await API.mpStatus(clienteAtivo.id);
      setMpConfigurado(configurado);
    } catch { setMpConfigurado(false); }
  }

  async function mpSalvarChave() {
    if (!mpChave.trim()) return;
    try {
      await API.mpSalvarChave(clienteAtivo.id, mpChave.trim());
      setMpConfigurado(true); setMpChave('');
    } catch (err) { setMpErro(err.message || 'Erro ao salvar chave'); }
  }

  async function mpBuscar() {
    setMpBuscando(true); setMpErro(''); setMpTransacoes([]); setMpSucesso(''); setMpFiltroTexto(''); setMpApenasNovas(false);
    try {
      const { transacoes } = await API.mpPreview(clienteAtivo.id, mpInicio || null, mpFim || null);
      setMpTransacoes(transacoes);
      const novos = new Set(transacoes.filter(t => !t.jaImportado).map((_, i) => i));
      setMpSelecionados(novos);
    } catch (err) { setMpErro(err.message || 'Erro ao buscar vendas'); }
    finally { setMpBuscando(false); }
  }

  function editarMpLinha(i, campo, valor) {
    setMpTransacoes(prev => prev.map((t, idx) => {
      if (idx !== i) return t;
      const updated = { ...t, [campo]: valor };
      if (campo === 'categoria') updated.subcategoria = '';
      return updated;
    }));
  }

  async function mpImportar() {
    const selecionadas = mpTransacoes.filter((_, i) => mpSelecionados.has(i)).map(t => ({
      ...t,
      valorUpgrade: t.isUpgrade && parseFloat(t.valorUpgrade) > 0 ? parseFloat(t.valorUpgrade) : null,
    }));
    if (!selecionadas.length) return;
    setMpImportando(true); setMpErro('');
    try {
      const { importados } = await API.mpImportar(clienteAtivo.id, selecionadas);
      const novas = await API.listarLancamentos(clienteAtivo.id);
      setLancamentos(novas);
      setMpSucesso(`${importados} venda(s) importada(s) com sucesso!`);
      setMpTransacoes([]);
    } catch (err) { setMpErro(err.message || 'Erro ao importar'); }
    finally { setMpImportando(false); }
  }

  return (
    <div className="lancamentos-page">
      <div className="table-panel">
        <div className="table-header">
          <h2>Todos os Lançamentos</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => { setExtratoModal(true); setExtratoLinhas([]); setExtratoErro(''); }}>⬆ Importar Extrato</button>
          <button className="btn btn-ghost btn-sm" onClick={abrirMpModal} style={{ color: 'var(--primary)' }}>⬇ Mercado Phone</button>
          <input className="search-box" placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="filter-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option>Entrada</option><option>Saída</option><option>Transferência</option>
          </select>
          <select className="filter-select" value={filtroCat} onChange={e => { setFiltroCat(e.target.value); setFiltroSub(''); }}>
            <option value="">Todas categorias</option>
            {todasCats.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={filtroSub} onChange={e => setFiltroSub(e.target.value)}>
            <option value="">Todas subcategorias</option>
            {todasSubs.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="filter-select" value={filtroBanco} onChange={e => setFiltroBanco(e.target.value)}>
            <option value="">Todos os bancos</option>
            {todosBancos.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="filter-select" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {todosMeses.map(m => {
              const [y, mo] = m.split('-');
              return <option key={m} value={m}>{new Date(y, mo-1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
        </div>

        {filtrados.length > 0 && (
          <div style={{ display: 'flex', gap: 20, padding: '10px 0', fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text2)' }}>{filtrados.length} lançamento{filtrados.length !== 1 ? 's' : ''}</span>
            {totaisFiltro.entradas > 0 && <span style={{ color: 'var(--entrada)', fontWeight: 700 }}>Entradas: +{fmt(totaisFiltro.entradas)}</span>}
            {totaisFiltro.saidas   > 0 && <span style={{ color: 'var(--saida)',   fontWeight: 700 }}>Saídas: -{fmt(totaisFiltro.saidas)}</span>}
            {totaisFiltro.entradas > 0 && totaisFiltro.saidas > 0 && (
              <span style={{ color: totaisFiltro.saldo >= 0 ? 'var(--entrada)' : 'var(--saida)', fontWeight: 700 }}>
                Saldo: {fmt(totaisFiltro.saldo)}
              </span>
            )}
            <button
              className="btn btn-sm"
              style={{ marginLeft: 'auto', background: '#f03e3e22', color: '#f03e3e', border: '1px solid #f03e3e44' }}
              onClick={() => setConfirmandoTodos(true)}
            >
              🗑 Apagar {filtrados.length} lançamento{filtrados.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <div>Nenhum lançamento encontrado</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  {[['data','Data'],['tipo','Tipo'],['categoria','Categoria'],['subcategoria','Subcategoria'],['descricao','Descrição'],['banco','Banco'],['pagamento','Pagamento'],['status','Status']].map(([col, label]) => (
                    <th key={col} onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {label}{sortIcon(col)}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort('valor')}>
                    Valor{sortIcon('valor')}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtradosOrdenados.map(l => {
                  const cmv = l.grupoId ? lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV) : null;
                  return (
                    <tr key={l.id}>
                      <td className="id-cell">#{String(l.id).padStart(3,'0')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                      <td><span className={`tipo-badge tipo-${l.tipo}`}>{l.tipo}</span></td>
                      <td>{l.categoria}</td>
                      <td style={{ color: 'var(--text2)' }}>{l.subcategoria || '—'}</td>
                      <td>
                        {l.descricao}
                        {cmv && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 11 }}>
                            <span style={{ background: '#f03e3e18', color: 'var(--saida)', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>CMV {fmt(cmv.valor)}</span>
                            {(() => {
                              const rec   = parseFloat(l.valorRecebido ?? l.valor);
                              const lucro = rec - cmv.valor;
                              return (
                                <span style={{ color: lucro >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>
                                  Lucro {fmt(lucro)} · Margem {rec > 0 ? (lucro / rec * 100).toFixed(2) : 0}%
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--text2)' }}>{l.banco || '—'}</td>
                      <td style={{ color: 'var(--text2)' }}>{l.pagamento || '—'}</td>
                      <td><span style={{ fontSize: 11, color: l.status === 'Pendente' ? 'var(--warn)' : 'var(--text2)' }}>{l.status}</span></td>
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

      {/* Modal Editar */}
      {editando && form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && fecharModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>Editar Lançamento #{String(editando.id).padStart(3,'0')}</h3>
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
                  <select value={form.tipo} disabled>
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
                  <input type="text" value={form.descricao} onChange={e => setField('descricao', e.target.value)} />
                </div>
                <div className="field">
                  <label>Banco</label>
                  <select value={form.banco} onChange={e => setField('banco', e.target.value)}>
                    <option value="">— selecione —</option>
                    {bancosOrdenados.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Pagamento</label>
                  <select value={form.pagamento} onChange={e => setField('pagamento', e.target.value)}>
                    <option value="">—</option>
                    <option>Dinheiro</option><option>Pix</option><option>Crédito</option>
                    <option>Débito</option><option>Boleto</option><option>Transferência</option><option>Outro</option>
                  </select>
                </div>
                {isEntrada && !form.recebimentoAnterior && (
                  <div className="field">
                    <label>Quantidade</label>
                    <input type="number" value={form.quantidade} onChange={e => setField('quantidade', e.target.value)} />
                  </div>
                )}
                {isEntrada && !form.recebimentoAnterior && (
                  <div className="field">
                    <label>Valor do Upgrade (R$)</label>
                    <input type="number" step="0.01" placeholder="Deixe vazio se não houver upgrade" value={form.valorUpgrade} onChange={e => setField('valorUpgrade', e.target.value)} />
                  </div>
                )}
                {isEntrada && !form.recebimentoAnterior && form.valorUpgrade > 0 && (
                  <div className="field">
                    <label>Qtd. de Upgrades</label>
                    <input type="number" min="1" placeholder="1" value={form.qtdUpgrade} onChange={e => setField('qtdUpgrade', e.target.value)} />
                  </div>
                )}
                <div className="field span2">
                  <label>Observações</label>
                  <input type="text" value={form.obs} onChange={e => setField('obs', e.target.value)} />
                </div>
              </div>

              {isEntrada && (
                <div
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--surface2)', borderRadius:8, marginBottom:8, cursor:'pointer', userSelect:'none' }}
                  onClick={() => setField('recebimentoAnterior', !form.recebimentoAnterior)}
                >
                  <input type="checkbox" checked={form.recebimentoAnterior || false} onChange={() => {}} style={{ cursor:'pointer', accentColor:'var(--primary)', width:16, height:16 }} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>CMV já registrado</div>
                    <div style={{ color:'var(--text2)', fontSize:12 }}>Recebimento de venda anterior — não gerar novo custo</div>
                  </div>
                </div>
              )}

              {isEntrada && !form.recebimentoAnterior && (
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
                      <span>Margem: <strong style={{ color: margemPreview.margem === '—' ? 'var(--text2)' : margemPreview.margem >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{margemPreview.margem === '—' ? '—' : `${margemPreview.margem}%`}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {erroForm && <div className="form-erro">{erroForm}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-ghost" onClick={() => abrirDividir(editando, 'lancamento')} style={{ color: 'var(--text2)' }}>
                ✂️ Dividir
              </button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
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

      {confirmandoTodos && (
        <div className="modal-overlay" onClick={() => !apagandoTodos && setConfirmandoTodos(false)}>
          <div className="modal-box modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apagar lançamentos filtrados</h3>
              <button className="modal-close" onClick={() => !apagandoTodos && setConfirmandoTodos(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text)' }}>
                Você está prestes a apagar <strong style={{ color: '#f03e3e' }}>{filtrados.length} lançamento{filtrados.length !== 1 ? 's' : ''}</strong> com os filtros atuais.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmandoTodos(false)} disabled={apagandoTodos}>Cancelar</button>
              <button className="btn-danger" onClick={excluirTodos} disabled={apagandoTodos}>
                {apagandoTodos ? 'Apagando...' : `Apagar ${filtrados.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {extratoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setExtratoModal(false)}>
          <div className="modal-box" style={{ maxWidth: 900, width: '95vw' }}>
            <div className="modal-header">
              <h3>Importar Extrato Bancário</h3>
              <button className="modal-close" onClick={() => setExtratoModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>Envie o PDF ou imagem do extrato. A IA vai ler e categorizar as transações automaticamente.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Banco:</span>
                <select value={extratoBanco} onChange={e => setExtratoBanco(e.target.value)} disabled={extratoProc}
                  style={{ fontSize: 13, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)' }}>
                  <option value="">— selecione —</option>
                  {BANCOS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Período (opcional):</span>
                <input type="date" value={extratoInicio} onChange={e => setExtratoInicio(e.target.value)} disabled={extratoProc} style={{ fontSize: 13 }} />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>até</span>
                <input type="date" value={extratoFim} onChange={e => setExtratoFim(e.target.value)} disabled={extratoProc} style={{ fontSize: 13 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="file" accept=".pdf,image/*" onChange={processarArquivo} disabled={extratoProc} style={{ fontSize: 13 }} />
                {extratoProc && <span style={{ fontSize: 13, color: 'var(--text2)' }}>Processando...</span>}
              </label>
              {extratoErro && <p style={{ color: 'var(--saida)', fontSize: 13 }}>{extratoErro}</p>}
              {extratoLinhas.length > 0 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {extratoLinhas.length} transações encontradas. Revise antes de importar.
                    {extratoLinhas.some(l => l._duplicata) && (
                      <span style={{ marginLeft: 8, color: '#ca8a04', fontWeight: 600 }}>
                        ⚠️ {extratoLinhas.filter(l => l._duplicata).length} possível(is) duplicata(s) — remova com ✕ se já existir.
                      </span>
                    )}
                  </p>
                  <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Data</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 200 }}>Descrição</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Tipo</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Valor</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 160 }}>Categoria</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 160 }}>Subcategoria</th>
                          <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {extratoLinhas.map(l => (
                          <tr key={l._id} style={{ borderBottom: '1px solid var(--border)', background: l._duplicata ? 'rgba(202,138,4,0.08)' : undefined }}>
                            <td style={{ padding: '6px 10px' }}>
                              <input type="date" value={l.data} onChange={e => editarLinha(l._id, 'data', e.target.value)}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '2px 4px', fontSize: 12 }} />
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {l._duplicata && <span title="Possível duplicata" style={{ color: '#ca8a04', fontSize: 13, flexShrink: 0 }}>⚠️</span>}
                                <input value={l.descricao} onChange={e => editarLinha(l._id, 'descricao', e.target.value)}
                                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '2px 6px', fontSize: 12, width: '100%' }} />
                              </div>
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <select value={l.tipo} onChange={e => editarLinha(l._id, 'tipo', e.target.value)}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: l.tipo === 'Entrada' ? 'var(--entrada)' : 'var(--saida)', padding: '2px 4px', fontSize: 12 }}>
                                <option>Entrada</option><option>Saída</option>
                              </select>
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: l.tipo === 'Entrada' ? 'var(--entrada)' : 'var(--saida)' }}>
                              <input type="number" value={l.valor} onChange={e => editarLinha(l._id, 'valor', e.target.value)}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', padding: '2px 4px', fontSize: 12, width: 90, textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <select value={l.categoria_sugerida || ''} onChange={e => editarLinha(l._id, 'categoria_sugerida', e.target.value)}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text2)', padding: '2px 4px', fontSize: 12, width: '100%' }}>
                                <option value="">— selecione —</option>
                                {Object.entries(getCatsPorTipo('Saída')).filter(([,v]) => v !== null).map(([cat]) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <select value={l.subcategoria_sugerida || ''} onChange={e => editarLinha(l._id, 'subcategoria_sugerida', e.target.value)}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text2)', padding: '2px 4px', fontSize: 12, width: '100%' }}>
                                <option value="">— selecione —</option>
                                {getSubcats(l.categoria_sugerida || '').map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => abrirDividir(l, 'extrato')}
                                  title="Dividir em partes"
                                  style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>✂️</button>
                                <button onClick={() => setExtratoLinhas(p => p.filter(x => x._id !== l._id))}
                                  style={{ background: 'none', border: 'none', color: 'var(--saida)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setExtratoModal(false)}>Cancelar</button>
              {extratoLinhas.length > 0 && (
                <button className="btn btn-primary" onClick={importarExtrato} disabled={extratoImp}>
                  {extratoImp ? 'Importando...' : `Importar ${extratoLinhas.length} lançamentos`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Dividir Lançamento */}
      {dividindo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !dividirSalvando && setDividindo(null)}>
          <div className="modal-box" style={{ maxWidth: 720, width: '95vw' }}>
            <div className="modal-header">
              <h3>✂️ Dividir: {dividindo.descricao}</h3>
              <button className="modal-close" onClick={() => !dividirSalvando && setDividindo(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const totalPartes = dividirPartes.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
                const original    = parseFloat(dividindo.valor);
                const restante    = original - totalPartes;
                const ok          = Math.abs(restante) < 0.01;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13 }}>
                    <span>Total original: <strong>{fmt(original)}</strong></span>
                    <span>Distribuído: <strong style={{ color: ok ? 'var(--entrada)' : totalPartes > original ? 'var(--saida)' : 'var(--text)' }}>{fmt(totalPartes)}</strong></span>
                    {!ok && (
                      <span style={{ color: restante > 0 ? 'var(--warn)' : 'var(--saida)', fontWeight: 600 }}>
                        {restante > 0 ? `Falta: ${fmt(restante)}` : `Excede: ${fmt(-restante)}`}
                      </span>
                    )}
                    {ok && <span style={{ color: 'var(--entrada)', fontWeight: 600 }}>✓ OK</span>}
                  </div>
                );
              })()}

              {dividirPartes.map((parte, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 28px', gap: 8, alignItems: 'center' }}>
                  <input
                    placeholder="Descrição"
                    value={parte.descricao}
                    onChange={e => setParte(i, 'descricao', e.target.value)}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 8px', fontSize: 12 }}
                  />
                  <select
                    value={parte.categoria}
                    onChange={e => setParte(i, 'categoria', e.target.value)}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 6px', fontSize: 12 }}
                  >
                    <option value="">— categoria —</option>
                    {Object.entries(getCatsPorTipo(dividindo.tipo || 'Saída')).filter(([,v]) => v !== null).map(([cat]) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select
                    value={parte.subcategoria}
                    onChange={e => setParte(i, 'subcategoria', e.target.value)}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 6px', fontSize: 12 }}
                  >
                    <option value="">— subcategoria —</option>
                    {getSubcats(parte.categoria).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="R$"
                    value={parte.valor}
                    onChange={e => setParte(i, 'valor', e.target.value)}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 6px', fontSize: 12, textAlign: 'right' }}
                  />
                  {dividirPartes.length > 2 ? (
                    <button
                      onClick={() => setDividirPartes(p => p.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--saida)', cursor: 'pointer', fontSize: 16, padding: 0 }}
                    >✕</button>
                  ) : <span />}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDividirPartes(p => [...p, { descricao: dividindo.descricao || '', categoria: '', subcategoria: '', valor: '' }])}
                >
                  + Adicionar parte
                </button>
                {(() => {
                  const totalPartes = dividirPartes.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
                  const restante = parseFloat(dividindo.valor) - totalPartes;
                  return restante > 0.01 ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const lastEmpty = dividirPartes.map((p, i) => (!p.valor ? i : -1)).filter(i => i >= 0).pop();
                        if (lastEmpty != null) setParte(lastEmpty, 'valor', restante.toFixed(2));
                        else setDividirPartes(p => [...p, { descricao: dividindo.descricao || '', categoria: '', subcategoria: '', valor: restante.toFixed(2) }]);
                      }}
                      style={{ color: 'var(--text2)' }}
                    >
                      Preencher restante ({fmt(restante)})
                    </button>
                  ) : null;
                })()}
              </div>

              {dividirErro && <div className="form-erro">{dividirErro}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDividindo(null)} disabled={dividirSalvando}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={confirmarDividir}
                disabled={dividirSalvando || Math.abs(dividirPartes.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0) - parseFloat(dividindo.valor)) > 0.01}
              >
                {dividirSalvando ? 'Salvando...' : `Confirmar divisão (${dividirPartes.length} partes)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mercado Phone */}
      {mpModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMpModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 12, display: 'flex', flexDirection: 'column',
            width: '98vw', maxWidth: 1400, maxHeight: '92vh',
            boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Importar do Mercado Phone</div>
                {mpConfigurado === true && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    Selecione o período, revise as categorias e importe
                  </div>
                )}
              </div>
              {mpConfigurado === true && (
                <span style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setMpConfigurado(false)}>Trocar chave</span>
              )}
              <button className="modal-close" onClick={() => setMpModal(false)}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 16 }}>

              {/* Chave não configurada */}
              {mpConfigurado === false && (
                <div style={{ maxWidth: 500 }}>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                    Cole a chave de API do Mercado Phone para este cliente (começa com <code>mpk_</code>):
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" placeholder="mpk_..." value={mpChave} onChange={e => setMpChave(e.target.value)}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
                    <button className="btn btn-primary" onClick={mpSalvarChave} disabled={!mpChave.trim()}>Salvar</button>
                  </div>
                </div>
              )}

              {mpConfigurado === null && (
                <p style={{ fontSize: 13, color: 'var(--text2)' }}>Verificando configuração...</p>
              )}

              {/* Configurado */}
              {mpConfigurado === true && (
                <>
                  {/* Filtros de período */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data início</label>
                      <input type="date" value={mpInicio} onChange={e => setMpInicio(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data fim</label>
                      <input type="date" value={mpFim} onChange={e => setMpFim(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
                    </div>
                    <button className="btn btn-primary" onClick={mpBuscar} disabled={mpBuscando} style={{ alignSelf: 'flex-end' }}>
                      {mpBuscando ? 'Buscando...' : 'Buscar vendas'}
                    </button>
                  </div>

                  {/* Barra de resumo */}
                  {mpTransacoes.length > 0 && (() => {
                    const novas     = mpTransacoes.filter(t => !t.jaImportado);
                    const selArr    = [...mpSelecionados].map(i => mpTransacoes[i]).filter(Boolean);
                    const totalVal  = selArr.reduce((s, t) => s + (t.valor || 0), 0);
                    const totalCmv  = selArr.reduce((s, t) => s + (t.cmvValor || 0), 0);
                    const lucro     = totalVal - totalCmv;
                    return (
                      <div style={{ display: 'flex', gap: 0, background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                        {[
                          { label: 'Encontradas', val: mpTransacoes.length, color: 'var(--text)' },
                          { label: 'Novas', val: novas.length, color: 'var(--primary)' },
                          { label: 'Selecionadas', val: mpSelecionados.size, color: 'var(--text)' },
                          { label: 'Receita selecionada', val: fmt(totalVal), color: 'var(--entrada)' },
                          { label: 'CMV selecionado', val: fmt(totalCmv), color: 'var(--saida)' },
                          { label: 'Lucro estimado', val: fmt(lucro), color: lucro >= 0 ? 'var(--entrada)' : 'var(--saida)' },
                        ].map(({ label, val, color }) => (
                          <div key={label} style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Ações da tabela + filtro */}
                  {mpTransacoes.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                      <button style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        onClick={() => setMpSelecionados(new Set(mpTransacoes.map((_, i) => i).filter(i => !mpTransacoes[i].jaImportado)))}>
                        Selecionar novas
                      </button>
                      <button style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 0 }}
                        onClick={() => setMpSelecionados(new Set())}>
                        Desmarcar todas
                      </button>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <input
                          type="text"
                          placeholder="Buscar produto, cliente ou vendedor..."
                          value={mpFiltroTexto}
                          onChange={e => setMpFiltroTexto(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12 }}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={mpApenasNovas} onChange={e => setMpApenasNovas(e.target.checked)}
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
                        Apenas novas
                      </label>
                    </div>
                  )}

                  {/* Tabela */}
                  {mpTransacoes.length > 0 && (
                    <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, minHeight: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          {(() => {
                            const sortArrow = col => mpSortCol === col ? (mpSortDir === 'asc' ? ' ↑' : ' ↓') : '';
                            const thSort = (col, label, extraStyle = {}) => (
                              <th onClick={() => mpToggleSort(col)} style={{
                                padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)',
                                fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
                                cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                                color: mpSortCol === col ? 'var(--primary)' : 'inherit',
                                ...extraStyle,
                              }}>{label}{sortArrow(col)}</th>
                            );
                            return (
                              <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0, zIndex: 1 }}>
                                <th style={{ padding: '10px 12px', width: 40, borderBottom: '2px solid var(--border)' }}></th>
                                {thSort('data',      'Data',            { whiteSpace: 'nowrap' })}
                                {thSort('descricao', 'Produto / Cliente', { minWidth: 180 })}
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 155 }}>Categoria</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 150 }}>Subcategoria</th>
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 120 }}>Pagamento</th>
                                {thSort('valor',  'Valor',  { textAlign: 'right' })}
                                {thSort('cmv',    'CMV',    { textAlign: 'right' })}
                                {thSort('margem', 'Margem', { textAlign: 'right' })}
                                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 130 }}>Upgrade (R$)</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid var(--border)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                              </tr>
                            );
                          })()}
                        </thead>
                        <tbody>
                          {mpTransacoes.map((t, i) => ({ t, i }))
                            .filter(({ t }) => {
                              if (mpApenasNovas && t.jaImportado) return false;
                              if (mpFiltroTexto.trim()) {
                                const q = mpFiltroTexto.toLowerCase();
                                return (t.descricao || '').toLowerCase().includes(q)
                                  || (t.clienteNome || '').toLowerCase().includes(q)
                                  || (t.vendedorNome || '').toLowerCase().includes(q);
                              }
                              return true;
                            })
                            .sort((a, b) => {
                              let va, vb;
                              if (mpSortCol === 'data')    { va = a.t.data;    vb = b.t.data; }
                              else if (mpSortCol === 'descricao') { va = (a.t.descricao || '').toLowerCase(); vb = (b.t.descricao || '').toLowerCase(); }
                              else if (mpSortCol === 'valor')   { va = a.t.valor;   vb = b.t.valor; }
                              else if (mpSortCol === 'cmv')     { va = a.t.cmvValor; vb = b.t.cmvValor; }
                              else if (mpSortCol === 'margem')  { va = a.t.valor - a.t.cmvValor; vb = b.t.valor - b.t.cmvValor; }
                              else { va = 0; vb = 0; }
                              if (va < vb) return mpSortDir === 'asc' ? -1 : 1;
                              if (va > vb) return mpSortDir === 'asc' ? 1 : -1;
                              return 0;
                            })
                            .map(({ t, i }) => {
                            const margem = t.valor > 0 && t.cmvValor > 0
                              ? ((t.valor - t.cmvValor) / t.valor * 100).toFixed(1) + '%'
                              : '—';
                            const selectStyle = {
                              background: 'var(--surface2)', border: '1px solid var(--border)',
                              borderRadius: 5, color: 'var(--text)', padding: '4px 6px',
                              fontSize: 12, width: '100%', cursor: 'pointer',
                            };
                            return (
                              <tr key={i} style={{
                                borderBottom: '1px solid var(--border)',
                                opacity: t.jaImportado ? 0.4 : 1,
                                background: mpSelecionados.has(i) ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'transparent',
                                transition: 'background 0.1s',
                              }}>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  {t.jaImportado
                                    ? <span style={{ fontSize: 14, color: 'var(--text2)' }}>✓</span>
                                    : <input type="checkbox" checked={mpSelecionados.has(i)}
                                        onChange={() => {
                                          const s = new Set(mpSelecionados);
                                          s.has(i) ? s.delete(i) : s.add(i);
                                          setMpSelecionados(s);
                                        }} style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--primary)' }} />
                                  }
                                </td>
                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>{t.data}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.descricao || '—'}</div>
                                  {t.clienteNome && <div style={{ color: 'var(--text2)', fontSize: 11, marginTop: 1 }}>{t.clienteNome}</div>}
                                  {t.vendedorNome && <div style={{ color: 'var(--text2)', fontSize: 11 }}>Vend: {t.vendedorNome}</div>}
                                  {(t.tipoVendaOriginal || t.canalOriginal) && (
                                    <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, fontWeight: 600,
                                      background: (t.tipoVendaOriginal || '').toLowerCase().includes('upgrade') ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'var(--surface2)',
                                      border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px',
                                      color: (t.tipoVendaOriginal || '').toLowerCase().includes('upgrade') ? 'var(--primary)' : 'var(--text2)',
                                      letterSpacing: '0.03em' }}>
                                      {t.tipoVendaOriginal || t.canalOriginal}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {t.jaImportado
                                    ? <span style={{ fontSize: 12 }}>{t.categoria}</span>
                                    : <select value={t.categoria} onChange={e => editarMpLinha(i, 'categoria', e.target.value)} style={selectStyle}>
                                        <option value="">— selecione —</option>
                                        {Object.entries(getCatsPorTipo('Entrada')).filter(([,v]) => v !== null).map(([cat]) => (
                                          <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                      </select>
                                  }
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {t.jaImportado
                                    ? <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t.subcategoria}</span>
                                    : <select value={t.subcategoria} onChange={e => editarMpLinha(i, 'subcategoria', e.target.value)} style={selectStyle}>
                                        <option value="">— sub —</option>
                                        {getSubcats(t.categoria).map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                  }
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {t.jaImportado
                                    ? <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t.pagamento || '—'}</span>
                                    : <>
                                        <select value={t.pagamento} onChange={e => editarMpLinha(i, 'pagamento', e.target.value)} style={selectStyle}>
                                          <option value="">—</option>
                                          <option>Dinheiro</option><option>Pix</option><option>Crédito</option>
                                          <option>Débito</option><option>Boleto</option><option>Transferência</option><option>Outro</option>
                                        </select>
                                        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>MP não informa pagamento</div>
                                      </>
                                  }
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: t.valor > 0 ? 'var(--entrada)' : 'var(--text2)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {fmt(t.valor)}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--saida)', whiteSpace: 'nowrap' }}>
                                  {t.cmvValor > 0 ? fmt(t.cmvValor) : <span style={{ color: 'var(--text2)' }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600,
                                  color: margem === '—' ? 'var(--text2)' : parseFloat(margem) >= 20 ? 'var(--entrada)' : parseFloat(margem) >= 10 ? '#ca8a04' : 'var(--saida)' }}>
                                  {margem}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {!t.jaImportado && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <input type="checkbox" checked={!!(t.isUpgrade)} onChange={e => editarMpLinha(i, 'isUpgrade', e.target.checked)}
                                        style={{ cursor: 'pointer', accentColor: 'var(--primary)', width: 14, height: 14, flexShrink: 0 }} />
                                      {t.isUpgrade && (
                                        <input type="number" step="0.01" placeholder="0,00"
                                          value={t.valorUpgrade || ''}
                                          onChange={e => editarMpLinha(i, 'valorUpgrade', e.target.value)}
                                          style={{ width: 80, background: 'var(--surface2)', border: '1px solid var(--primary)', borderRadius: 5, color: 'var(--text)', padding: '3px 6px', fontSize: 12 }} />
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  {t.jaImportado
                                    ? <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--surface2)', borderRadius: 4, padding: '2px 8px' }}>Importado</span>
                                    : <span style={{ fontSize: 11, fontWeight: 600,
                                        color: t.status === 'Confirmado' ? 'var(--entrada)' : 'var(--text2)',
                                        background: t.status === 'Confirmado' ? 'color-mix(in srgb, var(--entrada) 12%, transparent)' : 'var(--surface2)',
                                        borderRadius: 4, padding: '2px 8px' }}>{t.status}</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {mpTransacoes.length === 0 && !mpBuscando && !mpErro && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center' }}>
                        Selecione um período e clique em <strong>Buscar vendas</strong>.
                      </p>
                    </div>
                  )}
                </>
              )}

              {mpErro && <div className="form-erro">{mpErro}</div>}
              {mpSucesso && <div style={{ padding: '12px 16px', background: 'color-mix(in srgb, #16a34a 12%, transparent)', border: '1px solid #16a34a', borderRadius: 8, fontSize: 13, color: '#15803d', fontWeight: 600 }}>{mpSucesso}</div>}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setMpModal(false)}>Fechar</button>
              {mpConfigurado && mpTransacoes.length > 0 && (
                <button className="btn btn-primary" onClick={mpImportar}
                  disabled={mpImportando || mpSelecionados.size === 0}
                  style={{ minWidth: 160 }}>
                  {mpImportando ? 'Importando...' : `Importar ${mpSelecionados.size} venda(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
