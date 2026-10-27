import { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { CMVCATS } from '../services/constants';
import { calcDREBase } from '../services/dre';
import { fmt, MESES, upgradeNoCaixa } from '../services/utils';
import './GraficoFluxo.css';

const COR_ENT = '#22c55e';
const COR_SAI = '#f59e0b';
const COR_AP  = '#3b82f6';
const COR_LUC = '#8b5cf6';

const curto = v => {
  const a = Math.abs(v);
  if (a >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace('.', ',')}mi`;
  if (a >= 1e3) return `R$ ${Math.round(v / 1e3)}k`;
  return `R$ ${Math.round(v)}`;
};
const pct = v => `${v.toFixed(1).replace('.', ',')}%`;

// Cada métrica: como somar um período (lançamentos daquele mês/dia) e o que mostrar na legenda e na dica
const METRICAS = {
  aparelhos: {
    rotulo: 'Aparelhos',
    // Aparelhos vendidos (sem a linha de upgrade, que é o aparelho que entrou na troca) e o faturamento deles
    somar(lm) {
      const v = lm.filter(x => x.tipo === 'Entrada' && x.categoria === 'Aparelhos' && x.subcategoria !== 'Upgrade' && x.status !== 'Pendente');
      return { a: v.reduce((s, x) => s + (x.quantidade ?? 1), 0), b: v.reduce((s, x) => s + x.valor, 0) };
    },
    series: [{ chave: 'a', nome: 'Aparelhos vendidos', cor: COR_AP }],
    eixo: v => `${Math.round(v)}`,
    legenda: t => [['Aparelhos vendidos', `${t.a} un.`, COR_AP], ['Faturamento', fmt(t.b), null]],
    dica: p => [['Aparelhos vendidos', `${p.a} un.`, COR_AP], ['Faturamento', fmt(p.b), null], ['Ticket médio', p.a ? fmt(p.b / p.a) : '—', null]],
  },
  fluxo: {
    rotulo: 'Fluxo de caixa',
    // Mesma conta do Fluxo de Caixa: sem CMV, sem saída pendente; entrada sem o aparelho recebido na troca, saída + taxa da venda
    somar(lm) {
      const l = lm.filter(x => !x.isCMV && !CMVCATS.includes(x.categoria) && !(x.tipo === 'Saída' && x.status === 'Pendente'));
      const ent = l.filter(x => x.tipo === 'Entrada').reduce((a, x) => a + x.valor - upgradeNoCaixa(x), 0);
      const ded = l.filter(x => x.tipo === 'Entrada' && x.valorRecebido != null).reduce((a, x) => a + (x.valor - x.valorRecebido), 0);
      const sai = l.filter(x => x.tipo === 'Saída').reduce((a, x) => a + x.valor, 0) + ded;
      return { a: ent, b: sai };
    },
    series: [{ chave: 'a', nome: 'Entradas', cor: COR_ENT }, { chave: 'b', nome: 'Saídas', cor: COR_SAI, tracejado: true }],
    eixo: curto,
    legenda: t => [['Entradas', fmt(t.a), COR_ENT], ['Saídas', fmt(t.b), COR_SAI, true]],
    dica: p => [['Entradas', fmt(p.a), COR_ENT], ['Saídas', fmt(p.b), COR_SAI], { rotulo: 'Saldo', valor: p.a - p.b, texto: `${p.a - p.b >= 0 ? '+' : ''}${fmt(p.a - p.b)}` }],
  },
  lucro: {
    rotulo: 'Lucratividade',
    // Mesmo DRE da tela Financeiro: lucro bruto = receita líquida − CMV
    somar(lm) {
      const d = calcDREBase(lm);
      return { a: d.lucroBruto, b: d.recBruta };
    },
    series: [{ chave: 'a', nome: 'Lucro bruto', cor: COR_LUC }],
    eixo: curto,
    legenda: t => [['Lucro bruto', fmt(t.a), COR_LUC], ['Margem', t.b ? pct((t.a / t.b) * 100) : '—', null]],
    dica: p => [['Receita', fmt(p.b), null], ['Lucro bruto', fmt(p.a), COR_LUC], { rotulo: 'Margem', valor: p.a, texto: p.b ? pct((p.a / p.b) * 100) : '—' }],
  },
};

function Dica({ active, payload, label, modo, mes, ano, metrica }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const titulo = modo === 'mensal' ? `${MESES[label]} ${ano}` : `${String(label).padStart(2, '0')}/${mes}/${ano}`;
  return (
    <div className="gf-dica">
      <div className="gf-dica-titulo">{titulo}</div>
      {METRICAS[metrica].dica(p).map(item => Array.isArray(item) ? (
        <div key={item[0]} className="gf-dica-linha">{item[2] ? <i style={{ background: item[2] }} /> : <i className="vazio" />}{item[0]}<b>{item[1]}</b></div>
      ) : (
        <div key={item.rotulo} className={`gf-dica-saldo ${item.valor >= 0 ? 'pos' : 'neg'}`}>{item.rotulo}<b>{item.texto}</b></div>
      ))}
    </div>
  );
}

export default function GraficoFluxo({ lancamentos, ano, mes }) {
  const [modo, setModo] = useState('diario');
  const [metrica, setMetrica] = useState('aparelhos');
  const cfg = METRICAS[metrica];

  const dados = useMemo(() => {
    const r2 = v => Math.round(v * 100) / 100;
    const ponto = (x, lm) => { const s = cfg.somar(lm); return { x, a: r2(s.a), b: r2(s.b) }; };
    if (modo === 'mensal') return MESES.map((_, i) => ponto(i, lancamentos.filter(l => l.data.startsWith(`${ano}-${String(i + 1).padStart(2, '0')}`))));
    const dias = new Date(Number(ano), Number(mes), 0).getDate();
    const doMes = lancamentos.filter(l => l.data.startsWith(`${ano}-${mes}`));
    return Array.from({ length: dias }, (_, i) => ponto(i + 1, doMes.filter(l => l.data.slice(8, 10) === String(i + 1).padStart(2, '0'))));
  }, [lancamentos, modo, ano, mes, cfg]);

  // Totais do período mostrado: soma dos pontos (lucro e margem calculados sobre o total, não média de margens)
  const tot = dados.reduce((t, d) => ({ a: t.a + d.a, b: t.b + d.b }), { a: 0, b: 0 });
  const vazio = dados.every(d => !d.a && !d.b);

  return (
    <section className="gf" aria-label={cfg.rotulo}>
      <div className="gf-topo">
        <div className="gf-titulo">
          <div className="gf-metricas" role="tablist" aria-label="Métrica do gráfico">
            {Object.entries(METRICAS).map(([k, m]) => (
              <button key={k} type="button" role="tab" aria-selected={metrica === k} className={metrica === k ? 'ativo' : ''} onClick={() => setMetrica(k)}>{m.rotulo}</button>
            ))}
          </div>
          <div className="gf-legenda">
            {cfg.legenda(tot).map(([rot, val, cor]) => (
              <span key={rot}>{cor && <i style={{ background: cor }} />}{rot} <b>{val}</b></span>
            ))}
          </div>
        </div>
        <div className="gf-modos" role="tablist" aria-label="Agrupar por">
          {[['diario', `Diário (${MESES[Number(mes) - 1]})`], ['mensal', `Mensal (${ano})`]].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={modo === k} className={modo === k ? 'ativo' : ''} onClick={() => setModo(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="gf-area">
        {vazio ? (
          <div className="gf-vazio">Sem dados {modo === 'mensal' ? `em ${ano}` : 'neste mês'}.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
              <defs>
                {cfg.series.map(s => (
                  <linearGradient key={s.chave} id={`gf-${metrica}-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.cor} stopOpacity={s.tracejado ? 0.16 : 0.32} />
                    <stop offset="100%" stopColor={s.cor} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="currentColor" strokeOpacity={0.12} />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                tickFormatter={v => (modo === 'mensal' ? MESES[v] : v)} interval={modo === 'mensal' ? 0 : 'preserveStartEnd'} minTickGap={8} />
              <YAxis tickLine={false} axisLine={false} width={64} allowDecimals={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} tickFormatter={cfg.eixo} />
              <Tooltip content={<Dica modo={modo} mes={mes} ano={ano} metrica={metrica} />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.35, strokeDasharray: '4 4' }} />
              {modo === 'mensal' && <ReferenceLine x={Number(mes) - 1} stroke={cfg.series[0].cor} strokeOpacity={0.35} strokeDasharray="2 4" />}
              {[...cfg.series].reverse().map(s => (
                <Area key={s.chave} type="monotone" dataKey={s.chave} name={s.nome} stroke={s.cor} strokeWidth={s.tracejado ? 2 : 2.5}
                  strokeDasharray={s.tracejado ? '6 4' : undefined} fill={`url(#gf-${metrica}-${s.chave})`} dot={false}
                  activeDot={{ r: 5, fill: s.cor, stroke: 'var(--surface)', strokeWidth: 2 }} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
