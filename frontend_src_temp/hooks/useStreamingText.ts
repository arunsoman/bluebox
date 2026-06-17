import { useState, useEffect, useCallback, useRef } from 'react';

interface UseStreamingTextOptions {
  speed?: number;
  onComplete?: () => void;
}

export function useStreamingText(options: UseStreamingTextOptions = {}) {
  const { speed = 20, onComplete } = options;
  const [displayText, setDisplayText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const targetTextRef = useRef('');
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startStreaming = useCallback(
    (text: string) => {
      // Reset state
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      targetTextRef.current = text;
      indexRef.current = 0;
      setDisplayText('');
      setIsComplete(false);
      setIsStreaming(true);
    },
    []
  );

  useEffect(() => {
    if (!isStreaming) return;

    const streamNext = () => {
      if (indexRef.current < targetTextRef.current.length) {
        indexRef.current += 1;
        setDisplayText(targetTextRef.current.slice(0, indexRef.current));
        timerRef.current = setTimeout(streamNext, speed);
      } else {
        setIsStreaming(false);
        setIsComplete(true);
        onComplete?.();
      }
    };

    timerRef.current = setTimeout(streamNext, speed);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isStreaming, speed, onComplete]);

  const stopStreaming = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setDisplayText(targetTextRef.current);
    setIsStreaming(false);
    setIsComplete(true);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    targetTextRef.current = '';
    indexRef.current = 0;
    setDisplayText('');
    setIsStreaming(false);
    setIsComplete(false);
  }, []);

  return {
    displayText,
    isStreaming,
    isComplete,
    startStreaming,
    stopStreaming,
    reset,
  };
}
