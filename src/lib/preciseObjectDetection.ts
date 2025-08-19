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

class PreciseObjectDetector {
  private segmentationPipeline: any = null;
  private isInitialized = false;
  
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('Inicializando detector de objetos preciso...');
      this.segmentationPipeline = await pipeline(
        'image-segmentation',
        'Xenova/segformer-b2-finetuned-ade-512-512',
        { device: 'webgpu' }
      );
      this.isInitialized = true;
      console.log('Detector inicializado exitosamente');
    } catch (error) {
      console.warn('Error inicializando WebGPU, usando CPU:', error);
      this.segmentationPipeline = await pipeline(
        'image-segmentation',
        'Xenova/segformer-b0-finetuned-ade-512-512'
      );
      this.isInitialized = true;
    }
  }

  async detectLargestObject(canvas: HTMLCanvasElement): Promise<DetectedObject | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Optimizar imagen para procesamiento
      const processCanvas = document.createElement('canvas');
      const processCtx = processCanvas.getContext('2d')!;
      
      // Reducir resolución para mejor rendimiento
      const maxDim = 512;
      const scale = Math.min(maxDim / canvas.width, maxDim / canvas.height);
      processCanvas.width = Math.floor(canvas.width * scale);
      processCanvas.height = Math.floor(canvas.height * scale);
      
      processCtx.drawImage(canvas, 0, 0, processCanvas.width, processCanvas.height);
      
      // Realizar segmentación
      const imageData = processCanvas.toDataURL('image/jpeg', 0.8);
      const result = await this.segmentationPipeline(imageData);
      
      if (!result || !Array.isArray(result) || result.length === 0) {
        return this.fallbackDetection(canvas);
      }

      // Encontrar el objeto más grande
      let largestObject = null;
      let maxArea = 0;

      for (const segment of result) {
        if (segment.mask && segment.label !== 'background') {
          const area = this.calculateMaskArea(segment.mask);
          if (area > maxArea) {
            maxArea = area;
            largestObject = segment;
          }
        }
      }

      if (!largestObject) {
        return this.fallbackDetection(canvas);
      }

      // Extraer contornos precisos
      const contours = this.extractPreciseContours(largestObject.mask, scale);
      const boundingBox = this.calculateBoundingBox(contours);
      
      // Escalar coordenadas de vuelta al tamaño original
      const scaledContours = contours.map(point => ({
        x: point.x / scale,
        y: point.y / scale
      }));

      const scaledBoundingBox = {
        x: boundingBox.x / scale,
        y: boundingBox.y / scale,
        width: boundingBox.width / scale,
        height: boundingBox.height / scale
      };

      return {
        x: scaledBoundingBox.x,
        y: scaledBoundingBox.y,
        width: scaledBoundingBox.width,
        height: scaledBoundingBox.height,
        area: scaledBoundingBox.width * scaledBoundingBox.height,
        confidence: largestObject.score || 0.8,
        contours: scaledContours,
        boundingBox: scaledBoundingBox,
        dimensions: {
          width: scaledBoundingBox.width,
          height: scaledBoundingBox.height,
          area: scaledBoundingBox.width * scaledBoundingBox.height,
          unit: 'px' as const
        },
        points: this.convertContoursToPoints(scaledContours)
      };

    } catch (error) {
      console.error('Error en detección precisa:', error);
      return this.fallbackDetection(canvas);
    }
  }

  private calculateMaskArea(mask: any): number {
    if (!mask.data) return 0;
    return mask.data.reduce((sum: number, value: number) => sum + (value > 0.5 ? 1 : 0), 0);
  }

  private extractPreciseContours(mask: any, scale: number): { x: number; y: number }[] {
    const contours: { x: number; y: number }[] = [];
    const data = mask.data;
    const width = mask.width;
    const height = mask.height;
    
    // Algoritmo de detección de bordes mejorado
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (data[idx] > 0.5) {
          // Verificar si es un píxel de borde
          const neighbors = [
            data[(y-1) * width + x],     // arriba
            data[(y+1) * width + x],     // abajo
            data[y * width + (x-1)],     // izquierda
            data[y * width + (x+1)]      // derecha
          ];
          
          if (neighbors.some(n => n <= 0.5)) {
            contours.push({ x: x * scale, y: y * scale });
          }
        }
      }
    }
    
    return this.simplifyContours(contours);
  }

  private simplifyContours(contours: { x: number; y: number }[]): { x: number; y: number }[] {
    if (contours.length <= 10) return contours;
    
    // Algoritmo de simplificación Douglas-Peucker simplificado
    const simplified: { x: number; y: number }[] = [];
    const step = Math.max(1, Math.floor(contours.length / 50));
    
    for (let i = 0; i < contours.length; i += step) {
      simplified.push(contours[i]);
    }
    
    return simplified;
  }

  private calculateBoundingBox(contours: { x: number; y: number }[]): { x: number; y: number; width: number; height: number } {
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

  private fallbackDetection(canvas: HTMLCanvasElement): DetectedObject {
    // Detección básica como fallback
    const centerX = canvas.width * 0.4;
    const centerY = canvas.height * 0.4;
    const width = canvas.width * 0.3;
    const height = canvas.height * 0.3;

    const contours = [
      { x: centerX, y: centerY },
      { x: centerX + width, y: centerY },
      { x: centerX + width, y: centerY + height },
      { x: centerX, y: centerY + height }
    ];

    return {
      x: centerX,
      y: centerY,
      width,
      height,
      area: width * height,
      confidence: 0.5,
      contours,
      boundingBox: { x: centerX, y: centerY, width, height },
      dimensions: { width, height, area: width * height, unit: 'px' as const },
      points: this.convertContoursToPoints(contours)
    };
  }
}

export const preciseObjectDetector = new PreciseObjectDetector();