// Markdown mínimo da IA (**negrito** e listas) sem injetar HTML
function negrito(linha) {
  return linha.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.length > 4 && parte.startsWith('**') && parte.endsWith('**')
      ? <strong key={i}>{parte.slice(2, -2)}</strong>
      : parte
  );
}

export default function TextoFormatado({ texto }) {
  return texto.split('\n').map((linha, i) => {
    const semTitulo = linha.replace(/^#{1,6}\s+/, '');
    const item = semTitulo.match(/^\s*[-*•]\s+(.*)$/);
    if (item) return <div key={i} className="chat-item">• {negrito(item[1])}</div>;
    return <div key={i}>{semTitulo.trim() ? negrito(semTitulo) : ' '}</div>;
  });
}
