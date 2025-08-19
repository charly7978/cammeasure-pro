// COMPONENTE PRINCIPAL DE CÁMARA REFACTORIZADO
// Arquitectura limpia y modular usando hooks especializados
// Responsabilidades separadas: UI, detección, mediciones

import React, { useState, useRef, useCallback, useEffect } from 'react';
import './CameraView.css';
import { useDetection, getOptimizedDetectionParams } from '@/hooks/useDetection';
import { useMeasurement, getOptimizedMeasurementConfig } from '@/hooks/useMeasurement';
import { useCalibration } from '@/hooks/useCalibration';
import { TouchObjectSelector } from './TouchObjectSelector';
import { MeasurementDisplay } from './MeasurementDisplay';
import { DetectionOverlay } from './DetectionOverlay';
import { CameraControls } from './CameraControls';

export interface CameraViewProps {
  className?: string;
}

export const CameraView: React.FC<CameraViewProps> = ({ className = '' }) => {
  // REFERENCIAS DE DOM
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // ESTADO DE LA CÁMARA
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(null);

  // ESTADO DE DETECCIÓN Y MEDICIONES
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any>(null);

  // HOOKS ESPECIALIZADOS
  const detectionParams = getOptimizedDetectionParams('natural');
  const measurementConfig = getOptimizedMeasurementConfig('precision_engineering');
  
  const {
    detectObjects,
    detectObjectAtPoint,
    isDetecting,
    confidence: detectionConfidence,
    error: detectionError,
    addFrameToBuffer
  } = useDetection(detectionParams);

  const {
    calculateMeasurements,
    isCalculating,
    currentMeasurements,
    error: measurementError
  } = useMeasurement(measurementConfig);

  const { calibration } = useCalibration();

  // INICIALIZAR CÁMARA
  const initializeCamera = useCallback(async () => {
    try {
      if (!videoRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      videoRef.current.srcObject = stream;
      setIsCameraActive(true);

      // Configurar canvas
      if (canvasRef.current && overlayCanvasRef.current) {
        canvasRef.current.width = 640;
        canvasRef.current.height = 480;
        overlayCanvasRef.current.width = 640;
        overlayCanvasRef.current.height = 480;
      }

    } catch (error) {
      console.error('Error inicializando cámara:', error);
    }
  }, []);

  // DETENER CÁMARA
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // PROCESAR FRAME AUTOMÁTICAMENTE
  const processFrameAutomatically = useCallback(async () => {
    if (!isAutoMode || !videoRef.current || !canvasRef.current || !overlayCanvasRef.current) {
      return;
    }

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dibujar frame actual en canvas
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Obtener datos de imagen
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCurrentImageData(imageData);
      addFrameToBuffer(imageData);

      // Detectar objetos automáticamente
      const objects = await detectObjects(imageData);
      setDetectedObjects(objects);

      // Si hay objetos detectados, medir el más importante
      if (objects.length > 0) {
        const mainObject = objects[0]; // Objeto con mayor confianza
        setSelectedObject(mainObject);
        
        const measurementResult = await calculateMeasurements(mainObject.contour, imageData);
        setMeasurements(measurementResult);
      }

    } catch (error) {
      console.error('Error en procesamiento automático:', error);
    }
  }, [isAutoMode, detectObjects, calculateMeasurements, addFrameToBuffer]);

  // MANEJAR SELECCIÓN MANUAL
  const handleManualSelection = useCallback(async (x: number, y: number) => {
    if (!currentImageData || !overlayCanvasRef.current) return;

    try {
      setIsManualMode(true);
      setIsAutoMode(false);

      // Detectar objetos cerca del punto tocado
      const nearbyObjects = await detectObjectAtPoint(currentImageData, x, y, 100);
      
      if (nearbyObjects.length > 0) {
        const selected = nearbyObjects[0];
        setSelectedObject(selected);
        setDetectedObjects([selected]);

        // Calcular mediciones del objeto seleccionado
        const measurementResult = await calculateMeasurements(selected.contour, currentImageData);
        setMeasurements(measurementResult);
      }

    } catch (error) {
      console.error('Error en selección manual:', error);
    } finally {
      setIsManualMode(false);
    }
  }, [currentImageData, detectObjectAtPoint, calculateMeasurements]);

  // CAMBIAR MODO DE DETECCIÓN
  const toggleDetectionMode = useCallback(() => {
    if (isAutoMode) {
      setIsAutoMode(false);
      setIsManualMode(true);
    } else {
      setIsManualMode(false);
      setIsAutoMode(true);
    }
  }, [isAutoMode]);

  // LIMPIAR SELECCIÓN
  const clearSelection = useCallback(() => {
    setSelectedObject(null);
    setMeasurements(null);
    setDetectedObjects([]);
  }, []);

  // EFECTO PARA INICIALIZAR CÁMARA
  useEffect(() => {
    initializeCamera();
    return () => stopCamera();
  }, [initializeCamera, stopCamera]);

  // EFECTO PARA PROCESAMIENTO AUTOMÁTICO
  useEffect(() => {
    if (!isAutoMode || !isCameraActive) return;

    const interval = setInterval(processFrameAutomatically, 200); // 5 FPS
    return () => clearInterval(interval);
  }, [isAutoMode, isCameraActive, processFrameAutomatically]);

  // EFECTO PARA ACTUALIZAR CALIBRACIÓN
  useEffect(() => {
    if (calibration?.pixelsPerMm) {
      // Actualizar configuración de medición con datos de calibración
      measurementConfig.calibrationData.pixelsPerMm = calibration.pixelsPerMm;
    }
  }, [calibration, measurementConfig]);

  return (
    <div className={`camera-view ${className}`}>
      {/* CONTROLES DE CÁMARA */}
      <CameraControls
        isActive={isCameraActive}
        isAutoMode={isAutoMode}
        isManualMode={isManualMode}
        onToggleMode={toggleDetectionMode}
        onClearSelection={clearSelection}
        detectionConfidence={detectionConfidence}
        isDetecting={isDetecting}
        isCalculating={isCalculating}
      />

      {/* VISTA PRINCIPAL DE CÁMARA */}
      <div className="camera-main-view">
        {/* VIDEO DE CÁMARA */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />

        {/* CANVAS PARA PROCESAMIENTO */}
        <canvas
          ref={canvasRef}
          className="camera-canvas"
          style={{ display: 'none' }}
        />

        {/* CANVAS DE OVERLAY */}
        <canvas
          ref={overlayCanvasRef}
          className="camera-overlay"
        />

        {/* SELECTOR MANUAL DE OBJETOS */}
        {isManualMode && (
          <TouchObjectSelector
            videoRef={videoRef}
            overlayCanvasRef={overlayCanvasRef}
            onObjectSelected={(object, measurements) => {
              setSelectedObject(object);
              setMeasurements(measurements);
            }}
            onError={(error) => console.error('Error en selección manual:', error)}
            isActive={isManualMode}
          />
        )}
      </div>

      {/* OVERLAY DE DETECCIÓN */}
      <DetectionOverlay
        detectedObjects={detectedObjects}
        selectedObject={selectedObject}
        isAutoMode={isAutoMode}
        isManualMode={isManualMode}
        overlayCanvas={overlayCanvasRef.current}
      />

      {/* DISPLAY DE MEDICIONES */}
      <MeasurementDisplay
        measurements={measurements}
        selectedObject={selectedObject}
        isCalculating={isCalculating}
        error={measurementError}
        className="measurement-display"
      />

      {/* INDICADORES DE ESTADO */}
      <div className="status-indicators">
        {detectionError && (
          <div className="error-indicator">
            Error de detección: {detectionError}
          </div>
        )}
        
        {measurementError && (
          <div className="error-indicator">
            Error de medición: {measurementError}
          </div>
        )}
        
        {isDetecting && (
          <div className="status-indicator">
            🔍 Detectando objetos...
          </div>
        )}
        
        {isCalculating && (
          <div className="status-indicator">
            📏 Calculando mediciones...
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraView;
