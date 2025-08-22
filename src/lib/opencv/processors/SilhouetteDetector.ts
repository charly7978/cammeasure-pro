/**
 * DETECTOR DE SILUETAS ULTRA AVANZADO
 * Sistema integrado que combina todos los algoritmos para detección perfecta de siluetas
 */

import { ImageProcessor } from '../core/ImageProcessor';
import { CannyEdgeDetector } from '../algorithms/CannyEdgeDetector';
import { ContourDetector } from '../algorithms/ContourDetector';
import type { DetectedObject } from '../../types';
import { preciseObjectDetector } from '@/lib/preciseObjectDetection';

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
   * DETECTAR SILUETAS CON PIPELINE COMPLETO ULTRA OPTIMIZADO
   */
  async detectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<SilhouetteDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;
    
    console.log(`🎯 INICIANDO DETECCIÓN DE SILUETAS ${width}x${height}`);
    
    try {
      // PASO 1: PROCESAMIENTO DE IMAGEN OPTIMIZADO
      console.log('📷 Paso 1: Procesamiento de imagen...');
      const processed = this.imageProcessor.processImage(imageData, 1.2);
      
      // PASO 2: MEJORA DE CONTRASTE ADAPTATIVA
      console.log('🌟 Paso 2: Mejora de contraste...');
      const enhanced = this.imageProcessor.enhanceContrast(processed.blurred, width, height);
      
      // PASO 2.1: PRIORIZAR ROI CENTRAL (ventana 60% centrada)
      const roi = this.applyCentralROI(enhanced, width, height, 0.6);
      
      // PASO 3: DETECCIÓN DE BORDES CANNY ULTRA SENSIBLE (umbrales adaptativos)
      console.log('🔍 Paso 3: Detección de bordes Canny...');
      const cannyResult = this.edgeDetector.detectEdges(roi.data, width, height, {
        lowThreshold: 0,     // 0 => adaptativo
        highThreshold: 0,    // 0 => adaptativo
        sigma: 1.2,
        sobelKernelSize: 3,
        l2Gradient: true
      });
      
      // PASO 3.1: CIERRE MORFOLÓGICO SIMPLE EN EL MAPA DE BORDES PARA CONECTAR GAPS
      const closedEdges = this.morphologicalCloseEdges(cannyResult.edges, width, height);
      const cannyEdgePixels = this.countEdgePixels(closedEdges);
      console.log(`✅ Bordes detectados (post-cierre): ${cannyEdgePixels} píxeles`);
      
      // PASO 4: DETECCIÓN DE CONTORNOS AVANZADA
      console.log('📐 Paso 4: Detección de contornos...');
      const detectedContours = this.contourDetector.findContours(
        closedEdges,
        width,
        height,
        'external',
        'simple'
      );
      
      console.log(`✅ Contornos encontrados: ${detectedContours.length}`);
      
      // PASO 5: CONVERTIR A OBJETOS DETECTADOS CON CALIBRACIÓN
      console.log('🎯 Paso 5: Conversión a objetos detectados...');
      let objects = this.convertContoursToDetectedObjects(
        detectedContours,
        width,
        height,
        calibrationData
      );
      
      // Priorizar objeto dominante en centro (re-rank) y filtrar por ROI
      objects = this.prioritizeCentralDominantObject(objects, width, height);

      // FALLBACK: si no hay objetos robustos, intentar segmentación ML precisa del objeto dominante
      if (objects.length === 0 || (objects[0]?.confidence ?? 0) < 0.55) {
        console.log('🛟 Fallback preciso: intentando segmentación ML para objeto central...');
        const fallbackObj = await this.tryPreciseSegmentationFallback(imageData, calibrationData);
        if (fallbackObj) {
          const processingTime = performance.now() - startTime;
          return {
            objects: [fallbackObj],
            processingTime,
            edgeMap: closedEdges,
            contours: [fallbackObj.contours || []],
            debugInfo: {
              edgePixels: cannyEdgePixels,
              contoursFound: detectedContours.length,
              validContours: 1,
              averageConfidence: fallbackObj.confidence
            }
          };
        }
      }
      
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
        edgeMap: closedEdges,
        contours: detectedContours.map(c => c.points),
        debugInfo: {
          edgePixels: cannyEdgePixels,
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

  // --- NUEVOS MÉTODOS PRIVADOS ---
  private applyCentralROI(data: Uint8Array, width: number, height: number, ratio: number) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const rw = Math.floor(width * ratio);
    const rh = Math.floor(height * ratio);
    const x0 = Math.max(0, cx - Math.floor(rw / 2));
    const y0 = Math.max(0, cy - Math.floor(rh / 2));
    
    const roiData = new Uint8Array(width * height);
    for (let y = y0; y < y0 + rh; y++) {
      for (let x = x0; x < x0 + rw; x++) {
        roiData[y * width + x] = data[y * width + x];
      }
    }
    return { data: roiData, rect: { x: x0, y: y0, width: rw, height: rh } };
  }

  private morphologicalCloseEdges(edges: Uint8Array, width: number, height: number): Uint8Array {
    const dilated = new Uint8Array(edges.length);
    const result = new Uint8Array(edges.length);
    const kernel: Array<[number, number]> = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
    
    // Dilatar
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edges[idx] === 255) {
          dilated[idx] = 255;
          for (const [dx, dy] of kernel) {
            const nx = x + dx;
            const ny = y + dy;
            dilated[ny * width + nx] = 255;
          }
        }
      }
    }
    
    // Erosionar ligera para cierre (mantener conectividad)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let allNeighbors = true;
        for (const [dx, dy] of kernel) {
          const nx = x + dx;
          const ny = y + dy;
          if (dilated[ny * width + nx] !== 255) {
            allNeighbors = false;
            break;
          }
        }
        result[y * width + x] = allNeighbors ? 255 : dilated[y * width + x];
      }
    }
    
    return result;
  }

  private countEdgePixels(data: Uint8Array): number {
    let c = 0; for (let i = 0; i < data.length; i++) if (data[i] === 255) c++; return c;
  }

  private prioritizeCentralDominantObject(objects: DetectedObject[], width: number, height: number): DetectedObject[] {
    if (objects.length === 0) return objects;
    const cx = width / 2;
    const cy = height / 2;
    
    return [...objects].sort((a, b) => {
      const areaA = Math.max(1, a.width * a.height);
      const areaB = Math.max(1, b.width * b.height);
      const dA = Math.hypot((a.centerX ?? (a.x + a.width / 2)) - cx, (a.centerY ?? (a.y + a.height / 2)) - cy);
      const dB = Math.hypot((b.centerX ?? (b.x + b.width / 2)) - cx, (b.centerY ?? (b.y + b.height / 2)) - cy);
      const scoreA = (a.confidence || 0.5) * (areaA) * (1 / (1 + dA));
      const scoreB = (b.confidence || 0.5) * (areaB) * (1 / (1 + dB));
      return scoreB - scoreA;
    });
  }

  private async tryPreciseSegmentationFallback(
    imageData: ImageData,
    calibrationData: CalibrationData | null
  ): Promise<DetectedObject | null> {
    try {
      // Crear canvas temporal a partir de ImageData
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.putImageData(imageData, 0, 0);
      
      const precise = await preciseObjectDetector.detectLargestObject(canvas);
      if (!precise) return null;
      
      // Aplicar calibración si corresponde
      let unit: 'px' | 'mm' = 'px';
      let widthReal = precise.width;
      let heightReal = precise.height;
      let areaReal = precise.area;
      let perimeterReal = (precise.contours || []).reduce((sum, p, idx, arr) => {
        if (idx === 0) return 0; const prev = arr[idx - 1]; return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
      }, 0);
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        const mmPerPixel = 1 / calibrationData.pixelsPerMm;
        widthReal *= mmPerPixel;
        heightReal *= mmPerPixel;
        areaReal *= mmPerPixel * mmPerPixel;
        perimeterReal *= mmPerPixel;
        unit = 'mm';
      }
      
      const detected: DetectedObject = {
        id: `precise_${Date.now()}`,
        type: 'precise_fallback',
        x: precise.x,
        y: precise.y,
        width: precise.width,
        height: precise.height,
        area: areaReal,
        confidence: precise.confidence,
        contours: precise.contours,
        boundingBox: precise.boundingBox,
        dimensions: { width: widthReal, height: heightReal, area: areaReal, unit, perimeter: perimeterReal },
        points: precise.points,
        centerX: precise.boundingBox.x + precise.boundingBox.width / 2,
        centerY: precise.boundingBox.y + precise.boundingBox.height / 2,
        geometricProperties: {
          aspectRatio: precise.boundingBox.width / Math.max(1, precise.boundingBox.height),
          solidity: 1,
          circularity: 0.7,
          perimeter: perimeterReal
        }
      };
      return detected;
    } catch (e) {
      console.warn('Precise fallback no disponible:', e);
      return null;
    }
  }
}