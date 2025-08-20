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













