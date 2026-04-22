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

/**
 * Normalizes key combinations for comparison.
 * e.g., "Control+k" -> "control+k"
 */
function normalizeShortcut(shortcut) {
  if (!shortcut) return '';
  return shortcut.toLowerCase().replace(/control/g, 'ctrl');
}

export function useKeyboardShortcuts({
  shortcutsConfig,
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
      if (isEditableTarget(event.target)) return;
      if (event.repeat) return;

      const modifiers = [];
      if (event.ctrlKey || event.metaKey) modifiers.push('ctrl');
      if (event.shiftKey) modifiers.push('shift');
      if (event.altKey) modifiers.push('alt');

      let key = event.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toLowerCase();

      const currentCombo = [...modifiers, key].join('+').toLowerCase();

      const check = (actionShortcut) => {
        if (!actionShortcut) return false;
        return normalizeShortcut(actionShortcut) === currentCombo;
      };

      if (check(shortcutsConfig?.openSearch)) {
        event.preventDefault();
        onGlobalSearch?.();
        return;
      }

      if (check(shortcutsConfig?.startProject)) {
        event.preventDefault();
        onStartProject?.();
        return;
      }

      if (check(shortcutsConfig?.stopProject)) {
        event.preventDefault();
        onStopProject?.();
        return;
      }

      if (check(shortcutsConfig?.restartProject)) {
        event.preventDefault();
        onRestartProject?.();
        return;
      }

      if (check(shortcutsConfig?.toggleSidebar)) {
        event.preventDefault();
        onToggleSidebar?.();
        return;
      }

      if (check(shortcutsConfig?.focusLogs)) {
        event.preventDefault();
        onFocusLogs?.();
        return;
      }

      if (check(shortcutsConfig?.focusSearch)) {
        event.preventDefault();
        onFocusSearch?.();
        return;
      }
      
      // Fallback for hardcoded defaults if config is missing (safety)
      if (!shortcutsConfig) {
        const hasModifier = event.ctrlKey || event.metaKey;
        if (!hasModifier) return;
        const k = event.key.toLowerCase();
        if (k === 'k' || k === 'p') { event.preventDefault(); onGlobalSearch?.(); }
        else if (event.key === 'Enter') {
          event.preventDefault();
          if (event.shiftKey) onStopProject?.();
          else onStartProject?.();
        }
        else if (k === 'r') { event.preventDefault(); onRestartProject?.(); }
        else if (k === 'b') { event.preventDefault(); onToggleSidebar?.(); }
        else if (k === 'l') { event.preventDefault(); onFocusLogs?.(); }
        else if (k === 'f') { event.preventDefault(); onFocusSearch?.(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    shortcutsConfig,
    onFocusLogs,
    onFocusSearch,
    onGlobalSearch,
    onRestartProject,
    onStartProject,
    onStopProject,
    onToggleSidebar,
  ]);
}
