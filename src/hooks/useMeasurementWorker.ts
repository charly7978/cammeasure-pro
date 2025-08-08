import { useEffect, useRef, useCallback } from 'react';
import { BoundingRect } from '@/lib/imageProcessing';

interface AdvancedDetectOptions {
  imageData: ImageData;
  minArea?: number;
  enableMultiScale?: boolean;
  enableTemporalStabilization?: boolean;
  maxObjects?: number;
  confidenceThreshold?: number;
  onDetect: (rects: BoundingRect[]) => void;
}

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
      if (e.data.type === 'READY') {
        readyRef.current = true;
        console.log('Advanced measurement worker ready');
      }
    };
    return () => w.terminate();
  }, []);

  const detect = useCallback((opts: DetectOptions) => {
    if (!workerRef.current || !readyRef.current) return;
    
    const { imageData, minArea = 1000, onDetect } = opts;
    
    // Configuración profesional por defecto
    const advancedOptions = {
      enableMultiScale: true,
      enableTemporalStabilization: true,
      maxObjects: 3,
      confidenceThreshold: 0.4
    };
    
    const handler = (e: MessageEvent<any>) => {
      if (e.data.type === 'DETECTED') {
        onDetect(e.data.rects);
        workerRef.current?.removeEventListener('message', handler as any);
      }
    };
    
    workerRef.current.addEventListener('message', handler as any);
    workerRef.current.postMessage({ 
      type: 'DETECT', 
      imageData, 
      minArea,
      options: advancedOptions
    });
  }, []);

  const detectAdvanced = useCallback((opts: AdvancedDetectOptions) => {
    if (!workerRef.current || !readyRef.current) return;
    
    const { 
      imageData, 
      minArea = 1000, 
      enableMultiScale = true,
      enableTemporalStabilization = true,
      maxObjects = 3,
      confidenceThreshold = 0.4,
      onDetect 
    } = opts;
    
    const handler = (e: MessageEvent<any>) => {
      if (e.data.type === 'DETECTED') {
        onDetect(e.data.rects);
        workerRef.current?.removeEventListener('message', handler as any);
      }
    };
    
    workerRef.current.addEventListener('message', handler as any);
    workerRef.current.postMessage({ 
      type: 'DETECT', 
      imageData, 
      minArea,
      options: {
        enableMultiScale,
        enableTemporalStabilization,
        maxObjects,
        confidenceThreshold
      }
    });
  }, []);

  const isReady = useCallback(() => {
    return readyRef.current;
  }, []);

  return { 
    detect, 
    detectAdvanced,
    isReady
  };
};
