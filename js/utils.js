// ══════════════════════════════════════════════════════════════════════════════
// UTILS — formatadores e helpers globais
// ══════════════════════════════════════════════════════════════════════════════
const fmt     = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const hoje    = () => new Date().toISOString().split('T')[0];
const fmtData = d => { if(!d) return ''; const [y,m,dia]=d.split('-'); return `${dia}/${m}/${y}`; };
const initials = nome => nome.trim().split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();

function toast(msg, tipo='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + tipo;
  setTimeout(() => t.className = 'toast', 2500);
}

function salvarDados() {
  DB.saveLancamentos(clienteAtivo.id, lancamentos);
  DB.saveNextId(clienteAtivo.id, nextId);
}

function salvarContas() {
  DB.saveContas(clienteAtivo.id, contas);
  DB.saveNextContaId(clienteAtivo.id, nextContaId);
}

function initStickyScrollbar(wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  const mirrorId = wrapperId + '-smirror';
  let mirror = document.getElementById(mirrorId);
  if (!mirror) {
    mirror = document.createElement('div');
    mirror.id = mirrorId;
    mirror.style.cssText = 'position:sticky;bottom:0;overflow-x:auto;overflow-y:hidden;height:10px;z-index:10;background:transparent';
    const inner = document.createElement('div');
    inner.id = mirrorId + '-inner';
    inner.style.height = '1px';
    mirror.appendChild(inner);
    wrapper.parentNode.insertBefore(mirror, wrapper.nextSibling);

    let fromMirror = false, fromWrapper = false;
    mirror.addEventListener('scroll', () => {
      if (fromWrapper) return;
      fromMirror = true;
      wrapper.scrollLeft = mirror.scrollLeft;
      fromMirror = false;
    });
    wrapper.addEventListener('scroll', () => {
      if (fromMirror) return;
      fromWrapper = true;
      mirror.scrollLeft = wrapper.scrollLeft;
      fromWrapper = false;
    });
  }

  // Sincroniza largura com o conteúdo da tabela
  const inner = document.getElementById(mirrorId + '-inner');
  if (inner) inner.style.width = wrapper.scrollWidth + 'px';
}
