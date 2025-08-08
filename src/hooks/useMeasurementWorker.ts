
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
  const initializingRef = useRef(false);

  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      workerRef.current = new Worker(
        new URL('../workers/measurementWorker.ts', import.meta.url), 
        { type: 'module' }
      );
      
      const worker = workerRef.current;
      
      worker.onmessage = (e: MessageEvent<any>) => {
        console.log('📨 Mensaje del worker:', e.data.type);
        
        if (e.data.type === 'READY') {
          readyRef.current = true;
          console.log('✅ Worker listo para procesar');
        } else if (e.data.type === 'ERROR') {
          console.error('❌ Error en worker:', e.data.error);
          readyRef.current = false;
        }
      };
      
      worker.onerror = (error) => {
        console.error('❌ Error crítico en worker:', error);
        readyRef.current = false;
      };
      
      // Inicializar worker
      worker.postMessage({ type: 'INIT' });
      
    } catch (error) {
      console.error('❌ Error creando worker:', error);
      readyRef.current = false;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = undefined;
      }
      readyRef.current = false;
      initializingRef.current = false;
    };
  }, []);

  const detect = useCallback((opts: DetectOptions) => {
    if (!workerRef.current) {
      console.warn('⚠️ Worker no disponible');
      opts.onDetect([]);
      return;
    }

    if (!readyRef.current) {
      console.warn('⚠️ Worker no está listo');
      opts.onDetect([]);
      return;
    }

    const { imageData, minArea = 500, onDetect } = opts;
    
    console.log('🔍 Iniciando detección:', {
      size: `${imageData.width}x${imageData.height}`,
      minArea
    });

    const handleResponse = (e: MessageEvent<any>) => {
      if (e.data.type === 'DETECTED') {
        console.log('✅ Detección completada:', e.data.rects.length, 'objetos');
        onDetect(e.data.rects);
        workerRef.current?.removeEventListener('message', handleResponse);
      } else if (e.data.type === 'ERROR') {
        console.error('❌ Error en detección:', e.data.error);
        onDetect([]);
        workerRef.current?.removeEventListener('message', handleResponse);
      }
    };

    workerRef.current.addEventListener('message', handleResponse);
    
    // Enviar tarea de detección
    workerRef.current.postMessage({ 
      type: 'DETECT', 
      imageData, 
      minArea 
    });

    // Timeout de seguridad
    setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.removeEventListener('message', handleResponse);
        console.warn('⏰ Timeout en detección');
        onDetect([]);
      }
    }, 5000);

  }, []);

  return { 
    detect,
    isReady: readyRef.current
  };
};
