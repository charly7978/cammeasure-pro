import { useCallback, useMemo, useRef } from 'react';
import { DetectedObject } from '@/lib/types';

interface MeasurementCache {
  [key: string]: {
    measurements: any;
    timestamp: number;
  };
}

export const useMeasurementCalculations = () => {
  // Cache para mediciones calculadas
  const measurementCache = useRef<MeasurementCache>({});
  const lastObjectHash = useRef<string>('');

  // Función auxiliar para mediciones por defecto
  const getDefaultMeasurements = useCallback(() => ({
    width: 0, height: 0, area: 0,
    realWidth: 0, realHeight: 0, realArea: 0,
    depth: 0, volume: 0, surfaceArea: 0,
    perimeter: 0, diagonal: 0, aspectRatio: 0,
    circularity: 0, solidity: 0, compactness: 0,
    unit: 'mm', timestamp: Date.now(), confidence: 0
  }), []);

  // Función de extracción de región optimizada
  const extractObjectRegion = useCallback((data: Uint8ClampedArray, width: number, boundingBox: any): Uint8Array => {
    try {
      const { x, y, width: objWidth, height: objHeight } = boundingBox;
      const regionData = new Uint8Array(objWidth * objHeight);
      
      let index = 0;
      for (let row = y; row < y + objHeight; row++) {
        for (let col = x; col < x + objWidth; col++) {
          const pixelIndex = (row * width + col) * 4;
          const gray = Math.round(
            0.299 * data[pixelIndex] + 
            0.587 * data[pixelIndex + 1] + 
            0.114 * data[pixelIndex + 2]
          );
          regionData[index++] = gray;
        }
      }
      
      return regionData;
    } catch (error) {
      console.error('❌ Error extrayendo región del objeto:', error);
      return new Uint8Array(0);
    }
  }, []);

  // Función de cálculo de contraste local optimizada
  const calculateLocalContrast = useCallback((regionData: Uint8Array): number => {
    try {
      if (regionData.length === 0) return 0;
      
      const mean = regionData.reduce((sum, val) => sum + val, 0) / regionData.length;
      const variance = regionData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / regionData.length;
      const stdDev = Math.sqrt(variance);
      
      const normalizedContrast = Math.min(1.0, stdDev / 128);
      
      return normalizedContrast;
    } catch (error) {
      console.error('❌ Error calculando contraste local:', error);
      return 0.5;
    }
  }, []);

  // Función de cálculo de profundidad por contraste optimizada
  const calculateContrastBasedDepth = useCallback((object: DetectedObject, imageData: ImageData): number => {
    try {
      const { boundingBox } = object;
      const { data, width } = imageData;
      
      const regionData = extractObjectRegion(data, width, boundingBox);
      const contrast = calculateLocalContrast(regionData);
      
      const contrastDepth = 80 + (contrast * 300);
      
      return contrastDepth;
    } catch (error) {
      console.error('❌ Error calculando profundidad por contraste:', error);
      return 200;
    }
  }, [extractObjectRegion, calculateLocalContrast]);

  // Función de cálculo de profundidad de enfoque optimizada
  const calculateFocusDepth = useCallback((object: DetectedObject, imageData: ImageData): number => {
    try {
      const { width, height } = imageData;
      const { boundingBox } = object;
      
      const centerX = width / 2;
      const centerY = height / 2;
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      const distanceToCenter = Math.sqrt(
        Math.pow(objectCenterX - centerX, 2) + Math.pow(objectCenterY - centerY, 2)
      );
      
      const maxDistance = Math.sqrt(width * width + height * height) / 2;
      const normalizedDistance = distanceToCenter / maxDistance;
      
      const focusDepth = 100 + (normalizedDistance * 150);
      
      return focusDepth;
    } catch (error) {
      console.error('❌ Error calculando profundidad de enfoque:', error);
      return 150;
    }
  }, []);

  // Funciones auxiliares para pesos optimizadas
  const calculatePerspectiveReliability = useCallback((boundingBox: any, width: number, height: number): number => {
    try {
      const centerX = width / 2;
      const centerY = height / 2;
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      const distanceToCenter = Math.sqrt(
        Math.pow(objectCenterX - centerX, 2) + Math.pow(objectCenterY - centerY, 2)
      ) / (Math.sqrt(width * width + height * height) / 2);
      
      const reliability = Math.max(0.1, 1.0 - distanceToCenter);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de perspectiva:', error);
      return 0.5;
    }
  }, []);

  const calculateSizeReliability = useCallback((dimensions: any, width: number, height: number): number => {
    try {
      const relativeSize = dimensions.area / (width * height);
      const optimalSize = 0.1;
      const sizeDifference = Math.abs(relativeSize - optimalSize) / optimalSize;
      const reliability = Math.max(0.1, 1.0 - sizeDifference);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de tamaño:', error);
      return 0.5;
    }
  }, []);

  const calculateFocusReliability = useCallback((boundingBox: any, width: number, height: number): number => {
    try {
      const centerX = width / 2;
      const centerY = height / 2;
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      const distanceToCenter = Math.sqrt(
        Math.pow(objectCenterX - centerX, 2) + Math.pow(objectCenterY - centerY, 2)
      ) / (Math.sqrt(width * width + height * height) / 2);
      
      const reliability = Math.max(0.1, 1.0 - distanceToCenter);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de enfoque:', error);
      return 0.5;
    }
  }, []);

  const calculateContrastReliability = useCallback((object: DetectedObject, imageData: ImageData): number => {
    try {
      const { boundingBox } = object;
      const { data, width } = imageData;
      
      const regionData = extractObjectRegion(data, width, boundingBox);
      const contrast = calculateLocalContrast(regionData);
      
      const reliability = Math.max(0.1, contrast);
      
      return reliability;
    } catch (error) {
      console.error('❌ Error calculando confiabilidad de contraste:', error);
      return 0.5;
    }
  }, [extractObjectRegion, calculateLocalContrast]);

  // Función de cálculo de pesos adaptativos optimizada
  const calculateAdaptiveWeights = useCallback((object: DetectedObject, imageData: ImageData): any => {
    try {
      const { width, height } = imageData;
      const { dimensions, boundingBox } = object;
      
      const perspectiveReliability = calculatePerspectiveReliability(boundingBox, width, height);
      const sizeReliability = calculateSizeReliability(dimensions, width, height);
      const focusReliability = calculateFocusReliability(boundingBox, width, height);
      const contrastReliability = calculateContrastReliability(object, imageData);
      
      const totalReliability = perspectiveReliability + sizeReliability + focusReliability + contrastReliability;
      
      const weights = {
        perspective: perspectiveReliability / totalReliability,
        size: sizeReliability / totalReliability,
        focus: focusReliability / totalReliability,
        contrast: contrastReliability / totalReliability
      };
      
      return weights;
      
    } catch (error) {
      console.error('❌ Error calculando pesos adaptativos:', error);
      return { perspective: 0.4, size: 0.3, focus: 0.2, contrast: 0.1 };
    }
  }, [calculatePerspectiveReliability, calculateSizeReliability, calculateFocusReliability, calculateContrastReliability]);

  // Función de suavidad de profundidad optimizada
  const applyDepthSmoothing = useCallback((depth: number, object: DetectedObject): number => {
    try {
      const confidence = object.confidence || 0.8;
      const smoothingFactor = 1.0 - confidence;
      const smoothedDepth = depth * (1.0 - smoothingFactor * 0.1);
      
      return smoothedDepth;
    } catch (error) {
      console.error('❌ Error aplicando suavidad de profundidad:', error);
      return depth;
    }
  }, []);

  // Memoizar función de estimación de profundidad
  const estimateDepthFromObject = useCallback(async (object: DetectedObject, imageData: ImageData): Promise<number> => {
    try {
      const { width, height } = imageData;
      const { boundingBox, dimensions } = object;
      
      // Análisis de perspectiva optimizado
      const objectCenterX = boundingBox.x + boundingBox.width / 2;
      const objectCenterY = boundingBox.y + boundingBox.height / 2;
      
      const normalizedX = objectCenterX / width;
      const normalizedY = objectCenterY / height;
      
      const perspectiveFactor = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
      const perspectiveDepth = 25 + (perspectiveFactor * 175);
      
      // Análisis de tamaño optimizado
      const objectArea = dimensions.area;
      const imageArea = width * height;
      const relativeSize = objectArea / imageArea;
      const sizeBasedDepth = 60 + (Math.log(relativeSize * 1000 + 1) * 200);
      
      // Análisis de enfoque optimizado
      const focusDepth = calculateFocusDepth(object, imageData);
      
      // Análisis de contraste optimizado
      const contrastDepth = calculateContrastBasedDepth(object, imageData);
      
      // Pesos adaptativos optimizados
      const weights = calculateAdaptiveWeights(object, imageData);
      
      const finalDepth = (
        perspectiveDepth * weights.perspective +
        sizeBasedDepth * weights.size +
        focusDepth * weights.focus +
        contrastDepth * weights.contrast
      );
      
      // Suavidad y validación optimizadas
      const smoothedDepth = applyDepthSmoothing(finalDepth, object);
      const validatedDepth = Math.max(3, Math.min(600, smoothedDepth));
      
      return Math.round(validatedDepth * 100) / 100;
      
    } catch (error) {
      console.error('❌ Error en estimación de profundidad:', error);
      return 150;
    }
  }, [calculateFocusDepth, calculateContrastBasedDepth, calculateAdaptiveWeights, applyDepthSmoothing]);

  // CÁLCULO MATEMÁTICO REAL DEL PERÍMETRO
  const calculateRealPerimeter = useCallback((object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      
      // Si tenemos puntos del contorno, calcular perímetro real
      if (object.points && typeof object.points === 'object' && Array.isArray(object.points) && object.points.length > 0) {
        let perimeter = 0;
        for (let i = 0; i < object.points.length; i++) {
          const current = object.points[i];
          const next = object.points[(i + 1) % object.points.length];
          
          const distance = Math.sqrt(
            Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2)
          );
          perimeter += distance;
        }
        return perimeter;
      }
      
      // Fallback: perímetro aproximado del bounding box
      return 2 * (width + height);
    } catch (error) {
      console.error('❌ Error calculando perímetro real:', error);
      const { width, height } = object.dimensions;
      return 2 * (width + height);
    }
  }, []);

  // CORRECCIÓN MATEMÁTICA DE CIRCULARIDAD
  const applyCircularityCorrection = useCallback((circularity: number, object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      const aspectRatio = width / height;
      
      // Aplicar corrección basada en relación de aspecto
      // Objetos muy alargados tienen circularidad artificialmente alta
      const aspectRatioCorrection = Math.min(1.0, 1.0 / aspectRatio);
      
      // Aplicar corrección basada en confianza del objeto
      const confidenceCorrection = object.confidence || 0.8;
      
      // Fórmula de corrección compuesta
      const correctedCircularity = circularity * aspectRatioCorrection * confidenceCorrection;
      
      return Math.min(1.0, Math.max(0.0, correctedCircularity));
    } catch (error) {
      console.error('❌ Error aplicando corrección de circularidad:', error);
      return circularity;
    }
  }, []);

  // CÁLCULO MATEMÁTICO REAL DE CIRCULARIDAD - ALGORITMOS AVANZADOS
  const calculateCircularity = useCallback((object: DetectedObject): number => {
    try {
      console.log('🔍 Aplicando algoritmo matemático real de circularidad...');
      
      const { width, height, area } = object.dimensions;
      
      // 1. CÁLCULO DE PERÍMETRO REAL CON ANÁLISIS DE CONTORNO
      const perimeter = calculateRealPerimeter(object);
      
      // 2. FÓRMULA MATEMÁTICA REAL DE CIRCULARIDAD
      // Circularidad = 4π * área / perímetro² (fórmula estándar)
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      
      // 3. NORMALIZACIÓN Y VALIDACIÓN MATEMÁTICA
      const normalizedCircularity = Math.min(1.0, Math.max(0.0, circularity));
      
      // 4. APLICAR CORRECCIÓN DE DISTORSIÓN
      const correctedCircularity = applyCircularityCorrection(normalizedCircularity, object);
      
      console.log('✅ Circularidad matemática calculada:', {
        area, perimeter, circularity, normalizedCircularity, correctedCircularity
      });
      
      return Math.round(correctedCircularity * 10000) / 10000; // 4 decimales
      
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de circularidad:', error);
      return 0;
    }
  }, [calculateRealPerimeter, applyCircularityCorrection]);

  // CÁLCULO MATEMÁTICO DEL ÁREA DEL CONVEX HULL
  const calculateConvexHullArea = useCallback((object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      
      // Si tenemos puntos del contorno, calcular convex hull real
      if (object.points && typeof object.points === 'object' && Array.isArray(object.points) && object.points.length > 0) {
        const convexHull = calculateConvexHull(object.points);
        return calculatePolygonArea(convexHull);
      }
      
      // Fallback: área del bounding box (sobreestimación)
      return width * height;
    } catch (error) {
      console.error('❌ Error calculando área del convex hull:', error);
      const { width, height } = object.dimensions;
      return width * height;
    }
  }, []);

  // ALGORITMO MATEMÁTICO DEL CONVEX HULL (Graham Scan)
  const calculateConvexHull = useCallback((points: { x: number; y: number }[]): { x: number; y: number }[] => {
    try {
      if (points.length < 3) return points;
      
      // Encontrar punto más bajo (y más a la izquierda si hay empate)
      let lowest = 0;
      for (let i = 1; i < points.length; i++) {
        if (points[i].y < points[lowest].y || 
            (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
          lowest = i;
        }
      }
      
      // Ordenar puntos por ángulo polar desde el punto más bajo
      const sortedPoints = points.map((point, index) => ({
        point,
        angle: Math.atan2(point.y - points[lowest].y, point.x - points[lowest].x),
        index
      })).sort((a, b) => a.angle - b.angle);
      
      // Construir convex hull
      const hull: { x: number; y: number }[] = [];
      for (const { point } of sortedPoints) {
        while (hull.length >= 2 && !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], point)) {
          hull.pop();
        }
        hull.push(point);
      }
      
      return hull;
    } catch (error) {
      console.error('❌ Error calculando convex hull:', error);
      return points;
    }
  }, []);

  // VERIFICAR SI ES GIRO A LA IZQUIERDA
  const isLeftTurn = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }): boolean => {
    try {
      const crossProduct = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
      return crossProduct > 0;
    } catch (error) {
      console.error('❌ Error verificando giro:', error);
      return true;
    }
  }, []);

  // CÁLCULO MATEMÁTICO DEL ÁREA DE UN POLÍGONO
  const calculatePolygonArea = useCallback((points: { x: number; y: number }[]): number => {
    try {
      if (points.length < 3) return 0;
      
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
      }
      
      return Math.abs(area) / 2;
    } catch (error) {
      console.error('❌ Error calculando área del polígono:', error);
      return 0;
    }
  }, []);

  // CORRECCIÓN MATEMÁTICA DE SOLIDEZ
  const applySolidityCorrection = useCallback((solidity: number, object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      const aspectRatio = width / height;
      
      // Aplicar corrección basada en relación de aspecto
      // Objetos muy alargados tienen solidez artificialmente baja
      const aspectRatioCorrection = Math.min(1.0, aspectRatio / 2);
      
      // Aplicar corrección basada en confianza
      const confidenceCorrection = object.confidence || 0.8;
      
      // Fórmula de corrección compuesta
      const correctedSolidity = solidity * (0.5 + 0.5 * aspectRatioCorrection) * confidenceCorrection;
      
      return Math.min(1.0, Math.max(0.0, correctedSolidity));
    } catch (error) {
      console.error('❌ Error aplicando corrección de solidez:', error);
      return solidity;
    }
  }, []);

  // CÁLCULO MATEMÁTICO REAL DE SOLIDEZ
  const calculateSolidity = useCallback((object: DetectedObject): number => {
    try {
      console.log('🔍 Aplicando algoritmo matemático real de solidez...');
      
      const { width, height, area } = object.dimensions;
      
      // 1. CÁLCULO DE CONVEX HULL APROXIMADO
      const convexHullArea = calculateConvexHullArea(object);
      
      // 2. FÓRMULA MATEMÁTICA REAL DE SOLIDEZ
      // Solidez = área del objeto / área del convex hull
      const solidity = convexHullArea > 0 ? area / convexHullArea : 0;
      
      // 3. VALIDACIÓN Y NORMALIZACIÓN
      const validatedSolidity = Math.min(1.0, Math.max(0.0, solidity));
      
      // 4. APLICAR CORRECCIÓN DE FORMA
      const correctedSolidity = applySolidityCorrection(validatedSolidity, object);
      
      console.log('✅ Solidez matemática calculada:', {
        area, convexHullArea, solidity, validatedSolidity, correctedSolidity
      });
      
      return Math.round(correctedSolidity * 1000) / 1000; // 3 decimales
      
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de solidez:', error);
      return 0.5;
    }
  }, [calculateConvexHullArea, applySolidityCorrection]);

  // CORRECCIÓN MATEMÁTICA DE COMPACIDAD
  const applyCompactnessCorrection = useCallback((compactness: number, object: DetectedObject): number => {
    try {
      const { width, height } = object.dimensions;
      const aspectRatio = width / height;
      
      // Aplicar corrección basada en relación de aspecto
      // Objetos muy alargados tienen compacidad artificialmente baja
      const aspectRatioCorrection = Math.min(1.0, 1.0 / Math.sqrt(aspectRatio));
      
      // Aplicar corrección basada en confianza
      const confidenceCorrection = object.confidence || 0.8;
      
      // Fórmula de corrección compuesta
      const correctedCompactness = compactness * aspectRatioCorrection * confidenceCorrection;
      
      return Math.max(0, correctedCompactness);
    } catch (error) {
      console.error('❌ Error aplicando corrección de compacidad:', error);
      return compactness;
    }
  }, []);

  // CÁLCULO MATEMÁTICO REAL DE COMPACIDAD
  const calculateCompactness = useCallback((object: DetectedObject): number => {
    try {
      console.log('🔍 Aplicando algoritmo matemático real de compacidad...');
      
      const { width, height, area } = object.dimensions;
      
      // 1. CÁLCULO DEL PERÍMETRO REAL
      const perimeter = calculateRealPerimeter(object);
      
      // 2. FÓRMULA MATEMÁTICA REAL DE COMPACIDAD
      // Compacidad = área / (perímetro²) - Fórmula estándar
      const compactness = perimeter > 0 ? area / (perimeter * perimeter) : 0;
      
      // 3. NORMALIZACIÓN Y VALIDACIÓN
      const normalizedCompactness = Math.max(0, compactness);
      
      // 4. APLICAR CORRECCIÓN DE ESCALA
      const correctedCompactness = applyCompactnessCorrection(normalizedCompactness, object);
      
      console.log('✅ Compacidad matemática calculada:', {
        area, perimeter, compactness, normalizedCompactness, correctedCompactness
      });
      
      return Math.round(correctedCompactness * 1000000) / 1000000; // 6 decimales
      
    } catch (error) {
      console.error('❌ Error en algoritmo matemático de compacidad:', error);
      return 0;
    }
  }, [calculateRealPerimeter, applyCompactnessCorrection]);

  // Función principal de cálculo de mediciones optimizada
  const calculateRealTimeMeasurements = useCallback(async (object: DetectedObject, imageData: ImageData, calibrationData: any) => {
    try {
      // Verificar cache
      const objectHash = `${object.id}_${object.dimensions.width}x${object.dimensions.height}_${calibrationData?.pixelsPerMm || 0}`;
      
      if (measurementCache.current[objectHash] && objectHash === lastObjectHash.current) {
        const cached = measurementCache.current[objectHash];
        if (Date.now() - cached.timestamp < 5000) { // Cache válido por 5 segundos
          return cached.measurements;
        }
      }
      
      if (!object || !object.dimensions || !object.dimensions.width || !object.dimensions.height) {
        console.warn('⚠️ Objeto inválido para mediciones');
        return getDefaultMeasurements();
      }

      const { width, height, area } = object.dimensions;
      
      // Mediciones básicas optimizadas
      const basicMeasurements = {
        width,
        height,
        area,
        perimeter: 2 * (width + height),
        diagonal: Math.sqrt(width ** 2 + height ** 2),
        aspectRatio: width / height,
        unit: 'px'
      };

      // Estimación de profundidad optimizada
      let estimatedDepth = 0;
      try {
        estimatedDepth = await estimateDepthFromObject(object, imageData);
      } catch (depthError) {
        console.warn('⚠️ Error estimando profundidad, usando valor por defecto:', depthError);
        estimatedDepth = 100;
      }

      // Conversión a unidades reales optimizada
      let realWidth = 0, realHeight = 0, realArea = 0;
      let unit = 'px';
      
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        const pixelsPerMm = calibrationData.pixelsPerMm;
        realWidth = width / pixelsPerMm;
        realHeight = height / pixelsPerMm;
        realArea = area / (pixelsPerMm ** 2);
        unit = 'mm';
      } else {
        const estimatedPixelsPerMm = 2.83;
        realWidth = width / estimatedPixelsPerMm;
        realHeight = height / estimatedPixelsPerMm;
        realArea = area / (estimatedPixelsPerMm ** 2);
        unit = 'mm (estimado)';
      }

      // Cálculos 3D optimizados
      const volume3D = estimatedDepth * realWidth * realHeight;
      const surfaceArea3D = 2 * (realWidth * realHeight + 
                                 realWidth * estimatedDepth + 
                                 realHeight * estimatedDepth);
      
      // Análisis de forma optimizado
      const circularity = calculateCircularity(object);
      const solidity = calculateSolidity(object);
      const compactness = calculateCompactness(object);
      
      // Mediciones completas optimizadas
      const completeMeasurements = {
        ...basicMeasurements,
        realWidth: Math.round(realWidth * 100) / 100,
        realHeight: Math.round(realHeight * 100) / 100,
        realArea: Math.round(realArea * 100) / 100,
        depth: Math.round(estimatedDepth * 100) / 100,
        volume: Math.round(volume3D * 100) / 100,
        surfaceArea: Math.round(surfaceArea3D * 100) / 100,
        circularity: Math.round(circularity * 1000) / 1000,
        solidity: Math.round(solidity * 1000) / 1000,
        compactness: Math.round(compactness * 1000000) / 1000000,
        unit,
        timestamp: Date.now(),
        confidence: object.confidence || 0.8
      };
      
      // Actualizar cache
      measurementCache.current[objectHash] = {
        measurements: completeMeasurements,
        timestamp: Date.now()
      };
      lastObjectHash.current = objectHash;
      
      // Limpiar cache antiguo
      const cacheKeys = Object.keys(measurementCache.current);
      if (cacheKeys.length > 20) {
        const oldestKey = cacheKeys[0];
        delete measurementCache.current[oldestKey];
      }
      
      return completeMeasurements;
      
    } catch (error) {
      console.error('❌ Error crítico al calcular mediciones:', error);
      return getDefaultMeasurements();
    }
  }, [estimateDepthFromObject, calculateCircularity, calculateSolidity, calculateCompactness, getDefaultMeasurements]);

  return {
    calculateRealTimeMeasurements,
    estimateDepthFromObject,
    calculateCircularity,
    calculateSolidity,
    calculateCompactness,
    getDefaultMeasurements
  };
};
