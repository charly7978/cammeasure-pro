import { useEffect, useRef, useState } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';

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
  calibrationData: {
    focalLength: number;
    sensorSize: number;
    pixelsPerMm: number;
  } | null;
  onMeasurementResult: (result: MeasurementResult) => void;
  onDetectedEdges: (edges: MeasurementPoint[]) => void;
}

export const MeasurementEngine: React.FC<MeasurementEngineProps> = ({
  imageData,
  calibrationData,
  onMeasurementResult,
  onDetectedEdges
}) => {
  const { isLoaded, cv } = useOpenCV();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);

  useEffect(() => {
    if (!isLoaded || !cv || !imageData || !canvasRef.current) return;

    processImage();
  }, [isLoaded, cv, imageData]);

  const processImage = () => {
    if (!cv || !imageData || !canvasRef.current) return;

    try {
      // Convert ImageData to OpenCV Mat
      const src = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply Gaussian blur to reduce noise
      cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

      // Canny edge detection
      cv.Canny(gray, edges, 50, 150, 3, false);

      // Find contours
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // Process contours and extract measurement points
      const detectedPoints: MeasurementPoint[] = [];
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        // Filter contours by area (avoid noise)
        if (area > 100) {
          // Get bounding rectangle
          const rect = cv.boundingRect(contour);
          
          // Calculate center point
          const centerX = rect.x + rect.width / 2;
          const centerY = rect.y + rect.height / 2;
          
          detectedPoints.push({
            x: centerX,
            y: centerY,
            realX: calibrationData ? centerX / calibrationData.pixelsPerMm : undefined,
            realY: calibrationData ? centerY / calibrationData.pixelsPerMm : undefined
          });
        }
        contour.delete();
      }

      onDetectedEdges(detectedPoints);

      // Calculate measurements if we have calibration data
      if (calibrationData && detectedPoints.length >= 2) {
        calculateMeasurements(detectedPoints);
      }

      // Draw results on canvas
      drawResults(edges);

      // Cleanup
      src.delete();
      gray.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();

    } catch (error) {
      console.error('Error processing image:', error);
    }
  };

  const calculateMeasurements = (points: MeasurementPoint[]) => {
    if (!calibrationData || points.length < 2) return;

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

  const drawResults = (processedMat: any) => {
    if (!canvasRef.current || !cv) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Convert OpenCV Mat to ImageData and draw on canvas
    cv.imshow(canvas, processedMat);

    // Draw measurement points
    measurementPoints.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = index === 0 ? '#84cc16' : '#06b6d4';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const addMeasurementPoint = (x: number, y: number) => {
    const newPoint: MeasurementPoint = {
      x,
      y,
      realX: calibrationData ? x / calibrationData.pixelsPerMm : undefined,
      realY: calibrationData ? y / calibrationData.pixelsPerMm : undefined
    };

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