import React, { useEffect, useRef } from 'react';
import { DetectedObject } from '@/lib/types';

interface EnhancedCameraOverlayProps {
  detectedObjects: DetectedObject[];
  width: number;
  height: number;
  isCalibrated: boolean;
  showDebugInfo?: boolean;
}

export const EnhancedCameraOverlay: React.FC<EnhancedCameraOverlayProps> = ({
  detectedObjects,
  width,
  height,
  isCalibrated,
  showDebugInfo = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas para alta resolución
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Función de animación
    const animate = (timestamp: number) => {
      timeRef.current = timestamp;
      
      // Limpiar canvas
      ctx.clearRect(0, 0, width, height);

      // Dibujar cada objeto detectado
      detectedObjects.forEach((obj, index) => {
        drawEnhancedSilhouette(ctx, obj, index, timestamp);
      });

      // Debug info si está habilitado
      if (showDebugInfo && detectedObjects.length > 0) {
        drawDebugInfo(ctx, detectedObjects);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Función para dibujar silueta mejorada
    const drawEnhancedSilhouette = (
      ctx: CanvasRenderingContext2D,
      obj: DetectedObject,
      index: number,
      timestamp: number
    ) => {
      const colors = [
        '#00ff41', // Verde neón
        '#ff6b35', // Naranja vibrante
        '#4ecdc4', // Turquesa
        '#45b7d1', // Azul cielo
        '#f9ca24', // Amarillo dorado
        '#ff00ff', // Magenta
        '#00ffff'  // Cian
      ];
      
      const color = colors[index % colors.length];
      const pulse = Math.sin(timestamp * 0.003) * 0.3 + 0.7; // Efecto pulsante

      // Configurar estilos
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 20 * pulse;

      // Dibujar contorno principal con efecto de brillo
      if (obj.contours && obj.contours.length > 0) {
        // Fondo semi-transparente
        ctx.fillStyle = color + '15';
        ctx.beginPath();
        ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
        
        for (let i = 1; i < obj.contours.length; i++) {
          ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
        }
        
        ctx.closePath();
        ctx.fill();

        // Contorno con múltiples pasadas para efecto neón
        for (let pass = 0; pass < 3; pass++) {
          ctx.globalAlpha = (3 - pass) / 3 * 0.8;
          ctx.lineWidth = (pass + 1) * 2;
          ctx.shadowBlur = (3 - pass) * 10 * pulse;
          
          ctx.beginPath();
          ctx.moveTo(obj.contours[0].x, obj.contours[0].y);
          
          for (let i = 1; i < obj.contours.length; i++) {
            ctx.lineTo(obj.contours[i].x, obj.contours[i].y);
          }
          
          ctx.closePath();
          ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
      }

      // Resetear sombra
      ctx.shadowBlur = 0;

      // Dibujar puntos de esquina animados
      if (obj.boundingBox) {
        const corners = [
          { x: obj.boundingBox.x, y: obj.boundingBox.y },
          { x: obj.boundingBox.x + obj.boundingBox.width, y: obj.boundingBox.y },
          { x: obj.boundingBox.x + obj.boundingBox.width, y: obj.boundingBox.y + obj.boundingBox.height },
          { x: obj.boundingBox.x, y: obj.boundingBox.y + obj.boundingBox.height }
        ];

        corners.forEach((corner, i) => {
          const offset = Math.sin(timestamp * 0.002 + i * Math.PI / 2) * 5;
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 5 + offset, 0, Math.PI * 2);
          ctx.fill();

          // Líneas de esquina
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
          
          const lineLength = 20;
          // Horizontal
          ctx.beginPath();
          ctx.moveTo(corner.x - lineLength * (i % 2 === 0 ? 1 : -1), corner.y);
          ctx.lineTo(corner.x, corner.y);
          ctx.stroke();
          
          // Vertical
          ctx.beginPath();
          ctx.moveTo(corner.x, corner.y - lineLength * (i < 2 ? 1 : -1));
          ctx.lineTo(corner.x, corner.y);
          ctx.stroke();
          
          ctx.globalAlpha = 1;
        });
      }

      // Etiqueta con información mejorada
      if (obj.boundingBox) {
        const labelX = obj.boundingBox.x;
        const labelY = Math.max(30, obj.boundingBox.y - 20);

        // Crear gradiente para el fondo
        const gradient = ctx.createLinearGradient(labelX, labelY - 20, labelX, labelY + 40);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');

        // Texto principal con dimensiones
        const mainText = `${obj.dimensions.width.toFixed(1)} × ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`;
        ctx.font = 'bold 14px system-ui';
        const mainMetrics = ctx.measureText(mainText);

        // Texto secundario con detalles
        const detailText = `${(obj.confidence * 100).toFixed(0)}% • ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}²`;
        ctx.font = '11px system-ui';
        const detailMetrics = ctx.measureText(detailText);

        const boxWidth = Math.max(mainMetrics.width, detailMetrics.width) + 20;
        const boxHeight = 45;

        // Dibujar caja con bordes redondeados
        ctx.fillStyle = gradient;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        roundRect(ctx, labelX - 5, labelY - 20, boxWidth, boxHeight, 5);
        ctx.fill();
        ctx.stroke();

        // Textos
        ctx.fillStyle = color;
        ctx.font = 'bold 14px system-ui';
        ctx.fillText(mainText, labelX + 5, labelY);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '11px system-ui';
        ctx.fillText(detailText, labelX + 5, labelY + 18);

        // Icono de objeto
        ctx.fillStyle = color;
        ctx.font = '16px system-ui';
        ctx.fillText('📦', labelX + boxWidth - 25, labelY);
      }

      // Centro del objeto con cruz animada
      if (obj.centerX !== undefined && obj.centerY !== undefined) {
        const rotation = timestamp * 0.001;
        
        ctx.save();
        ctx.translate(obj.centerX, obj.centerY);
        ctx.rotate(rotation);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        
        // Cruz central
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        
        // Círculo central
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // Líneas de medición visual
      if (obj.boundingBox && index === 0) { // Solo para el objeto principal
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([5, 5]);
        
        // Línea horizontal
        ctx.beginPath();
        ctx.moveTo(obj.boundingBox.x - 20, obj.boundingBox.y + obj.boundingBox.height / 2);
        ctx.lineTo(obj.boundingBox.x + obj.boundingBox.width + 20, obj.boundingBox.y + obj.boundingBox.height / 2);
        ctx.stroke();
        
        // Línea vertical
        ctx.beginPath();
        ctx.moveTo(obj.boundingBox.x + obj.boundingBox.width / 2, obj.boundingBox.y - 20);
        ctx.lineTo(obj.boundingBox.x + obj.boundingBox.width / 2, obj.boundingBox.y + obj.boundingBox.height + 20);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    };

    // Función para dibujar información de debug
    const drawDebugInfo = (ctx: CanvasRenderingContext2D, objects: DetectedObject[]) => {
      const debugInfo = [
        `Objetos detectados: ${objects.length}`,
        `Confianza promedio: ${(objects.reduce((sum, obj) => sum + obj.confidence, 0) / objects.length * 100).toFixed(1)}%`,
        `Calibrado: ${isCalibrated ? 'Sí' : 'No'}`,
        `FPS: ${(1000 / 16.67).toFixed(1)}` // Aproximado
      ];

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      roundRect(ctx, 10, height - 100, 250, 90, 5);
      ctx.fill();

      ctx.fillStyle = '#00ff41';
      ctx.font = '12px monospace';
      debugInfo.forEach((text, i) => {
        ctx.fillText(text, 20, height - 75 + i * 20);
      });
    };

    // Función helper para rectángulos redondeados
    const roundRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    // Iniciar animación
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [detectedObjects, width, height, isCalibrated, showDebugInfo]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};