import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';

export interface MeasurementPoint {
  x: number;
  y: number;
  realX?: number;
  realY?: number;
  depth?: number;
}

export interface MeasurementResult {
  distance2D: number;
  distance3D?: number;
  area?: number;
  volume?: number;
  unit: string;
  confidence: number;
}

interface MeasurementEngineProps {
  imageData: ImageData | null;
  onMeasurementResult: (result: MeasurementResult) => void;
  onDetectedEdges: (edges: MeasurementPoint[]) => void;
}

export const MeasurementEngine: React.FC<MeasurementEngineProps> = ({
  imageData,
  onMeasurementResult,
  onDetectedEdges
}) => {
  const { detect } = useMeasurementWorker();
  const { calibrationData } = useCalibration(); // Use global calibration
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);

  const drawResults = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas and redraw the base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageData) {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);
    }

    // Draw manual measurement points and lines
    measurementPoints.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = index === 0 ? '#84cc16' : '#06b6d4';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    if (measurementPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(measurementPoints[0].x, measurementPoints[0].y);
      for (let i = 1; i < measurementPoints.length; i++) {
        ctx.lineTo(measurementPoints[i].x, measurementPoints[i].y);
      }
      ctx.strokeStyle = '#fb923c'; // Orange line
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [imageData, measurementPoints]);

  useEffect(() => {
    if (imageData) {
      // Automated detection via worker
      detect({
        imageData,
        minArea: 100,
        onDetect: (rects) => {
          const detectedPoints: MeasurementPoint[] = rects.map(r => ({
            x: r.x + r.width / 2,
            y: r.y + r.height / 2,
          }));
          onDetectedEdges(detectedPoints);

          if (detectedPoints.length >= 2) {
            calculateMeasurements(detectedPoints);
          }
        },
      });
    }
    // Always redraw when image or manual points change
    drawResults();
  }, [imageData, detect, onDetectedEdges, drawResults]);

  useEffect(() => {
    // Recalculate manual measurements if points or calibration changes
    if (measurementPoints.length >= 2) {
      calculateMeasurements(measurementPoints);
    }
  }, [measurementPoints, calibrationData]);

  const calculateMeasurements = (points: MeasurementPoint[]) => {
    // Use global calibration data
    if (!calibrationData?.isCalibrated || points.length < 2) return;

    // Calculate 2D distance between first two points
    const point1 = points[0];
    const point2 = points[1];
    
    const pixelDistance = Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
    
    const realDistance = pixelDistance / calibrationData.pixelsPerMm;

    const result: MeasurementResult = {
      distance2D: realDistance,
      unit: 'mm',
      confidence: 0.85 // Simplified confidence calculation
    };

    // If we have multiple points, calculate area
    if (points.length >= 3) {
      const area = calculatePolygonArea(points);
      result.area = area / (calibrationData.pixelsPerMm * calibrationData.pixelsPerMm);
    }

    onMeasurementResult(result);
  };

  const calculatePolygonArea = (points: MeasurementPoint[]): number => {
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  };

  const addMeasurementPoint = (x: number, y: number) => {
    // Real values will be calculated in `calculateMeasurements` using global calibration
    const newPoint: MeasurementPoint = { x, y };

    setMeasurementPoints(prev => [...prev, newPoint]);
  };

  const clearMeasurementPoints = () => {
    setMeasurementPoints([]);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-auto border border-border rounded-lg cursor-crosshair"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          addMeasurementPoint(x, y);
        }}
      />
      
      {measurementPoints.length > 0 && (
        <div className="absolute top-2 right-2">
          <button
            onClick={clearMeasurementPoints}
            className="px-3 py-1 bg-destructive text-destructive-foreground rounded-md text-sm"
          >
            Clear Points
          </button>
        </div>
      )}
    </div>
  );
};