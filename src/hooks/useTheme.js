import { useState, useEffect } from 'react';

export function useTheme() {
  const [tema, setTema] = useState(() => localStorage.getItem('sf_tema') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('sf_tema', tema);
  }, [tema]);

  function toggleTema() {
    setTema(t => t === 'dark' ? 'light' : 'dark');
  }

  return { tema, toggleTema };
}
