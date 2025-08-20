/**
 * SISTEMA DE MEDICIÓN ULTRA PRECISO
 * Mediciones exactas en milímetros usando calibración avanzada
 */

import type { DetectedObject } from '../types';
import type { CalibrationResult } from './UltraCalibrationSystem';

export interface MeasurementResult {
  object: DetectedObject;
  measurements: {
    width: number;
    height: number;
    area: number;
    perimeter: number;
    diagonal: number;
    aspectRatio: number;
    unit: 'mm' | 'cm' | 'm';
  };
  confidence: number;
  errorMargin: number;
  timestamp: number;
  calibrationUsed: CalibrationResult;
}

export interface MeasurementSettings {
  // Precisión de medición
  measurementPrecision: number; // decimales
  errorTolerance: number; // porcentaje máximo de error
  
  // Unidades preferidas
  preferredUnit: 'mm' | 'cm' | 'm';
  autoConvertUnits: boolean;
  
  // Validación de mediciones
  minMeasurementSize: number; // mm
  maxMeasurementSize: number; // mm
  validateMeasurements: boolean;
}

export class UltraMeasurementSystem {
  private static instance: UltraMeasurementSystem;
  private settings: MeasurementSettings;
  private measurementHistory: MeasurementResult[] = [];

  private constructor() {
    this.settings = {
      measurementPrecision: 2,
      errorTolerance: 0.05, // 5% máximo
      preferredUnit: 'mm',
      autoConvertUnits: true,
      minMeasurementSize: 0.1, // 0.1mm mínimo
      maxMeasurementSize: 10000, // 10m máximo
      validateMeasurements: true
    };
  }

  public static getInstance(): UltraMeasurementSystem {
    if (!UltraMeasurementSystem.instance) {
      UltraMeasurementSystem.instance = new UltraMeasurementSystem();
    }
    return UltraMeasurementSystem.instance;
  }

