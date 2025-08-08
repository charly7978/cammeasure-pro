export interface SmartCalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
  deviceProfile?: DeviceProfile;
  environmentalFactors?: EnvironmentalFactors;
  calibrationHistory?: CalibrationEntry[];
}

export interface DeviceProfile {
  model: string;
  platform: string;
  screenDPI: number;
  cameraSpecs: {
    focalLength: number;
    sensorWidth: number;
    sensorHeight: number;
    megapixels: number;
  };
  estimatedAccuracy: number;
}

export interface EnvironmentalFactors {
  lightingCondition: 'low' | 'medium' | 'high' | 'mixed';
  distanceToObject: number; // en cm
  cameraAngle: number; // en grados
  stabilityScore: number; // 0-1
}

export interface CalibrationEntry {
  timestamp: number;
  method: 'manual' | 'auto' | 'reference-object';
  pixelsPerMm: number;
  accuracy: number;
  environmentalFactors: EnvironmentalFactors;
}

// Base de datos de dispositivos conocidos
const DEVICE_DATABASE: Record<string, DeviceProfile> = {
  // iPhone
  'iPhone 15 Pro': {
    model: 'iPhone 15 Pro',
    platform: 'iOS',
    screenDPI: 460,
    cameraSpecs: {
      focalLength: 4.25,
      sensorWidth: 6.17,
      sensorHeight: 4.63,
      megapixels: 48
    },
    estimatedAccuracy: 0.95
  },
  'iPhone 14': {
    model: 'iPhone 14',
    platform: 'iOS',
    screenDPI: 460,
    cameraSpecs: {
      focalLength: 4.25,
      sensorWidth: 6.17,
      sensorHeight: 4.63,
      megapixels: 12
    },
    estimatedAccuracy: 0.90
  },
  // Samsung Galaxy
  'Samsung Galaxy S24': {
    model: 'Samsung Galaxy S24',
    platform: 'Android',
    screenDPI: 416,
    cameraSpecs: {
      focalLength: 4.3,
      sensorWidth: 5.76,
      sensorHeight: 4.32,
      megapixels: 50
    },
    estimatedAccuracy: 0.92
  },
  'Samsung Galaxy S23': {
    model: 'Samsung Galaxy S23',
    platform: 'Android',
    screenDPI: 393,
    cameraSpecs: {
      focalLength: 4.3,
      sensorWidth: 5.76,
      sensorHeight: 4.32,
      megapixels: 50
    },
    estimatedAccuracy: 0.90
  },
  // Google Pixel
  'Pixel 8 Pro': {
    model: 'Pixel 8 Pro',
    platform: 'Android',
    screenDPI: 489,
    cameraSpecs: {
      focalLength: 4.38,
      sensorWidth: 6.17,
      sensorHeight: 4.63,
      megapixels: 50
    },
    estimatedAccuracy: 0.93
  },
  // Dispositivos genéricos
  'Generic Android': {
    model: 'Generic Android',
    platform: 'Android',
    screenDPI: 320,
    cameraSpecs: {
      focalLength: 4.0,
      sensorWidth: 5.5,
      sensorHeight: 4.1,
      megapixels: 12
    },
    estimatedAccuracy: 0.75
  },
  'Generic iOS': {
    model: 'Generic iOS',
    platform: 'iOS',
    screenDPI: 326,
    cameraSpecs: {
      focalLength: 4.25,
      sensorWidth: 6.17,
      sensorHeight: 4.63,
      megapixels: 12
    },
    estimatedAccuracy: 0.80
  }
};

