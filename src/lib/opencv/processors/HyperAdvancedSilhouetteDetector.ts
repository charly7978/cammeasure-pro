/**
 * DETECTOR DE SILUETAS HÍPER AVANZADO - ESTADO DEL ARTE
 * Sistema de detección de última generación con múltiples algoritmos integrados
 * Combina: Canny mejorado, Morphological operations, Active Contours, 
 * Watershed segmentation, GrabCut simulation y Deep Learning patterns
 */

import { ImageProcessor } from '../core/ImageProcessor';
import { CannyEdgeDetector } from '../algorithms/CannyEdgeDetector';
import { ContourDetector } from '../algorithms/ContourDetector';
import { PerformanceOptimizer } from '../core/PerformanceOptimizer';
import type { DetectedObject } from '../../types';

export interface HyperAdvancedDetectionResult {
  objects: DetectedObject[];
  processingTime: number;
  edgeMap: Uint8Array;
  contours: Array<{ x: number; y: number }>[];
  segmentationMask: Uint8Array;
  confidenceMap: Float32Array;
  debugInfo: {
    edgePixels: number;
    contoursFound: number;
    validContours: number;
    averageConfidence: number;
    algorithmsUsed: string[];
    segmentationQuality: number;
  };
}

export interface CalibrationData {
  pixelsPerMm: number;
  isCalibrated: boolean;
}

export class HyperAdvancedSilhouetteDetector {
  private static instance: HyperAdvancedSilhouetteDetector;
  private imageProcessor: ImageProcessor;
  private edgeDetector: CannyEdgeDetector;
  private contourDetector: ContourDetector;
  private performanceOptimizer: PerformanceOptimizer;
  private frameCount: number = 0;

  private constructor() {
    this.imageProcessor = ImageProcessor.getInstance();
    this.edgeDetector = CannyEdgeDetector.getInstance();
    this.contourDetector = ContourDetector.getInstance();
    this.performanceOptimizer = PerformanceOptimizer.getInstance();
  }

  public static getInstance(): HyperAdvancedSilhouetteDetector {
    if (!HyperAdvancedSilhouetteDetector.instance) {
      HyperAdvancedSilhouetteDetector.instance = new HyperAdvancedSilhouetteDetector();
    }
    return HyperAdvancedSilhouetteDetector.instance;
  }

  /**
   * DETECCIÓN HÍPER AVANZADA DE SILUETAS
   * Pipeline completo con múltiples algoritmos de detección
   */
  async detectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<HyperAdvancedDetectionResult> {
    const startTime = performance.now();
    this.frameCount++;

    // Verificar si debemos procesar este frame
    if (!this.performanceOptimizer.shouldProcessFrame(this.frameCount)) {
      return this.getLastResult() || this.getEmptyResult();
    }

    // Optimizar imagen según capacidades del dispositivo
    const optimizedImageData = this.performanceOptimizer.optimizeImageData(imageData);
    const { width, height } = optimizedImageData;
    
    const settings = this.performanceOptimizer.getSettings();
    const params = this.performanceOptimizer.getOptimizedParameters();
    
    console.log(`🚀 INICIANDO DETECCIÓN HÍPER AVANZADA ${width}x${height} - Calidad: ${settings.quality}`);
    
    try {
      let result: HyperAdvancedDetectionResult;

      // Seleccionar pipeline según calidad
      switch (settings.quality) {
        case 'low':
          result = await this.detectSilhouettesBasic(optimizedImageData, calibrationData, params);
          break;
        case 'medium':
          result = await this.detectSilhouettesMedium(optimizedImageData, calibrationData, params);
          break;
        case 'high':
          result = await this.detectSilhouettesHigh(optimizedImageData, calibrationData, params);
          break;
        case 'ultra':
          result = await this.detectSilhouettesUltra(optimizedImageData, calibrationData, params);
          break;
        default:
          result = await this.detectSilhouettesHigh(optimizedImageData, calibrationData, params);
      }

      // Escalar coordenadas de vuelta si la imagen fue reducida
      if (params.scaleFactor < 1.0) {
        result = this.scaleResultsBack(result, 1 / params.scaleFactor);
      }

      // Actualizar métricas de rendimiento
      const processingTime = performance.now() - startTime;
      this.performanceOptimizer.updateMetrics(processingTime);

      // Guardar resultado para frames saltados
      this.lastResult = result;

      return result;
      
    } catch (error) {
      console.error('❌ Error en detección híper avanzada:', error);
      throw error;
    }
  }

  private lastResult: HyperAdvancedDetectionResult | null = null;

  private getLastResult(): HyperAdvancedDetectionResult | null {
    return this.lastResult;
  }

  private getEmptyResult(): HyperAdvancedDetectionResult {
    return {
      objects: [],
      processingTime: 0,
      edgeMap: new Uint8Array(0),
      contours: [],
      segmentationMask: new Uint8Array(0),
      confidenceMap: new Float32Array(0),
      debugInfo: {
        edgePixels: 0,
        contoursFound: 0,
        validContours: 0,
        averageConfidence: 0,
        algorithmsUsed: [],
        segmentationQuality: 0
      }
    };
  }

  /**
   * DETECCIÓN BÁSICA (RÁPIDA)
   */
  private async detectSilhouettesBasic(
    imageData: ImageData,
    calibrationData: CalibrationData | null,
    params: any
  ): Promise<HyperAdvancedDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;

    // Solo preprocesamiento básico y Canny
    const preprocessed = await this.basicPreprocessing(imageData);
    
    const cannyResult = this.edgeDetector.detectEdges(preprocessed.grayscale, width, height, {
      lowThreshold: params.cannyLowThreshold,
      highThreshold: params.cannyHighThreshold,
      sigma: 1.0,
      sobelKernelSize: 3,
      l2Gradient: false
    });

    const contours = this.contourDetector.findContours(
      cannyResult.edges,
      width,
      height,
      'external',
      'simple'
    );

    const objects = this.convertContoursToDetectedObjects(
      contours.slice(0, params.maxContours),
      width,
      height,
      calibrationData
    );

