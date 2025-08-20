// HOOK PARA COORDINACIÓN DE MEDICIÓN AUTOMÁTICA
import { useEffect, useRef, useState, useCallback } from 'react';
import { SilhouetteDetector, DetectedSilhouette } from '@/lib/silhouetteDetector';
import { AutomaticMeasurementSystem, AutomaticMeasurement } from '@/lib/automaticMeasurement';

interface UseAutomaticMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  onMeasurementUpdate: (measurement: AutomaticMeasurement) => void;
  onSilhouetteDetected: (silhouette: DetectedSilhouette) => void;
  onError: (error: string) => void;
}

interface MeasurementState {
  isProcessing: boolean;
  currentMeasurement: AutomaticMeasurement | null;
  frameCount: number;
  fps: number;
  successRate: number;
  lastProcessingTime: number;
}

export const useAutomaticMeasurement = ({
  videoRef,
  overlayCanvasRef,
  isActive,
  onMeasurementUpdate,
  onSilhouetteDetected,
  onError
}: UseAutomaticMeasurementProps) => {
  
  // INSTANCIAS DE DETECTORES Y MEDIDORES
  const silhouetteDetector = useRef<SilhouetteDetector>(new SilhouetteDetector());
  const measurementSystem = useRef<AutomaticMeasurementSystem>(new AutomaticMeasurementSystem());
  
  // ESTADO DEL SISTEMA
  const [state, setState] = useState<MeasurementState>({
    isProcessing: false,
    currentMeasurement: null,
    frameCount: 0,
    fps: 0,
    successRate: 0,
    lastProcessingTime: 0
  });
  
  // REFERENCIAS PARA CONTROL DE TIMING
  const processingInterval = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTime = useRef<number>(0);
  const successCount = useRef<number>(0);
  const totalAttempts = useRef<number>(0);
  
  // PROCESAMIENTO PRINCIPAL - DETECCIÓN Y MEDICIÓN AUTOMÁTICA
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !overlayCanvasRef.current || !isActive || state.isProcessing) {
      return;
    }
    
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      const startTime = performance.now();
      
      console.log(`🎯 PROCESANDO FRAME AUTOMÁTICO #${state.frameCount + 1}`);
      
      // 1. CAPTURAR FRAME DEL VIDEO
      const imageData = await captureVideoFrame();
      if (!imageData) {
        throw new Error('No se pudo capturar frame del video');
      }
      
      // 2. DETECTAR SILUETA PRECISA
      const silhouette = await silhouetteDetector.current.detectCentralSilhouette(imageData);
      
      if (!silhouette || !silhouette.isValid) {
        console.log('❌ No se detectó silueta válida');
        totalAttempts.current++;
        return;
      }
      
      console.log(`✅ SILUETA DETECTADA: ${silhouette.contours.length} puntos, área: ${Math.round(silhouette.area)}`);
      
      // 3. PROCESAR MEDICIONES AUTOMÁTICAS
      const measurement = await measurementSystem.current.processAndMeasure(
        silhouette, 
        state.frameCount + 1
      );
      
      if (!measurement.isValid) {
        console.log('❌ Medición no válida');
        totalAttempts.current++;
        return;
      }
      
      // 4. DIBUJAR SILUETA EN OVERLAY
      drawSilhouetteOverlay(silhouette, measurement);
      
      // 5. ACTUALIZAR ESTADO Y NOTIFICAR
      const processingTime = performance.now() - startTime;
      successCount.current++;
      totalAttempts.current++;
      
      const newSuccessRate = totalAttempts.current > 0 ? successCount.current / totalAttempts.current : 0;
      
      setState(prev => ({
        ...prev,
        currentMeasurement: measurement,
        frameCount: prev.frameCount + 1,
        successRate: newSuccessRate,
        lastProcessingTime: processingTime
      }));
      
      onMeasurementUpdate(measurement);
      onSilhouetteDetected(silhouette);
      
      console.log(`✅ MEDICIÓN AUTOMÁTICA COMPLETADA en ${processingTime.toFixed(1)}ms`);
      
    } catch (error) {
      console.error('❌ Error en procesamiento automático:', error);
      totalAttempts.current++;
      onError(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [videoRef, overlayCanvasRef, isActive, state.isProcessing, state.frameCount, onMeasurementUpdate, onSilhouetteDetected, onError]);

  // CAPTURAR FRAME DEL VIDEO
  const captureVideoFrame = useCallback(async (): Promise<ImageData | null> => {
    if (!videoRef.current || !overlayCanvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.readyState !== 4) return null;
    
    // Configurar canvas con el tamaño del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dibujar frame actual
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Extraer datos de imagen
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [videoRef, overlayCanvasRef]);

  // DIBUJAR SILUETA EN OVERLAY
  const drawSilhouetteOverlay = useCallback((silhouette: DetectedSilhouette, measurement: AutomaticMeasurement) => {
    if (!overlayCanvasRef.current) return;
    
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar canvas (mantener el frame del video)
    // No limpiar completamente, solo preparar para dibujar overlay
    
    // CONFIGURAR ESTILO DE DIBUJO
    const confidenceLevel = measurement.confidence;
    const color = confidenceLevel > 0.8 ? '#00ff00' : confidenceLevel > 0.6 ? '#ffaa00' : '#ff6600';
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    
    // DIBUJAR CONTORNO PRECISO DE LA SILUETA
    if (silhouette.contours.length > 2) {
      ctx.beginPath();
      ctx.moveTo(silhouette.contours[0].x, silhouette.contours[0].y);
      
      for (let i = 1; i < silhouette.contours.length; i++) {
        const point = silhouette.contours[i];
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.closePath();
      ctx.stroke();
      
      // Rellenar con transparencia
      ctx.fillStyle = color + '20';
      ctx.fill();
    }
    
    // DIBUJAR INFORMACIÓN DE MEDICIÓN
    ctx.shadowBlur = 0; // Reset shadow para texto
    drawMeasurementInfo(ctx, measurement, silhouette);
    
  }, [overlayCanvasRef]);

  // DIBUJAR INFORMACIÓN DE MEDICIÓN EN PANTALLA
  const drawMeasurementInfo = useCallback((ctx: CanvasRenderingContext2D, measurement: AutomaticMeasurement, silhouette: DetectedSilhouette) => {
    const x = 20;
    const y = 30;
    const lineHeight = 25;
    
    // Fondo semi-transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x - 10, y - 20, 350, 180);
    
    // Texto de información
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 16px Arial';
    
    let currentY = y;
    
    // Información principal
    ctx.fillText(`ÁREA: ${Math.round(measurement.area)} px²`, x, currentY);
    currentY += lineHeight;
    
    ctx.fillText(`PERÍMETRO: ${Math.round(measurement.perimeter)} px`, x, currentY);
    currentY += lineHeight;
    
    ctx.fillText(`DIMENSIONES: ${Math.round(measurement.width)} × ${Math.round(measurement.height)}`, x, currentY);
    currentY += lineHeight;
    
    // Propiedades geométricas
    ctx.fillStyle = '#ffaa00';
    ctx.font = '14px Arial';
    
    ctx.fillText(`Circularidad: ${measurement.circularity.toFixed(2)}`, x, currentY);
    currentY += lineHeight;
    
    ctx.fillText(`Convexidad: ${measurement.convexity.toFixed(2)}`, x, currentY);
    currentY += lineHeight;
    
    // Métricas de calidad
    ctx.fillStyle = measurement.confidence > 0.8 ? '#00ff00' : measurement.confidence > 0.6 ? '#ffaa00' : '#ff6600';
    ctx.font = 'bold 14px Arial';
    
    ctx.fillText(`CONFIANZA: ${(measurement.confidence * 100).toFixed(1)}%`, x, currentY);
    currentY += lineHeight;
    
    ctx.fillText(`ESTABILIDAD: ${(measurement.stability * 100).toFixed(1)}%`, x, currentY);
    
  }, []);

  // CALCULAR FPS
  const updateFPS = useCallback(() => {
    const currentTime = performance.now();
    if (lastFrameTime.current > 0) {
      const frameTime = currentTime - lastFrameTime.current;
      const fps = Math.round(1000 / frameTime);
      setState(prev => ({ ...prev, fps }));
    }
    lastFrameTime.current = currentTime;
  }, []);

  // INICIAR/DETENER PROCESAMIENTO AUTOMÁTICO
  useEffect(() => {
    if (!isActive) {
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
        processingInterval.current = null;
      }
      return;
    }
    
    console.log('🚀 INICIANDO MEDICIÓN AUTOMÁTICA DE SILUETAS');
    
    // Procesar cada 2 segundos para rendimiento óptimo
    processingInterval.current = setInterval(() => {
      processFrame();
      updateFPS();
    }, 2000);
    
    return () => {
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
        processingInterval.current = null;
      }
    };
  }, [isActive, processFrame, updateFPS]);

  // OBTENER ESTADÍSTICAS DEL SISTEMA
  const getStatistics = useCallback(() => {
    const historyStats = measurementSystem.current.getHistoryStatistics();
    
    return {
      ...state,
      totalAttempts: totalAttempts.current,
      successCount: successCount.current,
      historyStatistics: historyStats
    };
  }, [state]);

  // LIMPIAR HISTORIAL
  const clearHistory = useCallback(() => {
    measurementSystem.current.clearHistory();
    successCount.current = 0;
    totalAttempts.current = 0;
    setState(prev => ({ 
      ...prev, 
      frameCount: 0, 
      successRate: 0,
      currentMeasurement: null 
    }));
  }, []);

  return {
    // Estado actual
    isProcessing: state.isProcessing,
    currentMeasurement: state.currentMeasurement,
    frameCount: state.frameCount,
    fps: state.fps,
    successRate: state.successRate,
    lastProcessingTime: state.lastProcessingTime,
    
    // Métodos de control
    getStatistics,
    clearHistory,
    
    // Método manual de procesamiento
    processFrame
  };
};