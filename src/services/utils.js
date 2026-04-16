export const fmt     = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtPct  = (v) => (v !== null && v !== undefined) ? v.toFixed(2) + '%' : '—';
export const fmtData = (d) => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
export const hoje    = () => new Date().toISOString().slice(0, 10);

export const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
