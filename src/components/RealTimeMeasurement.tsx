
import { useEffect, useRef, useCallback } from 'react';

export interface DetectedObject {
  id: string;
  type: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dimensions: {
    width: number;
    height: number;
    area: number;
    unit: string;
  };
  isReal3D?: boolean;
  measurements3D?: {
    width3D: number;
    height3D: number;
    depth3D: number;
    volume3D: number;
    distance: number;
    confidence: number;
  };
}

interface RealTimeMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjectsDetected: (objects: DetectedObject[]) => void;
  isActive: boolean;
}

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({
  videoRef,
  onObjectsDetected,
  isActive
}) => {
  const processingRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const processFrame = useCallback(() => {
    if (!videoRef.current || !isActive || processingRef.current) return;
    
    processingRef.current = true;
    
    try {
      // Simulate object detection - in real implementation this would use OpenCV
      const mockObjects: DetectedObject[] = [
        {
          id: 'obj-1',
          type: 'rectangle',
          confidence: 0.85,
          boundingBox: {
            x: Math.random() * 100 + 50,
            y: Math.random() * 100 + 50,
            width: 150,
            height: 100
          },
          dimensions: {
            width: 15.0,
            height: 10.0,
            area: 150.0,
            unit: 'cm'
          },
          isReal3D: Math.random() > 0.5,
          measurements3D: {
            width3D: 15.0,
            height3D: 10.0,
            depth3D: 5.0,
            volume3D: 750.0,
            distance: 50.0,
            confidence: 0.75
          }
        }
      ];

      onObjectsDetected(mockObjects);
    } finally {
      processingRef.current = false;
    }
  }, [videoRef, onObjectsDetected, isActive]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(processFrame, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, processFrame]);

  return null;
};
