import { useState } from 'react';

const OUTRO = '__outro__';

// Banco do lançamento: lista padrão (as mais usadas pela loja primeiro) ou um nome digitado em "Outro…".
// Lançamento antigo com banco fora da lista abre já no campo de texto, mostrando o que está gravado.
export default function SelectBanco({ value, onChange, opcoes, id }) {
  const foraDaLista = !!value && !opcoes.includes(value);
  const [digitando, setDigitando] = useState(foraDaLista);

  if (digitando || foraDaLista) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input id={id} type="text" placeholder="Nome do banco ou conta" value={value} autoFocus={digitando && !value}
          onChange={e => onChange(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="btn btn-ghost btn-sm" title="Voltar para a lista de bancos"
          onClick={() => { setDigitando(false); onChange(''); }}>Lista</button>
      </div>
    );
  }
  return (
    <select id={id} value={value} onChange={e => (e.target.value === OUTRO ? (setDigitando(true), onChange('')) : onChange(e.target.value))}>
      <option value="">— selecione —</option>
      {opcoes.map(b => <option key={b}>{b}</option>)}
      <option value={OUTRO}>Outro…</option>
    </select>
  );
}
