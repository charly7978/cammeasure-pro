// DETECTOR DE SILUETAS ESPECIALIZADO - ALGORITMOS AVANZADOS DE VISIÓN POR COMPUTADORA
export interface SilhouettePoint {
  x: number;
  y: number;
}

export interface DetectedSilhouette {
  contours: SilhouettePoint[];
  boundingBox: { x: number; y: number; width: number; height: number };
  area: number;
  perimeter: number;
  centroid: { x: number; y: number };
  confidence: number;
  isValid: boolean;
}

export class SilhouetteDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  // DETECTAR SILUETA DEL OBJETO MÁS PROMINENTE EN EL CENTRO
  async detectCentralSilhouette(imageData: ImageData): Promise<DetectedSilhouette | null> {
    const { width, height, data } = imageData;
    
    // 1. PREPROCESAMIENTO - MEJORAR CONTRASTE Y REDUCIR RUIDO
    const processedData = this.preprocessImage(data, width, height);
    
    // 2. DETECCIÓN DE BORDES MULTI-ESCALA
    const edges = this.detectEdgesMultiScale(processedData, width, height);
    
    // 3. ENCONTRAR OBJETO MÁS PROMINENTE EN REGIÓN CENTRAL
    const centralObject = this.findCentralObject(edges, width, height);
    
    if (!centralObject) {
      console.log("❌ No se detectó objeto central prominente");
      return null;
    }
    
    // 4. EXTRAER CONTORNO PRECISO
    const contours = this.extractPreciseContour(edges, centralObject, width, height);
    
    if (contours.length < 10) {
      console.log("❌ Contorno insuficiente");
      return null;
    }
    
    // 5. CALCULAR PROPIEDADES GEOMÉTRICAS
    const boundingBox = this.calculateBoundingBox(contours);
    const area = this.calculatePolygonArea(contours);
    const perimeter = this.calculatePerimeter(contours);
    const centroid = this.calculateCentroid(contours);
    const confidence = this.calculateConfidence(contours, area, boundingBox);
    
    console.log(`✅ Silueta detectada: ${contours.length} puntos, área: ${Math.round(area)}, confianza: ${(confidence * 100).toFixed(1)}%`);
    
    return {
      contours,
      boundingBox,
      area,
      perimeter,
      centroid,
      confidence,
      isValid: confidence > 0.6 && contours.length >= 10
    };
  }

  // PREPROCESAMIENTO DE IMAGEN PARA MEJOR DETECCIÓN
  private preprocessImage(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
    const processed = new Uint8Array(width * height);
    
    // Convertir a escala de grises con mejora de contraste
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1]; 
      const b = data[i + 2];
      
      // Luminancia con pesos perceptuales
      let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      // Mejora de contraste usando stretching
      gray = Math.min(255, Math.max(0, (gray - 50) * 1.3));
      
      processed[Math.floor(i / 4)] = gray;
    }
    
    // Filtro Gaussiano para reducir ruido
    return this.gaussianBlur(processed, width, height, 1.0);
  }

  // DETECCIÓN DE BORDES MULTI-ESCALA (SOBEL + CANNY)
  private detectEdgesMultiScale(data: Uint8Array, width: number, height: number): Uint8Array {
    const edges = new Uint8Array(width * height);
    
    // Aplicar operador Sobel mejorado
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Kernels Sobel
        const gx = 
          -1 * data[(y-1) * width + (x-1)] + 1 * data[(y-1) * width + (x+1)] +
          -2 * data[y * width + (x-1)] + 2 * data[y * width + (x+1)] +
          -1 * data[(y+1) * width + (x-1)] + 1 * data[(y+1) * width + (x+1)];
          
        const gy = 
          -1 * data[(y-1) * width + (x-1)] - 2 * data[(y-1) * width + x] - 1 * data[(y-1) * width + (x+1)] +
          1 * data[(y+1) * width + (x-1)] + 2 * data[(y+1) * width + x] + 1 * data[(y+1) * width + (x+1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        // Umbralización adaptativa
        const threshold = 30;
        edges[idx] = magnitude > threshold ? 255 : 0;
      }
    }
    
    // Supresión de no-máximos para adelgazar bordes
    return this.nonMaximumSuppression(edges, width, height);
  }

  // ENCONTRAR OBJETO MÁS PROMINENTE EN REGIÓN CENTRAL
  private findCentralObject(edges: Uint8Array, width: number, height: number): { x: number; y: number; size: number } | null {
    // Definir región central (40% del centro de la imagen)
    const centerX = Math.floor(width * 0.5);
    const centerY = Math.floor(height * 0.5); 
    const searchRadius = Math.min(width, height) * 0.2;
    
    let bestObject = null;
    let maxDensity = 0;
    
    // Buscar en círculos concéntricos desde el centro
    for (let radius = 20; radius < searchRadius; radius += 10) {
      const density = this.calculateEdgeDensity(edges, centerX, centerY, radius, width, height);
      
      if (density > maxDensity && density > 0.1) {
        maxDensity = density;
        bestObject = { x: centerX, y: centerY, size: radius };
      }
    }
    
    return bestObject;
  }

  // EXTRAER CONTORNO PRECISO USANDO SEGUIMIENTO DE BORDES
  private extractPreciseContour(edges: Uint8Array, object: { x: number; y: number; size: number }, width: number, height: number): SilhouettePoint[] {
    const contours: SilhouettePoint[] = [];
    const visited = new Array(width * height).fill(false);
    
    // Encontrar punto de inicio en el borde del objeto
    let startX = object.x;
    let startY = object.y;
    
    // Buscar primer punto de borde
    for (let r = 10; r < object.size; r++) {
      for (let angle = 0; angle < 2 * Math.PI; angle += 0.1) {
        const x = Math.floor(object.x + r * Math.cos(angle));
        const y = Math.floor(object.y + r * Math.sin(angle));
        
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = y * width + x;
          if (edges[idx] > 0) {
            startX = x;
            startY = y;
            break;
          }
        }
      }
      if (startX !== object.x || startY !== object.y) break;
    }
    
    // Seguir contorno usando algoritmo de Moore Neighborhood
    let currentX = startX;
    let currentY = startY;
    let direction = 0; // 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
    
    const directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
    ];
    
    do {
      contours.push({ x: currentX, y: currentY });
      visited[currentY * width + currentX] = true;
      
      // Buscar siguiente punto de borde
      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (direction + i) % 8;
        const dx = directions[newDir][0];
        const dy = directions[newDir][1];
        const newX = currentX + dx;
        const newY = currentY + dy;
        
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
          const idx = newY * width + newX;
          if (edges[idx] > 0 && !visited[idx]) {
            currentX = newX;
            currentY = newY;
            direction = newDir;
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      
    } while ((currentX !== startX || currentY !== startY) && contours.length < 1000);
    
    // Simplificar contorno usando Douglas-Peucker
    return this.simplifyContour(contours, 2.0);
  }

  // ALGORITMOS AUXILIARES
  private gaussianBlur(data: Uint8Array, width: number, height: number, sigma: number): Uint8Array {
    const result = new Uint8Array(data.length);
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = this.generateGaussianKernel(kernelSize, sigma);
    
    // Aplicar blur horizontal
    const temp = new Uint8Array(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const xi = x + i - Math.floor(kernelSize / 2);
          if (xi >= 0 && xi < width) {
            sum += data[y * width + xi] * kernel[i];
            weightSum += kernel[i];
          }
        }
        temp[y * width + x] = sum / weightSum;
      }
    }
    
    // Aplicar blur vertical
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < kernelSize; i++) {
          const yi = y + i - Math.floor(kernelSize / 2);
          if (yi >= 0 && yi < height) {
            sum += temp[yi * width + x] * kernel[i];
            weightSum += kernel[i];
          }
        }
        result[y * width + x] = sum / weightSum;
      }
    }
    
    return result;
  }

  private generateGaussianKernel(size: number, sigma: number): number[] {
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
      const x = i - center;
      const value = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernel[i] = value;
      sum += value;
    }
    
    // Normalizar
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  private nonMaximumSuppression(edges: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(edges.length);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const current = edges[idx];
        
        if (current > 0) {
          // Verificar si es máximo local en dirección del gradiente
          const neighbors = [
            edges[(y-1) * width + (x-1)], edges[(y-1) * width + x], edges[(y-1) * width + (x+1)],
            edges[y * width + (x-1)], current, edges[y * width + (x+1)],
            edges[(y+1) * width + (x-1)], edges[(y+1) * width + x], edges[(y+1) * width + (x+1)]
          ];
          
          const isMaximum = neighbors.every(n => current >= n);
          result[idx] = isMaximum ? current : 0;
        }
      }
    }
    
    return result;
  }

  private calculateEdgeDensity(edges: Uint8Array, centerX: number, centerY: number, radius: number, width: number, height: number): number {
    let edgeCount = 0;
    let totalCount = 0;
    
    const radiusSquared = radius * radius;
    
    for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        
        if (dx * dx + dy * dy <= radiusSquared) {
          totalCount++;
          if (edges[y * width + x] > 0) {
            edgeCount++;
          }
        }
      }
    }
    
    return totalCount > 0 ? edgeCount / totalCount : 0;
  }

  private calculateBoundingBox(contours: SilhouettePoint[]): { x: number; y: number; width: number; height: number } {
    if (contours.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = contours[0].x, maxX = contours[0].x;
    let minY = contours[0].y, maxY = contours[0].y;
    
    for (const point of contours) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private calculatePolygonArea(contours: SilhouettePoint[]): number {
    if (contours.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < contours.length; i++) {
      const j = (i + 1) % contours.length;
      area += contours[i].x * contours[j].y - contours[j].x * contours[i].y;
    }
    return Math.abs(area) / 2;
  }

  private calculatePerimeter(contours: SilhouettePoint[]): number {
    if (contours.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < contours.length; i++) {
      const j = (i + 1) % contours.length;
      const dx = contours[j].x - contours[i].x;
      const dy = contours[j].y - contours[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  }

  private calculateCentroid(contours: SilhouettePoint[]): { x: number; y: number } {
    if (contours.length === 0) return { x: 0, y: 0 };
    
    let sumX = 0, sumY = 0;
    for (const point of contours) {
      sumX += point.x;
      sumY += point.y;
    }
    
    return { x: sumX / contours.length, y: sumY / contours.length };
  }

  private calculateConfidence(contours: SilhouettePoint[], area: number, boundingBox: { width: number; height: number }): number {
    // Múltiples factores de confianza
    const contourDensity = contours.length / Math.max(1, area * 0.01);
    const aspectRatio = Math.min(boundingBox.width, boundingBox.height) / Math.max(boundingBox.width, boundingBox.height);
    const areaRatio = area / (boundingBox.width * boundingBox.height);
    
    const confidence = Math.min(1.0, 
      (contourDensity * 0.3) + 
      (aspectRatio * 0.3) + 
      (areaRatio * 0.4)
    );
    
    return Math.max(0, confidence);
  }

  private simplifyContour(contours: SilhouettePoint[], tolerance: number): SilhouettePoint[] {
    if (contours.length <= 2) return contours;
    
    // Algoritmo Douglas-Peucker simplificado
    const simplified: SilhouettePoint[] = [contours[0]];
    let i = 0;
    
    while (i < contours.length - 1) {
      let maxDistance = 0;
      let maxIndex = i + 1;
      
      // Buscar punto más lejano en los próximos 5-10 puntos
      const lookAhead = Math.min(contours.length - 1, i + 10);
      for (let j = i + 1; j <= lookAhead; j++) {
        const distance = this.pointToLineDistance(contours[j], contours[i], contours[lookAhead]);
        if (distance > maxDistance) {
          maxDistance = distance;
          maxIndex = j;
        }
      }
      
      if (maxDistance > tolerance) {
        simplified.push(contours[maxIndex]);
      }
      
      i = maxIndex;
    }
    
    if (simplified[simplified.length - 1] !== contours[contours.length - 1]) {
      simplified.push(contours[contours.length - 1]);
    }
    
    return simplified;
  }

  private pointToLineDistance(point: SilhouettePoint, lineStart: SilhouettePoint, lineEnd: SilhouettePoint): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    const param = dot / lenSq;
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
}