// Objetos de referencia comunes con sus dimensiones exactas
export const REFERENCE_OBJECTS = {
  // Monedas
  'euro-1': { name: 'Moneda 1€', size: 23.25, category: 'coin', accuracy: 0.98 },
  'euro-2': { name: 'Moneda 2€', size: 25.75, category: 'coin', accuracy: 0.98 },
  'quarter-us': { name: 'Quarter US', size: 24.26, category: 'coin', accuracy: 0.98 },
  'penny-us': { name: 'Penny US', size: 19.05, category: 'coin', accuracy: 0.98 },
  
  // Tarjetas
  'credit-card': { name: 'Tarjeta de Crédito', size: 85.60, category: 'card', accuracy: 0.99 },
  'business-card': { name: 'Tarjeta de Visita', size: 89.0, category: 'card', accuracy: 0.95 },
  
  // Objetos cotidianos
  'aa-battery': { name: 'Pila AA', size: 50.5, category: 'battery', accuracy: 0.97 },
  'usb-connector': { name: 'Conector USB-A', size: 12.0, category: 'tech', accuracy: 0.96 },
  'sim-card': { name: 'Tarjeta SIM', size: 15.0, category: 'tech', accuracy: 0.94 },
  
  // Papelería
  'a4-paper-width': { name: 'Papel A4 (ancho)', size: 210.0, category: 'paper', accuracy: 0.99 },
  'a4-paper-height': { name: 'Papel A4 (alto)', size: 297.0, category: 'paper', accuracy: 0.99 },
  'post-it': { name: 'Post-it estándar', size: 76.0, category: 'paper', accuracy: 0.92 },
  
  // Herramientas
  'ruler-10cm': { name: 'Regla 10cm', size: 100.0, category: 'tool', accuracy: 0.99 },
  'ruler-15cm': { name: 'Regla 15cm', size: 150.0, category: 'tool', accuracy: 0.99 }
};

export class SmartCalibrationSystem {
  private calibrationData: SmartCalibrationData;
  private deviceProfile: DeviceProfile | null = null;
  private calibrationHistory: CalibrationEntry[] = [];

  constructor(initialData?: Partial<SmartCalibrationData>) {
    this.calibrationData = {
      focalLength: 4.0,
      sensorSize: 6.17,
      pixelsPerMm: 8,
      referenceObjectSize: 25.4,
      isCalibrated: false,
      ...initialData
    };
    
    this.loadCalibrationHistory();
  }

  // Detección automática del dispositivo
  async detectDevice(): Promise<DeviceProfile> {
    try {
      // Intentar obtener información del dispositivo
      const userAgent = navigator.userAgent;
      const screenDPI = this.calculateScreenDPI();
      
      // Buscar en la base de datos
      for (const [key, profile] of Object.entries(DEVICE_DATABASE)) {
        if (userAgent.includes(key) || userAgent.includes(profile.model)) {
          this.deviceProfile = { ...profile, screenDPI };
          return this.deviceProfile;
        }
      }
      
      // Detectar por plataforma si no se encuentra modelo específico
      if (userAgent.includes('iPhone') || userAgent.includes('iOS')) {
        this.deviceProfile = { ...DEVICE_DATABASE['Generic iOS'], screenDPI };
      } else if (userAgent.includes('Android')) {
        this.deviceProfile = { ...DEVICE_DATABASE['Generic Android'], screenDPI };
      } else {
        // Dispositivo genérico
        this.deviceProfile = {
          model: 'Unknown Device',
          platform: 'Web',
          screenDPI,
          cameraSpecs: {
            focalLength: 4.0,
            sensorWidth: 5.5,
            sensorHeight: 4.1,
            megapixels: 8
          },
          estimatedAccuracy: 0.70
        };
      }
      
      return this.deviceProfile;
    } catch (error) {
      console.error('Error detecting device:', error);
      return DEVICE_DATABASE['Generic Android'];
    }
  }

  // Calcular DPI de la pantalla
  private calculateScreenDPI(): number {
    const testElement = document.createElement('div');
    testElement.style.width = '1in';
    testElement.style.height = '1in';
    testElement.style.position = 'absolute';
    testElement.style.left = '-100%';
    testElement.style.top = '-100%';
    
    document.body.appendChild(testElement);
    const dpi = testElement.offsetWidth;
    document.body.removeChild(testElement);
    
    return dpi || 96; // Fallback a 96 DPI
  }

  // Calibración automática basada en el dispositivo
  async autoCalibrate(): Promise<SmartCalibrationData> {
    const device = await this.detectDevice();
    
    // Calcular pixelsPerMm basado en las especificaciones del dispositivo
    const estimatedPixelsPerMm = this.calculatePixelsPerMm(device);
    
    this.calibrationData = {
      ...this.calibrationData,
      focalLength: device.cameraSpecs.focalLength,
      sensorSize: Math.sqrt(
        device.cameraSpecs.sensorWidth ** 2 + 
        device.cameraSpecs.sensorHeight ** 2
      ),
      pixelsPerMm: estimatedPixelsPerMm,
      isCalibrated: true,
      deviceProfile: device
    };

    // Guardar en el historial
    this.addCalibrationEntry('auto', estimatedPixelsPerMm, device.estimatedAccuracy);
    
    return this.calibrationData;
  }

