
/**
 * Overlay AR Optimizado - NO obstaculiza la visión del objeto
 * Renderizado inteligente con oclusión mínima y máxima efectividad
 * Conectado directamente al pipeline de datos nativo
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { 
  Line, Circle, Rect, Text as SvgText, Defs, Marker, Path, G,
  LinearGradient, Stop, Filter, FeDropShadow, ClipPath
} from 'react-native-svg';
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

  // Renderizado de elementos AR individuales
  const renderARElement = useCallback((element: ARElement, obj?: DetectedObject) => {
    const opacity = element.visibility;
    
    switch (element.type) {
      case 'center':
        return (
          <G key={element.id} opacity={opacity}>
            <Circle
              cx={element.position.x}
              cy={element.position.y}
              r="3"
              fill="hsl(var(--measurement-active))"
              filter="url(#glow)"
            />
            <Circle
              cx={element.position.x}
              cy={element.position.y}
              r="8"
              stroke="hsl(var(--measurement-active))"
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
          </G>
        );
        
      case 'measurement':
        if (!obj?.dimensions) return null;
        return (
          <G key={element.id} opacity={opacity}>
            <Rect
              x={element.position.x}
              y={element.position.y}
              width="80"
              height="30"
              fill="hsla(var(--background), 0.9)"
              stroke="hsl(var(--measurement-active))"
              strokeWidth="1"
              rx="4"
              filter="url(#dropShadow)"
            />
            <SvgText
              x={element.position.x + 40}
              y={element.position.y + 15}
              fontSize="11"
              fill="hsl(var(--foreground))"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {obj.dimensions.width.toFixed(1)}×{obj.dimensions.height.toFixed(1)}
            </SvgText>
            <SvgText
              x={element.position.x + 40}
              y={element.position.y + 25}
              fontSize="9"
              fill="hsl(var(--muted-foreground))"
              textAnchor="middle"
            >
              {obj.dimensions.unit}
            </SvgText>
          </G>
        );
        
      case 'boundary':
        if (!obj) return null;
        const isSelected = selectedObjectId === obj.id;
        return (
          <G key={element.id} opacity={opacity}>
            <Rect
              x={obj.boundingBox.x}
              y={obj.boundingBox.y}
              width={obj.boundingBox.width}
              height={obj.boundingBox.height}
              stroke={isSelected ? "hsl(var(--measurement-active))" : "hsl(var(--primary))"}
              strokeWidth={isSelected ? "2" : "1"}
              fill="none"
              strokeDasharray={isSelected ? "none" : "4,2"}
              rx="2"
            />
          </G>
        );
        
      case 'label':
        if (!obj) return null;
        return (
          <G key={element.id} opacity={opacity * 0.9}>
            <Rect
              x={element.position.x}
              y={element.position.y}
              width="100"
              height="20"
              fill="hsla(var(--background), 0.95)"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
              rx="10"
              filter="url(#dropShadow)"
            />
            <SvgText
              x={element.position.x + 50}
              y={element.position.y + 13}
              fontSize="10"
              fill="hsl(var(--foreground))"
              textAnchor="middle"
            >
              {obj.type} ({(obj.confidence * 100).toFixed(0)}%)
            </SvgText>
          </G>
        );
        
      default:
        return null;
    }
  }, [selectedObjectId]);

  // Renderizado principal optimizado
  const renderedElements = useMemo(() => {
    if (!processingResult || !isVisible) return [];
    
    const objectsById = new Map(processingResult.detectedObjects.map(obj => [obj.id, obj]));
    
    return arElements.map(element => {
      const objectId = element.id.split('-')[1];
      const obj = objectsById.get(objectId);
      return renderARElement(element, obj);
    });
  }, [arElements, processingResult, isVisible, renderARElement]);

  if (!isVisible || !processingResult) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Svg
        width={screenWidth}
        height={screenHeight}
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          {/* Efectos visuales optimizados */}
          <Filter id="dropShadow">
            <FeDropShadow dx="1" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
          </Filter>
          <Filter id="glow">
            <FeDropShadow dx="0" dy="0" stdDeviation="3" floodColor="hsl(var(--measurement-active))" floodOpacity="0.6" />
          </Filter>
        </Defs>

        {/* Elementos AR renderizados */}
        {renderedElements}

        {/* Indicador de estado del sistema (esquina) */}
        <G opacity="0.8">
          <Circle
            cx={screenWidth - 30}
            cy={30}
            r="8"
            fill={processingResult.confidence > 0.8 ? "hsl(var(--measurement-active))" : "hsl(var(--destructive))"}
          />
          <SvgText
            x={screenWidth - 30}
            y={48}
            fontSize="8"
            fill="hsl(var(--foreground))"
            textAnchor="middle"
          >
            {Math.round(frameRate)}fps
          </SvgText>
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
