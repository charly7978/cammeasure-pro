import { useEffect, useState } from 'react';
import { Motion } from '@capacitor/motion';
import { Device } from '@capacitor/device';

export interface SensorData {
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    alpha: number;
    beta: number;
    gamma: number;
  };
  deviceInfo: {
    platform: string;
    model: string;
    operatingSystem: string;
  };
}

export const useDeviceSensors = () => {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [isListening, setIsListening] = useState(false);

  const startListening = async () => {
    try {
      // Get device info
      const deviceInfo = await Device.getInfo();
      
      // Start listening to motion events directly
      
      const listener = await Motion.addListener('accel', (event) => {
        setSensorData(prev => ({
          acceleration: {
            x: event.acceleration.x,
            y: event.acceleration.y,
            z: event.acceleration.z
          },
          rotation: prev?.rotation || { alpha: 0, beta: 0, gamma: 0 },
          deviceInfo: {
            platform: deviceInfo.platform,
            model: deviceInfo.model,
            operatingSystem: deviceInfo.operatingSystem
          }
        }));
      });

      const orientationListener = await Motion.addListener('orientation', (event) => {
        setSensorData(prev => ({
          acceleration: prev?.acceleration || { x: 0, y: 0, z: 0 },
          rotation: {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma
          },
          deviceInfo: prev?.deviceInfo || {
            platform: deviceInfo.platform,
            model: deviceInfo.model,
            operatingSystem: deviceInfo.operatingSystem
          }
        }));
      });

      setIsListening(true);

      return () => {
        listener.remove();
        orientationListener.remove();
        setIsListening(false);
      };
    } catch (error) {
      console.error('Error starting sensor listening:', error);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    setSensorData(null);
  };

  return {
    sensorData,
    isListening,
    startListening,
    stopListening
  };
};