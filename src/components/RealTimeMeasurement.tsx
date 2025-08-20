import React, { useState, useEffect } from 'react';
import { useSimpleMeasurement } from '@/hooks/useSimpleMeasurement';
import { useCalibration } from '@/hooks/useCalibration';
import { DetectedObject, RealTimeMeasurement as RealTimeMeasurementType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Target, Zap } from 'lucide-react';

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
  
  const { getPixelsPerMm, isCalibrated } = useCalibration();
  const [clickMode, setClickMode] = useState(false);
  
  const pixelsPerMm = isCalibrated() ? getPixelsPerMm() : 1;
  
  const {
    isProcessing,
    lastMeasurement,
    measureByClick,
    measureAutomatic
  } = useSimpleMeasurement({
    videoRef: videoRef!,
    pixelsPerMm,
    onMeasurementUpdate: (measurement) => {
      // Convertir medición simple a formato completo
      const convertedMeasurement: RealTimeMeasurementType = {
        width: measurement.width,
        height: measurement.height,
        area: measurement.area,
        perimeter: measurement.perimeter,
        circularity: 0.8, // Valor por defecto
        solidity: 0.9, // Valor por defecto
        confidence: measurement.confidence,
        depth: 100,
        volume: measurement.area * 100,
        surfaceArea: measurement.area * 2,
        curvature: 0.1,
        roughness: 0.1,
        orientation: { pitch: 0, yaw: 0, roll: 0 },
        materialProperties: {
          refractiveIndex: 1.0,
          scatteringCoefficient: 0,
          absorptionCoefficient: 0
        },
        uncertainty: {
          measurement: 1 - measurement.confidence,
          calibration: 0.05,
          algorithm: 0.02,
          total: 1 - measurement.confidence + 0.07
        },
        algorithm: 'Simple Edge Detection',
        processingTime: 50,
        frameRate: 30,
        qualityMetrics: {
          sharpness: measurement.confidence,
          contrast: 0.8,
          noise: 0.1,
          blur: 0.1
        }
      };
      onMeasurementUpdate(convertedMeasurement);
    },
    onError
  });
  
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
  
  // Medición automática cada 5 segundos cuando está activa
  useEffect(() => {
    if (!isActive || clickMode) return;
    
    const interval = setInterval(() => {
      measureAutomatic();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isActive, clickMode, measureAutomatic]);

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
      <div className="absolute bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-sm border border-green-500/30 max-w-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
          <span className="text-green-400 font-semibold text-xs">
            MEDICIÓN SIMPLE ACTIVA
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
            disabled={isProcessing}
            className="text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            Medir
          </Button>
        </div>
        
        {/* ESTADO DE CALIBRACIÓN */}
        <div className="text-xs mb-2">
          <span className="text-gray-400">Calibración: </span>
          <span className={isCalibrated() ? 'text-green-400' : 'text-red-400'}>
            {isCalibrated() ? 'OK' : 'Sin calibrar'}
          </span>
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