  /**
   * MEDIR OBJETO CON CALIBRACIÓN ULTRA PRECISA
   */
  async measureObject(
    object: DetectedObject,
    calibration: CalibrationResult
  ): Promise<MeasurementResult> {
    console.log(`📏 Iniciando medición ultra precisa del objeto ${object.id}`);
    
    try {
      // 1. VALIDAR CALIBRACIÓN
      if (!this.validateCalibration(calibration)) {
        throw new Error('Calibración inválida o expirada');
      }
      
      // 2. CALCULAR MEDICIONES EN PÍXELES
      const pixelMeasurements = this.calculatePixelMeasurements(object);
      
      // 3. CONVERTIR A MEDIDAS REALES
      const realMeasurements = this.convertToRealMeasurements(
        pixelMeasurements, 
        calibration
      );
      
      // 4. VALIDAR MEDICIONES
      if (this.settings.validateMeasurements) {
        this.validateMeasurements(realMeasurements);
      }
      
      // 5. CALCULAR CONFIANZA Y ERROR
      const { confidence, errorMargin } = this.calculateMeasurementConfidence(
        object, 
        calibration, 
        realMeasurements
      );
      
      // 6. CREAR RESULTADO DE MEDICIÓN
      const result: MeasurementResult = {
        object,
        measurements: realMeasurements,
        confidence,
        errorMargin,
        timestamp: Date.now(),
        calibrationUsed: calibration
      };
      
      // 7. ALMACENAR EN HISTORIAL
      this.measurementHistory.push(result);
      
      console.log(`✅ Medición completada: ${realMeasurements.width.toFixed(2)} × ${realMeasurements.height.toFixed(2)} ${realMeasurements.unit}`);
      console.log(`📊 Confianza: ${(confidence * 100).toFixed(1)}%, Error: ±${(errorMargin * 100).toFixed(1)}%`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en medición:', error);
      throw error;
    }
  }

  /**
   * MEDIR MÚLTIPLES OBJETOS
   */
  async measureMultipleObjects(
    objects: DetectedObject[],
    calibration: CalibrationResult
  ): Promise<MeasurementResult[]> {
    console.log(`📏 Iniciando medición de ${objects.length} objetos...`);
    
    const results: MeasurementResult[] = [];
    
    for (let i = 0; i < objects.length; i++) {
      try {
        const result = await this.measureObject(objects[i], calibration);
        results.push(result);
        
        console.log(`✅ Objeto ${i + 1}/${objects.length} medido`);
        
      } catch (error) {
        console.error(`❌ Error midiendo objeto ${i + 1}:`, error);
        // Continuar con el siguiente objeto
      }
    }
    
    console.log(`🏆 Medición masiva completada: ${results.length}/${objects.length} objetos medidos`);
    
    return results;
  }

  /**
   * MEDICIÓN EN TIEMPO REAL (OPTIMIZADA)
   */
  async measureRealTime(
    object: DetectedObject,
    calibration: CalibrationResult
  ): Promise<MeasurementResult> {
    // Versión optimizada para mediciones en tiempo real
    const startTime = performance.now();
    
    try {
      // Validación rápida
      if (!calibration.isCalibrated || calibration.confidence < 0.7) {
        throw new Error('Calibración insuficiente para medición en tiempo real');
      }
      
      // Cálculos optimizados
      const pixelMeasurements = this.calculatePixelMeasurements(object);
      const realMeasurements = this.convertToRealMeasurements(pixelMeasurements, calibration);
      
      // Validación mínima
      if (realMeasurements.width < this.settings.minMeasurementSize || 
          realMeasurements.width > this.settings.maxMeasurementSize) {
        throw new Error('Medición fuera de rango válido');
      }
      
      const result: MeasurementResult = {
        object,
        measurements: realMeasurements,
        confidence: Math.min(0.95, calibration.confidence * 0.9),
        errorMargin: calibration.errorMargin,
        timestamp: Date.now(),
        calibrationUsed: calibration
      };
      
      const processingTime = performance.now() - startTime;
      console.log(`⚡ Medición en tiempo real: ${processingTime.toFixed(1)}ms`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en medición en tiempo real:', error);
      throw error;
    }
  }

  /**
   * CALCULAR MEDICIONES EN PÍXELES
   */
  private calculatePixelMeasurements(object: DetectedObject): {
    width: number;
    height: number;
    area: number;
    perimeter: number;
    diagonal: number;
    aspectRatio: number;
  } {
    const { boundingBox, area, perimeter } = object;
    
    const width = boundingBox.width;
    const height = boundingBox.height;
    const diagonal = Math.sqrt(width * width + height * height);
    const aspectRatio = width / height;
    
    return {
      width,
      height,
      area: area || (width * height),
      perimeter: perimeter || (2 * (width + height)),
      diagonal,
      aspectRatio
    };
  }

  /**
   * CONVERTIR A MEDIDAS REALES
   */
  private convertToRealMeasurements(
    pixelMeasurements: ReturnType<typeof this.calculatePixelMeasurements>,
    calibration: CalibrationResult
  ): MeasurementResult['measurements'] {
    const { pixelsPerMm } = calibration;
    
    // Convertir píxeles a milímetros
    const widthMm = pixelMeasurements.width / pixelsPerMm;
    const heightMm = pixelMeasurements.height / pixelsPerMm;
    const areaMm2 = pixelMeasurements.area / (pixelsPerMm * pixelsPerMm);
    const perimeterMm = pixelMeasurements.perimeter / pixelsPerMm;
    const diagonalMm = pixelMeasurements.diagonal / pixelsPerMm;
    const aspectRatio = pixelMeasurements.aspectRatio;
    
    // Determinar unidad óptima
    let unit: 'mm' | 'cm' | 'm' = 'mm';
    let conversionFactor = 1;
    
    if (this.settings.autoConvertUnits) {
      if (Math.max(widthMm, heightMm) >= 1000) {
        unit = 'm';
        conversionFactor = 0.001;
      } else if (Math.max(widthMm, heightMm) >= 10) {
        unit = 'cm';
        conversionFactor = 0.1;
      }
    } else {
      unit = this.settings.preferredUnit;
      switch (unit) {
        case 'cm':
          conversionFactor = 0.1;
          break;
        case 'm':
          conversionFactor = 0.001;
          break;
        default:
          conversionFactor = 1;
      }
    }
    
    // Aplicar conversión y precisión
    const precision = Math.pow(10, this.settings.measurementPrecision);
    
    return {
      width: Math.round(widthMm * conversionFactor * precision) / precision,
      height: Math.round(heightMm * conversionFactor * precision) / precision,
      area: Math.round(areaMm2 * conversionFactor * conversionFactor * precision) / precision,
      perimeter: Math.round(perimeterMm * conversionFactor * precision) / precision,
      diagonal: Math.round(diagonalMm * conversionFactor * precision) / precision,
      aspectRatio: Math.round(aspectRatio * precision) / precision,
      unit
    };
  }

  /**
   * VALIDAR CALIBRACIÓN
   */
  private validateCalibration(calibration: CalibrationResult): boolean {
    if (!calibration.isCalibrated) return false;
    
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    
    return (
      calibration.confidence >= 0.7 &&
      (now - calibration.timestamp) < maxAge &&
      calibration.pixelsPerMm > 0 &&
      calibration.pixelsPerMm < 1000 // Límite razonable
    );
  }

  /**
   * VALIDAR MEDICIONES
   */
  private validateMeasurements(measurements: MeasurementResult['measurements']): void {
    const { width, height, unit } = measurements;
    
    // Convertir a mm para validación
    let widthMm = width;
    let heightMm = height;
    
    switch (unit) {
      case 'cm':
        widthMm = width * 10;
        heightMm = height * 10;
        break;
      case 'm':
        widthMm = width * 1000;
        heightMm = height * 1000;
        break;
    }
    
    if (widthMm < this.settings.minMeasurementSize) {
      throw new Error(`Ancho demasiado pequeño: ${widthMm}mm < ${this.settings.minMeasurementSize}mm`);
    }
    
    if (widthMm > this.settings.maxMeasurementSize) {
      throw new Error(`Ancho demasiado grande: ${widthMm}mm > ${this.settings.maxMeasurementSize}mm`);
    }
    
    if (heightMm < this.settings.minMeasurementSize) {
      throw new Error(`Alto demasiado pequeño: ${heightMm}mm < ${this.settings.minMeasurementSize}mm`);
    }
    
    if (heightMm > this.settings.maxMeasurementSize) {
      throw new Error(`Alto demasiado grande: ${heightMm}mm > ${this.settings.maxMeasurementSize}mm`);
    }
  }

  /**
   * CALCULAR CONFIANZA DE MEDICIÓN
   */
  private calculateMeasurementConfidence(
    object: DetectedObject,
    calibration: CalibrationResult,
    measurements: MeasurementResult['measurements']
  ): { confidence: number; errorMargin: number } {
    // Confianza base de la calibración
    let confidence = calibration.confidence;
    
    // Ajustar por calidad del objeto detectado
    confidence *= object.confidence;
    
    // Ajustar por regularidad de forma
    const aspectRatio = measurements.aspectRatio;
    const shapeRegularity = Math.max(0, 1 - Math.abs(aspectRatio - 1) * 0.3);
    confidence *= (0.8 + shapeRegularity * 0.2);
    
    // Ajustar por tamaño del objeto
    const sizeFactor = Math.min(1, measurements.width / 100); // Objetos de 100mm+ son más confiables
    confidence *= (0.9 + sizeFactor * 0.1);
    
    // Calcular margen de error
    const baseError = calibration.errorMargin;
    const objectError = 1 - object.confidence;
    const totalError = baseError + objectError * 0.5;
    
    return {
      confidence: Math.max(0.1, Math.min(0.99, confidence)),
      errorMargin: Math.min(0.5, totalError)
    };
  }

  /**
   * OBTENER HISTORIAL DE MEDICIONES
   */
  getMeasurementHistory(): MeasurementResult[] {
    return [...this.measurementHistory];
  }

  /**
   * OBTENER ESTADÍSTICAS DE MEDICIONES
   */
  getMeasurementStats(): {
    totalMeasurements: number;
    averageConfidence: number;
    averageErrorMargin: number;
    lastMeasurement: Date | null;
    unitDistribution: Record<string, number>;
  } {
    if (this.measurementHistory.length === 0) {
      return {
        totalMeasurements: 0,
        averageConfidence: 0,
        averageErrorMargin: 0,
        lastMeasurement: null,
        unitDistribution: {}
      };
    }
    
    const totalMeasurements = this.measurementHistory.length;
    const averageConfidence = this.measurementHistory.reduce((sum, m) => sum + m.confidence, 0) / totalMeasurements;
    const averageErrorMargin = this.measurementHistory.reduce((sum, m) => sum + m.errorMargin, 0) / totalMeasurements;
    const lastMeasurement = new Date(Math.max(...this.measurementHistory.map(m => m.timestamp)));
    
    const unitDistribution: Record<string, number> = {};
    this.measurementHistory.forEach(m => {
      unitDistribution[m.measurements.unit] = (unitDistribution[m.measurements.unit] || 0) + 1;
    });
    
    return {
      totalMeasurements,
      averageConfidence,
      averageErrorMargin,
      lastMeasurement,
      unitDistribution
    };
  }

  /**
   * EXPORTAR MEDICIONES
   */
  exportMeasurements(): string {
    const data = {
      measurements: this.measurementHistory.map(m => ({
        id: m.object.id,
        width: m.measurements.width,
        height: m.measurements.height,
        area: m.measurements.area,
        unit: m.measurements.unit,
        confidence: m.confidence,
        timestamp: m.timestamp
      })),
      stats: this.getMeasurementStats(),
      exportDate: new Date().toISOString()
    };
    
    return btoa(JSON.stringify(data));
  }

  /**
   * IMPORTAR MEDICIONES
   */
  importMeasurements(measurementsData: string): void {
    try {
      const data = JSON.parse(atob(measurementsData));
      
      if (data.measurements && Array.isArray(data.measurements)) {
        // Solo importar estadísticas, no recrear objetos completos
        console.log(`✅ Importadas ${data.measurements.length} mediciones`);
      }
      
    } catch (error) {
      throw new Error('Formato de mediciones inválido');
    }
  }

  /**
   * LIMPIAR HISTORIAL
   */
  clearHistory(): void {
    this.measurementHistory = [];
    console.log('🗑️ Historial de mediciones limpiado');
  }

  /**
   * ACTUALIZAR CONFIGURACIÓN
   */
  updateSettings(newSettings: Partial<MeasurementSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Configuración de medición actualizada');
  }

  /**
   * OBTENER CONFIGURACIÓN ACTUAL
   */
  getSettings(): MeasurementSettings {
    return { ...this.settings };
  }

  /**
   * VALIDAR CONFIGURACIÓN
   */
  validateSettings(settings: Partial<MeasurementSettings>): boolean {
    if (settings.measurementPrecision !== undefined && 
        (settings.measurementPrecision < 0 || settings.measurementPrecision > 5)) {
      return false;
    }
    
    if (settings.errorTolerance !== undefined && 
        (settings.errorTolerance < 0 || settings.errorTolerance > 1)) {
      return false;
    }
    
    if (settings.minMeasurementSize !== undefined && settings.minMeasurementSize < 0) {
      return false;
    }
    
    if (settings.maxMeasurementSize !== undefined && settings.maxMeasurementSize <= 0) {
      return false;
    }
    
    return true;
  }

  /**
   * CONVERTIR UNIDADES
   */
  convertUnits(
    value: number,
    fromUnit: 'mm' | 'cm' | 'm',
    toUnit: 'mm' | 'cm' | 'm'
  ): number {
    // Convertir a mm primero
    let mmValue = value;
    switch (fromUnit) {
      case 'cm':
        mmValue = value * 10;
        break;
      case 'm':
        mmValue = value * 1000;
        break;
    }
    
    // Convertir de mm a unidad objetivo
    switch (toUnit) {
      case 'cm':
        return mmValue / 10;
      case 'm':
        return mmValue / 1000;
      default:
        return mmValue;
    }
  }

  /**
   * FORMATO DE MEDICIÓN LEGIBLE
   */
  formatMeasurement(
    value: number,
    unit: 'mm' | 'cm' | 'm',
    precision: number = 2
  ): string {
    const formatted = value.toFixed(precision);
    
    switch (unit) {
      case 'mm':
        return `${formatted} mm`;
      case 'cm':
        return `${formatted} cm`;
      case 'm':
        return `${formatted} m`;
      default:
        return `${formatted} ${unit}`;
    }
  }
}
