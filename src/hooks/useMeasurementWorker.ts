import { useState, useEffect, useRef, useCallback } from 'react';

interface DetectionMessage {
  type: 'DETECT';
  taskId: string;
  imageData: ImageData;
  minArea: number;
  onDetect: (rects: any[]) => void;
}

interface DetectedObject {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  confidence: number;
  circularity: number;
  solidity: number;
  extent: number;
  aspectRatio: number;
  compactness: number;
  perimeter: number;
  contourPoints: number;
  centerX: number;
  centerY: number;
  huMoments: number[];
  isConvex: boolean;
  boundingCircleRadius: number;
  depth?: number;
  realWidth?: number;
  realHeight?: number;
}

interface DetectionResult {
  taskId: string;
  objects: DetectedObject[];
  processingTime: number;
  algorithm: 'opencv' | 'native';
  isOpenCVReady: boolean;
}

export const useMeasurementWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar el worker
  useEffect(() => {
    try {
      // Crear el worker
      const worker = new Worker(new URL('../workers/measurementWorker.ts', import.meta.url), {
        type: 'module'
      });

      workerRef.current = worker;

      // Manejar mensajes del worker
      worker.onmessage = (event: MessageEvent) => {
        const { type, taskId, data, error: workerError, message } = event.data;

        switch (type) {
          case 'SUCCESS':
            if (data?.objects) {
              // Encontrar el callback correspondiente por taskId
              const pendingRequest = pendingRequests.current.get(taskId);
              if (pendingRequest) {
                pendingRequest.onDetect(data.objects);
                pendingRequests.current.delete(taskId);
              }
            }
            if (data?.isOpenCVReady !== undefined) {
              setIsOpenCVReady(data.isOpenCVReady);
            }
            break;

          case 'ERROR':
            if (workerError) {
              setError(workerError);
              console.error('Worker error:', workerError);
            }
            break;

          case 'STATUS':
            if (message) {
              console.log('Worker status:', message);
            }
            break;
        }

        setIsProcessing(false);
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setError('Error en el worker de detección');
        setIsProcessing(false);
      };

      // Inicializar el worker
      const taskId = generateTaskId();
      worker.postMessage({
        type: 'INIT',
        taskId
      });

      setIsInitialized(true);

      return () => {
        worker.terminate();
      };
    } catch (err) {
      console.error('Error initializing worker:', err);
      setError('No se pudo inicializar el worker de detección');
    }
  }, []);

  // Almacenar solicitudes pendientes
  const pendingRequests = useRef<Map<string, { onDetect: (rects: any[]) => void }>>(new Map());

  const generateTaskId = useCallback(() => {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const detect = useCallback(async (params: {
    imageData: ImageData;
    minArea: number;
    onDetect: (rects: any[]) => void;
  }) => {
    if (!workerRef.current || !isInitialized) {
      console.warn('Worker no está inicializado');
      return;
    }

    if (isProcessing) {
      console.warn('Worker ya está procesando');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const taskId = generateTaskId();
    
    // Almacenar el callback
    pendingRequests.current.set(taskId, {
      onDetect: params.onDetect
    });

    try {
      workerRef.current.postMessage({
        type: 'DETECT',
        taskId,
        imageData: params.imageData,
        minArea: params.minArea
      });
    } catch (err) {
      console.error('Error sending message to worker:', err);
      setError('Error al enviar datos al worker');
      setIsProcessing(false);
      pendingRequests.current.delete(taskId);
    }
  }, [isInitialized, isProcessing, generateTaskId]);

  const getStatus = useCallback(() => {
    if (!workerRef.current || !isInitialized) {
      return 'no_inicializado';
    }
    return isOpenCVReady ? 'opencv_listo' : 'modo_nativo';
  }, [isInitialized, isOpenCVReady]);

  return {
    detect,
    isInitialized,
    isOpenCVReady,
    isProcessing,
    error,
    getStatus
  };
};
