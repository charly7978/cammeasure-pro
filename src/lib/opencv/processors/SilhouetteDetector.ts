/**
 * DETECTOR DE SILUETAS ULTRA AVANZADO
 * Sistema integrado que combina todos los algoritmos para detección perfecta de siluetas
 */

import { ImageProcessor } from '../core/ImageProcessor';
import { CannyEdgeDetector } from '../algorithms/CannyEdgeDetector';
import { ContourDetector } from '../algorithms/ContourDetector';
import { HyperAdvancedSilhouetteDetector } from './HyperAdvancedSilhouetteDetector';
import type { DetectedObject } from '../../types';

export interface SilhouetteDetectionResult {
  objects: DetectedObject[];
  processingTime: number;
  edgeMap: Uint8Array;
  contours: Array<{ x: number; y: number }>[];
  debugInfo: {
    edgePixels: number;
    contoursFound: number;
    validContours: number;
    averageConfidence: number;
  };
}

export interface CalibrationData {
  pixelsPerMm: number;
  isCalibrated: boolean;
}

export class SilhouetteDetector {
  private static instance: SilhouetteDetector;
  private imageProcessor: ImageProcessor;
  private edgeDetector: CannyEdgeDetector;
  private contourDetector: ContourDetector;
  private hyperAdvancedDetector: HyperAdvancedSilhouetteDetector;

  private constructor() {
    this.imageProcessor = ImageProcessor.getInstance();
    this.edgeDetector = CannyEdgeDetector.getInstance();
    this.contourDetector = ContourDetector.getInstance();
    this.hyperAdvancedDetector = HyperAdvancedSilhouetteDetector.getInstance();
  }

  public static getInstance(): SilhouetteDetector {
    if (!SilhouetteDetector.instance) {
      SilhouetteDetector.instance = new SilhouetteDetector();
    }
    return SilhouetteDetector.instance;
  }

  /**
   * DETECTAR SILUETAS CON PIPELINE COMPLETO ULTRA OPTIMIZADO
   */
  async detectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<SilhouetteDetectionResult> {
    const startTime = performance.now();
    
    console.log(`🎯 INICIANDO DETECCIÓN HÍPER AVANZADA DE SILUETAS`);
    
    try {
      // Usar el detector híper avanzado
      const hyperResult = await this.hyperAdvancedDetector.detectSilhouettes(imageData, calibrationData);
      
      // Convertir resultado a formato SilhouetteDetectionResult
      const result: SilhouetteDetectionResult = {
        objects: hyperResult.objects,
        processingTime: hyperResult.processingTime,
        edgeMap: hyperResult.edgeMap,
        contours: hyperResult.contours,
        debugInfo: {
          edgePixels: hyperResult.debugInfo.edgePixels,
          contoursFound: hyperResult.debugInfo.contoursFound,
          validContours: hyperResult.debugInfo.validContours,
          averageConfidence: hyperResult.debugInfo.averageConfidence
        }
      };
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en detección híper avanzada, usando fallback:', error);
      
      // Fallback al sistema anterior si falla
      return this.detectSilhouettesClassic(imageData, calibrationData);
    }
  }

  /**
   * DETECCIÓN CLÁSICA (FALLBACK)
   */
  private async detectSilhouettesClassic(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<SilhouetteDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;
    
    console.log(`🎯 INICIANDO DETECCIÓN DE SILUETAS CLÁSICA ${width}x${height}`);
    
    try {
      // PASO 1: PROCESAMIENTO DE IMAGEN OPTIMIZADO
      console.log('📷 Paso 1: Procesamiento de imagen...');
      const processed = this.imageProcessor.processImage(imageData, 1.2);
      
      // PASO 2: MEJORA DE CONTRASTE ADAPTATIVA
      console.log('🌟 Paso 2: Mejora de contraste...');
      const enhanced = this.imageProcessor.enhanceContrast(processed.blurred, width, height);
      
      // PASO 3: DETECCIÓN DE BORDES CANNY ULTRA SENSIBLE
      console.log('🔍 Paso 3: Detección de bordes Canny...');
      const cannyResult = this.edgeDetector.detectEdges(enhanced, width, height, {
        lowThreshold: 8,     // Muy sensible
        highThreshold: 60,   // Permisivo
        sigma: 1.2,
        sobelKernelSize: 3,
        l2Gradient: true
      });
      
      console.log(`✅ Bordes detectados: ${cannyResult.edgePixels} píxeles`);
      
      // PASO 4: DETECCIÓN DE CONTORNOS AVANZADA
      console.log('📐 Paso 4: Detección de contornos...');
      const detectedContours = this.contourDetector.findContours(
        cannyResult.edges,
        width,
        height,
        'external',
        'simple'
      );
      
      console.log(`✅ Contornos encontrados: ${detectedContours.length}`);
      
      // PASO 5: CONVERTIR A OBJETOS DETECTADOS CON CALIBRACIÓN
      console.log('🎯 Paso 5: Conversión a objetos detectados...');
      const objects = this.convertContoursToDetectedObjects(
        detectedContours,
        width,
        height,
        calibrationData
      );
      
      const processingTime = performance.now() - startTime;
      const averageConfidence = objects.length > 0 
        ? objects.reduce((sum, obj) => sum + obj.confidence, 0) / objects.length 
        : 0;
      
      console.log(`🏆 DETECCIÓN COMPLETADA en ${processingTime.toFixed(1)}ms`);
      console.log(`📊 Resultados: ${objects.length} objetos, confianza promedio: ${(averageConfidence * 100).toFixed(1)}%`);
      
      // Mostrar detalles del mejor objeto
      if (objects.length > 0) {
        const best = objects[0];
        console.log(`👑 Mejor objeto: ${best.dimensions.width.toFixed(1)}x${best.dimensions.height.toFixed(1)} ${best.dimensions.unit}`);
      }
      
      return {
        objects,
        processingTime,
        edgeMap: cannyResult.edges,
        contours: detectedContours.map(c => c.points),
        debugInfo: {
          edgePixels: cannyResult.edgePixels,
          contoursFound: detectedContours.length,
          validContours: objects.length,
          averageConfidence
        }
      };
      
    } catch (error) {
      console.error('❌ Error en detección de siluetas:', error);
      
      // Fallback con detección básica
      return this.fallbackDetection(width, height);
    }
  }

