import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAdvancedMeasurement } from '@/hooks/useAdvancedMeasurement';
import { useCalibration } from '@/hooks/useCalibration';
import { DetectedObject, RealTimeMeasurement as RealTimeMeasurementType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Target, Zap, Activity, CheckCircle, AlertCircle } from 'lucide-react';

interface RealTimeMeasurementProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  onObjectsDetected?: (objects: DetectedObject[]) => void;
  isActive: boolean;
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement>;
  onMeasurementUpdate: (measurement: RealTimeMeasurementType) => void;
  onError: (error: string) => void;
}

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({
  videoRef,
  onObjectsDetected,
  isActive,
  overlayCanvasRef,
  onMeasurementUpdate,
  onError
}) => {
  
  const { 
    isInitialized, 
    isProcessing, 
    lastMeasurement, 
    initializeSystem, 
    measureFromVideo,
    clearLastMeasurement 
  } = useAdvancedMeasurement();
  
  const { isCalibrated } = useCalibration();
  const [clickMode, setClickMode] = useState(false);
  const automaticIntervalRef = useRef<NodeJS.Timeout>();
  
  // INICIALIZACIÓN DEL SISTEMA
  useEffect(() => {
    if (!isInitialized) {
      initializeSystem().catch(error => {
        console.error('❌ Error inicializando sistema avanzado:', error);
        onError(`Error de inicialización: ${error.message}`);
      });
    }
  }, [isInitialized, initializeSystem, onError]);


  // MEDICIÓN MANUAL POR CLICK
  const measureByClick = useCallback(async (x: number, y: number) => {
    if (isProcessing || !isInitialized) return;
    
    try {
      console.log('🎯 INICIANDO MEDICIÓN MANUAL EN:', x, y);
      
      const measurement = await measureFromVideo(videoRef, x, y);
      onMeasurementUpdate(measurement);
      
    } catch (error) {
      console.error('❌ Error en medición manual:', error);
      onError(`Error de medición manual: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
  }, [isProcessing, isInitialized, measureFromVideo, videoRef, onMeasurementUpdate, onError]);

  // MEDICIÓN AUTOMÁTICA
  const measureAutomatic = useCallback(async () => {
    if (isProcessing || !isInitialized) return;
    
    try {
      console.log('🔄 INICIANDO MEDICIÓN AUTOMÁTICA...');
      
      const measurement = await measureFromVideo(videoRef);
      onMeasurementUpdate(measurement);
      
    } catch (error) {
      console.error('❌ Error en medición automática:', error);
      onError(`Error de medición automática: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
  }, [isProcessing, isInitialized, measureFromVideo, videoRef, onMeasurementUpdate, onError]);

  // Manejo de click en el video
  const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!clickMode || !videoRef?.current) return;
    
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    measureByClick(x, y);
  };
  
  // Medición automática cada 3 segundos cuando está activa
  useEffect(() => {
    if (!isActive || clickMode || !isInitialized) {
      if (automaticIntervalRef.current) {
        clearInterval(automaticIntervalRef.current);
        automaticIntervalRef.current = undefined;
      }
      return;
    }
    
    // Primera medición inmediata
    measureAutomatic();
    
    // Mediciones periódicas
    automaticIntervalRef.current = setInterval(() => {
      measureAutomatic();
    }, 3000);
    
    return () => {
      if (automaticIntervalRef.current) {
        clearInterval(automaticIntervalRef.current);
        automaticIntervalRef.current = undefined;
      }
    };
  }, [isActive, clickMode, isInitialized, measureAutomatic]);

  return (
    <>
      {/* OVERLAY PARA CLICKS */}
      {clickMode && videoRef?.current && (
        <div 
          className="absolute inset-0 cursor-crosshair z-10"
          onClick={handleVideoClick as any}
        />
      )}
      
      {/* PANEL DE INFORMACIÓN */}
      <div className="absolute bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-sm border border-blue-500/30 max-w-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-3 h-3 rounded-full ${
            isProcessing ? 'bg-yellow-400 animate-pulse' : 
            isInitialized ? 'bg-green-400' : 'bg-red-400'
          }`}></div>
          <span className={`font-semibold text-xs ${isInitialized ? 'text-green-400' : 'text-red-400'}`}>
            <Activity className="inline w-3 h-3 mr-1" />
            OPENCV AVANZADO {isInitialized ? 'ACTIVO' : 'INICIALIZANDO...'}
          </span>
        </div>
        
        {/* CONTROLES */}
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant={clickMode ? "default" : "outline"}
            onClick={() => setClickMode(!clickMode)}
            className="text-xs"
          >
            <Target className="h-3 w-3 mr-1" />
            {clickMode ? 'Click Activo' : 'Click Manual'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={measureAutomatic}
            disabled={isProcessing || !isInitialized}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            {isProcessing ? 'Midiendo...' : 'Medir'}
          </Button>
        </div>
        
        {/* ESTADO DEL SISTEMA */}
        <div className="text-xs mb-2 space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Sistema: </span>
            {isInitialized ? (
              <span className="text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Listo
              </span>
            ) : (
              <span className="text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Inicializando...
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Calibración: </span>
            {isCalibrated() ? (
              <span className="text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Activa
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Sin calibrar
              </span>
            )}
          </div>
          {isProcessing && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Estado: </span>
              <span className="text-yellow-400 animate-pulse">Procesando...</span>
            </div>
          )}
        </div>
        
        {/* INFORMACIÓN DE MEDICIÓN */}
        {lastMeasurement && (
          <>
            <hr className="border-green-500/30 my-2" />
            <div className="text-xs text-green-300 space-y-1">
              <div>Área: {Math.round(lastMeasurement.area)} {isCalibrated() ? 'mm²' : 'px²'}</div>
              <div>Perímetro: {Math.round(lastMeasurement.perimeter)} {isCalibrated() ? 'mm' : 'px'}</div>
              <div>Dimensiones: {Math.round(lastMeasurement.width)} × {Math.round(lastMeasurement.height)}</div>
              <div>Confianza: {(lastMeasurement.confidence * 100).toFixed(1)}%</div>
            </div>
          </>
        )}
        
        {/* INSTRUCCIONES */}
        {clickMode && (
          <div className="text-xs text-yellow-300 mt-2">
            👆 Toca cualquier parte del objeto para medir
          </div>
        )}
      </div>
    </>
  );
};
