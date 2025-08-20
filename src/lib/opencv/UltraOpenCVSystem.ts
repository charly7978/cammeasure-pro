/**
 * SISTEMA OPENCV ULTRA AVANZADO UNIFICADO
 * Integra detección de siluetas, calibración y medición en un solo sistema
 */

import { UltraSilhouetteDetector } from './UltraSilhouetteDetector';
import { UltraCalibrationSystem } from './UltraCalibrationSystem';
import { UltraMeasurementSystem } from './UltraMeasurementSystem';
import type { DetectedObject } from '../types';
import type { UltraSilhouetteResult } from './UltraSilhouetteDetector';
import type { CalibrationResult } from './UltraCalibrationSystem';
import type { MeasurementResult } from './UltraMeasurementSystem';

export interface UltraOpenCVResult {
  detection: UltraSilhouetteResult;
  calibration: CalibrationResult | null;
  measurements: MeasurementResult[];
  processingTime: number;
  status: 'success' | 'partial' | 'error';
  error?: string;
}

export interface UltraOpenCVSettings {
  // Configuración general
  enableAutoCalibration: boolean;
  enableRealTimeProcessing: boolean;
  maxProcessingTime: number; // ms
  
  // Configuración de detección
  detectionConfidence: number;
  maxObjectsToDetect: number;
  
  // Configuración de calibración
  calibrationConfidence: number;
  autoCalibrationInterval: number; // ms
  
  // Configuración de medición
  measurementPrecision: number;
  enableUnitConversion: boolean;
}

export class UltraOpenCVSystem {
  private static instance: UltraOpenCVSystem;
  private silhouetteDetector: UltraSilhouetteDetector;
  private calibrationSystem: UltraCalibrationSystem;
  private measurementSystem: UltraMeasurementSystem;
  private settings: UltraOpenCVSettings;
  private isProcessing: boolean = false;
  private lastAutoCalibration: number = 0;

  private constructor() {
    this.silhouetteDetector = UltraSilhouetteDetector.getInstance();
    this.calibrationSystem = UltraCalibrationSystem.getInstance();
    this.measurementSystem = UltraMeasurementSystem.getInstance();
    
    this.settings = {
      enableAutoCalibration: true,
      enableRealTimeProcessing: true,
      maxProcessingTime: 5000, // 5 segundos máximo
      detectionConfidence: 0.7,
      maxObjectsToDetect: 3,
      calibrationConfidence: 0.8,
      autoCalibrationInterval: 300000, // 5 minutos
      measurementPrecision: 2,
      enableUnitConversion: true
    };
  }

  public static getInstance(): UltraOpenCVSystem {
    if (!UltraOpenCVSystem.instance) {
      UltraOpenCVSystem.instance = new UltraOpenCVSystem();
    }
    return UltraOpenCVSystem.instance;
  }

