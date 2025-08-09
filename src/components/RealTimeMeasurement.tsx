// RealTimeMeasurement.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCalibration } from '@/hooks/useCalibration';
import { NativeMultiCamera } from '@/lib/nativeMultiCamera';

/**
 * RealTimeMeasurement
 * - Captura frames desde videoRef
 * - Envía frames al worker (measurementWorker.ts)
 * - Recibe detecciones 2D (con métricas reales) y, si se provee par estéreo, nube de puntos 3D
 *
 * Props:
 *  - videoRef: referencia al <video> que muestra la cámara
 *  - onObjectsDetected(objects)
 *  - isActive: procesar frames sólo si true
 */

type WorkerMessageIn =
  | { type: 'init'; opencvCDNs?: string[]; config?: any }
  | { type: 'processFrame'; id?: string; imageData: ImageData; params?: any }
  | { type: 'processStereo'; id?: string; left: ImageData; right: ImageData; params?: any }
  | { type: 'calibrateWithCheckerboard'; imageData: ImageData; patternSize: { w: number; h: number }; squareSizeMm: number }
  | { type: 'setCalibrationParams'; params: any }
  | { type: 'shutdown' };

type WorkerMsgOut =
  | { type: 'ready' }
  | { type: 'log'; message: string }
  | { type: 'detections'; id?: string; objects: any[] }
  | { type: 'calibrationResult'; success: boolean; cameraMatrix?: number[]; distCoeffs?: number[]; pixelsPerMm?: number }
  | { type: 'stereoResult'; disparity?: any; pointCloudSummary?: any }
  | { type: 'error'; message: string };

interface RealTimeMeasurementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onObjectsDetected: (objects: any[]) => void;
  isActive: boolean;
}

