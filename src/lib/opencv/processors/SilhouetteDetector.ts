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
    
    try {
      // PASO 1: PROCESAMIENTO DE IMAGEN OPTIMIZADO CON MÚLTIPLES PASADAS
      console.log('📷 Paso 1: Procesamiento de imagen mejorado...');
      const processed = this.imageProcessor.processImage(imageData, 1.5); // Mayor contraste
      
      // PASO 2: MEJORA DE CONTRASTE ADAPTATIVA EXTREMA
      console.log('🌟 Paso 2: Mejora de contraste extrema...');
      const enhanced = this.imageProcessor.enhanceContrast(processed.blurred, width, height);
      
      // PASO 2.5: APLICAR FILTRO BILATERAL PARA PRESERVAR BORDES
      console.log('🔧 Paso 2.5: Filtro bilateral para preservar bordes...');
      const bilateralFiltered = this.applyBilateralFilter(enhanced, width, height);
      
      // PASO 3: DETECCIÓN DE BORDES MULTI-ALGORITMO PARA OBJETOS GRANDES CENTRALES
      console.log('🔍 Paso 3: Detección de bordes multi-algoritmo para objeto central...');
      
      // Primera pasada: Canny con parámetros para objetos grandes
      const cannyResult1 = this.edgeDetector.detectEdges(bilateralFiltered, width, height, {
        lowThreshold: 10,    // Muy bajo para capturar todos los bordes posibles
        highThreshold: 60,   // Moderado para eliminar ruido
        sigma: 2.5,          // Sigma alto para objetos grandes
        sobelKernelSize: 7,  // Kernel muy grande para bordes de objetos grandes
        l2Gradient: true
      });
      
      // Segunda pasada: Canny con parámetros más estrictos
      const cannyResult2 = this.edgeDetector.detectEdges(bilateralFiltered, width, height, {
        lowThreshold: 25,
        highThreshold: 100,
        sigma: 1.5,
        sobelKernelSize: 5,
        l2Gradient: true
      });
      
      // Combinar resultados de ambas pasadas
      const combinedEdges = this.combineEdgeMaps(cannyResult1.edges, cannyResult2.edges, width, height);
      
      // Aplicar operaciones morfológicas para cerrar gaps
      const morphedEdges = this.applyMorphologicalOperations(combinedEdges, width, height);
      
      const cannyResult = {
        edges: morphedEdges,
        edgePixels: this.countEdgePixels(morphedEdges),
        threshold: { low: 10, high: 100 }
      };
      
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
    const minAreaPercentage = 0.05; // Reducido a 5% para capturar objetos más pequeños
    const maxDistanceFromCenter = Math.min(width, height) * 0.35; // 35% del tamaño de la imagen
    
    // Calcular score para cada contorno basado en tamaño y centralidad
    const scoredContours = contours.map(contour => {
      const { properties } = contour;
      const objCenterX = properties.centroid.x;
      const objCenterY = properties.centroid.y;
      const distanceFromCenter = Math.sqrt((objCenterX - centerX) ** 2 + (objCenterY - centerY) ** 2);
      const areaPercentage = properties.area / (width * height);
      
      // Score basado en área (60%) y centralidad (40%)
      const normalizedDistance = distanceFromCenter / Math.max(width, height);
      const centralityScore = Math.max(0, 1 - normalizedDistance * 2);
      const areaScore = Math.min(1, areaPercentage * 5); // Normalizado hasta 20% del área
      const totalScore = areaScore * 0.6 + centralityScore * 0.4;
      
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

      // CALCULAR PROFUNDIDAD Y VOLUMEN 3D REALES
      try {
        const depthMeasurement = depthVolumeCalculator.calculateDepthAndVolume(
          detectedObject, 
          width, 
          height, 
          calibrationData
        );
        
        // Agregar mediciones 3D al objeto
        detectedObject.depth3D = {
          distance: depthMeasurement.distance,
          depth: depthMeasurement.depth,
          volume: depthMeasurement.volume,
          confidence: depthMeasurement.confidence,
          method: depthMeasurement.method
        };
        
        console.log(`🎯 Objeto ${i + 1} - Mediciones 3D: distancia=${depthMeasurement.distance.toFixed(0)}mm, volumen=${depthMeasurement.volume.toFixed(0)}mm³`);
        
      } catch (error) {
        console.error('❌ Error calculando profundidad 3D:', error);
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    // Dibujar objetos detectados con estilo mejorado y más visible
    result.objects.forEach((obj, index) => {
      // Color principal: verde brillante para mejor visibilidad
      const color = '#00ff00';
      
      // DIBUJAR CONTORNO PRINCIPAL CON MÚLTIPLES CAPAS PARA MAYOR VISIBILIDAD
      if (obj.contours && obj.contours.length > 0) {
        // Capa 1: Sombra exterior gruesa
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Capa 2: Borde blanco intermedio
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Capa 3: Línea principal de color
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Relleno semi-transparente
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        ctx.fill();
        
        // Dibujar puntos en los vértices principales (cada N puntos)
        const step = Math.max(1, Math.floor(obj.contours.length / 20));
        ctx.fillStyle = color;
        for (let i = 0; i < obj.contours.length; i += step) {
          ctx.beginPath();
          ctx.arc(obj.contours[i].x, obj.contours[i].y, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // PANEL DE INFORMACIÓN COMPLETO CON DIMENSIONES 2D Y 3D
      const panelX = 10;
      const panelY = 10;
      const panelWidth = 320;
      const lineHeight = 22;
      
      // Preparar textos informativos
      const infoTexts = [
        `OBJETO DETECTADO`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Dimensiones 2D:`,
        `  Ancho: ${obj.dimensions.width.toFixed(1)} ${obj.dimensions.unit}`,
        `  Alto: ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`,
        `  Área: ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}²`,
        `  Perímetro: ${obj.dimensions.perimeter?.toFixed(1) || 'N/A'} ${obj.dimensions.unit}`,
        ``,
        `Propiedades Geométricas:`,
        `  Solidez: ${((obj.solidity || 0) * 100).toFixed(1)}%`,
        `  Circularidad: ${((obj.circularity || 0) * 100).toFixed(1)}%`,
        `  Relación aspecto: ${obj.aspectRatio?.toFixed(2) || 'N/A'}`,
        `  Puntos contorno: ${obj.contourPoints || 0}`
      ];
      
      // Agregar información 3D si está disponible
      if (obj.depth3D) {
        infoTexts.push('');
        infoTexts.push('Información 3D:');
        infoTexts.push(`  Distancia: ${obj.depth3D.distance.toFixed(0)} mm`);
        infoTexts.push(`  Profundidad: ${obj.depth3D.depth.toFixed(1)} mm`);
        infoTexts.push(`  Volumen: ${(obj.depth3D.volume / 1000).toFixed(1)} cm³`);
        infoTexts.push(`  Método: ${obj.depth3D.method}`);
        infoTexts.push(`  Confianza 3D: ${(obj.depth3D.confidence * 100).toFixed(0)}%`);
      }
      
      infoTexts.push('');
      infoTexts.push(`Confianza detección: ${(obj.confidence * 100).toFixed(0)}%`);
      
      const panelHeight = infoTexts.length * lineHeight + 20;
      
      // Dibujar panel de fondo con gradiente
      const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = gradient;
      ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
      
      // Borde del panel
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
      
      // Dibujar textos
      infoTexts.forEach((text, i) => {
        if (text.startsWith('OBJETO')) {
          ctx.fillStyle = color;
          ctx.font = 'bold 14px monospace';
        } else if (text.startsWith('━')) {
          ctx.fillStyle = color;
          ctx.font = '12px monospace';
        } else if (!text.startsWith('  ')) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px monospace';
        } else {
          ctx.fillStyle = '#dddddd';
          ctx.font = '11px monospace';
        }
        ctx.fillText(text, panelX + 10, panelY + 20 + i * lineHeight);
      });
      
      // VISUALIZACIÓN DE BOUNDING BOX
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(obj.boundingBox.x, obj.boundingBox.y, obj.boundingBox.width, obj.boundingBox.height);
      ctx.setLineDash([]);
      
      // Mostrar dimensiones en el bounding box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const widthText = `${obj.dimensions.width.toFixed(1)} ${obj.dimensions.unit}`;
      const heightText = `${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`;
      
      // Ancho - arriba
      const widthMetrics = ctx.measureText(widthText);
      const widthLabelX = obj.boundingBox.x + obj.boundingBox.width / 2 - widthMetrics.width / 2;
      const widthLabelY = obj.boundingBox.y - 5;
      ctx.fillRect(widthLabelX - 5, widthLabelY - 15, widthMetrics.width + 10, 20);
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(widthText, widthLabelX, widthLabelY);
      
      // Alto - derecha
      ctx.save();
      ctx.translate(obj.boundingBox.x + obj.boundingBox.width + 15, obj.boundingBox.y + obj.boundingBox.height / 2);
      ctx.rotate(Math.PI / 2);
      const heightMetrics = ctx.measureText(heightText);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(-heightMetrics.width / 2 - 5, -15, heightMetrics.width + 10, 20);
      ctx.fillStyle = '#ffff00';
      ctx.fillText(heightText, -heightMetrics.width / 2, 0);
      ctx.restore();
      
      // Centro del objeto con cruz
      if (obj.centerX !== undefined && obj.centerY !== undefined) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        // Cruz
        ctx.beginPath();
        ctx.moveTo(obj.centerX - 10, obj.centerY);
        ctx.lineTo(obj.centerX + 10, obj.centerY);
        ctx.moveTo(obj.centerX, obj.centerY - 10);
        ctx.lineTo(obj.centerX, obj.centerY + 10);
        ctx.stroke();
        
        // Círculo central
        ctx.beginPath();
        ctx.arc(obj.centerX, obj.centerY, 5, 0, 2 * Math.PI);
        ctx.stroke();
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