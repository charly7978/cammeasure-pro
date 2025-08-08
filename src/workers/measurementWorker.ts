import { BoundingRect, detectContours } from '../lib/imageProcessing';

// Declaraciones para el worker
declare const self: any;
declare function importScripts(...urls: string[]): void;

// Worker de medición avanzado con algoritmos de computer vision robustos
class AdvancedMeasurementWorker {
  private cv: any;
  private isReady: boolean = false;
  private processingQueue: Array<any> = [];

  constructor() {
    this.initializeOpenCV();
  }

  private async initializeOpenCV() {
    try {
      // Cargar OpenCV.js
      importScripts('https://docs.opencv.org/4.8.0/opencv.js');
      
      // Esperar a que OpenCV esté listo
      const checkOpenCV = () => {
        if (typeof cv !== 'undefined' && cv.Mat) {
          this.cv = cv;
          this.isReady = true;
          self.postMessage({ type: 'READY' });
          console.log('OpenCV avanzado cargado correctamente en worker');
          
          // Procesar elementos en cola
          this.processingQueue.forEach(item => this.processDetection(item));
          this.processingQueue = [];
        } else {
          setTimeout(checkOpenCV, 100);
        }
      };
      
      setTimeout(checkOpenCV, 100);
    } catch (error) {
      console.error('Error cargando OpenCV:', error);
      self.postMessage({ type: 'ERROR', error: error.message });
    }
  }

  // Algoritmo de detección de contornos multi-escala mejorado
  private detectContoursAdvanced(imageData: ImageData, minArea: number): BoundingRect[] {
    if (!this.cv || !this.isReady) return [];

    const src = this.cv.matFromImageData(imageData);
    const gray = new this.cv.Mat();
    const results: BoundingRect[] = [];

    try {
      // Conversión a escala de grises
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);

      // Múltiples escalas de procesamiento para mejor detección
      const scales = [
        { blur: 3, canny1: 30, canny2: 90, morph: 2 },   // Objetos finos
        { blur: 5, canny1: 50, canny2: 150, morph: 3 },  // Objetos medianos
        { blur: 7, canny1: 80, canny2: 200, morph: 4 }   // Objetos grandes
      ];

      const allContours: any[] = [];

      for (const scale of scales) {
        const processed = this.processImageScale(gray, scale);
        const scaleContours = this.findContoursRobust(processed, minArea);
        allContours.push(...scaleContours);
        processed.delete();
      }

      // Fusionar y filtrar contornos
      const mergedContours = this.mergeOverlappingContours(allContours);
      const validatedContours = this.validateContours(mergedContours, imageData.width, imageData.height);

      results.push(...validatedContours);

      // Limpiar memoria
      allContours.forEach(contour => {
        if (contour && contour.delete) contour.delete();
      });

    } catch (error) {
      console.error('Error en detección avanzada:', error);
    } finally {
      src.delete();
      gray.delete();
    }

