// SISTEMA REAL DE PROCESAMIENTO DE IMAGEN - ALGORITMOS MATEMÁTICOS COMPLETOS
// Implementación nativa de operadores de borde, filtros y análisis de textura

import { DetectedObject } from './types';

// INTERFACES PARA PROCESAMIENTO DE IMAGEN REAL
export interface ImageFilter {
  name: string;
  kernel: number[][];
  normalize: boolean;
}

export interface EdgeDetectionResult {
  edges: Uint8Array;
  magnitude: Float32Array;
  direction: Float32Array;
  width: number;
  height: number;
}

export interface TextureAnalysisResult {
  contrast: number;
  homogeneity: number;
  energy: number;
  correlation: number;
  entropy: number;
}

// CLASE PRINCIPAL DE PROCESAMIENTO DE IMAGEN REAL
export class RealImageProcessor {
  private filters: Map<string, ImageFilter>;
  private isInitialized: boolean;

  constructor() {
    this.filters = new Map();
    this.isInitialized = false;
    this.initializeFilters();
  }

  // INICIALIZACIÓN DE FILTROS MATEMÁTICOS REALES
  private initializeFilters(): void {
    try {
      // 1. OPERADOR SOBEL REAL
      this.filters.set('sobel', {
        name: 'Sobel',
        kernel: [
          [-1, 0, 1],
          [-2, 0, 2],
          [-1, 0, 1]
        ],
        normalize: true
      });

      // 2. OPERADOR PREWITT REAL
      this.filters.set('prewitt', {
        name: 'Prewitt',
        kernel: [
          [-1, 0, 1],
          [-1, 0, 1],
          [-1, 0, 1]
        ],
        normalize: true
      });

      // 3. OPERADOR ROBERTS REAL
      this.filters.set('roberts', {
        name: 'Roberts',
        kernel: [
          [1, 0],
          [0, -1]
        ],
        normalize: true
      });

      // 4. OPERADOR LAPLACIANO REAL
      this.filters.set('laplacian', {
        name: 'Laplacian',
        kernel: [
          [0, -1, 0],
          [-1, 4, -1],
          [0, -1, 0]
        ],
        normalize: false
      });

      // 5. OPERADOR CANNY REAL (SIMPLIFICADO)
      this.filters.set('canny', {
        name: 'Canny',
        kernel: [
          [-1, -1, -1],
          [-1, 8, -1],
          [-1, -1, -1]
        ],
        normalize: true
      });

      this.isInitialized = true;
      console.log('✅ Filtros matemáticos reales inicializados:', this.filters.size);
      
    } catch (error) {
      console.error('❌ Error inicializando filtros:', error);
      this.isInitialized = false;
    }
  }

  // DETECCIÓN REAL DE BORDES CON SOBEL - IMPLEMENTACIÓN COMPLETA
  public detectEdgesSobel(imageData: ImageData): EdgeDetectionResult {
    try {
      if (!this.isInitialized) {
        throw new Error('Procesador de imagen no inicializado');
      }

      console.log('🔍 Aplicando detección real de bordes con Sobel...');
      
      const { data, width, height } = imageData;
      
      // Convertir a escala de grises
      const grayData = this.convertToGrayscale(data);
      
      // Aplicar kernels Sobel X e Y
      const sobelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
      ];
      
      const sobelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
      ];
      
      // Calcular gradientes X e Y
      const gx = this.applyConvolution(grayData, width, height, sobelX);
      const gy = this.applyConvolution(grayData, width, height, sobelY);
      
      // Calcular magnitud del gradiente
      const magnitude = this.calculateGradientMagnitude(gx, gy, width, height);
      
      // Calcular dirección del gradiente
      const direction = this.calculateGradientDirection(gx, gy, width, height);
      
      // Aplicar umbral adaptativo
      const edges = this.applyAdaptiveThreshold(magnitude, width, height);
      
      console.log('✅ Detección real de bordes con Sobel completada');
      
