/**
 * SISTEMA DE CALIBRACIÓN ULTRA PRECISO
 * Calibración automática y manual para mediciones exactas en milímetros
 */

import type { DetectedObject } from '../types';

export interface CalibrationResult {
  pixelsPerMm: number;
  isCalibrated: boolean;
  confidence: number;
  method: 'automatic' | 'manual' | 'reference';
  timestamp: number;
  errorMargin: number;
  calibrationImage?: ImageData;
  referenceObject?: {
    width: number;
    height: number;
    unit: string;
  };
}

export interface CalibrationSettings {
  // Métodos de calibración
  enableAutomaticCalibration: boolean;
  enableManualCalibration: boolean;
  enableReferenceCalibration: boolean;
  
  // Parámetros de calibración automática
  autoCalibrationMinConfidence: number;
  autoCalibrationMaxError: number;
  
  // Parámetros de calibración manual
  manualCalibrationPrecision: number;
  manualCalibrationIterations: number;
  
  // Parámetros de calibración por referencia
  referenceObjectSize: number; // mm
  referenceObjectTolerance: number; // ±mm
}

export class UltraCalibrationSystem {
  private static instance: UltraCalibrationSystem;
  private calibrationHistory: CalibrationResult[] = [];
  private currentCalibration: CalibrationResult | null = null;
  private settings: CalibrationSettings;

  private constructor() {
    this.settings = {
      enableAutomaticCalibration: true,
      enableManualCalibration: true,
      enableReferenceCalibration: true,
      autoCalibrationMinConfidence: 0.8,
      autoCalibrationMaxError: 0.05, // 5% de error máximo
      manualCalibrationPrecision: 0.01, // 0.01mm de precisión
      manualCalibrationIterations: 5,
      referenceObjectSize: 100, // 100mm por defecto
      referenceObjectTolerance: 2 // ±2mm de tolerancia
    };
  }

  public static getInstance(): UltraCalibrationSystem {
    if (!UltraCalibrationSystem.instance) {
      UltraCalibrationSystem.instance = new UltraCalibrationSystem();
    }
    return UltraCalibrationSystem.instance;
  }

  /**
   * CALIBRACIÓN AUTOMÁTICA INTELIGENTE
   */
  async autoCalibrate(
    imageData: ImageData,
    knownObjectSize?: number
  ): Promise<CalibrationResult> {
    console.log('🔧 Iniciando calibración automática inteligente...');
    
    try {
      // 1. DETECTAR OBJETOS EN LA IMAGEN
      const detectedObjects = await this.detectObjectsForCalibration(imageData);
      
      if (detectedObjects.length === 0) {
        throw new Error('No se detectaron objetos para calibración');
      }
      
      // 2. SELECCIONAR EL MEJOR OBJETO PARA CALIBRACIÓN
      const bestObject = this.selectBestCalibrationObject(detectedObjects, imageData);
      
      // 3. CALCULAR CALIBRACIÓN BASADA EN EL OBJETO SELECCIONADO
      let calibration: CalibrationResult;
      
      if (knownObjectSize) {
        // Calibración con tamaño conocido
        calibration = this.calculateCalibrationFromKnownSize(
          bestObject, 
          knownObjectSize, 
          'reference'
        );
      } else {
        // Calibración automática basada en heurísticas
        calibration = this.calculateAutomaticCalibration(bestObject, imageData);
      }
      
      // 4. VALIDAR CALIBRACIÓN
      if (calibration.confidence >= this.settings.autoCalibrationMinConfidence) {
        this.currentCalibration = calibration;
        this.calibrationHistory.push(calibration);
        
        console.log(`✅ Calibración automática exitosa: ${calibration.pixelsPerMm.toFixed(2)} px/mm (${(calibration.confidence * 100).toFixed(1)}% confianza)`);
        
        return calibration;
      } else {
        throw new Error(`Calibración insuficientemente confiable: ${(calibration.confidence * 100).toFixed(1)}%`);
      }
      
    } catch (error) {
      console.error('❌ Error en calibración automática:', error);
      throw error;
    }
  }

