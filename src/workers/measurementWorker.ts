
// Web Worker para procesamiento avanzado de OpenCV
class MeasurementWorker {
  private cv: any = null;
  private isInitialized = false;

  constructor() {
    this.initializeOpenCV();
  }

  private async initializeOpenCV(): Promise<void> {
    try {
      // Importar OpenCV desde CDN con script dinámico
      const script = `
        self.importScripts('https://docs.opencv.org/4.x/opencv.js');
        self.cv.onRuntimeInitialized = () => {
          self.postMessage({ type: 'OPENCV_READY' });
        };
      `;
      
      // Ejecutar script en el contexto del worker
      eval(script);
      
    } catch (error) {
      console.error('Error inicializando OpenCV:', error);
      this.postMessage({ type: 'ERROR', error: 'Failed to initialize OpenCV' });
    }
  }

  private postMessage(data: any): void {
    (self as any).postMessage(data);
  }

  private processImageWithOpenCV(imageData: ImageData, minArea: number): any[] {
    if (!this.cv || !this.isInitialized) {
      console.warn('OpenCV no inicializado, usando detección básica');
      return this.basicEdgeDetection(imageData, minArea);
    }

    try {
      const cv = this.cv;
      
      // Crear Mat desde ImageData
      const src = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      const edges = new cv.Mat();
      const hierarchy = new cv.Mat();
      const contours = new cv.MatVector();

      // Pipeline avanzado de procesamiento
      // 1. Conversión a escala de grises
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // 2. Reducción de ruido con filtro bilateral
      cv.bilateralFilter(gray, blurred, 9, 75, 75);
      
      // 3. Detección de bordes Canny con parámetros optimizados
      cv.Canny(blurred, edges, 50, 150, 3, false);
      
      // 4. Operaciones morfológicas para mejorar contornos
      const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      cv.morphologyEx(edges, edges, cv.MORPH_OPEN, kernel);
      
      // 5. Encontrar contornos
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const results = [];
      
      // 6. Procesar cada contorno
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        if (area >= minArea) {
          // Calcular rectángulo delimitador
          const boundingRect = cv.boundingRect(contour);
          
          // Aproximar contorno para reducir puntos
          const epsilon = 0.02 * cv.arcLength(contour, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, epsilon, true);
          
          // Calcular características del contorno
          const moments = cv.moments(contour);
          const centerX = moments.m10 / moments.m00;
          const centerY = moments.m01 / moments.m00;
          
          // Calcular perímetro y convexidad
          const perimeter = cv.arcLength(contour, true);
          const convexHull = new cv.Mat();
          cv.convexHull(contour, convexHull);
          const hullArea = cv.contourArea(convexHull);
          const solidity = area / hullArea;
          
          // Calcular rectángulo orientado
          const rotatedRect = cv.minAreaRect(contour);
          const aspectRatio = Math.max(rotatedRect.size.width, rotatedRect.size.height) / 
                            Math.min(rotatedRect.size.width, rotatedRect.size.height);

          results.push({
            x: boundingRect.x,
            y: boundingRect.y,
            width: boundingRect.width,
            height: boundingRect.height,
            area: area,
            confidence: this.calculateConfidence(area, perimeter, solidity, aspectRatio),
            center: { x: centerX, y: centerY },
            perimeter: perimeter,
            solidity: solidity,
            aspectRatio: aspectRatio,
            angle: rotatedRect.angle,
            moments: {
              m00: moments.m00,
              m10: moments.m10,
              m01: moments.m01,
              m20: moments.m20,
              m11: moments.m11,
              m02: moments.m02
            }
          });
          
          approx.delete();
          convexHull.delete();
        }
        contour.delete();
      }

      // Limpieza de memoria
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      hierarchy.delete();
      contours.delete();
      kernel.delete();

      return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
      
    } catch (error) {
      console.error('Error en procesamiento OpenCV:', error);
      return this.basicEdgeDetection(imageData, minArea);
    }
  }

  private calculateConfidence(area: number, perimeter: number, solidity: number, aspectRatio: number): number {
    // Calcular confianza basada en múltiples factores
    let confidence = 0.5; // Base
    
    // Factor de área (objetos medianos tienen mayor confianza)
    if (area > 1000 && area < 50000) confidence += 0.2;
    
    // Factor de solidez (formas más sólidas tienen mayor confianza)
    if (solidity > 0.7) confidence += 0.15;
    
    // Factor de aspecto (evitar líneas muy delgadas)
    if (aspectRatio > 0.3 && aspectRatio < 5) confidence += 0.1;
    
    // Factor de compacidad
    const compactness = (4 * Math.PI * area) / (perimeter * perimeter);
    if (compactness > 0.3) confidence += 0.05;
    
    return Math.min(0.95, Math.max(0.1, confidence));
  }

  private basicEdgeDetection(imageData: ImageData, minArea: number): any[] {
    // Detección básica como fallback
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);
    const edges = new Uint8Array(width * height);
    
    // Conversión a escala de grises
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    // Detección de bordes Sobel simplificada
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        const gx = (-1 * gray[(y-1)*width + (x-1)] + 1 * gray[(y-1)*width + (x+1)] +
                   -2 * gray[y*width + (x-1)]     + 2 * gray[y*width + (x+1)] +
                   -1 * gray[(y+1)*width + (x-1)] + 1 * gray[(y+1)*width + (x+1)]);
        
        const gy = (-1 * gray[(y-1)*width + (x-1)] - 2 * gray[(y-1)*width + x] - 1 * gray[(y-1)*width + (x+1)] +
                    1 * gray[(y+1)*width + (x-1)] + 2 * gray[(y+1)*width + x] + 1 * gray[(y+1)*width + (x+1)]);
        
        edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      }
    }
    
    // Encontrar regiones conectadas básicas
    return this.findBasicRegions(edges, width, height, minArea);
  }

  private findBasicRegions(edges: Uint8Array, width: number, height: number, minArea: number): any[] {
    const visited = new Array(width * height).fill(false);
    const regions = [];
    const threshold = 50;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (edges[idx] > threshold && !visited[idx]) {
          const region = this.floodFill(edges, visited, x, y, width, height, threshold);
          
          if (region.area >= minArea) {
            regions.push({
              x: region.minX,
              y: region.minY,
              width: region.maxX - region.minX,
              height: region.maxY - region.minY,
              area: region.area,
              confidence: 0.6,
              center: { x: region.centerX, y: region.centerY }
            });
          }
        }
      }
    }
    
    return regions.slice(0, 3);
  }

  private floodFill(edges: Uint8Array, visited: boolean[], startX: number, startY: number, 
                   width: number, height: number, threshold: number): any {
    const stack = [[startX, startY]];
    let area = 0;
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let sumX = 0, sumY = 0;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] <= threshold) {
        continue;
      }
      
      visited[idx] = true;
      area++;
      sumX += x;
      sumY += y;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Agregar vecinos
      stack.push([x-1, y], [x+1, y], [x, y-1], [x, y+1]);
    }
    
    return {
      area,
      minX, maxX, minY, maxY,
      centerX: sumX / area,
      centerY: sumY / area
    };
  }
}

// Instancia del worker
const worker = new MeasurementWorker();

// Manejo de mensajes
self.addEventListener('message', (e: MessageEvent) => {
  const { type, imageData, minArea } = e.data;

  switch (type) {
    case 'INIT':
      // Inicialización ya se hace en constructor
      break;
      
    case 'OPENCV_READY':
      worker['cv'] = (self as any).cv;
      worker['isInitialized'] = true;
      self.postMessage({ type: 'READY' });
      console.log('✅ OpenCV Worker inicializado correctamente');
      break;
      
    case 'DETECT':
      try {
        const results = worker['processImageWithOpenCV'](imageData, minArea || 500);
        self.postMessage({ 
          type: 'DETECTED', 
          rects: results,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error en detección:', error);
        self.postMessage({ 
          type: 'ERROR', 
          error: error.message 
        });
      }
      break;
      
    default:
      console.warn('Tipo de mensaje desconocido:', type);
  }
});

// Exportar para compatibilidad
export {};