    return results;
  }

  private processImageScale(gray: any, scale: any): any {
    const blurred = new this.cv.Mat();
    const edges = new this.cv.Mat();
    const morphed = new this.cv.Mat();

    try {
      // Desenfoque adaptativo
      this.cv.GaussianBlur(gray, blurred, new this.cv.Size(scale.blur, scale.blur), 0);

      // Detección de bordes Canny optimizada
      this.cv.Canny(blurred, edges, scale.canny1, scale.canny2, 3, true);

      // Operaciones morfológicas avanzadas
      const kernel = this.cv.getStructuringElement(
        this.cv.MORPH_ELLIPSE, 
        new this.cv.Size(scale.morph, scale.morph)
      );
      
      // Closing para conectar contornos fragmentados
      this.cv.morphologyEx(edges, morphed, this.cv.MORPH_CLOSE, kernel);
      
      // Opening para eliminar ruido
      this.cv.morphologyEx(morphed, morphed, this.cv.MORPH_OPEN, kernel);

      kernel.delete();
      blurred.delete();
      edges.delete();

      return morphed;
    } catch (error) {
      blurred.delete();
      edges.delete();
      morphed.delete();
      throw error;
    }
  }

  private findContoursRobust(processedImage: any, minArea: number): any[] {
    const contours = new this.cv.MatVector();
    const hierarchy = new this.cv.Mat();
    const results: any[] = [];

    try {
      this.cv.findContours(
        processedImage, 
        contours, 
        hierarchy, 
        this.cv.RETR_EXTERNAL, 
        this.cv.CHAIN_APPROX_SIMPLE
      );

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = this.cv.contourArea(contour);
        
        if (area >= minArea) {
          // Aproximación poligonal para suavizar contornos
          const approx = new this.cv.Mat();
          const epsilon = 0.02 * this.cv.arcLength(contour, true);
          this.cv.approxPolyDP(contour, approx, epsilon, true);

          // Calcular bounding rect
          const rect = this.cv.boundingRect(approx);
          
          // Calcular métricas de calidad
          const perimeter = this.cv.arcLength(contour, true);
          const aspectRatio = rect.width / rect.height;
          const extent = area / (rect.width * rect.height);
          const solidity = area / this.cv.contourArea(this.cv.convexHull(contour, new this.cv.Mat(), false));

          // Confianza basada en métricas geométricas
          let confidence = this.calculateContourConfidence({
            area,
            perimeter,
            aspectRatio,
            extent,
            solidity,
            rect
          });

          if (confidence > 0.3) { // Umbral de confianza
            results.push({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              area: area,
              confidence: confidence,
              contour: contour.clone() // Clonar para uso posterior
            });
          }

          approx.delete();
        }
        
        contour.delete();
      }
    } catch (error) {
      console.error('Error encontrando contornos:', error);
    } finally {
      contours.delete();
      hierarchy.delete();
    }

    return results;
  }

  private calculateContourConfidence(metrics: any): number {
    const { area, perimeter, aspectRatio, extent, solidity, rect } = metrics;
    
    let confidence = 0.5; // Base
    
    // Penalizar formas muy alargadas o muy planas
    if (aspectRatio > 0.2 && aspectRatio < 5) confidence += 0.2;
    
    // Premiar objetos compactos
    if (extent > 0.6) confidence += 0.15;
    
    // Premiar formas sólidas (no huecas)
    if (solidity > 0.8) confidence += 0.1;
    
    // Premiar tamaño razonable
    if (area > 2000 && area < 50000) confidence += 0.1;
    
    // Penalizar objetos muy pequeños o muy grandes
    if (rect.width < 20 || rect.height < 20) confidence -= 0.2;
    if (rect.width > 800 || rect.height > 800) confidence -= 0.1;
    
    // Factor de forma (circularidad aproximada)
    const circularity = 4 * Math.PI * area / (perimeter * perimeter);
    if (circularity > 0.3) confidence += 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private mergeOverlappingContours(contours: any[]): any[] {
    if (contours.length <= 1) return contours;

    const merged: any[] = [];
    const used = new Set<number>();

    for (let i = 0; i < contours.length; i++) {
      if (used.has(i)) continue;

      const group = [contours[i]];
      used.add(i);

      // Buscar contornos superpuestos
      for (let j = i + 1; j < contours.length; j++) {
        if (used.has(j)) continue;

        if (this.isOverlapping(contours[i], contours[j], 0.3)) {
          group.push(contours[j]);
          used.add(j);
        }
      }

      // Si hay múltiples contornos, fusionar
      if (group.length > 1) {
        const fusedContour = this.fuseContours(group);
        merged.push(fusedContour);
      } else {
        merged.push(contours[i]);
      }
    }

    return merged;
  }

  private isOverlapping(contour1: any, contour2: any, threshold: number): boolean {
    const rect1 = contour1;
    const rect2 = contour2;
    
    const x1 = Math.max(rect1.x, rect2.x);
    const y1 = Math.max(rect1.y, rect2.y);
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
    
    if (x1 >= x2 || y1 >= y2) return false;
    
    const overlapArea = (x2 - x1) * (y2 - y1);
    const area1 = rect1.width * rect1.height;
    const area2 = rect2.width * rect2.height;
    const minArea = Math.min(area1, area2);
    
    return (overlapArea / minArea) > threshold;
  }

  private fuseContours(contours: any[]): any {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let totalArea = 0;
    let maxConfidence = 0;

    for (const contour of contours) {
      minX = Math.min(minX, contour.x);
      minY = Math.min(minY, contour.y);
      maxX = Math.max(maxX, contour.x + contour.width);
      maxY = Math.max(maxY, contour.y + contour.height);
      totalArea += contour.area;
      maxConfidence = Math.max(maxConfidence, contour.confidence);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      area: totalArea,
      confidence: maxConfidence * 0.9 // Penalizar ligeramente fusiones
    };
  }

  private validateContours(contours: any[], imageWidth: number, imageHeight: number): BoundingRect[] {
    return contours
      .filter(contour => {
        const { x, y, width, height, area, confidence } = contour;
        
        // Validaciones geométricas
        const withinBounds = x >= 5 && y >= 5 && 
                            x + width <= imageWidth - 5 && 
                            y + height <= imageHeight - 5;
        
        const reasonableSize = width >= 15 && height >= 15 &&
                              width <= imageWidth * 0.8 && 
                              height <= imageHeight * 0.8;
        
        const aspectRatioOk = (width / height) >= 0.1 && (width / height) <= 10;
        
        const areaRatioOk = area >= (width * height * 0.3);
        
        const confidenceOk = confidence >= 0.4;
        
        return withinBounds && reasonableSize && aspectRatioOk && areaRatioOk && confidenceOk;
      })
      .map(contour => ({
        x: contour.x,
        y: contour.y,
        width: contour.width,
        height: contour.height,
        area: contour.area,
        confidence: contour.confidence
      }))
      .sort((a, b) => b.confidence - a.confidence); // Ordenar por confianza
  }

  public processDetection(data: any) {
    if (!this.isReady) {
      this.processingQueue.push(data);
      return;
    }

    try {
      const { imageData, minArea = 1000 } = data;
      console.log('Procesando detección avanzada:', { 
        imageSize: `${imageData.width}x${imageData.height}`,
        minArea 
      });

      const rects = this.detectContoursAdvanced(imageData, minArea);
      
      console.log('Detección completada:', {
        objectsFound: rects.length,
        avgConfidence: rects.length > 0 ? (rects.reduce((sum, r) => sum + r.confidence, 0) / rects.length).toFixed(2) : 0
      });

      self.postMessage({
        type: 'DETECTED',
        rects: rects.slice(0, 3) // Máximo 3 objetos para rendimiento
      });
    } catch (error) {
      console.error('Error en procesamiento:', error);
      self.postMessage({
        type: 'ERROR',
        error: error.message
      });
    }
  }
}

// Inicializar worker
const worker = new AdvancedMeasurementWorker();

// Manejar mensajes
self.onmessage = function(e: MessageEvent) {
  const { type, ...data } = e.data;
  
  switch (type) {
    case 'INIT':
      // Ya se inicializa en el constructor
      break;
    case 'DETECT':
      worker.processDetection(data);
      break;
    default:
      console.warn('Tipo de mensaje no reconocido:', type);
  }
};
