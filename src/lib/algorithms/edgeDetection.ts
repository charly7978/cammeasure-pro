// ALGORITMOS AVANZADOS DE DETECCIÓN DE BORDES
// Implementación completa de operadores Sobel, Canny, Laplaciano y Scharr
// Basado en OpenCV y algoritmos matemáticos reales

export interface EdgeDetectionResult {
  edges: Uint8Array;
  gradientX: Float32Array;
  gradientY: Float32Array;
  magnitude: Float32Array;
  direction: Float32Array;
  confidence: number;
  processingTime: number;
}

export interface EdgeDetectionParams {
  kernelSize: number;
  sigma: number;
  lowThreshold: number;
  highThreshold: number;
  enableNonMaximaSuppression: boolean;
  enableHysteresisThresholding: boolean;
}

// OPERADOR SOBEL AVANZADO CON KERNELS OPTIMIZADOS
export class SobelEdgeDetector {
  private static readonly SOBEL_X_3x3 = new Float32Array([
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1
  ]);

  private static readonly SOBEL_Y_3x3 = new Float32Array([
    -1, -2, -1,
     0,  0,  0,
     1,  2,  1
  ]);

  private static readonly SOBEL_X_5x5 = new Float32Array([
    -2, -1, 0, 1, 2,
    -3, -2, 0, 2, 3,
    -4, -3, 0, 3, 4,
    -3, -2, 0, 2, 3,
    -2, -1, 0, 1, 2
  ]);

  private static readonly SOBEL_Y_5x5 = new Float32Array([
    -2, -3, -4, -3, -2,
    -1, -2, -3, -2, -1,
     0,  0,  0,  0,  0,
     1,  2,  3,  2,  1,
     2,  3,  4,  3,  2
  ]);

  static detectEdges(
    imageData: ImageData, 
    params: EdgeDetectionParams = this.getDefaultParams()
  ): EdgeDetectionResult {
    const startTime = performance.now();
    
    try {
      // 1. CONVERSIÓN A ESCALA DE GRISES CON FÓRMULA LUMINANCE
      const grayData = this.convertToGrayscale(imageData);
      
      // 2. APLICACIÓN DE FILTRO GAUSSIANO PARA REDUCIR RUIDO
      const smoothedData = this.applyGaussianFilter(grayData, imageData.width, imageData.height, params.sigma);
      
      // 3. CÁLCULO DE GRADIENTES CON OPERADOR SOBEL
      const { gradientX, gradientY } = this.calculateSobelGradients(
        smoothedData, 
        imageData.width, 
        imageData.height, 
        params.kernelSize
      );
      
      // 4. CÁLCULO DE MAGNITUD Y DIRECCIÓN DEL GRADIENTE
      const magnitude = this.calculateGradientMagnitude(gradientX, gradientY);
      const direction = this.calculateGradientDirection(gradientX, gradientY);
      
      // 5. APLICACIÓN DE ALGORITMO CANNY COMPLETO
      let edges: Uint8Array;
      if (params.enableNonMaximaSuppression && params.enableHysteresisThresholding) {
        edges = this.applyCannyAlgorithm(
          magnitude, 
          direction, 
          imageData.width, 
          imageData.height, 
          params.lowThreshold, 
          params.highThreshold
        );
      } else {
        // Umbralización simple si no se requiere Canny completo
        edges = this.applySimpleThreshold(magnitude, params.lowThreshold);
      }
      
      const processingTime = performance.now() - startTime;
      
      return {
        edges,
        gradientX,
        gradientY,
        magnitude,
        direction,
        confidence: this.calculateConfidence(edges, magnitude),
        processingTime
      };
      
    } catch (error) {
      console.error('Error en detección de bordes Sobel:', error);
      throw new Error(`Fallo en detección de bordes: ${error}`);
    }
  }

  private static convertToGrayscale(imageData: ImageData): Uint8Array {
    const grayData = new Uint8Array(imageData.width * imageData.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      
      // Fórmula de luminancia estándar ITU-R BT.709
      grayData[i / 4] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    
    return grayData;
  }

  private static applyGaussianFilter(
    data: Uint8Array, 
    width: number, 
    height: number, 
    sigma: number
  ): Uint8Array {
    const kernelSize = Math.ceil(6 * sigma);
    const kernel = this.generateGaussianKernel(kernelSize, sigma);
    const halfKernel = Math.floor(kernelSize / 2);
    
    const filteredData = new Uint8Array(width * height);
    
    // Aplicar filtro horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let k = 0; k < kernelSize; k++) {
          const xk = x + k - halfKernel;
          if (xk >= 0 && xk < width) {
            const weight = kernel[k];
            sum += data[y * width + xk] * weight;
            weightSum += weight;
          }
        }
        
        filteredData[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    // Aplicar filtro vertical
    const finalData = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let k = 0; k < kernelSize; k++) {
          const yk = y + k - halfKernel;
          if (yk >= 0 && yk < height) {
            const weight = kernel[k];
            sum += filteredData[yk * width + x] * weight;
            weightSum += weight;
          }
        }
        
        finalData[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    return finalData;
  }

  private static generateGaussianKernel(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size);
    const halfSize = Math.floor(size / 2);
    
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const x = i - halfSize;
      const value = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernel[i] = value;
      sum += value;
    }
    