      return {
        edges,
        magnitude,
        direction,
        width,
        height
      };
      
    } catch (error) {
      console.error('❌ Error en detección de bordes Sobel:', error);
      return this.createEmptyEdgeResult();
    }
  }

  // CONVERSIÓN REAL A ESCALA DE GRISES
  private convertToGrayscale(data: Uint8ClampedArray): Uint8Array {
    try {
      const grayData = new Uint8Array(data.length / 4);
      
      for (let i = 0; i < data.length; i += 4) {
        // Fórmula real de luminancia: Y = 0.299R + 0.587G + 0.114B
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        grayData[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
      
      return grayData;
      
    } catch (error) {
      console.error('❌ Error convirtiendo a escala de grises:', error);
      return new Uint8Array(data.length / 4);
    }
  }

  // APLICACIÓN REAL DE CONVOLUCIÓN 2D
  private applyConvolution(data: Uint8Array, width: number, height: number, kernel: number[][]): Float32Array {
    try {
      const result = new Float32Array(width * height);
      const kernelSize = kernel.length;
      const kernelRadius = Math.floor(kernelSize / 2);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const px = x + kx - kernelRadius;
              const py = y + ky - kernelRadius;
              
              if (px >= 0 && px < width && py >= 0 && py < height) {
                const pixelValue = data[py * width + px];
                const kernelValue = kernel[ky][kx];
                sum += pixelValue * kernelValue;
              }
            }
          }
          
          result[y * width + x] = sum;
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error aplicando convolución:', error);
      return new Float32Array(width * height);
    }
  }

  // CÁLCULO REAL DE MAGNITUD DEL GRADIENTE
  private calculateGradientMagnitude(gx: Float32Array, gy: Float32Array, width: number, height: number): Float32Array {
    try {
      const magnitude = new Float32Array(width * height);
      
      for (let i = 0; i < magnitude.length; i++) {
        // Fórmula real: |∇f| = √(Gx² + Gy²)
        magnitude[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
      }
      
      return magnitude;
      
    } catch (error) {
      console.error('❌ Error calculando magnitud del gradiente:', error);
      return new Float32Array(width * height);
    }
  }

  // CÁLCULO REAL DE DIRECCIÓN DEL GRADIENTE
  private calculateGradientDirection(gx: Float32Array, gy: Float32Array, width: number, height: number): Float32Array {
    try {
      const direction = new Float32Array(width * height);
      
      for (let i = 0; i < direction.length; i++) {
        // Fórmula real: θ = atan2(Gy, Gx)
        direction[i] = Math.atan2(gy[i], gx[i]);
      }
      
      return direction;
      
    } catch (error) {
      console.error('❌ Error calculando dirección del gradiente:', error);
      return new Float32Array(width * height);
    }
  }

  // UMBRAL ADAPTATIVO REAL
  private applyAdaptiveThreshold(magnitude: Float32Array, width: number, height: number): Uint8Array {
    try {
      const edges = new Uint8Array(width * height);
      
      // Calcular estadísticas de la magnitud
      const validMagnitudes = Array.from(magnitude).filter(m => m > 0);
      if (validMagnitudes.length === 0) return edges;
      
      const mean = validMagnitudes.reduce((sum, m) => sum + m, 0) / validMagnitudes.length;
      const variance = validMagnitudes.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / validMagnitudes.length;
      const stdDev = Math.sqrt(variance);
      
      // Umbral adaptativo: media + k * desviación estándar
      const k = 1.5;
      const threshold = mean + k * stdDev;
      
      // Aplicar umbral
      for (let i = 0; i < magnitude.length; i++) {
        edges[i] = magnitude[i] > threshold ? 255 : 0;
      }
      
      return edges;
      
    } catch (error) {
      console.error('❌ Error aplicando umbral adaptativo:', error);
      return new Uint8Array(width * height);
    }
  }

  // DETECCIÓN REAL DE CONTORNOS CON ANÁLISIS DE CONECTIVIDAD
  public detectContoursReal(edges: Uint8Array, width: number, height: number): any[] {
    try {
      console.log('🔍 Aplicando detección real de contornos con análisis de conectividad...');
      
      const visited = new Set<number>();
      const contours: any[] = [];
      
      // Buscar puntos de inicio de contornos
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          
          if (edges[index] > 0 && !visited.has(index)) {
            // Nuevo contorno encontrado
            const contour = this.traceContour(edges, width, height, x, y, visited);
            
            if (contour.points.length > 10) { // Filtrar contornos muy pequeños
              contours.push(contour);
            }
          }
        }
      }
      
      console.log('✅ Detección real de contornos completada:', contours.length);
      return contours;
      
    } catch (error) {
      console.error('❌ Error en detección real de contornos:', error);
      return [];
    }
  }

  // TRAZADO REAL DE CONTORNO CON ANÁLISIS DE CONECTIVIDAD
  private traceContour(edges: Uint8Array, width: number, height: number, startX: number, startY: number, visited: Set<number>): any {
    try {
      const points: { x: number; y: number }[] = [];
      const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
      
      let minX = startX, maxX = startX;
      let minY = startY, maxY = startY;
      let totalIntensity = 0;
      
      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        const index = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height || 
            edges[index] === 0 || visited.has(index)) {
          continue;
        }
        
        visited.add(index);
        points.push({ x, y });
        totalIntensity += edges[index];
        
        // Actualizar bounding box
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        
        // Agregar vecinos en 8 direcciones
        const neighbors = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
          { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
        ];
        
        for (const neighbor of neighbors) {
          const nx = x + neighbor.dx;
          const ny = y + neighbor.dy;
          const nIndex = ny * width + nx;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
              edges[nIndex] > 0 && !visited.has(nIndex)) {
            stack.push({ x: nx, y: ny });
          }
        }
      }
      
      const boundingBox = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      };
      
      const area = boundingBox.width * boundingBox.height;
      const perimeter = points.length;
      const averageIntensity = totalIntensity / points.length;
      
      // Calcular confianza basada en la calidad del contorno
      const confidence = Math.min(0.95, Math.max(0.1, 
        (points.length / Math.max(perimeter, 1)) * 
        (averageIntensity / 255) * 
        (area / (width * height))
      ));
      
      return {
        points,
        boundingBox,
        area,
        perimeter,
        averageIntensity,
        confidence
      };
      
    } catch (error) {
      console.error('❌ Error trazando contorno:', error);
      return { points: [], boundingBox: { x: 0, y: 0, width: 0, height: 0 }, area: 0, perimeter: 0, averageIntensity: 0, confidence: 0.1 };
    }
  }

  // ANÁLISIS REAL DE TEXTURA
  public analyzeTextureReal(imageData: ImageData, region: { x: number; y: number; width: number; height: number }): TextureAnalysisResult {
    try {
      console.log('🔍 Aplicando análisis real de textura...');
      
      const { data, width } = imageData;
      const grayData = this.convertToGrayscale(data);
      
      // Extraer región de interés
      const roiData = this.extractROI(grayData, width, region);
      
      // Calcular matriz de co-ocurrencia
      const cooccurrenceMatrix = this.calculateCooccurrenceMatrix(roiData, region.width, region.height);
      
      // Calcular características de textura
      const contrast = this.calculateContrast(cooccurrenceMatrix);
      const homogeneity = this.calculateHomogeneity(cooccurrenceMatrix);
      const energy = this.calculateEnergy(cooccurrenceMatrix);
      const correlation = this.calculateCorrelation(cooccurrenceMatrix);
      const entropy = this.calculateEntropy(cooccurrenceMatrix);
      
      console.log('✅ Análisis real de textura completado');
      
      return {
        contrast,
        homogeneity,
        energy,
        correlation,
        entropy
      };
      
    } catch (error) {
      console.error('❌ Error en análisis real de textura:', error);
      return this.createEmptyTextureResult();
    }
  }

  // EXTRACCIÓN REAL DE REGIÓN DE INTERÉS
  private extractROI(grayData: Uint8Array, imageWidth: number, region: { x: number; y: number; width: number; height: number }): Uint8Array {
    try {
      const roiData = new Uint8Array(region.width * region.height);
      
      for (let y = 0; y < region.height; y++) {
        for (let x = 0; x < region.width; x++) {
          const sourceIndex = (region.y + y) * imageWidth + (region.x + x);
          const targetIndex = y * region.width + x;
          roiData[targetIndex] = grayData[sourceIndex];
        }
      }
      
      return roiData;
      
    } catch (error) {
      console.error('❌ Error extrayendo ROI:', error);
      return new Uint8Array(region.width * region.height);
    }
  }

  // CÁLCULO REAL DE MATRIZ DE CO-OCURRENCIA
  private calculateCooccurrenceMatrix(roiData: Uint8Array, width: number, height: number): number[][] {
    try {
      const matrix = Array(256).fill(0).map(() => Array(256).fill(0));
      
      // Calcular matriz de co-ocurrencia horizontal
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
          const currentPixel = roiData[y * width + x];
          const nextPixel = roiData[y * width + x + 1];
          matrix[currentPixel][nextPixel]++;
        }
      }
      
      // Calcular matriz de co-ocurrencia vertical
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width; x++) {
          const currentPixel = roiData[y * width + x];
          const nextPixel = roiData[(y + 1) * width + x];
          matrix[currentPixel][nextPixel]++;
        }
      }
      
      return matrix;
      
    } catch (error) {
      console.error('❌ Error calculando matriz de co-ocurrencia:', error);
      return Array(256).fill(0).map(() => Array(256).fill(0));
    }
  }

  // CÁLCULO REAL DE CONTRASTE
  private calculateContrast(matrix: number[][]): number {
    try {
      let contrast = 0;
      const total = matrix.reduce((sum, row) => sum + row.reduce((rowSum, val) => rowSum + val, 0), 0);
      
      for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
          if (matrix[i][j] > 0) {
            contrast += (matrix[i][j] / total) * Math.pow(i - j, 2);
          }
        }
      }
      
      return contrast;
      
    } catch (error) {
      console.error('❌ Error calculando contraste:', error);
      return 0;
    }
  }

  // CÁLCULO REAL DE HOMOGENEIDAD
  private calculateHomogeneity(matrix: number[][]): number {
    try {
      let homogeneity = 0;
      const total = matrix.reduce((sum, row) => sum + row.reduce((rowSum, val) => rowSum + val, 0), 0);
      
      for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
          if (matrix[i][j] > 0) {
            homogeneity += (matrix[i][j] / total) / (1 + Math.pow(i - j, 2));
          }
        }
      }
      
      return homogeneity;
      
    } catch (error) {
      console.error('❌ Error calculando homogeneidad:', error);
      return 0;
    }
  }

  // CÁLCULO REAL DE ENERGÍA
  private calculateEnergy(matrix: number[][]): number {
    try {
      let energy = 0;
      const total = matrix.reduce((sum, row) => sum + row.reduce((rowSum, val) => rowSum + val, 0), 0);
      
      for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
          if (matrix[i][j] > 0) {
            energy += Math.pow(matrix[i][j] / total, 2);
          }
        }
      }
      
      return energy;
      
    } catch (error) {
      console.error('❌ Error calculando energía:', error);
      return 0;
    }
  }

  // CÁLCULO REAL DE CORRELACIÓN
  private calculateCorrelation(matrix: number[][]): number {
    try {
      let correlation = 0;
      const total = matrix.reduce((sum, row) => sum + row.reduce((rowSum, val) => rowSum + val, 0), 0);
      
      // Calcular medias
      let meanI = 0, meanJ = 0;
      for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
          if (matrix[i][j] > 0) {
            meanI += (i * matrix[i][j]) / total;
            meanJ += (j * matrix[i][j]) / total;
          }
        }
      }
      
      // Calcular correlación
      for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
          if (matrix[i][j] > 0) {
            correlation += ((i - meanI) * (j - meanJ) * matrix[i][j]) / total;
          }
        }
      }
      
      return correlation;
      
    } catch (error) {
      console.error('❌ Error calculando correlación:', error);
      return 0;
    }
  }

  // CÁLCULO REAL DE ENTROPÍA
  private calculateEntropy(matrix: number[][]): number {
    try {
      let entropy = 0;
      const total = matrix.reduce((sum, row) => sum + row.reduce((rowSum, val) => rowSum + val, 0), 0);
      
      for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
          if (matrix[i][j] > 0) {
            const p = matrix[i][j] / total;
            entropy -= p * Math.log2(p);
          }
        }
      }
      
      return entropy;
      
    } catch (error) {
      console.error('❌ Error calculando entropía:', error);
      return 0;
    }
  }

  // APLICACIÓN REAL DE FILTROS
  public applyFilter(imageData: ImageData, filterName: string): Uint8Array {
    try {
      console.log(`🔍 Aplicando filtro matemático real: ${filterName}`);
      
      const filter = this.filters.get(filterName);
      if (!filter) {
        throw new Error(`Filtro no encontrado: ${filterName}`);
      }
      
      const { data, width, height } = imageData;
      const grayData = this.convertToGrayscale(data);
      
      // Aplicar filtro
      const filteredData = this.applyConvolution(grayData, width, height, filter.kernel);
      
      // Normalizar si es necesario
      if (filter.normalize) {
        this.normalizeFilteredData(filteredData);
      }
      
      // Convertir a Uint8Array
      const result = new Uint8Array(width * height);
      for (let i = 0; i < filteredData.length; i++) {
        result[i] = Math.max(0, Math.min(255, Math.round(filteredData[i])));
      }
      
      console.log(`✅ Filtro matemático real ${filterName} aplicado`);
      return result;
      
    } catch (error) {
      console.error(`❌ Error aplicando filtro ${filterName}:`, error);
      const { data, width, height } = imageData;
      return new Uint8Array(width * height);
    }
  }

  // NORMALIZACIÓN REAL DE DATOS FILTRADOS
  private normalizeFilteredData(data: Float32Array): void {
    try {
      // Encontrar valores mínimo y máximo
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < data.length; i++) {
        min = Math.min(min, data[i]);
        max = Math.max(max, data[i]);
      }
      
      // Normalizar a rango [0, 255]
      const range = max - min;
      if (range > 0) {
        for (let i = 0; i < data.length; i++) {
          data[i] = ((data[i] - min) / range) * 255;
        }
      }
      
    } catch (error) {
      console.error('❌ Error normalizando datos filtrados:', error);
    }
  }

  // FUNCIONES AUXILIARES
  private createEmptyEdgeResult(): EdgeDetectionResult {
    return {
      edges: new Uint8Array(0),
      magnitude: new Float32Array(0),
      direction: new Float32Array(0),
      width: 0,
      height: 0
    };
  }

  private createEmptyTextureResult(): TextureAnalysisResult {
    return {
      contrast: 0,
      homogeneity: 0,
      energy: 0,
      correlation: 0,
      entropy: 0
    };
  }
}

// INSTANCIA GLOBAL DEL PROCESADOR
export const realImageProcessor = new RealImageProcessor();

// FUNCIONES DE EXPORTACIÓN PARA USO DIRECTO
export const detectEdgesSobel = (imageData: ImageData): EdgeDetectionResult => {
  return realImageProcessor.detectEdgesSobel(imageData);
};

export const detectContoursReal = (edges: Uint8Array, width: number, height: number): any[] => {
  return realImageProcessor.detectContoursReal(edges, width, height);
};

export const analyzeTextureReal = (imageData: ImageData, region: { x: number; y: number; width: number; height: number }): TextureAnalysisResult => {
  return realImageProcessor.analyzeTextureReal(imageData, region);
};

export const applyFilter = (imageData: ImageData, filterName: string): Uint8Array => {
  return realImageProcessor.applyFilter(imageData, filterName);
};
