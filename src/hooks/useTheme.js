import { useState, useEffect } from 'react';

export function useTheme() {
  const [tema, setTema] = useState(() => localStorage.getItem('cb_tema') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('cb_tema', tema);
  }, [tema]);

  function toggleTema() {
    setTema(t => t === 'dark' ? 'light' : 'dark');
  }

  return { tema, toggleTema };
}
