/**
 * DETECTOR DE BORDES CANNY ULTRA AVANZADO
 * Implementación matemática precisa del algoritmo Canny con optimizaciones
 */

export interface CannyResult {
  edges: Uint8Array;
  magnitude: Float32Array;
  direction: Float32Array;
  processingTime: number;
  edgePixels: number;
}

export interface CannyParameters {
  lowThreshold: number;
  highThreshold: number;
  sigma: number;
  sobelKernelSize: number;
  l2Gradient: boolean;
}

export class CannyEdgeDetector {
  private static instance: CannyEdgeDetector;
  
  public static getInstance(): CannyEdgeDetector {
    if (!CannyEdgeDetector.instance) {
      CannyEdgeDetector.instance = new CannyEdgeDetector();
    }
    return CannyEdgeDetector.instance;
  }

  /**
   * DETECCIÓN DE BORDES CANNY COMPLETA
   */
  detectEdges(
    blurredData: Uint8Array,
    width: number,
    height: number,
    params: CannyParameters = {
      lowThreshold: 15,
      highThreshold: 80,
      sigma: 1.4,
      sobelKernelSize: 3,
      l2Gradient: true
    }
  ): CannyResult {
    const startTime = performance.now();
    
    console.log(`🔍 Iniciando Canny con umbrales: ${params.lowThreshold}-${params.highThreshold}`);
    
    // 1. CALCULAR GRADIENTES SOBEL DE ALTA PRECISIÓN
    const { magnitude, direction } = this.calculateGradients(
      blurredData, 
      width, 
      height, 
      params.sobelKernelSize,
      params.l2Gradient
    );
    
    // 2. SUPRESIÓN DE NO-MÁXIMOS MEJORADA
    const suppressed = this.nonMaximumSuppression(magnitude, direction, width, height);
    
    // 3. HISTÉRESIS DE DOBLE UMBRAL CON CONECTIVIDAD 8
    // Si los umbrales son <= 0, calcularlos de forma adaptativa sobre la magnitud ya calculada
    let low = params.lowThreshold;
    let high = params.highThreshold;
    if (low <= 0 || high <= 0) {
      const adaptive = this.calculateAdaptiveThresholds(magnitude, 0.06, 0.16);
      low = adaptive.lowThreshold;
      high = adaptive.highThreshold;
      console.log(`🧠 Umbrales Canny adaptativos: ${low.toFixed(2)} - ${high.toFixed(2)}`);
    }
    const edges = this.doubleThresholdHysteresis(
      suppressed, 
      width, 
      height, 
      low, 
      high
    );
    
    const processingTime = performance.now() - startTime;
    const edgePixels = this.countEdgePixels(edges);
    
    console.log(`✅ Canny completado en ${processingTime.toFixed(1)}ms, ${edgePixels} píxeles de borde`);
    
    return {
      edges,
      magnitude,
      direction,
      processingTime,
      edgePixels
    };
  }

  /**
   * CÁLCULO DE GRADIENTES SOBEL CON KERNELS OPTIMIZADOS
   */
  private calculateGradients(
    data: Uint8Array,
    width: number,
    height: number,
    kernelSize: number = 3,
    l2Gradient: boolean = true
  ): { magnitude: Float32Array; direction: Float32Array } {
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    
    // Kernels Sobel 3x3 optimizados
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    // Kernels Sobel 5x5 para mayor precisión (opcional)
    const sobel5X = [
      -1, -2, 0, 2, 1,
      -4, -8, 0, 8, 4,
      -6, -12, 0, 12, 6,
      -4, -8, 0, 8, 4,
      -1, -2, 0, 2, 1
    ];
    
    const kernelX = kernelSize === 3 ? sobelX : sobel5X;
    const kernelY = kernelSize === 3 ? sobelY : sobel5X.map((_, i, arr) => arr[Math.floor(i / kernelSize) * kernelSize + (kernelSize - 1 - (i % kernelSize))]);
    const radius = Math.floor(kernelSize / 2);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let gx = 0, gy = 0;
        
        // Aplicar convolución con kernels Sobel
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const pixelIdx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + radius) * kernelSize + (kx + radius);
            const pixelValue = data[pixelIdx];
            