  // Calcular píxeles por mm basado en especificaciones del dispositivo
  private calculatePixelsPerMm(device: DeviceProfile): number {
    // Fórmula mejorada que considera múltiples factores
    const baseFactor = device.screenDPI / 25.4; // Convertir DPI a píxeles por mm
    const cameraFactor = device.cameraSpecs.megapixels / 12; // Factor de resolución
    const sensorFactor = device.cameraSpecs.sensorWidth / 6.17; // Factor de tamaño del sensor
    
    // Combinar factores con pesos
    const estimatedPixelsPerMm = baseFactor * 
      (0.6 + cameraFactor * 0.2 + sensorFactor * 0.2);
    
    // Aplicar límites razonables
    return Math.max(4, Math.min(20, estimatedPixelsPerMm));
  }

  // Calibración con objeto de referencia
  calibrateWithReference(
    objectKey: string, 
    measuredPixels: number,
    environmentalFactors?: Partial<EnvironmentalFactors>
  ): SmartCalibrationData {
    const referenceObject = REFERENCE_OBJECTS[objectKey as keyof typeof REFERENCE_OBJECTS];
    if (!referenceObject) {
      throw new Error('Objeto de referencia no encontrado');
    }

    const pixelsPerMm = measuredPixels / referenceObject.size;
    
    // Aplicar correcciones basadas en factores ambientales
    const correctedPixelsPerMm = this.applyEnvironmentalCorrections(
      pixelsPerMm, 
      environmentalFactors
    );

    this.calibrationData = {
      ...this.calibrationData,
      pixelsPerMm: correctedPixelsPerMm,
      referenceObjectSize: referenceObject.size,
      isCalibrated: true,
      environmentalFactors: {
        lightingCondition: 'medium',
        distanceToObject: 30,
        cameraAngle: 0,
        stabilityScore: 0.8,
        ...environmentalFactors
      }
    };

    // Guardar en el historial
    this.addCalibrationEntry(
      'reference-object', 
      correctedPixelsPerMm, 
      referenceObject.accuracy
    );

    return this.calibrationData;
  }

  // Aplicar correcciones ambientales
  private applyEnvironmentalCorrections(
    basePixelsPerMm: number, 
    factors?: Partial<EnvironmentalFactors>
  ): number {
    if (!factors) return basePixelsPerMm;

    let correctionFactor = 1.0;

    // Corrección por iluminación
    if (factors.lightingCondition) {
      const lightingCorrections = {
        'low': 0.95,     // Baja luz puede afectar la detección
        'medium': 1.0,   // Condiciones ideales
        'high': 0.98,    // Mucha luz puede crear sombras
        'mixed': 0.96    // Luz mixta puede crear inconsistencias
      };
      correctionFactor *= lightingCorrections[factors.lightingCondition];
    }

    // Corrección por distancia
    if (factors.distanceToObject) {
      // Objetos muy cerca o muy lejos pueden tener distorsión
      const optimalDistance = 25; // cm
      const distanceRatio = Math.abs(factors.distanceToObject - optimalDistance) / optimalDistance;
      correctionFactor *= Math.max(0.9, 1 - distanceRatio * 0.1);
    }

    // Corrección por ángulo de la cámara
    if (factors.cameraAngle) {
      const angleCorrection = Math.cos(factors.cameraAngle * Math.PI / 180);
      correctionFactor *= Math.max(0.85, angleCorrection);
    }

    // Corrección por estabilidad
    if (factors.stabilityScore) {
      correctionFactor *= Math.max(0.9, factors.stabilityScore);
    }

    return basePixelsPerMm * correctionFactor;
  }

