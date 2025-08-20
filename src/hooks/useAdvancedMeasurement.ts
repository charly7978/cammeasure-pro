// HOOK AVANZADO DE MEDICIÓN - INTEGRACIÓN COMPLETA CON OPENCV
// Manejo completo de mediciones en tiempo real y manuales

import { useState, useCallback, useRef } from 'react';
import { advancedOpenCVSystem, AdvancedOpenCVResult } from '@/lib/advancedOpenCVSystem';
import { useCalibration } from './useCalibration';
import { RealTimeMeasurement } from '@/lib/types';

export interface AdvancedMeasurementHook {
  isInitialized: boolean;
  isProcessing: boolean;
  lastMeasurement: RealTimeMeasurement | null;
  initializeSystem: () => Promise<boolean>;
  measureFromImageData: (imageData: ImageData, clickX?: number, clickY?: number) => Promise<RealTimeMeasurement>;
  measureFromVideo: (videoRef: React.RefObject<HTMLVideoElement>, clickX?: number, clickY?: number) => Promise<RealTimeMeasurement>;
  clearLastMeasurement: () => void;
}

export const useAdvancedMeasurement = (): AdvancedMeasurementHook => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);   
  const [lastMeasurement, setLastMeasurement] = useState<RealTimeMeasurement | null>(null);
  const { getPixelsPerMm, isCalibrated } = useCalibration();
  const processTimeoutRef = useRef<NodeJS.Timeout>();

  // INICIALIZACIÓN DEL SISTEMA
  const initializeSystem = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔧 INICIALIZANDO SISTEMA DE MEDICIÓN AVANZADO...');
      
      const success = await advancedOpenCVSystem.initialize();
      setIsInitialized(success);
      
      if (success) {
        console.log('✅ SISTEMA DE MEDICIÓN AVANZADO LISTO');
      } else {
        console.error('❌ FALLO EN INICIALIZACIÓN DEL SISTEMA');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Error inicializando sistema de medición:', error);
      setIsInitialized(false);
      return false;
    }
  }, []);

  // CAPTURAR FRAME DE VIDEO
  const captureVideoFrame = useCallback((videoRef: React.RefObject<HTMLVideoElement>): ImageData | null => {
    if (!videoRef?.current) {
      console.warn('⚠️ Video ref no disponible');
      return null;
    }

    const video = videoRef.current;
    if (video.readyState !== 4) {
      console.warn('⚠️ Video no está listo');
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('❌ No se pudo obtener contexto 2D del canvas');
        return null;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('❌ Error capturando frame de video:', error);
      return null;
    }
  }, []);

  // CONVERTIR RESULTADO OPENCV A MEDICIÓN
  const convertToMeasurement = useCallback((result: AdvancedOpenCVResult, clickX?: number, clickY?: number): RealTimeMeasurement => {
    const pixelsPerMm = isCalibrated() ? getPixelsPerMm() : 1;
    let targetObject = result.centralizedObject;

    // Si hay click, buscar objeto más cercano al click
    if (clickX !== undefined && clickY !== undefined && result.contours.length > 0) {
      let minDistance = Infinity;
      let closestIndex = -1;

      for (let i = 0; i < result.boundingBoxes.length; i++) {
        const bbox = result.boundingBoxes[i];
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const distance = Math.sqrt((clickX - centerX) ** 2 + (clickY - centerY) ** 2);

        if (distance < minDistance && distance < 150) { // Radio de 150px
          minDistance = distance;
          closestIndex = i;
        }
      }

      if (closestIndex !== -1) {
        const moments = result.moments[closestIndex];
        const centroid = {
          x: moments.m00 > 0 ? moments.m10 / moments.m00 : 0,
          y: moments.m00 > 0 ? moments.m01 / moments.m00 : 0
        };

        targetObject = {
          contour: result.contours[closestIndex],
          boundingBox: result.boundingBoxes[closestIndex],
          area: result.areas[closestIndex],
          perimeter: result.perimeters[closestIndex],
          confidence: result.confidences[closestIndex],
          circularity: result.circularity[closestIndex],
          moments: result.moments[closestIndex],
          centroid
        };
      }
    }

    if (!targetObject) {
      throw new Error('No se encontró objeto para medir');
    }

    // Convertir píxeles a unidades reales
    const width = targetObject.boundingBox.width / pixelsPerMm;
    const height = targetObject.boundingBox.height / pixelsPerMm;
    const area = targetObject.area / (pixelsPerMm * pixelsPerMm);
    const perimeter = targetObject.perimeter / pixelsPerMm;

    // Calcular propiedades avanzadas
    const circularity = Math.max(0, Math.min(1, targetObject.circularity));
    const solidity = Math.min(1, area / (width * height)); // Aproximación
    const confidence = targetObject.confidence;

    // Calcular estimaciones 3D
    const depth = width * 0.8; // Estimación basada en ancho
    const volume = area * depth * 0.6; // Estimación volumétrica
    const surfaceArea = area * 2.2; // Estimación de superficie
    const curvature = Math.max(0, 1.0 - circularity);
    const roughness = Math.max(0.01, 1.0 - confidence) * 0.3;

    // Calcular incertidumbre
    const measurementUncertainty = 1 - confidence;
    const calibrationUncertainty = isCalibrated() ? 0.02 : 0.6;
    const algorithmUncertainty = 0.05;
    const totalUncertainty = measurementUncertainty + calibrationUncertainty + algorithmUncertainty;

    const measurement: RealTimeMeasurement = {
      width,
      height,
      area,
      perimeter,
      circularity,
      solidity,
      confidence,
      depth,
      volume,
      surfaceArea,
      curvature,
      roughness,
      orientation: {
        pitch: 0,
        yaw: 0,
        roll: 0
      },
      materialProperties: {
        refractiveIndex: 1.0,
        scatteringCoefficient: 0.1,
        absorptionCoefficient: 0.05
      },
      uncertainty: {
        measurement: measurementUncertainty,
        calibration: calibrationUncertainty,
        algorithm: algorithmUncertainty,
        total: totalUncertainty
      },
      algorithm: 'OpenCV Avanzado Canny + Contornos',
      processingTime: Date.now(),
      frameRate: 30,
      qualityMetrics: {
        sharpness: confidence,
        contrast: 0.8,
        noise: Math.max(0.05, 1 - confidence) * 0.2,
        blur: Math.max(0.05, 1 - confidence) * 0.15
      }
    };

    return measurement;
  }, [isCalibrated, getPixelsPerMm]);

  // MEDICIÓN DESDE IMAGEDATA
  const measureFromImageData = useCallback(async (imageData: ImageData, clickX?: number, clickY?: number): Promise<RealTimeMeasurement> => {
    if (!isInitialized) {
      throw new Error('Sistema de medición no inicializado');
    }

    if (isProcessing) {
      throw new Error('Ya hay una medición en proceso');
    }

    try {
      setIsProcessing(true);
      
      console.log('🎯 INICIANDO MEDICIÓN AVANZADA:', clickX ? `Click en (${clickX}, ${clickY})` : 'Automática');

      // Procesar imagen con OpenCV avanzado
      const result = await advancedOpenCVSystem.processImage(imageData);

      // Convertir a medición
      const measurement = convertToMeasurement(result, clickX, clickY);
      
      setLastMeasurement(measurement);
      
      console.log('✅ MEDICIÓN AVANZADA COMPLETADA:', {
        área: Math.round(measurement.area),
        perímetro: Math.round(measurement.perimeter),
        confianza: (measurement.confidence * 100).toFixed(1) + '%',
        método: clickX ? 'Manual' : 'Automático'
      });

      return measurement;

    } catch (error) {
      console.error('❌ Error en medición avanzada:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized, isProcessing, convertToMeasurement]);

  // MEDICIÓN DESDE VIDEO
  const measureFromVideo = useCallback(async (videoRef: React.RefObject<HTMLVideoElement>, clickX?: number, clickY?: number): Promise<RealTimeMeasurement> => {
    const imageData = captureVideoFrame(videoRef);
    if (!imageData) {
      throw new Error('No se pudo capturar frame del video');
    }

    return measureFromImageData(imageData, clickX, clickY);
  }, [captureVideoFrame, measureFromImageData]);

  // LIMPIAR ÚLTIMA MEDICIÓN
  const clearLastMeasurement = useCallback(() => {
    setLastMeasurement(null);
  }, []);

  return {
    isInitialized,
    isProcessing,
    lastMeasurement,
    initializeSystem,
    measureFromImageData,
    measureFromVideo,
    clearLastMeasurement
  };
};