// DETECCIÓN AVANZADA DE OBJETOS CON IA - PRECISIÓN EXTREMA
// Sistema de segmentación de imágenes usando Hugging Face Transformers
// Detecta automáticamente el objeto más grande/predominante con máxima precisión

import { pipeline, env } from '@huggingface/transformers';

// Configurar transformers para usar modelos en el navegador
env.allowLocalModels = false;
env.useBrowserCache = true; // Permitir cache para mejor rendimiento

interface DetectedObjectPrecise {
  id: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  contours: number[][];
  mask: ImageData;
  area: number;
  perimeter: number;
  centroid: { x: number; y: number };
  isPredominant: boolean;
  label?: string;
}

interface SegmentationResult {
  predominantObject: DetectedObjectPrecise | null;
  allObjects: DetectedObjectPrecise[];
  processingTime: number;
  confidence: number;
}

class AdvancedObjectDetector {
  private segmentationPipeline: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.initializeAI();
  }

  // INICIALIZACIÓN INTELIGENTE DE IA
  private async initializeAI(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('🤖 Inicializando detector avanzado con IA...');
      
      // Usar modelo optimizado para segmentación precisa
      this.segmentationPipeline = await pipeline(
        'image-segmentation', 
        'Xenova/segformer-b0-finetuned-ade-512-512',
        {
          device: 'webgpu', // Usar WebGPU para máximo rendimiento
          dtype: 'fp16' // Precisión optimizada
        }
      );
      
      this.isInitialized = true;
      console.log('✅ Detector IA inicializado correctamente');
      
    } catch (error) {
      console.warn('⚠️ WebGPU no disponible, usando CPU:', error);
      
      try {
        // Fallback a CPU con modelo más ligero
        this.segmentationPipeline = await pipeline(
          'image-segmentation', 
          'Xenova/segformer-b0-finetuned-ade-512-512',
          {
            device: 'cpu',
            dtype: 'fp32'
          }
        );
        
        this.isInitialized = true;
        console.log('✅ Detector IA inicializado en CPU');
        
      } catch (cpuError) {
        console.error('❌ Error inicializando detector IA:', cpuError);
        throw cpuError;
      }
    }
  }

  // DETECCIÓN PRINCIPAL CON MÁXIMA PRECISIÓN
  async detectPredominantObject(imageData: ImageData): Promise<SegmentationResult> {
    const startTime = performance.now();
    
    try {
      // Asegurar que la IA esté inicializada
      if (!this.isInitialized) {
        await this.initializeAI();
      }

      console.log('🔍 Iniciando detección precisa del objeto predominante...');

      // 1. CONVERTIR IMAGEDATA A FORMATO COMPATIBLE
      const processedImage = await this.prepareImageForAI(imageData);
      
      // 2. SEGMENTACIÓN AVANZADA CON IA
      const segmentationResults = await this.segmentationPipeline(processedImage);
      
      // 3. PROCESAR RESULTADOS Y ENCONTRAR OBJETO PREDOMINANTE
      const detectedObjects = await this.processSegmentationResults(segmentationResults, imageData);
      
      // 4. IDENTIFICAR OBJETO MÁS PROMINENTE
      const predominantObject = this.findPredominantObject(detectedObjects);
      
      // 5. REFINAR CONTORNOS DEL OBJETO PREDOMINANTE
      if (predominantObject) {
        await this.refineObjectContours(predominantObject, imageData);
      }

      const processingTime = performance.now() - startTime;
      
      const result: SegmentationResult = {
        predominantObject,
        allObjects: detectedObjects,
        processingTime,
        confidence: predominantObject?.confidence || 0
      };

      console.log('✅ Detección precisa completada:', {
        objectsFound: detectedObjects.length,
        predominantArea: predominantObject?.area || 0,
        confidence: `${(result.confidence * 100).toFixed(1)}%`,
        processingTime: `${processingTime.toFixed(1)}ms`
      });

      return result;

    } catch (error) {
      console.error('❌ Error en detección avanzada:', error);
      
      // Fallback a detección tradicional mejorada
      return await this.fallbackDetection(imageData, startTime);
    }
  }

  // PREPARAR IMAGEN PARA IA
  private async prepareImageForAI(imageData: ImageData): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Optimizar resolución para balance precisión/velocidad
    const maxDimension = 512;
    let { width, height } = imageData;
    
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Redimensionar y mejorar imagen
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    // Aplicar mejoras de imagen antes de IA
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, width, height);
    
    // Mejorar contraste
    const processedImageData = ctx.getImageData(0, 0, width, height);
    this.enhanceImageContrast(processedImageData);
    ctx.putImageData(processedImageData, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // MEJORAR CONTRASTE DE IMAGEN
  private enhanceImageContrast(imageData: ImageData): void {
    const data = imageData.data;
    const factor = 1.2; // Factor de contraste
    
    for (let i = 0; i < data.length; i += 4) {
      // Aplicar mejora de contraste a RGB
      data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * factor) + 128));
      data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * factor) + 128));
      data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * factor) + 128));
    }
  }

  // PROCESAR RESULTADOS DE SEGMENTACIÓN
  private async processSegmentationResults(
    segmentationResults: any[], 
    originalImageData: ImageData
  ): Promise<DetectedObjectPrecise[]> {
    const detectedObjects: DetectedObjectPrecise[] = [];
    
    for (let i = 0; i < segmentationResults.length; i++) {
      const segment = segmentationResults[i];
      
      if (!segment.mask || !segment.mask.data) continue;
      
      try {
        // Convertir máscara a objeto detectado
        const detectedObject = await this.convertMaskToObject(segment, originalImageData, i);
        
        if (detectedObject.area > 1000) { // Filtrar objetos muy pequeños
          detectedObjects.push(detectedObject);
        }
        
      } catch (error) {
        console.warn(`Error procesando segmento ${i}:`, error);
      }
    }
    
    return detectedObjects.sort((a, b) => b.area - a.area); // Ordenar por área
  }

  // CONVERTIR MÁSCARA A OBJETO DETECTADO
  private async convertMaskToObject(
    segment: any, 
    originalImageData: ImageData, 
    id: number
  ): Promise<DetectedObjectPrecise> {
    const mask = segment.mask;
    const maskData = mask.data;
    
    // Encontrar boundingBox de la máscara
    let minX = originalImageData.width, minY = originalImageData.height;
    let maxX = 0, maxY = 0;
    let area = 0;
    let sumX = 0, sumY = 0;
    
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        const maskIndex = y * mask.width + x;
        const maskValue = maskData[maskIndex];
        
        if (maskValue > 0.5) { // Threshold para considerar píxel como parte del objeto
          const realX = Math.round((x / mask.width) * originalImageData.width);
          const realY = Math.round((y / mask.height) * originalImageData.height);
          
          minX = Math.min(minX, realX);
          minY = Math.min(minY, realY);
          maxX = Math.max(maxX, realX);
          maxY = Math.max(maxY, realY);
          
          area++;
          sumX += realX;
          sumY += realY;
        }
      }
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const centroid = { x: sumX / area, y: sumY / area };
    
    // Generar contornos precisos
    const contours = await this.generatePreciseContours(mask, originalImageData);
    
    // Crear máscara como ImageData
    const maskImageData = this.createMaskImageData(mask, originalImageData);
    
    // Calcular perímetro
    const perimeter = this.calculatePerimeter(contours);
    
    // Calcular confianza basada en área y coherencia
    const confidence = Math.min(1, (area / (width * height)) * (segment.score || 0.8));
    
    return {
      id: `ai_object_${id}`,
      confidence,
      boundingBox: { x: minX, y: minY, width, height },
      contours,
      mask: maskImageData,
      area,
      perimeter,
      centroid,
      isPredominant: false, // Se determinará después
      label: segment.label || 'object'
    };
  }

  // GENERAR CONTORNOS PRECISOS
  private async generatePreciseContours(mask: any, originalImageData: ImageData): Promise<number[][]> {
    const contours: number[][] = [];
    const visited = new Set<string>();
    const threshold = 0.5;
    
    // Implementar marching squares para contornos precisos
    for (let y = 0; y < mask.height - 1; y++) {
      for (let x = 0; x < mask.width - 1; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        // Obtener valores de la celda 2x2
        const topLeft = mask.data[y * mask.width + x] > threshold ? 1 : 0;
        const topRight = mask.data[y * mask.width + (x + 1)] > threshold ? 1 : 0;
        const bottomLeft = mask.data[(y + 1) * mask.width + x] > threshold ? 1 : 0;
        const bottomRight = mask.data[(y + 1) * mask.width + (x + 1)] > threshold ? 1 : 0;
        
        // Configuración de marching squares
        const config = topLeft * 8 + topRight * 4 + bottomRight * 2 + bottomLeft * 1;
        
        if (config !== 0 && config !== 15) { // Hay borde
          const realX = (x / mask.width) * originalImageData.width;
          const realY = (y / mask.height) * originalImageData.height;
          contours.push([realX, realY]);
          visited.add(key);
        }
      }
    }
    
    return contours;
  }

  // CREAR MASK COMO IMAGEDATA
  private createMaskImageData(mask: any, originalImageData: ImageData): ImageData {
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d')!;
    
    maskCanvas.width = originalImageData.width;
    maskCanvas.height = originalImageData.height;
    
    const maskImageData = maskCtx.createImageData(originalImageData.width, originalImageData.height);
    const maskPixels = maskImageData.data;
    
    // Escalar máscara al tamaño original
    for (let y = 0; y < originalImageData.height; y++) {
      for (let x = 0; x < originalImageData.width; x++) {
        const originalIndex = (y * originalImageData.width + x) * 4;
        
        // Mapear coordenadas a la máscara
        const maskX = Math.round((x / originalImageData.width) * mask.width);
        const maskY = Math.round((y / originalImageData.height) * mask.height);
        const maskIndex = maskY * mask.width + maskX;
        
        const maskValue = mask.data[maskIndex] || 0;
        const alpha = Math.round(maskValue * 255);
        
        maskPixels[originalIndex] = alpha;     // R
        maskPixels[originalIndex + 1] = alpha; // G
        maskPixels[originalIndex + 2] = alpha; // B
        maskPixels[originalIndex + 3] = alpha; // A
      }
    }
    
    return maskImageData;
  }

  // CALCULAR PERÍMETRO
  private calculatePerimeter(contours: number[][]): number {
    if (contours.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 1; i < contours.length; i++) {
      const [x1, y1] = contours[i - 1];
      const [x2, y2] = contours[i];
      perimeter += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    
    // Cerrar contorno
    const [x1, y1] = contours[contours.length - 1];
    const [x2, y2] = contours[0];
    perimeter += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    
    return perimeter;
  }

  // ENCONTRAR OBJETO PREDOMINANTE
  private findPredominantObject(objects: DetectedObjectPrecise[]): DetectedObjectPrecise | null {
    if (objects.length === 0) return null;
    
    // Ordenar por puntuación combinada: área × confianza
    const scoredObjects = objects.map(obj => ({
      ...obj,
      combinedScore: obj.area * obj.confidence
    })).sort((a, b) => b.combinedScore - a.combinedScore);
    
    const predominant = scoredObjects[0];
    predominant.isPredominant = true;
    
    return predominant;
  }

  // REFINAR CONTORNOS DEL OBJETO PREDOMINANTE
  private async refineObjectContours(object: DetectedObjectPrecise, imageData: ImageData): Promise<void> {
    // Aplicar suavizado de contornos
    object.contours = this.smoothContours(object.contours);
    
    // Recalcular perímetro con contornos refinados
    object.perimeter = this.calculatePerimeter(object.contours);
  }

  // SUAVIZAR CONTORNOS
  private smoothContours(contours: number[][]): number[][] {
    if (contours.length < 3) return contours;
    
    const smoothed: number[][] = [];
    const windowSize = 3;
    
    for (let i = 0; i < contours.length; i++) {
      let sumX = 0, sumY = 0, count = 0;
      
      for (let j = -Math.floor(windowSize / 2); j <= Math.floor(windowSize / 2); j++) {
        const index = (i + j + contours.length) % contours.length;
        sumX += contours[index][0];
        sumY += contours[index][1];
        count++;
      }
      
      smoothed.push([sumX / count, sumY / count]);
    }
    
    return smoothed;
  }

  // DETECCIÓN FALLBACK MEJORADA
  private async fallbackDetection(imageData: ImageData, startTime: number): Promise<SegmentationResult> {
    console.log('🔄 Usando detección fallback mejorada...');
    
    // Implementar detección de contornos mejorada sin IA
    const enhancedObject = await this.enhancedTraditionalDetection(imageData);
    
    return {
      predominantObject: enhancedObject,
      allObjects: enhancedObject ? [enhancedObject] : [],
      processingTime: performance.now() - startTime,
      confidence: enhancedObject?.confidence || 0
    };
  }

  // DETECCIÓN TRADICIONAL MEJORADA
  private async enhancedTraditionalDetection(imageData: ImageData): Promise<DetectedObjectPrecise | null> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    
    // Aplicar múltiples filtros para mejor detección
    const enhanced = this.applyEdgeEnhancementFilters(imageData);
    
    // Encontrar contornos usando algoritmo mejorado
    const contoursArray = this.findEnhancedContours(enhanced);
    
    if (contoursArray.length === 0) return null;
    
    // Crear objeto detectado con el contorno más grande
    const largestContour = contoursArray.reduce((largest, current) => 
      current.length > largest.length ? current : largest
    );
    
    const boundingBox = this.calculateBoundingBox(largestContour);
    const area = this.calculateContourArea(largestContour);
    const perimeter = this.calculatePerimeter(largestContour);
    const centroid = this.calculateCentroid(largestContour);
    
    return {
      id: 'fallback_object',
      confidence: 0.7,
      boundingBox,
      contours: largestContour,
      mask: enhanced, // Usar imagen procesada como máscara
      area,
      perimeter,
      centroid,
      isPredominant: true,
      label: 'detected_object'
    };
  }

  // APLICAR FILTROS DE MEJORA DE BORDES
  private applyEdgeEnhancementFilters(imageData: ImageData): ImageData {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    
    // Aplicar filtro de sharpening
    ctx.filter = 'contrast(1.3) brightness(1.1) saturate(1.2)';
    ctx.drawImage(canvas, 0, 0);
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // ENCONTRAR CONTORNOS MEJORADOS
  private findEnhancedContours(imageData: ImageData): number[][][] {
    // Implementación simplificada de detección de contornos
    const contours: number[][][] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Detectar bordes usando Sobel
    const edges = this.applySobelEdgeDetection(imageData);
    const visited = new Array(width * height).fill(false);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        
        if (!visited[index] && edges[index] > 128) {
          const contour = this.traceContour(edges, width, height, x, y, visited);
          if (contour.length > 50) { // Filtrar contornos muy pequeños
            contours.push(contour);
          }
        }
      }
    }
    
    return contours;
  }

  // APLICAR DETECCIÓN DE BORDES SOBEL
  private applySobelEdgeDetection(imageData: ImageData): Uint8Array {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const edges = new Uint8Array(width * height);
    
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            
            gx += gray * sobelX[kernelIndex];
            gy += gray * sobelY[kernelIndex];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = Math.min(255, magnitude);
      }
    }
    
    return edges;
  }

  // TRAZAR CONTORNO
  private traceContour(
    edges: Uint8Array, 
    width: number, 
    height: number, 
    startX: number, 
    startY: number, 
    visited: boolean[]
  ): number[][] {
    const contour: number[][] = [];
    const stack: Array<[number, number]> = [[startX, startY]];
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const index = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[index] || edges[index] < 128) {
        continue;
      }
      
      visited[index] = true;
      contour.push([x, y]);
      
      // Agregar vecinos
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push([x + dx, y + dy]);
        }
      }
    }
    
    return contour;
  }

  // CALCULAR BOUNDING BOX
  private calculateBoundingBox(contour: number[][]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const [x, y] of contour) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  // CALCULAR ÁREA DEL CONTORNO
  private calculateContourArea(contour: number[][]): number {
    if (contour.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i][0] * contour[j][1];
      area -= contour[j][0] * contour[i][1];
    }
    
    return Math.abs(area) / 2;
  }

  // CALCULAR CENTROIDE
  private calculateCentroid(contour: number[][]): { x: number; y: number } {
    let sumX = 0, sumY = 0;
    
    for (const [x, y] of contour) {
      sumX += x;
      sumY += y;
    }
    
    return {
      x: sumX / contour.length,
      y: sumY / contour.length
    };
  }

  // VERIFICAR SI ESTÁ INICIALIZADO
  isReady(): boolean {
    return this.isInitialized;
  }

  // LIMPIAR RECURSOS
  cleanup(): void {
    this.segmentationPipeline = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// INSTANCIA SINGLETON
export const advancedObjectDetector = new AdvancedObjectDetector();

// HOOK PARA USAR EL DETECTOR AVANZADO
export const useAdvancedObjectDetection = () => {
  return {
    detectPredominantObject: advancedObjectDetector.detectPredominantObject.bind(advancedObjectDetector),
    isReady: advancedObjectDetector.isReady.bind(advancedObjectDetector),
    cleanup: advancedObjectDetector.cleanup.bind(advancedObjectDetector)
  };
};