/**
 * SISTEMA OPENCV ULTRA AVANZADO - PUNTO DE ENTRADA PRINCIPAL
 * Arquitectura modular profesional con algoritmos matemáticos precisos
 */

import { SilhouetteDetector } from './processors/SilhouetteDetector';
import type { DetectedObject } from '../types';

export interface OpenCVSystemResult {
  objects: DetectedObject[];
  processingTime: number;
  edgeMap: Uint8Array;
  contours: Array<{ x: number; y: number }>[];
}

export interface CalibrationData {
  pixelsPerMm: number;
  isCalibrated: boolean;
}

/**
 * SISTEMA OPENCV UNIFICADO ULTRA AVANZADO
 * Clase principal que orquesta todos los componentes especializados
 */
class OpenCVSystem {
  private static instance: OpenCVSystem;
  private silhouetteDetector: SilhouetteDetector;
  private isInitialized = false;

  private constructor() {
    this.silhouetteDetector = SilhouetteDetector.getInstance();
  }

  public static getInstance(): OpenCVSystem {
    if (!OpenCVSystem.instance) {
      OpenCVSystem.instance = new OpenCVSystem();
    }
    return OpenCVSystem.instance;
  }

  /**
   * INICIALIZACIÓN AUTOMÁTICA DEL SISTEMA
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🚀 INICIALIZANDO SISTEMA OPENCV ULTRA AVANZADO...');
    
    try {
      // Pre-calentar los detectores
      console.log('🔥 Pre-calentando detectores especializados...');
      
      // Verificar que todos los componentes estén listos
      if (!this.silhouetteDetector) {
        throw new Error('SilhouetteDetector no inicializado');
      }
      
      this.isInitialized = true;
      console.log('✅ SISTEMA OPENCV INICIALIZADO CORRECTAMENTE');
      
    } catch (error) {
      console.error('❌ Error inicializando OpenCV System:', error);
      throw error;
    }
  }

  /**
   * DETECTAR SILUETAS DE OBJETOS CON PIPELINE COMPLETO
   * Función principal que utiliza todo el poder del sistema
   */
  async detectObjectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null,
    touchPoint?: { x: number; y: number } | null
  ): Promise<OpenCVSystemResult> {
    // Auto-inicializar si es necesario
    if (!this.isInitialized) {
      console.log('🚀 Auto-inicializando OpenCV System...');
      await this.initialize();
    }

    console.log('🎯 INICIANDO DETECCIÓN COMPLETA DE SILUETAS...');
    console.log(`📱 Modo: ${touchPoint ? 'TOQUE' : 'CENTRO AUTOMÁTICO'}`);
    
    try {
      // Usar el detector de siluetas especializado
      const result = await this.silhouetteDetector.detectSilhouettes(imageData, calibrationData, touchPoint);
      
      console.log(`✅ Detección completada: ${result.objects.length} objetos encontrados`);
      
      // Formatear resultado para compatibilidad
      return {
        objects: result.objects,
        processingTime: result.processingTime,
        edgeMap: result.edgeMap,
        contours: result.contours
      };
      
    } catch (error) {
      console.error('❌ Error en detección de siluetas:', error);
      
      // Fallback básico
      return {
        objects: [],
        processingTime: 0,
        edgeMap: new Uint8Array(imageData.width * imageData.height),
        contours: []
      };
    }
  }

  /**
   * DIBUJAR OVERLAY DE DETECCIÓN
   */
  drawDetectionOverlay(
    canvas: HTMLCanvasElement,
    result: OpenCVSystemResult,
    showEdges: boolean = false
  ): void {
    // Convertir a formato SilhouetteDetectionResult para mantener compatibilidad
    const silhouetteResult = {
      objects: result.objects,
      processingTime: result.processingTime,
      edgeMap: result.edgeMap,
      contours: result.contours,
      debugInfo: {
        edgePixels: this.countEdgePixels(result.edgeMap),
        contoursFound: result.contours.length,
        validContours: result.objects.length,
        averageConfidence: result.objects.length > 0 
          ? result.objects.reduce((sum, obj) => sum + obj.confidence, 0) / result.objects.length 
          : 0
      }
    };
    
    this.silhouetteDetector.drawDetectionOverlay(canvas, silhouetteResult, showEdges, true);
  }

  /**
   * CONTAR PÍXELES DE BORDE
   */
  private countEdgePixels(edgeMap: Uint8Array): number {
    let count = 0;
    for (let i = 0; i < edgeMap.length; i++) {
      if (edgeMap[i] > 0) count++;
    }
    return count;
  }

  /**
   * OBTENER ESTADÍSTICAS DEL SISTEMA
   */
  getSystemStats(): {
    isInitialized: boolean;
    version: string;
    components: string[];
  } {
    return {
      isInitialized: this.isInitialized,
      version: '2.0.0-ultra',
      components: [
        'ImageProcessor',
        'CannyEdgeDetector', 
        'ContourDetector',
        'SilhouetteDetector'
      ]
    };
  }
}

// Instancia singleton
export const openCVSystem = OpenCVSystem.getInstance();

// Función de conveniencia para uso directo
export const detectObjectsWithOpenCV = async (
  imageData: ImageData,
  calibrationData: CalibrationData | null = null,
  touchPoint?: { x: number; y: number } | null
): Promise<OpenCVSystemResult> => {
  return openCVSystem.detectObjectSilhouettes(imageData, calibrationData, touchPoint);
};

// Función de inicialización explícita
export const initializeOpenCV = async (): Promise<void> => {
  return openCVSystem.initialize();
};

// Exportar componentes para uso avanzado
export { SilhouetteDetector } from './processors/SilhouetteDetector';
export { ImageProcessor } from './core/ImageProcessor';
export { CannyEdgeDetector } from './algorithms/CannyEdgeDetector';
export { ContourDetector } from './algorithms/ContourDetector';
export { depthVolumeCalculator, DepthVolumeCalculator } from './processors/DepthVolumeCalculator';

// Exportar tipos específicos
export type { 
  OpenCVSystemResult as OpenCVResult, 
  CalibrationData as OpenCVCalibrationData 
};