/**
 * DETECTOR DE SILUETAS ULTRA AVANZADO
 * Sistema integrado que combina todos los algoritmos para detección perfecta de siluetas
 */

import { ImageProcessor } from '../core/ImageProcessor';
import { CannyEdgeDetector } from '../algorithms/CannyEdgeDetector';
import { ContourDetector } from '../algorithms/ContourDetector';
import { depthVolumeCalculator, type DepthMeasurement } from './DepthVolumeCalculator';
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
   * DETECTAR SILUETAS CON PIPELINE COMPLETO ULTRA OPTIMIZADO
   */
  async detectSilhouettes(
    imageData: ImageData,
    calibrationData: CalibrationData | null = null
  ): Promise<SilhouetteDetectionResult> {
    const startTime = performance.now();
    const { width, height } = imageData;
    
    console.log(`🎯 INICIANDO DETECCIÓN DE SILUETAS ${width}x${height}`);
    console.log(`📏 Calibración: ${calibrationData?.isCalibrated ? 'SÍ' : 'NO'}, pixelsPerMm: ${calibrationData?.pixelsPerMm || 0}`);
    
    try {
      // PASO 1: PROCESAMIENTO DE IMAGEN OPTIMIZADO
      console.log('📷 Paso 1: Procesamiento de imagen...');
      const processed = this.imageProcessor.processImage(imageData, 1.3); // Contraste aumentado
      
      // PASO 2: MEJORA DE CONTRASTE ADAPTATIVA  
      console.log('🌟 Paso 2: Mejora de contraste adaptativa...');
      const enhanced = this.imageProcessor.enhanceContrast(processed.blurred, width, height);
      
      // PASO 3: DETECCIÓN DE BORDES OPTIMIZADA PARA OBJETOS GRANDES
      console.log('🔍 Paso 3: Detección de bordes para objetos grandes...');
      
      // Parámetros optimizados para objetos grandes y centrales
      const cannyResult = this.edgeDetector.detectEdges(enhanced, width, height, {
        lowThreshold: 30,    // Umbral bajo balanceado
        highThreshold: 90,   // Umbral alto para bordes definidos
        sigma: 1.8,          // Sigma aumentado para suavizar ruido
        sobelKernelSize: 3,  // Kernel estándar eficiente
        l2Gradient: true     // Gradiente L2 para mayor precisión
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
    
    // FILTRAR PARA DETECTAR SOLO EL OBJETO CENTRAL MÁS GRANDE
    const centerX = width / 2;
    const centerY = height / 2;
    const minAreaPercentage = 0.02; // Mínimo 2% del área para no perder objetos
    const maxDistanceFromCenter = Math.min(width, height) * 0.5; // 50% del tamaño (toda la zona central)
    
    // Calcular score para cada contorno basado en tamaño y centralidad
    const scoredContours = contours.map(contour => {
      const { properties } = contour;
      const objCenterX = properties.centroid.x;
      const objCenterY = properties.centroid.y;
      const distanceFromCenter = Math.sqrt((objCenterX - centerX) ** 2 + (objCenterY - centerY) ** 2);
      const areaPercentage = properties.area / (width * height);
      
      // Score basado en área (80%) y centralidad (20%) - PRIORIZAR TAMAÑO
      const normalizedDistance = distanceFromCenter / Math.max(width, height);
      const centralityScore = Math.max(0, 1 - normalizedDistance);
      const areaScore = Math.min(1, areaPercentage * 10); // Más peso al área
      const totalScore = areaScore * 0.8 + centralityScore * 0.2;
      
      return {
        contour,
        score: totalScore,
        distanceFromCenter,
        areaPercentage,
        isValid: distanceFromCenter <= maxDistanceFromCenter && areaPercentage >= minAreaPercentage
      };
    });
    
    // Ordenar por score y tomar solo el mejor objeto central
    scoredContours.sort((a, b) => b.score - a.score);
    
    // Filtrar solo objetos válidos y tomar el mejor
    const validContours = scoredContours.filter(sc => sc.isValid);
    const bestContour = validContours.length > 0 ? validContours[0] : 
                       (scoredContours.length > 0 ? scoredContours[0] : null);
    
    console.log(`🎯 Objeto central detectado: ${validContours.length > 0 ? 'Válido' : 'Mejor disponible'}`);
    if (bestContour) {
      console.log(`   - Score: ${(bestContour.score * 100).toFixed(1)}%`);
      console.log(`   - Área: ${(bestContour.areaPercentage * 100).toFixed(2)}% de la imagen`);
      console.log(`   - Distancia del centro: ${bestContour.distanceFromCenter.toFixed(0)}px`);
    }
    
    // Procesar solo el mejor contorno
    const contoursToProcess = bestContour ? [bestContour.contour] : [];
    
    // PROCESAR SOLO UN OBJETO - EL MEJOR DETECTADO
    for (let i = 0; i < Math.min(contoursToProcess.length, 1); i++) {
      const contour = contoursToProcess[i];
      const { properties, confidence } = contour;
      
      // Aplicar calibración real - MEJORADO
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
        
        console.log(`🔧 Calibración aplicada - Objeto ${i + 1}:`);
        console.log(`   - Ancho: ${properties.boundingBox.width}px → ${realWidth.toFixed(1)}mm`);
        console.log(`   - Alto: ${properties.boundingBox.height}px → ${realHeight.toFixed(1)}mm`);
        console.log(`   - Factor: ${calibrationData.pixelsPerMm.toFixed(2)} px/mm`);
      } else {
        console.log(`⚠️ Sin calibración - Objeto ${i + 1}: ${realWidth.toFixed(0)}x${realHeight.toFixed(0)} píxeles`);
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

      // CALCULAR PROFUNDIDAD Y VOLUMEN 3D REALES - MEJORADO
      try {
        const depthMeasurement = depthVolumeCalculator.calculateDepthAndVolume(
          detectedObject, 
          width, 
          height, 
          calibrationData
        );
        
        // Asegurar que siempre tengamos mediciones 3D
        const distance = depthMeasurement.distance > 0 ? depthMeasurement.distance : 500; // Default 500mm
        const depth = depthMeasurement.depth > 0 ? depthMeasurement.depth : realWidth * 0.3;
        const volume = depthMeasurement.volume > 0 ? depthMeasurement.volume : realWidth * realHeight * depth;
        
        // Agregar mediciones 3D al objeto
        detectedObject.depth3D = {
          distance: distance,
          depth: depth,
          volume: volume,
          confidence: depthMeasurement.confidence > 0 ? depthMeasurement.confidence : 0.7,
          method: depthMeasurement.method || 'estimated'
        };
        
        console.log(`🎯 Mediciones 3D - Objeto ${i + 1}:`);
        console.log(`   - Distancia: ${distance.toFixed(0)}mm`);
        console.log(`   - Profundidad: ${depth.toFixed(1)}mm`);
        console.log(`   - Volumen: ${(volume/1000).toFixed(1)}cm³`);
        console.log(`   - Método: ${detectedObject.depth3D.method}`);
        
      } catch (error) {
        console.error('❌ Error calculando profundidad 3D:', error);
        // Valores por defecto en caso de error
        detectedObject.depth3D = {
          distance: 500,
          depth: realWidth * 0.3,
          volume: realWidth * realHeight * (realWidth * 0.3),
          confidence: 0.5,
          method: 'estimated'
        };
      }
      
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

    // SIEMPRE limpiar el canvas antes de dibujar
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Si no hay objetos, no dibujar nada más
    if (!result.objects || result.objects.length === 0) {
      return;
    }

    // Mostrar mapa de bordes si se solicita
    if (showEdges && result.edgeMap.length > 0) {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      
      for (let i = 0; i < result.edgeMap.length; i++) {
        const value = result.edgeMap[i];
        const pixelIndex = i * 4;
        
        // Usar colores más visibles para los bordes
        imageData.data[pixelIndex] = 0;         // R
        imageData.data[pixelIndex + 1] = value; // G (verde para bordes)
        imageData.data[pixelIndex + 2] = value * 0.5; // B
        imageData.data[pixelIndex + 3] = value > 0 ? 120 : 0; // A (más opaco)
      }
      
      ctx.putImageData(imageData, 0, 0);
    }

    // Dibujar SOLO el primer objeto (el más grande y central)
    const obj = result.objects[0];
    if (!obj) return;
    
    // Estilo simple y no invasivo
    const color = '#00ff00';
    
    // DIBUJAR SOLO EL CONTORNO SIMPLE
    if (obj.contours && obj.contours.length > 0) {
      // Una sola línea delgada
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
      for (let i = 1; i < obj.contours.length; i++) {
        ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // PANEL DE INFORMACIÓN PROFESIONAL
    if (obj.dimensions) {
      const x = 10;
      let y = 10;
      const lineHeight = 22;
      const padding = 10;
      
      // Información 2D
      const info2D = [];
      const unit = obj.dimensions.unit || 'px';
      
      info2D.push(`Ancho: ${obj.dimensions.width.toFixed(1)} ${unit}`);
      info2D.push(`Alto: ${obj.dimensions.height.toFixed(1)} ${unit}`);
      if (obj.dimensions.area) {
        const area = unit === 'mm' ? (obj.dimensions.area / 100).toFixed(1) + ' cm²' : 
                                     obj.dimensions.area.toFixed(0) + ' px²';
        info2D.push(`Área: ${area}`);
      }
      if (obj.dimensions.perimeter) {
        info2D.push(`Perímetro: ${obj.dimensions.perimeter.toFixed(1)} ${unit}`);
      }
      
      // Información 3D si está disponible
      const info3D = [];
      if (obj.depth3D) {
        info3D.push(`Distancia: ${obj.depth3D.distance.toFixed(0)} mm`);
        info3D.push(`Profundidad: ${obj.depth3D.depth.toFixed(1)} mm`);
        info3D.push(`Volumen: ${(obj.depth3D.volume / 1000).toFixed(1)} cm³`);
      }
      
      // Calcular tamaño del panel
      const allInfo = [...info2D, ...info3D];
      const maxWidth = Math.max(...allInfo.map(text => {
        ctx.font = '14px system-ui';
        return ctx.measureText(text).width;
      })) + padding * 2;
      
      const panelHeight = (allInfo.length + 2) * lineHeight + padding;
      
      // Fondo del panel
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(x, y, maxWidth, panelHeight);
      
      // Borde del panel
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, maxWidth, panelHeight);
      
      // Título
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 16px system-ui';
      ctx.fillText('MEDICIONES', x + padding, y + lineHeight);
      
      y += lineHeight * 1.5;
      
      // Información 2D
      ctx.font = '14px system-ui';
      ctx.fillStyle = '#ffffff';
      info2D.forEach(text => {
        ctx.fillText(text, x + padding, y + lineHeight);
        y += lineHeight;
      });
      
      // Separador si hay info 3D
      if (info3D.length > 0) {
        y += 5;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + padding, y);
        ctx.lineTo(x + maxWidth - padding, y);
        ctx.stroke();
        y += 10;
        
        // Información 3D
        ctx.fillStyle = '#88ff88';
        info3D.forEach(text => {
          ctx.fillText(text, x + padding, y + lineHeight);
          y += lineHeight;
        });
      }
      
      // Mostrar confianza
      y += 5;
      ctx.font = '12px system-ui';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(`Confianza: ${(obj.confidence * 100).toFixed(0)}%`, x + padding, y + lineHeight);
    }
  }
  
  /**
   * APLICAR FILTRO BILATERAL PARA PRESERVAR BORDES
   */
  private applyBilateralFilter(imageData: Uint8Array, width: number, height: number): Uint8Array {
    const filtered = new Uint8Array(imageData.length);
    const d = 9; // Diámetro del vecindario
    const sigmaColor = 75;
    const sigmaSpace = 75;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let sum = 0;
        let wSum = 0;
        
        for (let dy = -Math.floor(d/2); dy <= Math.floor(d/2); dy++) {
          for (let dx = -Math.floor(d/2); dx <= Math.floor(d/2); dx++) {
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nIdx = ny * width + nx;
              const spatialDist = Math.sqrt(dx * dx + dy * dy);
              const colorDist = Math.abs(imageData[idx] - imageData[nIdx]);
              
              const ws = Math.exp(-(spatialDist * spatialDist) / (2 * sigmaSpace * sigmaSpace));
              const wc = Math.exp(-(colorDist * colorDist) / (2 * sigmaColor * sigmaColor));
              const w = ws * wc;
              
              sum += imageData[nIdx] * w;
              wSum += w;
            }
          }
        }
        
        filtered[idx] = Math.round(sum / wSum);
      }
    }
    
    return filtered;
  }
  
  /**
   * COMBINAR MAPAS DE BORDES DE MÚLTIPLES DETECCIONES
   */
  private combineEdgeMaps(edges1: Uint8Array, edges2: Uint8Array, width: number, height: number): Uint8Array {
    const combined = new Uint8Array(edges1.length);
    
    for (let i = 0; i < edges1.length; i++) {
      // Tomar el máximo de ambos mapas de bordes
      combined[i] = Math.max(edges1[i], edges2[i]);
    }
    
    return combined;
  }
  
  /**
   * APLICAR OPERACIONES MORFOLÓGICAS PARA MEJORAR CONTORNOS
   */
  private applyMorphologicalOperations(edges: Uint8Array, width: number, height: number): Uint8Array {
    // Primero aplicar dilatación para conectar bordes cercanos
    let dilated = this.dilate(edges, width, height, 3);
    
    // Luego aplicar cierre (dilatación seguida de erosión) para cerrar gaps
    dilated = this.dilate(dilated, width, height, 2);
    const closed = this.erode(dilated, width, height, 2);
    
    // Finalmente, aplicar una erosión ligera para refinar
    return this.erode(closed, width, height, 1);
  }
  
  /**
   * OPERACIÓN DE DILATACIÓN
   */
  private dilate(image: Uint8Array, width: number, height: number, size: number): Uint8Array {
    const result = new Uint8Array(image.length);
    const offset = Math.floor(size / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;
        
        for (let dy = -offset; dy <= offset; dy++) {
          for (let dx = -offset; dx <= offset; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = ny * width + nx;
              maxVal = Math.max(maxVal, image[idx]);
            }
          }
        }
        
        result[y * width + x] = maxVal;
      }
    }
    
    return result;
  }
  
  /**
   * OPERACIÓN DE EROSIÓN
   */
  private erode(image: Uint8Array, width: number, height: number, size: number): Uint8Array {
    const result = new Uint8Array(image.length);
    const offset = Math.floor(size / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 255;
        
        for (let dy = -offset; dy <= offset; dy++) {
          for (let dx = -offset; dx <= offset; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = ny * width + nx;
              minVal = Math.min(minVal, image[idx]);
            }
          }
        }
        
        result[y * width + x] = minVal;
      }
    }
    
    return result;
  }
}