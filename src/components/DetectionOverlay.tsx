// COMPONENTE DE OVERLAY DE DETECCIÓN
// Visualiza objetos detectados y seleccionados en el canvas

import React, { useEffect, useRef } from 'react';

export interface DetectionOverlayProps {
  detectedObjects: any[];
  selectedObject: any;
  isAutoMode: boolean;
  isManualMode: boolean;
  overlayCanvas: HTMLCanvasElement | null;
}

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  detectedObjects,
  selectedObject,
  isAutoMode,
  isManualMode,
  overlayCanvas
}) => {
  const animationRef = useRef<number>();

  // DIBUJAR OVERLAY EN EL CANVAS
  useEffect(() => {
    if (!overlayCanvas) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Dibujar objetos detectados
    detectedObjects.forEach((obj, index) => {
      const isSelected = selectedObject?.id === obj.id;
      drawObjectOverlay(ctx, obj, isSelected, index);
    });

    // Animación continua para efectos visuales
    const animate = () => {
      if (overlayCanvas) {
        // Redibujar para efectos de animación
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        detectedObjects.forEach((obj, index) => {
          const isSelected = selectedObject?.id === obj.id;
          drawObjectOverlay(ctx, obj, isSelected, index);
        });
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    if (detectedObjects.length > 0) {
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [detectedObjects, selectedObject, overlayCanvas]);

  // FUNCIÓN PARA DIBUJAR OVERLAY DE OBJETO
  const drawObjectOverlay = (
    ctx: CanvasRenderingContext2D,
    obj: any,
    isSelected: boolean,
    index: number
  ) => {
    try {
      const { boundingBox, center, confidence, area } = obj;
      
      // Configurar estilos según selección
      if (isSelected) {
        ctx.strokeStyle = '#00ff00'; // Verde para objeto seleccionado
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      } else {
        ctx.strokeStyle = '#ff6b6b'; // Rojo para objetos detectados
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
      }

      // Dibujar rectángulo de bounding box
      ctx.fillRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
      ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);

      // Dibujar centro del objeto
      ctx.fillStyle = isSelected ? '#00ff00' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(center.x, center.y, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Dibujar etiqueta de información
      drawObjectLabel(ctx, obj, isSelected, index);

      // Dibujar indicador de confianza
      drawConfidenceIndicator(ctx, obj, boundingBox);

    } catch (error) {
      console.error('Error dibujando overlay de objeto:', error);
    }
  };

  // FUNCIÓN PARA DIBUJAR ETIQUETA DE OBJETO
  const drawObjectLabel = (
    ctx: CanvasRenderingContext2D,
    obj: any,
    isSelected: boolean,
    index: number
  ) => {
    try {
      const { boundingBox, area, confidence } = obj;
      
      // Configurar texto
      ctx.font = '12px Arial';
      ctx.fillStyle = isSelected ? '#00ff00' : '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      // Información del objeto
      const label = `Obj ${index + 1} | ${Math.round(area)}px² | ${(confidence * 100).toFixed(0)}%`;
      
      // Posición de la etiqueta
      const labelX = boundingBox.x;
      const labelY = boundingBox.y - 10;
      
      // Fondo para la etiqueta
      const textMetrics = ctx.measureText(label);
      const padding = 4;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        labelX - padding,
        labelY - textMetrics.actualBoundingBoxAscent - padding,
        textMetrics.width + padding * 2,
        textMetrics.actualBoundingBoxAscent + padding * 2
      );

      // Dibujar texto
      ctx.strokeText(label, labelX, labelY);
      ctx.fillText(label, labelX, labelY);

    } catch (error) {
      console.error('Error dibujando etiqueta de objeto:', error);
    }
  };

  // FUNCIÓN PARA DIBUJAR INDICADOR DE CONFIANZA
  const drawConfidenceIndicator = (
    ctx: CanvasRenderingContext2D,
    obj: any,
    boundingBox: any
  ) => {
    try {
      const { confidence } = obj;
      
      // Barra de confianza en la esquina superior derecha
      const barWidth = 30;
      const barHeight = 4;
      const barX = boundingBox.x + boundingBox.width - barWidth - 5;
      const barY = boundingBox.y + 5;

      // Fondo de la barra
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Color de la barra según confianza
      let barColor = '#ff0000'; // Rojo
      if (confidence >= 0.8) {
        barColor = '#00ff00'; // Verde
      } else if (confidence >= 0.6) {
        barColor = '#ffff00'; // Amarillo
      }

      // Llenar barra de confianza
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barWidth * confidence, barHeight);

      // Borde de la barra
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

    } catch (error) {
      console.error('Error dibujando indicador de confianza:', error);
    }
  };

  // COMPONENTE NO RENDERIZA NADA VISIBLE
  // Solo maneja el canvas overlay
  return null;
};

export default DetectionOverlay;
