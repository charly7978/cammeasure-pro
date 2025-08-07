import React, { useCallback, useEffect, useRef } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
}

interface RealTimeMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjectsDetected: (objects: DetectedObject[]) => void;
  isActive: boolean;
}

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({
  videoRef,
  onObjectsDetected,
  isActive,
}) => {
  const { isLoaded } = useOpenCV();
  const { detect } = useMeasurementWorker();
  const { calibrationData } = useCalibration();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  const processFrame = useCallback(() => {
    if (!isActive || !isLoaded || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    detect({
      imageData,
      minArea: 500,
      onDetect: (rects) => {
        const factor = calibrationData.isCalibrated ? calibrationData.pixelsPerMm : 1;
        const unit = calibrationData.isCalibrated ? 'mm' : 'px';

        const objects: DetectedObject[] = rects.map((rect, i) => ({
          id: `obj_${i}_${Date.now()}`,
          bounds: rect,
          dimensions: {
            width: rect.width / factor,
            height: rect.height / factor,
            area: rect.area / (factor * factor),
            unit,
          },
          confidence: Math.min(0.5 + Math.min(rect.area / 5000, 0.5), 1),
          center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        }));

        onObjectsDetected(objects);
      },
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, isLoaded, videoRef, detect, calibrationData, onObjectsDetected]);

  useEffect(() => {
    if (isActive) {
      rafRef.current = requestAnimationFrame(processFrame);
    } else {
      rafRef.current && cancelAnimationFrame(rafRef.current);
    }
    return () => {
      rafRef.current && cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, processFrame]);

  return <canvas ref={canvasRef} style={{ display: 'none' }} />;
};
