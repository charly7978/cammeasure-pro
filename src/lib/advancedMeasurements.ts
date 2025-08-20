// CALCULADORA AVANZADA DE MEDICIONES CON OPTIMIZACIÓN PARA OBJETOS GRANDES
// Previene congelamiento mediante procesamiento optimizado

import { DetectedObject } from './types';

interface AdvancedMeasurements {
  depth: number;
  volume: number;
  surfaceArea: number;  
  curvature: number;
  roughness: number;
  orientation?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
}

// CALCULADORA PRINCIPAL OPTIMIZADA
export const calculateAdvancedMeasurements = async (
  object: DetectedObject, 
  imageData: ImageData
): Promise<AdvancedMeasurements> => {
  
  // Prevenir congelamiento con timeout
  return new Promise((resolve) => {
    // Usar requestIdleCallback para no bloquear UI
    const processInChunks = () => {
      try {
        // 1. CÁLCULO DE PROFUNDIDAD OPTIMIZADO
        const depth = calculateOptimizedDepth(object, imageData);
        
        // 2. VOLUMEN BASADO EN ÁREA Y PROFUNDIDAD
        const volume = object.area * depth * 0.8; // Factor de corrección
        
        // 3. SUPERFICIE ESTIMADA
        const surfaceArea = object.area * 1.2; // Factor de superficie
        
        // 4. CURVATURA SIMPLIFICADA
        const curvature = calculateSimplifiedCurvature(object.contours || []);
        
        // 5. RUGOSIDAD BÁSICA
        const roughness = calculateBasicRoughness(object.contours || []);
        
        // 6. ORIENTACIÓN ESTIMADA
        const orientation = calculateBasicOrientation(object.boundingBox);
        
        resolve({
          depth,
          volume,
          surfaceArea,
          curvature,
          roughness,
          orientation
        });
        
      } catch (error) {
        console.warn('Error en cálculos avanzados, usando valores por defecto:', error);
        resolve({
          depth: 10,
          volume: object.area * 10,
          surfaceArea: object.area * 1.2,
          curvature: 0,
          roughness: 0.1,
          orientation: { pitch: 0, yaw: 0, roll: 0 }
        });
      }
    };
    
    // Procesar de forma no bloqueante
    if ('requestIdleCallback' in window) {
      requestIdleCallback(processInChunks);
    } else {
      setTimeout(processInChunks, 0);
    }
  });
};

// CÁLCULO DE PROFUNDIDAD OPTIMIZADO
const calculateOptimizedDepth = (object: DetectedObject, imageData: ImageData): number => {
  // Estimación rápida basada en área
  const areaRatio = object.area / (imageData.width * imageData.height);
  
  if (areaRatio > 0.5) return 5;  // Objeto muy grande, cerca
  if (areaRatio > 0.2) return 15; // Objeto mediano
  if (areaRatio > 0.05) return 30; // Objeto pequeño
  return 50; // Objeto muy pequeño, lejos
};

// PERÍMETRO OPTIMIZADO
export const calculatePerimeter = (contours: Array<{x: number, y: number}>): number => {
  if (contours.length < 2) return 0;
  
  let perimeter = 0;
  for (let i = 1; i < contours.length; i++) {
    const dx = contours[i].x - contours[i-1].x;
    const dy = contours[i].y - contours[i-1].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  
  // Cerrar el contorno
  const dx = contours[0].x - contours[contours.length-1].x;
  const dy = contours[0].y - contours[contours.length-1].y;
  perimeter += Math.sqrt(dx * dx + dy * dy);
  
  return perimeter;
};

// CIRCULARIDAD OPTIMIZADA
export const calculateCircularity = (area: number, contours: Array<{x: number, y: number}>): number => {
  const perimeter = calculatePerimeter(contours);
  if (perimeter === 0) return 0;
  
  return (4 * Math.PI * area) / (perimeter * perimeter);
};

// SOLIDEZ OPTIMIZADA  
export const calculateSolidity = (contours: Array<{x: number, y: number}>): number => {
  if (contours.length < 3) return 1;
  
  // Calcular área del contorno
  let area = 0;
  for (let i = 0; i < contours.length; i++) {
    const j = (i + 1) % contours.length;
    area += contours[i].x * contours[j].y;
    area -= contours[j].x * contours[i].y;
  }
  area = Math.abs(area) / 2;
  
  // Calcular área convexa (simplificada)
  const convexArea = calculateConvexHullArea(contours);
  
  return convexArea > 0 ? area / convexArea : 1;
};

// CURVATURA SIMPLIFICADA
const calculateSimplifiedCurvature = (contours: Array<{x: number, y: number}>): number => {
  if (contours.length < 3) return 0;
  
  let totalCurvature = 0;
  const sampleSize = Math.min(contours.length, 10); // Limitar para rendimiento
  
  for (let i = 1; i < sampleSize - 1; i++) {
    const p1 = contours[i-1];
    const p2 = contours[i];
    const p3 = contours[i+1];
    
    // Calcular ángulo
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 > 0 && mag2 > 0) {
      const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
      totalCurvature += angle;
    }
  }
  
  return totalCurvature / sampleSize;
};

