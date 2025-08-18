
/**
 * Overlay AR Optimizado - NO obstaculiza la visión del objeto
 * Renderizado inteligente con oclusión mínima y máxima efectividad
 * Conectado directamente al pipeline de datos nativo
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { NativeDataPipeline, type DetectedObject, type ProcessingResult } from '@/lib/NativeDataPipeline';

interface OptimizedAROverlayProps {
  screenWidth: number;
  screenHeight: number;
  isVisible: boolean;
  selectedObjectId?: string;
  onObjectSelect?: (objectId: string) => void;
  overlayMode: 'minimal' | 'detailed' | 'professional';
}

interface ARElement {
  id: string;
  type: 'measurement' | 'label' | 'boundary' | 'center';
  position: { x: number; y: number };
  visibility: number; // 0-1, para fadeIn/fadeOut inteligente
  priority: number; // Para LOD (Level of Detail)
}

export const OptimizedAROverlay: React.FC<OptimizedAROverlayProps> = ({
  screenWidth,
  screenHeight,
  isVisible,
  selectedObjectId,
  onObjectSelect,
  overlayMode = 'professional'
}) => {
  // Estados para datos procesados
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [arElements, setARElements] = useState<ARElement[]>([]);
  const [frameRate, setFrameRate] = useState(60); // Adaptativo según rendimiento
  
  // Referencias para optimización
  const pipeline = useRef(NativeDataPipeline.getInstance());
  const renderCache = useRef(new Map<string, any>());
  const lastRenderTime = useRef(Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Configuración de overlay según modo
  const overlayConfig = useMemo(() => {
    switch (overlayMode) {
      case 'minimal':
        return {
          showBoundingBoxes: false,
          showMeasurements: true,
          showLabels: false,
          showCenterPoints: true,
          maxElements: 3,
          opacity: 0.7,
          fadeDistance: 50 // píxeles desde el objeto
        };
      case 'detailed':
        return {
          showBoundingBoxes: true,
          showMeasurements: true,
          showLabels: true,
          showCenterPoints: true,
          maxElements: 10,
          opacity: 0.8,
          fadeDistance: 30
        };
      case 'professional':
        return {
          showBoundingBoxes: true,
          showMeasurements: true,
          showLabels: true,
          showCenterPoints: true,
          maxElements: 20,
          opacity: 0.9,
          fadeDistance: 20
        };
    }
  }, [overlayMode]);

  // Inicialización del pipeline
  useEffect(() => {
    if (!isVisible) return;

    const initializePipeline = async () => {
      console.log('[AR Overlay] Conectando al pipeline nativo...');
      
      // Registrar callbacks para datos procesados
      pipeline.current.registerCallback('processingComplete', (result: ProcessingResult) => {
        setProcessingResult(result);
        updateARElements(result);
      });

      // Iniciar procesamiento si no está activo
      await pipeline.current.startProcessing();
    };

    initializePipeline();

    return () => {
      pipeline.current.unregisterCallback('processingComplete');
    };
  }, [isVisible]);

  // Actualización inteligente de elementos AR
  const updateARElements = useCallback((result: ProcessingResult) => {
    const newElements: ARElement[] = [];
    const currentTime = Date.now();
    
    result.detectedObjects.forEach((obj, index) => {
      const isSelected = selectedObjectId === obj.id;
      const priority = obj.confidence * (isSelected ? 2 : 1);
      
      // Calcular posiciones no intrusivas
      const positions = calculateNonIntrusivePositions(obj, overlayConfig.fadeDistance);
      
      // Centro del objeto (siempre visible si es prioritario)
      if (overlayConfig.showCenterPoints && priority > 0.6) {
        newElements.push({
          id: `center-${obj.id}`,
          type: 'center',
          position: { 
            x: obj.boundingBox.x + obj.boundingBox.width / 2,
            y: obj.boundingBox.y + obj.boundingBox.height / 2
          },
          visibility: calculateVisibility(obj, overlayConfig),
          priority
        });
      }

      // Mediciones (posicionadas inteligentemente)
      if (overlayConfig.showMeasurements && obj.dimensions) {
        newElements.push({
          id: `measurement-${obj.id}`,
          type: 'measurement',
          position: positions.measurementPosition,
          visibility: calculateVisibility(obj, overlayConfig),
          priority: priority * 0.9
        });
      }

      // Etiquetas flotantes (solo si hay espacio)
      if (overlayConfig.showLabels && positions.hasSpaceForLabel) {
        newElements.push({
          id: `label-${obj.id}`,
          type: 'label',
          position: positions.labelPosition,
          visibility: calculateVisibility(obj, overlayConfig) * 0.8,
          priority: priority * 0.7
        });
      }

      // Contornos (solo para objetos seleccionados)
      if (overlayConfig.showBoundingBoxes && isSelected) {
        newElements.push({
          id: `boundary-${obj.id}`,
          type: 'boundary',
          position: { x: obj.boundingBox.x, y: obj.boundingBox.y },
          visibility: 1.0,
          priority: priority * 1.2
        });
      }
    });

    // Aplicar LOD - mantener solo elementos de alta prioridad si hay muchos
    const sortedElements = newElements
      .sort((a, b) => b.priority - a.priority)
      .slice(0, overlayConfig.maxElements);

    setARElements(sortedElements);
    
    // Actualizar rate de renderizado según carga
    const renderTime = Date.now() - currentTime;
    adaptFrameRate(renderTime);
    
  }, [selectedObjectId, overlayConfig]);

  // Cálculo de posiciones no intrusivas
  const calculateNonIntrusivePositions = (obj: DetectedObject, fadeDistance: number) => {
    const bbox = obj.boundingBox;
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    // Buscar áreas libres alrededor del objeto
    const freeAreas = [
      { x: bbox.x - 120, y: bbox.y, priority: 3 }, // Izquierda
      { x: bbox.x + bbox.width + 20, y: bbox.y, priority: 2 }, // Derecha
      { x: centerX - 60, y: bbox.y - 60, priority: 4 }, // Arriba
      { x: centerX - 60, y: bbox.y + bbox.height + 20, priority: 1 } // Abajo
    ];

    // Seleccionar mejor posición basada en prioridad y espacio disponible
    const bestLabelArea = freeAreas
      .filter(area => isPositionValid(area, screenWidth, screenHeight))
      .sort((a, b) => b.priority - a.priority)[0];

    return {
      measurementPosition: { 
        x: bbox.x + bbox.width + 10, 
        y: centerY 
      },
      labelPosition: bestLabelArea || { x: centerX, y: bbox.y - 40 },
      hasSpaceForLabel: !!bestLabelArea
    };
  };

  // Validación de posición
  const isPositionValid = (pos: {x: number, y: number}, maxWidth: number, maxHeight: number): boolean => {
    return pos.x >= 10 && pos.y >= 10 && 
           pos.x <= maxWidth - 130 && pos.y <= maxHeight - 70;
  };

  // Cálculo de visibilidad basado en contexto
  const calculateVisibility = (obj: DetectedObject, config: any): number => {
    let visibility = config.opacity;
    
    // Reducir opacidad si el objeto es pequeño (evitar saturación visual)
    if (obj.boundingBox.width * obj.boundingBox.height < 10000) {
      visibility *= 0.8;
    }
    
    // Incrementar para objetos de alta confianza
    visibility *= (0.5 + obj.confidence * 0.5);
    
    return Math.min(visibility, 1.0);
  };

  // Adaptación inteligente de frame rate
  const adaptFrameRate = (renderTime: number) => {
    const targetFrameTime = 16.67; // 60 FPS
    
    if (renderTime > targetFrameTime * 1.5) {
      setFrameRate(prev => Math.max(30, prev - 5)); // Reducir a 30 FPS mínimo
    } else if (renderTime < targetFrameTime * 0.8) {
      setFrameRate(prev => Math.min(60, prev + 2)); // Incrementar hasta 60 FPS
    }
  };

  // Renderizado usando Canvas para mejor rendimiento
  useEffect(() => {
    if (!canvasRef.current || !isVisible || !processingResult) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    ctx.clearRect(0, 0, screenWidth, screenHeight);

    // Renderizar elementos AR
    arElements.forEach(element => {
      const objectId = element.id.split('-')[1];
      const obj = processingResult.detectedObjects.find(o => o.id === objectId);
      
      if (obj) {
        renderARElementCanvas(ctx, element, obj);
      }
    });

    // Indicador de sistema
    renderSystemIndicator(ctx);
  }, [arElements, processingResult, isVisible, frameRate]);

  const renderARElementCanvas = (ctx: CanvasRenderingContext2D, element: ARElement, obj: DetectedObject) => {
    const opacity = element.visibility;
    ctx.globalAlpha = opacity;
    
    switch (element.type) {
      case 'center':
        // Punto central
        ctx.fillStyle = '#3B82F6';
        ctx.beginPath();
        ctx.arc(element.position.x, element.position.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Anillo exterior
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(element.position.x, element.position.y, 12, 0, 2 * Math.PI);
        ctx.stroke();
        break;
        
      case 'measurement':
        if (obj.dimensions) {
          // Fondo de medición
          ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
          ctx.fillRect(element.position.x, element.position.y, 80, 30);
          
          // Texto de medición
          ctx.fillStyle = 'white';
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${obj.dimensions.width.toFixed(1)}×${obj.dimensions.height.toFixed(1)}`,
            element.position.x + 40,
            element.position.y + 18
          );
          ctx.font = '10px sans-serif';
          ctx.fillText(
            obj.dimensions.unit,
            element.position.x + 40,
            element.position.y + 28
          );
        }
        break;
        
      case 'boundary':
        // Caja delimitadora
        const isSelected = selectedObjectId === obj.id;
        ctx.strokeStyle = isSelected ? '#10B981' : '#3B82F6';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.setLineDash(isSelected ? [] : [8, 4]);
        ctx.strokeRect(obj.boundingBox.x, obj.boundingBox.y, obj.boundingBox.width, obj.boundingBox.height);
        ctx.setLineDash([]);
        break;
        
      case 'label':
        // Etiqueta flotante
        ctx.fillStyle = 'rgba(59, 130, 246, 0.95)';
        ctx.fillRect(element.position.x, element.position.y, 100, 40);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          obj.type.toUpperCase(),
          element.position.x + 8,
          element.position.y + 18
        );
        ctx.font = '10px sans-serif';
        ctx.fillText(
          `${(obj.confidence * 100).toFixed(0)}%`,
          element.position.x + 8,
          element.position.y + 32
        );
        break;
    }
    
    ctx.globalAlpha = 1.0;
  };

  const renderSystemIndicator = (ctx: CanvasRenderingContext2D) => {
    // Indicador de estado del sistema
    ctx.fillStyle = processingResult && processingResult.confidence > 0.8 ? '#10B981' : '#EF4444';
    ctx.beginPath();
    ctx.arc(screenWidth - 30, 30, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Texto de framerate
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.round(frameRate)}fps`,
      screenWidth - 30,
      50
    );
  };

  if (!isVisible || !processingResult) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={screenWidth}
      height={screenHeight}
      className="absolute inset-0 pointer-events-none"
      style={{ width: screenWidth, height: screenHeight }}
    />
  );
};
