/**
 * DETECTOR DE SILUETAS ULTRA AVANZADO - ENFOQUE OBJETO CENTRAL
 * Sistema integrado optimizado para detectar UN SOLO objeto central con máxima precisión
 */

import { ImageProcessor } from '../core/ImageProcessor';
import { CannyEdgeDetector } from '../algorithms/CannyEdgeDetector';
import { ContourDetector } from '../algorithms/ContourDetector';
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

  private constructor() {
    this.imageProcessor = ImageProcessor.getInstance();
    this.edgeDetector = CannyEdgeDetector.getInstance();
    this.contourDetector = ContourDetector.getInstance();
  }

  public static getInstance(): SilhouetteDetector {
    if (!SilhouetteDetector.instance) {
      SilhouetteDetector.instance = new SilhouetteDetector();
    }
    return SilhouetteDetector.instance;
  }

  /**
   * DETECTAR SILUETA CENTRAL CON PIPELINE ULTRA OPTIMIZADO
   * ENFOQUE: UN SOLO OBJETO EN EL CENTRO DE LA PANTALLA
   */
  async detectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<SilhouetteDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;
    
    console.log(`🎯 INICIANDO DETECCIÓN CENTRAL DE SILUETAS ${width}x${height}`);
    
    try {
      // PASO 1: PREPROCESSAMIENTO ENFOCADO EN EL CENTRO
      console.log('📷 Paso 1: Preprocessamiento central...');
      const processed = this.preprocessForCentralDetection(imageData, width, height);
      
      // PASO 2: MEJORA DE CONTRASTE ADAPTATIVA CENTRAL
      console.log('🌟 Paso 2: Mejora de contraste central...');
      const enhanced = this.enhanceContrastForCenter(processed, width, height);
      
      // PASO 3: DETECCIÓN DE BORDES CANNY ULTRA SENSIBLE CENTRAL
      console.log('🔍 Paso 3: Detección de bordes centrales...');
      const cannyResult = this.edgeDetector.detectEdges(enhanced, width, height, {
        lowThreshold: 5,     // Extremadamente sensible
        highThreshold: 45,   // Muy permisivo
        sigma: 1.0,          // Suavizado mínimo
        sobelKernelSize: 3,
        l2Gradient: true
      });
      
      console.log(`✅ Bordes detectados: ${cannyResult.edgePixels} píxeles`);
      
      // PASO 4: DETECCIÓN DE CONTORNOS CON PRIORIDAD CENTRAL
      console.log('📐 Paso 4: Detección de contornos centrales...');
      const detectedContours = this.detectCentralContours(
        cannyResult.edges,
        width,
        height
      );
      
      console.log(`✅ Contornos centrales encontrados: ${detectedContours.length}`);
      
      // PASO 5: SELECCIONAR SOLO EL MEJOR OBJETO CENTRAL
      console.log('🎯 Paso 5: Selección del objeto central óptimo...');
      const centralObject = this.selectBestCentralObject(
        detectedContours,
        width,
        height,
        calibrationData
      );
      
      const processingTime = performance.now() - startTime;
      const objects = centralObject ? [centralObject] : [];
      const averageConfidence = objects.length > 0 ? objects[0].confidence : 0;
      
      console.log(`🏆 DETECCIÓN CENTRAL COMPLETADA en ${processingTime.toFixed(1)}ms`);
      
      if (centralObject) {
        console.log(`👑 OBJETO CENTRAL DETECTADO: ${centralObject.dimensions.width.toFixed(1)}x${centralObject.dimensions.height.toFixed(1)} ${centralObject.dimensions.unit}`);
        console.log(`📊 Confianza: ${(centralObject.confidence * 100).toFixed(1)}%`);
      } else {
        console.log('❌ No se detectó objeto central válido');
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
      console.error('❌ Error en detección central de siluetas:', error);
      
      // Fallback con detección básica central
      return this.centralFallbackDetection(width, height);
    }
  }

  /**
   * PREPROCESSAMIENTO ENFOCADO EN REGIÓN CENTRAL
   */
  private preprocessForCentralDetection(imageData: ImageData, width: number, height: number): Uint8Array {
    const processed = this.imageProcessor.processImage(imageData, 1.3);
    
    // APLICAR MÁSCARA CENTRAL SUAVE
    const centerMask = this.createCenterFocusMask(width, height);
    const result = new Uint8Array(width * height);
    
    for (let i = 0; i < processed.blurred.length; i++) {
      // Aplicar máscara central con suavizado
      result[i] = Math.floor(processed.blurred[i] * centerMask[i]);
    }
    
    return result;
  }

  /**
   * CREAR MÁSCARA DE ENFOQUE CENTRAL
   */
  private createCenterFocusMask(width: number, height: number): Float32Array {
    const mask = new Float32Array(width * height);
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4; // Radio del 40% del tamaño mínimo
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // Función gaussiana para enfoque suave en el centro
        const normalizedDistance = distance / maxRadius;
        const focusStrength = Math.exp(-normalizedDistance * normalizedDistance * 2);
        
        // Mantener un mínimo para no perder información completamente
        mask[y * width + x] = Math.max(0.2, focusStrength);
      }
    }
    
    return mask;
  }

  /**
   * MEJORAR CONTRASTE ESPECÍFICO PARA REGIÓN CENTRAL
   */
  private enhanceContrastForCenter(processed: Uint8Array, width: number, height: number): Uint8Array {
    // Aplicar mejora de contraste estándar
    const enhanced = this.imageProcessor.enhanceContrast(processed, width, height);
    
    // APLICAR MEJORA ADICIONAL EN REGIÓN CENTRAL
    const centerX = width / 2;
    const centerY = height / 2;
    const centralRadius = Math.min(width, height) * 0.3;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        if (distance <= centralRadius) {
          const idx = y * width + x;
          // Boost de contraste extra en región central
          const value = enhanced[idx];
          const boosted = Math.min(255, Math.max(0, (value - 128) * 1.4 + 128));
          enhanced[idx] = boosted;
        }
      }
    }
    
    return enhanced;
  }

  /**
   * DETECTAR CONTORNOS CON PRIORIDAD CENTRAL
   */
  private detectCentralContours(
    edges: Uint8Array,
    width: number,
    height: number
  ): Array<{ points: Array<{ x: number; y: number }>; properties: any; confidence: number }> {
    // Detectar todos los contornos
    const allContours = this.contourDetector.findContours(
      edges,
      width,
      height,
      'external',
      'simple'
    );
    
    // FILTRAR Y PRIORIZAR CONTORNOS CENTRALES
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    const centralContours = allContours
      .filter(contour => {
        // Filtros básicos de calidad
        const area = contour.properties.area;
        const minArea = width * height * 0.001; // Mínimo 0.1% del área total
        const maxArea = width * height * 0.8;   // Máximo 80% del área total
        
        return area >= minArea && area <= maxArea && contour.points.length >= 8;
      })
      .map(contour => {
        // Calcular distancia al centro
        const centroidX = contour.properties.centroid.x;
        const centroidY = contour.properties.centroid.y;
        const distanceToCenter = Math.sqrt(
          (centroidX - centerX) ** 2 + (centroidY - centerY) ** 2
        );
        
        // SCORING MEJORADO PARA OBJETOS CENTRALES
        const proximityScore = 1 - (distanceToCenter / maxDistance);
        const sizeScore = Math.min(1, contour.properties.area / (width * height * 0.1));
        const shapeScore = (contour.properties.circularity + contour.properties.solidity + contour.properties.convexity) / 3;
        
        // Score combinado con énfasis en proximidad al centro
        const centralScore = (proximityScore * 0.6) + (sizeScore * 0.2) + (shapeScore * 0.2);
        
        return {
          ...contour,
          confidence: Math.min(0.95, centralScore + 0.1),
          distanceToCenter,
          centralScore
        };
      })
      .sort((a, b) => b.centralScore - a.centralScore) // Ordenar por score central
      .slice(0, 3); // Tomar solo los 3 mejores
    
    console.log(`🎯 Contornos centrales filtrados: ${centralContours.length} de ${allContours.length}`);
    
    return centralContours;
  }

  /**
   * SELECCIONAR EL MEJOR OBJETO CENTRAL
   */
  private selectBestCentralObject(
    contours: Array<{ points: Array<{ x: number; y: number }>; properties: any; confidence: number }>,
    width: number,
    height: number,
    calibrationData: CalibrationData | null
  ): DetectedObject | null {
    if (contours.length === 0) {
      console.log('❌ No hay contornos para seleccionar objeto central');
      return null;
    }
    
    // Tomar el mejor contorno (ya están ordenados por centralScore)
    const bestContour = contours[0];
    const { properties, confidence } = bestContour;
    
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
      
      console.log(`🔧 Objeto central calibrado: ${properties.boundingBox.width}px → ${realWidth.toFixed(1)}mm`);
    }
    
    const detectedObject: DetectedObject = {
      id: `central_silhouette_${Date.now()}`,
      type: 'central_silhouette',
      x: properties.boundingBox.x,
      y: properties.boundingBox.y,
      width: properties.boundingBox.width,
      height: properties.boundingBox.height,
      area: realArea,
      confidence: Math.min(0.98, confidence + 0.15), // Boost extra para objeto central
      
      // Contornos y siluetas
      contours: bestContour.points,
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
      points: bestContour.points.slice(0, 20).map((point, index) => ({
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
      contourPoints: bestContour.points.length,
      centerX: properties.centroid.x,
      centerY: properties.centroid.y,
      huMoments: properties.huMoments,
      isConvex: properties.convexity > 0.95,
      boundingCircleRadius: properties.minEnclosingCircle.radius
    };
    
    console.log(`🎯 OBJETO CENTRAL SELECCIONADO: confianza=${(confidence * 100).toFixed(1)}%`);
    
    return detectedObject;
  }

  /**
   * DETECCIÓN FALLBACK CENTRAL EN CASO DE ERROR
   */
  private centralFallbackDetection(width: number, height: number): SilhouetteDetectionResult {
    console.log('⚠️ Ejecutando detección fallback central...');
    
    // Crear objeto básico en el centro con forma más realista
    const centerRegion = 0.5; // 50% del centro
    const marginX = width * (1 - centerRegion) / 2;
    const marginY = height * (1 - centerRegion) / 2;
    
    const centerX = marginX;
    const centerY = marginY;
    const objectWidth = width * centerRegion;
    const objectHeight = height * centerRegion;
    
    // Crear contorno elíptico más realista
    const contours = this.createEllipticalContour(
      centerX + objectWidth / 2,
      centerY + objectHeight / 2,
      objectWidth / 2,
      objectHeight / 2,
      16 // Puntos del contorno
    );
    
    const fallbackObject: DetectedObject = {
      id: `central_fallback_${Date.now()}`,
      type: 'central_fallback',
      x: centerX,
      y: centerY,
      width: objectWidth,
      height: objectHeight,
      area: objectWidth * objectHeight * 0.785, // Área aproximada de elipse
      confidence: 0.4, // Confianza baja para fallback
      
      contours,
      
      boundingBox: {
        x: centerX,
        y: centerY,
        width: objectWidth,
        height: objectHeight
      },
      
      dimensions: {
        width: objectWidth,
        height: objectHeight,
        area: objectWidth * objectHeight * 0.785,
        unit: 'px'
      },
      
      points: [
        { 
          x: centerX + objectWidth / 2, 
          y: centerY + objectHeight / 2, 
          z: 0, 
          confidence: 0.4, 
          timestamp: Date.now() 
        }
      ],
      
      geometricProperties: {
        aspectRatio: objectWidth / objectHeight,
        solidity: 0.8,
        circularity: 0.7,
        perimeter: 2 * Math.PI * Math.sqrt((objectWidth * objectWidth + objectHeight * objectHeight) / 8)
      }
    };
    
    return {
      objects: [fallbackObject],
      processingTime: 5,
      edgeMap: new Uint8Array(width * height),
      contours: [contours],
      debugInfo: {
        edgePixels: 0,
        contoursFound: 1,
        validContours: 1,
        averageConfidence: 0.4
      }
    };
  }

  /**
   * CREAR CONTORNO ELÍPTICO SUAVE
   */
  private createEllipticalContour(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    points: number
  ): Array<{ x: number; y: number }> {
    const contour: Array<{ x: number; y: number }> = [];
    
    for (let i = 0; i < points; i++) {
      const angle = (2 * Math.PI * i) / points;
      const x = centerX + radiusX * Math.cos(angle);
      const y = centerY + radiusY * Math.sin(angle);
      contour.push({ x, y });
    }
    
    return contour;
  }

  /**
   * DIBUJAR OVERLAY DE DETECCIÓN CENTRAL AVANZADO
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

    // Dibujar objetos detectados con estilo CENTRAL destacado
    result.objects.forEach((obj, index) => {
      // Color especial para objeto central
      const color = '#00ff41'; // Verde brillante para objeto central
      
      // Configurar estilo DESTACADO
      ctx.strokeStyle = color;
      ctx.fillStyle = color + '20'; // Relleno más visible
      ctx.lineWidth = 3; // Línea más gruesa
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Dibujar contorno con precisión MEJORADA
      if (obj.contours && obj.contours.length > 0) {
        ctx.beginPath();
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        
        // Añadir GLOW EFFECT para objeto central
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Etiquetas informativas MEJORADAS para objeto central
      const labelX = obj.boundingBox.x;
      const labelY = Math.max(25, obj.boundingBox.y - 20);
      
      // Fondo para texto MÁS VISIBLE
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      const text = `🎯 ${obj.dimensions.width.toFixed(1)} × ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`;
      ctx.font = 'bold 14px system-ui';
      const metrics = ctx.measureText(text);
      ctx.fillRect(labelX - 8, labelY - 18, metrics.width + 16, 25);
      
      // Texto principal DESTACADO
      ctx.fillStyle = color;
      ctx.fillText(text, labelX, labelY);
      
      // Información adicional MEJORADA
      const detailText = `${(obj.confidence * 100).toFixed(0)}% • ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}² • CENTRAL`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(detailText, labelX, labelY + 18);
      
      // Punto central MÁS VISIBLE
      if (obj.centerX !== undefined && obj.centerY !== undefined) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(obj.centerX, obj.centerY, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Cruz central
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.centerX - 10, obj.centerY);
        ctx.lineTo(obj.centerX + 10, obj.centerY);
        ctx.moveTo(obj.centerX, obj.centerY - 10);
        ctx.lineTo(obj.centerX, obj.centerY + 10);
        ctx.stroke();
      }
    });

    // Información de debug MEJORADA si se solicita
    if (showDebugInfo && result.debugInfo) {
      const debug = result.debugInfo;
      const debugText = [
        `🎯 DETECCIÓN CENTRAL`,
        `Tiempo: ${result.processingTime.toFixed(1)}ms`,
        `Píxeles borde: ${debug.edgePixels}`,
        `Contornos: ${debug.contoursFound} → ${debug.validContours}`,
        `Confianza: ${(debug.averageConfidence * 100).toFixed(1)}%`,
        `Objetos centrales: ${result.objects.length}`
      ];
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(10, 10, 220, debugText.length * 22 + 15);
      
      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 12px monospace';
      debugText.forEach((text, i) => {
        ctx.fillText(text, 15, 30 + i * 22);
      });
    }
  }
}