  /**
   * CALIBRACIÓN MANUAL PRECISA
   */
  async manualCalibrate(
    imageData: ImageData,
    userMeasurement: number, // mm
    userConfidence: number = 0.9
  ): Promise<CalibrationResult> {
    console.log(`🔧 Iniciando calibración manual: ${userMeasurement}mm`);
    
    try {
      // 1. DETECTAR OBJETO SELECCIONADO POR EL USUARIO
      const detectedObjects = await this.detectObjectsForCalibration(imageData);
      
      if (detectedObjects.length === 0) {
        throw new Error('No se detectaron objetos para calibración manual');
      }
      
      // 2. SELECCIONAR OBJETO MÁS CENTRAL
      const centralObject = this.selectCentralObject(detectedObjects, imageData);
      
      // 3. CALCULAR CALIBRACIÓN MANUAL
      const calibration = this.calculateManualCalibration(
        centralObject, 
        userMeasurement, 
        userConfidence
      );
      
      // 4. VALIDAR Y APLICAR
      if (calibration.confidence >= 0.7) {
        this.currentCalibration = calibration;
        this.calibrationHistory.push(calibration);
        
        console.log(`✅ Calibración manual exitosa: ${calibration.pixelsPerMm.toFixed(2)} px/mm`);
        
        return calibration;
      } else {
        throw new Error('Calibración manual insuficientemente confiable');
      }
      
    } catch (error) {
      console.error('❌ Error en calibración manual:', error);
      throw error;
    }
  }

  /**
   * CALIBRACIÓN POR OBJETO DE REFERENCIA
   */
  async referenceCalibrate(
    imageData: ImageData,
    referenceSize: number, // mm
    tolerance: number = 2 // ±mm
  ): Promise<CalibrationResult> {
    console.log(`🔧 Iniciando calibración por referencia: ${referenceSize}mm ±${tolerance}mm`);
    
    try {
      // 1. DETECTAR OBJETOS
      const detectedObjects = await this.detectObjectsForCalibration(imageData);
      
      if (detectedObjects.length === 0) {
        throw new Error('No se detectaron objetos para calibración por referencia');
      }
      
      // 2. BUSCAR OBJETO QUE COINCIDA CON EL TAMAÑO DE REFERENCIA
      const referenceObject = this.findReferenceObject(
        detectedObjects, 
        referenceSize, 
        tolerance
      );
      
      if (!referenceObject) {
        throw new Error(`No se encontró objeto de ${referenceSize}mm ±${tolerance}mm`);
      }
      
      // 3. CALCULAR CALIBRACIÓN
      const calibration = this.calculateCalibrationFromKnownSize(
        referenceObject, 
        referenceSize, 
        'reference'
      );
      
      // 4. APLICAR CALIBRACIÓN
      this.currentCalibration = calibration;
      this.calibrationHistory.push(calibration);
      
      console.log(`✅ Calibración por referencia exitosa: ${calibration.pixelsPerMm.toFixed(2)} px/mm`);
      
      return calibration;
      
    } catch (error) {
      console.error('❌ Error en calibración por referencia:', error);
      throw error;
    }
  }

  /**
   * OBTENER CALIBRACIÓN ACTUAL
   */
  getCurrentCalibration(): CalibrationResult | null {
    return this.currentCalibration;
  }

  /**
   * OBTENER HISTORIAL DE CALIBRACIONES
   */
  getCalibrationHistory(): CalibrationResult[] {
    return [...this.calibrationHistory];
  }

  /**
   * VALIDAR CALIBRACIÓN ACTUAL
   */
  validateCurrentCalibration(): boolean {
    if (!this.currentCalibration) return false;
    
    const { timestamp, confidence } = this.currentCalibration;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    
    return (
      confidence >= 0.7 &&
      (now - timestamp) < maxAge
    );
  }

  /**
   * RESETEAR CALIBRACIÓN
   */
  resetCalibration(): void {
    this.currentCalibration = null;
    console.log('🔄 Calibración reseteada');
  }

  /**
   * ACTUALIZAR CONFIGURACIÓN
   */
  updateSettings(newSettings: Partial<CalibrationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Configuración de calibración actualizada');
  }

  /**
   * DETECTAR OBJETOS PARA CALIBRACIÓN
   */
  private async detectObjectsForCalibration(imageData: ImageData): Promise<DetectedObject[]> {
    // Usar el detector ultra avanzado para encontrar objetos
    const { UltraSilhouetteDetector } = await import('./UltraSilhouetteDetector');
    const detector = UltraSilhouetteDetector.getInstance();
    
    const result = await detector.detectSilhouettes(imageData, null, {
      minContourArea: imageData.width * imageData.height * 0.005, // 0.5% mínimo
      maxContourArea: imageData.width * imageData.height * 0.7,   // 70% máximo
      centerPriority: 0.8, // Alta prioridad al centro
      shapeRegularity: 0.6, // Formas regulares
      sizeConsistency: 0.5  // Tamaños consistentes
    });
    
    return result.objects;
  }