    // Normalizar kernel
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  private static calculateSobelGradients(
    data: Uint8Array, 
    width: number, 
    height: number, 
    kernelSize: number
  ): { gradientX: Float32Array; gradientY: Float32Array } {
    const gradientX = new Float32Array(width * height);
    const gradientY = new Float32Array(width * height);
    
    const kernelX = kernelSize === 5 ? this.SOBEL_X_5x5 : this.SOBEL_X_3x3;
    const kernelY = kernelSize === 5 ? this.SOBEL_Y_5x5 : this.SOBEL_Y_3x3;
    const halfKernel = Math.floor(kernelSize / 2);
    
    for (let y = halfKernel; y < height - halfKernel; y++) {
      for (let x = halfKernel; x < width - halfKernel; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const pixel = data[(y + ky - halfKernel) * width + (x + kx - halfKernel)];
            const kernelXValue = kernelX[ky * kernelSize + kx];
            const kernelYValue = kernelY[ky * kernelSize + kx];
            
            gx += pixel * kernelXValue;
            gy += pixel * kernelYValue;
          }
        }
        
        const index = y * width + x;
        gradientX[index] = gx;
        gradientY[index] = gy;
      }
    }
    
    return { gradientX, gradientY };
  }

  private static calculateGradientMagnitude(
    gradientX: Float32Array, 
    gradientY: Float32Array
  ): Float32Array {
    const magnitude = new Float32Array(gradientX.length);
    
    for (let i = 0; i < gradientX.length; i++) {
      magnitude[i] = Math.sqrt(gradientX[i] * gradientX[i] + gradientY[i] * gradientY[i]);
    }
    
    return magnitude;
  }

  private static calculateGradientDirection(
    gradientX: Float32Array, 
    gradientY: Float32Array
  ): Float32Array {
    const direction = new Float32Array(gradientX.length);
    
    for (let i = 0; i < gradientX.length; i++) {
      direction[i] = Math.atan2(gradientY[i], gradientX[i]);
    }
    
    return direction;
  }

  private static applyCannyAlgorithm(
    magnitude: Float32Array,
    direction: Float32Array,
    width: number,
    height: number,
    lowThreshold: number,
    highThreshold: number
  ): Uint8Array {
    // 1. SUPRESIÓN DE NO-MÁXIMOS
    const suppressed = this.applyNonMaximaSuppression(magnitude, direction, width, height);
    
    // 2. UMBRALIZACIÓN CON HISTÉRESIS
    const edges = this.applyHysteresisThresholding(suppressed, width, height, lowThreshold, highThreshold);
    
    return edges;
  }

  private static applyNonMaximaSuppression(
    magnitude: Float32Array,
    direction: Float32Array,
    width: number,
    height: number
  ): Float32Array {
    const suppressed = new Float32Array(magnitude.length);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        const angle = direction[index];
        const mag = magnitude[index];
        
        // Normalizar ángulo a [0, π]
        let normalizedAngle = angle;
        if (normalizedAngle < 0) normalizedAngle += Math.PI;
        
        // Determinar dirección del gradiente (0°, 45°, 90°, 135°)
        let direction1, direction2;
        if (normalizedAngle < Math.PI / 8 || normalizedAngle >= 7 * Math.PI / 8) {
          // 0° - horizontal
          direction1 = magnitude[index - 1];
          direction2 = magnitude[index + 1];
        } else if (normalizedAngle < 3 * Math.PI / 8) {
          // 45° - diagonal superior derecha
          direction1 = magnitude[index - width - 1];
          direction2 = magnitude[index + width + 1];
        } else if (normalizedAngle < 5 * Math.PI / 8) {
          // 90° - vertical
          direction1 = magnitude[index - width];
          direction2 = magnitude[index + width];
        } else {
          // 135° - diagonal superior izquierda
          direction1 = magnitude[index - width + 1];
          direction2 = magnitude[index + width - 1];
        }
        
        // Suprimir si no es máximo local
        if (mag >= direction1 && mag >= direction2) {
          suppressed[index] = mag;
        } else {
          suppressed[index] = 0;
        }
      }
    }
    
    return suppressed;
  }

  private static applyHysteresisThresholding(
    data: Float32Array,
    width: number,
    height: number,
    lowThreshold: number,
    highThreshold: number
  ): Uint8Array {
    const edges = new Uint8Array(width * height);
    const visited = new Set<number>();
    
    // Marcar píxeles fuertes (above high threshold)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (data[index] >= highThreshold) {
          edges[index] = 255;
          this.traceWeakEdges(data, edges, visited, x, y, width, height, lowThreshold);
        }
      }
    }
    
    return edges;
  }

  private static traceWeakEdges(
    data: Float32Array,
    edges: Uint8Array,
    visited: Set<number>,
    x: number,
    y: number,
    width: number,
    height: number,
    lowThreshold: number
  ): void {
    const index = y * width + x;
    if (visited.has(index)) return;
    
    visited.add(index);
    
    // Verificar vecinos 8-conectados
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = ny * width + nx;
          
          if (data[neighborIndex] >= lowThreshold && edges[neighborIndex] === 0) {
            edges[neighborIndex] = 255;
            this.traceWeakEdges(data, edges, visited, nx, ny, width, height, lowThreshold);
          }
        }
      }
    }
  }

  private static applySimpleThreshold(magnitude: Float32Array, threshold: number): Uint8Array {
    const edges = new Uint8Array(magnitude.length);
    
    for (let i = 0; i < magnitude.length; i++) {
      edges[i] = magnitude[i] >= threshold ? 255 : 0;
    }
    
    return edges;
  }

  private static calculateConfidence(edges: Uint8Array, magnitude: Float32Array): number {
    const edgePixels = edges.filter(pixel => pixel > 0).length;
    const totalPixels = edges.length;
    const edgeRatio = edgePixels / totalPixels;
    
    // Calcular confianza basada en la relación de píxeles de borde y la magnitud promedio
    const averageMagnitude = magnitude.reduce((sum, mag) => sum + mag, 0) / magnitude.length;
    const normalizedMagnitude = Math.min(averageMagnitude / 255, 1);
    
    // Confianza combinada: relación de bordes + magnitud del gradiente
    return (edgeRatio * 0.6 + normalizedMagnitude * 0.4);
  }

  private static getDefaultParams(): EdgeDetectionParams {
    return {
      kernelSize: 3,
      sigma: 1.0,
      lowThreshold: 50,
      highThreshold: 150,
      enableNonMaximaSuppression: true,
      enableHysteresisThresholding: true
    };
  }
}