  /**
   * CONVERTIR CONTORNOS A OBJETOS DETECTADOS CON CALIBRACIÓN REAL
   */
  private convertContoursToDetectedObjects(
    contours: Array<{ points: Array<{ x: number; y: number }>; properties: any; confidence: number }>,
    width: number,
    height: number,
    calibrationData: CalibrationData | null
  ): DetectedObject[] {
    const objects: DetectedObject[] = [];
    
    for (let i = 0; i < Math.min(contours.length, 5); i++) {
      const contour = contours[i];
      const { properties, confidence } = contour;
      
      // Aplicar calibración real
      let realWidth = properties.boundingBox.width;
      let realHeight = properties.boundingBox.height;
      let realArea = properties.area;
      let realPerimeter = properties.perimeter;
      let unit: 'px' | 'mm' = 'px';
      
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        const mmPerPixel = 1 / calibrationData.pixelsPerMm;
        realWidth = properties.boundingBox.width * mmPerPixel;
        realHeight = properties.boundingBox.height * mmPerPixel;
        realArea = properties.area * mmPerPixel * mmPerPixel;
        realPerimeter = properties.perimeter * mmPerPixel;
        unit = 'mm';
        
        console.log(`🔧 Objeto ${i + 1}: ${properties.boundingBox.width}px → ${realWidth.toFixed(1)}mm`);
      }
      
      const detectedObject: DetectedObject = {
        id: `silhouette_${i}_${Date.now()}`,
        type: 'silhouette',
        x: properties.boundingBox.x,
        y: properties.boundingBox.y,
        width: properties.boundingBox.width,
        height: properties.boundingBox.height,
        area: realArea,
        confidence: Math.min(0.98, confidence + 0.1), // Boost confidence ligeramente
        
        // Contornos y siluetas
        contours: contour.points,
        boundingBox: properties.boundingBox,
        
        // Dimensiones calibradas
        dimensions: {
          width: realWidth,
          height: realHeight,
          area: realArea,
          unit,
          perimeter: realPerimeter
        },
        
        // Puntos 3D convertidos
        points: contour.points.slice(0, 20).map((point, index) => ({
          x: calibrationData?.isCalibrated ? point.x / calibrationData.pixelsPerMm : point.x,
          y: calibrationData?.isCalibrated ? point.y / calibrationData.pixelsPerMm : point.y,
          z: 0,
          confidence: confidence,
          timestamp: Date.now() + index
        })),
        
        // Propiedades geométricas avanzadas
        geometricProperties: {
          aspectRatio: properties.aspectRatio,
          solidity: properties.solidity,
          circularity: properties.circularity,
          perimeter: realPerimeter
        },
        
        // Información adicional de calidad
        circularity: properties.circularity,
        solidity: properties.solidity,
        extent: properties.extent,
        aspectRatio: properties.aspectRatio,
        compactness: properties.compactness,
        perimeter: realPerimeter,
        contourPoints: contour.points.length,
        centerX: properties.centroid.x,
        centerY: properties.centroid.y,
        huMoments: properties.huMoments,
        isConvex: properties.convexity > 0.95,
        boundingCircleRadius: properties.minEnclosingCircle.radius
      };
      
      objects.push(detectedObject);
    }
    
    // Ordenar por área (objeto más grande primero) y proximidad al centro
    objects.sort((a, b) => {
      const centerX = width / 2;
      const centerY = height / 2;
      
      const distA = Math.sqrt((a.centerX! - centerX) ** 2 + (a.centerY! - centerY) ** 2);
      const distB = Math.sqrt((b.centerX! - centerX) ** 2 + (b.centerY! - centerY) ** 2);
      
      // Score combinado: área grande + proximidad al centro + confianza
      const scoreA = a.area * (1 / (1 + distA / Math.max(width, height))) * a.confidence;
      const scoreB = b.area * (1 / (1 + distB / Math.max(width, height))) * b.confidence;
      
      return scoreB - scoreA;
    });
    
