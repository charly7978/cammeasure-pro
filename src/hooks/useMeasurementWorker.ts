import { useEffect, useRef, useCallback } from 'react';
import { BoundingRect } from '@/lib/imageProcessing';

interface DetectOptions {
  imageData: ImageData;
  minArea?: number;
  onDetect: (rects: BoundingRect[]) => void;
}

export const useMeasurementWorker = () => {
  const workerRef = useRef<Worker>();
  const readyRef = useRef(false);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/measurementWorker.ts', import.meta.url), {
      type: 'module'
    });
    const w = workerRef.current;
    w.postMessage({ type: 'INIT' });
    w.onmessage = (e: MessageEvent<any>) => {
      if (e.data.type === 'READY') readyRef.current = true;
    };
    return () => w.terminate();
  }, []);

  const detect = useCallback((opts: DetectOptions) => {
    if (!workerRef.current || !readyRef.current) return;
    const { imageData, minArea = 100, onDetect } = opts;
    const handler = (e: MessageEvent<any>) => {
      if (e.data.type === 'DETECTED') {
        onDetect(e.data.rects);
        workerRef.current?.removeEventListener('message', handler as any);
      }
    };
    workerRef.current.addEventListener('message', handler as any);
    workerRef.current.postMessage({ type: 'DETECT', imageData, minArea });
  }, []);

  return { detect };
};
