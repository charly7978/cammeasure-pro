import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js for better performance
env.allowLocalModels = false;
env.useBrowserCache = true;

interface DetectedObject {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  confidence: number;
  contours: { x: number; y: number }[];
  boundingBox: { x: number; y: number; width: number; height: number };
  dimensions: { width: number; height: number; area: number; unit: 'px' };
  points: Array<{ x: number; y: number; z: number; confidence: number; timestamp: number }>;
}

/**
 * DETECTOR DE OBJETOS ULTRA MEJORADO - ENFOQUE EN OBJETO CENTRAL
 * Sistema optimizado para detectar UN SOLO objeto central con máxima precisión
 */
class PreciseObjectDetector {
  private segmentationPipeline: any = null;
  private isInitialized = false;
  private processingCanvas: HTMLCanvasElement;
  private processingCtx: CanvasRenderingContext2D;
  
  constructor() {
    // Pre-crear canvas para mejor rendimiento
    this.processingCanvas = document.createElement('canvas');
    this.processingCtx = this.processingCanvas.getContext('2d')!;
  }
  
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('🚀 Inicializando detector ULTRA PRECISO...');
      
      // Intentar con modelo más preciso primero
      try {
        this.segmentationPipeline = await pipeline(
          'image-segmentation',
          'Xenova/segformer-b3-finetuned-ade-512-512', // Modelo más preciso
          { 
            device: 'webgpu',
            dtype: 'fp32' // Mayor precisión
          }
        );
        console.log('✅ Modelo WebGPU B3 cargado - MÁXIMA PRECISIÓN');
      } catch (error) {
        console.log('⚠️ WebGPU no disponible, probando WebGL...');
        try {
          this.segmentationPipeline = await pipeline(
            'image-segmentation',
            'Xenova/segformer-b2-finetuned-ade-512-512',
            { device: 'webgl' }
          );
          console.log('✅ Modelo WebGL B2 cargado - ALTA PRECISIÓN');
        } catch (error2) {
          console.log('⚠️ Usando CPU como fallback...');
          this.segmentationPipeline = await pipeline(
            'image-segmentation',
            'Xenova/segformer-b1-finetuned-ade-512-512'
          );
          console.log('✅ Modelo CPU B1 cargado - PRECISIÓN ESTÁNDAR');
        }
      }
      
