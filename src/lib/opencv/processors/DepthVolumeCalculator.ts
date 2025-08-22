/**
 * CALCULADOR AVANZADO DE PROFUNDIDAD Y VOLUMEN 3D
 * Sistema integrado para estimación de profundidad, distancia y volumen real
 */

import { DetectedObject } from '../../types';

export interface DepthMeasurement {
  distance: number; // Distancia en mm
  depth: number; // Profundidad del objeto en mm
  volume: number; // Volumen estimado en mm³
  confidence: number; // Confianza de la medición
  method: 'stereo' | 'monocular' | 'estimated';
}

export interface CameraParameters {
  focalLength: number; // Longitud focal en píxeles
  principalPoint: { x: number; y: number }; // Punto principal
  distortionCoefficients: number[]; // Coeficientes de distorsión
  sensorWidth: number; // Ancho del sensor en mm
  sensorHeight: number; // Alto del sensor en mm
}

export class DepthVolumeCalculator {
  private static instance: DepthVolumeCalculator;
  private cameraParams: CameraParameters | null = null;
  private referenceObjectSize: number = 25; // Tamaño de referencia en mm (por ejemplo, una moneda)

  private constructor() {}

  public static getInstance(): DepthVolumeCalculator {
    if (!DepthVolumeCalculator.instance) {
      DepthVolumeCalculator.instance = new DepthVolumeCalculator();
    }
    return DepthVolumeCalculator.instance;
  }

  /**
   * CALIBRAR CÁMARA CON PARÁMETROS CONOCIDOS
   */
  public calibrateCamera(params: CameraParameters): void {
    this.cameraParams = params;
    console.log('📷 Cámara calibrada con parámetros:', params);
  }

