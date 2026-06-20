import { useEffect, useState, useCallback } from 'react';

interface UseAiConfigModalResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Hook to manage the AI Config modal visibility.
 * Opens on Ctrl+M (or Cmd+M on Mac).
 */
export function useAiConfigModal(): UseAiConfigModalResult {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+M or Cmd+M (Mac)
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [toggle]);

  return { isOpen, open, close, toggle };
}