import { useEffect, useState } from 'react';
import { API } from '../services/api';
import { fmt } from '../services/utils';

const MODOS = ['faturamento', 'caixa', 'lucro', 'lucratividade'];
const LABELS = { faturamento: 'Faturamento', caixa: 'Geração de Caixa', lucro: 'Lucro', lucratividade: 'Lucratividade (%)' };

const mesAtual = new Date().toISOString().slice(0, 7);

export default function Ranking() {
  const [dados, setDados]     = useState([]);
  const [modo, setModo]       = useState('faturamento');
  const [mes, setMes]         = useState(mesAtual);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState('');

  useEffect(() => {
    setLoading(true); setErro('');
    API.ranking(mes || null)
      .then(setDados)
      .catch(() => setErro('Não foi possível carregar o ranking. Tente novamente.'))
      .finally(() => setLoading(false));
  }, [mes]);

  const ordenados = [...dados].sort((a, b) => b[modo] - a[modo]);
  const max = ordenados[0]?.[modo] || 1;

  function fmtValor(v, m) {
    if (m === 'lucratividade') return `${parseFloat(v).toFixed(1)}%`;
    return fmt(v);
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Ranking de Clientes</h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text2)' }}>Somatório de lançamentos confirmados por cliente</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '6px 10px', fontSize: 13 }}
        />
        {mes && (
          <button onClick={() => setMes('')}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
            Ver tudo
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {MODOS.map(m => (
          <button key={m} onClick={() => setModo(m)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: modo === m ? 700 : 400,
              background: modo === m ? 'var(--primary)' : 'var(--surface2)',
              color: modo === m ? '#fff' : 'var(--text2)',
              border: '1px solid ' + (modo === m ? 'var(--primary)' : 'var(--border)'),
            }}>
            {LABELS[m]}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text2)', fontSize: 14 }}>Carregando...</p>}
      {erro    && <p style={{ color: 'var(--saida)', fontSize: 14 }}>{erro}</p>}

      {!loading && !erro && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ordenados.map((c, i) => {
            const val  = c[modo];
            const pct  = max > 0 ? (val / max * 100) : 0;
            const neg  = val < 0;
            return (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: i < 3 ? ['#f59e0b','#9ca3af','#b45309'][i] : 'var(--text2)', minWidth: 28 }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{c.nome}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: neg ? 'var(--saida)' : 'var(--entrada)' }}>
                    {fmtValor(val, modo)}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, pct)}%`, height: '100%', background: neg ? 'var(--saida)' : 'var(--primary)', borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
                  <span>Faturamento: <strong style={{ color: 'var(--entrada)' }}>{fmt(c.faturamento)}</strong></span>
                  <span>Saídas: <strong style={{ color: 'var(--saida)' }}>{fmt(c.saidas)}</strong></span>
                  <span>Caixa: <strong style={{ color: c.caixa >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(c.caixa)}</strong></span>
                  <span>Lucro: <strong style={{ color: c.lucro >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(c.lucro)}</strong></span>
                  <span>Lucratividade: <strong style={{ color: c.lucratividade >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{parseFloat(c.lucratividade).toFixed(1)}%</strong></span>
                </div>
              </div>
            );
          })}
          {ordenados.length === 0 && <p style={{ color: 'var(--text2)', fontSize: 14 }}>Nenhum dado encontrado.</p>}
        </div>
      )}
    </div>
  );
}