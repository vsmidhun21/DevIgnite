import { useEffect } from 'react';

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
}

export function useKeyboardShortcuts({
  onGlobalSearch,
  onStartProject,
  onStopProject,
  onRestartProject,
  onToggleSidebar,
  onFocusLogs,
  onFocusSearch,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const hasModifier = event.ctrlKey || event.metaKey;
      if (!hasModifier || event.repeat) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === 'k' || key === 'p') {
        event.preventDefault();
        onGlobalSearch?.();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) onStopProject?.();
        else onStartProject?.();
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        onRestartProject?.();
        return;
      }

      if (key === 'b') {
        event.preventDefault();
        onToggleSidebar?.();
        return;
      }

      if (key === 'l') {
        event.preventDefault();
        onFocusLogs?.();
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        onFocusSearch?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onFocusLogs,
    onFocusSearch,
    onGlobalSearch,
    onRestartProject,
    onStartProject,
    onStopProject,
    onToggleSidebar,
  ]);
}
