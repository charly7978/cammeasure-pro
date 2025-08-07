import { useEffect, useRef, useState, useCallback } from 'react';
import { useOpenCV } from '@/hooks/useOpenCV';

export interface DetectedObject {
  id: string;
  bounds: {
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
  confidence: number;
  center: {
    x: number;
    y: number;
  };
}

interface RealTimeMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  calibrationData: {
    pixelsPerMm: number;
    isCalibrated: boolean;
  } | null;
  onObjectsDetected: (objects: DetectedObject[]) => void;
  isActive: boolean;
}

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({
  videoRef,
  calibrationData,
  onObjectsDetected,
  isActive
}) => {
  const { isLoaded, cv } = useOpenCV();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [isProcessing, setIsProcessing] = useState(false);

  const processFrame = useCallback(() => {
    if (!isLoaded || !cv || !videoRef.current || !canvasRef.current || !isActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      setIsProcessing(true);
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data for OpenCV processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Process with OpenCV
      const detectedObjects = detectObjectsInFrame(imageData);
      
      // Notify parent component
      onObjectsDetected(detectedObjects);
      
    } catch (error) {
      console.error('Error processing frame:', error);
    } finally {
      setIsProcessing(false);
      // Continue processing next frame
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [isLoaded, cv, videoRef, isActive, onObjectsDetected]);

  const detectObjectsInFrame = (imageData: ImageData): DetectedObject[] => {
    if (!cv) return [];

    try {
      // Convert to OpenCV Mat
      const src = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Apply Gaussian blur
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      
      // Edge detection
      cv.Canny(blurred, edges, 50, 150);
      
      // Morphological operations to close gaps
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      
      // Find contours
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      const detectedObjects: DetectedObject[] = [];
      
      // Process each contour
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        // Filter by minimum area to avoid noise
        if (area > 500) {
          const rect = cv.boundingRect(contour);
          
          // Calculate real-world dimensions if calibrated
          let realWidth = rect.width;
          let realHeight = rect.height;
          let realArea = area;
          let unit = 'px';
          
          if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
            realWidth = rect.width / calibrationData.pixelsPerMm;
            realHeight = rect.height / calibrationData.pixelsPerMm;
            realArea = area / (calibrationData.pixelsPerMm * calibrationData.pixelsPerMm);
            unit = 'mm';
          }
          
          // Calculate confidence based on contour properties
          const perimeter = cv.arcLength(contour, true);
          const circularity = 4 * Math.PI * area / (perimeter * perimeter);
          const aspectRatio = rect.width / rect.height;
          
          // Simple confidence calculation
          let confidence = 0.5;
          if (circularity > 0.3) confidence += 0.2;
          if (aspectRatio > 0.3 && aspectRatio < 3) confidence += 0.2;
          if (area > 2000) confidence += 0.1;
          
          detectedObjects.push({
            id: `obj_${i}_${Date.now()}`,
            bounds: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            dimensions: {
              width: realWidth,
              height: realHeight,
              area: realArea,
              unit: unit
            },
            confidence: Math.min(confidence, 1.0),
            center: {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2
            }
          });
        }
        
        contour.delete();
      }
      
      // Cleanup
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      kernel.delete();
      
      return detectedObjects;
      
    } catch (error) {
      console.error('Error in object detection:', error);
      return [];
    }
  };

  useEffect(() => {
    if (isActive && isLoaded) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isLoaded, processFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="hidden" // Hidden canvas for processing
    />
  );
};