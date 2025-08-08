
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCalibration } from '@/hooks/useCalibration';
import { NativeMultiCamera } from '@/lib/nativeMultiCamera';

export interface DetectedObject {
  id: string;
  bounds: { x: number; y: number; width: number; height: number; area: number };
  dimensions: { width: number; height: number; area: number; unit: string };
  confidence: number;
  center: { x: number; y: number };
}

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
  const PROCESS_INTERVAL = 100;
  const workerRef = useRef<Worker | null>(null);
  const { calibration, setCalibration } = useCalibration();
  const [workerReady, setWorkerReady] = useState(false);
  const nativeStereoListenerRef = useRef<any>(null);

  useEffect(() => {
    const createWorker = (): Worker | null => {
      const candidates = [
        'workers/measurementWorker.js',
        '/workers/measurementWorker.js',
      ];
      for (const url of candidates) {
        try {
          const w = new Worker(url); // sin type:'module' para compat WebView
          return w;
        } catch (_) { /* try next */ }
      }
      try {
        const abs = new URL('/workers/measurementWorker.js', window.location.origin).toString();
        return new Worker(abs);
      } catch (_) { return null; }
    };

    const worker = createWorker();
    if (!worker) {
      console.error('[Worker] no pudo crearse');
      return () => {};
    }
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent) => {
      const msg: any = ev.data;
      if (!msg) return;
      switch (msg.type) {
        case 'ready': setWorkerReady(true); break;
        case 'log': console.log('[Worker]', msg.message); break;
        case 'detections': onObjectsDetected(msg.objects || []); break;
        case 'calibrationResult':
          if (msg.success && msg.cameraMatrix && msg.distCoeffs) {
            setCalibration({
              focalLength: msg.cameraMatrix[0],
              sensorSize: calibration?.sensorSize || 6.17,
              pixelsPerMm: msg.pixelsPerMm || (calibration?.pixelsPerMm || 8),
              referenceObjectSize: calibration?.referenceObjectSize || 25.4,
              isCalibrated: true,
            });
          }
          break;
        case 'stereoResult':
          console.log('[Worker] stereoResult');
          break;
        case 'error': console.error('[Worker]', msg.message); break;
      }
    };

    worker.onerror = (e) => {
      console.error('[Worker] onerror', e);
    };

    worker.postMessage({
      type: 'init',
      opencvCDNs: [
        'https://docs.opencv.org/4.x/opencv.js',
        'https://cdnjs.cloudflare.com/ajax/libs/opencv/4.5.5/opencv.js',
        'https://unpkg.com/opencv-js@4.5.5/opencv.js',
      ],
      config: { multiScaleCanny: true, cannyLevels: [[30, 100], [50, 150], [80, 200]], minAreaPx: 400 },
    });

    return () => {
      worker.postMessage({ type: 'shutdown' });
      worker.terminate();
      workerRef.current = null;
      setWorkerReady(false);
    };
  }, []);

  useEffect(() => {
    if (typeof OffscreenCanvas !== 'undefined') {
      offscreenRef.current = new OffscreenCanvas(640, 480);
    }
    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.style.display = 'none';
      document.body.appendChild(c);
      canvasRef.current = c;
    }
  }, []);

  const processFrame = useCallback(() => {
    const now = Date.now();
    if (!isActive || !videoRef.current || !workerRef.current) {
      rafRef.current = requestAnimationFrame(processFrame); return;
    }
    if (now - lastProcessTime.current < PROCESS_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame); return;
    }
    const video = videoRef.current;
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(processFrame); return;
    }
    lastProcessTime.current = now;
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    workerRef.current!.postMessage({
      type: 'processFrame', id: `f_${now}`, imageData,
      params: { pixelsPerMm: calibration?.pixelsPerMm || 8, useUndistort: !!calibration?.isCalibrated, desiredOutputMaxWidth: 1280 }
    }, [imageData.data.buffer]);

    rafRef.current = requestAnimationFrame(processFrame);
  }, [isActive, calibration, videoRef]);

  useEffect(() => {
    if (isActive && workerReady) {
      rafRef.current = requestAnimationFrame(processFrame);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, processFrame, workerReady]);

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

  return (<><canvas ref={canvasRef} style={{ display: 'none' }} /></>);
};

export default RealTimeMeasurement;