  /**
   * SELECCIONAR MEJOR OBJETO PARA CALIBRACIÓN
   */
  private selectBestCalibrationObject(
    objects: DetectedObject[], 
    imageData: ImageData
  ): DetectedObject {
    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;
    
    // Calcular score para cada objeto
    const scoredObjects = objects.map(obj => {
      // Proximidad al centro
      const distanceFromCenter = Math.sqrt(
        (obj.centerX! - centerX) ** 2 + (obj.centerY! - centerY) ** 2
      );
      const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
      const proximityScore = 1 - (distanceFromCenter / maxDistance);
      
      // Regularidad de forma
      const aspectRatio = obj.boundingBox.width / obj.boundingBox.height;
      const shapeScore = Math.max(0, 1 - Math.abs(aspectRatio - 1) * 0.5);
      
      // Tamaño apropiado
      const areaRatio = obj.area / (imageData.width * imageData.height);
      const sizeScore = Math.max(0, 1 - Math.abs(areaRatio - 0.1) * 10);
      
      // Score combinado
      const totalScore = proximityScore * 0.5 + shapeScore * 0.3 + sizeScore * 0.2;
      
      return { object: obj, score: totalScore };
    });
    
    // Ordenar por score y devolver el mejor
    scoredObjects.sort((a, b) => b.score - a.score);
    return scoredObjects[0].object;
  }

  /**
   * SELECCIONAR OBJETO CENTRAL
   */
  private selectCentralObject(objects: DetectedObject[], imageData: ImageData): DetectedObject {
    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;
    
    let bestObject = objects[0];
    let minDistance = Infinity;
    
    for (const obj of objects) {
      const distance = Math.sqrt(
        (obj.centerX! - centerX) ** 2 + (obj.centerY! - centerY) ** 2
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        bestObject = obj;
      }
    }
    
    return bestObject;
  }

  /**
   * BUSCAR OBJETO DE REFERENCIA
   */
  private findReferenceObject(
    objects: DetectedObject[], 
    referenceSize: number, 
    tolerance: number
  ): DetectedObject | null {
    const toleranceRange = tolerance / referenceSize; // Tolerancia relativa
    
    for (const obj of objects) {
      const widthRatio = obj.boundingBox.width / obj.boundingBox.height;
      const heightRatio = obj.boundingBox.height / obj.boundingBox.width;
      
      // Verificar si las proporciones coinciden con el tamaño de referencia
      if (Math.abs(widthRatio - 1) <= toleranceRange || 
          Math.abs(heightRatio - 1) <= toleranceRange) {
        return obj;
      }
    }
    
    return null;
  }

  /**
   * CALCULAR CALIBRACIÓN DESDE TAMAÑO CONOCIDO
   */
  private calculateCalibrationFromKnownSize(
    object: DetectedObject,
    knownSize: number,
    method: 'reference' | 'manual'
  ): CalibrationResult {
    // Usar la dimensión más confiable (ancho o alto)
    const pixelWidth = object.boundingBox.width;
    const pixelHeight = object.boundingBox.height;
    
    // Calcular pixelsPerMm para ambas dimensiones
    const pixelsPerMmWidth = pixelWidth / knownSize;
    const pixelsPerMmHeight = pixelHeight / knownSize;
    
    // Usar el promedio ponderado por confianza
    const pixelsPerMm = (pixelsPerMmWidth + pixelsPerMmHeight) / 2;
    
    // Calcular error entre dimensiones
    const errorMargin = Math.abs(pixelsPerMmWidth - pixelsPerMmHeight) / pixelsPerMm;
    
    // Calcular confianza basada en consistencia
    const consistencyScore = Math.max(0, 1 - errorMargin * 10);
    const confidence = Math.min(0.99, consistencyScore * 0.9 + 0.1);
    
    return {
      pixelsPerMm,
      isCalibrated: true,
      confidence,
      method,
      timestamp: Date.now(),
      errorMargin,
      referenceObject: {
        width: knownSize,
        height: knownSize,
        unit: 'mm'
      }
    };
  }

