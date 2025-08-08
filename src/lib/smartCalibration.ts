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
  distanceToObject: number;
  cameraAngle: number;
  stabilityScore: number;
}

export interface CalibrationEntry {
  timestamp: number;
  method: 'manual' | 'auto' | 'reference-object';
  pixelsPerMm: number;
  accuracy: number;
  environmentalFactors: EnvironmentalFactors;
}

// Objetos de referencia comunes con sus dimensiones exactas
export const REFERENCE_OBJECTS = {
  'euro-1': { name: 'Moneda 1€', size: 23.25, category: 'coin', accuracy: 0.98 },
  'euro-2': { name: 'Moneda 2€', size: 25.75, category: 'coin', accuracy: 0.98 },
  'quarter-us': { name: 'Quarter US', size: 24.26, category: 'coin', accuracy: 0.98 },
  'credit-card': { name: 'Tarjeta de Crédito', size: 85.60, category: 'card', accuracy: 0.99 },
  'aa-battery': { name: 'Pila AA', size: 50.5, category: 'battery', accuracy: 0.97 },
  'ruler-10cm': { name: 'Regla 10cm', size: 100.0, category: 'tool', accuracy: 0.99 }
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
      const userAgent = navigator.userAgent;
      const screenDPI = this.calculateScreenDPI();
      
      // Dispositivo genérico por defecto
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
      
      return this.deviceProfile;
    } catch (error) {
      console.error('Error detecting device:', error);
      return this.deviceProfile!;
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
    
    return dpi || 96;
  }

  // Calibración automática basada en el dispositivo
  async autoCalibrate(): Promise<SmartCalibrationData> {
    const device = await this.detectDevice();
    
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

    this.addCalibrationEntry('auto', estimatedPixelsPerMm, device.estimatedAccuracy);
    
    return this.calibrationData;
  }

  // Calcular píxeles por mm basado en especificaciones del dispositivo
  private calculatePixelsPerMm(device: DeviceProfile): number {
    const baseFactor = device.screenDPI / 25.4;
    const cameraFactor = device.cameraSpecs.megapixels / 12;
    const sensorFactor = device.cameraSpecs.sensorWidth / 6.17;
    
    const estimatedPixelsPerMm = baseFactor * 
      (0.6 + cameraFactor * 0.2 + sensorFactor * 0.2);
    
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

    if (factors.lightingCondition) {
      const lightingCorrections = {
        'low': 0.95,
        'medium': 1.0,
        'high': 0.98,
        'mixed': 0.96
      };
      correctionFactor *= lightingCorrections[factors.lightingCondition];
    }

    if (factors.distanceToObject) {
      const optimalDistance = 25;
      const distanceRatio = Math.abs(factors.distanceToObject - optimalDistance) / optimalDistance;
      correctionFactor *= Math.max(0.9, 1 - distanceRatio * 0.1);
    }

    if (factors.cameraAngle) {
      const angleCorrection = Math.cos(factors.cameraAngle * Math.PI / 180);
      correctionFactor *= Math.max(0.85, angleCorrection);
    }

    if (factors.stabilityScore) {
      correctionFactor *= Math.max(0.9, factors.stabilityScore);
    }

    return basePixelsPerMm * correctionFactor;
  }

  // Obtener recomendaciones de calibración
  getCalibrationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (!this.calibrationData.isCalibrated) {
      recommendations.push('Realiza una calibración inicial para obtener mediciones precisas');
    }

    if (this.calibrationHistory.length === 0) {
      recommendations.push('Usa un objeto de referencia conocido para calibrar el sistema');
    }

    if (this.deviceProfile && this.deviceProfile.estimatedAccuracy < 0.8) {
      recommendations.push('Tu dispositivo puede tener precisión limitada. Considera usar múltiples referencias');
    }

    return recommendations;
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