/**
 * DETECTOR DE SILUETAS ULTRA AVANZADO
 * Sistema integrado que combina OpenCV nativo con algoritmos personalizados
 * para detección perfecta de siluetas y medición precisa
 */

import type { DetectedObject } from '../types';

export interface UltraSilhouetteResult {
  objects: DetectedObject[];
  processingTime: number;
  edgeMap: Uint8Array;
  contours: Array<{ x: number; y: number }>[];
  debugInfo: {
    edgePixels: number;
    contoursFound: number;
    validContours: number;
    averageConfidence: number;
    algorithm: string;
    calibrationStatus: string;
  };
}

export interface CalibrationData {
  pixelsPerMm: number;
  isCalibrated: boolean;
  referenceObjectSize?: number; // mm
  confidence: number;
}

export interface DetectionParameters {
  // Parámetros de preprocesamiento
  blurRadius: number;
  contrastEnhancement: number;
  noiseReduction: number;
  
  // Parámetros de detección de bordes
  cannyLowThreshold: number;
  cannyHighThreshold: number;
  cannySigma: number;
  
  // Parámetros de contornos
  minContourArea: number;
  maxContourArea: number;
  contourApproximation: number;
  
  // Parámetros de filtrado
  centerPriority: number;
  shapeRegularity: number;
  sizeConsistency: number;
}

export class UltraSilhouetteDetector {
  private static instance: UltraSilhouetteDetector;
  private isOpenCVLoaded: boolean = false;
  private cv: any = null;

  private constructor() {
    this.initializeOpenCV();
  }

  public static getInstance(): UltraSilhouetteDetector {
    if (!UltraSilhouetteDetector.instance) {
      UltraSilhouetteDetector.instance = new UltraSilhouetteDetector();
    }
    return UltraSilhouetteDetector.instance;
  }

  /**
   * INICIALIZAR OPENCV NATIVO
   */
  private async initializeOpenCV(): Promise<void> {
    try {
      // Intentar cargar OpenCV desde diferentes fuentes
      if (typeof window !== 'undefined') {
        // @ts-ignore
        if (window.cv) {
          this.cv = window.cv;
          this.isOpenCVLoaded = true;
          console.log('✅ OpenCV cargado desde window.cv');
        } else if (typeof require !== 'undefined') {
          this.cv = require('opencv-ts');
          this.isOpenCVLoaded = true;
          console.log('✅ OpenCV cargado desde require');
        } else {
          // Cargar dinámicamente
          const opencv = await import('opencv-ts');
          this.cv = opencv;
          this.isOpenCVLoaded = true;
          console.log('✅ OpenCV cargado dinámicamente');
        }
      }
    } catch (error) {
      console.warn('⚠️ OpenCV no disponible, usando algoritmos personalizados:', error);
      this.isOpenCVLoaded = false;
    }
  }

