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

  // Referencias para manejo de tareas mejorado
  const currentTaskRef = useRef<Task | null>(null);
  const taskQueueRef = useRef<Task[]>([]);
  const isProcessingRef = useRef(false);
  const readyRef = useRef(false);

  // Almacenar solicitudes pendientes (compatibilidad con versión simple)
  const pendingRequests = useRef<Map<string, { onDetect: (rects: any[]) => void }>>(new Map());

  // Tipos para tareas
  interface Task {
    id: string;
    imageData: ImageData;
    minArea: number;
    onDetect: (rects: any[]) => void;
    onError?: (error: Error) => void;
    onTimeout?: () => void;
    timeoutId?: NodeJS.Timeout;
  }

  interface DetectOptions {
    imageData: ImageData;
    minArea?: number;
    onDetect: (rects: any[]) => void;
    onError?: (error: Error) => void;
    onTimeout?: () => void;
  }

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
              // Manejar tanto el nuevo sistema como el antiguo para compatibilidad
              const pendingRequest = pendingRequests.current.get(taskId);
              if (pendingRequest) {
                pendingRequest.onDetect(data.objects);
                pendingRequests.current.delete(taskId);
              }
              // También manejar con el nuevo sistema
              handleDetectionResult(taskId, data.objects);
            }
            if (data?.isOpenCVReady !== undefined) {
              setIsOpenCVReady(data.isOpenCVReady);
              readyRef.current = true;
            }
            break;

          case 'ERROR':
            if (workerError) {
              setError(workerError);
              console.error('Worker error:', workerError);
              handleTaskError(taskId, new Error(workerError));
            }
            break;

          case 'STATUS':
            if (message) {
              console.log('Worker status:', message);
            }
            break;
        }

        setIsProcessing(false);
        isProcessingRef.current = false;
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setError('Error en el worker de detección');
        setIsProcessing(false);
        isProcessingRef.current = false;
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

  const generateTaskId = useCallback(() => {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Procesar siguiente tarea en la cola
  const processNextTask = useCallback(() => {
    if (taskQueueRef.current.length === 0) {
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    const task = taskQueueRef.current.shift()!;
    currentTaskRef.current = task;
    isProcessingRef.current = true;
    setIsProcessing(true);

    // Configurar timeout (5 segundos)
    task.timeoutId = setTimeout(() => {
      if (task.onTimeout) {
        task.onTimeout();
      }
      handleTaskError(task.id, new Error('Timeout en la detección'));
    }, 5000);

    // Enviar tarea al worker
    try {
      workerRef.current?.postMessage({
        type: 'DETECT',
        taskId: task.id,
        imageData: task.imageData,
        minArea: task.minArea
      });
    } catch (err) {
      console.error('Error sending message to worker:', err);
      handleTaskError(task.id, err as Error);
    }
  }, []);

  // Transformar objetos del worker al formato BoundingRect
  const transformToBoundingRect = useCallback((objects: any[]): any[] => {
    return objects.map(obj => ({
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      area: obj.area || (obj.width * obj.height),
      confidence: obj.confidence || 0.5
    }));
  }, []);

  // Manejar resultado de detección
  const handleDetectionResult = useCallback((taskId: string, objects: any[]) => {
    const task = currentTaskRef.current;
    if (task && task.id === taskId) {
      // Limpiar timeout
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      
      // Transformar objetos al formato esperado
      const rects = transformToBoundingRect(objects);
      
      // Ejecutar callback
      try {
        task.onDetect(rects);
      } catch (err) {
        console.error('Error in detection callback:', err);
      }
      
      // Limpiar tarea actual
      currentTaskRef.current = null;
      
      // Procesar siguiente tarea
      processNextTask();
    }
  }, [processNextTask, transformToBoundingRect]);

  // Manejar error en tarea
  const handleTaskError = useCallback((taskId: string, error: Error) => {
    const task = currentTaskRef.current;
    if (task && task.id === taskId) {
      // Limpiar timeout
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      
      // Ejecutar callback de error
      if (task.onError) {
        try {
          task.onError(error);
        } catch (err) {
          console.error('Error in error callback:', err);
        }
      }
      
      // Actualizar estado de error
      setError(error.message);
      
      // Limpiar tarea actual
      currentTaskRef.current = null;
      
      // Procesar siguiente tarea
      processNextTask();
    }
  }, [processNextTask]);

  // Detectar objetos (versión mejorada con compatibilidad)
  const detect = useCallback((opts: DetectOptions) => {
    if (!workerRef.current || !isInitialized) {
      const error = new Error('Worker no está inicializado');
      setError(error.message);
      if (opts.onError) {
        opts.onError(error);
      }
      return;
    }

    const { imageData, minArea = 100, onDetect, onError, onTimeout } = opts;
    
    // Usar el nuevo sistema de colas para mejor manejo
    const task: Task = {
      id: generateTaskId(),
      imageData,
      minArea,
      onDetect,
      onError,
      onTimeout
    };

    // Agregar a la cola
    taskQueueRef.current.push(task);
    
    // Si no se está procesando, iniciar
    if (!isProcessingRef.current) {
      processNextTask();
    }
  }, [isInitialized, processNextTask, generateTaskId]);

  // Cancelar todas las tareas pendientes
  const cancelAll = useCallback(() => {
    // Cancelar tarea actual
    if (currentTaskRef.current) {
      if (currentTaskRef.current.timeoutId) {
        clearTimeout(currentTaskRef.current.timeoutId);
      }
      currentTaskRef.current = null;
    }
    
    // Cancelar tareas en cola
    taskQueueRef.current.forEach(task => {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
    });
    taskQueueRef.current = [];
    
    // Resetear estado
    isProcessingRef.current = false;
    setIsProcessing(false);
  }, []);

  // Reiniciar worker
  const restart = useCallback(() => {
    cancelAll();
    readyRef.current = false;
    setIsOpenCVReady(false);
    setError(null);
    
    // Re-inicializar worker
    if (workerRef.current) {
      const taskId = generateTaskId();
      workerRef.current.postMessage({
        type: 'INIT',
        taskId
      });
    }
  }, [cancelAll, generateTaskId]);

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
    getStatus,
    cancelAll,
    restart
  };
};
