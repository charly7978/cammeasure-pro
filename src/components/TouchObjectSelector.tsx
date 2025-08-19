// COMPONENTE DE SELECCIÓN MANUAL DE OBJETOS POR TOQUE
// Permite al usuario tocar la pantalla para seleccionar objetos específicos

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { useCalibration } from '../hooks/useCalibration';
import { applyFilter, detectContoursReal } from '../lib';

interface DetectedObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  perimeter: number;
  points: number[][];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface TouchObjectSelectorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  onObjectSelected: (object: DetectedObject, measurements: any) => void;
  onError: (error: string) => void;
  isActive: boolean;
}

export const TouchObjectSelector: React.FC<TouchObjectSelectorProps> = ({
  videoRef,
  overlayCanvasRef,
  onObjectSelected,
  onError,
  isActive
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [measurements, setMeasurements] = useState<any>(null);
  const [touchIndicator, setTouchIndicator] = useState<{ x: number; y: number } | null>(null);
  const { calibrationData } = useCalibration();

  // MANEJAR TOQUE EN LA PANTALLA
  const handleTouch = useCallback(async (event: React.TouchEvent) => {
    if (!isActive || !videoRef.current || !overlayCanvasRef.current) return;
    
    event.preventDefault();
    
    const touch = event.touches[0];
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    
    // Convertir coordenadas de toque a coordenadas del canvas
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    console.log('👆 TOQUE DETECTADO en:', { x, y });
    setTouchIndicator({ x, y });
    
    // PROCESAR SELECCIÓN DE OBJETO
    await processTouchSelection(x, y);
  }, [isActive, videoRef, overlayCanvasRef]);

  // MANEJAR CLICK DEL MOUSE (para desarrollo/desktop)
  const handleClick = useCallback(async (event: React.MouseEvent) => {
    if (!isActive || !videoRef.current || !overlayCanvasRef.current) return;
    
    event.preventDefault();
    
    const rect = overlayCanvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('🖱️ CLICK DETECTADO en:', { x, y });
    setTouchIndicator({ x, y });
    
    // PROCESAR SELECCIÓN DE OBJETO
    await processTouchSelection(x, y);
  }, [isActive, videoRef, overlayCanvasRef]);

  // PROCESAR LA SELECCIÓN POR TOQUE
  const processTouchSelection = useCallback(async (touchX: number, touchY: number) => {
    if (!videoRef.current || !overlayCanvasRef.current) return;
    
    try {
      setIsProcessing(true);
      console.log('🔍 PROCESANDO SELECCIÓN POR TOQUE...');
      
      // 1. CAPTURAR FRAME ACTUAL
      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo obtener contexto del canvas');
      
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Dibujar frame actual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 2. DETECTAR CONTORNOS EN EL PUNTO DE TOQUE
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const detectedObjects = await detectObjectsAtTouchPoint(imageData, touchX, touchY);
      
      if (detectedObjects.length === 0) {
        throw new Error('No se detectaron objetos en el punto seleccionado');
      }
      
      // 3. SELECCIONAR EL OBJETO MÁS CERCANO AL TOQUE
      const closestObject = selectClosestObject(detectedObjects, touchX, touchY);
      setSelectedObject(closestObject);
      
      // 4. CALCULAR MEDICIONES DEL OBJETO SELECCIONADO
      const measurements = await calculateObjectMeasurements(closestObject, imageData);
      setMeasurements(measurements);
      
      // 5. DIBUJAR SELECCIÓN EN EL CANVAS
      drawObjectSelection(ctx, closestObject, touchX, touchY);
      
      // 6. NOTIFICAR OBJETO SELECCIONADO
      onObjectSelected(closestObject, measurements);
      
      console.log('✅ OBJETO SELECCIONADO:', {
        id: closestObject.id,
        area: closestObject.area,
        boundingBox: closestObject.boundingBox,
        measurements
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error en selección por toque:', errorMessage);
      onError(`Error seleccionando objeto: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [videoRef, overlayCanvasRef, onObjectSelected, onError]);

  // DETECTAR OBJETOS EN EL PUNTO DE TOQUE
  const detectObjectsAtTouchPoint = async (imageData: ImageData, touchX: number, touchY: number): Promise<DetectedObject[]> => {
    try {
      console.log('🔍 DETECTANDO OBJETOS EN EL PUNTO DE TOQUE...');
      
      // 1. APLICAR FILTRO CANNY PARA DETECTAR BORDES
      const filteredImage = await applyFilter(imageData, 'canny');
      console.log('✅ Filtro Canny aplicado');
      
      // 2. DETECTAR CONTORNOS REALES
      const contours = await detectContoursReal(filteredImage, imageData.width, imageData.height);
      console.log('✅ Contornos detectados:', contours.length);
      
      // 3. FILTRAR OBJETOS QUE CONTENGAN EL PUNTO DE TOQUE
      const objectsAtPoint: DetectedObject[] = [];
      
      for (const contour of contours) {
        if (isPointInContour(touchX, touchY, contour)) {
          const boundingBox = calculateBoundingBox(contour.points);
          const area = calculateArea(contour.points);
          const perimeter = calculatePerimeter(contour.points);
          
          const object: DetectedObject = {
            id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x: boundingBox.x + boundingBox.width / 2,
            y: boundingBox.y + boundingBox.height / 2,
            width: boundingBox.width,
            height: boundingBox.height,
            area,
            perimeter,
            points: contour.points,
            boundingBox
          };
          
          objectsAtPoint.push(object);
        }
      }
      
      console.log('✅ Objetos en el punto de toque:', objectsAtPoint.length);
      return objectsAtPoint;
      
    } catch (error) {
      console.error('❌ Error detectando objetos:', error);
      throw new Error('Error al detectar objetos en el punto de toque');
    }
  };

  // FUNCIÓN AUXILIAR: CALCULAR BOUNDING BOX
  const calculateBoundingBox = (points: number[][]): { x: number; y: number; width: number; height: number } => {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = points[0][0], maxX = points[0][0];
    let minY = points[0][1], maxY = points[0][1];
    
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // FUNCIÓN AUXILIAR: CALCULAR ÁREA
  const calculateArea = (points: number[][]): number => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i][0] * points[j][1];
      area -= points[j][0] * points[i][1];
    }
    
    return Math.abs(area) / 2;
  };

  // FUNCIÓN AUXILIAR: CALCULAR PERÍMETRO
  const calculatePerimeter = (points: number[][]): number => {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const dx = points[j][0] - points[i][0];
      const dy = points[j][1] - points[i][1];
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  };

  // FUNCIÓN AUXILIAR: CALCULAR CIRCULARIDAD
  const calculateCircularity = (object: DetectedObject): number => {
    try {
      const { area, perimeter } = object;
      if (perimeter === 0) return 0;
      
      // Circularidad = 4π * área / perímetro²
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      return Math.min(circularity, 1); // Normalizar a [0, 1]
    } catch (error) {
      console.error('Error calculando circularidad:', error);
      return 0;
    }
  };

  // FUNCIÓN AUXILIAR: CALCULAR COMPACIDAD
  const calculateCompactness = (object: DetectedObject): number => {
    try {
      const { area, perimeter } = object;
      if (perimeter === 0) return 0;
      
      // Compacidad = área / perímetro²
      const compactness = area / (perimeter * perimeter);
      return Math.min(compactness, 1); // Normalizar a [0, 1]
    } catch (error) {
      console.error('Error calculando compacidad:', error);
      return 0;
    }
  };

  // VERIFICAR SI UN PUNTO ESTÁ DENTRO DE UN CONTORNO
  const isPointInContour = (x: number, y: number, contour: any): boolean => {
    try {
      // Algoritmo de punto en polígono (ray casting)
      let inside = false;
      const points = contour.points || [];
      
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      
      return inside;
      
    } catch (error) {
      console.error('❌ Error verificando punto en contorno:', error);
      return false;
    }
  };

  // SELECCIONAR OBJETO MÁS CERCANO AL TOQUE
  const selectClosestObject = (objects: DetectedObject[], touchX: number, touchY: number): DetectedObject => {
    if (objects.length === 0) {
      throw new Error('No hay objetos para seleccionar');
    }
    
    if (objects.length === 1) {
      return objects[0];
    }
    
    // Encontrar el objeto cuyo centro del bounding box esté más cerca del punto de toque
    let closestObject = objects[0];
    let minDistance = Number.MAX_VALUE;
    
    for (const object of objects) {
      const centerX = object.boundingBox.x + object.boundingBox.width / 2;
      const centerY = object.boundingBox.y + object.boundingBox.height / 2;
      
      const distance = Math.sqrt(
        Math.pow(centerX - touchX, 2) + Math.pow(centerY - touchY, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestObject = object;
      }
    }
    
    console.log('✅ Objeto más cercano seleccionado:', closestObject.id);
    return closestObject;
  };

  // CALCULAR MEDICIONES DEL OBJETO SELECCIONADO
  const calculateObjectMeasurements = async (object: DetectedObject, imageData: ImageData): Promise<any> => {
    try {
      const { width, height, area, perimeter } = object;
      
      // Usar calibración real para convertir px → mm
      let realWidth = width;
      let realHeight = height;
      let realArea = area;
      let realPerimeter = perimeter;
      
      if (calibrationData?.isCalibrated && calibrationData.pixelsPerMm > 0) {
        const pixelsPerMm = calibrationData.pixelsPerMm;
        realWidth = width / pixelsPerMm;
        realHeight = height / pixelsPerMm;
        realArea = area / (pixelsPerMm ** 2);
        realPerimeter = perimeter / pixelsPerMm;
      }

      // Calcular propiedades adicionales
      const diagonal = Math.sqrt(realWidth ** 2 + realHeight ** 2);
      const aspectRatio = realWidth / realHeight;
      const circularity = calculateCircularity(object);
      const compactness = calculateCompactness(object);

      // Estimar profundidad 3D basada en el tamaño relativo del objeto
      const estimatedDepth = estimateDepthFromObjectSize(realArea, imageData.width, imageData.height);

      return {
        // Medidas 2D en mm (si está calibrado) o px
        width: realWidth,
        height: realHeight,
        area: realArea,
        perimeter: realPerimeter,
        diagonal,
        aspectRatio,
        
        // Propiedades de forma
        circularity,
        compactness,
        
        // Estimación 3D
        estimatedDepth,
        estimatedVolume: realArea * estimatedDepth,
        estimatedSurfaceArea: (realWidth * realHeight * 2) + (realWidth * estimatedDepth * 2) + (realHeight * estimatedDepth * 2),
        
        // Unidades
        units: calibrationData?.isCalibrated ? 'mm' : 'px',
        calibrationFactor: calibrationData?.pixelsPerMm || null
      };
    } catch (error) {
      console.error('Error calculando mediciones:', error);
      throw new Error('Error al calcular mediciones del objeto');
    }
  };

  // ESTIMAR PROFUNDIDAD BASADA EN EL TAMAÑO DEL OBJETO
  const estimateDepthFromObjectSize = (objectArea: number, imageWidth: number, imageHeight: number): number => {
    try {
      // Estimación basada en perspectiva y tamaño del objeto
      const imageArea = imageWidth * imageHeight;
      
      // Factor de profundidad basado en el área relativa del objeto
      const relativeArea = objectArea / imageArea;
      const depthFactor = Math.sqrt(relativeArea);
      
      // Profundidad estimada (en píxeles)
      const estimatedDepth = 100 * depthFactor; // Valor por defecto en píxeles
      
      return Math.round(estimatedDepth);
      
    } catch (error) {
      console.error('❌ Error estimando profundidad:', error);
      return 100; // Valor por defecto
    }
  };

  // DIBUJAR SELECCIÓN DEL OBJETO EN EL CANVAS
  const drawObjectSelection = (ctx: CanvasRenderingContext2D, object: DetectedObject, touchX: number, touchY: number) => {
    try {
      const { boundingBox } = object;
      const { x, y, width, height } = boundingBox;
      
      // 1. DIBUJAR BOUNDING BOX
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
      
      // 2. DIBUJAR PUNTO DE TOQUE
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(touchX, touchY, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // 3. DIBUJAR INFORMACIÓN DEL OBJETO
      ctx.fillStyle = '#00FF00';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      
      const infoText = `Objeto: ${object.id}`;
      const sizeText = `${width} × ${height} px`;
      const areaText = `Área: ${object.area} px²`;
      
      // Fondo para el texto
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 200, 80);
      
      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(infoText, 15, 30);
      ctx.fillText(sizeText, 15, 50);
      ctx.fillText(areaText, 15, 70);
      
      console.log('✅ Selección dibujada en el canvas');
      
    } catch (error) {
      console.error('❌ Error dibujando selección:', error);
    }
  };

  // LIMPIAR SELECCIÓN ANTERIOR
  const clearSelection = useCallback(() => {
    if (!overlayCanvasRef.current) return;
    
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    setTouchIndicator(null);
    setSelectedObject(null);
    setMeasurements(null);
    
    console.log('🧹 Selección limpiada');
  }, [overlayCanvasRef]);

  // LIMPIAR SELECCIÓN CUANDO SE DESACTIVA
  useEffect(() => {
    if (!isActive) {
      clearSelection();
    }
  }, [isActive, clearSelection]);

  return (
    <div 
      className="absolute inset-0 z-10"
      onTouchStart={handleTouch}
      onClick={handleClick}
      style={{ pointerEvents: isActive ? 'auto' : 'none' }}
    >
      {/* INDICADOR DE TOQUE */}
      {touchIndicator && (
        <div 
          className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg animate-pulse"
          style={{
            left: touchIndicator.x - 8,
            top: touchIndicator.y - 8,
            transform: 'translate(-50%, -50%)'
          }}
        />
      )}
      
      {/* INDICADOR DE PROCESAMIENTO */}
      {isProcessing && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg">
          🔍 Detectando objeto...
        </div>
      )}
      
      {/* RESULTADO DE MEDICIÓN */}
      {measurements && selectedObject && (
        <div className="absolute top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg max-w-xs">
          <h3 className="font-bold mb-2">📏 Objeto Seleccionado</h3>
          <div className="text-sm space-y-1">
            <div>ID: {selectedObject.id}</div>
            <div>Ancho: {measurements.width} {measurements.units}</div>
            <div>Alto: {measurements.height} {measurements.units}</div>
            <div>Área: {measurements.area} {measurements.units}²</div>
            <div>Profundidad: {measurements.estimatedDepth} {measurements.units}</div>
            <div>Volumen: {measurements.estimatedVolume} {measurements.units}³</div>
            <div>Confianza: {(measurements.confidence * 100).toFixed(1)}%</div>
          </div>
          <button 
            onClick={clearSelection}
            className="mt-3 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Limpiar
          </button>
        </div>
      )}
      
      {/* INSTRUCCIONES */}
      {isActive && !selectedObject && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg">
          👆 Toca la pantalla en el objeto que quieres medir
        </div>
      )}
    </div>
  );
};
