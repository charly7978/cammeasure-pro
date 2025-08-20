import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const [currentMeasurement, setCurrentMeasurement] = useState<RealTimeMeasurementType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const lastFrameTime = useRef<number>(0);
  const animationFrameId = useRef<number>(0);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

  // SIMPLE FRAME MONITORING - NO PROCESSING
  useEffect(() => {
    if (!isActive) return;
    
    const updateStatus = () => {
      setFrameCount(prev => prev + 1);
      const currentTime = performance.now();
      if (lastFrameTime.current > 0) {
        const frameTime = currentTime - lastFrameTime.current;
        setFps(Math.round(1000 / frameTime));
      }
      lastFrameTime.current = currentTime;
    };

    const intervalId = setInterval(updateStatus, 1000);
    return () => clearInterval(intervalId);
  }, [isActive]);

  return (
    <div className="absolute bottom-4 left-4 bg-black/80 text-white p-3 rounded-lg text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
        <span>{isProcessing ? 'Procesando...' : 'Activo'}</span>
      </div>
      
      {currentMeasurement && (
        <div className="space-y-1">
          <div>Frame: {frameCount}</div>
          <div>FPS: {fps.toFixed(1)}</div>
          <div>Tiempo: {currentMeasurement.processingTime.toFixed(1)}ms</div>
          <div>Confianza: {(currentMeasurement.confidence * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
};
