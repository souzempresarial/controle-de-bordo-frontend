// ══════════════════════════════════════════════════════════════════════════════
// EDITAR LANÇAMENTO
// ══════════════════════════════════════════════════════════════════════════════
function abrirEditar(id) {
  const l = lancamentos.find(x => x.id === id);
  if (!l) return;
  editandoId = id;
  document.getElementById('e-data').value       = l.data;
  document.getElementById('e-tipo').value       = l.tipo;
  document.getElementById('e-valor').value      = l.valor;
  popularCats('e-categoria', 'e-tipo');
  document.getElementById('e-categoria').value  = l.categoria;
  atualizarSubs('e-categoria','e-subcategoria', l.subcategoria||'');
  document.getElementById('e-descricao').value  = l.descricao;
  document.getElementById('e-pagamento').value  = l.pagamento||'';
  document.getElementById('e-recorrencia').value= l.recorrencia||'';
  document.getElementById('e-status').value     = l.status;
  document.getElementById('e-obs').value        = l.obs||'';
  document.getElementById('e-quantidade').value = l.quantidade||'';
  document.getElementById('e-qtd-wrap').style.display = l.tipo==='Entrada' ? '' : 'none';
  document.getElementById('modal-editar').classList.add('open');
}

async function salvarEdicao() {
  const idx = lancamentos.findIndex(x => x.id === editandoId);
  if (idx === -1) return;
  const l = lancamentos[idx];
  const dados = {
    data:        document.getElementById('e-data').value,
    tipo:        document.getElementById('e-tipo').value,
    valor:       parseFloat(document.getElementById('e-valor').value),
    categoria:   document.getElementById('e-categoria').value,
    subcategoria:document.getElementById('e-subcategoria').value,
    descricao:   document.getElementById('e-descricao').value.trim(),
    pagamento:   document.getElementById('e-pagamento').value,
    status:      document.getElementById('e-status').value,
    obs:         document.getElementById('e-obs').value.trim(),
    quantidade:  parseInt(document.getElementById('e-quantidade').value) || null,
  };
  try {
    const atualizado = await API.editarLancamento(editandoId, dados);
    lancamentos[idx] = { ...l, ...atualizado };
    fecharModal('modal-editar');
    renderAll();
    toast('Lançamento #' + String(l.id).padStart(3,'0') + ' atualizado');
  } catch (err) {
    toast('Erro ao atualizar lançamento', 'error');
    console.error(err);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXCLUIR / LIMPAR
// ══════════════════════════════════════════════════════════════════════════════
function confirmarExcluir(id) {
  const l = lancamentos.find(x => x.id === id);
  document.getElementById('modal-confirmar-titulo').textContent = 'Excluir Lançamento';
  document.getElementById('modal-confirmar-msg').textContent    = `Excluir #${String(id).padStart(3,'0')} — ${l.descricao} (${fmt(l.valor)})?`;
  document.getElementById('btn-confirmar-ok').onclick = () => { excluir(id); fecharModal('modal-confirmar'); };
  document.getElementById('modal-confirmar').classList.add('open');
}

async function excluir(id) {
  try {
    await API.excluirLancamento(clienteAtivo.id, id);
    lancamentos = lancamentos.filter(x => x.id !== id);
    // Remove CMVs órfãos (sem entrada pai correspondente)
    const pais = new Set(lancamentos.filter(l => l.grupoId && !l.isCMV).map(l => l.grupoId));
    const orfaos = lancamentos.filter(l => l.isCMV && !pais.has(l.grupoId));
    await Promise.all(orfaos.map(l => API.excluirLancamento(clienteAtivo.id, l.id)));
    lancamentos = lancamentos.filter(l => !l.isCMV || pais.has(l.grupoId));
    renderAll(); toast('Lançamento excluído');
  } catch (err) {
    toast('Erro ao excluir lançamento', 'error');
    console.error(err);
  }
}

function confirmarLimpar() {
  document.getElementById('modal-confirmar-titulo').textContent = 'Limpar Dados do Cliente';
  document.getElementById('modal-confirmar-msg').textContent    = `Apagar TODOS os lançamentos de "${clienteAtivo?.nome}"? Esta ação não pode ser desfeita.`;
  document.getElementById('btn-confirmar-ok').onclick = async () => {
    try {
      await API.limparLancamentos(clienteAtivo.id);
      lancamentos = []; nextId = 1;
      renderAll(); fecharModal('modal-confirmar'); toast('Dados apagados');
    } catch (err) {
      toast('Erro ao apagar dados', 'error'); console.error(err);
    }
  };
  document.getElementById('modal-confirmar').classList.add('open');
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTAR / BACKUP / PDF
// ══════════════════════════════════════════════════════════════════════════════
function gerarPDF() {
  window.print();
}

function confirmarExportarCSV() {
  if (!lancamentos.length) { toast('Nenhum dado para exportar', 'error'); return; }
  document.getElementById('modal-confirmar-titulo').textContent = 'Exportar CSV';
  document.getElementById('modal-confirmar-msg').textContent    = `Exportar ${lancamentos.length} lançamento(s) de "${clienteAtivo?.nome}" em formato CSV?`;
  document.getElementById('btn-confirmar-ok').onclick = () => { fecharModal('modal-confirmar'); exportarCSV(); };
  document.getElementById('modal-confirmar').classList.add('open');
}

function confirmarBackupJSON() {
  document.getElementById('modal-confirmar-titulo').textContent = 'Backup JSON';
  document.getElementById('modal-confirmar-msg').textContent    = `Gerar backup completo dos dados de "${clienteAtivo?.nome}"?`;
  document.getElementById('btn-confirmar-ok').onclick = () => { fecharModal('modal-confirmar'); exportarBackup(); };
  document.getElementById('modal-confirmar').classList.add('open');
}

function exportarCSV() {
  if (!lancamentos.length) { toast('Nenhum dado para exportar', 'error'); return; }
  const cols = ['ID','Data','Tipo','Categoria','Subcategoria','Descrição','Pagamento','Recorrência','Status','Valor','Observações'];
  const rows = lancamentos.map(l => [
    '#'+String(l.id).padStart(3,'0'), fmtData(l.data), l.tipo, l.categoria,
    l.subcategoria||'', l.descricao, l.pagamento||'', l.recorrencia||'', l.status,
    l.valor.toFixed(2).replace('.',','), l.obs||''
  ]);
  const csv  = [cols,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${clienteAtivo?.nome.replace(/\s+/g,'_')}_${hoje()}.csv`;
  a.click();
  toast('CSV exportado');
}

function exportarBackup() {
  const cid = clienteAtivo.id;
  const backup = {
    versao: '1.0',
    exportadoEm: new Date().toISOString(),
    cliente: clienteAtivo,
    lancamentos: DB.getLancamentos(cid),
    nextId: DB.getNextId(cid),
    regras: DB.getRegras(cid),
    metas: JSON.parse(localStorage.getItem(`fin_${cid}_metas`) || '{}'),
    dreManual: (() => {
      const anos = [...new Set(lancamentos.map(l => l.data.slice(0,4)))];
      const obj = {};
      anos.forEach(a => {
        const key = `fin_${cid}_dre_manual_${a}`;
        const val = localStorage.getItem(key);
        if (val) obj[a] = JSON.parse(val);
      });
      return obj;
    })(),
    saldoInicial: (() => {
      const anos = [...new Set(lancamentos.map(l => l.data.slice(0,4)))];
      const obj = {};
      anos.forEach(a => {
        const val = localStorage.getItem(`fin_${cid}_saldo_inicial_${a}`);
        if (val) obj[a] = parseFloat(val);
      });
      return obj;
    })(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_${clienteAtivo.nome.replace(/\s+/g,'_')}_${hoje()}.json`;
  a.click();
  toast('Backup exportado com sucesso');
}

function importarBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.lancamentos || !backup.cliente) {
        toast('Arquivo inválido — não é um backup Controle de Bordo 2.0', 'error');
        return;
      }
      const cid = clienteAtivo.id;
      document.getElementById('modal-confirmar-titulo').textContent = 'Restaurar Backup';
      document.getElementById('modal-confirmar-msg').textContent =
        `Restaurar backup de "${backup.cliente.nome}" exportado em ${new Date(backup.exportadoEm).toLocaleString('pt-BR')}? Os dados atuais de "${clienteAtivo.nome}" serão substituídos.`;
      document.getElementById('btn-confirmar-ok').onclick = () => {
        DB.saveLancamentos(cid, backup.lancamentos);
        DB.saveNextId(cid, backup.nextId || 1);
        if (backup.regras) DB.saveRegras(cid, backup.regras);
        if (backup.metas) localStorage.setItem(`fin_${cid}_metas`, JSON.stringify(backup.metas));
        if (backup.dreManual) {
          Object.entries(backup.dreManual).forEach(([ano, val]) => {
            localStorage.setItem(`fin_${cid}_dre_manual_${ano}`, JSON.stringify(val));
          });
        }
        if (backup.saldoInicial) {
          Object.entries(backup.saldoInicial).forEach(([ano, val]) => {
            localStorage.setItem(`fin_${cid}_saldo_inicial_${ano}`, val);
          });
        }
        lancamentos = DB.getLancamentos(cid);
        nextId = DB.getNextId(cid);
        fecharModal('modal-confirmar');
        renderAll();
        toast('Backup restaurado com sucesso');
      };
      document.getElementById('modal-confirmar').classList.add('open');
    } catch {
      toast('Erro ao ler arquivo — verifique se é um backup válido', 'error');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAIS — fechar e atalhos de teclado
// ══════════════════════════════════════════════════════════════════════════════
function fecharModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => {
    if (e.target === o) {
      fecharModal('modal-editar');
      fecharModal('modal-confirmar');
      fecharModalCliente();
    }
  })
);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    fecharModal('modal-editar');
    fecharModal('modal-confirmar');
    fecharModalCliente();
  }
  if (e.key === 'n' && !document.querySelector('.modal-overlay.open') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT') {
    abrirModalLancamento();
  }
  if (e.key === 'Enter' && document.getElementById('modal-lancamento')?.classList.contains('open')) {
    if (document.activeElement?.tagName !== 'BUTTON') salvarLancamento();
  }
});