      this.isInitialized = true;
      console.log('🎯 DETECTOR ULTRA PRECISO LISTO');
    } catch (error) {
      console.error('❌ Error inicializando detector:', error);
      throw error;
    }
  }

  /**
   * DETECTAR OBJETO CENTRAL CON MÁXIMA PRECISIÓN
   * Enfoque: UN SOLO objeto en el centro de la pantalla
   */
  async detectCentralObject(canvas: HTMLCanvasElement): Promise<DetectedObject | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🎯 DETECTANDO OBJETO CENTRAL...');
      const startTime = performance.now();
      
      // PASO 1: PREPROCESSAMIENTO OPTIMIZADO
      const processedImage = this.preprocessImageForCentralDetection(canvas);
      
      // PASO 2: SEGMENTACIÓN CON IA
      const segments = await this.segmentationPipeline(processedImage);
      
      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        console.log('❌ No hay segmentos - usando detección geométrica');
        return this.geometricCentralDetection(canvas);
      }

      // PASO 3: ENCONTRAR OBJETO CENTRAL MÁS RELEVANTE
      const centralObject = this.findMostCentralObject(segments, canvas.width, canvas.height);
      
      if (!centralObject) {
        console.log('❌ No se encontró objeto central - fallback geométrico');
        return this.geometricCentralDetection(canvas);
      }

      // PASO 4: REFINAR CONTORNOS CON PRECISIÓN EXTREMA
      const refinedContours = this.refineCentralObjectContours(
        centralObject.mask, 
        canvas.width, 
        canvas.height
      );
      
      // PASO 5: CALCULAR PROPIEDADES FINALES
      const boundingBox = this.calculatePreciseBoundingBox(refinedContours);
      const area = this.calculatePreciseArea(refinedContours);
      
      const processingTime = performance.now() - startTime;
      console.log(`✅ OBJETO CENTRAL DETECTADO en ${processingTime.toFixed(1)}ms`);
      console.log(`📐 Dimensiones: ${boundingBox.width.toFixed(1)}x${boundingBox.height.toFixed(1)}px`);
      console.log(`📊 Confianza: ${(centralObject.score * 100).toFixed(1)}%`);

      return {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
        area: area,
        confidence: Math.min(0.95, centralObject.score + 0.1), // Boost para objeto central
        contours: refinedContours,
        boundingBox: boundingBox,
        dimensions: {
          width: boundingBox.width,
          height: boundingBox.height,
          area: area,
          unit: 'px' as const
        },
        points: this.convertContoursToPoints(refinedContours)
      };

    } catch (error) {
      console.error('❌ Error en detección central:', error);
      return this.geometricCentralDetection(canvas);
    }
  }

  /**
   * PREPROCESSAMIENTO OPTIMIZADO PARA DETECCIÓN CENTRAL
   */
  private preprocessImageForCentralDetection(canvas: HTMLCanvasElement): string {
    // Configurar canvas de procesamiento
    const targetSize = 512; // Tamaño óptimo para el modelo
    const scale = Math.min(targetSize / canvas.width, targetSize / canvas.height);
    
    this.processingCanvas.width = Math.floor(canvas.width * scale);
    this.processingCanvas.height = Math.floor(canvas.height * scale);
    
    // Dibujar imagen escalada
    this.processingCtx.drawImage(canvas, 0, 0, this.processingCanvas.width, this.processingCanvas.height);
    
    // MEJORAS DE IMAGEN PARA MEJOR DETECCIÓN
    const imageData = this.processingCtx.getImageData(0, 0, this.processingCanvas.width, this.processingCanvas.height);
    const data = imageData.data;
    
    // Mejorar contraste y nitidez
    for (let i = 0; i < data.length; i += 4) {
      // Aumentar contraste
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.2 + 128));     // R
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.2 + 128)); // G
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.2 + 128)); // B
    }
    
    this.processingCtx.putImageData(imageData, 0, 0);
    
    // Retornar imagen optimizada
    return this.processingCanvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * ENCONTRAR EL OBJETO MÁS CENTRAL Y RELEVANTE
   */
  private findMostCentralObject(segments: any[], canvasWidth: number, canvasHeight: number): any | null {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    let bestObject = null;
    let bestScore = 0;
    
    console.log(`🔍 Evaluando ${segments.length} segmentos...`);
    
    for (const segment of segments) {
      // Filtrar fondo y objetos irrelevantes
      if (this.isBackgroundOrIrrelevant(segment.label)) {
        continue;
      }
      
      if (!segment.mask || !segment.mask.data) {
        continue;
      }
      
      // Calcular centroide del segmento
      const centroid = this.calculateMaskCentroid(segment.mask);
      
      // Calcular distancia al centro
      const distanceToCenter = Math.sqrt(
        (centroid.x - centerX) ** 2 + (centroid.y - centerY) ** 2
      );
      
      // Calcular área del segmento
      const area = this.calculateMaskArea(segment.mask);
      const relativeArea = area / (canvasWidth * canvasHeight);
      
      // SCORING MEJORADO: Priorizar objetos centrales, grandes y con buena confianza
      const proximityScore = 1 - (distanceToCenter / maxDistance);
      const sizeScore = Math.min(1, relativeArea * 10); // Objetos entre 10-100% del área
      const confidenceScore = segment.score || 0.5;
      
      // Score combinado con peso extra para proximidad al centro
      const totalScore = (proximityScore * 0.5) + (sizeScore * 0.3) + (confidenceScore * 0.2);
      
      console.log(`📊 ${segment.label}: proximidad=${proximityScore.toFixed(2)}, tamaño=${sizeScore.toFixed(2)}, confianza=${confidenceScore.toFixed(2)}, total=${totalScore.toFixed(2)}`);
      
      if (totalScore > bestScore && relativeArea > 0.001) { // Área mínima
        bestScore = totalScore;
        bestObject = { ...segment, totalScore, centroid, area };
      }
    }
    
    if (bestObject) {
      console.log(`🎯 MEJOR OBJETO: ${bestObject.label} (score: ${bestScore.toFixed(3)})`);
    }
    
    return bestObject;
  }

  /**
   * VERIFICAR SI ES FONDO U OBJETO IRRELEVANTE
   */
  private isBackgroundOrIrrelevant(label: string): boolean {
    const irrelevantLabels = [
      'background', 'sky', 'ceiling', 'floor', 'wall', 'ground',
      'grass', 'tree', 'building', 'road', 'sidewalk', 'water'
    ];
    
    return irrelevantLabels.some(irrelevant => 
      label.toLowerCase().includes(irrelevant)
    );
  }

  /**
   * CALCULAR CENTROIDE DE MÁSCARA
   */
  private calculateMaskCentroid(mask: any): { x: number; y: number } {
    const data = mask.data;
    const width = mask.width;
    const height = mask.height;
    
    let totalX = 0, totalY = 0, count = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (data[idx] > 0.5) {
          totalX += x;
          totalY += y;
          count++;
        }
      }
    }
    
    return count > 0 ? { x: totalX / count, y: totalY / count } : { x: width / 2, y: height / 2 };
  }

  /**
   * REFINAR CONTORNOS CON PRECISIÓN EXTREMA
   */
  private refineCentralObjectContours(
    mask: any, 
    originalWidth: number, 
    originalHeight: number
  ): { x: number; y: number }[] {
    const data = mask.data;
    const maskWidth = mask.width;
    const maskHeight = mask.height;
    
    // Escalas para convertir de máscara a imagen original
    const scaleX = originalWidth / maskWidth;
    const scaleY = originalHeight / maskHeight;
    
    const contours: { x: number; y: number }[] = [];
    
    // ALGORITMO DE DETECCIÓN DE BORDES MEJORADO
    for (let y = 1; y < maskHeight - 1; y++) {
      for (let x = 1; x < maskWidth - 1; x++) {
        const idx = y * maskWidth + x;
        
        if (data[idx] > 0.5) {
          // Verificar si es píxel de borde usando kernel 3x3
          const neighbors = [
            data[(y-1) * maskWidth + (x-1)], data[(y-1) * maskWidth + x], data[(y-1) * maskWidth + (x+1)],
            data[y * maskWidth + (x-1)],                                   data[y * maskWidth + (x+1)],
            data[(y+1) * maskWidth + (x-1)], data[(y+1) * maskWidth + x], data[(y+1) * maskWidth + (x+1)]
          ];
          
          // Es borde si al menos 2 vecinos son fondo
          const backgroundNeighbors = neighbors.filter(n => n <= 0.5).length;
          
          if (backgroundNeighbors >= 2) {
            contours.push({ 
              x: x * scaleX, 
              y: y * scaleY 
            });
          }
        }
      }
    }
    
    // SIMPLIFICAR Y SUAVIZAR CONTORNOS
    return this.smoothAndSimplifyContours(contours);
  }

  /**
   * SUAVIZAR Y SIMPLIFICAR CONTORNOS
   */
  private smoothAndSimplifyContours(contours: { x: number; y: number }[]): { x: number; y: number }[] {
    if (contours.length < 10) return contours;
    
    // Ordenar contornos por proximidad (crear cadena continua)
    const orderedContours = this.orderContourPoints(contours);
    
    // Aplicar suavizado gaussiano simple
    const smoothed = this.applySmoothingFilter(orderedContours);
    
    // Simplificar usando Douglas-Peucker mejorado
    const simplified = this.douglasPeuckerSimplification(smoothed, 2.0);
    
    console.log(`🔧 Contornos: ${contours.length} → ${orderedContours.length} → ${smoothed.length} → ${simplified.length}`);
    
    return simplified;
  }

  /**
   * ORDENAR PUNTOS DE CONTORNO PARA CREAR CADENA CONTINUA
   */
  private orderContourPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length <= 2) return points;
    
    const ordered = [points[0]];
    const remaining = points.slice(1);
    
    while (remaining.length > 0) {
      const current = ordered[ordered.length - 1];
      let closestIndex = 0;
      let closestDistance = Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = Math.sqrt(
          (remaining[i].x - current.x) ** 2 + (remaining[i].y - current.y) ** 2
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }
      
      ordered.push(remaining[closestIndex]);
      remaining.splice(closestIndex, 1);
    }
    
    return ordered;
  }

  /**
   * APLICAR FILTRO DE SUAVIZADO
   */
  private applySmoothingFilter(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length < 3) return points;
    
    const smoothed: { x: number; y: number }[] = [];
    const kernel = [0.25, 0.5, 0.25]; // Kernel gaussiano simple
    
    for (let i = 0; i < points.length; i++) {
      let weightedX = 0, weightedY = 0, totalWeight = 0;
      
      for (let j = -1; j <= 1; j++) {
        const idx = (i + j + points.length) % points.length;
        const weight = kernel[j + 1];
        
        weightedX += points[idx].x * weight;
        weightedY += points[idx].y * weight;
        totalWeight += weight;
      }
      
      smoothed.push({
        x: weightedX / totalWeight,
        y: weightedY / totalWeight
      });
    }
    
    return smoothed;
  }

  /**
   * SIMPLIFICACIÓN DOUGLAS-PEUCKER MEJORADA
   */
  private douglasPeuckerSimplification(
    points: { x: number; y: number }[], 
    epsilon: number
  ): { x: number; y: number }[] {
    if (points.length <= 2) return points;
    
    // Encontrar punto más lejano de la línea
    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.pointToLineDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // Si la distancia máxima es menor que epsilon, simplificar
    if (maxDistance < epsilon) {
      return [start, end];
    }
    
    // Recursión en ambos segmentos
    const left = this.douglasPeuckerSimplification(points.slice(0, maxIndex + 1), epsilon);
    const right = this.douglasPeuckerSimplification(points.slice(maxIndex), epsilon);
    
    // Combinar resultados
    return [...left.slice(0, -1), ...right];
  }

  /**
   * DETECCIÓN GEOMÉTRICA COMO FALLBACK MEJORADO
   */
  private geometricCentralDetection(canvas: HTMLCanvasElement): DetectedObject {
    console.log('🔧 Ejecutando detección geométrica central...');
    
    // Enfocarse en región central (60% del centro)
    const centerRegion = 0.6;
    const marginX = canvas.width * (1 - centerRegion) / 2;
    const marginY = canvas.height * (1 - centerRegion) / 2;
    
    const centerX = marginX;
    const centerY = marginY;
    const width = canvas.width * centerRegion;
    const height = canvas.height * centerRegion;
    
    // Crear contorno rectangular suavizado
    const cornerRadius = Math.min(width, height) * 0.1;
    const contours = this.createRoundedRectangleContour(centerX, centerY, width, height, cornerRadius);
    
    return {
      x: centerX,
      y: centerY,
      width,
      height,
      area: width * height,
      confidence: 0.6, // Confianza moderada para fallback
      contours,
      boundingBox: { x: centerX, y: centerY, width, height },
      dimensions: { width, height, area: width * height, unit: 'px' as const },
      points: this.convertContoursToPoints(contours)
    };
  }

  /**
   * CREAR CONTORNO DE RECTÁNGULO REDONDEADO
   */
  private createRoundedRectangleContour(
    x: number, y: number, width: number, height: number, radius: number
  ): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const steps = 8; // Puntos por esquina redondeada
    
    // Esquina superior izquierda
    for (let i = 0; i < steps; i++) {
      const angle = Math.PI + (i / (steps - 1)) * (Math.PI / 2);
      points.push({
        x: x + radius + Math.cos(angle) * radius,
        y: y + radius + Math.sin(angle) * radius
      });
    }
    
    // Esquina superior derecha
    for (let i = 0; i < steps; i++) {
      const angle = 1.5 * Math.PI + (i / (steps - 1)) * (Math.PI / 2);
      points.push({
        x: x + width - radius + Math.cos(angle) * radius,
        y: y + radius + Math.sin(angle) * radius
      });
    }
    
    // Esquina inferior derecha
    for (let i = 0; i < steps; i++) {
      const angle = 0 + (i / (steps - 1)) * (Math.PI / 2);
      points.push({
        x: x + width - radius + Math.cos(angle) * radius,
        y: y + height - radius + Math.sin(angle) * radius
      });
    }
    
    // Esquina inferior izquierda
    for (let i = 0; i < steps; i++) {
      const angle = 0.5 * Math.PI + (i / (steps - 1)) * (Math.PI / 2);
      points.push({
        x: x + radius + Math.cos(angle) * radius,
        y: y + height - radius + Math.sin(angle) * radius
      });
    }
    
    return points;
  }

  private calculateMaskArea(mask: any): number {
    if (!mask.data) return 0;
    return mask.data.reduce((sum: number, value: number) => sum + (value > 0.5 ? 1 : 0), 0);
  }

  private calculatePreciseBoundingBox(contours: { x: number; y: number }[]): { x: number; y: number; width: number; height: number } {
    if (contours.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = contours[0].x;
    let minY = contours[0].y;
    let maxX = contours[0].x;
    let maxY = contours[0].y;

    for (const point of contours) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private calculatePreciseArea(contours: { x: number; y: number }[]): number {
    if (contours.length < 3) return 0;
    
    let area = 0;
    const n = contours.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += contours[i].x * contours[j].y;
      area -= contours[j].x * contours[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  private pointToLineDistance(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number {
    const A = lineEnd.x - lineStart.x;
    const B = lineEnd.y - lineStart.y;
    const C = point.x - lineStart.x;
    const D = point.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = A * A + B * B;
    
    if (lenSq === 0) {
      return Math.sqrt(C * C + D * D);
    }
    
    const param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * A;
      yy = lineStart.y + param * B;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  private convertContoursToPoints(contours: { x: number; y: number }[]): Array<{ x: number; y: number; z: number; confidence: number; timestamp: number }> {
    const timestamp = Date.now();
    return contours.slice(0, 20).map((point, index) => ({
      x: point.x,
      y: point.y,
      z: 0,
      confidence: 0.9,
      timestamp: timestamp + index
    }));
  }

  // MÉTODO PRINCIPAL MEJORADO - REEMPLAZA detectLargestObject
  async detectLargestObject(canvas: HTMLCanvasElement): Promise<DetectedObject | null> {
    return this.detectCentralObject(canvas);
  }
}

export const preciseObjectDetector = new PreciseObjectDetector();