// RUGOSIDAD BÁSICA
const calculateBasicRoughness = (contours: Array<{x: number, y: number}>): number => {
  if (contours.length < 3) return 0;
  
  // Calcular desviación de la línea recta
  let totalDeviation = 0;
  const sampleSize = Math.min(contours.length, 20); // Limitar para rendimiento
  
  for (let i = 2; i < sampleSize; i++) {
    const p1 = contours[i-2];
    const p2 = contours[i-1];  
    const p3 = contours[i];
    
    // Distancia del punto medio a la línea
    const lineLength = Math.sqrt((p3.x - p1.x)**2 + (p3.y - p1.y)**2);
    if (lineLength > 0) {
      const distanceToLine = Math.abs(
        ((p3.y - p1.y) * p2.x - (p3.x - p1.x) * p2.y + p3.x * p1.y - p3.y * p1.x) / lineLength
      );
      totalDeviation += distanceToLine;
    }
  }
  
  return totalDeviation / sampleSize;
};

// ORIENTACIÓN BÁSICA
const calculateBasicOrientation = (boundingBox: {x: number, y: number, width: number, height: number}) => {
  // Estimación simple basada en relación aspecto
  const aspectRatio = boundingBox.width / boundingBox.height;
  
  return {
    pitch: aspectRatio > 1.5 ? 15 : (aspectRatio < 0.7 ? -15 : 0),
    yaw: 0, // No se puede determinar fácilmente desde 2D
    roll: aspectRatio > 2 ? 10 : 0
  };
};

// ÁREA CONVEXA SIMPLIFICADA
const calculateConvexHullArea = (points: Array<{x: number, y: number}>): number => {
  if (points.length < 3) return 0;
  
  // Algoritmo simplificado de Gift Wrapping
  const hull = convexHull(points);
  
  // Calcular área del polígono convexo
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    area += hull[i].x * hull[j].y;
    area -= hull[j].x * hull[i].y;
  }
  
  return Math.abs(area) / 2;
};

// CONVEX HULL SIMPLIFICADO
const convexHull = (points: Array<{x: number, y: number}>): Array<{x: number, y: number}> => {
  if (points.length < 3) return points;
  
  // Encontrar punto más a la izquierda
  let leftmost = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < points[leftmost].x) {
      leftmost = i;
    }
  }
  
  const hull: Array<{x: number, y: number}> = [];
  let p = leftmost;
  
  do {
    hull.push(points[p]);
    
    let q = (p + 1) % points.length;
    for (let i = 0; i < points.length; i++) {
      if (orientation(points[p], points[i], points[q]) === 2) {
        q = i;
      }
    }
    
    p = q;
  } while (p !== leftmost && hull.length < points.length);
  
  return hull;
};

// ORIENTACIÓN DE TRES PUNTOS
const orientation = (p: {x: number, y: number}, q: {x: number, y: number}, r: {x: number, y: number}): number => {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (val === 0) return 0;  // colinear
  return (val > 0) ? 1 : 2; // clockwise or counterclockwise
};