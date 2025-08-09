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
            
          case 'SUCCESS':
            handleDetectionResult(data.taskId, data.data.objects);
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
      w.postMessage({ type: 'INIT' });
      
    } catch (err) {
      console.error('Error initializing worker:', err);
      setError(err instanceof Error ? err : new Error('Error al inicializar el worker'));
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      // Limpiar timeouts pendientes
      taskQueueRef.current.forEach(task => {
        if (task.timeoutId) {
          clearTimeout(task.timeoutId);
        }
      });
      if (currentTaskRef.current?.timeoutId) {
        clearTimeout(currentTaskRef.current.timeoutId);
      }
    };
  }, []);

  // Procesar la siguiente tarea en la cola
  const processNextTask = useCallback(() => {
    if (isProcessingRef.current || taskQueueRef.current.length === 0) {
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
    workerRef.current?.postMessage({
      type: 'DETECT',
      taskId: task.id,
      imageData: task.imageData,
      minArea: task.minArea
    });
  }, []);

  // Transformar objetos del worker al formato BoundingRect
  const transformToBoundingRect = useCallback((objects: any[]): BoundingRect[] => {
    return objects.map(obj => ({
      x: Number(obj.x),
      y: Number(obj.y),
      width: Number(obj.width),
      height: Number(obj.height),
      area: Number(obj.area || (obj.width * obj.height)),
      confidence: Number(obj.confidence || 0.5),
      circularity: Number(obj.circularity || 0.5),
      solidity: Number(obj.solidity || 0.8),
      extent: Number(obj.extent || 0.7),
      aspectRatio: Number(obj.aspectRatio || (obj.width / obj.height)),
      compactness: Number(obj.compactness || 0.6),
      perimeter: Number(obj.perimeter || (2 * (obj.width + obj.height))),
      contourPoints: Number(obj.contourPoints || 4),
      centerX: Number(obj.centerX || (obj.x + obj.width / 2)),
      centerY: Number(obj.centerY || (obj.y + obj.height / 2)),
      huMoments: Array.isArray(obj.huMoments) ? obj.huMoments : [0, 0, 0, 0, 0, 0, 0],
      isConvex: Boolean(obj.isConvex !== false),
      boundingCircleRadius: Number(obj.boundingCircleRadius || Math.sqrt(obj.width * obj.width + obj.height * obj.height) / 2),
      depth: obj.depth !== undefined ? Number(obj.depth) : undefined,
      realWidth: obj.realWidth !== undefined ? Number(obj.realWidth) : undefined,
      realHeight: obj.realHeight !== undefined ? Number(obj.realHeight) : undefined
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
      setError(error);
      
      // Limpiar tarea actual
      currentTaskRef.current = null;
      
      // Procesar siguiente tarea
      processNextTask();
    }
  }, [processNextTask]);

  // Detectar objetos (versión mejorada)
  const detect = useCallback((opts: DetectOptions) => {
    if (!workerRef.current || !readyRef.current) {
      const error = new Error('Worker no está listo');
      setError(error);
      if (opts.onError) {
        opts.onError(error);
      }
      return;
    }

    const { imageData, minArea = 100, onDetect, onError, onTimeout } = opts;
    
    // Crear nueva tarea
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
  }, [processNextTask]);

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
    setIsReady(false);
    setError(null);
    
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    // Re-inicializar worker
    try {
      workerRef.current = new Worker(new URL('../workers/measurementWorker.ts', import.meta.url), {
        type: 'module'
      });
      
      const w = workerRef.current;
      
      w.onmessage = (e: MessageEvent<any>) => {
        const { type, data } = e.data;
        
        switch (type) {
          case 'READY':
            readyRef.current = true;
            setIsReady(true);
            setError(null);
            break;
            
          case 'SUCCESS':
            handleDetectionResult(data.taskId, data.data.objects);
            break;
            
          case 'ERROR':
            handleTaskError(data.taskId, new Error(data.error));
            break;
        }
      };

      w.onerror = (err) => {
        console.error('Worker error:', err);
        setError(new Error('Error en el worker de medición'));
      };

      w.postMessage({ type: 'INIT' });
    } catch (err) {
      console.error('Error restarting worker:', err);
      setError(err instanceof Error ? err : new Error('Error al reiniciar el worker'));
    }
  }, [cancelAll, handleDetectionResult, handleTaskError]);

  return {
    detect,
    cancelAll,
    restart,
    isReady,
    isProcessing,
    error
  };
};