  /**
   * CALCULAR PROFUNDIDAD Y VOLUMEN PARA OBJETO DETECTADO
   */
  public calculateDepthAndVolume(
    object: DetectedObject,
    imageWidth: number,
    imageHeight: number,
    calibrationData?: { pixelsPerMm: number; isCalibrated: boolean }
  ): DepthMeasurement {
    try {
      console.log('🔍 CALCULANDO PROFUNDIDAD Y VOLUMEN 3D...');

      // Método 1: Si tenemos calibración real
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        return this.calculateWithRealCalibration(object, calibrationData);
      }

      // Método 2: Si tenemos parámetros de cámara
      if (this.cameraParams) {
        return this.calculateWithCameraParams(object, imageWidth, imageHeight);
      }

      // Método 3: Estimación basada en tamaño de objeto
      return this.calculateEstimatedDepth(object, imageWidth, imageHeight);

    } catch (error) {
      console.error('❌ Error calculando profundidad y volumen:', error);
      return {
        distance: 0,
        depth: 0,
        volume: 0,
        confidence: 0,
        method: 'estimated'
      };
    }
  }

  /**
   * CÁLCULO CON CALIBRACIÓN REAL
   */
  private calculateWithRealCalibration(
    object: DetectedObject,
    calibrationData: { pixelsPerMm: number }
  ): DepthMeasurement {
    try {
      const { pixelsPerMm } = calibrationData;
      
      // Convertir dimensiones de píxeles a mm
      const realWidth = object.width / pixelsPerMm;
      const realHeight = object.height / pixelsPerMm;
      const realArea = object.area / (pixelsPerMm * pixelsPerMm);
      
      // Estimación de profundidad basada en proporción áurea y geometría
      // Asumimos que objetos más grandes están más cerca
      const averageSize = (realWidth + realHeight) / 2;
      const estimatedDistance = this.estimateDistanceFromSize(averageSize);
      
      // Calcular profundidad del objeto (estimación basada en forma)
      const aspectRatio = realWidth / realHeight;
      let depthFactor = 0.3; // Factor por defecto
      
      if (aspectRatio > 1.5) {
        depthFactor = 0.2; // Objeto alargado, probablemente más plano
      } else if (aspectRatio < 0.7) {
        depthFactor = 0.4; // Objeto alto, más profundo
      } else {
        depthFactor = 0.35; // Objeto cuadrado, profundidad media
      }
      
      const estimatedDepth = Math.min(realWidth, realHeight) * depthFactor;
      
      // Calcular volumen estimado (aproximación como prisma rectangular)
      const estimatedVolume = realWidth * realHeight * estimatedDepth;
      
      console.log(`✅ Cálculo con calibración real: ${realWidth.toFixed(1)}x${realHeight.toFixed(1)}x${estimatedDepth.toFixed(1)}mm, volumen: ${estimatedVolume.toFixed(0)}mm³`);
      
      return {
        distance: estimatedDistance,
        depth: estimatedDepth,
        volume: estimatedVolume,
        confidence: 0.85,
        method: 'monocular'
      };

    } catch (error) {
      console.error('❌ Error en cálculo con calibración real:', error);
      return this.getFallbackMeasurement();
    }
  }

  /**
   * CÁLCULO CON PARÁMETROS DE CÁMARA
   */
  private calculateWithCameraParams(
    object: DetectedObject,
    imageWidth: number,
    imageHeight: number
  ): DepthMeasurement {
    try {
      const { focalLength, sensorWidth } = this.cameraParams!;
      
      // Conversión de píxeles a mm en el sensor
      const pixelSizeX = sensorWidth / imageWidth;
      const realObjectWidthOnSensor = object.width * pixelSizeX;
      
      // Estimación de distancia usando similar triangles
      // Asumimos un tamaño de objeto típico
      const assumedRealObjectSize = this.referenceObjectSize; // 25mm
      const estimatedDistance = (assumedRealObjectSize * focalLength) / realObjectWidthOnSensor;
      
      // Calcular dimensiones reales
      const scale = estimatedDistance / focalLength;
      const realWidth = object.width * pixelSizeX * scale;
      const realHeight = object.height * pixelSizeX * scale;
      
      // Estimar profundidad
      const estimatedDepth = Math.min(realWidth, realHeight) * 0.3;
      const estimatedVolume = realWidth * realHeight * estimatedDepth;
      
      console.log(`✅ Cálculo con parámetros de cámara: distancia ${estimatedDistance.toFixed(0)}mm, volumen: ${estimatedVolume.toFixed(0)}mm³`);
      
      return {
        distance: estimatedDistance,
        depth: estimatedDepth,
        volume: estimatedVolume,
        confidence: 0.75,
        method: 'monocular'
      };

    } catch (error) {
      console.error('❌ Error en cálculo con parámetros de cámara:', error);
      return this.getFallbackMeasurement();
    }
  }

  /**
   * CÁLCULO ESTIMADO BASADO EN HEURÍSTICAS
   */
  private calculateEstimatedDepth(
    object: DetectedObject,
    imageWidth: number,
    imageHeight: number
  ): DepthMeasurement {
    try {
      // Estimación heurística basada en el tamaño relativo del objeto
      const objectAreaPercentage = object.area / (imageWidth * imageHeight);
      
      // Objetos más grandes (más área) están más cerca
      let estimatedDistance: number;
      
      if (objectAreaPercentage > 0.3) {
        estimatedDistance = 100; // Muy cerca - 10cm
      } else if (objectAreaPercentage > 0.15) {
        estimatedDistance = 200; // Cerca - 20cm
      } else if (objectAreaPercentage > 0.05) {
        estimatedDistance = 400; // Medio - 40cm
      } else {
        estimatedDistance = 800; // Lejos - 80cm
      }
      
      // Estimación de dimensiones reales basada en distancia
      // Asumimos un campo de visión de aproximadamente 60 grados
      const fovFactor = Math.tan(Math.PI / 6); // tan(30°)
      const realImageWidth = 2 * estimatedDistance * fovFactor;
      const pixelsPerMm = imageWidth / realImageWidth;
      
      const realWidth = object.width / pixelsPerMm;
      const realHeight = object.height / pixelsPerMm;
      
      // Estimar profundidad y volumen
      const estimatedDepth = Math.min(realWidth, realHeight) * 0.25;
      const estimatedVolume = realWidth * realHeight * estimatedDepth;
      
      console.log(`✅ Cálculo estimado: ${realWidth.toFixed(1)}x${realHeight.toFixed(1)}x${estimatedDepth.toFixed(1)}mm a ${estimatedDistance}mm`);
      
      return {
        distance: estimatedDistance,
        depth: estimatedDepth,
        volume: estimatedVolume,
        confidence: 0.6,
        method: 'estimated'
      };

    } catch (error) {
      console.error('❌ Error en cálculo estimado:', error);
      return this.getFallbackMeasurement();
    }
  }

  /**
   * ESTIMAR DISTANCIA BASADA EN TAMAÑO
   */
  private estimateDistanceFromSize(averageSize: number): number {
    // Heurística: objetos comunes y sus distancias típicas
    if (averageSize < 10) return 600; // Objeto muy pequeño, probablemente lejos
    if (averageSize < 25) return 400; // Objeto pequeño, distancia media
    if (averageSize < 50) return 250; // Objeto mediano, cerca
    if (averageSize < 100) return 150; // Objeto grande, muy cerca
    return 100; // Objeto muy grande, extremadamente cerca
  }

  /**
   * MEDICIÓN DE FALLBACK
   */
  private getFallbackMeasurement(): DepthMeasurement {
    return {
      distance: 300,
      depth: 20,
      volume: 1000,
      confidence: 0.3,
      method: 'estimated'
    };
  }

  /**
   * FORMATEAR MEDICIÓN PARA DISPLAY
   */
  public formatMeasurement(measurement: DepthMeasurement): {
    distance: string;
    volume: string;
    depth: string;
    confidence: string;
  } {
    const { distance, volume, depth, confidence } = measurement;
    
    return {
      distance: distance > 1000 
        ? `${(distance / 1000).toFixed(1)} m`
        : `${Math.round(distance)} mm`,
      volume: volume > 1000000 
        ? `${(volume / 1000000).toFixed(1)} cm³`
        : `${Math.round(volume)} mm³`,
      depth: `${depth.toFixed(1)} mm`,
      confidence: `${Math.round(confidence * 100)}%`
    };
  }
}

// Instancia singleton
export const depthVolumeCalculator = DepthVolumeCalculator.getInstance();