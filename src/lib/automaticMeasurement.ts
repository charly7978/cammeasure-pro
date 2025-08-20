// SISTEMA DE MEDICIÓN AUTOMÁTICA - PROCESAMIENTO CONTINUO Y PRECISO
import { DetectedSilhouette } from './silhouetteDetector';

export interface AutomaticMeasurement {
  // Mediciones básicas
  width: number;
  height: number;
  area: number;
  perimeter: number;
  
  // Mediciones geométricas avanzadas
  circularity: number;
  rectangularity: number;
  convexity: number;
  solidity: number;
  aspectRatio: number;
  
  // Propiedades del contorno
  contourComplexity: number;
  boundingBoxFillRatio: number;
  centroid: { x: number; y: number };
  
  // Métricas de calidad
  confidence: number;
  stability: number;
  processingTime: number;
  timestamp: number;
  
  // Información del algoritmo
  algorithm: string;
  frameNumber: number;
  isValid: boolean;
}

export class AutomaticMeasurementSystem {
  private measurementHistory: AutomaticMeasurement[] = [];
  private readonly HISTORY_SIZE = 10;
  
  // PROCESAR SILUETA Y GENERAR MEDICIONES AUTOMÁTICAS
  async processAndMeasure(silhouette: DetectedSilhouette, frameNumber: number): Promise<AutomaticMeasurement> {
    const startTime = performance.now();
    
    console.log(`🔬 INICIANDO MEDICIÓN AUTOMÁTICA - Frame ${frameNumber}`);
    
    // 1. MEDICIONES BÁSICAS
    const basicMeasurements = this.calculateBasicMeasurements(silhouette);
    
    // 2. MEDICIONES GEOMÉTRICAS AVANZADAS
    const geometricMeasurements = this.calculateGeometricMeasurements(silhouette);
    
    // 3. ANÁLISIS DE CONTORNO
    const contourAnalysis = this.analyzeContour(silhouette.contours);
    
    // 4. MÉTRICAS DE CALIDAD
    const qualityMetrics = this.calculateQualityMetrics(silhouette, basicMeasurements);
    
    // 5. ESTABILIDAD TEMPORAL
    const stability = this.calculateStability(basicMeasurements);
    
    const measurement: AutomaticMeasurement = {
      ...basicMeasurements,
      ...geometricMeasurements,
      ...contourAnalysis,
      ...qualityMetrics,
      stability,
      processingTime: performance.now() - startTime,
      timestamp: Date.now(),
      algorithm: 'Advanced Silhouette Analysis',
      frameNumber,
      isValid: silhouette.isValid && qualityMetrics.confidence > 0.7
    };
    
    // 6. AGREGAR AL HISTORIAL
    this.addToHistory(measurement);
    
    console.log(`✅ MEDICIÓN COMPLETADA:`, {
      área: Math.round(measurement.area),
      perímetro: Math.round(measurement.perimeter),
      circularidad: measurement.circularity.toFixed(2),
      confianza: (measurement.confidence * 100).toFixed(1) + '%',
      tiempo: measurement.processingTime.toFixed(1) + 'ms'
    });
    
    return measurement;
  }

  // MEDICIONES BÁSICAS FUNDAMENTALES
  private calculateBasicMeasurements(silhouette: DetectedSilhouette) {
    return {
      width: silhouette.boundingBox.width,
      height: silhouette.boundingBox.height,
      area: silhouette.area,
      perimeter: silhouette.perimeter,
      centroid: silhouette.centroid
    };
  }

