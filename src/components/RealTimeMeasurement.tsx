import React from 'react';
import { useAutomaticMeasurement } from '@/hooks/useAutomaticMeasurement';
import { DetectedObject, RealTimeMeasurement as RealTimeMeasurementType } from '@/lib/types';

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
  
  // USAR HOOK ESPECIALIZADO PARA MEDICIÓN AUTOMÁTICA
  const {
    isProcessing,
    currentMeasurement,
    frameCount,
    fps,
    successRate,
    lastProcessingTime
  } = useAutomaticMeasurement({
    videoRef,
    overlayCanvasRef,
    isActive,
    onMeasurementUpdate: (measurement) => {
      // Convertir formato de medición automática a formato esperado
      const convertedMeasurement: RealTimeMeasurementType = {
        width: measurement.width,
        height: measurement.height,
        area: measurement.area,
        perimeter: measurement.perimeter,
        circularity: measurement.circularity,
        solidity: measurement.solidity,
        confidence: measurement.confidence,
        depth: 100, // Valor por defecto
        volume: measurement.area * 100,
        surfaceArea: measurement.area * 2,
        curvature: measurement.contourComplexity,
        roughness: 1 - measurement.stability,
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
        algorithm: measurement.algorithm,
        processingTime: measurement.processingTime,
        frameRate: fps,
        qualityMetrics: {
          sharpness: measurement.confidence,
          contrast: measurement.stability,
          noise: 1 - measurement.stability,
          blur: 1 - measurement.confidence
        }
      };
      onMeasurementUpdate(convertedMeasurement);
    },
    onSilhouetteDetected: (silhouette) => {
      // Convertir silueta a formato DetectedObject
      const detectedObject: DetectedObject = {
        id: 'auto_silhouette',
        type: 'silhouette',
        x: silhouette.boundingBox.x,
        y: silhouette.boundingBox.y,
        width: silhouette.boundingBox.width,
        height: silhouette.boundingBox.height,
        area: silhouette.area,
        confidence: silhouette.confidence,
        contours: silhouette.contours,
        boundingBox: silhouette.boundingBox,
        dimensions: {
          width: silhouette.boundingBox.width,
          height: silhouette.boundingBox.height,
          area: silhouette.area,
          unit: 'px' as const
        },
        points: silhouette.contours.map((point, index) => ({
          x: point.x,
          y: point.y,
          z: 0,
          confidence: silhouette.confidence,
          timestamp: Date.now() + index
        }))
      };
      
      if (onObjectsDetected) {
        onObjectsDetected([detectedObject]);
      }
    },
    onError
  });

  return (
    <div className="absolute bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-sm border border-green-500/30">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
        <span className="text-green-400 font-semibold">
          {isProcessing ? 'DETECTANDO SILUETA...' : 'MEDICIÓN AUTOMÁTICA ACTIVA'}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Frame:</span>
          <span className="text-green-400">{frameCount}</span>
        </div>
        <div className="flex justify-between">
          <span>FPS:</span>
          <span className="text-green-400">{fps.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span>Éxito:</span>
          <span className="text-green-400">{(successRate * 100).toFixed(1)}%</span>
        </div>
        {lastProcessingTime > 0 && (
          <div className="flex justify-between">
            <span>Tiempo:</span>
            <span className="text-green-400">{lastProcessingTime.toFixed(1)}ms</span>
          </div>
        )}
        {currentMeasurement && (
          <>
            <hr className="border-green-500/30 my-2" />
            <div className="text-xs text-green-300">
              <div>Área: {Math.round(currentMeasurement.area)} px²</div>
              <div>Perímetro: {Math.round(currentMeasurement.perimeter)} px</div>
              <div>Confianza: {(currentMeasurement.confidence * 100).toFixed(1)}%</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