            gx += pixelValue * kernelX[kernelIdx];
            gy += pixelValue * kernelY[kernelIdx];
          }
        }
        
        const idx = y * width + x;
        
        // Calcular magnitud (L1 o L2)
        if (l2Gradient) {
          magnitude[idx] = Math.sqrt(gx * gx + gy * gy); // L2 norm (más preciso)
        } else {
          magnitude[idx] = Math.abs(gx) + Math.abs(gy); // L1 norm (más rápido)
        }
        
        // Calcular dirección del gradiente
        direction[idx] = Math.atan2(gy, gx);
      }
    }
    
    return { magnitude, direction };
  }

  /**
   * SUPRESIÓN DE NO-MÁXIMOS CON INTERPOLACIÓN SUB-PÍXEL
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
        
        if (mag === 0) continue;
        
        // Determinar dirección del gradiente y vecinos para interpolación
        const angleNorm = this.normalizeAngle(angle);
        const { neighbor1, neighbor2 } = this.getInterpolatedNeighbors(
          magnitude, angleNorm, x, y, width, height
        );
        
        // Mantener solo si es máximo local
        if (mag >= neighbor1 && mag >= neighbor2) {
          result[idx] = mag;
        }
      }
    }
    
    return result;
  }

  /**
   * NORMALIZAR ÁNGULO A [0, π]
   */
  private normalizeAngle(angle: number): number {
    let normalized = angle;
    if (normalized < 0) normalized += Math.PI;
    if (normalized >= Math.PI) normalized -= Math.PI;
    return normalized;
  }

  /**
   * OBTENER VECINOS INTERPOLADOS PARA SUPRESIÓN
   */
  private getInterpolatedNeighbors(
    magnitude: Float32Array,
    angle: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): { neighbor1: number; neighbor2: number } {
    const PI_8 = Math.PI / 8;
    
    let neighbor1 = 0, neighbor2 = 0;
    
    if (angle < PI_8 || angle >= 7 * PI_8) {
      // Dirección horizontal (0°)
      neighbor1 = magnitude[y * width + (x - 1)];
      neighbor2 = magnitude[y * width + (x + 1)];
    } else if (angle >= PI_8 && angle < 3 * PI_8) {
      // Dirección diagonal (45°)
      neighbor1 = magnitude[(y - 1) * width + (x + 1)];
      neighbor2 = magnitude[(y + 1) * width + (x - 1)];
    } else if (angle >= 3 * PI_8 && angle < 5 * PI_8) {
      // Dirección vertical (90°)
      neighbor1 = magnitude[(y - 1) * width + x];
      neighbor2 = magnitude[(y + 1) * width + x];
    } else {
      // Dirección diagonal (135°)
      neighbor1 = magnitude[(y - 1) * width + (x - 1)];
      neighbor2 = magnitude[(y + 1) * width + (x + 1)];
    }
    
    return { neighbor1, neighbor2 };
  }

  /**
   * HISTÉRESIS DE DOBLE UMBRAL CON RASTREO DE BORDES
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
    
    // Paso 1: Clasificar píxeles
    for (let i = 0; i < magnitude.length; i++) {
      if (magnitude[i] >= highThreshold) {
        edges[i] = 255; // Borde fuerte
      } else if (magnitude[i] >= lowThreshold) {
        edges[i] = 128; // Borde débil
      }
      // else: 0 (no borde)
    }
    
    // Paso 2: Conectar bordes débiles a bordes fuertes
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 255 && !visited[idx]) {
          this.traceConnectedEdges(edges, visited, x, y, width, height);
        }
      }
    }
    
    // Paso 3: Eliminar bordes débiles no conectados
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === 128) {
        edges[i] = 0;
      }
    }
    
    return edges;
  }

  /**
   * RASTREAR BORDES CONECTADOS (CONECTIVIDAD 8)
   */
  private traceConnectedEdges(
    edges: Uint8Array,
    visited: boolean[],
    startX: number,
    startY: number,
    width: number,
    height: number
  ): void {
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    
    // Direcciones 8-conectadas
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx]) continue;
      visited[idx] = true;
      
      // Examinar todos los vecinos 8-conectados
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          
          if (edges[nIdx] === 128 && !visited[nIdx]) {
            edges[nIdx] = 255; // Promover borde débil
            stack.push({ x: nx, y: ny });
          }
        }
      }
    }
  }

  /**
   * CONTAR PÍXELES DE BORDE
   */
  private countEdgePixels(edges: Uint8Array): number {
    let count = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === 255) count++;
    }
    return count;
  }

  /**
   * PARÁMETROS ADAPTATIVOS BASADOS EN CONTENIDO DE IMAGEN
   */
  calculateAdaptiveThresholds(
    magnitude: Float32Array,
    percentileLow: number = 0.05,
    percentileHigh: number = 0.15
  ): { lowThreshold: number; highThreshold: number } {
    // Calcular histograma de magnitudes
    const histogram = new Array(256).fill(0);
    let maxMag = 0;
    
    for (let i = 0; i < magnitude.length; i++) {
      maxMag = Math.max(maxMag, magnitude[i]);
    }
    
    // Normalizar y construir histograma
    for (let i = 0; i < magnitude.length; i++) {
      const bin = Math.floor((magnitude[i] / maxMag) * 255);
      histogram[bin]++;
    }
    
    // Encontrar umbrales basados en percentiles
    const totalPixels = magnitude.length;
    const lowTarget = totalPixels * percentileLow;
    const highTarget = totalPixels * percentileHigh;
    
    let sum = 0;
    let lowThreshold = 0, highThreshold = 0;
    
    for (let i = 255; i >= 0; i--) {
      sum += histogram[i];
      
      if (sum >= highTarget && highThreshold === 0) {
        highThreshold = (i / 255) * maxMag;
      }
      
      if (sum >= lowTarget && lowThreshold === 0) {
        lowThreshold = (i / 255) * maxMag;
        break;
      }
    }
    
    return { lowThreshold, highThreshold };
  }
}