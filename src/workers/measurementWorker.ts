
import { BoundingRect } from '../lib/imageProcessing';

// Declaraciones para el worker
declare const self: any;

interface WorkerMessage {
  type: 'INIT' | 'DETECT';
  imageData?: ImageData;
  minArea?: number;
}

class MeasurementProcessor {
  private cv: any = null;
  private isReady: boolean = false;

  async initialize() {
    try {
      // Cargar OpenCV en el worker
      importScripts('https://docs.opencv.org/4.8.0/opencv.js');
      
      // Esperar a que OpenCV esté listo
      await new Promise((resolve) => {
        const checkCV = () => {
          if (typeof cv !== 'undefined' && cv.Mat) {
            this.cv = cv;
            this.isReady = true;
            resolve(true);
          } else {
            setTimeout(checkCV, 100);
          }
        };
        checkCV();
      });

      console.log('OpenCV cargado exitosamente en worker');
      self.postMessage({ type: 'READY' });
    } catch (error) {
      console.error('Error cargando OpenCV en worker:', error);
      // Modo fallback sin OpenCV
      this.isReady = true;
      self.postMessage({ type: 'READY' });
    }
  }

  detectObjects(imageData: ImageData, minArea: number = 500): BoundingRect[] {
    if (!imageData) return [];

    try {
      if (this.cv && this.cv.Mat) {
        // Usar OpenCV para detección avanzada
        return this.detectWithOpenCV(imageData, minArea);
      } else {
        // Usar detección básica por diferencias de color
        return this.detectBasic(imageData, minArea);
      }
    } catch (error) {
      console.error('Error en detección:', error);
      return this.detectBasic(imageData, minArea);
    }
  }

  private detectWithOpenCV(imageData: ImageData, minArea: number): BoundingRect[] {
    if (!this.cv) return [];

    const src = this.cv.matFromImageData(imageData);
    const gray = new this.cv.Mat();
    const blur = new this.cv.Mat();
    const edges = new this.cv.Mat();
    const contours = new this.cv.MatVector();
    const hierarchy = new this.cv.Mat();

    try {
      // Convertir a escala de grises
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY);
      
      // Aplicar desenfoque gaussiano
      this.cv.GaussianBlur(gray, blur, new this.cv.Size(5, 5), 0);
      
      // Detección de bordes Canny con parámetros optimizados
      this.cv.Canny(blur, edges, 30, 100);
      
      // Operación morfológica para cerrar contornos
      const kernel = this.cv.getStructuringElement(this.cv.MORPH_ELLIPSE, new this.cv.Size(5, 5));
      this.cv.morphologyEx(edges, edges, this.cv.MORPH_CLOSE, kernel);
      kernel.delete();
      
      // Encontrar contornos
      this.cv.findContours(edges, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE);
      
      const results: BoundingRect[] = [];
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = this.cv.contourArea(contour);
        
        if (area >= minArea) {
          const rect = this.cv.boundingRect(contour);
          const aspectRatio = rect.width / rect.height;
          
          // Filtrar por forma y tamaño razonable
          if (aspectRatio > 0.1 && aspectRatio < 10 && 
              rect.width > 20 && rect.height > 20 &&
              rect.x > 5 && rect.y > 5 && 
              rect.x + rect.width < imageData.width - 5 && 
              rect.y + rect.height < imageData.height - 5) {
            
            // Calcular confianza basada en área y forma
            const confidence = Math.min(0.95, 0.3 + (area / (imageData.width * imageData.height)) * 2);
            
            results.push({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              area: area,
              confidence: confidence
            });
          }
        }
        
        contour.delete();
      }
      
      // Cleanup
      src.delete();
      gray.delete();
      blur.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      
      // Ordenar por área (objetos más grandes primero)
      return results.sort((a, b) => b.area - a.area).slice(0, 3);
      
    } catch (error) {
      console.error('Error en OpenCV:', error);
      // Cleanup en caso de error
      [src, gray, blur, edges, contours, hierarchy].forEach(mat => {
        try { mat.delete(); } catch {}
      });
      return [];
    }
  }

  private detectBasic(imageData: ImageData, minArea: number): BoundingRect[] {
    const { width, height, data } = imageData;
    const visited = new Set<number>();
    const results: BoundingRect[] = [];
    
    // Convertir a escala de grises para simplificar
    const grayData = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      grayData[i / 4] = gray;
    }
    
    // Detectar bordes usando gradiente simple
    const edges = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const gx = Math.abs(grayData[idx + 1] - grayData[idx - 1]);
        const gy = Math.abs(grayData[idx + width] - grayData[idx - width]);
        edges[idx] = Math.sqrt(gx * gx + gy * gy) > 50 ? 255 : 0;
      }
    }
    
    // Buscar componentes conexos en los bordes
    for (let y = 10; y < height - 10; y++) {
      for (let x = 10; x < width - 10; x++) {
        const idx = y * width + x;
        
        if (edges[idx] > 0 && !visited.has(idx)) {
          const component = this.floodFill(edges, width, height, x, y, visited);
          
          if (component.length > minArea / 10) { // Ajustar threshold para detección básica
            const bounds = this.getBoundingBox(component);
            const area = bounds.width * bounds.height;
            
            if (area >= minArea && bounds.width > 30 && bounds.height > 30) {
              results.push({
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                area: area,
                confidence: 0.6
              });
            }
          }
        }
      }
    }
    
    return results.sort((a, b) => b.area - a.area).slice(0, 2);
  }
  
  private floodFill(edges: Uint8Array, width: number, height: number, startX: number, startY: number, visited: Set<number>): number[] {
    const stack = [{x: startX, y: startY}];
    const component: number[] = [];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited.has(idx) || edges[idx] === 0) {
        continue;
      }
      
      visited.add(idx);
      component.push(idx);
      
      // Agregar vecinos
      stack.push({x: x + 1, y: y});
      stack.push({x: x - 1, y: y});
      stack.push({x: x, y: y + 1});
      stack.push({x: x, y: y - 1});
    }
    
    return component;
  }
  
  private getBoundingBox(component: number[]): {x: number, y: number, width: number, height: number} {
    if (component.length === 0) return {x: 0, y: 0, width: 0, height: 0};
    
    const width = 640; // Asumiendo ancho típico, esto se puede mejorar
    let minX = width, maxX = 0, minY = 480, maxY = 0;
    
    for (const idx of component) {
      const x = idx % width;
      const y = Math.floor(idx / width);
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}

// Instancia del procesador
const processor = new MeasurementProcessor();

// Manejar mensajes del hilo principal
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, imageData, minArea } = e.data;
  
  try {
    switch (type) {
      case 'INIT':
        await processor.initialize();
        break;
        
      case 'DETECT':
        if (imageData) {
          const rects = processor.detectObjects(imageData, minArea || 500);
          self.postMessage({ type: 'DETECTED', rects });
        }
        break;
    }
  } catch (error) {
    console.error('Error en worker:', error);
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};

// Manejar errores globales
self.onerror = (error) => {
  console.error('Error global en worker:', error);
  self.postMessage({ type: 'ERROR', error: error.message });
};
