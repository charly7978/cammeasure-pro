import { useEffect, useRef, useCallback, useState } from 'react';
import { BoundingRect } from '@/lib/imageProcessing';

interface DetectOptions {
  imageData: ImageData;
  minArea?: number;
  onDetect: (rects: BoundingRect[]) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
}

interface Task {
  id: string;
  imageData: ImageData;
  minArea: number;
  onDetect: (rects: BoundingRect[]) => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
  timeoutId?: NodeJS.Timeout;
}

export const useMeasurementWorker = () => {
  const workerRef = useRef<Worker>();
  const readyRef = useRef(false);
  const isProcessingRef = useRef(false);
  const taskQueueRef = useRef<Task[]>([]);
  const currentTaskRef = useRef<Task | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Inicialización del worker con manejo de errores
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../workers/measurementWorker.ts', import.meta.url), {
        type: 'module'
      });
      
      const w = workerRef.current;
      
      // Manejador de mensajes único y persistente
      w.onmessage = (e: MessageEvent<any>) => {
        const { type, data } = e.data;
        
        switch (type) {
          case 'READY':
            readyRef.current = true;
            setIsReady(true);
            setError(null);
            break;
            
          case 'DETECTED':
            handleDetectionResult(data.taskId, data.rects);
            break;
            
          case 'ERROR':
            handleTaskError(data.taskId, new Error(data.error));
            break;
            
          case 'PROGRESS':
            // Manejar progreso si es necesario
            break;
        }
      };

      // Manejador de errores del worker
      w.onerror = (err) => {
        console.error('Worker error:', err);
        setError(new Error('Error en el worker de medición'));
        if (currentTaskRef.current) {
          handleTaskError(currentTaskRef.current.id, new Error('Error en el worker'));
        }
      };

      // Inicializar el worker
