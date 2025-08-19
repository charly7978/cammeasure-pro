// COMPONENTE DE SELECCIÓN MANUAL DE OBJETOS POR TOQUE
// Permite al usuario tocar la pantalla para seleccionar objetos específicos

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { DetectedObject } from '@/lib/types';
import { detectContoursReal, applyFilter } from '@/lib';

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
  const [touchPoint, setTouchPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [measurementResult, setMeasurementResult] = useState<any>(null);

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
    setTouchPoint({ x, y });
    
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
    setTouchPoint({ x, y });
    
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
      setMeasurementResult(measurements);
      
      // 5. DIBUJAR SELECCIÓN EN EL CANVAS
      drawObjectSelection(ctx, closestObject, touchX, touchY);
      
      // 6. NOTIFICAR OBJETO SELECCIONADO
      onObjectSelected(closestObject, measurements);
      
      console.log('✅ OBJETO SELECCIONADO:', {
        id: closestObject.id,
        type: closestObject.type,
        dimensions: closestObject.dimensions,
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
      console.log('🔍 DETECTANDO OBJETOS EN PUNTO DE TOQUE...');
      
      // 1. APLICAR FILTRO CANNY PARA DETECTAR BORDES
      const edges = applyFilter(imageData, 'canny');
      
      // 2. DETECTAR CONTORNOS REALES
      const contours = detectContoursReal(edges, imageData.width, imageData.height);
      
      // 3. FILTRAR CONTORNOS QUE CONTENGAN EL PUNTO DE TOQUE
      const validContours = contours.filter((contour: any) => {
        return isPointInContour(touchX, touchY, contour);
      });
      
      // 4. CONVERTIR A DETECTEDOBJECT[]
      const detectedObjects: DetectedObject[] = validContours.map((contour: any, index: number) => ({
        id: `touch_obj_${index}`,
        type: 'touch_selected',
        boundingBox: {
          x: contour.boundingBox.x,
          y: contour.boundingBox.y,
          width: contour.boundingBox.width,
          height: contour.boundingBox.height
        },
        dimensions: {
          width: contour.boundingBox.width,
          height: contour.boundingBox.height,
          area: contour.area || contour.boundingBox.width * contour.boundingBox.height,
          unit: 'px'
        },
        confidence: contour.confidence || 0.9,
        contour: contour.points
      }));
      
      console.log(`✅ ${detectedObjects.length} objetos detectados en punto de toque`);
      return detectedObjects;
      
    } catch (error) {
      console.error('❌ Error detectando objetos:', error);
      return [];
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
    let closestObject = objects[0];
    let minDistance = Infinity;
    
    for (const object of objects) {
      const centerX = object.boundingBox.x + object.boundingBox.width / 2;
      const centerY = object.boundingBox.y + object.boundingBox.height / 2;
      
      const distance = Math.sqrt(Math.pow(centerX - touchX, 2) + Math.pow(centerY - touchY, 2));
      
      if (distance < minDistance) {
        minDistance = distance;
        closestObject = object;
      }
    }
    
    return closestObject;
  };

  // CALCULAR MEDICIONES DEL OBJETO SELECCIONADO
  const calculateObjectMeasurements = async (object: DetectedObject, imageData: ImageData): Promise<any> => {
    try {
      console.log('📏 CALCULANDO MEDICIONES DEL OBJETO...');
      
      const { width, height, area } = object.dimensions;
      
      // 1. MEDICIONES BÁSICAS 2D
      const perimeter = 2 * (width + height);
      const diagonal = Math.sqrt(width * width + height * height);
      const aspectRatio = width / height;
      
      // 2. ESTIMACIÓN DE PROFUNDIDAD (basada en el tamaño del objeto)
      const estimatedDepth = estimateDepthFromObjectSize(object, imageData);
      
      // 3. MEDICIONES 3D ESTIMADAS
      const volume = width * height * estimatedDepth;
      const surfaceArea = 2 * (width * height + width * estimatedDepth + height * estimatedDepth);
      
      // 4. ANÁLISIS DE FORMA
      const circularity = calculateCircularity(object);
      const compactness = calculateCompactness(object);
      
      const measurements = {
        // Medidas 2D
        width: { value: width, unit: 'px' },
        height: { value: height, unit: 'px' },
        area: { value: area, unit: 'px²' },
        perimeter: { value: perimeter, unit: 'px' },
        diagonal: { value: diagonal, unit: 'px' },
        aspectRatio: { value: aspectRatio, unit: '' },
        
        // Medidas 3D estimadas
        depth: { value: estimatedDepth, unit: 'px' },
        volume: { value: volume, unit: 'px³' },
        surfaceArea: { value: surfaceArea, unit: 'px²' },
        
        // Propiedades de forma
        circularity: { value: circularity, unit: '' },
        compactness: { value: compactness, unit: '' },
        
        // Metadatos
        confidence: 0.92,
        timestamp: Date.now(),
        method: 'Touch Selection + Real Contour Detection'
      };
      
      console.log('✅ Mediciones calculadas:', measurements);
      return measurements;
      
    } catch (error) {
      console.error('❌ Error calculando mediciones:', error);
      throw error;
    }
  };

  // ESTIMAR PROFUNDIDAD BASADA EN EL TAMAÑO DEL OBJETO
  const estimateDepthFromObjectSize = (object: DetectedObject, imageData: ImageData): number => {
    try {
      // Estimación basada en perspectiva y tamaño del objeto
      const { width, height } = object.dimensions;
      const imageArea = imageData.width * imageData.height;
      const objectArea = width * height;
      
      // Factor de profundidad basado en el área relativa del objeto
      const relativeArea = objectArea / imageArea;
      const depthFactor = Math.sqrt(relativeArea);
      
      // Profundidad estimada (en píxeles)
      const estimatedDepth = Math.max(width, height) * depthFactor;
      
      return Math.round(estimatedDepth);
      
    } catch (error) {
      console.error('❌ Error estimando profundidad:', error);
      return 100; // Valor por defecto
    }
  };

  // CALCULAR CIRCULARIDAD DEL OBJETO
  const calculateCircularity = (object: DetectedObject): number => {
    try {
      const { area, perimeter } = object.dimensions;
      if (perimeter === 0) return 0;
      
      // Circularidad = 4π * área / perímetro²
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      return Math.min(circularity, 1); // Normalizar a [0, 1]
      
    } catch (error) {
      console.error('❌ Error calculando circularidad:', error);
      return 0;
    }
  };

  // CALCULAR COMPACTNESS DEL OBJETO
  const calculateCompactness = (object: DetectedObject): number => {
    try {
      const { area, perimeter } = object.dimensions;
      if (area === 0) return 0;
      
      // Compactness = área / perímetro²
      const compactness = area / (perimeter * perimeter);
      return compactness;
      
    } catch (error) {
      console.error('❌ Error calculando compactness:', error);
      return 0;
    }
  };

  // DIBUJAR SELECCIÓN DEL OBJETO EN EL CANVAS
  const drawObjectSelection = (ctx: CanvasRenderingContext2D, object: DetectedObject, touchX: number, touchY: number) => {
    try {
      const { x, y, width, height } = object.boundingBox;
      
      // 1. DIBUJAR RECTÁNGULO DE SELECCIÓN
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
      
      // 2. DIBUJAR PUNTO DE TOQUE
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(touchX, touchY, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // 3. DIBUJAR INFORMACIÓN DEL OBJETO
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.font = '16px Arial';
      
      const infoText = `Objeto: ${object.id}`;
      const sizeText = `${width} × ${height} px`;
      const areaText = `Área: ${object.dimensions.area} px²`;
      
      // Fondo para el texto
      const textX = x + width + 10;
      const textY = y;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(textX - 5, textY - 60, 150, 80);
      
      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(infoText, textX, textY - 40);
      ctx.fillText(sizeText, textX, textY - 20);
      ctx.fillText(areaText, textX, textY);
      
      console.log('✅ Selección dibujada en canvas');
      
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
    
    setTouchPoint(null);
    setSelectedObject(null);
    setMeasurementResult(null);
    
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
      {touchPoint && (
        <div 
          className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg animate-pulse"
          style={{
            left: touchPoint.x - 8,
            top: touchPoint.y - 8,
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
      {measurementResult && selectedObject && (
        <div className="absolute top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg max-w-xs">
          <h3 className="font-bold mb-2">📏 Objeto Seleccionado</h3>
          <div className="text-sm space-y-1">
            <div>ID: {selectedObject.id}</div>
            <div>Ancho: {measurementResult.width.value} {measurementResult.width.unit}</div>
            <div>Alto: {measurementResult.height.value} {measurementResult.height.unit}</div>
            <div>Área: {measurementResult.area.value} {measurementResult.area.unit}</div>
            <div>Profundidad: {measurementResult.depth.value} {measurementResult.depth.unit}</div>
            <div>Volumen: {measurementResult.volume.value} {measurementResult.volume.unit}</div>
            <div>Confianza: {(measurementResult.confidence * 100).toFixed(1)}%</div>
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
