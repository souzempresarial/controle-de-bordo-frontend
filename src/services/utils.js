export const fmt     = (v) => (v == null || isNaN(v) ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtPct  = (v) => (v !== null && v !== undefined) ? v.toFixed(2) + '%' : '—';
export const fmtData = (d) => { if (!d) return '—'; const s = String(d).slice(0, 10); const [y, m, day] = s.split('-'); return `${day}/${m}/${y}`; };
export const hoje    = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

export const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
