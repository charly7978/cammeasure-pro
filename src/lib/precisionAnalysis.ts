export interface PrecisionMetrics {
  accuracy: number; // 0-1, qué tan cerca está del valor real
  precision: number; // 0-1, consistencia de las mediciones
  stability: number; // 0-1, estabilidad temporal
  confidence: number; // 0-1, confianza general del sistema
  errorEstimate: number; // Error estimado en mm
  qualityScore: number; // Score general de calidad (0-100)
}

export interface MeasurementQuality {
  lighting: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  stability: {
    score: number;
    shakiness: number;
    recommendations: string[];
  };
  focus: {
    score: number;
    sharpness: number;
    recommendations: string[];
  };
  distance: {
    score: number;
    optimalRange: boolean;
    recommendations: string[];
  };
  angle: {
    score: number;
    perpendicularity: number;
    recommendations: string[];
  };
}

export interface CalibrationAccuracy {
  pixelsPerMmAccuracy: number;
  deviceProfileMatch: number;
  environmentalConsistency: number;
  historicalVariance: number;
  overallAccuracy: number;
}

export class PrecisionAnalysisSystem {
  private measurementHistory: Array<{
    timestamp: number;
    value: number;
    confidence: number;
    environmentalFactors: any;
  }> = [];
  
  private qualityHistory: MeasurementQuality[] = [];
  private readonly HISTORY_SIZE = 20;

  // Analizar precisión de una medición individual
  analyzeMeasurementPrecision(
    measuredValue: number,
    referenceValue?: number,
    confidence: number = 0.8,
    environmentalFactors?: any
  ): PrecisionMetrics {
    // Calcular accuracy si tenemos valor de referencia
    let accuracy = 0.8; // Valor por defecto
    if (referenceValue && referenceValue > 0) {
      const error = Math.abs(measuredValue - referenceValue);
      const relativeError = error / referenceValue;
      accuracy = Math.max(0, 1 - relativeError * 2); // Penalizar errores relativos
    }

    // Calcular precision basada en historial
    const precision = this.calculatePrecisionFromHistory(measuredValue);

    // Calcular stability basada en variaciones temporales
    const stability = this.calculateStability();

    // Estimar error basado en múltiples factores
    const errorEstimate = this.estimateError(measuredValue, confidence, environmentalFactors);

    // Combinar métricas para confidence general
    const combinedConfidence = (accuracy * 0.3 + precision * 0.3 + stability * 0.2 + confidence * 0.2);

    // Calcular quality score (0-100)
    const qualityScore = Math.round(combinedConfidence * 100);

    // Agregar al historial
    this.addToHistory(measuredValue, combinedConfidence, environmentalFactors);

    return {
      accuracy,
      precision,
      stability,
      confidence: combinedConfidence,
      errorEstimate,
      qualityScore
    };
  }

  // Calcular precision basada en historial de mediciones
  private calculatePrecisionFromHistory(currentValue: number): number {
    if (this.measurementHistory.length < 3) {
      return 0.7; // Valor por defecto para pocas mediciones
    }

    // Obtener mediciones recientes similares
    const recentMeasurements = this.measurementHistory
      .slice(-10)
      .filter(m => Math.abs(m.value - currentValue) / currentValue < 0.2) // Dentro del 20%
      .map(m => m.value);

    if (recentMeasurements.length < 2) {
      return 0.6;
    }

    // Calcular desviación estándar relativa
    const mean = recentMeasurements.reduce((sum, val) => sum + val, 0) / recentMeasurements.length;
    const variance = recentMeasurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentMeasurements.length;
    const stdDev = Math.sqrt(variance);
    const relativeStdDev = mean > 0 ? stdDev / mean : 1;

    // Convertir a score de precision (menor desviación = mayor precision)
    return Math.max(0, 1 - relativeStdDev * 5);
  }

