import { useEffect, useState } from 'react';
import { API } from '../services/api';

function tempoRelativo(dataHora) {
  const diff = Date.now() - new Date(dataHora).getTime();
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(min / 60);
  const d    = Math.floor(h / 24);
  if (min < 1)  return 'agora';
  if (min < 60) return `${min}min atrás`;
  if (h < 24)   return `${h}h atrás`;
  if (d === 1)  return 'ontem';
  return `${d}d atrás`;
}

function fmtDataHora(dataHora) {
  return new Date(dataHora).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function iniciais(nome, email) {
  if (nome) return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return (email[0] || '?').toUpperCase();
}

export default function LogAcessos() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]     = useState('');

  useEffect(() => {
    API.listarLogAcessos()
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hoje = new Date().toDateString();
  const acessosHoje   = logs.filter(l => new Date(l.data_hora).toDateString() === hoje);
  const usuariosHoje  = new Set(acessosHoje.map(l => l.email)).size;
  const ultimoAcesso  = logs[0];

  const filtrados = busca.trim()
    ? logs.filter(l =>
        (l.email       || '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.nome        || '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.cliente_nome|| '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.ip          || '').includes(busca)
      )
    : logs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Log de Acessos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>Histórico de entradas no sistema</p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setLoading(true); API.listarLogAcessos().then(setLogs).finally(() => setLoading(false)); }}
        >
          ↻ Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div className="upgrade-card">
          <div className="upgrade-card-label">Acessos hoje</div>
          <div className="upgrade-card-valor" style={{ color: 'var(--primary)' }}>{acessosHoje.length}</div>
        </div>
        <div className="upgrade-card">
          <div className="upgrade-card-label">Usuários hoje</div>
          <div className="upgrade-card-valor">{usuariosHoje}</div>
        </div>
        <div className="upgrade-card">
          <div className="upgrade-card-label">Total registrado</div>
          <div className="upgrade-card-valor">{logs.length}</div>
        </div>
        {ultimoAcesso && (
          <div className="upgrade-card">
            <div className="upgrade-card-label">Último acesso</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--text)' }}>
              {ultimoAcesso.nome || ultimoAcesso.email.split('@')[0]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
              {tempoRelativo(ultimoAcesso.data_hora)}
            </div>
          </div>
        )}
      </div>

      {/* Busca */}
      <input
        type="text"
        placeholder="Buscar por nome, e-mail, cliente ou IP..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '9px 14px', fontSize: 14, color: 'var(--text)',
          outline: 'none',
        }}
      />

      {/* Lista */}
      {loading ? (
        <div className="empty-state"><div>Carregando...</div></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <div>{logs.length === 0 ? 'Nenhum acesso registrado ainda.' : 'Nenhum resultado para a busca.'}</div>
        </div>
      ) : (
        <div className="table-panel" style={{ marginTop: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Cliente</th>
                  <th>IP</th>
                  <th>Data / Hora</th>
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(log => {
                  const isHoje = new Date(log.data_hora).toDateString() === hoje;
                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'var(--primary)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700, flexShrink: 0,
                          }}>
                            {iniciais(log.nome, log.email)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{log.nome || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{log.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text2)' }}>{log.cliente_nome || '—'}</td>
                      <td>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12,
                          background: 'var(--surface2)', borderRadius: 4,
                          padding: '2px 7px', color: 'var(--text)',
                        }}>
                          {log.ip || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {fmtDataHora(log.data_hora)}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: isHoje ? 'var(--primary)' : 'var(--text2)',
                        }}>
                          {tempoRelativo(log.data_hora)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