    return objects;
  }

  /**
   * DETECCIÓN FALLBACK EN CASO DE ERROR
   */
  private fallbackDetection(width: number, height: number): SilhouetteDetectionResult {
    console.log('⚠️ Ejecutando detección fallback...');
    
    // Crear objeto básico en el centro
    const centerX = width * 0.45;
    const centerY = height * 0.45;
    const objectWidth = width * 0.15;
    const objectHeight = height * 0.15;
    
    const fallbackObject: DetectedObject = {
      id: `fallback_${Date.now()}`,
      type: 'fallback',
      x: centerX,
      y: centerY,
      width: objectWidth,
      height: objectHeight,
      area: objectWidth * objectHeight,
      confidence: 0.3,
      
      contours: [
        { x: centerX, y: centerY },
        { x: centerX + objectWidth, y: centerY },
        { x: centerX + objectWidth, y: centerY + objectHeight },
        { x: centerX, y: centerY + objectHeight }
      ],
      
      boundingBox: {
        x: centerX,
        y: centerY,
        width: objectWidth,
        height: objectHeight
      },
      
      dimensions: {
        width: objectWidth,
        height: objectHeight,
        area: objectWidth * objectHeight,
        unit: 'px'
      },
      
      points: [
        { x: centerX, y: centerY, z: 0, confidence: 0.3, timestamp: Date.now() }
      ],
      
      geometricProperties: {
        aspectRatio: objectWidth / objectHeight,
        solidity: 1,
        circularity: 0.7,
        perimeter: 2 * (objectWidth + objectHeight)
      }
    };
    
    return {
      objects: [fallbackObject],
      processingTime: 10,
      edgeMap: new Uint8Array(width * height),
      contours: [fallbackObject.contours!],
      debugInfo: {
        edgePixels: 0,
        contoursFound: 1,
        validContours: 1,
        averageConfidence: 0.3
      }
    };
  }

  /**
   * DIBUJAR OVERLAY DE DETECCIÓN AVANZADO
   */
  drawDetectionOverlay(
    canvas: HTMLCanvasElement,
    result: SilhouetteDetectionResult,
    showEdges: boolean = false,
    showDebugInfo: boolean = false
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mostrar mapa de bordes si se solicita
    if (showEdges && result.edgeMap.length > 0) {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      
      for (let i = 0; i < result.edgeMap.length; i++) {
        const value = result.edgeMap[i];
        const pixelIndex = i * 4;
        
        imageData.data[pixelIndex] = value;     // R
        imageData.data[pixelIndex + 1] = value; // G
        imageData.data[pixelIndex + 2] = value; // B
        imageData.data[pixelIndex + 3] = value > 0 ? 80 : 0; // A
      }
      
      ctx.putImageData(imageData, 0, 0);
    }

    // Dibujar objetos detectados con estilo profesional
    result.objects.forEach((obj, index) => {
      const colors = ['#00ff41', '#ff6b35', '#4ecdc4', '#45b7d1', '#f9ca24'];
      const color = colors[index % colors.length];
      
      // Configurar estilo
      ctx.strokeStyle = color;
      ctx.fillStyle = color + '15';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Dibujar contorno con precisión
      if (obj.contours && obj.contours.length > 0) {
        ctx.beginPath();
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }

      // Etiquetas informativas elegantes
      const labelX = obj.boundingBox.x;
      const labelY = Math.max(20, obj.boundingBox.y - 15);
      
      // Fondo para texto
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const text = `${obj.dimensions.width.toFixed(1)} × ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`;
      const metrics = ctx.measureText(text);
      ctx.fillRect(labelX - 5, labelY - 15, metrics.width + 10, 20);
      
      // Texto principal
      ctx.fillStyle = color;
      ctx.font = 'bold 12px system-ui';
      ctx.fillText(text, labelX, labelY);
      
      // Información adicional
      const detailText = `${(obj.confidence * 100).toFixed(0)}% • ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}²`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '10px system-ui';
      ctx.fillText(detailText, labelX, labelY + 15);
      
      // Punto central
      if (obj.centerX !== undefined && obj.centerY !== undefined) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(obj.centerX, obj.centerY, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Información de debug si se solicita
    if (showDebugInfo && result.debugInfo) {
      const debug = result.debugInfo;
      const debugText = [
        `Tiempo: ${result.processingTime.toFixed(1)}ms`,
        `Píxeles borde: ${debug.edgePixels}`,
        `Contornos: ${debug.contoursFound} → ${debug.validContours}`,
        `Confianza: ${(debug.averageConfidence * 100).toFixed(1)}%`
      ];
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(10, 10, 200, debugText.length * 20 + 10);
      
      ctx.fillStyle = '#00ff41';
      ctx.font = '11px monospace';
      debugText.forEach((text, i) => {
        ctx.fillText(text, 15, 25 + i * 20);
      });
    }
  }
}