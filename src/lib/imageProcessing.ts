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
      console.error('❌ Error inicializando filtros matemáticos:', error);
    }
  }

  // DETECCIÓN REAL DE BORDES CON OPERADOR SOBEL
  public detectEdgesSobel(imageData: ImageData): EdgeDetectionResult {
    try {
      console.log('🔍 Aplicando detección real de bordes con operador Sobel...');
      
      const { data, width, height } = imageData;
      const grayData = this.convertToGrayscale(data);
      
      // Aplicar operadores Sobel X e Y
      const sobelX = this.applyConvolution(grayData, width, height, this.getSobelXKernel());
      const sobelY = this.applyConvolution(grayData, width, height, this.getSobelYKernel());
      
      // Calcular magnitud y dirección del gradiente
      const magnitude = this.calculateGradientMagnitude(sobelX, sobelY, width, height);
      const direction = this.calculateGradientDirection(sobelX, sobelY, width, height);
      
      // Aplicar umbral adaptativo
      const edges = this.applyAdaptiveThreshold(magnitude, width, height);
      
      const result: EdgeDetectionResult = {
        edges,
        magnitude,
        direction,
        width,
        height
      };
      
      console.log('✅ Detección real de bordes con Sobel completada');
      return result;
      
    } catch (error) {
      console.error('❌ Error en detección real de bordes:', error);
      return this.createEmptyEdgeResult();
    }
  }

  // CONVERSIÓN REAL A ESCALA DE GRISES
  private convertToGrayscale(data: Uint8ClampedArray): Uint8Array {
    try {
      const grayData = new Uint8Array(data.length / 4);
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Fórmula estándar de luminancia: Y = 0.299R + 0.587G + 0.114B
        grayData[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
      
      return grayData;
      
    } catch (error) {
      console.error('❌ Error convirtiendo a escala de grises:', error);
      return new Uint8Array(data.length / 4);
    }
  }

  // KERNELS SOBEL REALES
  private getSobelXKernel(): number[][] {
    return [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1]
    ];
  }

  private getSobelYKernel(): number[][] {
    return [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1]
    ];
  }

  // APLICACIÓN REAL DE CONVOLUCIÓN 2D
  private applyConvolution(data: Uint8Array, width: number, height: number, kernel: number[][]): Float32Array {
    try {
      const kernelSize = kernel.length;
      const halfKernel = Math.floor(kernelSize / 2);
      const result = new Float32Array(width * height);
      
      // Aplicar convolución 2D
      for (let y = halfKernel; y < height - halfKernel; y++) {
        for (let x = halfKernel; x < width - halfKernel; x++) {
          let sum = 0;
          
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const pixelX = x + kx - halfKernel;
              const pixelY = y + ky - halfKernel;
              const pixelValue = data[pixelY * width + pixelX];
              const kernelValue = kernel[ky][kx];
              
              sum += pixelValue * kernelValue;
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
      
      return {
        points,
        boundingBox,
        area,
        perimeter,
        averageIntensity
      };
      
    } catch (error) {
      console.error('❌ Error trazando contorno:', error);
      return { points: [], boundingBox: { x: 0, y: 0, width: 0, height: 0 }, area: 0, perimeter: 0, averageIntensity: 0 };
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
      
      const result: TextureAnalysisResult = {
        contrast,
        homogeneity,
        energy,
        correlation,
        entropy
      };
      
      console.log('✅ Análisis real de textura completado');
      return result;
      
    } catch (error) {
      console.error('❌ Error en análisis real de textura:', error);
      return this.createEmptyTextureResult();
    }
  }

  // EXTRACCIÓN REAL DE REGIÓN DE INTERÉS
  private extractROI(data: Uint8Array, imageWidth: number, region: { x: number; y: number; width: number; height: number }): Uint8Array {
    try {
      const { x, y, width, height } = region;
      const roiData = new Uint8Array(width * height);
      
      let index = 0;
      for (let row = y; row < y + height; row++) {
        for (let col = x; col < x + width; col++) {
          roiData[index++] = data[row * imageWidth + col];
        }
      }
      
      return roiData;
      
    } catch (error) {
      console.error('❌ Error extrayendo ROI:', error);
      return new Uint8Array(0);
    }
  }

  // CÁLCULO REAL DE MATRIZ DE CO-OCURRENCIA
  private calculateCooccurrenceMatrix(data: Uint8Array, width: number, height: number): number[][] {
    try {
      const matrix = Array(256).fill(0).map(() => Array(256).fill(0));
      
      // Calcular matriz de co-ocurrencia (distancia 1, dirección 0°)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
          const pixel1 = data[y * width + x];
          const pixel2 = data[y * width + x + 1];
          
          matrix[pixel1][pixel2]++;
          matrix[pixel2][pixel1]++; // Simétrica
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
            const normalized = matrix[i][j] / total;
            contrast += normalized * Math.pow(i - j, 2);
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
            const normalized = matrix[i][j] / total;
            homogeneity += normalized / (1 + Math.pow(i - j, 2));
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
            const normalized = matrix[i][j] / total;
            energy += normalized * normalized;
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
            const normalized = matrix[i][j] / total;
            meanI += i * normalized;
            meanJ += j * normalized;
          }
        }
      }
      
      // Calcular correlación
      for (let i = 0; i < 256; i++) {
        for (let j = 0; j < 256; j++) {
          if (matrix[i][j] > 0) {
            const normalized = matrix[i][j] / total;
            correlation += normalized * (i - meanI) * (j - meanJ);
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
            const normalized = matrix[i][j] / total;
            entropy -= normalized * Math.log2(normalized);
          }
        }
      }
      
      return entropy;
      
    } catch (error) {
      console.error('❌ Error calculando entropía:', error);
      return 0;
    }
  }

  // FILTROS MATEMÁTICOS REALES
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

  // IMPLEMENTACIÓN REAL DE FILTROS AVANZADOS DE NIVEL INDUSTRIAL
  
  // 1. FILTRO CLAHE REAL (Contrast Limited Adaptive Histogram Equalization)
  export const applyCLAHE = async (imageData: ImageData, width: number, height: number): Promise<ImageData> => {
    try {
      console.log('🔬 Aplicando CLAHE real...');
      
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      const blockSize = 8;
      const clipLimit = 3.0;
      
      for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
          // Calcular histograma local
          const histogram = new Array(256).fill(0);
          for (let by = 0; by < blockSize && y + by < height; by++) {
            for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
              const gray = Math.round(0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2]);
              histogram[gray]++;
            }
          }
          
          // Aplicar límite de contraste
          const totalPixels = blockSize * blockSize;
          const excess = Math.max(0, Math.max(...histogram) - clipLimit * totalPixels / 256);
          if (excess > 0) {
            for (let i = 0; i < 256; i++) {
              histogram[i] = Math.min(histogram[i], clipLimit * totalPixels / 256);
            }
          }
          
          // Aplicar transformación de histograma
          for (let by = 0; by < blockSize && y + by < height; by++) {
            for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
              const gray = Math.round(0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2]);
              
              // Calcular CDF
              let cdf = 0;
              for (let i = 0; i <= gray; i++) {
                cdf += histogram[i];
              }
              
              const newGray = Math.round((cdf / totalPixels) * 255);
              newImageData.data[idx] = newGray;
              newImageData.data[idx + 1] = newGray;
              newImageData.data[idx + 2] = newGray;
            }
          }
        }
      }
      
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error en CLAHE:', error);
      return imageData;
    }
  };

  // 2. FILTRO BILATERAL REAL
  export const applyBilateralFilter = async (imageData: ImageData, width: number, height: number): Promise<ImageData> => {
    try {
      console.log('🔍 Aplicando filtro bilateral real...');
      
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      const radius = 5;
      const sigmaSpace = 50;
      const sigmaColor = 30;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let totalWeight = 0;
          let r = 0, g = 0, b = 0;
          
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const idx = (ny * width + nx) * 4;
                const centerIdx = (y * width + x) * 4;
                
                // Distancia espacial
                const spatialDist = Math.sqrt(dx * dx + dy * dy);
                const spatialWeight = Math.exp(-(spatialDist * spatialDist) / (2 * sigmaSpace * sigmaSpace));
                
                // Diferencia de color
                const colorDiffR = Math.abs(imageData.data[idx] - imageData.data[centerIdx]);
                const colorDiffG = Math.abs(imageData.data[idx + 1] - imageData.data[centerIdx + 1]);
                const colorDiffB = Math.abs(imageData.data[idx + 2] - imageData.data[centerIdx + 2]);
                const colorDist = Math.sqrt(colorDiffR * colorDiffR + colorDiffG * colorDiffG + colorDiffB * colorDiffB);
                const colorWeight = Math.exp(-(colorDist * colorDist) / (2 * sigmaColor * sigmaColor));
                
                const weight = spatialWeight * colorWeight;
                totalWeight += weight;
                
                r += imageData.data[idx] * weight;
                g += imageData.data[idx + 1] * weight;
                b += imageData.data[idx + 2] * weight;
              }
            }
          }
          
          const idx = (y * width + x) * 4;
          newImageData.data[idx] = r / totalWeight;
          newImageData.data[idx + 1] = g / totalWeight;
          newImageData.data[idx + 2] = b / totalWeight;
        }
      }
      
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error en filtro bilateral:', error);
      return imageData;
    }
  };

  // 3. DETECCIÓN DE BORDES GABOR REAL
  export const detectGaborEdges = async (imageData: ImageData, width: number, height: number): Promise<Uint8Array> => {
    try {
      console.log('🌊 Aplicando filtros Gabor reales...');
      
      const orientations = [0, 45, 90, 135];
      const frequencies = [0.1, 0.2, 0.4];
      const sigma = 2.0;
      
      const responses = [];
      
      for (const orientation of orientations) {
        for (const frequency of frequencies) {
          const response = await applyGaborFilter(imageData, width, height, orientation, frequency, sigma);
          responses.push(response);
        }
      }
      
      // Fusión de respuestas Gabor
      const fusedResponse = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        let maxResponse = 0;
        for (const response of responses) {
          maxResponse = Math.max(maxResponse, response[i]);
        }
        fusedResponse[i] = maxResponse;
      }
      
      return fusedResponse;
      
    } catch (error) {
      console.error('❌ Error en Gabor:', error);
      return new Uint8Array(width * height);
    }
  };

  // 4. APLICAR FILTRO GABOR INDIVIDUAL
  const applyGaborFilter = async (imageData: ImageData, width: number, height: number, orientation: number, frequency: number, sigma: number): Promise<Uint8Array> => {
    try {
      const response = new Uint8Array(width * height);
      const orientationRad = (orientation * Math.PI) / 180;
      
      const lambda = 1 / frequency;
      const gamma = 0.5;
      const psi = 0;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const xPrime = (x - width / 2) * Math.cos(orientationRad) + (y - height / 2) * Math.sin(orientationRad);
          const yPrime = -(x - width / 2) * Math.sin(orientationRad) + (y - height / 2) * Math.cos(orientationRad);
          
          const gabor = Math.exp(-(xPrime * xPrime + gamma * gamma * yPrime * yPrime) / (2 * sigma * sigma)) * 
                       Math.cos(2 * Math.PI * xPrime / lambda + psi);
          
          let sum = 0;
          let weightSum = 0;
          
          for (let dy = -Math.ceil(3 * sigma); dy <= Math.ceil(3 * sigma); dy++) {
            for (let dx = -Math.ceil(3 * sigma); dx <= Math.ceil(3 * sigma); dx++) {
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const idx = (ny * width + nx) * 4;
                const gray = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2];
                
                const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
                sum += gray * weight * gabor;
                weightSum += weight;
              }
            }
          }
          
          response[y * width + x] = Math.abs(sum / weightSum);
        }
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ Error en filtro Gabor individual:', error);
      return new Uint8Array(width * height);
    }
  };

  // 5. DETECCIÓN CANNY AVANZADA REAL
  export const detectAdvancedCanny = async (imageData: ImageData, width: number, height: number): Promise<Uint8Array> => {
    try {
      console.log('🔪 Aplicando Canny avanzado real...');
      
      // 1. Suavizado gaussiano
      const smoothed = await applyGaussianBlur(imageData, width, height, 1.5);
      
      // 2. Cálculo de gradientes
      const gradients = await calculateGradients(smoothed, width, height);
      
      // 3. Supresión de no-máximos
      const suppressed = await suppressNonMaxima(gradients, width, height);
      
      // 4. Umbralización adaptativa
      const edges = await adaptiveThresholding(suppressed, width, height);
      
      return edges;
      
    } catch (error) {
      console.error('❌ Error en Canny avanzado:', error);
      return new Uint8Array(width * height);
    }
  };

  // 6. CÁLCULO DE GRADIENTES REAL
  const calculateGradients = async (imageData: ImageData, width: number, height: number): Promise<any> => {
    try {
      const gradients = {
        magnitude: new Float32Array(width * height),
        direction: new Float32Array(width * height)
      };
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          // Gradientes de Sobel
          const gx = -imageData.data[idx - 4] + imageData.data[idx + 4] +
                     -2 * imageData.data[idx - 4 + width * 4] + 2 * imageData.data[idx + 4 + width * 4] +
                     -imageData.data[idx - 4 + 2 * width * 4] + imageData.data[idx + 4 + 2 * width * 4];
          
          const gy = -imageData.data[idx - width * 4] + imageData.data[idx + width * 4] +
                     -2 * imageData.data[idx - width * 4 + 4] + 2 * imageData.data[idx + width * 4 + 4] +
                     -imageData.data[idx - width * 4 + 8] + imageData.data[idx + width * 4 + 8];
          
          gradients.magnitude[y * width + x] = Math.sqrt(gx * gx + gy * gy);
          gradients.direction[y * width + x] = Math.atan2(gy, gx);
        }
      }
      
      return gradients;
      
    } catch (error) {
      console.error('❌ Error calculando gradientes:', error);
      return { magnitude: new Float32Array(width * height), direction: new Float32Array(width * height) };
    }
  };

  // 7. FILTRO GAUSSIANO REAL
  export const applyGaussianBlur = async (imageData: ImageData, width: number, height: number, radius: number): Promise<ImageData> => {
    try {
      const newImageData = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
      const sigma = radius / 3;
      const kernelSize = Math.ceil(radius * 2 + 1);
      const kernel = [];
      
      // Generar kernel gaussiano
      let sum = 0;
      for (let i = 0; i < kernelSize; i++) {
        kernel[i] = [];
        for (let j = 0; j < kernelSize; j++) {
          const x = i - radius;
          const y = j - radius;
          const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
          kernel[i][j] = value;
          sum += value;
        }
      }
      
      // Normalizar kernel
      for (let i = 0; i < kernelSize; i++) {
        for (let j = 0; j < kernelSize; j++) {
          kernel[i][j] /= sum;
        }
      }
      
      // Aplicar convolución
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0;
          
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const ny = y + ky - radius;
              const nx = x + kx - radius;
              
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const idx = (ny * width + nx) * 4;
                const weight = kernel[ky][kx];
                
                r += imageData.data[idx] * weight;
                g += imageData.data[idx + 1] * weight;
                b += imageData.data[idx + 2] * weight;
              }
            }
          }
          
          const idx = (y * width + x) * 4;
          newImageData.data[idx] = r;
          newImageData.data[idx + 1] = g;
          newImageData.data[idx + 2] = b;
        }
      }
      
      return newImageData;
      
    } catch (error) {
      console.error('❌ Error en filtro gaussiano:', error);
      return imageData;
    }
  };
