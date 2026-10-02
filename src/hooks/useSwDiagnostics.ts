import { useState, useEffect, useCallback } from 'react';
import {
  SwDiagnosticState,
  subscribeSwDiagnostics,
  triggerDiagnosticBackgroundSync,
  requestSwDiagnostics,
  getDiagnosticReportText,
} from '../utils/swDiagnostics';

export function useSwDiagnostics() {
  const [state, setState] = useState<SwDiagnosticState>(() => ({
    isSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator,
    isRegistered: false,
    hasBackgroundSync: false,
    heartbeatCount: 0,
    lastHeartbeatTs: null,
    lastHeartbeatDelta: null,
    maxHeartbeatDelta: 0,
    isSuspensionDetected: false,
    totalSuspensionsCount: 0,
    syncTriggerCount: 0,
    lastSyncTs: null,
    lastSyncTag: null,
    isSyncFlashing: false,
    recentEvents: [],
  }));

  useEffect(() => {
    const unsubscribe = subscribeSwDiagnostics(setState);
    return () => unsubscribe();
  }, []);

  const triggerSync = useCallback(async (tag?: string) => {
    return triggerDiagnosticBackgroundSync(tag);
  }, []);

  const requestHeartbeat = useCallback(() => {
    requestSwDiagnostics();
  }, []);

  const copyReport = useCallback(() => {
    const text = getDiagnosticReportText();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    return text;
  }, []);

  return {
    ...state,
    triggerSync,
    requestHeartbeat,
    copyReport,
  };
}