// OPERADOR LAPLACIANO AVANZADO
export class LaplacianEdgeDetector {
  private static readonly LAPLACIAN_3x3 = new Float32Array([
    0,  1, 0,
    1, -4, 1,
    0,  1, 0
  ]);

  private static readonly LAPLACIAN_5x5 = new Float32Array([
    0,  0,  1,  0,  0,
    0,  1,  2,  1,  0,
    1,  2, -16, 2,  1,
    0,  1,  2,  1,  0,
    0,  0,  1,  0,  0
  ]);

  static detectEdges(
    imageData: ImageData,
    kernelSize: number = 3
  ): EdgeDetectionResult {
    const startTime = performance.now();
    
    try {
      const grayData = SobelEdgeDetector.convertToGrayscale(imageData);
      const kernel = kernelSize === 5 ? this.LAPLACIAN_5x5 : this.LAPLACIAN_3x3;
      const halfKernel = Math.floor(kernelSize / 2);
      
      const edges = new Uint8Array(imageData.width * imageData.height);
      const gradientX = new Float32Array(imageData.width * imageData.height);
      const gradientY = new Float32Array(imageData.width * imageData.height);
      
      for (let y = halfKernel; y < imageData.height - halfKernel; y++) {
        for (let x = halfKernel; x < imageData.width - halfKernel; x++) {
          let sum = 0;
          
          for (let ky = 0; ky < kernelSize; ky++) {
            for (let kx = 0; kx < kernelSize; kx++) {
              const pixel = grayData[(y + ky - halfKernel) * imageData.width + (x + kx - halfKernel)];
              const kernelValue = kernel[ky * kernelSize + kx];
              sum += pixel * kernelValue;
            }
          }
          
          const index = y * imageData.width + x;
          edges[index] = Math.abs(sum) > 30 ? 255 : 0;
          
          // Para compatibilidad con la interfaz, crear gradientes simulados
          gradientX[index] = sum;
          gradientY[index] = sum;
        }
      }
      
      const magnitude = new Float32Array(edges.length);
      for (let i = 0; i < edges.length; i++) {
        magnitude[i] = edges[i];
      }
      
      const direction = new Float32Array(edges.length);
      for (let i = 0; i < edges.length; i++) {
        direction[i] = 0; // Laplaciano no tiene dirección
      }
      
      const processingTime = performance.now() - startTime;
      
      return {
        edges,
        gradientX,
        gradientY,
        magnitude,
        direction,
        confidence: SobelEdgeDetector.calculateConfidence(edges, magnitude),
        processingTime
      };
      
    } catch (error) {
      console.error('Error en detección de bordes Laplaciano:', error);
      throw new Error(`Fallo en detección Laplaciano: ${error}`);
    }
  }
}

