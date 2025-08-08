
import { useEffect, useRef, useCallback, useState } from 'react';
import { BoundingRect } from '@/lib/imageProcessing';

interface DetectOptions {
  imageData: ImageData;
  minArea?: number;
  onDetect: (rects: BoundingRect[]) => void;
}

export const useMeasurementWorker = () => {
  const workerRef = useRef<Worker>();
  const [isReady, setIsReady] = useState(false);
  const initializingRef = useRef(false);
  const pendingCallbacksRef = useRef<Map<string, (rects: BoundingRect[]) => void>>(new Map());

  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      console.log('🔧 Inicializando Worker de Medición Avanzado...');
      
      workerRef.current = new Worker(
        new URL('../workers/measurementWorker.ts', import.meta.url), 
        { type: 'module' }
      );
      
      const worker = workerRef.current;
      
      worker.onmessage = (e: MessageEvent<any>) => {
        const { type, rects, timestamp, error } = e.data;
        
        console.log('📨 Mensaje del worker:', type, { timestamp });
        
        switch (type) {
          case 'READY':
            setIsReady(true);
            console.log('✅ Worker OpenCV completamente listo');
            break;
            
          case 'DETECTED':
            // Ejecutar callback pendiente si existe
            const callbackKey = timestamp?.toString() || 'latest';
            const callback = pendingCallbacksRef.current.get(callbackKey);
            if (callback) {
              callback(rects || []);
              pendingCallbacksRef.current.delete(callbackKey);
            }
            break;
            
          case 'ERROR':
            console.error('❌ Error en worker:', error);
            // Limpiar callbacks pendientes en caso de error
            pendingCallbacksRef.current.clear();
            // Reintentar inicialización después de un delay
            setTimeout(() => {
              if (workerRef.current) {
                workerRef.current.postMessage({ type: 'INIT' });
              }
            }, 2000);
            break;
            
          case 'OPENCV_READY':
            // OpenCV cargado, worker completamente operativo
            setIsReady(true);
            console.log('✅ OpenCV inicializado en worker');
            break;
        }
      };
      
      worker.onerror = (error) => {
        console.error('❌ Error crítico en worker:', error);
        setIsReady(false);
        // Intentar recrear worker
        setTimeout(() => {
          initializingRef.current = false;
          setIsReady(false);
        }, 1000);
      };
      
      // Inicializar worker
      worker.postMessage({ type: 'INIT' });
      
    } catch (error) {
      console.error('❌ Error creando worker:', error);
      setIsReady(false);
      initializingRef.current = false;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = undefined;
      }
      setIsReady(false);
      initializingRef.current = false;
      pendingCallbacksRef.current.clear();
    };
  }, []);

  const detect = useCallback((opts: DetectOptions) => {
    if (!workerRef.current) {
      console.warn('⚠️ Worker no disponible');
      opts.onDetect([]);
      return;
    }

    if (!isReady) {
      console.warn('⚠️ Worker no está listo, esperando...');
      opts.onDetect([]);
      return;
    }

    const { imageData, minArea = 500, onDetect } = opts;
    const timestamp = Date.now();
    
    console.log('🔍 Iniciando detección avanzada:', {
      size: `${imageData.width}x${imageData.height}`,
      minArea,
      timestamp
    });

    // Almacenar callback para este timestamp
    pendingCallbacksRef.current.set(timestamp.toString(), onDetect);
    
    // Enviar tarea de detección con timestamp
    workerRef.current.postMessage({ 
      type: 'DETECT', 
      imageData, 
      minArea,
      timestamp
    });

    // Timeout de seguridad más generoso para algoritmos avanzados
    setTimeout(() => {
      const callback = pendingCallbacksRef.current.get(timestamp.toString());
      if (callback) {
        console.warn('⏰ Timeout en detección avanzada');
        callback([]);
        pendingCallbacksRef.current.delete(timestamp.toString());
      }
    }, 8000); // 8 segundos para algoritmos complejos

  }, [isReady]);

  return { 
    detect,
    isReady
  };
};
