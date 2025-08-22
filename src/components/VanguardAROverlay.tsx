/**
 * OVERLAY DE REALIDAD AUMENTADA PROFESIONAL
 * UI de vanguardia con visualización 3D y mediciones precisas
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { VanguardObject, Dimensions3D } from '@/lib/ai/VanguardDetectionSystem';

interface VanguardAROverlayProps {
  object: VanguardObject | null;
  width: number;
  height: number;
  confidence: number;
  processingTime: number;
  depthEnabled: boolean;
  calibrationConfidence: number;
}

export const VanguardAROverlay: React.FC<VanguardAROverlayProps> = ({
  object,
  width,
  height,
  confidence,
  processingTime,
  depthEnabled,
  calibrationConfidence
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  // Colores de tema profesional
  const colors = {
    primary: '#00ff88',
    secondary: '#00ccff',
    accent: '#ff00ff',
    warning: '#ffaa00',
    success: '#00ff00',
    danger: '#ff0044',
    text: '#ffffff',
    background: 'rgba(0, 0, 0, 0.8)',
    glass: 'rgba(255, 255, 255, 0.1)'
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas de alta resolución
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Función de animación principal
    const animate = (timestamp: number) => {
      timeRef.current = timestamp;
      
      // Limpiar canvas
      ctx.clearRect(0, 0, width, height);

      // Dibujar UI de vanguardia
      drawVanguardUI(ctx, timestamp);

      // Si hay objeto detectado, dibujar visualización AR
      if (object) {
        drawARVisualization(ctx, object, timestamp);
        draw3DMeasurements(ctx, object, timestamp);
        drawObjectInfo(ctx, object);
      } else {
        drawScanningMode(ctx, timestamp);
      }

      // Dibujar HUD
      drawHUD(ctx, timestamp);

      animationRef.current = requestAnimationFrame(animate);
    };

    // Dibujar UI de vanguardia
    const drawVanguardUI = (ctx: CanvasRenderingContext2D, time: number) => {
      // Efecto de escaneo futurista
      const scanY = (time / 20) % height;
      const gradient = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
      gradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, scanY - 50, width, 100);

      // Bordes con efecto de respiración
      const breathe = Math.sin(time / 1000) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(0, 255, 136, ${breathe * 0.5})`;
      ctx.lineWidth = 2;
      
      // Esquinas mejoradas
      const cornerSize = 30;
      const corners = [
        { x: 20, y: 20 },
        { x: width - 20, y: 20 },
        { x: 20, y: height - 20 },
        { x: width - 20, y: height - 20 }
      ];

      corners.forEach((corner, index) => {
        ctx.save();
        ctx.translate(corner.x, corner.y);
        ctx.rotate((index * Math.PI) / 2);
        
        // Líneas de esquina
        ctx.beginPath();
        ctx.moveTo(-cornerSize, 0);
        ctx.lineTo(0, 0);
        ctx.lineTo(0, -cornerSize);
        ctx.stroke();
        
        // Punto de anclaje
        ctx.fillStyle = colors.primary;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });

      // Retícula central
      ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(width / 2, 10);
      ctx.lineTo(width / 2, height - 10);
      ctx.moveTo(10, height / 2);
      ctx.lineTo(width - 10, height / 2);
      ctx.stroke();
      
      ctx.setLineDash([]);
    };

    // Visualización AR del objeto
    const drawARVisualization = (
      ctx: CanvasRenderingContext2D,
      obj: VanguardObject,
      time: number
    ) => {
      const { boundingBox } = obj;
      const pulse = Math.sin(time / 200) * 0.1 + 0.9;
      
      // Efecto de holograma 3D
      ctx.save();
      
      // Sombra de profundidad
      if (depthEnabled) {
        const depthOffset = boundingBox.z / 100;
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = depthOffset;
        ctx.shadowOffsetY = depthOffset;
      }

      // Caja 3D con perspectiva
      const depth3D = Math.min(50, boundingBox.depth / 10);
      
      // Cara frontal
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 3;
      ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
      
      // Caras laterales (efecto 3D)
      ctx.strokeStyle = `rgba(0, 255, 136, 0.6)`;
      ctx.lineWidth = 2;
      
      // Líneas de profundidad
      const corners3D = [
        { x: boundingBox.x, y: boundingBox.y },
        { x: boundingBox.x + boundingBox.width, y: boundingBox.y },
        { x: boundingBox.x + boundingBox.width, y: boundingBox.y + boundingBox.height },
        { x: boundingBox.x, y: boundingBox.y + boundingBox.height }
      ];

      corners3D.forEach(corner => {
        ctx.beginPath();
        ctx.moveTo(corner.x, corner.y);
        ctx.lineTo(corner.x + depth3D, corner.y - depth3D);
        ctx.stroke();
      });

      // Cara trasera
      ctx.strokeRect(
        boundingBox.x + depth3D,
        boundingBox.y - depth3D,
        boundingBox.width,
        boundingBox.height
      );

      // Puntos clave 3D animados
      obj.keypoints.forEach((kp, index) => {
        const offsetTime = time + index * 100;
        const kpPulse = Math.sin(offsetTime / 300) * 0.3 + 0.7;
        
        // Proyectar punto 3D a 2D
        const projX = boundingBox.x + (kp.x / 1000) * boundingBox.width;
        const projY = boundingBox.y + (kp.y / 1000) * boundingBox.height;
        
        // Círculo con animación
        ctx.fillStyle = `rgba(0, 204, 255, ${kpPulse})`;
        ctx.beginPath();
        ctx.arc(projX, projY, 5 * kpPulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Etiqueta
        ctx.fillStyle = colors.text;
        ctx.font = '10px monospace';
        ctx.fillText(kp.name, projX + 8, projY - 5);
      });

      ctx.restore();

      // Líneas de medición animadas
      drawMeasurementLines(ctx, boundingBox, time);
    };

    // Líneas de medición con animación
    const drawMeasurementLines = (
      ctx: CanvasRenderingContext2D,
      bbox: any,
      time: number
    ) => {
      const offset = 20;
      const arrowSize = 8;
      
      ctx.strokeStyle = colors.secondary;
      ctx.fillStyle = colors.secondary;
      ctx.lineWidth = 2;

      // Medición horizontal
      ctx.beginPath();
      ctx.moveTo(bbox.x - offset, bbox.y + bbox.height / 2);
      ctx.lineTo(bbox.x + bbox.width + offset, bbox.y + bbox.height / 2);
      
      // Flechas
      ctx.moveTo(bbox.x - offset, bbox.y + bbox.height / 2);
      ctx.lineTo(bbox.x - offset + arrowSize, bbox.y + bbox.height / 2 - arrowSize/2);
      ctx.moveTo(bbox.x - offset, bbox.y + bbox.height / 2);
      ctx.lineTo(bbox.x - offset + arrowSize, bbox.y + bbox.height / 2 + arrowSize/2);
      
      ctx.moveTo(bbox.x + bbox.width + offset, bbox.y + bbox.height / 2);
      ctx.lineTo(bbox.x + bbox.width + offset - arrowSize, bbox.y + bbox.height / 2 - arrowSize/2);
      ctx.moveTo(bbox.x + bbox.width + offset, bbox.y + bbox.height / 2);
      ctx.lineTo(bbox.x + bbox.width + offset - arrowSize, bbox.y + bbox.height / 2 + arrowSize/2);
      
      ctx.stroke();

      // Medición vertical
      ctx.beginPath();
      ctx.moveTo(bbox.x + bbox.width / 2, bbox.y - offset);
      ctx.lineTo(bbox.x + bbox.width / 2, bbox.y + bbox.height + offset);
      
      // Flechas
      ctx.moveTo(bbox.x + bbox.width / 2, bbox.y - offset);
      ctx.lineTo(bbox.x + bbox.width / 2 - arrowSize/2, bbox.y - offset + arrowSize);
      ctx.moveTo(bbox.x + bbox.width / 2, bbox.y - offset);
      ctx.lineTo(bbox.x + bbox.width / 2 + arrowSize/2, bbox.y - offset + arrowSize);
      
      ctx.moveTo(bbox.x + bbox.width / 2, bbox.y + bbox.height + offset);
      ctx.lineTo(bbox.x + bbox.width / 2 - arrowSize/2, bbox.y + bbox.height + offset - arrowSize);
      ctx.moveTo(bbox.x + bbox.width / 2, bbox.y + bbox.height + offset);
      ctx.lineTo(bbox.x + bbox.width / 2 + arrowSize/2, bbox.y + bbox.height + offset - arrowSize);
      
      ctx.stroke();
    };

    // Mediciones 3D profesionales
    const draw3DMeasurements = (
      ctx: CanvasRenderingContext2D,
      obj: VanguardObject,
      time: number
    ) => {
      const dims = obj.dimensions;
      const bbox = obj.boundingBox;
      
      // Panel de mediciones flotante
      const panelX = bbox.x + bbox.width + 30;
      const panelY = bbox.y;
      const panelWidth = 200;
      const panelHeight = 180;
      
      // Fondo glassmorphism
      ctx.fillStyle = colors.glass;
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 1;
      
      roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 10);
      ctx.fill();
      ctx.stroke();
      
      // Título
      ctx.fillStyle = colors.primary;
      ctx.font = 'bold 14px Arial';
      ctx.fillText('MEDICIONES 3D', panelX + 10, panelY + 20);
      
      // Mediciones con iconos
      const measurements = [
        { icon: '📏', label: 'Ancho', value: `${dims.width.toFixed(1)} ${dims.unit}` },
        { icon: '📐', label: 'Alto', value: `${dims.height.toFixed(1)} ${dims.unit}` },
        { icon: '📦', label: 'Profundidad', value: `${dims.depth.toFixed(1)} ${dims.unit}` },
        { icon: '🎯', label: 'Volumen', value: `${dims.volume.toFixed(1)} ${dims.unit}³` },
        { icon: '🔲', label: 'Superficie', value: `${dims.surfaceArea.toFixed(1)} ${dims.unit}²` }
      ];
      
      measurements.forEach((m, i) => {
        const y = panelY + 45 + i * 25;
        
        // Icono
        ctx.font = '16px Arial';
        ctx.fillText(m.icon, panelX + 10, y);
        
        // Etiqueta
        ctx.fillStyle = colors.text;
        ctx.font = '12px Arial';
        ctx.fillText(m.label, panelX + 35, y);
        
        // Valor
        ctx.fillStyle = colors.secondary;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(m.value, panelX + panelWidth - 10, y);
        ctx.textAlign = 'left';
      });
      
      // Barra de precisión
      const accuracyY = panelY + panelHeight - 25;
      ctx.fillStyle = colors.text;
      ctx.font = '10px Arial';
      ctx.fillText('Precisión:', panelX + 10, accuracyY);
      
      // Barra de progreso
      const barX = panelX + 65;
      const barWidth = panelWidth - 80;
      const barHeight = 8;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      roundRect(ctx, barX, accuracyY - 8, barWidth, barHeight, 4);
      ctx.fill();
      
      ctx.fillStyle = getAccuracyColor(dims.accuracy);
      roundRect(ctx, barX, accuracyY - 8, barWidth * dims.accuracy, barHeight, 4);
      ctx.fill();
      
      ctx.fillStyle = colors.text;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${(dims.accuracy * 100).toFixed(0)}%`, panelX + panelWidth - 10, accuracyY);
      ctx.textAlign = 'left';
    };

    // Información del objeto con estilo
    const drawObjectInfo = (ctx: CanvasRenderingContext2D, obj: VanguardObject) => {
      const bbox = obj.boundingBox;
      
      // Etiqueta superior con glassmorphism
      const labelY = bbox.y - 35;
      const labelText = `${obj.label.toUpperCase()}`;
      
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(labelText).width;
      
      // Fondo de etiqueta
      ctx.fillStyle = colors.background;
      roundRect(ctx, bbox.x - 5, labelY - 20, textWidth + 40, 25, 5);
      ctx.fill();
      
      // Icono de IA
      ctx.fillStyle = colors.accent;
      ctx.font = '14px Arial';
      ctx.fillText('🤖', bbox.x, labelY - 5);
      
      // Texto de etiqueta
      ctx.fillStyle = colors.text;
      ctx.font = 'bold 16px Arial';
      ctx.fillText(labelText, bbox.x + 20, labelY - 5);
      
      // Badge de confianza
      const confX = bbox.x + textWidth + 25;
      const confColor = getConfidenceColor(obj.confidence);
      
      ctx.fillStyle = confColor;
      ctx.beginPath();
      ctx.arc(confX + 10, labelY - 10, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = colors.text;
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(obj.confidence * 100)}%`, confX + 10, labelY - 7);
      ctx.textAlign = 'left';
    };

    // Modo de escaneo cuando no hay objeto
    const drawScanningMode = (ctx: CanvasRenderingContext2D, time: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Animación de radar
      const radarAngle = (time / 1000) % (Math.PI * 2);
      const radarGradient = ctx.createConicGradient(radarAngle, centerX, centerY);
      radarGradient.addColorStop(0, 'rgba(0, 255, 136, 0)');
      radarGradient.addColorStop(0.1, 'rgba(0, 255, 136, 0.3)');
      radarGradient.addColorStop(0.3, 'rgba(0, 255, 136, 0)');
      
      ctx.fillStyle = radarGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
      ctx.fill();
      
      // Círculos concéntricos
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.lineWidth = 1;
      
      for (let r = 30; r <= 90; r += 30) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Texto de estado
      ctx.fillStyle = colors.text;
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ESCANEANDO...', centerX, centerY + 130);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Apunte a un objeto para medir', centerX, centerY + 150);
      ctx.textAlign = 'left';
    };

    // HUD (Heads-Up Display)
    const drawHUD = (ctx: CanvasRenderingContext2D, time: number) => {
      // Panel superior
      ctx.fillStyle = colors.glass;
      roundRect(ctx, 10, 10, 300, 60, 10);
      ctx.fill();
      
      // Estado del sistema
      ctx.fillStyle = colors.primary;
      ctx.font = 'bold 12px Arial';
      ctx.fillText('SISTEMA VANGUARD AI', 20, 30);
      
      // Indicadores
      const indicators = [
        { label: 'FPS', value: Math.round(1000 / processingTime), color: colors.success },
        { label: 'IA', value: confidence > 0 ? 'ACTIVA' : 'ESPERA', color: confidence > 0 ? colors.success : colors.warning },
        { label: '3D', value: depthEnabled ? 'ON' : 'OFF', color: depthEnabled ? colors.success : colors.danger }
      ];
      
      indicators.forEach((ind, i) => {
        const x = 20 + i * 80;
        ctx.fillStyle = colors.text;
        ctx.font = '10px Arial';
        ctx.fillText(ind.label, x, 50);
        
        ctx.fillStyle = ind.color;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(ind.value.toString(), x + 25, 50);
      });
      
      // Panel inferior derecho - Calibración
      const calX = width - 160;
      const calY = height - 80;
      
      ctx.fillStyle = colors.glass;
      roundRect(ctx, calX, calY, 150, 70, 10);
      ctx.fill();
      
      ctx.fillStyle = colors.text;
      ctx.font = '11px Arial';
      ctx.fillText('CALIBRACIÓN', calX + 10, calY + 20);
      
      // Indicador circular de calibración
      const calCenterX = calX + 120;
      const calCenterY = calY + 40;
      const calRadius = 20;
      
      // Fondo del círculo
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(calCenterX, calCenterY, calRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Progreso de calibración
      ctx.strokeStyle = getCalibrationColor(calibrationConfidence);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        calCenterX,
        calCenterY,
        calRadius,
        -Math.PI / 2,
        -Math.PI / 2 + (calibrationConfidence * Math.PI * 2),
        false
      );
      ctx.stroke();
      
      // Porcentaje
      ctx.fillStyle = colors.text;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(calibrationConfidence * 100)}%`, calCenterX, calCenterY + 4);
      ctx.textAlign = 'left';
    };

    // Funciones auxiliares
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

    const getConfidenceColor = (conf: number): string => {
      if (conf > 0.9) return colors.success;
      if (conf > 0.7) return colors.primary;
      if (conf > 0.5) return colors.warning;
      return colors.danger;
    };

    const getAccuracyColor = (acc: number): string => {
      if (acc > 0.9) return colors.success;
      if (acc > 0.7) return colors.secondary;
      if (acc > 0.5) return colors.warning;
      return colors.danger;
    };

    const getCalibrationColor = (cal: number): string => {
      if (cal > 0.8) return colors.success;
      if (cal > 0.6) return colors.primary;
      if (cal > 0.4) return colors.warning;
      return colors.danger;
    };

    // Iniciar animación
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [object, width, height, confidence, processingTime, depthEnabled, calibrationConfidence]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ 
        zIndex: 20,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}
    />
  );
};