// OPERADOR SCHARR AVANZADO (MEJORADO SOBRE SOBEL)
export class ScharrEdgeDetector {
  private static readonly SCHARR_X_3x3 = new Float32Array([
    -3, 0,  3,
    -10, 0, 10,
    -3, 0,  3
  ]);

  private static readonly SCHARR_Y_3x3 = new Float32Array([
    -3, -10, -3,
     0,   0,  0,
     3,  10,  3
  ]);

  static detectEdges(
    imageData: ImageData
  ): EdgeDetectionResult {
    const startTime = performance.now();
    
    try {
      const grayData = SobelEdgeDetector.convertToGrayscale(imageData);
      const smoothedData = SobelEdgeDetector.applyGaussianFilter(grayData, imageData.width, imageData.height, 1.0);
      
      const { gradientX, gradientY } = this.calculateScharrGradients(smoothedData, imageData.width, imageData.height);
      const magnitude = SobelEdgeDetector.calculateGradientMagnitude(gradientX, gradientY);
      const direction = SobelEdgeDetector.calculateGradientDirection(gradientX, gradientY);
      
      const edges = SobelEdgeDetector.applySimpleThreshold(magnitude, 40);
      
      const processingTime = performance.now() - startTime;
      
      return {
        edges,
        gradientX,
        gradientY,
        magnitude,
        direction,
        confidence: SobelEdgeDetector.calculateConfidence(edges, magnitude),
        processingTime
      };
      
    } catch (error) {
      console.error('Error en detección de bordes Scharr:', error);
      throw new Error(`Fallo en detección Scharr: ${error}`);
    }
  }

  private static calculateScharrGradients(
    data: Uint8Array,
    width: number,
    height: number
  ): { gradientX: Float32Array; gradientY: Float32Array } {
    const gradientX = new Float32Array(width * height);
    const gradientY = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = data[(y + ky) * width + (x + kx)];
            const kernelXValue = this.SCHARR_X_3x3[(ky + 1) * 3 + (kx + 1)];
            const kernelYValue = this.SCHARR_Y_3x3[(ky + 1) * 3 + (kx + 1)];
            
            gx += pixel * kernelXValue;
            gy += pixel * kernelYValue;
          }
        }
        
        const index = y * width + x;
        gradientX[index] = gx;
        gradientY[index] = gy;
      }
    }
    
    return { gradientX, gradientY };
  }
}

// FACTORY PARA SELECCIÓN AUTOMÁTICA DEL MEJOR ALGORITMO
export class EdgeDetectionFactory {
  static createDetector(algorithm: 'sobel' | 'canny' | 'laplacian' | 'scharr'): any {
    switch (algorithm) {
      case 'sobel':
        return SobelEdgeDetector;
      case 'canny':
        return SobelEdgeDetector; // Canny usa Sobel internamente
      case 'laplacian':
        return LaplacianEdgeDetector;
      case 'scharr':
        return ScharrEdgeDetector;
      default:
        throw new Error(`Algoritmo de detección de bordes no soportado: ${algorithm}`);
    }
  }

  static detectEdgesWithBestAlgorithm(
    imageData: ImageData,
    imageType: 'natural' | 'artificial' | 'medical' | 'satellite' = 'natural'
  ): EdgeDetectionResult {
    let algorithm: 'sobel' | 'canny' | 'laplacian' | 'scharr';
    
    // Selección inteligente del algoritmo basada en el tipo de imagen
    switch (imageType) {
      case 'natural':
        algorithm = 'canny'; // Mejor para imágenes naturales con ruido
        break;
      case 'artificial':
        algorithm = 'sobel'; // Mejor para imágenes con bordes claros
        break;
      case 'medical':
        algorithm = 'scharr'; // Mejor precisión para imágenes médicas
        break;
      case 'satellite':
        algorithm = 'laplacian'; // Mejor para detección de cambios sutiles
        break;
      default:
        algorithm = 'canny';
    }
    
    const detector = this.createDetector(algorithm);
    return detector.detectEdges(imageData);
  }
}
