/**
 * WRAPPER DE COMPATIBILIDAD - SISTEMA OPENCV ULTRA AVANZADO
 * Mantiene compatibilidad mientras redirige al nuevo sistema modular
 */

import { openCVSystem, detectObjectsWithOpenCV, type CalibrationData } from './opencv';
import { DetectedObject } from '@/lib/types';

interface OpenCVDetectionResult {
  objects: DetectedObject[];
  processingTime: number;
  edgeMap: Uint8Array;
  contours: Array<{ x: number; y: number }>[];
}

class UnifiedOpenCVSystem {
  private isProcessing = false;

  /**
   * DETECTAR SILUETAS - WRAPPER AL NUEVO SISTEMA ULTRA AVANZADO
   */
  async detectObjectSilhouettes(
    imageData: ImageData, 
    calibrationData: CalibrationData | null = null,
    touchPoint?: { x: number; y: number } | null
  ): Promise<OpenCVDetectionResult> {
    if (this.isProcessing) {
      return { objects: [], processingTime: 0, edgeMap: new Uint8Array(0), contours: [] };
    }

    // VALIDACIÓN DE SEGURIDAD - PREVENIR ATAQUES DoS
    if (!this.validateImageData(imageData)) {
      console.error('❌ Datos de imagen inválidos o demasiado grandes');
      return { objects: [], processingTime: 0, edgeMap: new Uint8Array(0), contours: [] };
    }

    this.isProcessing = true;

    try {
      console.log('🔄 Redirigiendo al sistema OpenCV ultra avanzado...');
      
      // Usar el nuevo sistema modular ultra avanzado
      const result = await detectObjectsWithOpenCV(imageData, calibrationData, touchPoint);
      
      return {
        objects: result.objects,
        processingTime: result.processingTime,
        edgeMap: result.edgeMap,
        contours: result.contours
      };

    } catch (error) {
      console.error('❌ Error en sistema ultra avanzado:', error);
      return { objects: [], processingTime: 0, edgeMap: new Uint8Array(0), contours: [] };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * VALIDACIÓN DE SEGURIDAD PARA DATOS DE IMAGEN
   * Previene ataques DoS y buffer overflows
   */
  private validateImageData(imageData: ImageData): boolean {
    try {
      // Verificar que imageData existe
      if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
        console.error('❌ ImageData inválido o nulo');
        return false;
      }

      // Límites de seguridad para dimensiones de imagen
      const MAX_DIMENSION = 4096; // Máximo 4K
      const MAX_PIXELS = 16777216; // Máximo 16M píxeles (4K x 4K)
      const MAX_MEMORY = 268435456; // Máximo 256MB de memoria

      // Verificar dimensiones
      if (imageData.width <= 0 || imageData.height <= 0) {
        console.error('❌ Dimensiones de imagen inválidas');
        return false;
      }

      if (imageData.width > MAX_DIMENSION || imageData.height > MAX_DIMENSION) {
        console.error(`❌ Imagen demasiado grande: ${imageData.width}x${imageData.height}`);
        return false;
      }

      // Verificar número total de píxeles
      const totalPixels = imageData.width * imageData.height;
      if (totalPixels > MAX_PIXELS) {
        console.error(`❌ Demasiados píxeles: ${totalPixels}`);
        return false;
      }

      // Verificar tamaño de datos
      const expectedDataSize = totalPixels * 4; // RGBA
      if (imageData.data.length !== expectedDataSize) {
        console.error(`❌ Tamaño de datos incorrecto: esperado ${expectedDataSize}, obtenido ${imageData.data.length}`);
        return false;
      }

      // Verificar uso de memoria
      const memoryUsage = imageData.data.length * imageData.data.BYTES_PER_ELEMENT;
      if (memoryUsage > MAX_MEMORY) {
        console.error(`❌ Uso de memoria excesivo: ${memoryUsage} bytes`);
        return false;
      }

      // Verificar que todos los valores de píxeles están en rango válido
      for (let i = 0; i < Math.min(imageData.data.length, 1000); i += 4) { // Solo verificar primeros 1000 píxeles
        if (imageData.data[i] > 255 || imageData.data[i + 1] > 255 || 
            imageData.data[i + 2] > 255 || imageData.data[i + 3] > 255) {
          console.error('❌ Valores de píxeles fuera de rango válido');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error validando datos de imagen:', error);
      return false;
    }
  }

  /**
   * VALIDACIÓN DE DIMENSIONES DE IMAGEN PARA PROCESAMIENTO
   * Método auxiliar para validar dimensiones en funciones de procesamiento
   */
  private validateImageDimensions(width: number, height: number, dataLength: number): boolean {
    try {
      // Verificar dimensiones básicas
      if (width <= 0 || height <= 0) {
        console.error('❌ Dimensiones de imagen inválidas');
        return false;
      }

      // Verificar límites de seguridad
      const MAX_DIMENSION = 4096;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        console.error(`❌ Imagen demasiado grande: ${width}x${height}`);
        return false;
      }

      // Verificar que el tamaño de datos coincide con las dimensiones
      const expectedSize = width * height;
      if (dataLength !== expectedSize && dataLength !== expectedSize * 4) {
        console.error(`❌ Tamaño de datos no coincide con dimensiones: esperado ${expectedSize} o ${expectedSize * 4}, obtenido ${dataLength}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error validando dimensiones de imagen:', error);
      return false;
    }
  }

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
    
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  /**
   * CONVERSIÓN A ESCALA DE GRISES OPTIMIZADA
   */
  private convertToGrayscale(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
    // Validación de seguridad
    if (!this.validateImageDimensions(width, height, data.length)) {
      throw new Error('Dimensiones de imagen inválidas para conversión a escala de grises');
    }

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
    // Validación de seguridad
    if (!this.validateImageDimensions(width, height, data.length)) {
      throw new Error('Dimensiones de imagen inválidas para filtro gaussiano');
    }

    // Validar parámetros del filtro
    if (sigma <= 0 || sigma > 10) {
      throw new Error('Parámetro sigma inválido para filtro gaussiano');
    }

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
   * DIBUJAR OVERLAY DE DETECCIÓN - WRAPPER AL NUEVO SISTEMA
   */
  drawDetectionOverlay(
    overlayCanvas: HTMLCanvasElement,
    result: OpenCVDetectionResult,
    showEdges: boolean = false
  ): void {
    // Usar el nuevo sistema para dibujar
    openCVSystem.drawDetectionOverlay(overlayCanvas, result, showEdges);
  }
}

// Exportar instancia singleton
export const unifiedOpenCV = new UnifiedOpenCVSystem();

// Función helper para usar desde componentes
export const detectObjectsWithOpenCVUnified = async (
  imageData: ImageData,
  calibrationData: CalibrationData | null = null
): Promise<OpenCVDetectionResult> => {
  return unifiedOpenCV.detectObjectSilhouettes(imageData, calibrationData);
};













