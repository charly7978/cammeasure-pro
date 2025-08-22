/**
 * SISTEMA DE CALIBRACIÓN SIMPLE Y FUNCIONAL
 * Reemplaza el sistema complejo que no funciona
 */

import { useState, useCallback } from 'react';
import { CalibrationData } from '@/lib/types';

interface SimpleCalibrationHook {
  calibrationData: CalibrationData | null;
  setCalibrationData: (data: CalibrationData) => void;
  calibrateWithObject: (objectSizeMm: number, objectSizePixels: number) => CalibrationData;
  calibrateWithDevice: (deviceModel?: string) => CalibrationData;
  isCalibrated: boolean;
}

export const useSimpleCalibration = (): SimpleCalibrationHook => {
  const [calibrationData, setCalibrationDataState] = useState<CalibrationData | null>(() => {
    // Cargar calibración guardada
    try {
      const saved = localStorage.getItem('camMeasure_calibration');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setCalibrationData = useCallback((data: CalibrationData) => {
    setCalibrationDataState(data);
    // Guardar en localStorage
    try {
      localStorage.setItem('camMeasure_calibration', JSON.stringify(data));
      console.log('✅ Calibración guardada:', data);
    } catch (error) {
      console.error('❌ Error guardando calibración:', error);
    }
  }, []);

  const calibrateWithObject = useCallback((objectSizeMm: number, objectSizePixels: number): CalibrationData => {
    if (objectSizeMm <= 0 || objectSizePixels <= 0) {
      throw new Error('Los valores deben ser mayores a 0');
    }

    const pixelsPerMm = objectSizePixels / objectSizeMm;
    
    const newCalibration: CalibrationData = {
      focalLength: 1000, // Valor estimado
      sensorSize: 7.0,   // Valor estimado
      pixelsPerMm,
      referenceObjectSize: objectSizeMm,
      isCalibrated: true,
      calibrationMethod: 'reference',
      lastCalibrationDate: new Date().toISOString(),
      cameraMatrix: [[pixelsPerMm, 0, 0], [0, pixelsPerMm, 0], [0, 0, 1]],
      distortionCoefficients: [0, 0, 0, 0, 0],
      imageSize: { width: 1920, height: 1080 },
      realWorldScale: pixelsPerMm
    };

    setCalibrationData(newCalibration);
    console.log(`✅ Calibración completada: ${pixelsPerMm.toFixed(2)} px/mm`);
    
    return newCalibration;
  }, [setCalibrationData]);

  const calibrateWithDevice = useCallback((deviceModel?: string): CalibrationData => {
    // Base de datos de dispositivos comunes
    const deviceSpecs: Record<string, { pixelsPerMm: number; focalLength: number; sensorSize: number }> = {
      'iPhone 13': { pixelsPerMm: 4.2, focalLength: 5.1, sensorSize: 7.5 },
      'iPhone 12': { pixelsPerMm: 4.0, focalLength: 4.2, sensorSize: 7.0 },
      'iPhone 11': { pixelsPerMm: 3.9, focalLength: 4.25, sensorSize: 6.9 },
      'Samsung Galaxy S21': { pixelsPerMm: 4.1, focalLength: 5.4, sensorSize: 7.2 },
      'Samsung Galaxy S20': { pixelsPerMm: 3.8, focalLength: 4.3, sensorSize: 6.8 },
      'Google Pixel 6': { pixelsPerMm: 4.3, focalLength: 4.38, sensorSize: 7.4 },
      'Google Pixel 5': { pixelsPerMm: 3.7, focalLength: 4.38, sensorSize: 6.17 },
      'Generic Android': { pixelsPerMm: 4.0, focalLength: 4.5, sensorSize: 7.0 },
      'Generic iPhone': { pixelsPerMm: 4.1, focalLength: 4.5, sensorSize: 7.0 }
    };

    // Detectar dispositivo automáticamente
    const userAgent = navigator.userAgent;
    let detectedDevice = 'Generic Android';
    
    if (userAgent.includes('iPhone')) {
      detectedDevice = 'Generic iPhone';
      if (userAgent.includes('iPhone13')) detectedDevice = 'iPhone 13';
      else if (userAgent.includes('iPhone12')) detectedDevice = 'iPhone 12';
      else if (userAgent.includes('iPhone11')) detectedDevice = 'iPhone 11';
    } else if (userAgent.includes('Samsung')) {
      detectedDevice = 'Samsung Galaxy S21';
    } else if (userAgent.includes('Pixel')) {
      detectedDevice = 'Google Pixel 6';
    }

    const device = deviceModel || detectedDevice;
    const specs = deviceSpecs[device] || deviceSpecs['Generic Android'];

    const newCalibration: CalibrationData = {
      focalLength: specs.focalLength,
      sensorSize: specs.sensorSize,
      pixelsPerMm: specs.pixelsPerMm,
      referenceObjectSize: 0,
      isCalibrated: true,
      calibrationMethod: 'auto',
      lastCalibrationDate: new Date().toISOString(),
      cameraMatrix: [[specs.pixelsPerMm, 0, 0], [0, specs.pixelsPerMm, 0], [0, 0, 1]],
      distortionCoefficients: [0, 0, 0, 0, 0],
      imageSize: { width: 1920, height: 1080 },
      realWorldScale: specs.pixelsPerMm
    };

    setCalibrationData(newCalibration);
    console.log(`✅ Auto-calibración completada para ${device}: ${specs.pixelsPerMm.toFixed(2)} px/mm`);
    
    return newCalibration;
  }, [setCalibrationData]);

  return {
    calibrationData,
    setCalibrationData,
    calibrateWithObject,
    calibrateWithDevice,
    isCalibrated: calibrationData?.isCalibrated || false
  };
};