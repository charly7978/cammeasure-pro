import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRealTimeMeasurement } from '../hooks/useRealTimeMeasurement';
import { useCamera } from '../hooks/useCamera';

interface CalibrationData {
  pixelsPerMm: number;
  referenceSize: number;
}

export function WorkingRealTimeMeasurement() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  const [isActive, setIsActive] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationData>({
    pixelsPerMm: 10, // Valor por defecto
    referenceSize: 20 // 20mm de referencia
  });
  
  const { stream, startCamera, stopCamera, error: cameraError } = useCamera();
  const { 
    isReady, 
    measurements, 
    isProcessing, 
    error: measurementError,
    measureFromVideo 
  } = useRealTimeMeasurement();

  // Inicializar video cuando hay stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  }, [stream]);

  // Loop de medición en tiempo real
  const measurementLoop = useCallback(() => {
    if (!isActive || !videoRef.current || !isReady) {
      return;
    }

    // Medir objetos en el frame actual
    measureFromVideo(videoRef.current, calibration);

    // Continuar el loop
    animationRef.current = requestAnimationFrame(() => {
      setTimeout(measurementLoop, 200); // Medir cada 200ms
    });
  }, [isActive, isReady, measureFromVideo, calibration]);

  // Iniciar/detener medición
  const toggleMeasurement = useCallback(async () => {
    if (!isActive) {
      try {
        await startCamera();
        setIsActive(true);
      } catch (err) {
        console.error('Error iniciando cámara:', err);
      }
    } else {
      setIsActive(false);
      stopCamera();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [isActive, startCamera, stopCamera]);

  // Iniciar loop cuando se activa
  useEffect(() => {
    if (isActive && isReady) {
      measurementLoop();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isReady, measurementLoop]);

  // Dibujar overlay con mediciones
  useEffect(() => {
    if (!measurements || !overlayRef.current || !videoRef.current) {
      return;
    }

    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar tamaño del canvas al video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar mediciones
    measurements.objects.forEach((obj, index) => {
      // Rectángulo del objeto
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

      // Información de medición
      ctx.fillStyle = '#00ff00';
      ctx.font = '14px Arial';
      ctx.fillRect(obj.x, obj.y - 60, 150, 55);
      
      ctx.fillStyle = '#000000';
      ctx.fillText(`Objeto ${index + 1}`, obj.x + 5, obj.y - 45);
      ctx.fillText(`${obj.widthMm}mm × ${obj.heightMm}mm`, obj.x + 5, obj.y - 30);
      ctx.fillText(`Área: ${obj.areaMm2}mm²`, obj.x + 5, obj.y - 15);
      ctx.fillText(`Confianza: ${Math.round(obj.confidence * 100)}%`, obj.x + 5, obj.y - 5);
    });
  }, [measurements]);

  // Calibración rápida
  const quickCalibrate = useCallback((referenceSize: number) => {
    setCalibration(prev => ({
      ...prev,
      referenceSize,
      pixelsPerMm: 100 / referenceSize // Asumiendo 100px = referenceSize mm
    }));
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Medición 3D en Tiempo Real</h2>
        
        {/* Controles */}
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <button
            onClick={toggleMeasurement}
            className={`px-6 py-2 rounded-lg font-semibold ${
              isActive 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
            disabled={!isReady}
          >
            {isActive ? 'Detener Medición' : 'Iniciar Medición'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Calibración rápida:</span>
            <button
              onClick={() => quickCalibrate(10)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              10mm
            </button>
            <button
              onClick={() => quickCalibrate(20)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              20mm
            </button>
            <button
              onClick={() => quickCalibrate(50)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              50mm
            </button>
          </div>
        </div>

        {/* Estado del sistema */}
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <div className={`px-3 py-1 rounded ${isReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            Worker: {isReady ? 'Listo' : 'No listo'}
          </div>
          <div className={`px-3 py-1 rounded ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
            Cámara: {isActive ? 'Activa' : 'Inactiva'}
          </div>
          <div className={`px-3 py-1 rounded ${isProcessing ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
            Procesando: {isProcessing ? 'Sí' : 'No'}
          </div>
        </div>

        {/* Errores */}
        {(cameraError || measurementError) && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
            {cameraError || measurementError}
          </div>
        )}

        {/* Video y overlay */}
        <div className="relative mb-4">
          <video
            ref={videoRef}
            className="w-full max-w-2xl mx-auto rounded-lg"
            autoPlay
            muted
            playsInline
          />
          <canvas
            ref={overlayRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>

        {/* Información de mediciones */}
        {measurements && measurements.objects.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Objetos Detectados:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {measurements.objects.map((obj, index) => (
                <div key={obj.id} className="bg-white p-3 rounded border">
                  <h4 className="font-medium">Objeto {index + 1}</h4>
                  <p className="text-sm text-gray-600">
                    Dimensiones: {obj.widthMm}mm × {obj.heightMm}mm
                  </p>
                  <p className="text-sm text-gray-600">
                    Área: {obj.areaMm2}mm²
                  </p>
                  <p className="text-sm text-gray-600">
                    Confianza: {Math.round(obj.confidence * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuración de calibración */}
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Configuración de Calibración</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Píxeles por mm:
              </label>
              <input
                type="number"
                value={calibration.pixelsPerMm}
                onChange={(e) => setCalibration(prev => ({
                  ...prev,
                  pixelsPerMm: parseFloat(e.target.value) || 1
                }))}
                className="w-full px-3 py-2 border rounded-lg"
                step="0.1"
                min="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Tamaño de referencia (mm):
              </label>
              <input
                type="number"
                value={calibration.referenceSize}
                onChange={(e) => setCalibration(prev => ({
                  ...prev,
                  referenceSize: parseFloat(e.target.value) || 1
                }))}
                className="w-full px-3 py-2 border rounded-lg"
                step="1"
                min="1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}