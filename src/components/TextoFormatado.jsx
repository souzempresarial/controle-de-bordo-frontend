// Markdown mínimo da IA (**negrito**, *itálico* e listas) sem injetar HTML
function inline(linha) {
  return linha.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((parte, i) => {
    if (parte.length > 4 && parte.startsWith('**') && parte.endsWith('**')) return <strong key={i}>{parte.slice(2, -2)}</strong>;
    if (parte.length > 2 && parte.startsWith('*') && parte.endsWith('*')) return <em key={i}>{parte.slice(1, -1)}</em>;
    return parte;
  });
}

export default function TextoFormatado({ texto }) {
  return texto.split('\n').map((linha, i) => {
    const semTitulo = linha.replace(/^#{1,6}\s+/, '');
    const item = semTitulo.match(/^\s*[-*•]\s+(.*)$/);
    if (item) return <div key={i} className="chat-item">• {inline(item[1])}</div>;
    return <div key={i}>{semTitulo.trim() ? inline(semTitulo) : ' '}</div>;
  });
}