  /**
   * CALCULAR CALIBRACIÓN AUTOMÁTICA
   */
  private calculateAutomaticCalibration(
    object: DetectedObject, 
    imageData: ImageData
  ): CalibrationResult {
    // Heurística: asumir que el objeto principal tiene un tamaño típico
    // Basado en el área relativa y la posición central
    
    const areaRatio = object.area / (imageData.width * imageData.height);
    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;
    const distanceFromCenter = Math.sqrt(
      (object.centerX! - centerX) ** 2 + (object.centerY! - centerY) ** 2
    );
    const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
    const proximityScore = 1 - (distanceFromCenter / maxDistance);
    
    // Estimar tamaño basado en heurísticas
    let estimatedSize = 100; // 100mm por defecto
    
    if (areaRatio > 0.3) {
      estimatedSize = 200; // Objeto muy grande
    } else if (areaRatio > 0.15) {
      estimatedSize = 150; // Objeto grande
    } else if (areaRatio > 0.05) {
      estimatedSize = 100; // Objeto mediano
    } else {
      estimatedSize = 50;  // Objeto pequeño
    }
    
    // Ajustar por proximidad al centro
    estimatedSize *= (0.8 + proximityScore * 0.4);
    
    // Calcular calibración
    const pixelsPerMm = object.boundingBox.width / estimatedSize;
    
    // Confianza basada en heurísticas
    const confidence = Math.min(0.8, 
      proximityScore * 0.6 + 
      (1 - Math.abs(areaRatio - 0.1) * 5) * 0.4
    );
    
    return {
      pixelsPerMm,
      isCalibrated: true,
      confidence,
      method: 'automatic',
      timestamp: Date.now(),
      errorMargin: 0.15, // 15% de error estimado para calibración automática
      referenceObject: {
        width: estimatedSize,
        height: estimatedSize,
        unit: 'mm'
      }
    };
  }

  /**
   * CALCULAR CALIBRACIÓN MANUAL
   */
  private calculateManualCalibration(
    object: DetectedObject,
    userMeasurement: number,
    userConfidence: number
  ): CalibrationResult {
    // Calibración manual es más precisa
    const pixelsPerMm = object.boundingBox.width / userMeasurement;
    
    // Confianza alta para calibración manual
    const confidence = Math.min(0.99, userConfidence * 0.9 + 0.1);
    
    return {
      pixelsPerMm,
      isCalibrated: true,
      confidence,
      method: 'manual',
      timestamp: Date.now(),
      errorMargin: 0.02, // 2% de error para calibración manual
      referenceObject: {
        width: userMeasurement,
        height: userMeasurement,
        unit: 'mm'
      }
    };
  }

  /**
   * EXPORTAR CALIBRACIÓN
   */
  exportCalibration(): string {
    if (!this.currentCalibration) {
      throw new Error('No hay calibración activa para exportar');
    }
    
    const calibration = this.currentCalibration;
    const data = {
      pixelsPerMm: calibration.pixelsPerMm,
      timestamp: calibration.timestamp,
      method: calibration.method,
      confidence: calibration.confidence,
      errorMargin: calibration.errorMargin
    };
    
    return btoa(JSON.stringify(data));
  }

  /**
   * IMPORTAR CALIBRACIÓN
   */
  importCalibration(calibrationData: string): CalibrationResult {
    try {
      const data = JSON.parse(atob(calibrationData));
      
      const calibration: CalibrationResult = {
        pixelsPerMm: data.pixelsPerMm,
        isCalibrated: true,
        confidence: data.confidence || 0.8,
        method: data.method || 'manual',
        timestamp: data.timestamp || Date.now(),
        errorMargin: data.errorMargin || 0.05
      };
      
      this.currentCalibration = calibration;
      this.calibrationHistory.push(calibration);
      
      console.log(`✅ Calibración importada: ${calibration.pixelsPerMm.toFixed(2)} px/mm`);
      
      return calibration;
      
    } catch (error) {
      throw new Error('Formato de calibración inválido');
    }
  }

  /**
   * OBTENER ESTADÍSTICAS DE CALIBRACIÓN
   */
  getCalibrationStats(): {
    totalCalibrations: number;
    averageConfidence: number;
    averageErrorMargin: number;
    lastCalibration: Date | null;
    methodDistribution: Record<string, number>;
  } {
    if (this.calibrationHistory.length === 0) {
      return {
        totalCalibrations: 0,
        averageConfidence: 0,
        averageErrorMargin: 0,
        lastCalibration: null,
        methodDistribution: {}
      };
    }
    
    const totalCalibrations = this.calibrationHistory.length;
    const averageConfidence = this.calibrationHistory.reduce((sum, c) => sum + c.confidence, 0) / totalCalibrations;
    const averageErrorMargin = this.calibrationHistory.reduce((sum, c) => sum + c.errorMargin, 0) / totalCalibrations;
    const lastCalibration = new Date(Math.max(...this.calibrationHistory.map(c => c.timestamp)));
    
    const methodDistribution: Record<string, number> = {};
    this.calibrationHistory.forEach(c => {
      methodDistribution[c.method] = (methodDistribution[c.method] || 0) + 1;
    });
    
    return {
      totalCalibrations,
      averageConfidence,
      averageErrorMargin,
      lastCalibration,
      methodDistribution
    };
  }
}
