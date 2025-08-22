/**
 * SISTEMA OPENCV UNIFICADO ULTRA MEJORADO - ENFOQUE OBJETO CENTRAL
 * Sistema optimizado para detectar UN SOLO objeto central con máxima precisión y rendimiento
 */

import { SilhouetteDetector, type SilhouetteDetectionResult, type CalibrationData } from './opencv/processors/SilhouetteDetector';
import { preciseObjectDetector } from './preciseObjectDetection';
import type { DetectedObject } from './types';

interface UnifiedDetectionResult {
  objects: DetectedObject[];
  processingTime: number;
  method: 'opencv_central' | 'ai_central' | 'hybrid_central' | 'fallback_central';
  confidence: number;
  debugInfo: {
    openCVTime: number;
    aiTime: number;
    combinationTime: number;
    totalObjects: number;
    bestObjectConfidence: number;
  };
}

class UnifiedOpenCVSystem {
  private static instance: UnifiedOpenCVSystem;
  private silhouetteDetector: SilhouetteDetector;
  private isInitialized = false;
  private performanceStats = {
    averageProcessingTime: 0,
    successfulDetections: 0,
    totalDetections: 0,
    bestMethod: 'opencv_central' as const
  };

  private constructor() {
    this.silhouetteDetector = SilhouetteDetector.getInstance();
  }

  public static getInstance(): UnifiedOpenCVSystem {
    if (!UnifiedOpenCVSystem.instance) {
      UnifiedOpenCVSystem.instance = new UnifiedOpenCVSystem();
    }
    return UnifiedOpenCVSystem.instance;
  }

  /**
   * INICIALIZACIÓN DEL SISTEMA UNIFICADO
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🚀 INICIALIZANDO SISTEMA UNIFICADO CENTRAL...');
      
      // Inicializar detector de IA en paralelo
      await preciseObjectDetector.initialize();
      
      this.isInitialized = true;
      console.log('✅ SISTEMA UNIFICADO CENTRAL LISTO');
    } catch (error) {
      console.error('❌ Error inicializando sistema unificado:', error);
      this.isInitialized = false;
    }
  }

  /**
   * DETECTAR OBJETO CENTRAL CON SISTEMA HÍBRIDO OPTIMIZADO
   * Combina OpenCV y AI para máxima precisión en objeto central
   */
  async detectObjectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<UnifiedDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    console.log('🎯 INICIANDO DETECCIÓN CENTRAL HÍBRIDA...');

