/**
 * SISTEMA UNIFICADO DE OPENCV AVANZADO
 * Reemplaza todos los sistemas duplicados de detección
 * Implementa detección real de siluetas con algoritmos matemáticos avanzados
 */

import { DetectedObject } from '@/lib/types';

interface ContourPoint {
  x: number;
  y: number;
}

interface OpenCVDetectionResult {
  objects: DetectedObject[];
  processingTime: number;
  edgeMap: Uint8Array;
  contours: ContourPoint[][];
}

interface CalibrationData {
  pixelsPerMm: number;
  isCalibrated: boolean;
}

class UnifiedOpenCVSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isProcessing = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * DETECTAR SILUETAS CON PRIORIDAD EN OBJETOS CENTRALES
   */
  async detectObjectSilhouettes(
    imageData: ImageData, 
    calibrationData: CalibrationData | null = null
  ): Promise<OpenCVDetectionResult> {
    if (this.isProcessing) {
      return this.getEmptyResult();
    }

    this.isProcessing = true;
    const startTime = performance.now();

    try {
      const { width, height, data } = imageData;
      
      // 1. CONVERSIÓN A ESCALA DE GRISES OPTIMIZADA
      const grayData = this.convertToGrayscale(data, width, height);
      
      // 2. FILTRO GAUSSIANO PARA REDUCIR RUIDO
      const blurredData = this.applyGaussianBlur(grayData, width, height, 1.4);
      
      // 3. DETECCIÓN DE BORDES CANNY AVANZADA - CONFIGURADA PARA OBJETOS CENTRALES
      const edgeData = this.cannyEdgeDetection(blurredData, width, height, 30, 120);
      
      // 4. ENCONTRAR CONTORNOS REALES PRIORIZANDO EL CENTRO
      const contours = this.findContoursWithCentralPriority(edgeData, width, height);
      
      // 5. FILTRAR Y ANALIZAR CONTORNOS SIGNIFICATIVOS
      const significantContours = this.filterSignificantContours(contours, width, height);
      
      // 6. CREAR OBJETOS DETECTADOS CON MEDICIONES REALES EN MM/CM
      const objects = this.createDetectedObjects(
        significantContours, 
        width, 
        height, 
        calibrationData
      );

      const processingTime = performance.now() - startTime;

      return {
        objects,
        processingTime,
        edgeMap: edgeData,
        contours: significantContours
      };

    } catch (error) {
      console.error('❌ Error en detección OpenCV:', error);
      return this.getEmptyResult();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * CONVERSIÓN A ESCALA DE GRISES OPTIMIZADA
   */
  private convertToGrayscale(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
    const grayData = new Uint8Array(width * height);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Fórmula luminance estándar
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      grayData[i / 4] = gray;
    }
    
    return grayData;
  }

  /**
   * FILTRO GAUSSIANO PARA REDUCIR RUIDO
   */
  private applyGaussianBlur(data: Uint8Array, width: number, height: number, sigma: number): Uint8Array {
    const result = new Uint8Array(width * height);
    
    // Generar kernel Gaussiano
    const kernelSize = Math.ceil(sigma * 6) | 1; // Asegurar que sea impar
    const kernel = this.generateGaussianKernel(kernelSize, sigma);
    const radius = Math.floor(kernelSize / 2);
    
    // Aplicar convolución
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const px = Math.max(0, Math.min(width - 1, x + kx));
            const py = Math.max(0, Math.min(height - 1, y + ky));
            const weight = kernel[(ky + radius) * kernelSize + (kx + radius)];
            
            sum += data[py * width + px] * weight;
            weightSum += weight;
          }
        }
        
        result[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    return result;
  }

  /**
   * GENERAR KERNEL GAUSSIANO
   */
  private generateGaussianKernel(size: number, sigma: number): number[] {
    const kernel = new Array(size * size);
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
   * DETECCIÓN DE BORDES CANNY AVANZADA
   */
  private cannyEdgeDetection(
    data: Uint8Array, 
    width: number, 
    height: number, 
    lowThreshold: number = 50, 
    highThreshold: number = 150
  ): Uint8Array {
    // 1. Calcular gradientes Sobel
    const { magnitude, direction } = this.calculateGradients(data, width, height);
    
    // 2. Supresión de no-máximos
    const suppressed = this.nonMaximumSuppression(magnitude, direction, width, height);
    
    // 3. Histéresis de doble umbral
    const edges = this.doubleThresholdHysteresis(suppressed, width, height, lowThreshold, highThreshold);
    
    return edges;
  }

  /**
   * CALCULAR GRADIENTES SOBEL
   */
  private calculateGradients(data: Uint8Array, width: number, height: number): {
    magnitude: Float32Array;
    direction: Float32Array;
  } {
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    
    // Kernels Sobel
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            
            gx += data[idx] * sobelX[kernelIdx];
            gy += data[idx] * sobelY[kernelIdx];
          }
        }
        
        const idx = y * width + x;
        magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
        direction[idx] = Math.atan2(gy, gx);
      }
    }
    
    return { magnitude, direction };
  }

  /**
   * SUPRESIÓN DE NO-MÁXIMOS
   */
  private nonMaximumSuppression(
    magnitude: Float32Array, 
    direction: Float32Array, 
    width: number, 
    height: number
  ): Float32Array {
    const result = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const angle = direction[idx];
        const mag = magnitude[idx];
        
        // Determinar dirección del gradiente
        let neighbor1, neighbor2;
        const angleRad = Math.abs(angle);
        
        if (angleRad < Math.PI / 8 || angleRad > 7 * Math.PI / 8) {
          // Horizontal
          neighbor1 = magnitude[idx - 1];
          neighbor2 = magnitude[idx + 1];
        } else if (angleRad >= Math.PI / 8 && angleRad < 3 * Math.PI / 8) {
          // Diagonal /
          neighbor1 = magnitude[(y - 1) * width + (x + 1)];
          neighbor2 = magnitude[(y + 1) * width + (x - 1)];
        } else if (angleRad >= 3 * Math.PI / 8 && angleRad < 5 * Math.PI / 8) {
          // Vertical
          neighbor1 = magnitude[(y - 1) * width + x];
          neighbor2 = magnitude[(y + 1) * width + x];
        } else {
          // Diagonal \
          neighbor1 = magnitude[(y - 1) * width + (x - 1)];
          neighbor2 = magnitude[(y + 1) * width + (x + 1)];
        }
        
        // Mantener solo si es máximo local
        if (mag >= neighbor1 && mag >= neighbor2) {
          result[idx] = mag;
        }
      }
    }
    
    return result;
  }

  /**
   * HISTÉRESIS DE DOBLE UMBRAL
   */
  private doubleThresholdHysteresis(
    magnitude: Float32Array, 
    width: number, 
    height: number, 
    lowThreshold: number, 
    highThreshold: number
  ): Uint8Array {
    const edges = new Uint8Array(width * height);
    const visited = new Array(width * height).fill(false);
    
    // Marcar bordes fuertes
    for (let i = 0; i < magnitude.length; i++) {
      if (magnitude[i] >= highThreshold) {
        edges[i] = 255;
      } else if (magnitude[i] >= lowThreshold) {
        edges[i] = 128; // Borde débil
      }
    }
    
    // Conectar bordes débiles a bordes fuertes
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 255 && !visited[idx]) {
          this.traceEdge(edges, visited, x, y, width, height);
        }
      }
    }
    
    // Limpiar bordes débiles no conectados
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === 128) {
        edges[i] = 0;
      }
    }
    
    return edges;
  }

  /**
   * TRAZAR BORDE CONECTANDO BORDES DÉBILES
   */
  private traceEdge(
    edges: Uint8Array, 
    visited: boolean[], 
    startX: number, 
    startY: number, 
    width: number, 
    height: number
  ): void {
    const stack: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    
    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx]) continue;
      visited[idx] = true;
      
      // Revisar vecinos 8-conectados
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            
            if (edges[nIdx] === 128 && !visited[nIdx]) {
              edges[nIdx] = 255; // Promover borde débil
              stack.push({x: nx, y: ny});
            }
          }
        }
      }
    }
  }

  /**
   * ENCONTRAR CONTORNOS CON PRIORIDAD CENTRAL
   */
  private findContoursWithCentralPriority(edgeData: Uint8Array, width: number, height: number): ContourPoint[][] {
    const contours: ContourPoint[][] = [];
    const visited = new Array(width * height).fill(false);
    
    // Direcciones Moore (8-conectado)
    const directions = [
      {dx: 1, dy: 0},   // E
      {dx: 1, dy: 1},   // SE
      {dx: 0, dy: 1},   // S
      {dx: -1, dy: 1},  // SW
      {dx: -1, dy: 0},  // W
      {dx: -1, dy: -1}, // NW
      {dx: 0, dy: -1},  // N
      {dx: 1, dy: -1}   // NE
    ];

    // PRIORIZAR BÚSQUEDA DESDE EL CENTRO
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const searchRadius = Math.min(width, height) / 3;

    // Crear lista de puntos ordenados por distancia al centro
    const searchPoints: Array<{x: number, y: number, distance: number}> = [];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edgeData[idx] === 255) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          searchPoints.push({x, y, distance});
        }
      }
    }

    // Ordenar por distancia al centro (más cerca primero)
    searchPoints.sort((a, b) => a.distance - b.distance);

    // Buscar contornos priorizando los más centrales
    for (const point of searchPoints) {
      const idx = point.y * width + point.x;
      
      if (!visited[idx] && edgeData[idx] === 255) {
        const contour = this.traceContour(edgeData, visited, point.x, point.y, width, height, directions);
        
        if (contour.length > 20) { // Filtrar contornos más grandes
          contours.push(contour);
          
          // Limitar a máximo 5 contornos para mejor rendimiento
          if (contours.length >= 5) break;
        }
      }
    }
    
    return contours;
  }

  /**
   * TRAZAR CONTORNO INDIVIDUAL
   */
  private traceContour(
    edgeData: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number,
    directions: Array<{dx: number, dy: number}>
  ): ContourPoint[] {
    const contour: ContourPoint[] = [];
    let x = startX, y = startY;
    let directionIdx = 0;
    
    do {
      contour.push({x, y});
      visited[y * width + x] = true;
      
      // Buscar siguiente punto del contorno
      let found = false;
      for (let i = 0; i < directions.length; i++) {
        const {dx, dy} = directions[(directionIdx + i) % directions.length];
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          
          if (edgeData[nIdx] === 255) {
            x = nx;
            y = ny;
            directionIdx = (directionIdx + i + 6) % directions.length; // Girar en sentido horario
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      
    } while ((x !== startX || y !== startY) && contour.length < 1000);
    
    return contour;
  }

  /**
   * FILTRAR CONTORNOS SIGNIFICATIVOS
   */
  private filterSignificantContours(
    contours: ContourPoint[][], 
    width: number, 
    height: number
  ): ContourPoint[][] {
    const minArea = (width * height) * 0.001; // 0.1% del área total
    const maxArea = (width * height) * 0.8;   // 80% del área total
    
    return contours
      .filter(contour => {
        const area = this.calculateContourArea(contour);
        return area >= minArea && area <= maxArea;
      })
      .sort((a, b) => this.calculateContourArea(b) - this.calculateContourArea(a))
      .slice(0, 3); // Máximo 3 contornos más significativos
  }

  /**
   * CALCULAR ÁREA DE CONTORNO (SHOELACE FORMULA)
   */
  private calculateContourArea(contour: ContourPoint[]): number {
    if (contour.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * CREAR OBJETOS DETECTADOS CON MEDICIONES REALES EN MM/CM
   */
  private createDetectedObjects(
    contours: ContourPoint[][],
    width: number,
    height: number,
    calibrationData: CalibrationData | null
  ): DetectedObject[] {
    const objects: DetectedObject[] = [];
    
    contours.forEach((contour, index) => {
      const bbox = this.calculateBoundingBox(contour);
      const area = this.calculateContourArea(contour);
      const perimeter = this.calculatePerimeter(contour);
      
      // Calcular características del objeto
      const aspectRatio = bbox.width / bbox.height;
      const solidity = area / (bbox.width * bbox.height);
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      
      // APLICAR CALIBRACIÓN REAL PARA CONVERTIR A MM/CM
      let realWidth = bbox.width;
      let realHeight = bbox.height;
      let realArea = area;
      let unit: 'px' | 'mm' = 'px';
      
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        const mmPerPixel = 1 / calibrationData.pixelsPerMm;
        realWidth = bbox.width * mmPerPixel;
        realHeight = bbox.height * mmPerPixel;
        realArea = area * mmPerPixel * mmPerPixel;
        unit = 'mm';
        
        console.log(`🔧 Conversión aplicada: ${bbox.width}px → ${realWidth.toFixed(1)}mm (factor: ${mmPerPixel.toFixed(4)})`);
      } else {
        console.log('⚠️ Sin calibración - medidas en píxeles');
      }
      
      const detectedObject: DetectedObject = {
        id: `opencv_object_${index}`,
        type: 'detected',
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        area: realArea,
        confidence: Math.min(0.95, 0.5 + (solidity * 0.3) + (Math.min(1, circularity) * 0.2)),
        contours: contour,
        boundingBox: bbox,
        dimensions: {
          width: realWidth,
          height: realHeight,
          area: realArea,
          unit,
          perimeter: calibrationData?.isCalibrated ? perimeter / calibrationData.pixelsPerMm : perimeter
        },
        points: contour.map((point, i) => ({
          x: point.x,
          y: point.y,
          z: 0,
          confidence: 0.9,
          timestamp: Date.now() + i
        })),
        // Propiedades geométricas adicionales
        geometricProperties: {
          aspectRatio,
          solidity,
          circularity,
          perimeter: calibrationData?.isCalibrated ? perimeter / calibrationData.pixelsPerMm : perimeter
        }
      };
      
      objects.push(detectedObject);
    });
    
    return objects;
  }

  /**
   * CALCULAR BOUNDING BOX
   */
  private calculateBoundingBox(contour: ContourPoint[]): {x: number, y: number, width: number, height: number} {
    if (contour.length === 0) return {x: 0, y: 0, width: 0, height: 0};
    
    let minX = contour[0].x, maxX = contour[0].x;
    let minY = contour[0].y, maxY = contour[0].y;
    
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * CALCULAR PERÍMETRO
   */
  private calculatePerimeter(contour: ContourPoint[]): number {
    if (contour.length < 2) return 0;
    
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
   * RESULTADO VACÍO PARA CASOS DE ERROR
   */
  private getEmptyResult(): OpenCVDetectionResult {
    return {
      objects: [],
      processingTime: 0,
      edgeMap: new Uint8Array(0),
      contours: []
    };
  }

  /**
   * DIBUJAR OVERLAY DE DETECCIÓN
   */
  drawDetectionOverlay(
    overlayCanvas: HTMLCanvasElement,
    result: OpenCVDetectionResult,
    showEdges: boolean = false
  ): void {
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Dibujar bordes si se solicita
    if (showEdges && result.edgeMap.length > 0) {
      const imageData = ctx.createImageData(overlayCanvas.width, overlayCanvas.height);
      for (let i = 0; i < result.edgeMap.length; i++) {
        const value = result.edgeMap[i];
        imageData.data[i * 4] = value;
        imageData.data[i * 4 + 1] = value;
        imageData.data[i * 4 + 2] = value;
        imageData.data[i * 4 + 3] = value > 0 ? 100 : 0;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Dibujar contornos y objetos detectados
    result.objects.forEach((obj, index) => {
      const colors = ['#00ff41', '#ff0066', '#0099ff', '#ffaa00', '#ff4444'];
      const color = colors[index % colors.length];

      // Dibujar contorno
      if (obj.contours && obj.contours.length > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Relleno semitransparente
        ctx.fillStyle = color + '20';
        ctx.fill();
      }

      // Etiquetas informativas
      ctx.fillStyle = color;
      ctx.font = 'bold 14px Arial';
      ctx.fillText(
        `${obj.dimensions.width.toFixed(1)} × ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`,
        obj.boundingBox.x,
        obj.boundingBox.y - 10
      );

      ctx.font = '12px Arial';
      ctx.fillText(
        `Área: ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}² | ${(obj.confidence * 100).toFixed(0)}%`,
        obj.boundingBox.x,
        obj.boundingBox.y - 30
      );
    });
  }
}

// Exportar instancia singleton
export const unifiedOpenCV = new UnifiedOpenCVSystem();

// Función helper para usar desde componentes
export const detectObjectsWithOpenCV = async (
  imageData: ImageData,
  calibrationData: CalibrationData | null = null
): Promise<OpenCVDetectionResult> => {
  return unifiedOpenCV.detectObjectSilhouettes(imageData, calibrationData);
};