/**
 * PROCESADOR DE IMÁGENES AVANZADO
 * Implementa algoritmos matemáticos de procesamiento de imagen de nivel profesional
 */

export interface ProcessedImageData {
  grayscale: Uint8Array;
  blurred: Uint8Array;
  edges: Uint8Array;
  processed: Uint8Array;
  width: number;
  height: number;
  processingTime: number;
}

export class ImageProcessor {
  private static instance: ImageProcessor;
  
  public static getInstance(): ImageProcessor {
    if (!ImageProcessor.instance) {
      ImageProcessor.instance = new ImageProcessor();
    }
    return ImageProcessor.instance;
  }

  /**
   * CONVERSIÓN A ESCALA DE GRISES CON ALGORITMO OPTIMIZADO
   * Utiliza pesos luminancia ITU-R BT.709 para máxima precisión
   */
  convertToGrayscale(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const grayscale = new Uint8Array(width * height);
    
    // Pesos luminancia ITU-R BT.709 (estándar profesional)
    const R_WEIGHT = 0.2126;
    const G_WEIGHT = 0.7152;
    const B_WEIGHT = 0.0722;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Conversión con gamma correction
      const luminance = Math.sqrt(
        R_WEIGHT * r * r + 
        G_WEIGHT * g * g + 
        B_WEIGHT * b * b
      );
      
      grayscale[i / 4] = Math.round(luminance);
    }
    
    return grayscale;
  }

  /**
   * FILTRO GAUSSIANO AVANZADO CON KERNEL SEPARABLE
   * Implementación optimizada O(n) usando convolución separable
   */
  applyGaussianBlur(
    data: Uint8Array, 
    width: number, 
    height: number, 
    sigma: number = 1.4
  ): Uint8Array {
    // Calcular tamaño de kernel óptimo
    const kernelSize = Math.ceil(sigma * 6) | 1; // Asegurar impar
    const radius = Math.floor(kernelSize / 2);
    
    // Generar kernel 1D Gaussiano
    const kernel = this.generateGaussianKernel1D(kernelSize, sigma);
    
    // Aplicar convolución separable (horizontal primero, luego vertical)
    const temp = this.convolveHorizontal(data, width, height, kernel, radius);
    const result = this.convolveVertical(temp, width, height, kernel, radius);
    
    return result;
  }

  /**
   * GENERAR KERNEL GAUSSIANO 1D NORMALIZADO
   */
  private generateGaussianKernel1D(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size);
    const center = Math.floor(size / 2);
    const sigma2 = sigma * sigma;
    const factor = 1.0 / Math.sqrt(2 * Math.PI * sigma2);
    
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const x = i - center;
      const value = factor * Math.exp(-(x * x) / (2 * sigma2));
      kernel[i] = value;
      sum += value;
    }
    
    // Normalizar
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  /**
   * CONVOLUCIÓN HORIZONTAL OPTIMIZADA
   */
  private convolveHorizontal(
    data: Uint8Array, 
    width: number, 
    height: number, 
    kernel: Float32Array, 
    radius: number
  ): Uint8Array {
    const result = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.max(0, Math.min(width - 1, x + kx));
          const weight = kernel[kx + radius];
          
          sum += data[y * width + px] * weight;
          weightSum += weight;
        }
        
        result[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    return result;
  }

  /**
   * CONVOLUCIÓN VERTICAL OPTIMIZADA
   */
  private convolveVertical(
    data: Uint8Array, 
    width: number, 
    height: number, 
    kernel: Float32Array, 
    radius: number
  ): Uint8Array {
    const result = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          const py = Math.max(0, Math.min(height - 1, y + ky));
          const weight = kernel[ky + radius];
          
          sum += data[py * width + x] * weight;
          weightSum += weight;
        }
        
        result[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    return result;
  }

  /**
   * PROCESAMIENTO COMPLETO DE IMAGEN
   */
  processImage(imageData: ImageData, sigma: number = 1.4): ProcessedImageData {
    const startTime = performance.now();
    const { width, height } = imageData;
    
    // Pipeline de procesamiento optimizado
    const grayscale = this.convertToGrayscale(imageData);
    const blurred = this.applyGaussianBlur(grayscale, width, height, sigma);
    
    const processingTime = performance.now() - startTime;
    
    return {
      grayscale,
      blurred,
      edges: new Uint8Array(width * height), // Se llena en EdgeDetector
      processed: blurred,
      width,
      height,
      processingTime
    };
  }

  /**
   * MEJORA DE CONTRASTE ADAPTATIVA (CLAHE)
   */
  enhanceContrast(data: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(width * height);
    const tileSize = 64; // Tamaño de ventana adaptativa
    const clipLimit = 2.0; // Límite de recorte
    
    // Implementación CLAHE simplificada
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const endY = Math.min(y + tileSize, height);
        const endX = Math.min(x + tileSize, width);
        
        // Calcular histograma local
        const histogram = new Array(256).fill(0);
        let pixelCount = 0;
        
        for (let ty = y; ty < endY; ty++) {
          for (let tx = x; tx < endX; tx++) {
            const value = data[ty * width + tx];
            histogram[value]++;
            pixelCount++;
          }
        }
        
        // Aplicar ecualización adaptativa
        const cdf = this.calculateCDF(histogram, pixelCount);
        
        for (let ty = y; ty < endY; ty++) {
          for (let tx = x; tx < endX; tx++) {
            const idx = ty * width + tx;
            const value = data[idx];
            result[idx] = Math.round(cdf[value] * 255);
          }
        }
      }
    }
    
    return result;
  }

  /**
   * CALCULAR FUNCIÓN DE DISTRIBUCIÓN ACUMULATIVA
   */
  private calculateCDF(histogram: number[], totalPixels: number): number[] {
    const cdf = new Array(256);
    let sum = 0;
    
    for (let i = 0; i < 256; i++) {
      sum += histogram[i];
      cdf[i] = sum / totalPixels;
    }
    
    return cdf;
  }
}