    try {
      // ESTRATEGIA ADAPTATIVA BASADA EN RENDIMIENTO
      const detectionStrategy = this.selectOptimalStrategy();
      
      let result: UnifiedDetectionResult;
      
      switch (detectionStrategy) {
        case 'opencv_primary':
          result = await this.detectWithOpenCVPrimary(imageData, calibrationData);
          break;
        case 'ai_primary':
          result = await this.detectWithAIPrimary(imageData, calibrationData);
          break;
        case 'hybrid_parallel':
        default:
          result = await this.detectWithHybridParallel(imageData, calibrationData);
          break;
      }

      // Actualizar estadísticas de rendimiento
      this.updatePerformanceStats(result);
      
      const totalTime = performance.now() - startTime;
      result.processingTime = totalTime;
      
      console.log(`🏆 DETECCIÓN CENTRAL COMPLETADA: ${result.objects.length} objeto(s) en ${totalTime.toFixed(1)}ms`);
      console.log(`📊 Método: ${result.method}, Confianza: ${(result.confidence * 100).toFixed(1)}%`);
      
      return result;

    } catch (error) {
      console.error('❌ Error en detección central:', error);
      return this.createFallbackResult(performance.now() - startTime);
    }
  }

  /**
   * SELECCIONAR ESTRATEGIA ÓPTIMA BASADA EN RENDIMIENTO
   */
  private selectOptimalStrategy(): 'opencv_primary' | 'ai_primary' | 'hybrid_parallel' {
    // Estrategia adaptativa basada en estadísticas
    if (this.performanceStats.totalDetections < 10) {
      return 'hybrid_parallel'; // Recopilar datos iniciales
    }
    
    const successRate = this.performanceStats.successfulDetections / this.performanceStats.totalDetections;
    
    if (successRate > 0.8 && this.performanceStats.averageProcessingTime < 2000) {
      // Rendimiento bueno, usar método más rápido
      return this.performanceStats.bestMethod === 'opencv_central' ? 'opencv_primary' : 'ai_primary';
    }
    
    // Rendimiento variable, usar híbrido
    return 'hybrid_parallel';
  }

  /**
   * DETECCIÓN CON OPENCV COMO MÉTODO PRIMARIO
   */
  private async detectWithOpenCVPrimary(
    imageData: ImageData,
    calibrationData: CalibrationData | null
  ): Promise<UnifiedDetectionResult> {
    const startTime = performance.now();
    
    try {
      console.log('🔍 Ejecutando OpenCV Central como primario...');
      const openCVResult = await this.silhouetteDetector.detectSilhouettes(imageData, calibrationData);
      const openCVTime = performance.now() - startTime;
      
      if (openCVResult.objects.length > 0 && openCVResult.objects[0].confidence > 0.6) {
        // OpenCV exitoso, retornar resultado
        return {
          objects: openCVResult.objects.slice(0, 1), // Solo el mejor objeto
          processingTime: openCVTime,
          method: 'opencv_central',
          confidence: openCVResult.objects[0].confidence,
          debugInfo: {
            openCVTime,
            aiTime: 0,
            combinationTime: 0,
            totalObjects: openCVResult.objects.length,
            bestObjectConfidence: openCVResult.objects[0].confidence
          }
        };
      }
      
      // OpenCV no exitoso, fallback a AI
      console.log('⚠️ OpenCV no exitoso, ejecutando AI como backup...');
      const aiStartTime = performance.now();
      const canvas = this.imageDataToCanvas(imageData);
      const aiResult = await preciseObjectDetector.detectCentralObject(canvas);
      const aiTime = performance.now() - aiStartTime;
      
      if (aiResult) {
        return {
          objects: [aiResult],
          processingTime: openCVTime + aiTime,
          method: 'ai_central',
          confidence: aiResult.confidence,
          debugInfo: {
            openCVTime,
            aiTime,
            combinationTime: 0,
            totalObjects: 1,
            bestObjectConfidence: aiResult.confidence
          }
        };
      }
      
    } catch (error) {
      console.error('❌ Error en OpenCV primario:', error);
    }
    
    return this.createFallbackResult(performance.now() - startTime);
  }

  /**
   * DETECCIÓN CON AI COMO MÉTODO PRIMARIO
   */
  private async detectWithAIPrimary(
    imageData: ImageData,
    calibrationData: CalibrationData | null
  ): Promise<UnifiedDetectionResult> {
    const startTime = performance.now();
    
    try {
      console.log('🤖 Ejecutando AI Central como primario...');
      const canvas = this.imageDataToCanvas(imageData);
      const aiResult = await preciseObjectDetector.detectCentralObject(canvas);
      const aiTime = performance.now() - startTime;
      
      if (aiResult && aiResult.confidence > 0.5) {
        // Aplicar calibración si está disponible
        const calibratedResult = this.applyCalibratedMeasurements(aiResult, calibrationData);
        
        return {
          objects: [calibratedResult],
          processingTime: aiTime,
          method: 'ai_central',
          confidence: calibratedResult.confidence,
          debugInfo: {
            openCVTime: 0,
            aiTime,
            combinationTime: 0,
            totalObjects: 1,
            bestObjectConfidence: calibratedResult.confidence
          }
        };
      }
      
      // AI no exitoso, fallback a OpenCV
      console.log('⚠️ AI no exitoso, ejecutando OpenCV como backup...');
      const openCVStartTime = performance.now();
      const openCVResult = await this.silhouetteDetector.detectSilhouettes(imageData, calibrationData);
      const openCVTime = performance.now() - openCVStartTime;
      
      if (openCVResult.objects.length > 0) {
        return {
          objects: openCVResult.objects.slice(0, 1),
          processingTime: aiTime + openCVTime,
          method: 'opencv_central',
          confidence: openCVResult.objects[0].confidence,
          debugInfo: {
            openCVTime,
            aiTime,
            combinationTime: 0,
            totalObjects: openCVResult.objects.length,
            bestObjectConfidence: openCVResult.objects[0].confidence
          }
        };
      }
      
    } catch (error) {
      console.error('❌ Error en AI primario:', error);
    }
    
    return this.createFallbackResult(performance.now() - startTime);
  }

  /**
   * DETECCIÓN HÍBRIDA EN PARALELO PARA MÁXIMA PRECISIÓN
   */
  private async detectWithHybridParallel(
    imageData: ImageData,
    calibrationData: CalibrationData | null
  ): Promise<UnifiedDetectionResult> {
    const startTime = performance.now();
    
    try {
      console.log('⚡ Ejecutando detección híbrida paralela...');
      
      // Ejecutar ambos métodos en paralelo
      const canvas = this.imageDataToCanvas(imageData);
      
      const [openCVResult, aiResult] = await Promise.all([
        this.silhouetteDetector.detectSilhouettes(imageData, calibrationData),
        preciseObjectDetector.detectCentralObject(canvas)
      ]);
      
      const parallelTime = performance.now() - startTime;
      
      // Combinar y seleccionar el mejor resultado
      const combinationStartTime = performance.now();
      const bestResult = this.selectBestCentralResult(openCVResult, aiResult, calibrationData);
      const combinationTime = performance.now() - combinationStartTime;
      
      return {
        objects: bestResult.objects,
        processingTime: parallelTime + combinationTime,
        method: bestResult.method,
        confidence: bestResult.confidence,
        debugInfo: {
          openCVTime: parallelTime / 2, // Aproximado ya que fue paralelo
          aiTime: parallelTime / 2,
          combinationTime,
          totalObjects: bestResult.objects.length,
          bestObjectConfidence: bestResult.objects[0]?.confidence || 0
        }
      };
      
    } catch (error) {
      console.error('❌ Error en detección híbrida:', error);
      return this.createFallbackResult(performance.now() - startTime);
    }
  }

  /**
   * SELECCIONAR EL MEJOR RESULTADO CENTRAL
   */
  private selectBestCentralResult(
    openCVResult: SilhouetteDetectionResult,
    aiResult: DetectedObject | null,
    calibrationData: CalibrationData | null
  ): { objects: DetectedObject[]; method: 'opencv_central' | 'ai_central' | 'hybrid_central'; confidence: number } {
    
    const openCVBest = openCVResult.objects[0];
    const aiBest = aiResult ? this.applyCalibratedMeasurements(aiResult, calibrationData) : null;
    
    // Evaluar calidad de cada resultado
    const openCVScore = openCVBest ? this.calculateResultQuality(openCVBest, 'opencv') : 0;
    const aiScore = aiBest ? this.calculateResultQuality(aiBest, 'ai') : 0;
    
    console.log(`📊 Scores - OpenCV: ${openCVScore.toFixed(3)}, AI: ${aiScore.toFixed(3)}`);
    
    // Selección inteligente del mejor resultado
    if (openCVScore > aiScore * 1.1 && openCVBest) {
      // OpenCV significativamente mejor
      console.log('🎯 Seleccionado: OpenCV Central');
      return {
        objects: [openCVBest],
        method: 'opencv_central',
        confidence: openCVBest.confidence
      };
    } else if (aiScore > openCVScore * 1.1 && aiBest) {
      // AI significativamente mejor
      console.log('🤖 Seleccionado: AI Central');
      return {
        objects: [aiBest],
        method: 'ai_central',
        confidence: aiBest.confidence
      };
    } else if (openCVBest && aiBest) {
      // Resultados similares, crear híbrido mejorado
      console.log('⚡ Creando resultado híbrido optimizado');
      const hybridResult = this.createHybridCentralResult(openCVBest, aiBest);
      return {
        objects: [hybridResult],
        method: 'hybrid_central',
        confidence: hybridResult.confidence
      };
    } else if (openCVBest) {
      return {
        objects: [openCVBest],
        method: 'opencv_central',
        confidence: openCVBest.confidence
      };
    } else if (aiBest) {
      return {
        objects: [aiBest],
        method: 'ai_central',
        confidence: aiBest.confidence
      };
    }
    
    // No hay resultados válidos
    return {
      objects: [],
      method: 'opencv_central',
      confidence: 0
    };
  }

  /**
   * CALCULAR CALIDAD DE RESULTADO
   */
  private calculateResultQuality(obj: DetectedObject, method: 'opencv' | 'ai'): number {
    // Factores de calidad
    const confidenceScore = obj.confidence;
    const sizeScore = Math.min(1, obj.area / 10000); // Normalizar área
    const shapeScore = obj.circularity ? Math.min(1, obj.circularity) : 0.5;
    const centerScore = this.calculateCenterProximity(obj);
    
    // Pesos específicos por método
    const weights = method === 'opencv' 
      ? { confidence: 0.3, size: 0.2, shape: 0.3, center: 0.2 }
      : { confidence: 0.4, size: 0.2, shape: 0.2, center: 0.2 };
    
    return (
      confidenceScore * weights.confidence +
      sizeScore * weights.size +
      shapeScore * weights.shape +
      centerScore * weights.center
    );
  }

  /**
   * CALCULAR PROXIMIDAD AL CENTRO
   */
  private calculateCenterProximity(obj: DetectedObject): number {
    if (!obj.centerX || !obj.centerY) return 0.5;
    
    // Asumiendo imagen de 640x480 como referencia
    const centerX = 320;
    const centerY = 240;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    const distance = Math.sqrt(
      (obj.centerX - centerX) ** 2 + (obj.centerY - centerY) ** 2
    );
    
    return Math.max(0, 1 - (distance / maxDistance));
  }

  /**
   * CREAR RESULTADO HÍBRIDO CENTRAL OPTIMIZADO
   */
  private createHybridCentralResult(openCVObj: DetectedObject, aiObj: DetectedObject): DetectedObject {
    // Combinar lo mejor de ambos métodos
    const hybridConfidence = (openCVObj.confidence + aiObj.confidence) / 2 + 0.1; // Boost híbrido
    
    // Usar dimensiones más precisas (generalmente OpenCV para contornos, AI para detección general)
    const bestContours = openCVObj.contours && openCVObj.contours.length > 0 ? openCVObj.contours : aiObj.contours;
    const bestDimensions = openCVObj.dimensions.unit === 'mm' ? openCVObj.dimensions : aiObj.dimensions;
    
    return {
      ...openCVObj,
      id: `hybrid_central_${Date.now()}`,
      type: 'hybrid_central',
      confidence: Math.min(0.98, hybridConfidence),
      contours: bestContours,
      dimensions: bestDimensions,
      // Combinar propiedades geométricas
      geometricProperties: {
        ...openCVObj.geometricProperties,
        // Usar valores promedio para mayor estabilidad
        circularity: (openCVObj.circularity + (aiObj.circularity || 0.7)) / 2,
        solidity: (openCVObj.solidity + (aiObj.solidity || 0.8)) / 2
      }
    };
  }

  /**
   * APLICAR MEDICIONES CALIBRADAS
   */
  private applyCalibratedMeasurements(obj: DetectedObject, calibrationData: CalibrationData | null): DetectedObject {
    if (!calibrationData?.isCalibrated || calibrationData.pixelsPerMm <= 0) {
      return obj;
    }
    
    const mmPerPixel = 1 / calibrationData.pixelsPerMm;
    
    return {
      ...obj,
      dimensions: {
        width: obj.width * mmPerPixel,
        height: obj.height * mmPerPixel,
        area: obj.area * mmPerPixel * mmPerPixel,
        unit: 'mm',
        perimeter: obj.perimeter ? obj.perimeter * mmPerPixel : undefined
      }
    };
  }

  /**
   * CREAR RESULTADO FALLBACK
   */
  private createFallbackResult(processingTime: number): UnifiedDetectionResult {
    console.log('⚠️ Creando resultado fallback central...');
    
    return {
      objects: [],
      processingTime,
      method: 'fallback_central',
      confidence: 0,
      debugInfo: {
        openCVTime: 0,
        aiTime: 0,
        combinationTime: 0,
        totalObjects: 0,
        bestObjectConfidence: 0
      }
    };
  }

  /**
   * ACTUALIZAR ESTADÍSTICAS DE RENDIMIENTO
   */
  private updatePerformanceStats(result: UnifiedDetectionResult): void {
    this.performanceStats.totalDetections++;
    
    if (result.objects.length > 0 && result.confidence > 0.5) {
      this.performanceStats.successfulDetections++;
    }
    
    // Actualizar tiempo promedio
    this.performanceStats.averageProcessingTime = (
      (this.performanceStats.averageProcessingTime * (this.performanceStats.totalDetections - 1)) +
      result.processingTime
    ) / this.performanceStats.totalDetections;
    
    // Actualizar mejor método
    if (result.confidence > 0.7) {
      this.performanceStats.bestMethod = result.method.includes('opencv') ? 'opencv_central' : 'ai_central';
    }
  }

  /**
   * CONVERTIR IMAGEDATA A CANVAS
   */
  private imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
  }

  /**
   * DIBUJAR OVERLAY DE DETECCIÓN MEJORADO
   */
  drawDetectionOverlay(
    canvas: HTMLCanvasElement,
    result: UnifiedDetectionResult,
    showDebugInfo: boolean = true
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || result.objects.length === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const obj = result.objects[0]; // Solo el objeto central
    
    // Color específico por método
    const methodColors = {
      'opencv_central': '#00ff41',    // Verde brillante
      'ai_central': '#ff6b35',        // Naranja brillante  
      'hybrid_central': '#4ecdc4',    // Cian brillante
      'fallback_central': '#ffd700'   // Dorado
    };
    
    const color = methodColors[result.method];
    
    // Configurar estilo ULTRA DESTACADO
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '25'; // Relleno más visible
    ctx.lineWidth = 4; // Línea muy gruesa
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Dibujar contorno con MÁXIMO DETALLE
    if (obj.contours && obj.contours.length > 0) {
      ctx.beginPath();
      ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
      
      for (let i = 1; i < obj.contours.length; i++) {
        ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
      }
      
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      
      // EFECTO GLOW ULTRA POTENTE
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Etiqueta ULTRA INFORMATIVA
    const labelX = obj.boundingBox.x;
    const labelY = Math.max(35, obj.boundingBox.y - 25);
    
    // Fondo para texto ULTRA VISIBLE
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    const methodIcons = {
      'opencv_central': '🔍',
      'ai_central': '🤖',
      'hybrid_central': '⚡',
      'fallback_central': '🛡️'
    };
    
    const text = `${methodIcons[result.method]} ${obj.dimensions.width.toFixed(1)} × ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`;
    ctx.font = 'bold 16px system-ui';
    const metrics = ctx.measureText(text);
    ctx.fillRect(labelX - 10, labelY - 22, metrics.width + 20, 30);
    
    // Texto principal ULTRA DESTACADO
    ctx.fillStyle = color;
    ctx.fillText(text, labelX, labelY);
    
    // Información adicional ULTRA COMPLETA
    const detailText = `${(obj.confidence * 100).toFixed(0)}% • ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}² • CENTRAL`;
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.font = 'bold 12px system-ui';
    ctx.fillText(detailText, labelX, labelY + 20);
    
    // Punto central ULTRA VISIBLE
    if (obj.centerX !== undefined && obj.centerY !== undefined) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(obj.centerX, obj.centerY, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // Cruz central ULTRA DESTACADA
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(obj.centerX - 15, obj.centerY);
      ctx.lineTo(obj.centerX + 15, obj.centerY);
      ctx.moveTo(obj.centerX, obj.centerY - 15);
      ctx.lineTo(obj.centerX, obj.centerY + 15);
      ctx.stroke();
    }

    // Información de debug ULTRA DETALLADA si se solicita
    if (showDebugInfo) {
      const debug = result.debugInfo;
      const debugText = [
        `🎯 DETECCIÓN CENTRAL HÍBRIDA`,
        `Método: ${result.method.toUpperCase()}`,
        `Tiempo total: ${result.processingTime.toFixed(1)}ms`,
        `OpenCV: ${debug.openCVTime.toFixed(1)}ms`,
        `AI: ${debug.aiTime.toFixed(1)}ms`,
        `Combinación: ${debug.combinationTime.toFixed(1)}ms`,
        `Confianza: ${(result.confidence * 100).toFixed(1)}%`,
        `Objetos totales: ${debug.totalObjects}`
      ];
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.fillRect(10, 10, 280, debugText.length * 24 + 20);
      
      ctx.fillStyle = color;
      ctx.font = 'bold 13px monospace';
      debugText.forEach((text, i) => {
        ctx.fillText(text, 15, 35 + i * 24);
      });
    }
  }

  /**
   * OBTENER ESTADÍSTICAS DE RENDIMIENTO
   */
  getPerformanceStats() {
    return { ...this.performanceStats };
  }
}

export const unifiedOpenCV = UnifiedOpenCVSystem.getInstance();