  // Calcular stability temporal
  private calculateStability(): number {
    if (this.measurementHistory.length < 5) {
      return 0.7;
    }

    const recent = this.measurementHistory.slice(-5);
    let stabilityScore = 0;

    // Analizar tendencias y variaciones
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      
      // Calcular cambio relativo
      const relativeChange = Math.abs(curr.value - prev.value) / Math.max(prev.value, curr.value);
      
      // Penalizar cambios grandes
      const changeScore = Math.max(0, 1 - relativeChange * 10);
      stabilityScore += changeScore;
    }

    return stabilityScore / (recent.length - 1);
  }

  // Estimar error de medición
  private estimateError(
    measuredValue: number,
    confidence: number,
    environmentalFactors?: any
  ): number {
    let baseError = measuredValue * 0.05; // 5% error base

    // Ajustar por confidence
    baseError *= (1.5 - confidence);

    // Ajustar por factores ambientales
    if (environmentalFactors) {
      if (environmentalFactors.lightingCondition === 'low') {
        baseError *= 1.3;
      }
      if (environmentalFactors.stabilityScore < 0.7) {
        baseError *= 1.2;
      }
      if (Math.abs(environmentalFactors.cameraAngle) > 15) {
        baseError *= 1.1;
      }
    }

    // Ajustar por tamaño del objeto (objetos pequeños tienen más error relativo)
    if (measuredValue < 10) {
      baseError *= 2.0;
    } else if (measuredValue < 50) {
      baseError *= 1.5;
    }

    return Math.max(0.1, baseError);
  }

  // Analizar calidad de la imagen/condiciones de medición
  analyzeImageQuality(imageData: ImageData, detectedObjects: any[]): MeasurementQuality {
    const lighting = this.analyzeLighting(imageData);
    const focus = this.analyzeFocus(imageData);
    const stability = this.analyzeStability();
    const distance = this.analyzeDistance(detectedObjects, imageData);
    const angle = this.analyzeAngle(detectedObjects);

    const quality: MeasurementQuality = {
      lighting,
      stability,
      focus,
      distance,
      angle
    };

    // Agregar al historial de calidad
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.HISTORY_SIZE) {
      this.qualityHistory.shift();
    }

    return quality;
  }

  // Analizar condiciones de iluminación
  private analyzeLighting(imageData: ImageData): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const { width, height, data } = imageData;
    let totalLuminance = 0;
    let minLuminance = 255;
    let maxLuminance = 0;
    const luminanceHistogram = new Array(256).fill(0);

    // Calcular estadísticas de luminancia
    for (let i = 0; i < data.length; i += 4) {
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      totalLuminance += luminance;
      minLuminance = Math.min(minLuminance, luminance);
      maxLuminance = Math.max(maxLuminance, luminance);
      luminanceHistogram[Math.floor(luminance)]++;
    }

    const avgLuminance = totalLuminance / (width * height);
    const contrast = maxLuminance - minLuminance;
    const dynamicRange = contrast / 255;

    // Detectar problemas de iluminación
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 1.0;

    // Imagen muy oscura
    if (avgLuminance < 50) {
      issues.push('Imagen muy oscura');
      recommendations.push('Aumenta la iluminación del entorno');
      score *= 0.6;
    }

    // Imagen muy clara (sobreexpuesta)
    if (avgLuminance > 200) {
      issues.push('Imagen sobreexpuesta');
      recommendations.push('Reduce la iluminación o ajusta la exposición');
      score *= 0.7;
    }

    // Bajo contraste
    if (dynamicRange < 0.3) {
      issues.push('Bajo contraste');
      recommendations.push('Mejora la iluminación para aumentar el contraste');
      score *= 0.8;
    }

    // Iluminación desigual (detectar usando histograma)
    const histogramPeaks = this.findHistogramPeaks(luminanceHistogram);
    if (histogramPeaks.length > 2) {
      issues.push('Iluminación desigual');
      recommendations.push('Usa iluminación más uniforme');
      score *= 0.9;
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  // Analizar enfoque/nitidez
  private analyzeFocus(imageData: ImageData): {
    score: number;
    sharpness: number;
    recommendations: string[];
  } {
    const { width, height, data } = imageData;
    let totalGradient = 0;
    let pixelCount = 0;

    // Calcular gradiente promedio usando operador Sobel
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Convertir a escala de grises
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        
        // Calcular gradientes Sobel
        const gx = this.getGrayValue(data, x + 1, y, width) - this.getGrayValue(data, x - 1, y, width);
        const gy = this.getGrayValue(data, x, y + 1, width) - this.getGrayValue(data, x, y - 1, width);
        
        const gradient = Math.sqrt(gx * gx + gy * gy);
        totalGradient += gradient;
        pixelCount++;
      }
    }

    const avgGradient = pixelCount > 0 ? totalGradient / pixelCount : 0;
    const sharpness = Math.min(avgGradient / 50, 1.0); // Normalizar

    const recommendations: string[] = [];
    let score = sharpness;

    if (sharpness < 0.3) {
      recommendations.push('La imagen está desenfocada. Toca la pantalla para enfocar');
      score *= 0.5;
    } else if (sharpness < 0.6) {
      recommendations.push('Mejora el enfoque para mediciones más precisas');
      score *= 0.8;
    }

    return { score, sharpness, recommendations };
  }

  // Analizar estabilidad (basado en historial)
  private analyzeStability(): {
    score: number;
    shakiness: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // Simular análisis de estabilidad basado en variaciones recientes
    const recentStability = this.measurementHistory.length > 0 ? 
      this.measurementHistory.slice(-5).reduce((sum, m) => sum + (m.confidence || 0.8), 0) / 5 : 0.8;
    
    const shakiness = 1 - recentStability;
    let score = recentStability;

    if (shakiness > 0.3) {
      recommendations.push('Mantén el dispositivo más estable');
      recommendations.push('Usa ambas manos o un soporte');
      score *= 0.7;
    }

    return { score, shakiness, recommendations };
  }

  // Analizar distancia óptima
  private analyzeDistance(detectedObjects: any[], imageData: ImageData): {
    score: number;
    optimalRange: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let score = 0.8;
    let optimalRange = true;

    if (detectedObjects.length === 0) {
      recommendations.push('No se detectaron objetos. Acércate más al objeto');
      return { score: 0.3, optimalRange: false, recommendations };
    }

    const largestObject = detectedObjects.reduce((largest, obj) => 
      obj.area > largest.area ? obj : largest
    );

    const imageArea = imageData.width * imageData.height;
    const objectRatio = largestObject.area / imageArea;

    // Objeto muy pequeño (muy lejos)
    if (objectRatio < 0.01) {
      recommendations.push('Acércate más al objeto para mejor precisión');
      score *= 0.6;
      optimalRange = false;
    }
    // Objeto muy grande (muy cerca)
    else if (objectRatio > 0.7) {
      recommendations.push('Aléjate un poco del objeto');
      score *= 0.7;
      optimalRange = false;
    }
    // Rango óptimo
    else if (objectRatio >= 0.05 && objectRatio <= 0.4) {
      score = 1.0;
    }

    return { score, optimalRange, recommendations };
  }

  // Analizar ángulo de la cámara
  private analyzeAngle(detectedObjects: any[]): {
    score: number;
    perpendicularity: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let score = 0.8;
    let perpendicularity = 0.8;

    if (detectedObjects.length === 0) {
      return { score: 0.5, perpendicularity: 0.5, recommendations };
    }

    const largestObject = detectedObjects[0];
    const aspectRatio = largestObject.width / largestObject.height;

    // Detectar distorsión por ángulo basada en relación de aspecto extrema
    if (aspectRatio > 3 || aspectRatio < 0.33) {
      recommendations.push('Mantén la cámara perpendicular al objeto');
      score *= 0.7;
      perpendicularity *= 0.6;
    }

    // Analizar posición del objeto (objetos en los bordes pueden indicar ángulo)
    const centerX = largestObject.x + largestObject.width / 2;
    const imageCenter = 320; // Asumir ancho típico
    const offsetRatio = Math.abs(centerX - imageCenter) / imageCenter;

    if (offsetRatio > 0.4) {
      recommendations.push('Centra el objeto en la imagen');
      score *= 0.9;
    }

    return { score, perpendicularity, recommendations };
  }

  // Analizar accuracy de calibración
  analyzeCalibrationAccuracy(
    calibrationData: any,
    deviceProfile?: any,
    calibrationHistory?: any[]
  ): CalibrationAccuracy {
    let pixelsPerMmAccuracy = 0.8; // Valor por defecto
    let deviceProfileMatch = 0.7;
    let environmentalConsistency = 0.8;
    let historicalVariance = 0.8;

    // Analizar precisión de píxeles por mm
    if (calibrationData.isCalibrated) {
      const pixelsPerMm = calibrationData.pixelsPerMm;
      
      // Verificar si está en rango razonable (4-20 px/mm)
      if (pixelsPerMm >= 4 && pixelsPerMm <= 20) {
        pixelsPerMmAccuracy = 0.9;
      } else if (pixelsPerMm >= 2 && pixelsPerMm <= 30) {
        pixelsPerMmAccuracy = 0.7;
      } else {
        pixelsPerMmAccuracy = 0.4;
      }
    }

    // Analizar coincidencia con perfil del dispositivo
    if (deviceProfile && calibrationData.deviceProfile) {
      const expectedPixelsPerMm = this.calculateExpectedPixelsPerMm(deviceProfile);
      const difference = Math.abs(calibrationData.pixelsPerMm - expectedPixelsPerMm);
      const relativeError = difference / expectedPixelsPerMm;
      
      deviceProfileMatch = Math.max(0.3, 1 - relativeError * 2);
    }

    // Analizar consistencia ambiental
    if (calibrationData.environmentalFactors) {
      const factors = calibrationData.environmentalFactors;
      environmentalConsistency = (
        (factors.stabilityScore || 0.8) * 0.4 +
        (factors.lightingCondition === 'medium' ? 1.0 : 0.7) * 0.3 +
        (Math.abs(factors.cameraAngle || 0) < 10 ? 1.0 : 0.8) * 0.3
      );
    }

    // Analizar varianza histórica
    if (calibrationHistory && calibrationHistory.length >= 3) {
      const pixelsPerMmValues = calibrationHistory.map(entry => entry.pixelsPerMm);
      const mean = pixelsPerMmValues.reduce((sum, val) => sum + val, 0) / pixelsPerMmValues.length;
      const variance = pixelsPerMmValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pixelsPerMmValues.length;
      const stdDev = Math.sqrt(variance);
      const relativeStdDev = mean > 0 ? stdDev / mean : 1;
      
      historicalVariance = Math.max(0.3, 1 - relativeStdDev * 5);
    }

    const overallAccuracy = (
      pixelsPerMmAccuracy * 0.4 +
      deviceProfileMatch * 0.2 +
      environmentalConsistency * 0.2 +
      historicalVariance * 0.2
    );

    return {
      pixelsPerMmAccuracy,
      deviceProfileMatch,
      environmentalConsistency,
      historicalVariance,
      overallAccuracy
    };
  }

  // Generar recomendaciones para mejorar precisión
  generatePrecisionRecommendations(
    precisionMetrics: PrecisionMetrics,
    qualityAnalysis: MeasurementQuality,
    calibrationAccuracy: CalibrationAccuracy
  ): string[] {
    const recommendations: string[] = [];

    // Recomendaciones basadas en precision metrics
    if (precisionMetrics.accuracy < 0.7) {
      recommendations.push('🎯 Calibra el sistema con un objeto de referencia conocido');
    }

    if (precisionMetrics.precision < 0.7) {
      recommendations.push('🔄 Realiza múltiples mediciones para mejorar la consistencia');
    }

    if (precisionMetrics.stability < 0.7) {
      recommendations.push('🤲 Mantén el dispositivo más estable durante las mediciones');
    }

    // Recomendaciones de calidad de imagen
    recommendations.push(...qualityAnalysis.lighting.recommendations);
    recommendations.push(...qualityAnalysis.focus.recommendations);
    recommendations.push(...qualityAnalysis.stability.recommendations);
    recommendations.push(...qualityAnalysis.distance.recommendations);
    recommendations.push(...qualityAnalysis.angle.recommendations);

    // Recomendaciones de calibración
    if (calibrationAccuracy.overallAccuracy < 0.7) {
      recommendations.push('⚙️ Recalibra el sistema para mejorar la precisión');
    }

    if (calibrationAccuracy.deviceProfileMatch < 0.6) {
      recommendations.push('📱 Verifica la configuración específica de tu dispositivo');
    }

    // Eliminar duplicados y limitar cantidad
    const uniqueRecommendations = [...new Set(recommendations)];
    return uniqueRecommendations.slice(0, 5); // Máximo 5 recomendaciones
  }

  // Métodos auxiliares
  private addToHistory(value: number, confidence: number, environmentalFactors?: any): void {
    this.measurementHistory.push({
      timestamp: Date.now(),
      value,
      confidence,
      environmentalFactors
    });

    if (this.measurementHistory.length > this.HISTORY_SIZE) {
      this.measurementHistory.shift();
    }
  }

  private findHistogramPeaks(histogram: number[]): number[] {
    const peaks: number[] = [];
    const threshold = Math.max(...histogram) * 0.1; // 10% del pico máximo

    for (let i = 1; i < histogram.length - 1; i++) {
      if (histogram[i] > threshold && 
          histogram[i] > histogram[i - 1] && 
          histogram[i] > histogram[i + 1]) {
        peaks.push(i);
      }
    }

    return peaks;
  }

  private getGrayValue(data: Uint8ClampedArray, x: number, y: number, width: number): number {
    const idx = (y * width + x) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  private calculateExpectedPixelsPerMm(deviceProfile: any): number {
    // Cálculo simplificado basado en DPI de pantalla
    return deviceProfile.screenDPI / 25.4; // Convertir DPI a píxeles por mm
  }

  // Obtener métricas de rendimiento del sistema
  getSystemPerformanceMetrics(): {
    averageAccuracy: number;
    averagePrecision: number;
    measurementCount: number;
    qualityTrend: 'improving' | 'stable' | 'declining';
    recommendedActions: string[];
  } {
    if (this.measurementHistory.length === 0) {
      return {
        averageAccuracy: 0,
        averagePrecision: 0,
        measurementCount: 0,
        qualityTrend: 'stable',
        recommendedActions: ['Realiza algunas mediciones para obtener métricas de rendimiento']
      };
    }

    const recentMeasurements = this.measurementHistory.slice(-10);
    const averageConfidence = recentMeasurements.reduce((sum, m) => sum + m.confidence, 0) / recentMeasurements.length;
    
    // Analizar tendencia
    let qualityTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentMeasurements.length >= 5) {
      const firstHalf = recentMeasurements.slice(0, Math.floor(recentMeasurements.length / 2));
      const secondHalf = recentMeasurements.slice(Math.floor(recentMeasurements.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, m) => sum + m.confidence, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.confidence, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 0.05) {
        qualityTrend = 'improving';
      } else if (secondAvg < firstAvg - 0.05) {
        qualityTrend = 'declining';
      }
    }

    const recommendedActions: string[] = [];
    if (averageConfidence < 0.7) {
      recommendedActions.push('Mejora las condiciones de medición');
    }
    if (qualityTrend === 'declining') {
      recommendedActions.push('Revisa la calibración del sistema');
    }

    return {
      averageAccuracy: averageConfidence,
      averagePrecision: this.calculatePrecisionFromHistory(0), // Usar 0 como referencia
      measurementCount: this.measurementHistory.length,
      qualityTrend,
      recommendedActions
    };
  }
}