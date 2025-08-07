import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeasurementWorker } from '@/hooks/useMeasurementWorker';
import { useCalibration } from '@/hooks/useCalibration';
import type { CalibrationData } from '@/components/CalibrationPanel';
import type { MeasurementMode } from './MeasurementControls';

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
  mode?: MeasurementMode;
  additionalData?: {
    perimeter?: number;
    diagonal?: number;
    aspectRatio?: number;
    estimatedDepth?: number;
    surfaceArea?: number;
  };
}

interface MeasurementEngineProps {
  imageData: ImageData | null;
  calibrationData: CalibrationData | null;
  onMeasurementResult: (result: MeasurementResult) => void;
  onDetectedEdges: (edges: MeasurementPoint[]) => void;
  measurementMode?: MeasurementMode;
}

export const MeasurementEngine: React.FC<MeasurementEngineProps> = ({
  imageData,
  calibrationData,
  onMeasurementResult,
  onDetectedEdges,
  measurementMode = '2d'
}) => {
  const { detect } = useMeasurementWorker();
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
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      
      // Different colors for different measurement modes
      switch (measurementMode) {
        case '3d':
          ctx.fillStyle = index === 0 ? '#3b82f6' : '#06b6d4'; // Blue tones
          break;
        case 'area':
          ctx.fillStyle = index === 0 ? '#10b981' : '#059669'; // Green tones
          break;
        case 'volume':
          ctx.fillStyle = index === 0 ? '#8b5cf6' : '#7c3aed'; // Purple tones
          break;
        case 'depth':
          ctx.fillStyle = index === 0 ? '#f59e0b' : '#d97706'; // Orange tones
          break;
        default:
          ctx.fillStyle = index === 0 ? '#84cc16' : '#06b6d4'; // Default colors
      }
      
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add point number
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText((index + 1).toString(), point.x, point.y + 4);
    });

    // Draw connections based on measurement mode
    if (measurementPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(measurementPoints[0].x, measurementPoints[0].y);
      
      if (measurementMode === 'area' && measurementPoints.length >= 3) {
        // Draw polygon for area measurement
        for (let i = 1; i < measurementPoints.length; i++) {
          ctx.lineTo(measurementPoints[i].x, measurementPoints[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fill();
      } else {
        // Draw lines for other measurements
        for (let i = 1; i < measurementPoints.length; i++) {
          ctx.lineTo(measurementPoints[i].x, measurementPoints[i].y);
        }
      }
      
      ctx.strokeStyle = measurementMode === 'area' ? '#10b981' : '#fb923c';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [imageData, measurementPoints, measurementMode]);

  useEffect(() => {
    if (imageData) {
      // Automated detection via worker
      detect({
        imageData,
        minArea: 500,
        onDetect: (rects) => {
          const detectedPoints: MeasurementPoint[] = rects.map(r => ({
            x: r.x + r.width / 2,
            y: r.y + r.height / 2,
          }));
          onDetectedEdges(detectedPoints);

          if (detectedPoints.length >= 1) {
            calculateAdvancedMeasurements(rects);
          }
        },
      });
    }
    // Always redraw when image or manual points change
    drawResults();
  }, [imageData, detect, onDetectedEdges, drawResults, measurementMode]);

  useEffect(() => {
    // Recalculate manual measurements if points or calibration changes
    if (measurementPoints.length >= 2) {
      calculateMeasurements(measurementPoints);
    }
  }, [measurementPoints, calibrationData, measurementMode]);

  const calculateAdvancedMeasurements = (rects: any[]) => {
    if (!rects.length) return;
    
    const rect = rects[0]; // Use the first detected rectangle
    const factor = calibrationData?.isCalibrated ? calibrationData.pixelsPerMm : 1;
    const unit = calibrationData?.isCalibrated ? 'mm' : 'px';
    
    const width = rect.width / factor;
    const height = rect.height / factor;
    const area = rect.area / (factor * factor);
    
    const result: MeasurementResult = {
      distance2D: Math.max(width, height),
      unit,
      confidence: rect.confidence || 0.8,
      mode: measurementMode,
      additionalData: {}
    };

    // Calculate different measurements based on mode
    switch (measurementMode) {
      case '2d':
        result.additionalData = {
          diagonal: Math.sqrt(width * width + height * height),
          perimeter: 2 * (width + height),
          aspectRatio: width / height
        };
        break;
        
      case '3d':
        // Estimate depth based on object size and camera parameters
        const estimatedDepth = estimateDepth(rect, calibrationData);
        result.distance3D = Math.sqrt(width * width + height * height + estimatedDepth * estimatedDepth);
        result.additionalData = {
          estimatedDepth,
          diagonal: Math.sqrt(width * width + height * height),
          aspectRatio: width / height
        };
        break;
        
      case 'area':
        result.area = area;
        result.additionalData = {
          perimeter: 2 * (width + height),
          surfaceArea: area * 1.2 // Estimate surface area with some factor
        };
        break;
        
      case 'volume':
        // Estimate volume assuming rectangular prism
        const estimatedThickness = Math.min(width, height) * 0.3; // Rough estimate
        result.volume = area * estimatedThickness;
        result.area = area;
        result.additionalData = {
          estimatedDepth: estimatedThickness,
          surfaceArea: 2 * (width * height + width * estimatedThickness + height * estimatedThickness)
        };
        break;
        
      case 'depth':
        const depth = estimateDepth(rect, calibrationData);
        result.additionalData = {
          estimatedDepth: depth,
          diagonal: Math.sqrt(width * width + height * height + depth * depth)
        };
        break;
    }

    onMeasurementResult(result);
  };

  const estimateDepth = (rect: any, calibration: CalibrationData | null): number => {
    if (!calibration?.isCalibrated) return 0;
    
    // Simple depth estimation based on object size
    // Larger objects are assumed to be closer
    const avgDimension = Math.sqrt(rect.area) / calibration.pixelsPerMm;
    
    // Rough estimation: objects between 50-500mm are at "normal" distance
    if (avgDimension < 50) return avgDimension * 0.5; // Small objects, less depth
    if (avgDimension > 500) return avgDimension * 0.2; // Large objects, proportionally less depth
    return avgDimension * 0.3; // Medium objects
  };

  const calculateMeasurements = (points: MeasurementPoint[]) => {
    if (points.length < 2) return;

    const factor = calibrationData?.isCalibrated ? calibrationData.pixelsPerMm : 1;
    const unit = calibrationData?.isCalibrated ? 'mm' : 'px';

    const result: MeasurementResult = {
      distance2D: 0,
      unit,
      confidence: 0.9,
      mode: measurementMode,
      additionalData: {}
    };

    if (measurementMode === 'area' && points.length >= 3) {
      // Calculate polygon area
      const area = calculatePolygonArea(points) / (factor * factor);
      result.area = area;
      result.distance2D = Math.sqrt(area); // Representative dimension
      
      // Calculate perimeter
      let perimeter = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const dist = Math.sqrt(
          Math.pow(points[j].x - points[i].x, 2) + Math.pow(points[j].y - points[i].y, 2)
        );
        perimeter += dist / factor;
      }
      result.additionalData!.perimeter = perimeter;
      
    } else {
      // Calculate distance between points
      const point1 = points[0];
      const point2 = points[1];
      
      const pixelDistance = Math.sqrt(
        Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
      );
      
      result.distance2D = pixelDistance / factor;
      
      if (measurementMode === '3d' && points.length >= 3) {
        // Estimate 3D distance using third point as depth reference
        const point3 = points[2];
        const depthPixels = Math.abs(point3.y - point1.y); // Simple depth estimation
        const depth = depthPixels / factor;
        result.distance3D = Math.sqrt(result.distance2D * result.distance2D + depth * depth);
        result.additionalData!.estimatedDepth = depth;
      }
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
    const newPoint: MeasurementPoint = { x, y };
    setMeasurementPoints(prev => [...prev, newPoint]);
  };

  const clearMeasurementPoints = () => {
    setMeasurementPoints([]);
  };

  const getInstructions = () => {
    switch (measurementMode) {
      case '2d':
        return 'Haz clic en dos puntos para medir distancia lineal';
      case '3d':
        return 'Haz clic en 2-3 puntos para medición espacial';
      case 'area':
        return 'Haz clic en múltiples puntos para formar un polígono';
      case 'volume':
        return 'Haz clic en puntos para estimar volumen';
      case 'depth':
        return 'Haz clic en puntos para análisis de profundidad';
      default:
        return 'Haz clic para agregar puntos de medición';
    }
  };

  return (
    <div className="relative">
      <div className="mb-2 text-sm text-muted-foreground text-center">
        {getInstructions()}
      </div>
      
      <canvas
        ref={canvasRef}
        className="w-full h-auto border border-border rounded-lg cursor-crosshair"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const scaleX = canvasRef.current!.width / rect.width;
          const scaleY = canvasRef.current!.height / rect.height;
          const x = (e.clientX - rect.left) * scaleX;
          const y = (e.clientY - rect.top) * scaleY;
          addMeasurementPoint(x, y);
        }}
      />
      
      {measurementPoints.length > 0 && (
        <div className="absolute top-2 right-2 space-x-2">
          <span className="text-xs bg-black/70 text-white px-2 py-1 rounded">
            {measurementPoints.length} punto{measurementPoints.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={clearMeasurementPoints}
            className="px-3 py-1 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
};