export const RealTimeMeasurement: React.FC<RealTimeMeasurementProps> = ({ videoRef, onObjectsDetected, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<OffscreenCanvas | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastProcessTime = useRef<number>(0);
  const PROCESS_INTERVAL = 100; // ms (más fluido que antes)
  const workerRef = useRef<Worker | null>(null);
  const { calibration, setCalibration } = useCalibration();
  const [workerReady, setWorkerReady] = useState(false);
  const nativeStereoListenerRef = useRef<any>(null);

  // Inicializar worker
  useEffect(() => {
    // Asume que measurementWorker.ts está compilado a worker y accesible en /workers/measurementWorker.js
    // Ajustá esta ruta según tu bundler (Vite/webpack).
    const worker = new Worker('/workers/measurementWorker.js', { type: 'module' });
    workerRef.current = worker;

    // Mensajes del worker
    worker.onmessage = (ev: MessageEvent) => {
      const msg: WorkerMsgOut = ev.data;
      if (!msg) return;

      switch (msg.type) {
        case 'ready':
          setWorkerReady(true);
          console.log('[Worker] ready');
          break;
        case 'log':
          console.log('[Worker]', msg.message);
          break;
        case 'detections':
          // Estructura: objects[] con métricas reales (mm) y scores
          onObjectsDetected(msg.objects);
          break;
        case 'calibrationResult':
          if (msg.success && msg.cameraMatrix && msg.distCoeffs) {
            // Guardar parámetros de calibración en context
            setCalibration({
              focalLength: msg.cameraMatrix[0], // aproximación
              sensorSize: calibration?.sensorSize || 6.17,
              pixelsPerMm: msg.pixelsPerMm || (calibration?.pixelsPerMm || 8),
              referenceObjectSize: calibration?.referenceObjectSize || 25.4,
              isCalibrated: true
            });
            console.log('[Calibration] OK', msg);
          } else {
            console.warn('[Calibration] failed', msg);
          }
          break;
        case 'stereoResult':
          console.log('[Worker] stereoResult', msg.pointCloudSummary);
          break;
        case 'error':
          console.error('[Worker]', msg.message);
          break;
        default:
          break;
      }
    };

    // Inicializar worker con lista de CDNs para OpenCV.js (fallbacks)
    worker.postMessage({
      type: 'init',
      opencvCDNs: [
        // Cambiá por los CDN que prefieras/versiones concretas
        'https://docs.opencv.org/4.x/opencv.js',
        'https://cdnjs.cloudflare.com/ajax/libs/opencv/4.5.5/opencv.js',
        'https://unpkg.com/opencv-js@4.5.5/opencv.js'
      ],
      config: {
        multiScaleCanny: true,
        cannyLevels: [ [30, 100], [50, 150], [80, 200] ],
        minAreaPx: 2000
      }
    } as WorkerMessageIn);

    return () => {
      worker.postMessage({ type: 'shutdown' } as WorkerMessageIn);
      worker.terminate();
      workerRef.current = null;
      setWorkerReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preparar canvas (en DOM o Offscreen para performance)
  useEffect(() => {
    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.style.display = 'none';
      document.body.appendChild(c);
      canvasRef.current = c;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      offscreenRef.current = new OffscreenCanvas(640, 480);
    }
  }, []);

  // WEB: frame loop normal
  const processFrame = useCallback(() => {
    const now = Date.now();
    if (!isActive || !videoRef.current || !workerRef.current) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    if (now - lastProcessTime.current < PROCESS_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;

    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    lastProcessTime.current = now;

    // Ajustar canvas al tamaño del video (mantener relación)
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Obtener ImageData
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Enviar al worker
    const msg: WorkerMessageIn = {
      type: 'processFrame',
      id: `f_${Date.now()}`,
      imageData,
      params: {
        pixelsPerMm: calibration?.pixelsPerMm || 8,
        useUndistort: calibration?.isCalibrated ? true : false,
        desiredOutputMaxWidth: 1280,
      }
    };
    workerRef.current.postMessage(msg, [imageData.data.buffer]);

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, calibration, videoRef]);

  // Loop de rAF
  useEffect(() => {
    if (isActive && workerReady) {
      rafRef.current = requestAnimationFrame(processFrame);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, processFrame, workerReady]);

  // NATIVO: escuchar frames estéreo y enviarlos al worker como processStereoAdvanced
  useEffect(() => {
    let sub: any = null;
    const run = async () => {
      if (!NativeMultiCamera.isNative) return;
      try {
        const res = await NativeMultiCamera.listCameras();
        const backs = (res.devices || []).filter((d: any) => d.isBack);
        if (backs.length < 2) { console.warn('No hay dos cámaras traseras disponibles en nativo'); return; }
        const leftId = backs[0].id; const rightId = backs[1].id;
        sub = await NativeMultiCamera.onStereoFrame((payload) => {
          if (!workerRef.current) return;
          // Conversion: arrays de enteros a Uint8ClampedArray -> ImageData
          const { width, height, left, right } = payload;
          const leftClamped = new Uint8ClampedArray(left);
          const rightClamped = new Uint8ClampedArray(right);
          const leftImage = new ImageData(leftClamped, width, height);
          const rightImage = new ImageData(rightClamped, width, height);
          workerRef.current.postMessage({ type: 'processStereoAdvanced', left: leftImage, right: rightImage, stereoConfig: {} });
        });
        await NativeMultiCamera.startStereo(leftId, rightId, 1280, 720);
      } catch (e) {
        console.warn('Stereo nativo no disponible:', e);
      }
    };
    run();
    return () => { sub?.remove?.(); NativeMultiCamera.stop().catch(() => {}); };
  }, []);

  // Función pública para calibrar automáticamente detectando un checkerboard
  const autoCalibrateWithCheckerboard = async (patternW = 9, patternH = 6, squareSizeMm = 25.4) => {
    if (!canvasRef.current || !videoRef.current || !workerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoRef.current!, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    workerRef.current.postMessage({
      type: 'calibrateWithCheckerboard',
      imageData,
      patternSize: { w: patternW, h: patternH },
      squareSizeMm
    } as WorkerMessageIn, [imageData.data.buffer]);
  };

  // Exponer una referencia global (para debug) - opcional
  useEffect(() => {
    // @ts-ignore
    window.__camMeasureWorker = workerRef.current;
  }, []);

  return (
    <>
      {/* canvas oculto usado para capturar frames (si lo querés visible, mostralo) */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* Opcional: botones manuales para debug/calibración */}
      <div style={{ display: 'none' }}>
        <button onClick={() => autoCalibrateWithCheckerboard(9, 6, 25.4)}>
          Calibrar con tablero (9x6)
        </button>
      </div>
    </>
  );
};

export default RealTimeMeasurement;
