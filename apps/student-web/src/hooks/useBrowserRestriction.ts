import { useEffect, useState, useCallback, useRef } from 'react';

interface BrowserRestrictionOptions {
  enabled: boolean;
  onViolation?: (type: string, count: number) => void;
}

export function useBrowserRestriction({ enabled, onViolation }: BrowserRestrictionOptions) {
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const violationRef = useRef(0);

  const requestFullscreen = useCallback(() => {
    if (!enabled) return;
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, [enabled]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    requestFullscreen();
  }, [requestFullscreen]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        violationRef.current += 1;
        setViolationCount(violationRef.current);
        setWarningMessage(`You switched away from this tab. This has been recorded. (Violation #${violationRef.current})`);
        setShowWarning(true);
        onViolation?.('tab_switch', violationRef.current);
      }
    };

    const handleBlur = () => {
      if (!document.hidden) {
        violationRef.current += 1;
        setViolationCount(violationRef.current);
        setWarningMessage(`Focus was lost from the test window. Please stay on this page. (Violation #${violationRef.current})`);
        setShowWarning(true);
        onViolation?.('window_blur', violationRef.current);
      }
    };

    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);
      if (!inFullscreen && enabled) {
        setWarningMessage('Fullscreen mode is recommended during the test for best experience.');
        setShowWarning(true);
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.monaco-editor')) return;
      e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const target = e.target as HTMLElement;
        if (!target.closest('.monaco-editor')) {
          e.preventDefault();
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        const target = e.target as HTMLElement;
        if (!target.closest('.monaco-editor')) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onViolation]);

  return {
    violationCount,
    showWarning,
    warningMessage,
    isFullscreen,
    requestFullscreen,
    dismissWarning,
  };
}
