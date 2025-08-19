import { CalibrationData } from './types';

interface RealCalibrationPoint {
  pixelDistance: number;
  realWorldDistance: number; // en mm
  confidence: number;
  timestamp: number;
}

class RealCalibrationSystem {
  private calibrationHistory: RealCalibrationPoint[] = [];
  private currentCalibration: CalibrationData | null = null;

  // Objetos de referencia con medidas reales precisas
  private readonly REFERENCE_OBJECTS = {
    'coin_1euro': { size: 23.25, name: 'Moneda 1 Euro', description: 'Diámetro exacto' },
    'coin_2euro': { size: 25.75, name: 'Moneda 2 Euros', description: 'Diámetro exacto' },
    'coin_quarter': { size: 24.26, name: 'Moneda 25¢ US', description: 'Diámetro exacto' },
    'card_credit': { size: 85.60, name: 'Tarjeta de Crédito', description: 'Ancho ISO/IEC 7810' },
    'card_height': { size: 53.98, name: 'Tarjeta de Crédito', description: 'Alto ISO/IEC 7810' },
    'phone_iphone13': { size: 146.7, name: 'iPhone 13', description: 'Alto exacto' },
    'phone_iphone12': { size: 146.7, name: 'iPhone 12', description: 'Alto exacto' },
    'paper_a4_width': { size: 210.0, name: 'Papel A4', description: 'Ancho exacto' },
    'paper_a4_height': { size: 297.0, name: 'Papel A4', description: 'Alto exacto' },
    'ruler_1cm': { size: 10.0, name: 'Regla', description: '1 centímetro' },
    'ruler_5cm': { size: 50.0, name: 'Regla', description: '5 centímetros' },
    'ruler_10cm': { size: 100.0, name: 'Regla', description: '10 centímetros' }
  };

  getReferenceObjects() {
    return this.REFERENCE_OBJECTS;
  }

  addCalibrationPoint(pixelDistance: number, objectType: keyof typeof this.REFERENCE_OBJECTS): boolean {
    const referenceObject = this.REFERENCE_OBJECTS[objectType];
    if (!referenceObject || pixelDistance <= 0) {
      return false;
    }

    const calibrationPoint: RealCalibrationPoint = {
      pixelDistance,
      realWorldDistance: referenceObject.size,
      confidence: this.calculateConfidence(pixelDistance, referenceObject.size),
      timestamp: Date.now()
    };

    this.calibrationHistory.push(calibrationPoint);
    
    // Mantener solo los últimos 10 puntos para evitar acumulación
    if (this.calibrationHistory.length > 10) {
      this.calibrationHistory = this.calibrationHistory.slice(-10);
    }

    return true;
  }

  private calculateConfidence(pixelDistance: number, realSize: number): number {
    // La confianza se basa en la coherencia con calibraciones anteriores
    if (this.calibrationHistory.length === 0) return 0.8;

    const currentRatio = pixelDistance / realSize;
    const previousRatios = this.calibrationHistory.map(point => 
      point.pixelDistance / point.realWorldDistance
    );

    const avgRatio = previousRatios.reduce((sum, ratio) => sum + ratio, 0) / previousRatios.length;
    const deviation = Math.abs(currentRatio - avgRatio) / avgRatio;

    // Confianza inversamente proporcional a la desviación
    return Math.max(0.3, 1.0 - deviation * 2);
  }

  generateCalibration(): CalibrationData | null {
    if (this.calibrationHistory.length === 0) {
      return null;
    }

    // Usar puntos más recientes y confiables
    const recentPoints = this.calibrationHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    const weightedPoints = recentPoints
      .filter(point => point.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence);

    if (weightedPoints.length === 0) {
      return null;
    }

    // Calcular factor de conversión ponderado
    let totalWeight = 0;
    let weightedSum = 0;

    for (const point of weightedPoints) {
      const weight = point.confidence;
      const pixelsPerMm = point.pixelDistance / point.realWorldDistance;
      
      weightedSum += pixelsPerMm * weight;
      totalWeight += weight;
    }

    const finalPixelsPerMm = weightedSum / totalWeight;
    
    // Estimar propiedades de cámara basadas en el factor de conversión
    const estimatedFocalLength = this.estimateFocalLength(finalPixelsPerMm);
    const estimatedSensorSize = this.estimateSensorSize(finalPixelsPerMm);

    this.currentCalibration = {
      focalLength: estimatedFocalLength,
      sensorSize: estimatedSensorSize,
      pixelsPerMm: finalPixelsPerMm,
      referenceObjectSize: weightedPoints[0].realWorldDistance,
      isCalibrated: true,
      calibrationMethod: 'reference',
      lastCalibrationDate: new Date().toISOString(),
      cameraMatrix: this.generateCameraMatrix(finalPixelsPerMm),
      distortionCoefficients: [0, 0, 0, 0, 0], // Simplificado
      imageSize: { width: 1280, height: 720 }, // Estándar HD
      realWorldScale: 1.0 / finalPixelsPerMm // mm por píxel
    };

    return this.currentCalibration;
  }

  private estimateFocalLength(pixelsPerMm: number): number {
    // Estimación basada en cámaras típicas de móviles
    // Factor típico: 4-6mm para cámaras principales
    return Math.max(3.5, Math.min(6.5, 28 / pixelsPerMm));
  }

  private estimateSensorSize(pixelsPerMm: number): number {
    // Tamaño típico de sensor en móviles: 5-8mm
    return Math.max(5.0, Math.min(8.5, 1280 / pixelsPerMm));
  }

  private generateCameraMatrix(pixelsPerMm: number): number[][] {
    // Generar matriz de cámara basada en el factor de conversión
    const fx = pixelsPerMm * 25; // Factor focal estimado
    const fy = fx; // Asumir píxeles cuadrados
    const cx = 640; // Centro X típico para 1280px
    const cy = 360; // Centro Y típico para 720px

    return [
      [fx, 0, cx],
      [0, fy, cy],
      [0, 0, 1]
    ];
  }

  getCurrentCalibration(): CalibrationData | null {
    return this.currentCalibration;
  }

  getCalibrationQuality(): { quality: 'excellent' | 'good' | 'fair' | 'poor'; details: string } {
    if (!this.currentCalibration || this.calibrationHistory.length === 0) {
      return { quality: 'poor', details: 'Sin calibración disponible' };
    }

    const avgConfidence = this.calibrationHistory
      .reduce((sum, point) => sum + point.confidence, 0) / this.calibrationHistory.length;

    const pointCount = this.calibrationHistory.length;

    if (avgConfidence > 0.9 && pointCount >= 3) {
      return { quality: 'excellent', details: `${pointCount} mediciones con ${(avgConfidence * 100).toFixed(1)}% confianza` };
    } else if (avgConfidence > 0.7 && pointCount >= 2) {
      return { quality: 'good', details: `${pointCount} mediciones con ${(avgConfidence * 100).toFixed(1)}% confianza` };
    } else if (avgConfidence > 0.5 && pointCount >= 1) {
      return { quality: 'fair', details: `${pointCount} mediciones con ${(avgConfidence * 100).toFixed(1)}% confianza` };
    } else {
      return { quality: 'poor', details: 'Calibración insuficiente o poco confiable' };
    }
  }

  reset(): void {
    this.calibrationHistory = [];
    this.currentCalibration = null;
  }
}

export const realCalibrationSystem = new RealCalibrationSystem();