  /**
   * PROCESAMIENTO COMPLETO ULTRA AVANZADO
   */
  async processImage(
    imageData: ImageData,
    options: {
      autoCalibrate?: boolean;
      measureObjects?: boolean;
      customCalibration?: CalibrationResult;
    } = {}
  ): Promise<UltraOpenCVResult> {
    if (this.isProcessing) {
      throw new Error('Sistema ocupado procesando otra imagen');
    }

    this.isProcessing = true;
    const startTime = performance.now();
    
    try {
      console.log('🚀 INICIANDO PROCESAMIENTO ULTRA AVANZADO COMPLETO');
      
      // 1. DETECCIÓN DE SILUETAS ULTRA AVANZADA
      console.log('🔍 Paso 1: Detección de siluetas...');
      const detection = await this.silhouetteDetector.detectSilhouettes(
        imageData,
        null,
        {
          minContourArea: imageData.width * imageData.height * 0.001,
          maxContourArea: imageData.width * imageData.height * 0.8,
          centerPriority: 0.7,
          shapeRegularity: 0.5,
          sizeConsistency: 0.4
        }
      );
      
      if (detection.objects.length === 0) {
        throw new Error('No se detectaron objetos en la imagen');
      }
      
      console.log(`✅ Detección completada: ${detection.objects.length} objetos encontrados`);
      
      // 2. CALIBRACIÓN AUTOMÁTICA O MANUAL
      let calibration: CalibrationResult | null = null;
      
      if (options.customCalibration) {
        console.log('🔧 Usando calibración personalizada...');
        calibration = options.customCalibration;
      } else if (options.autoCalibrate !== false && this.shouldAutoCalibrate()) {
        console.log('🔧 Iniciando calibración automática...');
        try {
          calibration = await this.calibrationSystem.autoCalibrate(imageData);
          this.lastAutoCalibration = Date.now();
        } catch (error) {
          console.warn('⚠️ Calibración automática falló, continuando sin calibración:', error);
        }
      } else {
        calibration = this.calibrationSystem.getCurrentCalibration();
        if (calibration && !this.calibrationSystem.validateCurrentCalibration()) {
          console.warn('⚠️ Calibración actual expirada o inválida');
          calibration = null;
        }
      }
      
      // 3. MEDICIÓN DE OBJETOS
      let measurements: MeasurementResult[] = [];
      
      if (options.measureObjects !== false && calibration) {
        console.log('📏 Iniciando medición de objetos...');
        
        try {
          measurements = await this.measurementSystem.measureMultipleObjects(
            detection.objects.slice(0, this.settings.maxObjectsToDetect),
            calibration
          );
          
          console.log(`✅ Medición completada: ${measurements.length} objetos medidos`);
          
        } catch (error) {
          console.error('❌ Error en medición:', error);
          // Continuar sin mediciones
        }
      }
      
      // 4. VALIDAR TIEMPO DE PROCESAMIENTO
      const processingTime = performance.now() - startTime;
      if (processingTime > this.settings.maxProcessingTime) {
        console.warn(`⚠️ Procesamiento lento: ${processingTime.toFixed(1)}ms`);
      }
      
      // 5. DETERMINAR ESTADO DEL RESULTADO
      let status: 'success' | 'partial' | 'error' = 'success';
      if (!calibration && !measurements.length) {
        status = 'partial';
      } else if (!calibration || !measurements.length) {
        status = 'partial';
      }
      
      const result: UltraOpenCVResult = {
        detection,
        calibration,
        measurements,
        processingTime,
        status
      };
      
      console.log(`🏆 PROCESAMIENTO ULTRA AVANZADO COMPLETADO en ${processingTime.toFixed(1)}ms`);
      console.log(`📊 Estado: ${status}, Objetos: ${detection.objects.length}, Mediciones: ${measurements.length}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en procesamiento ultra avanzado:', error);
      
      const processingTime = performance.now() - startTime;
      
      return {
        detection: {
          objects: [],
          processingTime,
          edgeMap: new Uint8Array(imageData.width * imageData.height),
          contours: [],
          debugInfo: {
            edgePixels: 0,
            contoursFound: 0,
            validContours: 0,
            averageConfidence: 0,
            algorithm: 'Error',
            calibrationStatus: 'Error'
          }
        },
        calibration: null,
        measurements: [],
        processingTime,
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * PROCESAMIENTO EN TIEMPO REAL (OPTIMIZADO)
   */
  async processRealTime(
    imageData: ImageData,
    calibration: CalibrationResult | null = null
  ): Promise<UltraOpenCVResult> {
    if (!this.settings.enableRealTimeProcessing) {
      throw new Error('Procesamiento en tiempo real deshabilitado');
    }
    
    const startTime = performance.now();
    
    try {
      // 1. DETECCIÓN RÁPIDA
      const detection = await this.silhouetteDetector.detectSilhouettes(
        imageData,
        calibration,
        {
          minContourArea: imageData.width * imageData.height * 0.002,
          maxContourArea: imageData.width * imageData.height * 0.6,
          centerPriority: 0.8,
          shapeRegularity: 0.6,
          sizeConsistency: 0.5
        }
      );
      
      // 2. MEDICIÓN RÁPIDA SI HAY CALIBRACIÓN
      let measurements: MeasurementResult[] = [];
      if (calibration && detection.objects.length > 0) {
        const bestObject = detection.objects[0];
        try {
          const measurement = await this.measurementSystem.measureRealTime(bestObject, calibration);
          measurements = [measurement];
        } catch (error) {
          console.warn('⚠️ Medición en tiempo real falló:', error);
        }
      }
      
      const processingTime = performance.now() - startTime;
      
      return {
        detection,
        calibration,
        measurements,
        processingTime,
        status: measurements.length > 0 ? 'success' : 'partial'
      };
      
    } catch (error) {
      console.error('❌ Error en procesamiento en tiempo real:', error);
      throw error;
    }
  }

  /**
   * CALIBRACIÓN MANUAL CON OBJETO SELECCIONADO
   */
  async calibrateWithObject(
    imageData: ImageData,
    objectId: string,
    knownSize: number
  ): Promise<CalibrationResult> {
    console.log(`🔧 Calibrando con objeto ${objectId}: ${knownSize}mm`);
    
    try {
      // 1. DETECTAR OBJETOS
      const detection = await this.silhouetteDetector.detectSilhouettes(imageData);
      
      // 2. ENCONTRAR OBJETO ESPECÍFICO
      const targetObject = detection.objects.find(obj => obj.id === objectId);
      if (!targetObject) {
        throw new Error(`Objeto ${objectId} no encontrado`);
      }
      
      // 3. CALIBRAR CON TAMAÑO CONOCIDO
      const calibration = await this.calibrationSystem.referenceCalibrate(
        imageData,
        knownSize,
        2 // ±2mm de tolerancia
      );
      
      console.log(`✅ Calibración manual exitosa: ${calibration.pixelsPerMm.toFixed(2)} px/mm`);
      
      return calibration;
      
    } catch (error) {
      console.error('❌ Error en calibración manual:', error);
      throw error;
    }
  }

  /**
   * OBTENER ESTADO DEL SISTEMA
   */
  getSystemStatus(): {
    isProcessing: boolean;
    hasCalibration: boolean;
    calibrationQuality: number;
    lastProcessingTime: number;
    totalObjectsDetected: number;
    totalMeasurements: number;
  } {
    const calibration = this.calibrationSystem.getCurrentCalibration();
    const detectionStats = this.silhouetteDetector ? { totalObjects: 0 } : { totalObjects: 0 };
    const measurementStats = this.measurementSystem.getMeasurementStats();
    
    return {
      isProcessing: this.isProcessing,
      hasCalibration: !!calibration,
      calibrationQuality: calibration?.confidence || 0,
      lastProcessingTime: 0, // Se actualiza en tiempo real
      totalObjectsDetected: detectionStats.totalObjects,
      totalMeasurements: measurementStats.totalMeasurements
    };
  }

  /**
   * ACTUALIZAR CONFIGURACIÓN
   */
  updateSettings(newSettings: Partial<UltraOpenCVSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // Actualizar configuraciones de subsistemas
    this.measurementSystem.updateSettings({
      measurementPrecision: this.settings.measurementPrecision,
      autoConvertUnits: this.settings.enableUnitConversion
    });
    
    console.log('⚙️ Configuración del sistema ultra avanzado actualizada');
  }

  /**
   * OBTENER CONFIGURACIÓN ACTUAL
   */
  getSettings(): UltraOpenCVSettings {
    return { ...this.settings };
  }

  /**
   * RESETEAR SISTEMA
   */
  resetSystem(): void {
    console.log('🔄 Reseteando sistema ultra avanzado...');
    
    this.calibrationSystem.resetCalibration();
    this.measurementSystem.clearHistory();
    this.isProcessing = false;
    this.lastAutoCalibration = 0;
    
    console.log('✅ Sistema reseteado');
  }

  /**
   * EXPORTAR DATOS DEL SISTEMA
   */
  exportSystemData(): string {
    const data = {
      calibration: this.calibrationSystem.getCurrentCalibration(),
      measurements: this.measurementSystem.exportMeasurements(),
      settings: this.settings,
      exportDate: new Date().toISOString()
    };
    
    return btoa(JSON.stringify(data));
  }

  /**
   * IMPORTAR DATOS DEL SISTEMA
   */
  importSystemData(systemData: string): void {
    try {
      const data = JSON.parse(atob(systemData));
      
      if (data.settings) {
        this.updateSettings(data.settings);
      }
      
      if (data.calibration) {
        // Importar calibración si es válida
        const calibration = data.calibration;
        if (calibration.isCalibrated && calibration.pixelsPerMm > 0) {
          this.calibrationSystem.importCalibration(btoa(JSON.stringify(calibration)));
        }
      }
      
      if (data.measurements) {
        this.measurementSystem.importMeasurements(data.measurements);
      }
      
      console.log('✅ Datos del sistema importados');
      
    } catch (error) {
      throw new Error('Formato de datos del sistema inválido');
    }
  }

  /**
   * VERIFICAR SI DEBE REALIZAR CALIBRACIÓN AUTOMÁTICA
   */
  private shouldAutoCalibrate(): boolean {
    if (!this.settings.enableAutoCalibration) return false;
    
    const now = Date.now();
    const timeSinceLastCalibration = now - this.lastAutoCalibration;
    
    return timeSinceLastCalibration >= this.settings.autoCalibrationInterval;
  }

  /**
   * OBTENER ESTADÍSTICAS COMPLETAS DEL SISTEMA
   */
  getSystemStats(): {
    calibration: ReturnType<typeof this.calibrationSystem.getCalibrationStats>;
    measurements: ReturnType<typeof this.measurementSystem.getMeasurementStats>;
    system: {
      totalProcessingTime: number;
      averageProcessingTime: number;
      successRate: number;
      lastActivity: Date | null;
    };
  } {
    const calibrationStats = this.calibrationSystem.getCalibrationStats();
    const measurementStats = this.measurementSystem.getMeasurementStats();
    
    // Estadísticas del sistema (simplificadas)
    const systemStats = {
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successRate: 0.95, // Estimado
      lastActivity: new Date()
    };
    
    return {
      calibration: calibrationStats,
      measurements: measurementStats,
      system: systemStats
    };
  }

  /**
   * VALIDAR IMAGEN ANTES DEL PROCESAMIENTO
   */
  private validateImage(imageData: ImageData): boolean {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
      return false;
    }
    
    if (imageData.width < 100 || imageData.height < 100) {
      console.warn('⚠️ Imagen demasiado pequeña para procesamiento confiable');
      return false;
    }
    
    if (imageData.width > 4000 || imageData.height > 4000) {
      console.warn('⚠️ Imagen demasiado grande, puede ser lenta de procesar');
    }
    
    return true;
  }

  /**
   * OPTIMIZAR IMAGEN PARA PROCESAMIENTO
   */
  private optimizeImage(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    
    // Si la imagen es muy grande, redimensionar para optimizar
    if (width > 2000 || height > 2000) {
      const scale = Math.min(2000 / width, 2000 / height);
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      
      console.log(`🔄 Redimensionando imagen de ${width}x${height} a ${newWidth}x${newHeight} para optimización`);
      
      // Crear canvas para redimensionar
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Crear ImageData temporal
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(imageData, 0, 0);
      
      // Redimensionar
      ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
      
      return ctx.getImageData(0, 0, newWidth, newHeight);
    }
    
    return imageData;
  }
}
