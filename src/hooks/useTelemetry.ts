import { useRef, useEffect, useCallback } from 'react';

export const useTelemetry = (sessionId: string, userId: string) => {
  const logBuffer = useRef<any[]>([]);
  const mouseTraceBuffer = useRef<any[]>([]);
  const startTime = useRef(Date.now());

  const logAction = useCallback((type: string, payload: any) => {
    const entry = {
      seq: logBuffer.current.length + 1,
      time_offset: Date.now() - startTime.current,
      type,
      payload
    };
    logBuffer.current.push(entry);
  }, []);

  useEffect(() => {
    let lastSampleTime = Date.now();
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSampleTime < 100) return; // Throttle to 100ms
      lastSampleTime = now;

      const element = document.elementFromPoint(e.clientX, e.clientY);
      const semanticId = element?.getAttribute('data-telemetry-id') || 'whitespace';

      mouseTraceBuffer.current.push({
        t: now - startTime.current,
        x: e.clientX,
        y: e.clientY,
        hover_element: semanticId
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const flushData = useCallback(async () => {
    if (logBuffer.current.length === 0 && mouseTraceBuffer.current.length === 0) return;

    const events = [...logBuffer.current];
    const mouse_trace = [...mouseTraceBuffer.current];
    
    logBuffer.current = [];
    mouseTraceBuffer.current = [];

    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          events,
          mouse_trace
        })
      });
    } catch (err) {
      console.error('Failed to flush telemetry', err);
    }
  }, [sessionId, userId]);

  // Auto flush every 5 seconds
  useEffect(() => {
    const interval = setInterval(flushData, 5000);
    return () => clearInterval(interval);
  }, [flushData]);

  return { logAction, flushData, startTime };
};
