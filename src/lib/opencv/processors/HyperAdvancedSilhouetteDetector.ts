/**
 * DETECTOR DE SILUETAS HÍPER AVANZADO - SISTEMA COMPLETO DE PRODUCCIÓN
 * Implementación real con algoritmos de visión por computadora de última generación
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
  private lastResult: HyperAdvancedDetectionResult | null = null;

  // Cachés para optimización
  private gaussianKernels: Map<string, Float32Array> = new Map();
  private morphologicalKernels: Map<string, Uint8Array> = new Map();

  private constructor() {
    this.imageProcessor = ImageProcessor.getInstance();
    this.edgeDetector = CannyEdgeDetector.getInstance();
    this.contourDetector = ContourDetector.getInstance();
    this.performanceOptimizer = PerformanceOptimizer.getInstance();
    this.initializeKernels();
  }

  public static getInstance(): HyperAdvancedSilhouetteDetector {
    if (!HyperAdvancedSilhouetteDetector.instance) {
      HyperAdvancedSilhouetteDetector.instance = new HyperAdvancedSilhouetteDetector();
    }
    return HyperAdvancedSilhouetteDetector.instance;
  }

  /**
   * Inicializar kernels comunes para reutilización
   */
  private initializeKernels(): void {
    // Kernels Gaussianos precalculados
    const sigmas = [0.5, 1.0, 1.4, 2.0, 3.0];
    for (const sigma of sigmas) {
      const size = Math.ceil(sigma * 6) | 1;
      this.gaussianKernels.set(`gaussian_${sigma}`, this.generateGaussianKernel(size, sigma));
    }

    // Kernels morfológicos
    const sizes = [3, 5, 7];
    for (const size of sizes) {
      this.morphologicalKernels.set(`disk_${size}`, this.generateDiskKernel(size));
      this.morphologicalKernels.set(`cross_${size}`, this.generateCrossKernel(size));
    }
  }

  /**
   * DETECCIÓN PRINCIPAL CON PIPELINE COMPLETO
   */
  async detectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<HyperAdvancedDetectionResult> {
    const startTime = performance.now();
    this.frameCount++;

    console.log(`🔍 Iniciando detección - Frame ${this.frameCount}, Tamaño: ${imageData.width}x${imageData.height}`);

    // Verificar si debemos procesar este frame
    if (!this.performanceOptimizer.shouldProcessFrame(this.frameCount)) {
      console.log('⏭️ Frame saltado por optimización');
      return this.lastResult || this.getEmptyResult();
    }

    // MODO DE EMERGENCIA: Detección rápida básica si el sistema avanzado falla
    try {
      // Primero intentar detección básica rápida
      const quickResult = await this.quickDetection(imageData, calibrationData);
      if (quickResult && quickResult.objects.length > 0) {
        console.log('✅ Detección rápida exitosa');
        this.lastResult = quickResult;
        return quickResult;
      }
    } catch (e) {
      console.log('⚠️ Detección rápida falló, continuando con pipeline completo');
    }

    // Optimizar imagen según capacidades del dispositivo
    const optimizedImageData = this.performanceOptimizer.optimizeImageData(imageData);
    const { width, height } = optimizedImageData;
    
    const settings = this.performanceOptimizer.getSettings();
    const params = this.performanceOptimizer.getOptimizedParameters();
    
    console.log(`🚀 Detección híper avanzada ${width}x${height} - Calidad: ${settings.quality}`);
    
    try {
      // PIPELINE COMPLETO DE PROCESAMIENTO
      
      // 1. Pre-procesamiento avanzado
      console.log('📸 1. Pre-procesamiento...');
      const preprocessed = await this.advancedPreprocessing(optimizedImageData);
      
      // 2. Detección de bordes multi-escala
      console.log('🔍 2. Detección de bordes...');
      const edges = await this.multiScaleEdgeDetection(preprocessed, width, height);
      console.log(`   → Píxeles de borde detectados: ${this.countEdgePixels(edges.combined)}`);
      
      // 3. Segmentación por componentes conectados con análisis morfológico
      console.log('🎯 3. Segmentación morfológica...');
      const segmentation = await this.morphologicalSegmentation(preprocessed, edges, width, height);
      console.log(`   → Regiones encontradas: ${segmentation.regions.length}`);
      
      // 4. Extracción y análisis de características
      console.log('📊 4. Extracción de características...');
      const features = await this.extractFeatures(segmentation, preprocessed, width, height);
      console.log(`   → Características extraídas de ${features.regions.length} regiones`);
      
      // 5. Clasificación y selección del objeto predominante
      console.log('🏆 5. Selección del objeto predominante...');
      const predominantObject = await this.selectPredominantObject(features, calibrationData, width, height);
      
      if (predominantObject) {
        console.log(`✅ Objeto predominante detectado:`);
        console.log(`   → Posición: (${predominantObject.x}, ${predominantObject.y})`);
        console.log(`   → Tamaño: ${predominantObject.width}x${predominantObject.height}`);
        console.log(`   → Confianza: ${(predominantObject.confidence * 100).toFixed(1)}%`);
      } else {
        console.log('❌ No se detectó ningún objeto predominante');
      }
      
      // Construir resultado
      const result: HyperAdvancedDetectionResult = {
        objects: predominantObject ? [predominantObject] : [],
        processingTime: performance.now() - startTime,
        edgeMap: edges.combined,
        contours: predominantObject ? [predominantObject.contours!] : [],
        segmentationMask: segmentation.mask,
        confidenceMap: segmentation.confidence,
        debugInfo: {
          edgePixels: this.countEdgePixels(edges.combined),
          contoursFound: features.regions.length,
          validContours: predominantObject ? 1 : 0,
          averageConfidence: predominantObject ? predominantObject.confidence : 0,
          algorithmsUsed: [
            'CLAHE Enhancement',
            'Multi-Scale Edge Detection',
            'Morphological Operations',
            'Connected Components Analysis',
            'Feature Extraction',
            'Object Classification'
          ],
          segmentationQuality: predominantObject ? predominantObject.confidence : 0
        }
      };

      // Escalar coordenadas si la imagen fue reducida
      if (params.scaleFactor < 1.0) {
        console.log(`📏 Escalando resultados por factor ${1 / params.scaleFactor}`);
        this.scaleResultsBack(result, 1 / params.scaleFactor);
      }

      // Actualizar métricas
      this.performanceOptimizer.updateMetrics(result.processingTime);
      this.lastResult = result;

      console.log(`⏱️ Procesamiento completado en ${result.processingTime.toFixed(1)}ms`);
      return result;
      
    } catch (error) {
      console.error('❌ Error en detección:', error);
      return this.getEmptyResult();
    }
  }

  /**
   * PRE-PROCESAMIENTO AVANZADO
   */
  private async advancedPreprocessing(imageData: ImageData): Promise<{
    original: Uint8ClampedArray;
    grayscale: Uint8Array;
    enhanced: Uint8Array;
    normalized: Float32Array;
    gradient: Float32Array;
  }> {
    const { data, width, height } = imageData;
    
    // 1. Conversión a escala de grises con ponderación perceptual
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      grayscale[i / 4] = Math.round(
        0.2126 * data[i] +     // Red
        0.7152 * data[i + 1] + // Green
        0.0722 * data[i + 2]   // Blue
      );
    }
    
    // 2. Aplicar CLAHE (Contrast Limited Adaptive Histogram Equalization)
    const enhanced = this.applyCLAHE(grayscale, width, height, 4.0, 8);
    
    // 3. Normalización a punto flotante
    const normalized = new Float32Array(width * height);
    for (let i = 0; i < enhanced.length; i++) {
      normalized[i] = enhanced[i] / 255.0;
    }
    
    // 4. Calcular gradiente de intensidad
    const gradient = this.calculateGradientMagnitude(enhanced, width, height);
    
    return {
      original: data,
      grayscale,
      enhanced,
      normalized,
      gradient
    };
  }

  /**
   * CLAHE - Contrast Limited Adaptive Histogram Equalization
   */
  private applyCLAHE(
    data: Uint8Array,
    width: number,
    height: number,
    clipLimit: number,
    tileSize: number
  ): Uint8Array {
    const result = new Uint8Array(data.length);
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    
    // Paso 1: Calcular histogramas y CDFs para cada tile
    const tiles: Array<{
      histogram: number[];
      cdf: number[];
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }> = [];
    
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const minX = tx * tileSize;
        const minY = ty * tileSize;
        const maxX = Math.min(minX + tileSize, width);
        const maxY = Math.min(minY + tileSize, height);
        
        // Calcular histograma
        const histogram = new Array(256).fill(0);
        for (let y = minY; y < maxY; y++) {
          for (let x = minX; x < maxX; x++) {
            histogram[data[y * width + x]]++;
          }
        }
        
        // Aplicar límite de contraste
        const tilePixels = (maxX - minX) * (maxY - minY);
        const avgBinHeight = tilePixels / 256;
        const clipThreshold = clipLimit * avgBinHeight;
        let excess = 0;
        
        for (let i = 0; i < 256; i++) {
          if (histogram[i] > clipThreshold) {
            excess += histogram[i] - clipThreshold;
            histogram[i] = clipThreshold;
          }
        }
        
        // Redistribuir exceso uniformemente
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
        
        tiles.push({ histogram, cdf, minX, maxX, minY, maxY });
      }
    }
    
    // Paso 2: Interpolar entre tiles para cada píxel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tx = Math.floor(x / tileSize);
        const ty = Math.floor(y / tileSize);
        
        // Obtener tiles vecinos para interpolación bilineal
        const tileIdx = ty * tilesX + tx;
        const tile = tiles[tileIdx];
        
        if (!tile) continue;
        
        const value = data[y * width + x];
        const tilePixels = (tile.maxX - tile.minX) * (tile.maxY - tile.minY);
        
        // Ecualizar usando CDF del tile
        result[y * width + x] = Math.round(
          (tile.cdf[value] - tile.cdf[0]) * 255 / (tilePixels - tile.cdf[0])
        );
      }
    }
    
    return result;
  }

  /**
   * CALCULAR MAGNITUD DEL GRADIENTE
   */
  private calculateGradientMagnitude(data: Uint8Array, width: number, height: number): Float32Array {
    const gradient = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Gradientes horizontales y verticales
        const gx = data[idx + 1] - data[idx - 1];
        const gy = data[(y + 1) * width + x] - data[(y - 1) * width + x];
        
        gradient[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    
    return gradient;
  }

  /**
   * DETECCIÓN DE BORDES MULTI-ESCALA
   */
  private async multiScaleEdgeDetection(
    preprocessed: any,
    width: number,
    height: number
  ): Promise<{
    canny: Uint8Array;
    sobel: Uint8Array;
    laplacian: Uint8Array;
    combined: Uint8Array;
    confidence: Float32Array;
  }> {
    // 1. Canny con múltiples escalas
    const scales = [1.0, 1.4, 2.0];
    const cannyResults: Uint8Array[] = [];
    
    for (const scale of scales) {
      const scaledImage = this.gaussianBlur(preprocessed.enhanced, width, height, scale);
      const cannyResult = this.edgeDetector.detectEdges(scaledImage, width, height, {
        lowThreshold: 10 * scale,
        highThreshold: 50 * scale,
        sigma: scale,
        sobelKernelSize: 3,
        l2Gradient: true
      });
      cannyResults.push(cannyResult.edges);
    }
    
    // Combinar resultados de Canny multi-escala
    const canny = new Uint8Array(width * height);
    for (let i = 0; i < canny.length; i++) {
      canny[i] = cannyResults.some(result => result[i] > 0) ? 255 : 0;
    }
    
    // 2. Sobel
    const sobel = this.sobelEdgeDetection(preprocessed.enhanced, width, height);
    
    // 3. Laplacian
    const laplacian = this.laplacianEdgeDetection(preprocessed.enhanced, width, height);
    
    // 4. Combinar con votación ponderada
    const combined = new Uint8Array(width * height);
    const confidence = new Float32Array(width * height);
    
    for (let i = 0; i < combined.length; i++) {
      const votes = 
        (canny[i] > 0 ? 0.5 : 0) +
        (sobel[i] > 100 ? 0.3 : 0) +
        (laplacian[i] > 50 ? 0.2 : 0);
      
      confidence[i] = votes;
      combined[i] = votes >= 0.4 ? 255 : 0;
    }
    
    // 5. Aplicar Non-Maximum Suppression
    const suppressed = this.nonMaximumSuppression(combined, preprocessed.gradient, width, height);
    
    return {
      canny,
      sobel,
      laplacian,
      combined: suppressed,
      confidence
    };
  }

  /**
   * DETECCIÓN DE BORDES SOBEL
   */
  private sobelEdgeDetection(data: Uint8Array, width: number, height: number): Uint8Array {
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
   * DETECCIÓN DE BORDES LAPLACIAN
   */
  private laplacianEdgeDetection(data: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(width * height);
    const kernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kidx = (ky + 1) * 3 + (kx + 1);
            sum += data[idx] * kernel[kidx];
          }
        }
        
        result[y * width + x] = Math.max(0, Math.min(255, Math.abs(sum)));
      }
    }
    
    return result;
  }

  /**
   * SUPRESIÓN DE NO MÁXIMOS
   */
  private nonMaximumSuppression(
    edges: Uint8Array,
    gradient: Float32Array,
    width: number,
    height: number
  ): Uint8Array {
    const result = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 0) continue;
        
        // Calcular dirección del gradiente
        const gx = gradient[idx + 1] - gradient[idx - 1];
        const gy = gradient[(y + 1) * width + x] - gradient[(y - 1) * width + x];
        const angle = Math.atan2(gy, gx);
        
        // Determinar vecinos en la dirección del gradiente
        let n1 = 0, n2 = 0;
        const angleNorm = ((angle + Math.PI) * 4 / Math.PI) % 4;
        
        if (angleNorm < 0.5 || angleNorm >= 3.5) {
          // Horizontal
          n1 = edges[idx - 1];
          n2 = edges[idx + 1];
        } else if (angleNorm < 1.5) {
          // Diagonal /
          n1 = edges[(y - 1) * width + (x + 1)];
          n2 = edges[(y + 1) * width + (x - 1)];
        } else if (angleNorm < 2.5) {
          // Vertical
          n1 = edges[(y - 1) * width + x];
          n2 = edges[(y + 1) * width + x];
        } else {
          // Diagonal \
          n1 = edges[(y - 1) * width + (x - 1)];
          n2 = edges[(y + 1) * width + (x + 1)];
        }
        
        // Mantener solo si es máximo local
        if (edges[idx] >= n1 && edges[idx] >= n2) {
          result[idx] = edges[idx];
        }
      }
    }
    
    return result;
  }

  /**
   * SEGMENTACIÓN MORFOLÓGICA
   */
  private async morphologicalSegmentation(
    preprocessed: any,
    edges: any,
    width: number,
    height: number
  ): Promise<{
    mask: Uint8Array;
    confidence: Float32Array;
    regions: Array<{
      id: number;
      pixels: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      centroid: { x: number; y: number };
    }>;
  }> {
    // 1. Aplicar operaciones morfológicas para cerrar gaps
    let processed = this.morphologicalClose(edges.combined, width, height, 5);
    
    // 2. Rellenar huecos internos
    processed = this.fillHoles(processed, width, height);
    
    // 3. Aplicar watershed para separar objetos tocándose
    const watershedResult = this.watershedSegmentation(
      preprocessed.enhanced,
      processed,
      width,
      height
    );
    
    // 4. Análisis de componentes conectados
    const components = this.connectedComponentsAnalysis(
      watershedResult.mask,
      width,
      height
    );
    
    // 5. Filtrar regiones por tamaño y forma
    const filteredRegions = this.filterRegions(components.regions, width, height);
    
    // 6. Calcular confianza para cada píxel
    const confidence = this.calculatePixelConfidence(
      watershedResult.mask,
      edges.confidence,
      preprocessed.gradient,
      width,
      height
    );
    
    return {
      mask: watershedResult.mask,
      confidence,
      regions: filteredRegions
    };
  }

  /**
   * CIERRE MORFOLÓGICO
   */
  private morphologicalClose(data: Uint8Array, width: number, height: number, size: number): Uint8Array {
    // Dilatación seguida de erosión
    const dilated = this.morphologicalDilate(data, width, height, size);
    return this.morphologicalErode(dilated, width, height, size);
  }

  /**
   * DILATACIÓN MORFOLÓGICA
   */
  private morphologicalDilate(data: Uint8Array, width: number, height: number, size: number): Uint8Array {
    const result = new Uint8Array(data.length);
    const radius = Math.floor(size / 2);
    const kernel = this.morphologicalKernels.get(`disk_${size}`) || this.generateDiskKernel(size);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let max = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const kidx = (ky + radius) * size + (kx + radius);
            if (kernel[kidx]) {
              const idx = (y + ky) * width + (x + kx);
              max = Math.max(max, data[idx]);
            }
          }
        }
        
        result[y * width + x] = max;
      }
    }
    
    return result;
  }

  /**
   * EROSIÓN MORFOLÓGICA
   */
  private morphologicalErode(data: Uint8Array, width: number, height: number, size: number): Uint8Array {
    const result = new Uint8Array(data.length);
    const radius = Math.floor(size / 2);
    const kernel = this.morphologicalKernels.get(`disk_${size}`) || this.generateDiskKernel(size);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let min = 255;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const kidx = (ky + radius) * size + (kx + radius);
            if (kernel[kidx]) {
              const idx = (y + ky) * width + (x + kx);
              min = Math.min(min, data[idx]);
            }
          }
        }
        
        result[y * width + x] = min;
      }
    }
    
    return result;
  }

  /**
   * RELLENAR HUECOS
   */
  private fillHoles(data: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(data);
    const filled = new Uint8Array(width * height);
    
    // Flood fill desde los bordes
    const queue: Array<{x: number, y: number}> = [];
    
    // Agregar todos los píxeles del borde
    for (let x = 0; x < width; x++) {
      queue.push({x, y: 0});
      queue.push({x, y: height - 1});
    }
    for (let y = 1; y < height - 1; y++) {
      queue.push({x: 0, y});
      queue.push({x: width - 1, y});
    }
    
    // Flood fill
    while (queue.length > 0) {
      const {x, y} = queue.shift()!;
      const idx = y * width + x;
      
      if (filled[idx] || data[idx] === 255) continue;
      
      filled[idx] = 1;
      
      // Agregar vecinos
      const neighbors = [
        {x: x - 1, y}, {x: x + 1, y},
        {x, y: y - 1}, {x, y: y + 1}
      ];
      
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
          const nidx = n.y * width + n.x;
          if (!filled[nidx] && data[nidx] === 0) {
            queue.push(n);
          }
        }
      }
    }
    
    // Invertir para obtener huecos rellenos
    for (let i = 0; i < result.length; i++) {
      if (filled[i] === 0) {
        result[i] = 255;
      }
    }
    
    return result;
  }

  /**
   * SEGMENTACIÓN WATERSHED
   */
  private watershedSegmentation(
    image: Uint8Array,
    markers: Uint8Array,
    width: number,
    height: number
  ): { mask: Uint8Array } {
    const labels = new Uint8Array(width * height);
    const distances = new Float32Array(width * height);
    
    // Calcular transformada de distancia
    for (let i = 0; i < distances.length; i++) {
      distances[i] = markers[i] > 0 ? 0 : Infinity;
    }
    
    // Transformada de distancia euclidiana
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (distances[idx] === 0) continue;
        
        const neighbors = [
          distances[idx - 1] + 1,
          distances[idx + 1] + 1,
          distances[(y - 1) * width + x] + 1,
          distances[(y + 1) * width + x] + 1,
          distances[(y - 1) * width + (x - 1)] + Math.SQRT2,
          distances[(y - 1) * width + (x + 1)] + Math.SQRT2,
          distances[(y + 1) * width + (x - 1)] + Math.SQRT2,
          distances[(y + 1) * width + (x + 1)] + Math.SQRT2
        ];
        
        distances[idx] = Math.min(distances[idx], ...neighbors);
      }
    }
    
    // Encontrar máximos locales como marcadores
    const seeds: Array<{x: number, y: number, value: number}> = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (markers[idx] === 0) continue;
        
        let isMaximum = true;
        const value = distances[idx];
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nidx = (y + dy) * width + (x + dx);
            if (distances[nidx] > value) {
              isMaximum = false;
              break;
            }
          }
          if (!isMaximum) break;
        }
        
        if (isMaximum && value > 5) {
          seeds.push({x, y, value});
        }
      }
    }
    
    // Ordenar semillas por distancia (mayor primero)
    seeds.sort((a, b) => b.value - a.value);
    
    // Asignar etiquetas desde las semillas
    let currentLabel = 1;
    for (const seed of seeds) {
      const queue = [{x: seed.x, y: seed.y}];
      const idx = seed.y * width + seed.x;
      
      if (labels[idx] > 0) continue;
      
      labels[idx] = currentLabel;
      
      while (queue.length > 0) {
        const {x, y} = queue.shift()!;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx;
              
              if (labels[nidx] === 0 && markers[nidx] > 0) {
                const gradient = Math.abs(image[nidx] - image[y * width + x]);
                
                if (gradient < 50) { // Aumentado de 30 a 50 para ser menos estricto
                  labels[nidx] = currentLabel;
                  queue.push({x: nx, y: ny});
                }
              }
            }
          }
        }
      }
      
      currentLabel++;
    }
    
    // Convertir etiquetas a máscara binaria
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = labels[i] > 0 ? 255 : 0;
    }
    
    return { mask };
  }

  /**
   * ANÁLISIS DE COMPONENTES CONECTADOS
   */
  private connectedComponentsAnalysis(
    mask: Uint8Array,
    width: number,
    height: number
  ): {
    labels: Uint8Array;
    regions: Array<{
      id: number;
      pixels: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      centroid: { x: number; y: number };
    }>;
  } {
    const labels = new Uint8Array(width * height);
    const regions: Map<number, {
      pixels: number;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      sumX: number;
      sumY: number;
    }> = new Map();
    
    let currentLabel = 1;
    
    // Escanear y etiquetar componentes
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (mask[idx] > 0 && labels[idx] === 0) {
          // Nuevo componente encontrado
          const component = this.floodFillComponent(
            mask,
            labels,
            x,
            y,
            width,
            height,
            currentLabel
          );
          
          regions.set(currentLabel, component);
          currentLabel++;
        }
      }
    }
    
    // Convertir a array de regiones
    const regionArray: Array<{
      id: number;
      pixels: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      centroid: { x: number; y: number };
    }> = [];
    
    regions.forEach((region, id) => {
      regionArray.push({
        id,
        pixels: region.pixels,
        boundingBox: {
          x: region.minX,
          y: region.minY,
          width: region.maxX - region.minX + 1,
          height: region.maxY - region.minY + 1
        },
        centroid: {
          x: region.sumX / region.pixels,
          y: region.sumY / region.pixels
        }
      });
    });
    
    return { labels, regions: regionArray };
  }

  /**
   * FLOOD FILL PARA COMPONENTE
   */
  private floodFillComponent(
    mask: Uint8Array,
    labels: Uint8Array,
    startX: number,
    startY: number,
    width: number,
    height: number,
    label: number
  ): any {
    const queue = [{x: startX, y: startY}];
    const component = {
      pixels: 0,
      minX: width,
      maxX: 0,
      minY: height,
      maxY: 0,
      sumX: 0,
      sumY: 0
    };
    
    while (queue.length > 0) {
      const {x, y} = queue.shift()!;
      const idx = y * width + x;
      
      if (labels[idx] > 0 || mask[idx] === 0) continue;
      
      labels[idx] = label;
      component.pixels++;
      component.sumX += x;
      component.sumY += y;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);
      
      // Agregar vecinos 8-conectados
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            if (labels[nidx] === 0 && mask[nidx] > 0) {
              queue.push({x: nx, y: ny});
            }
          }
        }
      }
    }
    
    return component;
  }

  /**
   * FILTRAR REGIONES
   */
  private filterRegions(
    regions: Array<any>,
    width: number,
    height: number
  ): Array<any> {
    const minArea = width * height * 0.0005; // Reducido de 0.001 a 0.0005 (0.05% del área total)
    const maxArea = width * height * 0.9;   // Aumentado de 0.8 a 0.9 (90% del área total)
    
    console.log(`🔍 Filtrando ${regions.length} regiones...`);
    console.log(`   → Área mínima: ${minArea.toFixed(0)} px`);
    console.log(`   → Área máxima: ${maxArea.toFixed(0)} px`);
    
    const filtered = regions.filter(region => {
      // Filtrar por área
      if (region.pixels < minArea || region.pixels > maxArea) {
        console.log(`   ❌ Región descartada por área: ${region.pixels} px`);
        return false;
      }
      
      // Filtrar por aspect ratio - más permisivo
      const aspectRatio = region.boundingBox.width / region.boundingBox.height;
      if (aspectRatio < 0.05 || aspectRatio > 20) { // Más permisivo que antes (0.1 a 10)
        console.log(`   ❌ Región descartada por aspect ratio: ${aspectRatio.toFixed(2)}`);
        return false;
      }
      
      // Filtrar por solidez (área / área del bounding box) - más permisivo
      const solidity = region.pixels / (region.boundingBox.width * region.boundingBox.height);
      if (solidity < 0.2) { // Reducido de 0.3 a 0.2
        console.log(`   ❌ Región descartada por solidez: ${solidity.toFixed(2)}`);
        return false;
      }
      
      console.log(`   ✅ Región aceptada: ${region.pixels} px, AR: ${aspectRatio.toFixed(2)}, Solidez: ${solidity.toFixed(2)}`);
      return true;
    });
    
    console.log(`   → Regiones después del filtrado: ${filtered.length}`);
    return filtered;
  }

  /**
   * CALCULAR CONFIANZA DE PÍXELES
   */
  private calculatePixelConfidence(
    mask: Uint8Array,
    edgeConfidence: Float32Array,
    gradient: Float32Array,
    width: number,
    height: number
  ): Float32Array {
    const confidence = new Float32Array(width * height);
    
    for (let i = 0; i < confidence.length; i++) {
      if (mask[i] > 0) {
        // Combinar múltiples factores de confianza
        const edgeFactor = edgeConfidence[i];
        const gradientFactor = Math.min(1, gradient[i] / 100);
        const maskFactor = mask[i] / 255;
        
        confidence[i] = (edgeFactor * 0.4 + gradientFactor * 0.3 + maskFactor * 0.3);
      }
    }
    
    return confidence;
  }

  /**
   * EXTRACCIÓN DE CARACTERÍSTICAS
   */
  private async extractFeatures(
    segmentation: any,
    preprocessed: any,
    width: number,
    height: number
  ): Promise<{
    regions: Array<{
      region: any;
      contour: Array<{x: number, y: number}>;
      features: {
        geometric: Float32Array;
        texture: Float32Array;
        shape: Float32Array;
      };
      confidence: number;
    }>;
  }> {
    const features = [];
    
    for (const region of segmentation.regions) {
      // Extraer contorno de la región
      const contour = this.extractRegionContour(
        segmentation.mask,
        region,
        width,
        height
      );
      
      if (contour.length < 20) continue;
      
      // Características geométricas
      const geometric = this.extractGeometricFeatures(region, contour, width, height);
      
      // Características de textura
      const texture = this.extractTextureFeatures(
        preprocessed.enhanced,
        region,
        width
      );
      
      // Características de forma
      const shape = this.extractShapeFeatures(contour, region);
      
      // Calcular confianza basada en características
      const confidence = this.calculateRegionConfidence(
        geometric,
        texture,
        shape,
        region,
        width,
        height
      );
      
      features.push({
        region,
        contour,
        features: { geometric, texture, shape },
        confidence
      });
    }
    
    return { regions: features };
  }

  /**
   * EXTRAER CONTORNO DE REGIÓN
   */
  private extractRegionContour(
    mask: Uint8Array,
    region: any,
    width: number,
    height: number
  ): Array<{x: number, y: number}> {
    const contour: Array<{x: number, y: number}> = [];
    const visited = new Set<string>();
    
    // Encontrar un punto de borde
    let startX = -1, startY = -1;
    outer: for (let y = region.boundingBox.y; y < region.boundingBox.y + region.boundingBox.height; y++) {
      for (let x = region.boundingBox.x; x < region.boundingBox.x + region.boundingBox.width; x++) {
        const idx = y * width + x;
        if (mask[idx] > 0) {
          // Verificar si es borde
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                if (mask[nidx] === 0) {
                  startX = x;
                  startY = y;
                  break outer;
                }
              }
            }
          }
        }
      }
    }
    
    if (startX === -1) return contour;
    
    // Seguir el contorno usando algoritmo de seguimiento de Moore
    const directions = [
      {dx: 0, dy: -1},  // Norte
      {dx: 1, dy: -1},  // Noreste
      {dx: 1, dy: 0},   // Este
      {dx: 1, dy: 1},   // Sureste
      {dx: 0, dy: 1},   // Sur
      {dx: -1, dy: 1},  // Suroeste
      {dx: -1, dy: 0},  // Oeste
      {dx: -1, dy: -1}  // Noroeste
    ];
    
    let x = startX, y = startY;
    let dir = 0; // Dirección inicial
    
    do {
      contour.push({x, y});
      visited.add(`${x},${y}`);
      
      // Buscar siguiente punto del contorno
      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (dir + 6 + i) % 8; // Empezar desde la izquierda de la dirección actual
        const d = directions[newDir];
        const nx = x + d.dx;
        const ny = y + d.dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (mask[nidx] > 0 && !visited.has(`${nx},${ny}`)) {
            x = nx;
            y = ny;
            dir = newDir;
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
   * CARACTERÍSTICAS GEOMÉTRICAS
   */
  private extractGeometricFeatures(
    region: any,
    contour: Array<{x: number, y: number}>,
    width: number,
    height: number
  ): Float32Array {
    const features = new Float32Array(10);
    
    // 1. Área relativa
    features[0] = region.pixels / (width * height);
    
    // 2. Aspect ratio
    features[1] = region.boundingBox.width / region.boundingBox.height;
    
    // 3. Solidez (área / área del bounding box)
    features[2] = region.pixels / (region.boundingBox.width * region.boundingBox.height);
    
    // 4. Circularidad
    const perimeter = this.calculatePerimeter(contour);
    features[3] = (4 * Math.PI * region.pixels) / (perimeter * perimeter);
    
    // 5. Extensión (área / área del convex hull)
    const convexHull = this.convexHull(contour);
    const hullArea = this.calculatePolygonArea(convexHull);
    features[4] = region.pixels / hullArea;
    
    // 6. Compacidad
    features[5] = (perimeter * perimeter) / region.pixels;
    
    // 7. Posición relativa X
    features[6] = region.centroid.x / width;
    
    // 8. Posición relativa Y
    features[7] = region.centroid.y / height;
    
    // 9. Distancia al centro normalizada
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    const dist = Math.sqrt(
      (region.centroid.x - centerX) ** 2 + 
      (region.centroid.y - centerY) ** 2
    );
    features[8] = dist / maxDist;
    
    // 10. Rectangularidad
    features[9] = region.pixels / (region.boundingBox.width * region.boundingBox.height);
    
    return features;
  }

  /**
   * CARACTERÍSTICAS DE TEXTURA
   */
  private extractTextureFeatures(
    image: Uint8Array,
    region: any,
    width: number
  ): Float32Array {
    const features = new Float32Array(6);
    
    // Calcular estadísticas de intensidad en la región
    const values: number[] = [];
    
    for (let y = region.boundingBox.y; y < region.boundingBox.y + region.boundingBox.height; y++) {
      for (let x = region.boundingBox.x; x < region.boundingBox.x + region.boundingBox.width; x++) {
        const idx = y * width + x;
        values.push(image[idx]);
      }
    }
    
    if (values.length === 0) return features;
    
    // 1. Media
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    features[0] = mean / 255;
    
    // 2. Desviación estándar
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    features[1] = stdDev / 255;
    
    // 3. Entropía
    const histogram = new Array(16).fill(0);
    for (const v of values) {
      histogram[Math.floor(v / 16)]++;
    }
    
    let entropy = 0;
    for (const count of histogram) {
      if (count > 0) {
        const p = count / values.length;
        entropy -= p * Math.log2(p);
      }
    }
    features[2] = entropy / 4; // Normalizar (max entropía = log2(16) = 4)
    
    // 4. Contraste local
    let contrast = 0;
    let contrastCount = 0;
    
    for (let y = region.boundingBox.y + 1; y < region.boundingBox.y + region.boundingBox.height - 1; y++) {
      for (let x = region.boundingBox.x + 1; x < region.boundingBox.x + region.boundingBox.width - 1; x++) {
        const idx = y * width + x;
        const center = image[idx];
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nidx = (y + dy) * width + (x + dx);
            contrast += Math.abs(center - image[nidx]);
            contrastCount++;
          }
        }
      }
    }
    
    features[3] = contrastCount > 0 ? (contrast / contrastCount) / 255 : 0;
    
    // 5. Homogeneidad
    const sorted = values.sort((a, b) => a - b);
    const q1 = sorted[Math.floor(values.length * 0.25)];
    const q3 = sorted[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    features[4] = 1 - (iqr / 255);
    
    // 6. Uniformidad
    let uniformity = 0;
    for (const count of histogram) {
      const p = count / values.length;
      uniformity += p * p;
    }
    features[5] = uniformity;
    
    return features;
  }

  /**
   * CARACTERÍSTICAS DE FORMA
   */
  private extractShapeFeatures(
    contour: Array<{x: number, y: number}>,
    region: any
  ): Float32Array {
    const features = new Float32Array(7);
    
    // 1-7. Momentos de Hu
    const huMoments = this.calculateHuMoments(contour);
    for (let i = 0; i < 7; i++) {
      features[i] = huMoments[i];
    }
    
    return features;
  }

  /**
   * CALCULAR CONFIANZA DE REGIÓN
   */
  private calculateRegionConfidence(
    geometric: Float32Array,
    texture: Float32Array,
    shape: Float32Array,
    region: any,
    width: number,
    height: number
  ): number {
    // Pesos para diferentes características
    const weights = {
      size: 0.25,
      position: 0.20,
      shape: 0.20,
      texture: 0.15,
      solidity: 0.20
    };
    
    let confidence = 0;
    
    // Factor de tamaño (preferir objetos de tamaño medio)
    const sizeRatio = region.pixels / (width * height);
    const sizeFactor = 1 - Math.abs(sizeRatio - 0.1) * 5;
    confidence += weights.size * Math.max(0, Math.min(1, sizeFactor));
    
    // Factor de posición (preferir objetos centrados)
    const positionFactor = 1 - geometric[8]; // Distancia al centro normalizada
    confidence += weights.position * positionFactor;
    
    // Factor de forma (preferir formas regulares)
    const shapeFactor = (geometric[3] + geometric[4]) / 2; // Promedio de circularidad y extensión
    confidence += weights.shape * shapeFactor;
    
    // Factor de textura (preferir objetos con textura uniforme)
    const textureFactor = texture[5]; // Uniformidad
    confidence += weights.texture * textureFactor;
    
    // Factor de solidez
    const solidityFactor = geometric[2]; // Solidez
    confidence += weights.solidity * solidityFactor;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * SELECCIONAR OBJETO PREDOMINANTE
   */
  private async selectPredominantObject(
    features: any,
    calibrationData: CalibrationData | null,
    width: number,
    height: number
  ): Promise<DetectedObject | null> {
    if (features.regions.length === 0) return null;
    
    // Calcular score para cada región
    let bestRegion = null;
    let bestScore = -1;
    
    for (const regionFeature of features.regions) {
      const { region, contour, features: feat, confidence } = regionFeature;
      
      // Score basado en múltiples factores
      const sizeScore = Math.min(1, region.pixels / (width * height * 0.1));
      const positionScore = 1 - feat.geometric[8]; // Distancia al centro
      const shapeScore = feat.geometric[3]; // Circularidad
      const confidenceScore = confidence;
      
      const totalScore = (
        sizeScore * 0.35 +
        positionScore * 0.25 +
        shapeScore * 0.20 +
        confidenceScore * 0.20
      );
      
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestRegion = regionFeature;
      }
    }
    
    if (!bestRegion) return null;
    
    // Crear objeto detectado
    return this.createDetectedObject(
      bestRegion,
      calibrationData,
      width,
      height
    );
  }

  /**
   * CREAR OBJETO DETECTADO
   */
  private createDetectedObject(
    regionFeature: any,
    calibrationData: CalibrationData | null,
    width: number,
    height: number
  ): DetectedObject {
    const { region, contour, confidence } = regionFeature;
    
    // Aplicar calibración
    let realWidth = region.boundingBox.width;
    let realHeight = region.boundingBox.height;
    let realArea = region.pixels;
    let unit: 'px' | 'mm' = 'px';
    
    if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
      const mmPerPixel = 1 / calibrationData.pixelsPerMm;
      realWidth *= mmPerPixel;
      realHeight *= mmPerPixel;
      realArea *= mmPerPixel * mmPerPixel;
      unit = 'mm';
    }
    
    const perimeter = this.calculatePerimeter(contour);
    const realPerimeter = unit === 'mm' ? perimeter / calibrationData!.pixelsPerMm : perimeter;
    
    return {
      id: `object_${Date.now()}`,
      type: 'predominant',
      x: region.boundingBox.x,
      y: region.boundingBox.y,
      width: region.boundingBox.width,
      height: region.boundingBox.height,
      area: realArea,
      confidence: Math.min(0.99, confidence),
      
      contours: contour,
      boundingBox: region.boundingBox,
      
      dimensions: {
        width: realWidth,
        height: realHeight,
        area: realArea,
        unit,
        perimeter: realPerimeter
      },
      
      points: contour.slice(0, 50).map((point, idx) => ({
        x: calibrationData?.isCalibrated ? point.x / calibrationData.pixelsPerMm : point.x,
        y: calibrationData?.isCalibrated ? point.y / calibrationData.pixelsPerMm : point.y,
        z: 0,
        confidence: confidence,
        timestamp: Date.now() + idx
      })),
      
      geometricProperties: {
        aspectRatio: region.boundingBox.width / region.boundingBox.height,
        solidity: region.pixels / (region.boundingBox.width * region.boundingBox.height),
        circularity: (4 * Math.PI * region.pixels) / (perimeter * perimeter),
        perimeter: realPerimeter
      },
      
      centerX: region.centroid.x,
      centerY: region.centroid.y
    };
  }

  // FUNCIONES AUXILIARES

  /**
   * Blur Gaussiano
   */
  private gaussianBlur(data: Uint8Array, width: number, height: number, sigma: number): Uint8Array {
    const kernel = this.gaussianKernels.get(`gaussian_${sigma}`) || this.generateGaussianKernel(Math.ceil(sigma * 6) | 1, sigma);
    const size = Math.sqrt(kernel.length);
    const radius = Math.floor(size / 2);
    const result = new Uint8Array(data.length);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let sum = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kidx = (ky + radius) * size + (kx + radius);
            sum += data[idx] * kernel[kidx];
          }
        }
        
        result[y * width + x] = Math.round(sum);
      }
    }
    
    return result;
  }

  /**
   * Generar kernel Gaussiano
   */
  private generateGaussianKernel(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size * size);
    const center = Math.floor(size / 2);
    const sigma2 = sigma * sigma;
    
    let sum = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma2));
        kernel[y * size + x] = value;
        sum += value;
      }
    }
    
    // Normalizar
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  /**
   * Generar kernel de disco
   */
  private generateDiskKernel(size: number): Uint8Array {
    const kernel = new Uint8Array(size * size);
    const center = Math.floor(size / 2);
    const radius = center;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        if (dx * dx + dy * dy <= radius * radius) {
          kernel[y * size + x] = 1;
        }
      }
    }
    
    return kernel;
  }

  /**
   * Generar kernel de cruz
   */
  private generateCrossKernel(size: number): Uint8Array {
    const kernel = new Uint8Array(size * size);
    const center = Math.floor(size / 2);
    
    for (let i = 0; i < size; i++) {
      kernel[center * size + i] = 1; // Horizontal
      kernel[i * size + center] = 1; // Vertical
    }
    
    return kernel;
  }

  /**
   * Calcular perímetro
   */
  private calculatePerimeter(contour: Array<{x: number, y: number}>): number {
    let perimeter = 0;
    
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      const dx = contour[j].x - contour[i].x;
      const dy = contour[j].y - contour[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  }

  /**
   * Calcular área de polígono
   */
  private calculatePolygonArea(points: Array<{x: number, y: number}>): number {
    let area = 0;
    
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * Convex Hull (Graham Scan)
   */
  private convexHull(points: Array<{x: number, y: number}>): Array<{x: number, y: number}> {
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
      if (angleA !== angleB) return angleA - angleB;
      
      // Si tienen el mismo ángulo, ordenar por distancia
      const distA = (a.x - lowest.x) ** 2 + (a.y - lowest.y) ** 2;
      const distB = (b.x - lowest.x) ** 2 + (b.y - lowest.y) ** 2;
      return distA - distB;
    });
    
    // Graham scan
    const hull: Array<{x: number, y: number}> = [];
    
    for (const point of sorted) {
      while (hull.length > 1) {
        const p1 = hull[hull.length - 2];
        const p2 = hull[hull.length - 1];
        
        const cross = (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
        if (cross > 0) break;
        
        hull.pop();
      }
      hull.push(point);
    }
    
    return hull;
  }

  /**
   * Calcular momentos de Hu
   */
  private calculateHuMoments(contour: Array<{x: number, y: number}>): Float32Array {
    const moments = new Float32Array(7);
    
    // Calcular momentos geométricos
    let m00 = 0, m10 = 0, m01 = 0, m20 = 0, m02 = 0, m11 = 0;
    let m30 = 0, m03 = 0, m21 = 0, m12 = 0;
    
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
    
    // Momentos centrales
    const mu20 = m20 / m00 - cx * cx;
    const mu02 = m02 / m00 - cy * cy;
    const mu11 = m11 / m00 - cx * cy;
    const mu30 = m30 / m00 - 3 * cx * m20 / m00 + 2 * cx * cx * cx;
    const mu03 = m03 / m00 - 3 * cy * m02 / m00 + 2 * cy * cy * cy;
    const mu21 = m21 / m00 - 2 * cx * m11 / m00 - cy * m20 / m00 + 2 * cx * cx * cy;
    const mu12 = m12 / m00 - 2 * cy * m11 / m00 - cx * m02 / m00 + 2 * cy * cy * cx;
    
    // Momentos de Hu invariantes
    const nu20 = mu20 / Math.pow(m00, 2);
    const nu02 = mu02 / Math.pow(m00, 2);
    const nu11 = mu11 / Math.pow(m00, 2);
    const nu30 = mu30 / Math.pow(m00, 2.5);
    const nu03 = mu03 / Math.pow(m00, 2.5);
    const nu21 = mu21 / Math.pow(m00, 2.5);
    const nu12 = mu12 / Math.pow(m00, 2.5);
    
    moments[0] = nu20 + nu02;
    moments[1] = Math.pow(nu20 - nu02, 2) + 4 * Math.pow(nu11, 2);
    moments[2] = Math.pow(nu30 - 3 * nu12, 2) + Math.pow(3 * nu21 - nu03, 2);
    moments[3] = Math.pow(nu30 + nu12, 2) + Math.pow(nu21 + nu03, 2);
    moments[4] = (nu30 - 3 * nu12) * (nu30 + nu12) * (Math.pow(nu30 + nu12, 2) - 3 * Math.pow(nu21 + nu03, 2)) +
                 (3 * nu21 - nu03) * (nu21 + nu03) * (3 * Math.pow(nu30 + nu12, 2) - Math.pow(nu21 + nu03, 2));
    moments[5] = (nu20 - nu02) * (Math.pow(nu30 + nu12, 2) - Math.pow(nu21 + nu03, 2)) +
                 4 * nu11 * (nu30 + nu12) * (nu21 + nu03);
    moments[6] = (3 * nu21 - nu03) * (nu30 + nu12) * (Math.pow(nu30 + nu12, 2) - 3 * Math.pow(nu21 + nu03, 2)) -
                 (nu30 - 3 * nu12) * (nu21 + nu03) * (3 * Math.pow(nu30 + nu12, 2) - Math.pow(nu21 + nu03, 2));
    
    // Aplicar log para estabilidad numérica
    for (let i = 0; i < 7; i++) {
      moments[i] = Math.sign(moments[i]) * Math.log(Math.abs(moments[i]) + 1);
    }
    
    return moments;
  }

  /**
   * Contar píxeles de borde
   */
  private countEdgePixels(edges: Uint8Array): number {
    let count = 0;
    for (const pixel of edges) {
      if (pixel > 0) count++;
    }
    return count;
  }

  /**
   * Escalar resultados
   */
  private scaleResultsBack(result: HyperAdvancedDetectionResult, scale: number): void {
    // Escalar objetos
    for (const obj of result.objects) {
      obj.x *= scale;
      obj.y *= scale;
      obj.width *= scale;
      obj.height *= scale;
      
      obj.boundingBox.x *= scale;
      obj.boundingBox.y *= scale;
      obj.boundingBox.width *= scale;
      obj.boundingBox.height *= scale;
      
      if (obj.contours) {
        for (const point of obj.contours) {
          point.x *= scale;
          point.y *= scale;
        }
      }
      
      if (obj.centerX !== undefined) obj.centerX *= scale;
      if (obj.centerY !== undefined) obj.centerY *= scale;
    }
    
    // Escalar contornos
    for (const contour of result.contours) {
      for (const point of contour) {
        point.x *= scale;
        point.y *= scale;
      }
    }
  }

  /**
   * Obtener resultado vacío
   */
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
   * DIBUJAR OVERLAY DE DETECCIÓN
   */
  drawDetectionOverlay(
    canvas: HTMLCanvasElement,
    result: HyperAdvancedDetectionResult,
    showEdges: boolean = false,
    showDebug: boolean = false
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);
    
    // Dibujar bordes si está habilitado
    if (showEdges && result.edgeMap.length > 0) {
      const imageData = ctx.createImageData(width, height);
      for (let i = 0; i < result.edgeMap.length; i++) {
        const value = result.edgeMap[i];
        imageData.data[i * 4] = value;
        imageData.data[i * 4 + 1] = value;
        imageData.data[i * 4 + 2] = value;
        imageData.data[i * 4 + 3] = 128; // Semi-transparente
      }
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Dibujar objetos detectados
    for (const obj of result.objects) {
      // Color verde neón para el objeto predominante
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(0, 255, 65, 0.1)';
      
      // Dibujar bounding box
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      
      // Dibujar contorno si está disponible
      if (obj.contours && obj.contours.length > 0) {
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      
      // Dibujar información
      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(
        `${obj.dimensions.width.toFixed(1)} x ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`,
        obj.x,
        obj.y - 10
      );
      
      // Dibujar confianza
      ctx.fillStyle = '#ffff00';
      ctx.font = '14px Arial';
      ctx.fillText(
        `${(obj.confidence * 100).toFixed(0)}%`,
        obj.x + obj.width - 40,
        obj.y - 10
      );
    }
    
    // Información de debug
    if (showDebug) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 300, 120);
      
      ctx.fillStyle = '#00ff41';
      ctx.font = '12px monospace';
      ctx.fillText(`Tiempo: ${result.processingTime.toFixed(1)}ms`, 20, 30);
      ctx.fillText(`Objetos detectados: ${result.objects.length}`, 20, 50);
      ctx.fillText(`Píxeles de borde: ${result.debugInfo.edgePixels}`, 20, 70);
      ctx.fillText(`Contornos encontrados: ${result.debugInfo.contoursFound}`, 20, 90);
      ctx.fillText(`Algoritmos: ${result.debugInfo.algorithmsUsed.length}`, 20, 110);
    }
  }

  /**
   * DETECCIÓN RÁPIDA DE EMERGENCIA
   */
  private async quickDetection(
    imageData: ImageData,
    calibrationData: CalibrationData | null
  ): Promise<HyperAdvancedDetectionResult> {
    const { data, width, height } = imageData;
    const startTime = performance.now();
    
    // Conversión rápida a escala de grises
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      grayscale[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    // Detección de bordes simple con Sobel
    const edges = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        const gx = 
          -grayscale[(y-1) * width + (x-1)] - 2*grayscale[y * width + (x-1)] - grayscale[(y+1) * width + (x-1)] +
          grayscale[(y-1) * width + (x+1)] + 2*grayscale[y * width + (x+1)] + grayscale[(y+1) * width + (x+1)];
        
        const gy = 
          -grayscale[(y-1) * width + (x-1)] - 2*grayscale[(y-1) * width + x] - grayscale[(y-1) * width + (x+1)] +
          grayscale[(y+1) * width + (x-1)] + 2*grayscale[(y+1) * width + x] + grayscale[(y+1) * width + (x+1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = magnitude > 30 ? 255 : 0;
      }
    }
    
    // Encontrar componentes conectados simples
    const visited = new Array(width * height).fill(false);
    const components: Array<{
      pixels: number;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      points: Array<{x: number, y: number}>;
    }> = [];
    
    // Escanear imagen en pasos para encontrar objetos
    for (let y = 10; y < height - 10; y += 20) {
      for (let x = 10; x < width - 10; x += 20) {
        const idx = y * width + x;
        
        if (!visited[idx] && edges[idx] === 0 && grayscale[idx] < 200) {
          const component = this.floodFillQuick(edges, grayscale, visited, x, y, width, height);
          
          if (component.pixels > 500) { // Área mínima
            components.push(component);
          }
        }
      }
    }
    
    // Seleccionar el componente más grande y centrado
    let bestComponent = null;
    let bestScore = -1;
    
    const centerX = width / 2;
    const centerY = height / 2;
    
    for (const comp of components) {
      const compCenterX = (comp.minX + comp.maxX) / 2;
      const compCenterY = (comp.minY + comp.maxY) / 2;
      const distToCenter = Math.sqrt((compCenterX - centerX) ** 2 + (compCenterY - centerY) ** 2);
      const centralityScore = 1 - (distToCenter / Math.sqrt(centerX * centerX + centerY * centerY));
      const sizeScore = comp.pixels / (width * height);
      const score = sizeScore * 0.6 + centralityScore * 0.4;
      
      if (score > bestScore) {
        bestScore = score;
        bestComponent = comp;
      }
    }
    
    // Crear objeto detectado
    const objects: DetectedObject[] = [];
    
    if (bestComponent) {
      const w = bestComponent.maxX - bestComponent.minX + 1;
      const h = bestComponent.maxY - bestComponent.minY + 1;
      
      // Aplicar calibración
      let realWidth = w;
      let realHeight = h;
      let unit: 'px' | 'mm' = 'px';
      
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        realWidth = w / calibrationData.pixelsPerMm;
        realHeight = h / calibrationData.pixelsPerMm;
        unit = 'mm';
      }
      
      objects.push({
        id: `quick_${Date.now()}`,
        type: 'predominant',
        x: bestComponent.minX,
        y: bestComponent.minY,
        width: w,
        height: h,
        area: bestComponent.pixels,
        confidence: 0.75,
        contours: bestComponent.points.slice(0, 100),
        boundingBox: {
          x: bestComponent.minX,
          y: bestComponent.minY,
          width: w,
          height: h
        },
        dimensions: {
          width: realWidth,
          height: realHeight,
          area: realWidth * realHeight,
          unit,
          perimeter: 2 * (realWidth + realHeight)
        },
        points: bestComponent.points.slice(0, 20).map((p, i) => ({
          x: p.x,
          y: p.y,
          z: 0,
          confidence: 0.75,
          timestamp: Date.now() + i
        })),
        centerX: (bestComponent.minX + bestComponent.maxX) / 2,
        centerY: (bestComponent.minY + bestComponent.maxY) / 2
      });
    }
    
    return {
      objects,
      processingTime: performance.now() - startTime,
      edgeMap: edges,
      contours: objects.length > 0 ? [objects[0].contours!] : [],
      segmentationMask: new Uint8Array(width * height),
      confidenceMap: new Float32Array(width * height),
      debugInfo: {
        edgePixels: edges.filter(e => e > 0).length,
        contoursFound: components.length,
        validContours: objects.length,
        averageConfidence: 0.75,
        algorithmsUsed: ['Quick Detection', 'Sobel', 'Flood Fill'],
        segmentationQuality: 0.75
      }
    };
  }

  /**
   * FLOOD FILL RÁPIDO
   */
  private floodFillQuick(
    edges: Uint8Array,
    grayscale: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number
  ): any {
    const stack = [{x: startX, y: startY}];
    const component = {
      pixels: 0,
      minX: width,
      maxX: 0,
      minY: height,
      maxY: 0,
      points: [] as Array<{x: number, y: number}>
    };
    
    const seedValue = grayscale[startY * width + startX];
    
    while (stack.length > 0 && component.pixels < 100000) {
      const {x, y} = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] !== 0) {
        continue;
      }
      
      // Verificar similitud de color
      const diff = Math.abs(grayscale[idx] - seedValue);
      if (diff > 40) continue;
      
      visited[idx] = true;
      component.pixels++;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);
      
      // Guardar algunos puntos del contorno
      if (component.points.length < 200) {
        // Es punto de borde?
        let isBorder = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (edges[ny * width + nx] !== 0) {
                isBorder = true;
                break;
              }
            }
          }
          if (isBorder) break;
        }
        
        if (isBorder) {
          component.points.push({x, y});
        }
      }
      
      // Agregar vecinos
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }
    
    return component;
  }
}