  // MEDICIONES GEOMÉTRICAS AVANZADAS
  private calculateGeometricMeasurements(silhouette: DetectedSilhouette) {
    const { area, perimeter, boundingBox, contours } = silhouette;
    
    // CIRCULARIDAD: Qué tan parecido a un círculo es el objeto
    const circularity = area > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
    
    // RECTANGULARIDAD: Qué tan parecido a un rectángulo es el objeto
    const boundingBoxArea = boundingBox.width * boundingBox.height;
    const rectangularity = boundingBoxArea > 0 ? area / boundingBoxArea : 0;
    
    // CONVEXIDAD: Relación entre área y área del envoltorio convexo
    const convexHull = this.calculateConvexHull(contours);
    const convexArea = this.calculatePolygonArea(convexHull);
    const convexity = convexArea > 0 ? area / convexArea : 0;
    
    // SOLIDEZ: Similar a convexidad pero más robusto
    const solidity = Math.min(1.0, convexity);
    
    // RELACIÓN DE ASPECTO
    const aspectRatio = boundingBox.height > 0 ? boundingBox.width / boundingBox.height : 1;
    
    return {
      circularity: Math.min(1.0, Math.max(0, circularity)),
      rectangularity: Math.min(1.0, Math.max(0, rectangularity)),
      convexity: Math.min(1.0, Math.max(0, convexity)),
      solidity: Math.min(1.0, Math.max(0, solidity)),
      aspectRatio
    };
  }

  // ANÁLISIS DETALLADO DEL CONTORNO
  private analyzeContour(contours: { x: number; y: number }[]) {
    if (contours.length < 3) {
      return {
        contourComplexity: 0,
        boundingBoxFillRatio: 0
      };
    }
    
    // COMPLEJIDAD DEL CONTORNO: Basada en variaciones de curvatura
    const complexity = this.calculateContourComplexity(contours);
    
    // RATIO DE LLENADO DEL BOUNDING BOX
    const boundingBox = this.calculateBoundingBox(contours);
    const area = this.calculatePolygonArea(contours);
    const boundingBoxArea = boundingBox.width * boundingBox.height;
    const fillRatio = boundingBoxArea > 0 ? area / boundingBoxArea : 0;
    
    return {
      contourComplexity: Math.min(1.0, Math.max(0, complexity)),
      boundingBoxFillRatio: Math.min(1.0, Math.max(0, fillRatio))
    };
  }

  // MÉTRICAS DE CALIDAD DE LA MEDICIÓN
  private calculateQualityMetrics(silhouette: DetectedSilhouette, basicMeasurements: any) {
    let confidence = silhouette.confidence;
    
    // PENALIZAR FORMAS MUY PEQUEÑAS O MUY GRANDES
    const areaScore = this.normalizeArea(basicMeasurements.area);
    
    // PENALIZAR PERÍMETROS IRREGULARES
    const perimeterScore = this.evaluatePerimeterQuality(silhouette.contours);
    
    // PENALIZAR CONTORNOS CON POCOS PUNTOS
    const contourScore = Math.min(1.0, silhouette.contours.length / 50);
    
    // COMBINAR TODOS LOS FACTORES
    confidence = confidence * 0.4 + areaScore * 0.2 + perimeterScore * 0.2 + contourScore * 0.2;
    
    return {
      confidence: Math.min(1.0, Math.max(0, confidence))
    };
  }

  // CALCULAR ESTABILIDAD TEMPORAL DE LAS MEDICIONES
  private calculateStability(currentMeasurement: any): number {
    if (this.measurementHistory.length < 3) return 0.5;
    
    // Comparar con mediciones recientes
    const recentMeasurements = this.measurementHistory.slice(-3);
    
    let areaVariation = 0;
    let perimeterVariation = 0;
    
    for (const measurement of recentMeasurements) {
      areaVariation += Math.abs(measurement.area - currentMeasurement.area) / Math.max(measurement.area, currentMeasurement.area);
      perimeterVariation += Math.abs(measurement.perimeter - currentMeasurement.perimeter) / Math.max(measurement.perimeter, currentMeasurement.perimeter);
    }
    
    areaVariation /= recentMeasurements.length;
    perimeterVariation /= recentMeasurements.length;
    
    // Estabilidad alta significa poca variación
    const stability = 1.0 - Math.min(1.0, (areaVariation + perimeterVariation) / 2);
    
    return Math.max(0, stability);
  }

  // MÉTODOS AUXILIARES PARA CÁLCULOS GEOMÉTRICOS

