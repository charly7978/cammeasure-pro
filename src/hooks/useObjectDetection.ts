import { useCallback, useMemo, useRef } from 'react';
import { DetectedObject } from '@/lib/types';

interface DetectionResult {
  objects: DetectedObject[];
  processingTime: number;
}

export const useObjectDetection = () => {
  // Cache para resultados de detección
  const detectionCache = useRef<Map<string, DetectionResult>>(new Map());
  const lastFrameData = useRef<string>('');

  // Memoizar función de detección de bordes con Sobel
  const detectEdgesWithSobel = useCallback((grayData: Uint8Array, width: number, height: number): Uint8Array => {
    try {
      const edges = new Uint8Array(width * height);
      
      // Kernels Sobel optimizados
      const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
      const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
      
      // Aplicar convolución 2D optimizada
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0, gy = 0;
          
          // Convolución optimizada
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = grayData[(y + ky) * width + (x + kx)];
              gx += pixel * sobelX[ky + 1][kx + 1];
              gy += pixel * sobelY[ky + 1][kx + 1];
            }
          }
          
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          const normalizedMagnitude = Math.min(255, Math.round(magnitude * 0.5));
          const threshold = 30 + (normalizedMagnitude * 0.3);
          edges[y * width + x] = normalizedMagnitude > threshold ? normalizedMagnitude : 0;
        }
      }
      
      return edges;
    } catch (error) {
      console.error('❌ Error en operador Sobel:', error);
      return new Uint8Array(width * height);
    }
  }, []);

  // Funciones auxiliares memoizadas
  const calculateContourCurvature = useCallback((points: { x: number; y: number }[]): number => {
    try {
      if (points.length < 3) return 0;
      
      let totalCurvature = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        
        const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
        let angleDiff = angle2 - angle1;
        
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        totalCurvature += Math.abs(angleDiff);
      }
      
      return totalCurvature / (points.length - 2);
    } catch (error) {
      console.error('❌ Error calculando curvatura:', error);
      return 0;
    }
  }, []);

  const calculateContourSmoothness = useCallback((points: { x: number; y: number }[]): number => {
    try {
      if (points.length < 2) return 0;
      
      let totalVariation = 0;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        const distance = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        totalVariation += distance;
      }
      
      const averageVariation = totalVariation / (points.length - 1);
      const smoothness = Math.max(0, 1 - (averageVariation / 10));
      
      return Math.min(1.0, smoothness);
    } catch (error) {
      console.error('❌ Error calculando suavidad:', error);
      return 0;
    }
  }, []);

  const calculateMathematicalConfidence = useCallback((area: number, perimeter: number, intensity: number, curvature: number, smoothness: number, width: number, height: number): number => {
    try {
      const areaFactor = Math.min(1.0, area / (width * height * 0.1));
      const perimeterFactor = Math.min(1.0, perimeter / 100);
      const intensityFactor = Math.min(1.0, intensity / 255);
      const curvatureFactor = Math.min(1.0, curvature / 1.0);
      const smoothnessFactor = smoothness;
      
      const confidence = (
        areaFactor * 0.25 +
        perimeterFactor * 0.20 +
        intensityFactor * 0.25 +
        curvatureFactor * 0.15 +
        smoothnessFactor * 0.15
      );
      
      return Math.min(1.0, Math.max(0.0, confidence));
    } catch (error) {
      console.error('❌ Error calculando confianza:', error);
      return 0.5;
    }
  }, []);

  const isValidContourMathematically = useCallback((contour: any, width: number, height: number): boolean => {
    try {
      const { area, perimeter, curvature, smoothness, confidence } = contour;
      
      const minArea = Math.max(1000, (width * height) * 0.01);
      const maxArea = (width * height) * 0.7;
      
      if (area < minArea || area > maxArea) return false;
      
      const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
      if (compactness < 0.1 || compactness > 1.0) return false;
      
      if (curvature < 0.1 || curvature > 2.0) return false;
      if (smoothness < 0.3) return false;
      if (confidence < 0.4) return false;
      
      return true;
    } catch (error) {
      console.error('❌ Error en validación matemática:', error);
      return false;
    }
  }, []);

  // Función de análisis de contorno optimizada
  const analyzeContourMathematically = useCallback((edges: Uint8Array, width: number, height: number, startX: number, startY: number, visited: Set<number>, threshold: number): any => {
    try {
      const points: { x: number; y: number }[] = [];
      const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
      
      let minX = startX, maxX = startX;
      let minY = startY, maxY = startY;
      let totalIntensity = 0;
      
      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        const index = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height || 
            edges[index] <= threshold || visited.has(index)) {
          continue;
        }
        
        visited.add(index);
        points.push({ x, y });
        totalIntensity += edges[index];
        
        // Actualizar bounding box
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        
        // Vecinos optimizados
        const neighbors = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
          { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
        ];
        
        for (const neighbor of neighbors) {
          const nx = x + neighbor.dx;
          const ny = y + neighbor.dy;
          const nIndex = ny * width + nx;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
              edges[nIndex] > threshold && !visited.has(nIndex)) {
            stack.push({ x: nx, y: ny });
          }
        }
      }
      
      const boundingBox = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      const area = boundingBox.width * boundingBox.height;
      const perimeter = points.length;
      const averageIntensity = totalIntensity / points.length;
      
      const curvature = calculateContourCurvature(points);
      const smoothness = calculateContourSmoothness(points);
      const confidence = calculateMathematicalConfidence(area, perimeter, averageIntensity, curvature, smoothness, width, height);
      
      return {
        points, boundingBox, area, perimeter, averageIntensity, curvature, smoothness, confidence
      };
    } catch (error) {
      console.error('❌ Error en análisis de contorno:', error);
      return { points: [], boundingBox: { x: 0, y: 0, width: 0, height: 0 }, area: 0, confidence: 0 };
    }
  }, [calculateContourCurvature, calculateContourSmoothness, calculateMathematicalConfidence]);

  // Memoizar función de detección de contornos
  const findContoursFromEdges = useCallback((edges: Uint8Array, width: number, height: number): any[] => {
    try {
      const visited = new Set<number>();
      const contours: any[] = [];
      
      // Umbral adaptativo optimizado
      const edgeValues = Array.from(edges).filter(v => v > 0);
      if (edgeValues.length === 0) return [];
      
      const meanEdge = edgeValues.reduce((sum, val) => sum + val, 0) / edgeValues.length;
      const stdEdge = Math.sqrt(edgeValues.reduce((sum, val) => sum + Math.pow(val - meanEdge, 2), 0) / edgeValues.length);
      const adaptiveThreshold = Math.max(40, meanEdge - 0.5 * stdEdge);
      
      // Algoritmo de detección optimizado
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          
          if (edges[index] > adaptiveThreshold && !visited.has(index)) {
            const contour = analyzeContourMathematically(edges, width, height, x, y, visited, adaptiveThreshold);
            if (isValidContourMathematically(contour, width, height)) {
              contours.push(contour);
            }
          }
        }
      }
      
      return contours;
    } catch (error) {
      console.error('❌ Error en detección de contornos:', error);
      return [];
    }
  }, [analyzeContourMathematically, isValidContourMathematically]);

  // Funciones auxiliares para filtrado
  const calculateContourQualityScore = useCallback((contour: any, width: number, height: number): number => {
    try {
      const { area, perimeter, curvature, smoothness, confidence, averageIntensity } = contour;
      
      const areaScore = Math.min(1.0, area / (width * height * 0.1));
      const perimeterScore = Math.min(1.0, perimeter / 200);
      const curvatureScore = Math.min(1.0, curvature / 1.0);
      const smoothnessScore = smoothness;
      const confidenceScore = confidence;
      const intensityScore = Math.min(1.0, averageIntensity / 255);
      
      const qualityScore = (
        areaScore * 0.20 +
        perimeterScore * 0.15 +
        curvatureScore * 0.15 +
        smoothnessScore * 0.20 +
        confidenceScore * 0.20 +
        intensityScore * 0.10
      );
      
      return Math.min(1.0, Math.max(0.0, qualityScore));
    } catch (error) {
      console.error('❌ Error calculando puntuación:', error);
      return 0.5;
    }
  }, []);

  const calculateCompositeScore = useCallback((contour: any, normalizedDistance: number): number => {
    try {
      const { qualityScore, area, confidence } = contour;
      
      const qualityFactor = qualityScore;
      const sizeFactor = Math.min(1.0, area / 5000);
      const confidenceFactor = confidence;
      const centralityFactor = 1.0 - normalizedDistance;
      
      const compositeScore = (
        qualityFactor * 0.20 +
        sizeFactor * 0.40 +
        confidenceFactor * 0.25 +
        centralityFactor * 0.15
      );
      
      return Math.min(1.0, Math.max(0.0, compositeScore));
    } catch (error) {
      console.error('❌ Error calculando puntuación compuesta:', error);
      return 0.5;
    }
  }, []);

  // Función de filtrado optimizada
  const filterValidContours = useCallback((contours: any[], width: number, height: number): any[] => {
    try {
      if (contours.length === 0) return [];
      
      // Análisis de calidad optimizado
      const scoredContours = contours.map(contour => {
        const score = calculateContourQualityScore(contour, width, height);
        return { ...contour, qualityScore: score };
      });
      
      // Filtrado optimizado
      let validContours = scoredContours.filter(contour => {
        const { boundingBox, area, perimeter, curvature, smoothness, confidence, qualityScore } = contour;
        const { width: w, height: h } = boundingBox;
        
        const minArea = Math.max(5000, (width * height) * 0.05);
        const maxArea = (width * height) * 0.8;
        if (area < minArea || area > maxArea) return false;
        
        const aspectRatio = w / h;
        const idealAspectRatio = 1.0;
        const aspectRatioDeviation = Math.abs(aspectRatio - idealAspectRatio) / idealAspectRatio;
        if (aspectRatioDeviation > 5.0) return false;
        
        const theoreticalPerimeter = 2 * (w + h);
        const perimeterEfficiency = perimeter / theoreticalPerimeter;
        if (perimeterEfficiency < 0.3 || perimeterEfficiency > 3.0) return false;
        
        if (curvature < 0.02 || curvature > 3.0) return false;
        if (smoothness < 0.15) return false;
        if (confidence < 0.25) return false;
        if (qualityScore < 0.3) return false;
        
        return true;
      });
      
      // Priorización optimizada
      if (validContours.length > 0) {
        validContours.sort((a, b) => {
          const centerX = width / 2;
          const centerY = height / 2;
          
          const aCenterX = a.boundingBox.x + a.boundingBox.width / 2;
          const aCenterY = a.boundingBox.y + a.boundingBox.height / 2;
          const bCenterX = b.boundingBox.x + b.boundingBox.width / 2;
          const bCenterY = b.boundingBox.y + b.boundingBox.height / 2;
          
          const aDistanceToCenter = Math.sqrt((aCenterX - centerX) ** 2 + (aCenterY - centerY) ** 2);
          const bDistanceToCenter = Math.sqrt((bCenterX - centerX) ** 2 + (bCenterY - centerY) ** 2);
          
          const maxDistance = Math.sqrt(width ** 2 + height ** 2) / 2;
          const aNormalizedDistance = aDistanceToCenter / maxDistance;
          const bNormalizedDistance = bDistanceToCenter / maxDistance;
          
          const aScore = calculateCompositeScore(a, aNormalizedDistance);
          const bScore = calculateCompositeScore(b, bNormalizedDistance);
          
          return bScore - aScore;
        });
      }
      
      return validContours.slice(0, 3);
    } catch (error) {
      console.error('❌ Error en filtrado:', error);
      return [];
    }
  }, [calculateContourQualityScore, calculateCompositeScore]);

  // Función principal de detección optimizada
  const detectBasicObjects = useCallback(async (imageData: ImageData, width: number, height: number): Promise<DetectedObject[]> => {
    try {
      // Verificar cache
      const frameHash = `${width}x${height}_${imageData.data.length}`;
      if (detectionCache.current.has(frameHash) && frameHash === lastFrameData.current) {
        const cached = detectionCache.current.get(frameHash);
        if (cached) return cached.objects;
      }
      
      if (!imageData || !imageData.data || width <= 0 || height <= 0) {
        console.warn('⚠️ Datos de imagen inválidos');
        return [];
      }

      // Conversión a escala de grises optimizada
      const grayData = new Uint8Array(width * height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        grayData[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      // Detección optimizada
      const edges = detectEdgesWithSobel(grayData, width, height);
      const contours = findContoursFromEdges(edges, width, height);
      const validContours = filterValidContours(contours, width, height);

      // Convertir a formato de objetos
      const detectedObjects = validContours.map((contour, index) => ({
        id: `obj_${index}`,
        type: 'detected',
        x: contour.boundingBox.x,
        y: contour.boundingBox.y,
        width: contour.boundingBox.width,
        height: contour.boundingBox.height,
        area: contour.area,
        confidence: contour.confidence || 0.8,
        points: contour.points ? true : false,
        boundingBox: contour.boundingBox,
        dimensions: {
          width: contour.boundingBox.width,
          height: contour.boundingBox.height,
          area: contour.area,
          unit: 'px'
        }
      }));

      // Actualizar cache
      const result = { objects: detectedObjects, processingTime: performance.now() };
      detectionCache.current.set(frameHash, result);
      lastFrameData.current = frameHash;
      
      // Limpiar cache antiguo
      if (detectionCache.current.size > 10) {
        const firstKey = detectionCache.current.keys().next().value;
        detectionCache.current.delete(firstKey);
      }

      return detectedObjects;
    } catch (error) {
      console.error('❌ Error en detección:', error);
      return [];
    }
  }, [detectEdgesWithSobel, findContoursFromEdges, filterValidContours]);

  return {
    detectBasicObjects,
    detectEdgesWithSobel,
    findContoursFromEdges,
    filterValidContours
  };
};
