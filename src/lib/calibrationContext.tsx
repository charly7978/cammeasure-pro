import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { SmartCalibrationSystem, SmartCalibrationData } from './smartCalibration';

export interface CalibrationData {
  focalLength: number;
  sensorSize: number;
  pixelsPerMm: number;
  referenceObjectSize: number;
  isCalibrated: boolean;
  deviceProfile?: any;
  environmentalFactors?: any;
  calibrationHistory?: any[];
}

interface CalibrationContextValue {
  calibration: CalibrationData | null;
  setCalibration: (data: CalibrationData) => void;
  smartCalibration: SmartCalibrationSystem;
  autoCalibrate: () => Promise<void>;
  calibrateWithReference: (objectKey: string, measuredPixels: number) => void;
  getRecommendations: () => string[];
}

export const CalibrationContext = createContext<CalibrationContextValue | undefined>(
  undefined
);

export const CalibrationProvider = ({ children }: { children: ReactNode }) => {
  const [smartCalibrationSystem] = useState(() => new SmartCalibrationSystem());
  const [calibration, setCalibrationState] = useState<CalibrationData | null>(null);

  useEffect(() => {
    // Inicializar con calibración automática
    initializeCalibration();
  }, []);

  const initializeCalibration = async () => {
    try {
      // Intentar calibración automática basada en dispositivo
      const smartData = await smartCalibrationSystem.autoCalibrate();
      
      const calibrationData: CalibrationData = {
        focalLength: smartData.focalLength,
        sensorSize: smartData.sensorSize,
        pixelsPerMm: smartData.pixelsPerMm,
        referenceObjectSize: smartData.referenceObjectSize,
        isCalibrated: smartData.isCalibrated,
        deviceProfile: smartData.deviceProfile,
        environmentalFactors: smartData.environmentalFactors,
        calibrationHistory: smartData.calibrationHistory
      };
      
      setCalibrationState(calibrationData);
    } catch (error) {
      console.error('Error initializing smart calibration:', error);
      
      // Fallback a calibración básica
      setCalibrationState({
        focalLength: 4.0,
        sensorSize: 6.17,
        pixelsPerMm: 10, // Valor más realista
        referenceObjectSize: 25.4,
        isCalibrated: true
      });
    }
  };

  const setCalibration = (data: CalibrationData) => {
    setCalibrationState(data);
  };

  const autoCalibrate = async () => {
    try {
      const smartData = await smartCalibrationSystem.autoCalibrate();
      
      const calibrationData: CalibrationData = {
        focalLength: smartData.focalLength,
        sensorSize: smartData.sensorSize,
        pixelsPerMm: smartData.pixelsPerMm,
        referenceObjectSize: smartData.referenceObjectSize,
        isCalibrated: smartData.isCalibrated,
        deviceProfile: smartData.deviceProfile,
        environmentalFactors: smartData.environmentalFactors,
        calibrationHistory: smartData.calibrationHistory
      };
      
      setCalibrationState(calibrationData);
    } catch (error) {
      console.error('Auto calibration failed:', error);
    }
  };

  const calibrateWithReference = (objectKey: string, measuredPixels: number) => {
    try {
      const smartData = smartCalibrationSystem.calibrateWithReference(objectKey, measuredPixels);
      
      const calibrationData: CalibrationData = {
        focalLength: smartData.focalLength,
        sensorSize: smartData.sensorSize,
        pixelsPerMm: smartData.pixelsPerMm,
        referenceObjectSize: smartData.referenceObjectSize,
        isCalibrated: smartData.isCalibrated,
        deviceProfile: smartData.deviceProfile,
        environmentalFactors: smartData.environmentalFactors,
        calibrationHistory: smartData.calibrationHistory
      };
      
      setCalibrationState(calibrationData);
    } catch (error) {
      console.error('Reference calibration failed:', error);
    }
  };

  const getRecommendations = (): string[] => {
    return smartCalibrationSystem.getCalibrationRecommendations();
  };

  return (
    <CalibrationContext.Provider value={{ 
      calibration, 
      setCalibration, 
      smartCalibration: smartCalibrationSystem,
      autoCalibrate,
      calibrateWithReference,
      getRecommendations
    }}>
      {children}
    </CalibrationContext.Provider>
  );
};

export type CalibrationContextType = CalibrationContextValue;