  // Calibración adaptativa basada en historial
  adaptiveCalibration(): SmartCalibrationData {
    if (this.calibrationHistory.length < 3) {
      return this.calibrationData;
    }

    // Analizar tendencias en el historial
    const recentEntries = this.calibrationHistory.slice(-5);
    const weights = recentEntries.map(entry => entry.accuracy);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    // Calcular promedio ponderado
    const weightedPixelsPerMm = recentEntries.reduce((sum, entry, index) => {
      return sum + (entry.pixelsPerMm * weights[index] / totalWeight);
    }, 0);

    // Detectar y corregir outliers
    const standardDeviation = this.calculateStandardDeviation(
      recentEntries.map(e => e.pixelsPerMm)
    );
    
    const isOutlier = Math.abs(this.calibrationData.pixelsPerMm - weightedPixelsPerMm) > 
                     standardDeviation * 2;

    if (isOutlier) {
      this.calibrationData.pixelsPerMm = weightedPixelsPerMm;
      console.log('Calibración adaptativa aplicada:', weightedPixelsPerMm);
    }

    return this.calibrationData;
  }

  // Calcular desviación estándar
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  // Agregar entrada al historial
  private addCalibrationEntry(
    method: 'manual' | 'auto' | 'reference-object',
    pixelsPerMm: number,
    accuracy: number
  ): void {
    const entry: CalibrationEntry = {
      timestamp: Date.now(),
      method,
      pixelsPerMm,
      accuracy,
      environmentalFactors: this.calibrationData.environmentalFactors || {
        lightingCondition: 'medium',
        distanceToObject: 30,
        cameraAngle: 0,
        stabilityScore: 0.8
      }
    };

    this.calibrationHistory.push(entry);
    
    // Mantener solo las últimas 20 entradas
    if (this.calibrationHistory.length > 20) {
      this.calibrationHistory = this.calibrationHistory.slice(-20);
    }

    this.saveCalibrationHistory();
  }

  // Cargar historial desde localStorage
  private loadCalibrationHistory(): void {
    try {
      const saved = localStorage.getItem('smart_calibration_history');
      if (saved) {
        this.calibrationHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading calibration history:', error);
      this.calibrationHistory = [];
    }
  }

  // Guardar historial en localStorage
  private saveCalibrationHistory(): void {
    try {
      localStorage.setItem(
        'smart_calibration_history', 
        JSON.stringify(this.calibrationHistory)
      );
    } catch (error) {
      console.error('Error saving calibration history:', error);
    }
  }

  // Obtener recomendaciones de calibración
  getCalibrationRecommendations(): string[] {
    const recommendations = [];

    if (!this.calibrationData.isCalibrated) {
      recommendations.push('Realiza una calibración inicial para obtener mediciones precisas');
    }

    if (this.calibrationHistory.length === 0) {
      recommendations.push('Usa un objeto de referencia conocido para calibrar el sistema');
    }

    if (this.deviceProfile && this.deviceProfile.estimatedAccuracy < 0.8) {
      recommendations.push('Tu dispositivo puede tener precisión limitada. Considera usar múltiples referencias');
    }

    const recentEntries = this.calibrationHistory.slice(-3);
    if (recentEntries.length >= 2) {
      const variance = this.calculateStandardDeviation(recentEntries.map(e => e.pixelsPerMm));
      if (variance > 1.0) {
        recommendations.push('Las calibraciones recientes varían mucho. Verifica las condiciones de medición');
      }
    }

    if (this.calibrationData.environmentalFactors) {
      const factors = this.calibrationData.environmentalFactors;
      if (factors.lightingCondition === 'low') {
        recommendations.push('Mejora la iluminación para obtener mediciones más precisas');
      }
      if (factors.stabilityScore < 0.7) {
        recommendations.push('Mantén el dispositivo más estable durante las mediciones');
      }
      if (Math.abs(factors.cameraAngle) > 15) {
        recommendations.push('Mantén la cámara perpendicular al objeto para mayor precisión');
      }
    }

    return recommendations;
  }

  // Obtener datos de calibración actuales
  getCalibrationData(): SmartCalibrationData {
    return { ...this.calibrationData };
  }

  // Obtener historial de calibración
  getCalibrationHistory(): CalibrationEntry[] {
    return [...this.calibrationHistory];
  }

  // Resetear calibración
  reset(): void {
    this.calibrationData = {
      focalLength: 4.0,
      sensorSize: 6.17,
      pixelsPerMm: 8,
      referenceObjectSize: 25.4,
      isCalibrated: false
    };
    this.calibrationHistory = [];
    this.saveCalibrationHistory();
  }
}