import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCalibration } from '@/hooks/useCalibration';
import { realDepthCalculator, type RealMeasurement3D, type DepthMap } from '@/lib/realDepthCalculation';

export interface Real3DObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  measurements3D: RealMeasurement3D;
  depthMap: DepthMap;
  confidence: number;
  timestamp: number;
}

interface Real3DMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjects3DDetected: (objects: Real3DObject[]) => void;
  isActive: boolean;
  detectedObjects: any[]; // Objetos 2D detectados previamente
}

export const Real3DMeasurement: React.FC<Real3DMeasurementProps> = ({
  videoRef,
  onObjects3DDetected,
  isActive,
  detectedObjects
}) => {
  const { calibration } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState<'pending' | 'calibrating' | 'ready'>('pending');
  
  const PROCESS_INTERVAL = 1000; // Procesar cada segundo para cálculos 3D intensivos

  const processFrame3D = useCallback(async () => {
    if (!isActive || !videoRef.current || !canvasRef.current || isProcessing) {
      rafRef.current = requestAnimationFrame(processFrame3D);
      return;
    }

    const now = Date.now();
    if (now - lastProcessTime.current < PROCESS_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame3D);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < video.HAVE_ENOUGH_DATA || detectedObjects.length === 0) {
      rafRef.current = requestAnimationFrame(processFrame3D);
      return;
    }

    lastProcessTime.current = now;
    setIsProcessing(true);

    try {
      // Capturar frame actual
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      console.log('🔍 Iniciando análisis 3D real...');

      // Calibrar cámara automáticamente si es necesario
      if (calibrationStatus === 'pending') {
        setCalibrationStatus('calibrating');
        console.log('📐 Calibrando cámara para medición 3D...');
        
        // Usar frames históricos para calibración
        const success = await realDepthCalculator.calibrateCamera([imageData]);
        setCalibrationStatus(success ? 'ready' : 'pending');
        
        if (success) {
          console.log('✅ Calibración 3D completada');
        } else {
          console.warn('⚠️ Calibración 3D falló, usando parámetros estimados');
        }
      }

      if (calibrationStatus !== 'ready') {
        rafRef.current = requestAnimationFrame(processFrame3D);
        setIsProcessing(false);
        return;
      }

      // Procesar cada objeto detectado en 2D para obtener mediciones 3D reales
      const objects3D: Real3DObject[] = [];

      for (const obj2D of detectedObjects.slice(0, 1)) { // Solo el mejor objeto para evitar sobrecarga
        try {
          console.log(`🎯 Calculando profundidad real para objeto:`, obj2D.bounds);

          // Calcular mapa de profundidad real usando Structure from Motion
          const depthMap = await realDepthCalculator.calculateRealDepth(imageData, obj2D.bounds);
          
          console.log(`📊 Mapa de profundidad generado: ${depthMap.width}x${depthMap.height}`);
          
          // Verificar si tenemos datos de profundidad válidos
          const validDepths = Array.from(depthMap.depths).filter(d => d > 0).length;
          const totalPixels = depthMap.depths.length;
          const coverage = validDepths / totalPixels;
          
          console.log(`📈 Cobertura de profundidad: ${(coverage * 100).toFixed(1)}% (${validDepths}/${totalPixels} píxeles)`);

          if (coverage < 0.1) {
            console.warn('⚠️ Insuficiente información de profundidad, saltando objeto');
            continue;
          }

          // Calcular mediciones 3D reales
          const measurements3D = await realDepthCalculator.calculateReal3DMeasurements(depthMap, obj2D.bounds);
          
          console.log('📏 Mediciones 3D calculadas:', {
            width3D: measurements3D.width3D.toFixed(2) + 'mm',
            height3D: measurements3D.height3D.toFixed(2) + 'mm',
            depth3D: measurements3D.depth3D.toFixed(2) + 'mm',
            volume3D: measurements3D.volume3D.toFixed(2) + 'mm³',
            distance: measurements3D.distance.toFixed(2) + 'mm',
            confidence: (measurements3D.confidence * 100).toFixed(1) + '%',
            points3D: measurements3D.points3D.length
          });

          // Validar mediciones
          if (measurements3D.width3D > 0 && measurements3D.height3D > 0 && measurements3D.depth3D > 0) {
            const object3D: Real3DObject = {
              id: `3d_${obj2D.id}_${Date.now()}`,
              bounds: obj2D.bounds,
              measurements3D,
              depthMap,
              confidence: measurements3D.confidence,
              timestamp: Date.now()
            };

            objects3D.push(object3D);
            console.log('✅ Objeto 3D procesado exitosamente');
          } else {
            console.warn('⚠️ Mediciones 3D inválidas:', measurements3D);
          }

        } catch (error) {
          console.error('❌ Error procesando objeto 3D:', error);
        }
      }

      // Enviar resultados
      onObjects3DDetected(objects3D);
      
      if (objects3D.length > 0) {
        console.log(`🎉 ${objects3D.length} objeto(s) 3D procesado(s) exitosamente`);
      }

    } catch (error) {
      console.error('❌ Error en procesamiento 3D:', error);
    } finally {
      setIsProcessing(false);
      rafRef.current = requestAnimationFrame(processFrame3D);
    }
  }, [isActive, videoRef, detectedObjects, isProcessing, calibrationStatus, onObjects3DDetected]);

  useEffect(() => {
    if (isActive && detectedObjects.length > 0) {
      console.log('🚀 Iniciando procesamiento 3D real');
      rafRef.current = requestAnimationFrame(processFrame3D);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive, detectedObjects, processFrame3D]);

  // Mostrar estado de calibración
  useEffect(() => {
    if (calibrationStatus === 'calibrating') {
      console.log('🔄 Calibrando sistema 3D...');
    } else if (calibrationStatus === 'ready') {
      console.log('✅ Sistema 3D listo para mediciones reales');
    }
  }, [calibrationStatus]);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Indicador de estado 3D */}
      {isActive && (
        <div className="fixed top-20 right-4 z-50">
          <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
            calibrationStatus === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            calibrationStatus === 'calibrating' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                calibrationStatus === 'ready' ? 'bg-green-400' :
                calibrationStatus === 'calibrating' ? 'bg-yellow-400 animate-pulse' :
                'bg-gray-400'
              }`} />
              <span>
                {calibrationStatus === 'ready' ? '3D REAL ACTIVO' :
                 calibrationStatus === 'calibrating' ? 'CALIBRANDO 3D...' :
                 '3D PENDIENTE'}
              </span>
            </div>
            {isProcessing && (
              <div className="text-xs opacity-70 mt-1">
                Procesando...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};