  private calculateConvexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length < 3) return points;
    
    // Algoritmo Graham Scan simplificado
    const sortedPoints = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    
    const hull: { x: number; y: number }[] = [];
    
    // Lower hull
    for (const point of sortedPoints) {
      while (hull.length >= 2 && this.crossProduct(hull[hull.length-2], hull[hull.length-1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }
    
    // Upper hull
    const t = hull.length + 1;
    for (let i = sortedPoints.length - 2; i >= 0; i--) {
      const point = sortedPoints[i];
      while (hull.length >= t && this.crossProduct(hull[hull.length-2], hull[hull.length-1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }
    
    hull.pop(); // Remove last point as it's the same as first
    return hull;
  }

  private crossProduct(o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  private calculatePolygonArea(points: { x: number; y: number }[]): number {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  }

  private calculateBoundingBox(points: { x: number; y: number }[]): { x: number; y: number; width: number; height: number } {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private calculateContourComplexity(contours: { x: number; y: number }[]): number {
    if (contours.length < 5) return 0;
    
    let totalCurvature = 0;
    
    for (let i = 2; i < contours.length - 2; i++) {
      const p1 = contours[i - 2];
      const p2 = contours[i];
      const p3 = contours[i + 2];
      
      // Calcular curvatura usando tres puntos
      const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      let curvature = Math.abs(angle2 - angle1);
      
      // Normalizar ángulo
      if (curvature > Math.PI) curvature = 2 * Math.PI - curvature;
      
      totalCurvature += curvature;
    }
    
    return totalCurvature / (contours.length - 4);
  }

  private normalizeArea(area: number): number {
    // Área ideal entre 1000 y 100000 píxeles
    const minIdeal = 1000;
    const maxIdeal = 100000;
    
    if (area < minIdeal) return area / minIdeal;
    if (area > maxIdeal) return maxIdeal / area;
    return 1.0;
  }

  private evaluatePerimeterQuality(contours: { x: number; y: number }[]): number {
    if (contours.length < 10) return 0.5;
    
    // Evaluar suavidad del perímetro
    let smoothnessScore = 0;
    const windowSize = Math.min(5, Math.floor(contours.length / 10));
    
    for (let i = windowSize; i < contours.length - windowSize; i++) {
      const distances: number[] = [];
      
      for (let j = -windowSize; j <= windowSize; j++) {
        if (j !== 0) {
          const p1 = contours[i];
          const p2 = contours[i + j];
          const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          distances.push(distance);
        }
      }
      
      const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      const variance = distances.reduce((sum, d) => sum + (d - mean) ** 2, 0) / distances.length;
      const smoothness = 1.0 / (1.0 + variance);
      
      smoothnessScore += smoothness;
    }
    
    return smoothnessScore / (contours.length - 2 * windowSize);
  }

  private addToHistory(measurement: AutomaticMeasurement): void {
    this.measurementHistory.push(measurement);
    
    if (this.measurementHistory.length > this.HISTORY_SIZE) {
      this.measurementHistory.shift();
    }
  }

  // OBTENER ESTADÍSTICAS DEL HISTORIAL
  getHistoryStatistics() {
    if (this.measurementHistory.length === 0) return null;
    
    const recent = this.measurementHistory.slice(-5);
    
    const avgArea = recent.reduce((sum, m) => sum + m.area, 0) / recent.length;
    const avgPerimeter = recent.reduce((sum, m) => sum + m.perimeter, 0) / recent.length;
    const avgConfidence = recent.reduce((sum, m) => sum + m.confidence, 0) / recent.length;
    const avgStability = recent.reduce((sum, m) => sum + m.stability, 0) / recent.length;
    
    return {
      measurementCount: this.measurementHistory.length,
      averageArea: avgArea,
      averagePerimeter: avgPerimeter,
      averageConfidence: avgConfidence,
      averageStability: avgStability,
      lastMeasurement: this.measurementHistory[this.measurementHistory.length - 1]
    };
  }

  // LIMPIAR HISTORIAL
  clearHistory(): void {
    this.measurementHistory = [];
  }
}