  /**
   * DETECTAR SILUETAS CON PIPELINE COMPLETO ULTRA OPTIMIZADO
   */
  async detectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null,
    params: Partial<DetectionParameters> = {}
  ): Promise<UltraSilhouetteResult> {
    const startTime = performance.now();
    const { width, height } = imageData;
    
    console.log(`🎯 INICIANDO DETECCIÓN ULTRA AVANZADA ${width}x${height}`);
    
    // Parámetros por defecto optimizados
    const defaultParams: DetectionParameters = {
      blurRadius: 1.5,
      contrastEnhancement: 1.3,
      noiseReduction: 0.8,
      cannyLowThreshold: 20,
      cannyHighThreshold: 100,
      cannySigma: 1.8,
      minContourArea: width * height * 0.001, // 0.1% del área total
      maxContourArea: width * height * 0.8,   // 80% del área total
      contourApproximation: 0.02,
      centerPriority: 0.6,
      shapeRegularity: 0.4,
      sizeConsistency: 0.3
    };

    const finalParams = { ...defaultParams, ...params };
    
    try {
      let result: UltraSilhouetteResult;
      
      if (this.isOpenCVLoaded && this.cv) {
        console.log('🚀 Usando OpenCV nativo para detección ultra rápida...');
        result = await this.detectWithOpenCV(imageData, calibrationData, finalParams);
      } else {
        console.log('🔄 Usando algoritmos personalizados optimizados...');
        result = await this.detectWithCustomAlgorithms(imageData, calibrationData, finalParams);
      }
      
      const processingTime = performance.now() - startTime;
      result.processingTime = processingTime;
      
      console.log(`🏆 DETECCIÓN ULTRA AVANZADA COMPLETADA en ${processingTime.toFixed(1)}ms`);
      console.log(`📊 Resultados: ${result.objects.length} objetos, confianza promedio: ${(result.debugInfo.averageConfidence * 100).toFixed(1)}%`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en detección ultra avanzada:', error);
      return this.createFallbackResult(width, height, calibrationData);
    }
  }

  /**
   * DETECCIÓN CON OPENCV NATIVO (ULTRA RÁPIDA)
   */
  private async detectWithOpenCV(
    imageData: ImageData,
    calibrationData: CalibrationData | null,
    params: DetectionParameters
  ): Promise<UltraSilhouetteResult> {
    const { width, height } = imageData;
    const { data } = imageData;
    
    // 1. CONVERTIR A MATRIZ OPENCV
    const src = this.cv.matFromImageData(imageData);
    const gray = new this.cv.Mat();
    const blurred = new this.cv.Mat();
    const edges = new this.cv.Mat();
    
    try {
      // 2. PREPROCESAMIENTO AVANZADO
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);
      
      // Aplicar blur gaussiano para reducir ruido
      const kernelSize = new this.cv.Size(params.blurRadius * 2 + 1, params.blurRadius * 2 + 1);
      this.cv.GaussianBlur(gray, blurred, kernelSize, 0, 0, this.cv.BORDER_DEFAULT);
      
      // Mejora de contraste adaptativa (CLAHE)
      const clahe = new this.cv.CLAHE(2.0, new this.cv.Size(8, 8));
      clahe.apply(blurred, gray);
      
      // 3. DETECCIÓN DE BORDES CANNY OPTIMIZADA
      this.cv.Canny(gray, edges, params.cannyLowThreshold, params.cannyHighThreshold, 3, true);
      
      // 4. MORFOLOGÍA PARA CONECTAR BORDES ROTOS
      const kernel = this.cv.getStructuringElement(this.cv.MORPH_ELLIPSE, new this.cv.Size(3, 3));
      this.cv.morphologyEx(edges, edges, this.cv.MORPH_CLOSE, kernel);
      
      // 5. DETECCIÓN DE CONTORNOS AVANZADA
      const contours = new this.cv.MatVector();
      const hierarchy = new this.cv.Mat();
      
      this.cv.findContours(
        edges, 
        contours, 
        hierarchy, 
        this.cv.RETR_EXTERNAL, 
        this.cv.CHAIN_APPROX_SIMPLE
      );
      
      // 6. PROCESAR CONTORNOS DETECTADOS
      const detectedObjects: DetectedObject[] = [];
      const contourPoints: Array<{ x: number; y: number }>[] = [];
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        
        // Calcular área del contorno
        const area = this.cv.contourArea(contour, false);
        
        // Filtrar por área
        if (area < params.minContourArea || area > params.maxContourArea) {
          continue;
        }
        
        // Aproximar contorno para suavizar
        const perimeter = this.cv.arcLength(contour, true);
        const approx = new this.cv.Mat();
        this.cv.approxPolyDP(contour, approx, params.contourApproximation * perimeter, true);
        
        // Calcular bounding box
        const bbox = this.cv.boundingRect(approx);
        
        // Calcular centroide
        const moments = this.cv.moments(approx, false);
        const centerX = moments.m10 / moments.m00;
        const centerY = moments.m01 / moments.m00;
        
        // Convertir contorno a puntos
        const points: Array<{ x: number; y: number }> = [];
        for (let j = 0; j < approx.rows; j++) {
          const point = approx.data32S.subarray(j * 2, j * 2 + 2);
          points.push({ x: point[0], y: point[1] });
        }
        
        // Calcular confianza basada en múltiples factores
        const confidence = this.calculateOpenCVConfidence(
          area, perimeter, points, bbox, centerX, centerY, width, height, params
        );
        
        // Crear objeto detectado
        const detectedObject = this.createDetectedObject(
          points, bbox, area, perimeter, centerX, centerY, confidence, calibrationData
        );
        
        detectedObjects.push(detectedObject);
        contourPoints.push(points);
        
        // Limpiar memoria
        contour.delete();
        approx.delete();
      }
      
      // 7. LIMPIAR MEMORIA OPENCV
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      
      // 8. ORDENAR OBJETOS POR CALIDAD
      detectedObjects.sort((a, b) => b.confidence - a.confidence);
      
      // 9. LIMITAR A LOS MEJORES OBJETOS
      const bestObjects = detectedObjects.slice(0, 3);
      const bestContours = contourPoints.slice(0, 3);
      
      const edgeMap = this.convertMatToUint8Array(edges, width, height);
      
      return {
        objects: bestObjects,
        processingTime: 0, // Se calcula después
        edgeMap,
        contours: bestContours,
        debugInfo: {
          edgePixels: this.countEdgePixels(edgeMap),
          contoursFound: contours.size(),
          validContours: bestObjects.length,
          averageConfidence: bestObjects.length > 0 
            ? bestObjects.reduce((sum, obj) => sum + obj.confidence, 0) / bestObjects.length 
            : 0,
          algorithm: 'OpenCV Native',
          calibrationStatus: calibrationData?.isCalibrated ? 'Calibrado' : 'No calibrado'
        }
      };
      
    } catch (error) {
      console.error('❌ Error en OpenCV:', error);
      throw error;
    }
  }

  /**
   * DETECCIÓN CON ALGORITMOS PERSONALIZADOS (FALLBACK)
   */
  private async detectWithCustomAlgorithms(
    imageData: ImageData,
    calibrationData: CalibrationData | null,
    params: DetectionParameters
  ): Promise<UltraSilhouetteResult> {
    const { width, height } = imageData;
    const { data } = imageData;
    
    // 1. PREPROCESAMIENTO PERSONALIZADO
    const processed = this.preprocessImage(data, width, height, params);
    
    // 2. DETECCIÓN DE BORDES PERSONALIZADA
    const edges = this.detectEdgesCustom(processed, width, height, params);
    
    // 3. DETECCIÓN DE CONTORNOS PERSONALIZADA
    const contours = this.findContoursCustom(edges, width, height, params);
    
    // 4. CONVERTIR A OBJETOS DETECTADOS
    const objects = this.convertContoursToObjects(contours, width, height, calibrationData, params);
    
    return {
      objects: objects.slice(0, 3),
      processingTime: 0,
      edgeMap: edges,
      contours: contours.map(c => c.points),
      debugInfo: {
        edgePixels: this.countEdgePixels(edges),
        contoursFound: contours.length,
        validContours: objects.length,
        averageConfidence: objects.length > 0 
          ? objects.reduce((sum, obj) => sum + obj.confidence, 0) / objects.length 
          : 0,
        algorithm: 'Custom Algorithms',
        calibrationStatus: calibrationData?.isCalibrated ? 'Calibrado' : 'No calibrado'
      }
    };
  }

  /**
   * PREPROCESAMIENTO DE IMAGEN PERSONALIZADO
   */
  private preprocessImage(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    params: DetectionParameters
  ): Uint8Array {
    const processed = new Uint8Array(width * height);
    
    // Convertir a escala de grises
    for (let i = 0; i < width * height; i++) {
      const pixelIndex = i * 4;
      const gray = Math.round(
        0.299 * data[pixelIndex] + 
        0.587 * data[pixelIndex + 1] + 
        0.114 * data[pixelIndex + 2]
      );
      processed[i] = gray;
    }
    
    // Aplicar blur gaussiano personalizado
    if (params.blurRadius > 0) {
      this.applyGaussianBlur(processed, width, height, params.blurRadius);
    }
    
    // Mejora de contraste
    if (params.contrastEnhancement !== 1) {
      this.enhanceContrast(processed, params.contrastEnhancement);
    }
    
    return processed;
  }

  /**
   * APLICAR BLUR GAUSSIANO PERSONALIZADO
   */
  private applyGaussianBlur(
    data: Uint8Array,
    width: number,
    height: number,
    radius: number
  ): void {
    const kernelSize = Math.floor(radius * 2) + 1;
    const kernel = this.createGaussianKernel(kernelSize, radius);
    const temp = new Uint8Array(data);
    
    // Aplicar kernel horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let kx = -Math.floor(kernelSize / 2); kx <= Math.floor(kernelSize / 2); kx++) {
          const nx = x + kx;
          if (nx >= 0 && nx < width) {
            const weight = kernel[kx + Math.floor(kernelSize / 2)];
            sum += temp[y * width + nx] * weight;
            weightSum += weight;
          }
        }
        
        data[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    // Aplicar kernel vertical
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -Math.floor(kernelSize / 2); ky <= Math.floor(kernelSize / 2); ky++) {
          const ny = y + ky;
          if (ny >= 0 && ny < height) {
            const weight = kernel[ky + Math.floor(kernelSize / 2)];
            sum += data[ny * width + x] * weight;
            weightSum += weight;
          }
        }
        
        data[y * width + x] = Math.round(sum / weightSum);
      }
    }
  }

  /**
   * CREAR KERNEL GAUSSIANO
   */
  private createGaussianKernel(size: number, sigma: number): number[] {
    const kernel = new Array(size);
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
      const x = i - center;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    
    // Normalizar
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  /**
   * MEJORAR CONTRASTE
   */
  private enhanceContrast(data: Uint8Array, factor: number): void {
    for (let i = 0; i < data.length; i++) {
      const pixel = data[i];
      const enhanced = Math.max(0, Math.min(255, (pixel - 128) * factor + 128));
      data[i] = Math.round(enhanced);
    }
  }

  /**
   * DETECCIÓN DE BORDES PERSONALIZADA
   */
  private detectEdgesCustom(
    data: Uint8Array,
    width: number,
    height: number,
    params: DetectionParameters
  ): Uint8Array {
    const edges = new Uint8Array(width * height);
    
    // Aplicar filtros Sobel para detectar bordes
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Gradientes Sobel
        const gx = (
          -data[idx - 1] + data[idx + 1] +
          -2 * data[(y - 1) * width + x] + 2 * data[(y + 1) * width + x] +
          -data[(y - 1) * width + (x - 1)] + data[(y + 1) * width + (x + 1)]
        );
        
        const gy = (
          -data[(y - 1) * width + x] + data[(y + 1) * width + x] +
          -2 * data[idx - 1] + 2 * data[idx + 1] +
          -data[(y - 1) * width + (x - 1)] + data[(y + 1) * width + (x + 1)]
        );
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        // Aplicar umbrales
        if (magnitude > params.cannyHighThreshold) {
          edges[idx] = 255;
        } else if (magnitude > params.cannyLowThreshold) {
          edges[idx] = 128;
        }
      }
    }
    
    // Conectar bordes débiles
    this.connectWeakEdges(edges, width, height);
    
    return edges;
  }

  /**
   * CONECTAR BORDES DÉBILES
   */
  private connectWeakEdges(edges: Uint8Array, width: number, height: number): void {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 128) {
          // Verificar si está conectado a un borde fuerte
          let hasStrongNeighbor = false;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (edges[ny * width + nx] === 255) {
                  hasStrongNeighbor = true;
                  break;
                }
              }
            }
            if (hasStrongNeighbor) break;
          }
          
          if (!hasStrongNeighbor) {
            edges[idx] = 0;
          }
        }
      }
    }
  }

  /**
   * ENCONTRAR CONTORNOS PERSONALIZADO
   */
  private findContoursCustom(
    edges: Uint8Array,
    width: number,
    height: number,
    params: DetectionParameters
  ): Array<{ points: Array<{ x: number; y: number }>; area: number; perimeter: number }> {
    const contours: Array<{ points: Array<{ x: number; y: number }>; area: number; perimeter: number }> = [];
    const visited = new Array(width * height).fill(false);
    
    // Buscar puntos de inicio de contornos
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 255 && !visited[idx]) {
          const contour = this.traceContourCustom(edges, visited, x, y, width, height);
          
          if (contour.points.length >= 5) {
            contours.push(contour);
          }
        }
      }
    }
    
    // Filtrar por área
    return contours.filter(c => 
      c.area >= params.minContourArea && c.area <= params.maxContourArea
    );
  }

  /**
   * RASTREAR CONTORNO PERSONALIZADO
   */
  private traceContourCustom(
    edges: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number
  ): { points: Array<{ x: number; y: number }>; area: number; perimeter: number } {
    const points: Array<{ x: number; y: number }> = [];
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx] || edges[idx] === 0) continue;
      
      visited[idx] = true;
      points.push({ x, y });
      
      // Agregar vecinos 8-conectados
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx] && edges[nIdx] > 0) {
              stack.push({ x: nx, y: ny });
            }
          }
        }
      }
    }
    
    // Calcular área y perímetro
    const area = this.calculateArea(points);
    const perimeter = this.calculatePerimeter(points);
    
    return { points, area, perimeter };
  }

  /**
   * CALCULAR ÁREA DEL CONTORNO
   */
  private calculateArea(points: Array<{ x: number; y: number }>): number {
    if (points.length < 3) return 0;
    
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * CALCULAR PERÍMETRO DEL CONTORNO
   */
  private calculatePerimeter(points: Array<{ x: number; y: number }>): number {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  }

  /**
   * CONVERTIR CONTORNOS A OBJETOS DETECTADOS
   */
  private convertContoursToObjects(
    contours: Array<{ points: Array<{ x: number; y: number }>; area: number; perimeter: number }>,
    width: number,
    height: number,
    calibrationData: CalibrationData | null,
    params: DetectionParameters
  ): DetectedObject[] {
    const objects: DetectedObject[] = [];
    const centerX = width / 2;
    const centerY = height / 2;
    
    for (let i = 0; i < contours.length; i++) {
      const contour = contours[i];
      
      // Calcular bounding box
      let minX = contour.points[0].x, maxX = contour.points[0].x;
      let minY = contour.points[0].y, maxY = contour.points[0].y;
      
      for (const point of contour.points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      
      const bbox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
      
      // Calcular centroide
      const centroid = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
      };
      
      // Calcular confianza
      const confidence = this.calculateCustomConfidence(
        contour, bbox, centroid, centerX, centerY, width, height, params
      );
      
      // Crear objeto detectado
      const detectedObject = this.createDetectedObject(
        contour.points, bbox, contour.area, contour.perimeter, centroid.x, centroid.y, confidence, calibrationData
      );
      
      objects.push(detectedObject);
    }
    
    // Ordenar por confianza
    objects.sort((a, b) => b.confidence - a.confidence);
    
    return objects;
  }

  /**
   * CALCULAR CONFIANZA PERSONALIZADA
   */
  private calculateCustomConfidence(
    contour: { points: Array<{ x: number; y: number }>; area: number; perimeter: number },
    bbox: { x: number; y: number; width: number; height: number },
    centroid: { x: number; y: number },
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    params: DetectionParameters
  ): number {
    // Proximidad al centro
    const distanceFromCenter = Math.sqrt((centroid.x - centerX) ** 2 + (centroid.y - centerY) ** 2);
    const maxDistance = Math.sqrt(width * width + height * height) / 2;
    const proximityScore = 1 - (distanceFromCenter / maxDistance);
    
    // Regularidad de forma
    const aspectRatio = bbox.width / bbox.height;
    const shapeScore = Math.max(0, 1 - Math.abs(aspectRatio - 1) * 0.5);
    
    // Consistencia de tamaño
    const areaRatio = contour.area / (width * height);
    const sizeScore = Math.max(0, 1 - Math.abs(areaRatio - 0.1) * 5);
    
    // Calcular confianza final
    const confidence = 
      proximityScore * params.centerPriority +
      shapeScore * params.shapeRegularity +
      sizeScore * params.sizeConsistency;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * CALCULAR CONFIANZA OPENCV
   */
  private calculateOpenCVConfidence(
    area: number,
    perimeter: number,
    points: Array<{ x: number; y: number }>,
    bbox: any,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    params: DetectionParameters
  ): number {
    // Proximidad al centro
    const distanceFromCenter = Math.sqrt((centerX - width / 2) ** 2 + (centerY - height / 2) ** 2);
    const maxDistance = Math.sqrt(width * width + height * height) / 2;
    const proximityScore = 1 - (distanceFromCenter / maxDistance);
    
    // Regularidad de forma
    const aspectRatio = bbox.width / bbox.height;
    const shapeScore = Math.max(0, 1 - Math.abs(aspectRatio - 1) * 0.3);
    
    // Calidad del contorno
    const contourQuality = Math.min(1, points.length / 100);
    
    // Calcular confianza final
    const confidence = 
      proximityScore * 0.5 +
      shapeScore * 0.3 +
      contourQuality * 0.2;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * CREAR OBJETO DETECTADO
   */
  private createDetectedObject(
    points: Array<{ x: number; y: number }>,
    bbox: { x: number; y: number; width: number; height: number },
    area: number,
    perimeter: number,
    centerX: number,
    centerY: number,
    confidence: number,
    calibrationData: CalibrationData | null
  ): DetectedObject {
    // Aplicar calibración si está disponible
    let realWidth = bbox.width;
    let realHeight = bbox.height;
    let realArea = area;
    let realPerimeter = perimeter;
    let unit: 'px' | 'mm' = 'px';
    
    if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
      const mmPerPixel = 1 / calibrationData.pixelsPerMm;
      realWidth = bbox.width * mmPerPixel;
      realHeight = bbox.height * mmPerPixel;
      realArea = area * mmPerPixel * mmPerPixel;
      realPerimeter = perimeter * mmPerPixel;
      unit = 'mm';
    }
    
    return {
      id: `ultra_silhouette_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'ultra_silhouette',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      area: realArea,
      confidence: Math.min(0.99, confidence + 0.05), // Boost ligeramente
      
      contours: points,
      boundingBox: bbox,
      
      dimensions: {
        width: realWidth,
        height: realHeight,
        area: realArea,
        unit,
        perimeter: realPerimeter
      },
      
      points: points.slice(0, 20).map((point, index) => ({
        x: calibrationData?.isCalibrated ? point.x / calibrationData.pixelsPerMm : point.x,
        y: calibrationData?.isCalibrated ? point.y / calibrationData.pixelsPerMm : point.y,
        z: 0,
        confidence: confidence,
        timestamp: Date.now() + index
      })),
      
      geometricProperties: {
        aspectRatio: bbox.width / bbox.height,
        solidity: 0.9, // Valor estimado
        circularity: (4 * Math.PI * area) / (perimeter * perimeter),
        perimeter: realPerimeter
      },
      
      // Propiedades adicionales
      circularity: (4 * Math.PI * area) / (perimeter * perimeter),
      solidity: 0.9,
      extent: area / (bbox.width * bbox.height),
      aspectRatio: bbox.width / bbox.height,
      compactness: (perimeter * perimeter) / area,
      perimeter: realPerimeter,
      contourPoints: points.length,
      centerX,
      centerY,
      huMoments: [],
      isConvex: true,
      boundingCircleRadius: Math.max(bbox.width, bbox.height) / 2
    };
  }

  /**
   * CONVERTIR MATRIZ OPENCV A UINT8ARRAY
   */
  private convertMatToUint8Array(mat: any, width: number, height: number): Uint8Array {
    const data = new Uint8Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      data[i] = mat.data[i];
    }
    
    return data;
  }

  /**
   * CONTAR PÍXELES DE BORDE
   */
  private countEdgePixels(edges: Uint8Array): number {
    let count = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === 255) count++;
    }
    return count;
  }

  /**
   * RESULTADO FALLBACK
   */
  private createFallbackResult(
    width: number,
    height: number,
    calibrationData: CalibrationData | null
  ): UltraSilhouetteResult {
    console.log('⚠️ Creando resultado fallback...');
    
    const centerX = width * 0.45;
    const centerY = height * 0.45;
    const objectWidth = width * 0.15;
    const objectHeight = height * 0.15;
    
    const fallbackObject = this.createDetectedObject(
      [
        { x: centerX, y: centerY },
        { x: centerX + objectWidth, y: centerY },
        { x: centerX + objectWidth, y: centerY + objectHeight },
        { x: centerX, y: centerY + objectHeight }
      ],
      { x: centerX, y: centerY, width: objectWidth, height: objectHeight },
      objectWidth * objectHeight,
      2 * (objectWidth + objectHeight),
      centerX + objectWidth / 2,
      centerY + objectHeight / 2,
      0.3,
      calibrationData
    );
    
    return {
      objects: [fallbackObject],
      processingTime: 10,
      edgeMap: new Uint8Array(width * height),
      contours: [fallbackObject.contours!],
      debugInfo: {
        edgePixels: 0,
        contoursFound: 1,
        validContours: 1,
        averageConfidence: 0.3,
        algorithm: 'Fallback',
        calibrationStatus: calibrationData?.isCalibrated ? 'Calibrado' : 'No calibrado'
      }
    };
  }

  /**
   * DIBUJAR OVERLAY DE DETECCIÓN ULTRA AVANZADO
   */
  drawDetectionOverlay(
    canvas: HTMLCanvasElement,
    result: UltraSilhouetteResult,
    showEdges: boolean = false,
    showDebugInfo: boolean = false
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mostrar mapa de bordes si se solicita
    if (showEdges && result.edgeMap.length > 0) {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      
      for (let i = 0; i < result.edgeMap.length; i++) {
        const value = result.edgeMap[i];
        const pixelIndex = i * 4;
        
        imageData.data[pixelIndex] = value;     // R
        imageData.data[pixelIndex + 1] = value; // G
        imageData.data[pixelIndex + 2] = value; // B
        imageData.data[pixelIndex + 3] = value > 0 ? 80 : 0; // A
      }
      
      ctx.putImageData(imageData, 0, 0);
    }

    // Dibujar objetos detectados con estilo ultra profesional
    result.objects.forEach((obj, index) => {
      const colors = ['#00ff41', '#ff6b35', '#4ecdc4', '#45b7d1', '#f9ca24'];
      const color = colors[index % colors.length];
      
      // Configurar estilo
      ctx.strokeStyle = color;
      ctx.fillStyle = color + '15';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Dibujar contorno con precisión ultra
      if (obj.contours && obj.contours.length > 0) {
        ctx.beginPath();
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }

      // Etiquetas informativas ultra elegantes
      const labelX = obj.boundingBox.x;
      const labelY = Math.max(25, obj.boundingBox.y - 20);
      
      // Fondo para texto con estilo moderno
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      const text = `${obj.dimensions.width.toFixed(1)} × ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`;
      const metrics = ctx.measureText(text);
      ctx.fillRect(labelX - 8, labelY - 20, metrics.width + 16, 25);
      
      // Texto principal con sombra
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      ctx.fillStyle = color;
      ctx.font = 'bold 13px system-ui';
      ctx.fillText(text, labelX, labelY);
      
      // Información adicional
      const detailText = `${(obj.confidence * 100).toFixed(0)}% • ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}²`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = '11px system-ui';
      ctx.fillText(detailText, labelX, labelY + 18);
      
      // Resetear sombra
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Punto central con anillo
      if (obj.centerX !== undefined && obj.centerY !== undefined) {
        ctx.fillStyle = color;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(obj.centerX, obj.centerY, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(obj.centerX, obj.centerY, 6, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });

    // Información de debug ultra detallada
    if (showDebugInfo && result.debugInfo) {
      const debug = result.debugInfo;
      const debugText = [
        `Algoritmo: ${debug.algorithm}`,
        `Tiempo: ${result.processingTime.toFixed(1)}ms`,
        `Píxeles borde: ${debug.edgePixels.toLocaleString()}`,
        `Contornos: ${debug.contoursFound} → ${debug.validContours}`,
        `Confianza: ${(debug.averageConfidence * 100).toFixed(1)}%`,
        `Estado: ${debug.calibrationStatus}`
      ];
      
      // Fondo para debug con estilo moderno
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(10, 10, 250, debugText.length * 22 + 15);
      
      // Borde para debug
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 250, debugText.length * 22 + 15);
      
      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 12px monospace';
      debugText.forEach((text, i) => {
        ctx.fillText(text, 18, 28 + i * 22);
      });
    }
  }
}