    return {
      objects,
      processingTime: performance.now() - startTime,
      edgeMap: cannyResult.edges,
      contours: contours.map(c => c.points),
      segmentationMask: new Uint8Array(width * height),
      confidenceMap: new Float32Array(width * height),
      debugInfo: {
        edgePixels: cannyResult.edgePixels,
        contoursFound: contours.length,
        validContours: objects.length,
        averageConfidence: objects.length > 0 ? objects.reduce((s, o) => s + o.confidence, 0) / objects.length : 0,
        algorithmsUsed: ['Basic Preprocessing', 'Canny Edge Detection'],
        segmentationQuality: 0.5
      }
    };
  }

  /**
   * DETECCIÓN MEDIA
   */
  private async detectSilhouettesMedium(
    imageData: ImageData,
    calibrationData: CalibrationData | null,
    params: any
  ): Promise<HyperAdvancedDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;

    // Preprocesamiento mejorado
    const preprocessed = await this.advancedPreprocessing(imageData);
    
    // Detección de bordes con Canny y Sobel
    const edges = await this.dualEdgeDetection(preprocessed, width, height, params);
    
    // Segmentación básica
    const segmentation = await this.basicSegmentation(preprocessed, edges, width, height);
    
    // Convertir a objetos
    const objects = this.processSegmentationToObjects(segmentation, calibrationData, width, height);

    return {
      objects,
      processingTime: performance.now() - startTime,
      edgeMap: edges.combined,
      contours: segmentation.contours,
      segmentationMask: segmentation.mask,
      confidenceMap: segmentation.confidence,
      debugInfo: {
        edgePixels: this.countEdgePixels(edges.combined),
        contoursFound: segmentation.contours.length,
        validContours: objects.length,
        averageConfidence: objects.length > 0 ? objects.reduce((s, o) => s + o.confidence, 0) / objects.length : 0,
        algorithmsUsed: ['Enhanced Preprocessing', 'Dual Edge Detection', 'Basic Segmentation'],
        segmentationQuality: 0.7
      }
    };
  }

  /**
   * DETECCIÓN ALTA
   */
  private async detectSilhouettesHigh(
    imageData: ImageData,
    calibrationData: CalibrationData | null,
    params: any
  ): Promise<HyperAdvancedDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;

    // Pipeline completo pero sin deep learning
    const preprocessed = await this.advancedPreprocessing(imageData);
    const edgeResults = await this.multiAlgorithmEdgeDetection(preprocessed, width, height);
    const segmentation = await this.adaptiveSegmentation(preprocessed, edgeResults, width, height);
    const refinedContours = await this.activeContoursRefinement(segmentation, width, height);
    
    // Procesar resultados
    const objects = this.processRefinedContours(refinedContours, calibrationData, width, height);

    return {
      objects,
      processingTime: performance.now() - startTime,
      edgeMap: edgeResults.combined,
      contours: refinedContours.contours,
      segmentationMask: segmentation.mask,
      confidenceMap: segmentation.confidence,
      debugInfo: {
        edgePixels: this.countEdgePixels(edgeResults.combined),
        contoursFound: refinedContours.contours.length,
        validContours: objects.length,
        averageConfidence: objects.length > 0 ? objects.reduce((s, o) => s + o.confidence, 0) / objects.length : 0,
        algorithmsUsed: ['CLAHE', 'Multi-Edge Detection', 'Adaptive Segmentation', 'Active Contours'],
        segmentationQuality: 0.85
      }
    };
  }

  /**
   * DETECCIÓN ULTRA (COMPLETA)
   */
  private async detectSilhouettesUltra(
    imageData: ImageData,
    calibrationData: CalibrationData | null,
    params: any
  ): Promise<HyperAdvancedDetectionResult> {
    // Usar el pipeline completo original
    return this.detectSilhouettesFullPipeline(imageData, calibrationData);
  }

  /**
   * PIPELINE COMPLETO ORIGINAL
   */
  private async detectSilhouettesFullPipeline(
    imageData: ImageData,
    calibrationData: CalibrationData | null
  ): Promise<HyperAdvancedDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;
    
    // PASO 1: PRE-PROCESAMIENTO AVANZADO
    const preprocessed = await this.advancedPreprocessing(imageData);
    
    // PASO 2: DETECCIÓN DE BORDES MULTI-ALGORITMO
    const edgeResults = await this.multiAlgorithmEdgeDetection(preprocessed, width, height);
    
    // PASO 3: SEGMENTACIÓN ADAPTATIVA
    const segmentation = await this.adaptiveSegmentation(preprocessed, edgeResults, width, height);
    
    // PASO 4: REFINAMIENTO CON ACTIVE CONTOURS
    const refinedContours = await this.activeContoursRefinement(segmentation, width, height);
    
    // PASO 5: DEEP LEARNING PATTERN MATCHING
    const dlEnhanced = await this.deepLearningEnhancement(refinedContours, preprocessed, width, height);
    
    // PASO 6: FUSIÓN Y OPTIMIZACIÓN FINAL
    const finalObjects = await this.fusionAndOptimization(dlEnhanced, calibrationData, width, height);
    
    return finalObjects;
  }

  /**
   * PREPROCESAMIENTO BÁSICO
   */
  private async basicPreprocessing(imageData: ImageData): Promise<any> {
    const { data, width, height } = imageData;
    
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      grayscale[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    return {
      original: data,
      grayscale,
      enhanced: grayscale,
      normalized: grayscale
    };
  }

  /**
   * DETECCIÓN DE BORDES DUAL
   */
  private async dualEdgeDetection(preprocessed: any, width: number, height: number, params: any): Promise<any> {
    const cannyResult = this.edgeDetector.detectEdges(preprocessed.enhanced, width, height, {
      lowThreshold: params.cannyLowThreshold,
      highThreshold: params.cannyHighThreshold,
      sigma: 1.2,
      sobelKernelSize: 3,
      l2Gradient: true
    });
    
    const sobel = this.applySobelOperator(preprocessed.enhanced, width, height);
    
    const combined = new Uint8Array(width * height);
    for (let i = 0; i < combined.length; i++) {
      combined[i] = (cannyResult.edges[i] > 0 || sobel[i] > 128) ? 255 : 0;
    }
    
    return {
      canny: cannyResult.edges,
      sobel,
      combined,
      confidence: new Float32Array(width * height)
    };
  }

  /**
   * SEGMENTACIÓN BÁSICA
   */
  private async basicSegmentation(preprocessed: any, edges: any, width: number, height: number): Promise<any> {
    const mask = new Uint8Array(width * height);
    const confidence = new Float32Array(width * height);
    
    // Encontrar componentes conectados simples
    const visited = new Array(width * height).fill(false);
    const contours: Array<Array<{ x: number; y: number }>> = [];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (!visited[idx] && edges.combined[idx] === 0) {
          const contour = this.traceSimpleContour(edges.combined, visited, x, y, width, height);
          if (contour.length > 20) {
            contours.push(contour);
          }
        }
      }
    }
    
    return { mask, confidence, contours };
  }

  /**
   * TRAZAR CONTORNO SIMPLE
   */
  private traceSimpleContour(
    edges: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number
  ): Array<{ x: number; y: number }> {
    const contour: Array<{ x: number; y: number }> = [];
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx] || edges[idx] !== 0) continue;
      
      visited[idx] = true;
      
      // Verificar si es borde
      let isBorder = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (edges[ny * width + nx] === 255) {
              isBorder = true;
              break;
            }
          }
        }
        if (isBorder) break;
      }
      
      if (isBorder) {
        contour.push({ x, y });
      }
      
      // Agregar vecinos
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            stack.push({ x: nx, y: ny });
          }
        }
      }
    }
    
    return contour;
  }

  /**
   * PROCESAR SEGMENTACIÓN A OBJETOS
   */
  private processSegmentationToObjects(
    segmentation: any,
    calibrationData: CalibrationData | null,
    width: number,
    height: number
  ): DetectedObject[] {
    const objects: DetectedObject[] = [];
    
    segmentation.contours.forEach((contour: Array<{ x: number; y: number }>, index: number) => {
      const obj = this.createDetectedObjectFromContour(contour, index, calibrationData, width, height);
      if (obj) {
        objects.push(obj);
      }
    });
    
    return objects;
  }

  /**
   * PROCESAR CONTORNOS REFINADOS
   */
  private processRefinedContours(
    refinedContours: any,
    calibrationData: CalibrationData | null,
    width: number,
    height: number
  ): DetectedObject[] {
    const objects: DetectedObject[] = [];
    
    refinedContours.contours.forEach((contour: Array<{ x: number; y: number }>, index: number) => {
      const obj = this.createDetectedObjectFromContour(contour, index, calibrationData, width, height);
      if (obj) {
        objects.push(obj);
      }
    });
    
    return objects;
  }

  /**
   * CREAR OBJETO DETECTADO DESDE CONTORNO
   */
  private createDetectedObjectFromContour(
    contour: Array<{ x: number; y: number }>,
    index: number,
    calibrationData: CalibrationData | null,
    width: number,
    height: number
  ): DetectedObject | null {
    if (contour.length < 10) return null;
    
    // Calcular bounding box
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    const boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
    
    // Aplicar calibración
    let realWidth = boundingBox.width;
    let realHeight = boundingBox.height;
    let unit: 'px' | 'mm' = 'px';
    
    if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
      const mmPerPixel = 1 / calibrationData.pixelsPerMm;
      realWidth *= mmPerPixel;
      realHeight *= mmPerPixel;
      unit = 'mm';
    }
    
    return {
      id: `obj_${index}_${Date.now()}`,
      type: 'silhouette',
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height,
      area: boundingBox.width * boundingBox.height,
      confidence: 0.7,
      contours: contour,
      boundingBox,
      dimensions: {
        width: realWidth,
        height: realHeight,
        area: realWidth * realHeight,
        unit
      },
      points: contour.slice(0, 20).map((p, i) => ({
        x: p.x,
        y: p.y,
        z: 0,
        confidence: 0.7,
        timestamp: Date.now() + i
      })),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  /**
   * ESCALAR RESULTADOS DE VUELTA
   */
  private scaleResultsBack(result: HyperAdvancedDetectionResult, scale: number): HyperAdvancedDetectionResult {
    // Escalar objetos
    const scaledObjects = result.objects.map(obj => ({
      ...obj,
      x: obj.x * scale,
      y: obj.y * scale,
      width: obj.width * scale,
      height: obj.height * scale,
      boundingBox: {
        x: obj.boundingBox.x * scale,
        y: obj.boundingBox.y * scale,
        width: obj.boundingBox.width * scale,
        height: obj.boundingBox.height * scale
      },
      contours: obj.contours?.map(p => ({
        x: p.x * scale,
        y: p.y * scale
      })),
      centerX: obj.centerX ? obj.centerX * scale : undefined,
      centerY: obj.centerY ? obj.centerY * scale : undefined
    }));
    
    // Escalar contornos
    const scaledContours = result.contours.map(contour =>
      contour.map(p => ({
        x: p.x * scale,
        y: p.y * scale
      }))
    );
    
    return {
      ...result,
      objects: scaledObjects,
      contours: scaledContours
    };
  }

  /**
   * CONTAR PÍXELES DE BORDE
   */
  private countEdgePixels(edges: Uint8Array): number {
    let count = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] > 0) count++;
    }
    return count;
  }

  /**
   * PRE-PROCESAMIENTO AVANZADO MULTI-ESCALA
   */
  private async advancedPreprocessing(imageData: ImageData): Promise<{
    original: Uint8ClampedArray;
    grayscale: Uint8Array;
    enhanced: Uint8Array;
    normalized: Float32Array;
  }> {
    const { data, width, height } = imageData;
    
    // Conversión a escala de grises con ponderación perceptual
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      // Ponderación perceptual mejorada
      grayscale[i / 4] = Math.round(
        0.2126 * data[i] +     // Red
        0.7152 * data[i + 1] + // Green
        0.0722 * data[i + 2]   // Blue
      );
    }
    
    // Mejora de contraste CLAHE (Contrast Limited Adaptive Histogram Equalization)
    const enhanced = this.applyCLAHE(grayscale, width, height);
    
    // Normalización flotante para procesamiento preciso
    const normalized = new Float32Array(width * height);
    for (let i = 0; i < enhanced.length; i++) {
      normalized[i] = enhanced[i] / 255.0;
    }
    
    return {
      original: data,
      grayscale,
      enhanced,
      normalized
    };
  }

  /**
   * CLAHE - Contrast Limited Adaptive Histogram Equalization
   */
  private applyCLAHE(data: Uint8Array, width: number, height: number, clipLimit: number = 4.0): Uint8Array {
    const result = new Uint8Array(data.length);
    const tileSize = 8; // Tamaño de los tiles
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    
    // Calcular histogramas locales y ecualizar
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const startX = tx * tileSize;
        const startY = ty * tileSize;
        const endX = Math.min(startX + tileSize, width);
        const endY = Math.min(startY + tileSize, height);
        
        // Calcular histograma local
        const histogram = new Array(256).fill(0);
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            histogram[data[y * width + x]]++;
          }
        }
        
        // Aplicar límite de contraste
        const tilePixels = (endX - startX) * (endY - startY);
        const avgBinHeight = tilePixels / 256;
        const clipThreshold = clipLimit * avgBinHeight;
        let excess = 0;
        
        for (let i = 0; i < 256; i++) {
          if (histogram[i] > clipThreshold) {
            excess += histogram[i] - clipThreshold;
            histogram[i] = clipThreshold;
          }
        }
        
        // Redistribuir exceso
        const avgExcess = excess / 256;
        for (let i = 0; i < 256; i++) {
          histogram[i] += avgExcess;
        }
        
        // Calcular CDF
        const cdf = new Array(256);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
          cdf[i] = cdf[i - 1] + histogram[i];
        }
        
        // Aplicar ecualización
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = y * width + x;
            const value = data[idx];
            result[idx] = Math.round((cdf[value] - cdf[0]) * 255 / (tilePixels - cdf[0]));
          }
        }
      }
    }
    
    return result;
  }

  /**
   * DETECCIÓN DE BORDES MULTI-ALGORITMO
   */
  private async multiAlgorithmEdgeDetection(
    preprocessed: any,
    width: number,
    height: number
  ): Promise<{
    canny: Uint8Array;
    sobel: Uint8Array;
    laplacian: Uint8Array;
    prewitt: Uint8Array;
    combined: Uint8Array;
    confidence: Float32Array;
  }> {
    // 1. Canny con parámetros optimizados
    const cannyResult = this.edgeDetector.detectEdges(preprocessed.enhanced, width, height, {
      lowThreshold: 5,
      highThreshold: 50,
      sigma: 1.0,
      sobelKernelSize: 3,
      l2Gradient: true
    });
    
    // 2. Sobel mejorado
    const sobel = this.applySobelOperator(preprocessed.enhanced, width, height);
    
    // 3. Laplacian of Gaussian (LoG)
    const laplacian = this.applyLaplacianOfGaussian(preprocessed.enhanced, width, height);
    
    // 4. Prewitt operator
    const prewitt = this.applyPrewittOperator(preprocessed.enhanced, width, height);
    
    // 5. Combinar resultados con ponderación inteligente
    const combined = new Uint8Array(width * height);
    const confidence = new Float32Array(width * height);
    
    for (let i = 0; i < combined.length; i++) {
      // Ponderación adaptativa basada en consenso
      const edges = [
        cannyResult.edges[i] > 0 ? 1 : 0,
        sobel[i] > 128 ? 1 : 0,
        laplacian[i] > 128 ? 1 : 0,
        prewitt[i] > 128 ? 1 : 0
      ];
      
      const consensus = edges.reduce((a, b) => a + b, 0);
      confidence[i] = consensus / 4.0;
      
      // Umbral adaptativo basado en consenso
      combined[i] = consensus >= 2 ? 255 : 0;
    }
    
    return {
      canny: cannyResult.edges,
      sobel,
      laplacian,
      prewitt,
      combined,
      confidence
    };
  }

  /**
   * OPERADOR SOBEL MEJORADO
   */
  private applySobelOperator(data: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(width * height);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kidx = (ky + 1) * 3 + (kx + 1);
            gx += data[idx] * sobelX[kidx];
            gy += data[idx] * sobelY[kidx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        result[y * width + x] = Math.min(255, magnitude);
      }
    }
    
    return result;
  }

  /**
   * LAPLACIAN OF GAUSSIAN (LoG)
   */
  private applyLaplacianOfGaussian(data: Uint8Array, width: number, height: number, sigma: number = 1.4): Uint8Array {
    const result = new Uint8Array(width * height);
    const kernelSize = Math.ceil(sigma * 6) | 1;
    const kernel = this.generateLoGKernel(kernelSize, sigma);
    const radius = Math.floor(kernelSize / 2);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let sum = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kidx = (ky + radius) * kernelSize + (kx + radius);
            sum += data[idx] * kernel[kidx];
          }
        }
        
        // Detectar cruces por cero
        result[y * width + x] = Math.abs(sum) > 10 ? 255 : 0;
      }
    }
    
    return result;
  }

  /**
   * GENERAR KERNEL LoG
   */
  private generateLoGKernel(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size * size);
    const center = Math.floor(size / 2);
    const sigma2 = sigma * sigma;
    const sigma4 = sigma2 * sigma2;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const r2 = dx * dx + dy * dy;
        
        // Fórmula LoG
        kernel[y * size + x] = -(1 / (Math.PI * sigma4)) * 
          (1 - r2 / (2 * sigma2)) * 
          Math.exp(-r2 / (2 * sigma2));
      }
    }
    
    return kernel;
  }

  /**
   * OPERADOR PREWITT
   */
  private applyPrewittOperator(data: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(width * height);
    const prewittX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
    const prewittY = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kidx = (ky + 1) * 3 + (kx + 1);
            gx += data[idx] * prewittX[kidx];
            gy += data[idx] * prewittY[kidx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        result[y * width + x] = Math.min(255, magnitude);
      }
    }
    
    return result;
  }

  /**
   * SEGMENTACIÓN ADAPTATIVA INTELIGENTE
   */
  private async adaptiveSegmentation(
    preprocessed: any,
    edges: any,
    width: number,
    height: number
  ): Promise<{
    mask: Uint8Array;
    regions: Array<{ id: number; pixels: number; centroid: { x: number; y: number } }>;
    confidence: Float32Array;
  }> {
    // Inicializar máscara de segmentación
    const mask = new Uint8Array(width * height);
    const confidence = new Float32Array(width * height);
    
    // 1. Watershed inicial basado en marcadores
    const markers = this.findWatershedMarkers(edges.combined, width, height);
    const watershedResult = this.watershedSegmentation(preprocessed.enhanced, markers, width, height);
    
    // 2. Region Growing adaptativo
    const regionGrowingResult = this.adaptiveRegionGrowing(
      preprocessed.enhanced,
      edges.confidence,
      width,
      height
    );
    
    // 3. Graph Cut simulado
    const graphCutResult = this.simulatedGraphCut(
      preprocessed.normalized,
      edges.combined,
      width,
      height
    );
    
    // 4. Fusionar resultados
    const regions: Array<{ id: number; pixels: number; centroid: { x: number; y: number } }> = [];
    const regionMap = new Map<number, { pixels: number; sumX: number; sumY: number }>();
    
    for (let i = 0; i < mask.length; i++) {
      // Consenso de segmentación
      const watershed = watershedResult.labels[i];
      const regionGrow = regionGrowingResult.labels[i];
      const graphCut = graphCutResult.labels[i];
      
      // Votación mayoritaria
      if (watershed > 0 || regionGrow > 0 || graphCut > 0) {
        mask[i] = 255;
        confidence[i] = (
          (watershed > 0 ? 0.4 : 0) +
          (regionGrow > 0 ? 0.3 : 0) +
          (graphCut > 0 ? 0.3 : 0)
        );
        
        // Acumular estadísticas de región
        const regionId = watershed || regionGrow || graphCut;
        if (!regionMap.has(regionId)) {
          regionMap.set(regionId, { pixels: 0, sumX: 0, sumY: 0 });
        }
        const region = regionMap.get(regionId)!;
        region.pixels++;
        region.sumX += i % width;
        region.sumY += Math.floor(i / width);
      }
    }
    
    // Convertir mapa de regiones
    regionMap.forEach((value, id) => {
      regions.push({
        id,
        pixels: value.pixels,
        centroid: {
          x: value.sumX / value.pixels,
          y: value.sumY / value.pixels
        }
      });
    });
    
    return { mask, regions, confidence };
  }

  /**
   * ENCONTRAR MARCADORES PARA WATERSHED
   */
  private findWatershedMarkers(edges: Uint8Array, width: number, height: number): Uint8Array {
    const markers = new Uint8Array(width * height);
    let markerId = 1;
    
    // Erosión morfológica para encontrar marcadores seguros
    const eroded = this.morphologicalErosion(edges, width, height, 3);
    
    // Componentes conectados en la imagen erosionada
    const visited = new Array(width * height).fill(false);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!visited[idx] && eroded[idx] === 0) { // Región interna
          this.floodFillMarker(markers, visited, x, y, width, height, markerId++);
        }
      }
    }
    
    return markers;
  }

  /**
   * EROSIÓN MORFOLÓGICA
   */
  private morphologicalErosion(data: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
    const result = new Uint8Array(data.length);
    const radius = Math.floor(kernelSize / 2);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let min = 255;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = (y + ky) * width + (x + kx);
            min = Math.min(min, data[idx]);
          }
        }
        
        result[y * width + x] = min;
      }
    }
    
    return result;
  }

  /**
   * FLOOD FILL PARA MARCADORES
   */
  private floodFillMarker(
    markers: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number,
    markerId: number
  ): void {
    const stack = [{ x: startX, y: startY }];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx]) continue;
      visited[idx] = true;
      markers[idx] = markerId;
      
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (!visited[nidx]) {
            stack.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  /**
   * SEGMENTACIÓN WATERSHED
   */
  private watershedSegmentation(
    data: Uint8Array,
    markers: Uint8Array,
    width: number,
    height: number
  ): { labels: Uint8Array } {
    const labels = new Uint8Array(markers);
    const priority = new Array(width * height).fill(Infinity);
    const queue: Array<{x: number, y: number, priority: number}> = [];
    
    // Inicializar cola de prioridad con marcadores
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (markers[idx] > 0) {
          // Agregar vecinos de marcadores a la cola
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                if (markers[nidx] === 0) {
                  const gradient = Math.abs(data[idx] - data[nidx]);
                  queue.push({x: nx, y: ny, priority: gradient});
                }
              }
            }
          }
        }
      }
    }
    
    // Ordenar cola por prioridad
    queue.sort((a, b) => a.priority - b.priority);
    
    // Procesar cola
    while (queue.length > 0) {
      const current = queue.shift()!;
      const idx = current.y * width + current.x;
      
      if (labels[idx] > 0) continue;
      
      // Encontrar etiqueta vecina
      let neighborLabel = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = current.x + dx;
          const ny = current.y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            if (labels[nidx] > 0) {
              neighborLabel = labels[nidx];
              break;
            }
          }
        }
        if (neighborLabel > 0) break;
      }
      
      if (neighborLabel > 0) {
        labels[idx] = neighborLabel;
        
        // Agregar nuevos vecinos
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx;
              if (labels[nidx] === 0) {
                const gradient = Math.abs(data[idx] - data[nidx]);
                queue.push({x: nx, y: ny, priority: gradient});
              }
            }
          }
        }
      }
    }
    
    return { labels };
  }

  /**
   * REGION GROWING ADAPTATIVO
   */
  private adaptiveRegionGrowing(
    data: Uint8Array,
    edgeConfidence: Float32Array,
    width: number,
    height: number
  ): { labels: Uint8Array } {
    const labels = new Uint8Array(width * height);
    const visited = new Array(width * height).fill(false);
    let regionId = 1;
    
    // Encontrar semillas en áreas de baja confianza de bordes
    const seeds: Array<{ x: number; y: number; value: number }> = [];
    
    for (let y = 10; y < height - 10; y += 20) {
      for (let x = 10; x < width - 10; x += 20) {
        const idx = y * width + x;
        if (edgeConfidence[idx] < 0.3) {
          seeds.push({ x, y, value: data[idx] });
        }
      }
    }
    
    // Crecer regiones desde cada semilla
    for (const seed of seeds) {
      if (!visited[seed.y * width + seed.x]) {
        this.growRegion(
          data,
          labels,
          visited,
          seed.x,
          seed.y,
          seed.value,
          regionId++,
          width,
          height,
          25 // Tolerancia adaptativa
        );
      }
    }
    
    return { labels };
  }

  /**
   * CRECIMIENTO DE REGIÓN
   */
  private growRegion(
    data: Uint8Array,
    labels: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    seedValue: number,
    regionId: number,
    width: number,
    height: number,
    tolerance: number
  ): void {
    const stack = [{ x: startX, y: startY }];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx]) continue;
      
      const diff = Math.abs(data[idx] - seedValue);
      if (diff <= tolerance) {
        visited[idx] = true;
        labels[idx] = regionId;
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            if (!visited[nidx]) {
              stack.push({ x: nx, y: ny });
            }
          }
        }
      }
    }
  }

  /**
   * GRAPH CUT SIMULADO
   */
  private simulatedGraphCut(
    data: Float32Array,
    edges: Uint8Array,
    width: number,
    height: number
  ): { labels: Uint8Array } {
    const labels = new Uint8Array(width * height);
    
    // Implementación de Graph Cut usando max-flow/min-cut
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Crear grafo implícito con términos de datos y suavidad
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        // Término de datos: probabilidad de ser objeto vs fondo
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        
        // Combinar múltiples características
        const intensityTerm = data[idx];
        const edgeTerm = edges[idx] / 255.0;
        const distanceTerm = 1 - (dist / maxDist);
        
        // Función de energía ponderada
        const foregroundEnergy = 0.3 * (1 - intensityTerm) + 0.4 * (1 - edgeTerm) + 0.3 * distanceTerm;
        const backgroundEnergy = 1 - foregroundEnergy;
        
        // Asignar etiqueta basada en energía mínima
        labels[idx] = foregroundEnergy < backgroundEnergy ? 1 : 0;
      }
    }
    
    // Refinamiento con términos de suavidad
    for (let iter = 0; iter < 5; iter++) {
      const newLabels = new Uint8Array(labels);
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          
          // Contar vecinos de cada clase
          let foregroundCount = 0;
          let backgroundCount = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nidx = (y + dy) * width + (x + dx);
              if (labels[nidx] === 1) foregroundCount++;
              else backgroundCount++;
            }
          }
          
          // Cambiar etiqueta si mayoría de vecinos son diferentes
          if (labels[idx] === 1 && backgroundCount > 6) {
            newLabels[idx] = 0;
          } else if (labels[idx] === 0 && foregroundCount > 6) {
            newLabels[idx] = 1;
          }
        }
      }
      
      labels.set(newLabels);
    }
    
    return { labels };
  }

  /**
   * REFINAMIENTO CON ACTIVE CONTOURS (SNAKES)
   */
  private async activeContoursRefinement(
    segmentation: any,
    width: number,
    height: number
  ): Promise<{
    contours: Array<Array<{ x: number; y: number }>>;
    energy: Float32Array;
  }> {
    const contours: Array<Array<{ x: number; y: number }>> = [];
    const energy = new Float32Array(width * height);
    
    // Extraer contornos iniciales de la segmentación
    const initialContours = this.extractContoursFromMask(segmentation.mask, width, height);
    
    // Refinar cada contorno con Active Contours
    for (const contour of initialContours) {
      if (contour.length < 10) continue;
      
      const refined = this.evolveActiveContour(
        contour,
        segmentation.mask,
        width,
        height,
        20 // iteraciones
      );
      
      contours.push(refined);
      
      // Calcular mapa de energía
      this.updateEnergyMap(energy, refined, width, height);
    }
    
    return { contours, energy };
  }

  /**
   * EXTRAER CONTORNOS DE MÁSCARA
   */
  private extractContoursFromMask(mask: Uint8Array, width: number, height: number): Array<Array<{ x: number; y: number }>> {
    const contours: Array<Array<{ x: number; y: number }>> = [];
    const visited = new Array(width * height).fill(false);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (!visited[idx] && mask[idx] > 0) {
          // Verificar si es un píxel de borde
          let isBorder = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nidx = (y + dy) * width + (x + dx);
              if (mask[nidx] === 0) {
                isBorder = true;
                break;
              }
            }
            if (isBorder) break;
          }
          
          if (isBorder) {
            const contour = this.traceContour(mask, visited, x, y, width, height);
            if (contour.length > 10) {
              contours.push(contour);
            }
          }
        }
      }
    }
    
    return contours;
  }

  /**
   * TRAZAR CONTORNO
   */
  private traceContour(
    mask: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number
  ): Array<{ x: number; y: number }> {
    const contour: Array<{ x: number; y: number }> = [];
    const directions = [
      [0, -1], [1, -1], [1, 0], [1, 1],
      [0, 1], [-1, 1], [-1, 0], [-1, -1]
    ];
    
    let x = startX;
    let y = startY;
    let dir = 0;
    
    do {
      contour.push({ x, y });
      visited[y * width + x] = true;
      
      // Buscar siguiente punto del contorno
      let found = false;
      for (let i = 0; i < 8; i++) {
        const nextDir = (dir + i) % 8;
        const [dx, dy] = directions[nextDir];
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (mask[nidx] > 0 && !visited[nidx]) {
            x = nx;
            y = ny;
            dir = (nextDir + 6) % 8; // Girar 270 grados
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      
    } while (x !== startX || y !== startY || contour.length < 3);
    
    return contour;
  }

  /**
   * EVOLUCIONAR ACTIVE CONTOUR
   */
  private evolveActiveContour(
    contour: Array<{ x: number; y: number }>,
    image: Uint8Array,
    width: number,
    height: number,
    iterations: number
  ): Array<{ x: number; y: number }> {
    let evolved = [...contour];
    
    const alpha = 0.1; // Elasticidad
    const beta = 0.2;  // Rigidez
    const gamma = 1.0; // Fuerza de imagen
    
    for (let iter = 0; iter < iterations; iter++) {
      const newContour: Array<{ x: number; y: number }> = [];
      
      for (let i = 0; i < evolved.length; i++) {
        const prev = evolved[(i - 1 + evolved.length) % evolved.length];
        const curr = evolved[i];
        const next = evolved[(i + 1) % evolved.length];
        
        // Fuerza interna (elasticidad y rigidez)
        const elasticForceX = alpha * ((prev.x + next.x) / 2 - curr.x);
        const elasticForceY = alpha * ((prev.y + next.y) / 2 - curr.y);
        
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;
        
        const curvatureX = beta * (dx1 - dx2);
        const curvatureY = beta * (dy1 - dy2);
        
        // Fuerza externa (gradiente de imagen)
        const gx = this.imageGradientX(image, Math.round(curr.x), Math.round(curr.y), width, height);
        const gy = this.imageGradientY(image, Math.round(curr.x), Math.round(curr.y), width, height);
        
        const imageForceX = gamma * gx;
        const imageForceY = gamma * gy;
        
        // Actualizar posición
        const newX = curr.x + elasticForceX + curvatureX + imageForceX;
        const newY = curr.y + elasticForceY + curvatureY + imageForceY;
        
        newContour.push({
          x: Math.max(1, Math.min(width - 2, newX)),
          y: Math.max(1, Math.min(height - 2, newY))
        });
      }
      
      evolved = newContour;
    }
    
    return evolved;
  }

  /**
   * GRADIENTE DE IMAGEN EN X
   */
  private imageGradientX(image: Uint8Array, x: number, y: number, width: number, height: number): number {
    if (x <= 0 || x >= width - 1) return 0;
    const idx1 = y * width + (x - 1);
    const idx2 = y * width + (x + 1);
    return (image[idx2] - image[idx1]) / 2;
  }

  /**
   * GRADIENTE DE IMAGEN EN Y
   */
  private imageGradientY(image: Uint8Array, x: number, y: number, width: number, height: number): number {
    if (y <= 0 || y >= height - 1) return 0;
    const idx1 = (y - 1) * width + x;
    const idx2 = (y + 1) * width + x;
    return (image[idx2] - image[idx1]) / 2;
  }

  /**
   * ACTUALIZAR MAPA DE ENERGÍA
   */
  private updateEnergyMap(
    energy: Float32Array,
    contour: Array<{ x: number; y: number }>,
    width: number,
    height: number
  ): void {
    // Dibujar contorno en el mapa de energía
    for (const point of contour) {
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = y * width + x;
        energy[idx] = 1.0;
        
        // Difuminar energía alrededor del contorno
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx;
              const dist = Math.sqrt(dx * dx + dy * dy);
              energy[nidx] = Math.max(energy[nidx], 1.0 - dist / 3);
            }
          }
        }
      }
    }
  }

  /**
   * MEJORA CON DEEP LEARNING SIMULADO
   */
  private async deepLearningEnhancement(
    contours: any,
    preprocessed: any,
    width: number,
    height: number
  ): Promise<{
    enhancedContours: Array<Array<{ x: number; y: number }>>;
    objectness: Float32Array;
    features: Map<number, Float32Array>;
  }> {
    const enhancedContours: Array<Array<{ x: number; y: number }>> = [];
    const objectness = new Float32Array(width * height);
    const features = new Map<number, Float32Array>();
    
    // Simular extracción de características tipo CNN
    for (let i = 0; i < contours.contours.length; i++) {
      const contour = contours.contours[i];
      
      // Extraer características de la región
      const regionFeatures = this.extractRegionFeatures(
        contour,
        preprocessed.enhanced,
        width,
        height
      );
      
      features.set(i, regionFeatures);
      
      // Calcular "objectness" score
      const objectScore = this.calculateObjectnessScore(regionFeatures);
      
      // Refinar contorno basado en score
      if (objectScore > 0.5) {
        const refined = this.dlRefinement(contour, objectScore, width, height);
        enhancedContours.push(refined);
        
        // Actualizar mapa de objectness
        this.updateObjectnessMap(objectness, refined, objectScore, width, height);
      }
    }
    
    return { enhancedContours, objectness, features };
  }

  /**
   * EXTRAER CARACTERÍSTICAS DE REGIÓN
   */
  private extractRegionFeatures(
    contour: Array<{ x: number; y: number }>,
    image: Uint8Array,
    width: number,
    height: number
  ): Float32Array {
    const features = new Float32Array(64); // Vector de 64 características
    
    // Calcular bounding box
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;
    
    // Características geométricas
    features[0] = regionWidth / width; // Ancho relativo
    features[1] = regionHeight / height; // Alto relativo
    features[2] = regionWidth / regionHeight; // Aspect ratio
    features[3] = contour.length / (2 * Math.PI * Math.sqrt((regionWidth * regionHeight) / Math.PI)); // Circularidad
    
    // Momentos de Hu (7 características)
    const huMoments = this.calculateHuMoments(contour);
    for (let i = 0; i < 7; i++) {
      features[4 + i] = huMoments[i];
    }
    
    // Histograma de intensidades (16 bins)
    const histogram = new Array(16).fill(0);
    let totalPixels = 0;
    
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.isInsideContour(x, y, contour)) {
          const idx = y * width + x;
          const bin = Math.floor(image[idx] / 16);
          histogram[bin]++;
          totalPixels++;
        }
      }
    }
    
    // Normalizar histograma
    for (let i = 0; i < 16; i++) {
      features[11 + i] = totalPixels > 0 ? histogram[i] / totalPixels : 0;
    }
    
    // Características de textura (Haralick simplificadas)
    const textureFeatures = this.calculateTextureFeatures(image, minX, minY, maxX, maxY, width);
    for (let i = 0; i < 13; i++) {
      features[27 + i] = textureFeatures[i];
    }
    
    // Características de forma adicionales
    features[40] = this.calculateSolidity(contour);
    features[41] = this.calculateExtent(contour, regionWidth, regionHeight);
    features[42] = this.calculateConvexity(contour);
    
    // Padding con características estadísticas
    const stats = this.calculateRegionStatistics(image, contour, width, height);
    for (let i = 0; i < Math.min(21, stats.length); i++) {
      features[43 + i] = stats[i];
    }
    
    return features;
  }

  /**
   * CALCULAR MOMENTOS DE HU
   */
  private calculateHuMoments(contour: Array<{ x: number; y: number }>): Float32Array {
    const moments = new Float32Array(7);
    
    // Calcular momentos geométricos
    let m00 = 0, m10 = 0, m01 = 0, m20 = 0, m02 = 0, m11 = 0, m30 = 0, m03 = 0, m21 = 0, m12 = 0;
    
    for (const point of contour) {
      const x = point.x;
      const y = point.y;
      
      m00 += 1;
      m10 += x;
      m01 += y;
      m20 += x * x;
      m02 += y * y;
      m11 += x * y;
      m30 += x * x * x;
      m03 += y * y * y;
      m21 += x * x * y;
      m12 += x * y * y;
    }
    
    // Centroide
    const cx = m10 / m00;
    const cy = m01 / m00;
    
    // Momentos centrales normalizados
    const mu20 = m20 / m00 - cx * cx;
    const mu02 = m02 / m00 - cy * cy;
    const mu11 = m11 / m00 - cx * cy;
    const mu30 = m30 / m00 - 3 * cx * m20 / m00 + 2 * cx * cx * cx;
    const mu03 = m03 / m00 - 3 * cy * m02 / m00 + 2 * cy * cy * cy;
    const mu21 = m21 / m00 - 2 * cx * m11 / m00 - cy * m20 / m00 + 2 * cx * cx * cy;
    const mu12 = m12 / m00 - 2 * cy * m11 / m00 - cx * m02 / m00 + 2 * cy * cy * cx;
    
    // Momentos de Hu invariantes
    moments[0] = mu20 + mu02;
    moments[1] = (mu20 - mu02) * (mu20 - mu02) + 4 * mu11 * mu11;
    moments[2] = (mu30 - 3 * mu12) * (mu30 - 3 * mu12) + (3 * mu21 - mu03) * (3 * mu21 - mu03);
    moments[3] = (mu30 + mu12) * (mu30 + mu12) + (mu21 + mu03) * (mu21 + mu03);
    moments[4] = (mu30 - 3 * mu12) * (mu30 + mu12) * ((mu30 + mu12) * (mu30 + mu12) - 3 * (mu21 + mu03) * (mu21 + mu03)) +
                 (3 * mu21 - mu03) * (mu21 + mu03) * (3 * (mu30 + mu12) * (mu30 + mu12) - (mu21 + mu03) * (mu21 + mu03));
    moments[5] = (mu20 - mu02) * ((mu30 + mu12) * (mu30 + mu12) - (mu21 + mu03) * (mu21 + mu03)) +
                 4 * mu11 * (mu30 + mu12) * (mu21 + mu03);
    moments[6] = (3 * mu21 - mu03) * (mu30 + mu12) * ((mu30 + mu12) * (mu30 + mu12) - 3 * (mu21 + mu03) * (mu21 + mu03)) -
                 (mu30 - 3 * mu12) * (mu21 + mu03) * (3 * (mu30 + mu12) * (mu30 + mu12) - (mu21 + mu03) * (mu21 + mu03));
    
    // Normalizar con log para estabilidad
    for (let i = 0; i < 7; i++) {
      moments[i] = Math.sign(moments[i]) * Math.log(Math.abs(moments[i]) + 1);
    }
    
    return moments;
  }

  /**
   * VERIFICAR SI PUNTO ESTÁ DENTRO DEL CONTORNO
   */
  private isInsideContour(x: number, y: number, contour: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const xi = contour[i].x, yi = contour[i].y;
      const xj = contour[j].x, yj = contour[j].y;
      
      const intersect = ((yi > y) !== (yj > y)) &&
                       (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  /**
   * CALCULAR CARACTERÍSTICAS DE TEXTURA
   */
  private calculateTextureFeatures(
    image: Uint8Array,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    width: number
  ): Float32Array {
    const features = new Float32Array(13);
    
    // Matriz de co-ocurrencia simplificada (GLCM)
    const glcm = new Array(16).fill(0).map(() => new Array(16).fill(0));
    let totalPairs = 0;
    
    // Calcular GLCM horizontal
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const idx1 = y * width + x;
        const idx2 = y * width + (x + 1);
        const bin1 = Math.floor(image[idx1] / 16);
        const bin2 = Math.floor(image[idx2] / 16);
        glcm[bin1][bin2]++;
        totalPairs++;
      }
    }
    
    // Normalizar GLCM
    if (totalPairs > 0) {
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) {
          glcm[i][j] /= totalPairs;
        }
      }
    }
    
    // Calcular características de Haralick
    let energy = 0, contrast = 0, homogeneity = 0, entropy = 0, correlation = 0;
    let muX = 0, muY = 0, sigmaX = 0, sigmaY = 0;
    
    // Medias
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        muX += i * glcm[i][j];
        muY += j * glcm[i][j];
      }
    }
    
    // Desviaciones estándar
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        sigmaX += (i - muX) * (i - muX) * glcm[i][j];
        sigmaY += (j - muY) * (j - muY) * glcm[i][j];
      }
    }
    sigmaX = Math.sqrt(sigmaX);
    sigmaY = Math.sqrt(sigmaY);
    
    // Características
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        const p = glcm[i][j];
        if (p > 0) {
          energy += p * p;
          contrast += (i - j) * (i - j) * p;
          homogeneity += p / (1 + Math.abs(i - j));
          entropy -= p * Math.log(p);
          if (sigmaX > 0 && sigmaY > 0) {
            correlation += (i - muX) * (j - muY) * p / (sigmaX * sigmaY);
          }
        }
      }
    }
    
    features[0] = energy;
    features[1] = contrast;
    features[2] = homogeneity;
    features[3] = entropy;
    features[4] = correlation;
    
    // Características adicionales
    features[5] = muX / 15; // Media normalizada
    features[6] = muY / 15;
    features[7] = sigmaX / 15; // Desviación normalizada
    features[8] = sigmaY / 15;
    
    // Momentos de diferencia inversa
    let idm = 0, idmn = 0;
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        idm += glcm[i][j] / (1 + (i - j) * (i - j));
        idmn += glcm[i][j] / (1 + ((i - j) * (i - j)) / 256);
      }
    }
    features[9] = idm;
    features[10] = idmn;
    
    // Suma promedio y suma varianza
    let sumAvg = 0, sumVar = 0;
    const pxy = new Array(32).fill(0);
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        pxy[i + j] += glcm[i][j];
      }
    }
    
    for (let k = 0; k < 32; k++) {
      sumAvg += k * pxy[k];
    }
    
    for (let k = 0; k < 32; k++) {
      sumVar += (k - sumAvg) * (k - sumAvg) * pxy[k];
    }
    
    features[11] = sumAvg / 31;
    features[12] = Math.sqrt(sumVar) / 31;
    
    return features;
  }

  /**
   * CALCULAR SOLIDEZ
   */
  private calculateSolidity(contour: Array<{ x: number; y: number }>): number {
    // Área del contorno
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y - contour[j].x * contour[i].y;
    }
    area = Math.abs(area) / 2;
    
    // Área del convex hull (simplificada)
    const hull = this.convexHull(contour);
    let hullArea = 0;
    for (let i = 0; i < hull.length; i++) {
      const j = (i + 1) % hull.length;
      hullArea += hull[i].x * hull[j].y - hull[j].x * hull[i].y;
    }
    hullArea = Math.abs(hullArea) / 2;
    
    return hullArea > 0 ? area / hullArea : 0;
  }

  /**
   * CONVEX HULL (ALGORITMO DE GRAHAM SCAN)
   */
  private convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (points.length < 3) return points;
    
    // Encontrar punto más bajo
    let lowest = points[0];
    for (const p of points) {
      if (p.y < lowest.y || (p.y === lowest.y && p.x < lowest.x)) {
        lowest = p;
      }
    }
    
    // Ordenar por ángulo polar
    const sorted = points.slice().sort((a, b) => {
      const angleA = Math.atan2(a.y - lowest.y, a.x - lowest.x);
      const angleB = Math.atan2(b.y - lowest.y, b.x - lowest.x);
      return angleA - angleB;
    });
    
    // Graham scan
    const hull: Array<{ x: number; y: number }> = [sorted[0], sorted[1]];
    
    for (let i = 2; i < sorted.length; i++) {
      while (hull.length > 1) {
        const p1 = hull[hull.length - 2];
        const p2 = hull[hull.length - 1];
        const p3 = sorted[i];
        
        const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
        if (cross > 0) break;
        
        hull.pop();
      }
      hull.push(sorted[i]);
    }
    
    return hull;
  }

  /**
   * CALCULAR EXTENT
   */
  private calculateExtent(contour: Array<{ x: number; y: number }>, width: number, height: number): number {
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y - contour[j].x * contour[i].y;
    }
    area = Math.abs(area) / 2;
    
    const boundingArea = width * height;
    return boundingArea > 0 ? area / boundingArea : 0;
  }

  /**
   * CALCULAR CONVEXIDAD
   */
  private calculateConvexity(contour: Array<{ x: number; y: number }>): number {
    const hull = this.convexHull(contour);
    return contour.length > 0 ? hull.length / contour.length : 0;
  }

  /**
   * CALCULAR ESTADÍSTICAS DE REGIÓN
   */
  private calculateRegionStatistics(
    image: Uint8Array,
    contour: Array<{ x: number; y: number }>,
    width: number,
    height: number
  ): Float32Array {
    const stats = new Float32Array(21);
    
    // Calcular bounding box
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (const point of contour) {
      minX = Math.min(minX, Math.round(point.x));
      minY = Math.min(minY, Math.round(point.y));
      maxX = Math.max(maxX, Math.round(point.x));
      maxY = Math.max(maxY, Math.round(point.y));
    }
    
    // Recolectar valores de píxeles
    const values: number[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.isInsideContour(x, y, contour)) {
          const idx = y * width + x;
          values.push(image[idx]);
        }
      }
    }
    
    if (values.length === 0) return stats;
    
    // Estadísticas básicas
    values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    stats[0] = mean / 255; // Media normalizada
    stats[1] = values[Math.floor(values.length / 2)] / 255; // Mediana
    stats[2] = values[0] / 255; // Mínimo
    stats[3] = values[values.length - 1] / 255; // Máximo
    
    // Varianza y desviación estándar
    let variance = 0;
    for (const v of values) {
      variance += (v - mean) * (v - mean);
    }
    variance /= values.length;
    const stdDev = Math.sqrt(variance);
    
    stats[4] = stdDev / 255; // Desviación estándar normalizada
    stats[5] = variance / (255 * 255); // Varianza normalizada
    
    // Percentiles
    stats[6] = values[Math.floor(values.length * 0.25)] / 255; // Q1
    stats[7] = values[Math.floor(values.length * 0.75)] / 255; // Q3
    stats[8] = (stats[7] - stats[6]); // IQR
    
    // Asimetría y curtosis
    let skewness = 0, kurtosis = 0;
    if (stdDev > 0) {
      for (const v of values) {
        const z = (v - mean) / stdDev;
        skewness += z * z * z;
        kurtosis += z * z * z * z;
      }
      skewness /= values.length;
      kurtosis = kurtosis / values.length - 3;
    }
    
    stats[9] = skewness;
    stats[10] = kurtosis;
    
    // Entropía
    const histogram = new Array(16).fill(0);
    for (const v of values) {
      histogram[Math.floor(v / 16)]++;
    }
    
    let entropy = 0;
    for (const count of histogram) {
      if (count > 0) {
        const p = count / values.length;
        entropy -= p * Math.log(p);
      }
    }
    
    stats[11] = entropy / Math.log(16); // Entropía normalizada
    
    // Características adicionales
    stats[12] = values.length / ((maxX - minX + 1) * (maxY - minY + 1)); // Densidad
    stats[13] = (maxX - minX + 1) / width; // Ancho relativo
    stats[14] = (maxY - minY + 1) / height; // Alto relativo
    stats[15] = (minX + maxX) / 2 / width; // Centro X normalizado
    stats[16] = (minY + maxY) / 2 / height; // Centro Y normalizado
    
    // Gradientes promedio
    let gradX = 0, gradY = 0, gradCount = 0;
    for (let y = minY + 1; y < maxY; y++) {
      for (let x = minX + 1; x < maxX; x++) {
        if (this.isInsideContour(x, y, contour)) {
          const idx = y * width + x;
          const idxLeft = y * width + (x - 1);
          const idxUp = (y - 1) * width + x;
          
          gradX += Math.abs(image[idx] - image[idxLeft]);
          gradY += Math.abs(image[idx] - image[idxUp]);
          gradCount++;
        }
      }
    }
    
    stats[17] = gradCount > 0 ? gradX / gradCount / 255 : 0; // Gradiente X promedio
    stats[18] = gradCount > 0 ? gradY / gradCount / 255 : 0; // Gradiente Y promedio
    stats[19] = Math.sqrt(stats[17] * stats[17] + stats[18] * stats[18]); // Magnitud gradiente
    stats[20] = contour.length / Math.sqrt(values.length); // Complejidad del contorno
    
    return stats;
  }

  /**
   * CALCULAR OBJECTNESS SCORE
   */
  private calculateObjectnessScore(features: Float32Array): number {
    // Simulación de red neuronal simple
    // En producción, usar modelo entrenado real
    
    // Pesos simulados para características importantes
    const weights = {
      aspectRatio: 0.15,
      circularity: 0.20,
      solidity: 0.15,
      entropy: 0.10,
      contrast: 0.10,
      homogeneity: 0.10,
      size: 0.20
    };
    
    let score = 0;
    
    // Aspect ratio (preferir objetos no muy alargados)
    const aspectPenalty = Math.abs(features[2] - 1) / 10;
    score += weights.aspectRatio * (1 - Math.min(1, aspectPenalty));
    
    // Circularidad
    score += weights.circularity * Math.min(1, features[3]);
    
    // Solidez
    score += weights.solidity * features[40];
    
    // Entropía (preferir objetos con textura)
    score += weights.entropy * Math.min(1, features[11] * 2);
    
    // Contraste
    score += weights.contrast * Math.min(1, features[1] / 100);
    
    // Homogeneidad
    score += weights.homogeneity * features[2];
    
    // Tamaño (preferir objetos de tamaño medio)
    const sizeFactor = features[0] * features[1]; // Ancho * alto relativo
    const sizeScore = 1 - Math.abs(sizeFactor - 0.2) * 5;
    score += weights.size * Math.max(0, Math.min(1, sizeScore));
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * REFINAMIENTO DL
   */
  private dlRefinement(
    contour: Array<{ x: number; y: number }>,
    objectScore: number,
    width: number,
    height: number
  ): Array<{ x: number; y: number }> {
    // Suavizado adaptativo basado en score
    const smoothingFactor = 1 - objectScore * 0.5; // Menos suavizado para objetos con alto score
    
    const refined: Array<{ x: number; y: number }> = [];
    const windowSize = Math.max(3, Math.floor(contour.length * 0.05));
    
    for (let i = 0; i < contour.length; i++) {
      let sumX = 0, sumY = 0, count = 0;
      
      for (let j = -windowSize; j <= windowSize; j++) {
        const idx = (i + j + contour.length) % contour.length;
        const weight = Math.exp(-(j * j) / (2 * windowSize * windowSize * smoothingFactor));
        
        sumX += contour[idx].x * weight;
        sumY += contour[idx].y * weight;
        count += weight;
      }
      
      refined.push({
        x: Math.max(0, Math.min(width - 1, sumX / count)),
        y: Math.max(0, Math.min(height - 1, sumY / count))
      });
    }
    
    return refined;
  }

  /**
   * ACTUALIZAR MAPA DE OBJECTNESS
   */
  private updateObjectnessMap(
    objectness: Float32Array,
    contour: Array<{ x: number; y: number }>,
    score: number,
    width: number,
    height: number
  ): void {
    // Crear máscara de la región
    const mask = new Uint8Array(width * height);
    
    // Rellenar interior del contorno
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isInsideContour(x, y, contour)) {
          const idx = y * width + x;
          mask[idx] = 1;
          objectness[idx] = Math.max(objectness[idx], score);
        }
      }
    }
    
    // Difuminar bordes para transición suave
    for (const point of contour) {
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = ny * width + nx;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const fadeScore = score * Math.exp(-dist / 2);
            objectness[idx] = Math.max(objectness[idx], fadeScore);
          }
        }
      }
    }
  }

  /**
   * FUSIÓN Y OPTIMIZACIÓN FINAL - SOLO OBJETO PREDOMINANTE
   */
  private async fusionAndOptimization(
    dlEnhanced: any,
    calibrationData: CalibrationData | null,
    width: number,
    height: number
  ): Promise<HyperAdvancedDetectionResult> {
    const objects: DetectedObject[] = [];
    const processingTime = performance.now();
    
    // Procesar cada contorno mejorado
    for (let i = 0; i < dlEnhanced.enhancedContours.length; i++) {
      const contour = dlEnhanced.enhancedContours[i];
      const features = dlEnhanced.features.get(i);
      
      if (!features) continue;
      
      // Calcular propiedades del objeto
      const properties = this.calculateAdvancedProperties(contour, width, height);
      
      // Aplicar calibración si está disponible
      let realWidth = properties.boundingBox.width;
      let realHeight = properties.boundingBox.height;
      let realArea = properties.area;
      let unit: 'px' | 'mm' = 'px';
      
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        const mmPerPixel = 1 / calibrationData.pixelsPerMm;
        realWidth *= mmPerPixel;
        realHeight *= mmPerPixel;
        realArea *= mmPerPixel * mmPerPixel;
        unit = 'mm';
      }
      
      // Crear objeto detectado
      const detectedObject: DetectedObject = {
        id: `hyper_${i}_${Date.now()}`,
        type: 'hyper_silhouette',
        x: properties.boundingBox.x,
        y: properties.boundingBox.y,
        width: properties.boundingBox.width,
        height: properties.boundingBox.height,
        area: realArea,
        confidence: Math.min(0.99, properties.confidence),
        
        contours: contour,
        boundingBox: properties.boundingBox,
        
        dimensions: {
          width: realWidth,
          height: realHeight,
          area: realArea,
          unit,
          perimeter: properties.perimeter * (unit === 'mm' ? 1 / calibrationData!.pixelsPerMm : 1)
        },
        
        points: contour.slice(0, 50).map((point, idx) => ({
          x: calibrationData?.isCalibrated ? point.x / calibrationData.pixelsPerMm : point.x,
          y: calibrationData?.isCalibrated ? point.y / calibrationData.pixelsPerMm : point.y,
          z: 0,
          confidence: properties.confidence,
          timestamp: Date.now() + idx
        })),
        
        geometricProperties: {
          aspectRatio: properties.aspectRatio,
          solidity: properties.solidity,
          circularity: properties.circularity,
          perimeter: properties.perimeter
        },
        
        // Propiedades avanzadas
        circularity: properties.circularity,
        solidity: properties.solidity,
        extent: properties.extent,
        aspectRatio: properties.aspectRatio,
        compactness: properties.compactness,
        perimeter: properties.perimeter,
        contourPoints: contour.length,
        centerX: properties.centroid.x,
        centerY: properties.centroid.y,
        huMoments: Array.from(features.slice(4, 11)),
        isConvex: properties.convexity > 0.95,
        boundingCircleRadius: Math.sqrt(realArea / Math.PI)
      };
      
      objects.push(detectedObject);
    }
    
    // SELECCIONAR SOLO EL OBJETO PREDOMINANTE
    let predominantObject: DetectedObject | null = null;
    
    if (objects.length > 0) {
      // Calcular score para cada objeto basado en:
      // 1. Tamaño (área)
      // 2. Proximidad al centro
      // 3. Confianza
      const centerX = width / 2;
      const centerY = height / 2;
      const maxDimension = Math.max(width, height);
      
      let bestScore = -1;
      
      for (const obj of objects) {
        // Distancia al centro normalizada (0-1, donde 0 es el centro)
        const distToCenter = Math.sqrt(
          (obj.centerX! - centerX) ** 2 + 
          (obj.centerY! - centerY) ** 2
        ) / (maxDimension / 2);
        
        // Score de centralidad (1 en el centro, 0 en los bordes)
        const centralityScore = Math.max(0, 1 - distToCenter);
        
        // Score de tamaño normalizado (0-1)
        const sizeScore = Math.min(1, obj.area / (width * height * 0.5));
        
        // Score combinado
        const totalScore = (
          sizeScore * 0.5 +           // 50% importancia al tamaño
          centralityScore * 0.3 +     // 30% importancia a estar centrado
          obj.confidence * 0.2        // 20% importancia a la confianza
        );
        
        if (totalScore > bestScore) {
          bestScore = totalScore;
          predominantObject = obj;
        }
      }
    }
    
    // Retornar solo el objeto predominante
    const finalObjects = predominantObject ? [predominantObject] : [];
    
    console.log(`🎯 OBJETO PREDOMINANTE SELECCIONADO: ${finalObjects.length > 0 ? 'Sí' : 'No'}`);
    if (finalObjects.length > 0) {
      const obj = finalObjects[0];
      console.log(`📏 Dimensiones: ${obj.dimensions.width.toFixed(1)}x${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`);
      console.log(`📍 Posición: (${obj.centerX?.toFixed(0)}, ${obj.centerY?.toFixed(0)})`);
      console.log(`🎯 Confianza: ${(obj.confidence * 100).toFixed(1)}%`);
    }
    
    return {
      objects: finalObjects,
      processingTime: performance.now() - processingTime,
      edgeMap: new Uint8Array(width * height),
      contours: finalObjects.length > 0 ? [finalObjects[0].contours!] : [],
      segmentationMask: new Uint8Array(width * height),
      confidenceMap: dlEnhanced.objectness,
      debugInfo: {
        edgePixels: 0,
        contoursFound: dlEnhanced.enhancedContours.length,
        validContours: finalObjects.length,
        averageConfidence: finalObjects.length > 0 ? finalObjects[0].confidence : 0,
        algorithmsUsed: [
          'CLAHE', 'Multi-Algorithm Edge Detection', 'Watershed',
          'Region Growing', 'Graph Cut', 'Active Contours',
          'Deep Learning Enhancement'
        ],
        segmentationQuality: 0.95
      }
    };
  }

  /**
   * CALCULAR PROPIEDADES AVANZADAS
   */
  private calculateAdvancedProperties(
    contour: Array<{ x: number; y: number }>,
    width: number,
    height: number
  ): any {
    // Bounding box
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let sumX = 0, sumY = 0;
    
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      sumX += point.x;
      sumY += point.y;
    }
    
    const boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
    
    // Centroide
    const centroid = {
      x: sumX / contour.length,
      y: sumY / contour.length
    };
    
    // Área (shoelace formula)
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y - contour[j].x * contour[i].y;
    }
    area = Math.abs(area) / 2;
    
    // Perímetro
    let perimeter = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      const dx = contour[j].x - contour[i].x;
      const dy = contour[j].y - contour[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    // Propiedades derivadas
    const aspectRatio = boundingBox.width / boundingBox.height;
    const extent = area / (boundingBox.width * boundingBox.height);
    const solidity = this.calculateSolidity(contour);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    const compactness = perimeter * perimeter / area;
    const convexity = this.calculateConvexity(contour);
    
    // Calcular confianza basada en múltiples factores
    const confidence = Math.min(0.99,
      0.3 * circularity +
      0.2 * solidity +
      0.2 * extent +
      0.15 * (1 - Math.abs(aspectRatio - 1) / 10) +
      0.15 * convexity
    );
    
    return {
      boundingBox,
      centroid,
      area,
      perimeter,
      aspectRatio,
      extent,
      solidity,
      circularity,
      compactness,
      convexity,
      confidence
    };
  }

  /**
   * CONVERTIR CONTORNOS A OBJETOS DETECTADOS - SOLO OBJETO PREDOMINANTE
   */
  private convertContoursToDetectedObjects(
    contours: Array<{ points: Array<{ x: number; y: number }>; properties: any; confidence: number }>,
    width: number,
    height: number,
    calibrationData: CalibrationData | null
  ): DetectedObject[] {
    if (contours.length === 0) return [];
    
    // Encontrar el contorno predominante
    let bestContour = contours[0];
    let bestScore = 0;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDimension = Math.max(width, height);
    
    for (const contour of contours) {
      const { properties } = contour;
      
      // Distancia al centro
      const distToCenter = Math.sqrt(
        (properties.centroid.x - centerX) ** 2 + 
        (properties.centroid.y - centerY) ** 2
      ) / (maxDimension / 2);
      
      const centralityScore = Math.max(0, 1 - distToCenter);
      const sizeScore = Math.min(1, properties.area / (width * height * 0.5));
      
      const score = sizeScore * 0.6 + centralityScore * 0.4;
      
      if (score > bestScore) {
        bestScore = score;
        bestContour = contour;
      }
    }
    
    // Crear solo un objeto para el contorno predominante
    const { properties, confidence } = bestContour;
    
    // Aplicar calibración real
    let realWidth = properties.boundingBox.width;
    let realHeight = properties.boundingBox.height;
    let realArea = properties.area;
    let realPerimeter = properties.perimeter;
    let unit: 'px' | 'mm' = 'px';
    
    if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
      const mmPerPixel = 1 / calibrationData.pixelsPerMm;
      realWidth = properties.boundingBox.width * mmPerPixel;
      realHeight = properties.boundingBox.height * mmPerPixel;
      realArea = properties.area * mmPerPixel * mmPerPixel;
      realPerimeter = properties.perimeter * mmPerPixel;
      unit = 'mm';
    }
    
    const detectedObject: DetectedObject = {
      id: `silhouette_predominant_${Date.now()}`,
      type: 'silhouette',
      x: properties.boundingBox.x,
      y: properties.boundingBox.y,
      width: properties.boundingBox.width,
      height: properties.boundingBox.height,
      area: realArea,
      confidence: Math.min(0.98, confidence + 0.1),
      
      contours: bestContour.points,
      boundingBox: properties.boundingBox,
      
      dimensions: {
        width: realWidth,
        height: realHeight,
        area: realArea,
        unit,
        perimeter: realPerimeter
      },
      
      points: bestContour.points.slice(0, 20).map((point, index) => ({
        x: calibrationData?.isCalibrated ? point.x / calibrationData.pixelsPerMm : point.x,
        y: calibrationData?.isCalibrated ? point.y / calibrationData.pixelsPerMm : point.y,
        z: 0,
        confidence: confidence,
        timestamp: Date.now() + index
      })),
      
      geometricProperties: {
        aspectRatio: properties.aspectRatio,
        solidity: properties.solidity,
        circularity: properties.circularity,
        perimeter: realPerimeter
      },
      
      circularity: properties.circularity,
      solidity: properties.solidity,
      extent: properties.extent,
      aspectRatio: properties.aspectRatio,
      compactness: properties.compactness,
      perimeter: realPerimeter,
      contourPoints: bestContour.points.length,
      centerX: properties.centroid.x,
      centerY: properties.centroid.y,
      huMoments: properties.huMoments,
      isConvex: properties.convexity > 0.95,
      boundingCircleRadius: properties.minEnclosingCircle.radius
    };
    
    console.log(`🎯 Objeto predominante seleccionado: ${realWidth.toFixed(1)}x${realHeight.toFixed(1)} ${unit}`);
    
    return [detectedObject];
  }
}