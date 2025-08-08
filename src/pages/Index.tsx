import React, { useState, useRef, useEffect } from 'react';
import { RealTimeMeasurement } from '@/components/RealTimeMeasurement';
import { MeasurementOverlay } from '@/components/MeasurementOverlay';
import { CalibrationPanel } from '@/components/CalibrationPanel';
import { useCalibration } from '@/hooks/useCalibration';

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [objects, setObjects] = useState([]);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const { calibration, setCalibration } = useCalibration();
  const [showCalibrationPanel, setShowCalibrationPanel] = useState(false);

  useEffect(() => {
    const updateSizes = () => {
      if (videoRef.current) {
        setVideoWidth(videoRef.current.videoWidth);
        setVideoHeight(videoRef.current.videoHeight);
      }
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };

    updateSizes();
    window.addEventListener('resize', updateSizes);

    return () => {
      window.removeEventListener('resize', updateSizes);
    };
  }, []);

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };

    startWebcam();
  }, []);

  const handleObjectsDetected = (detectedObjects: any) => {
    setObjects(detectedObjects);
  };

  const toggleMeasuring = () => {
    setIsMeasuring(!isMeasuring);
  };

  const toggleCalibrationPanel = () => {
    setShowCalibrationPanel(!showCalibrationPanel);
  };

  const handleCalibrationComplete = (calibrationData: any) => {
    // Convert CalibrationPanel data to CalibrationContext format
    const contextData = {
      ...calibrationData,
      cameraMatrix: calibrationData.cameraMatrix || [[800, 0, 320], [0, 800, 240], [0, 0, 1]],
      distortionCoefficients: calibrationData.distortionCoefficients || [0, 0, 0, 0, 0],
      imageSize: calibrationData.imageSize || { width: 640, height: 480 },
      realWorldScale: calibrationData.realWorldScale || 1.0
    };
    
    setCalibration(contextData);
    console.log('Calibración completada:', contextData);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <header className="bg-white shadow-md w-full p-4 mb-8">
        <h1 className="text-2xl font-bold text-center text-gray-800">
          Real-time Object Measurement
        </h1>
      </header>

      <div className="relative w-full max-w-4xl rounded-lg shadow-xl overflow-hidden" ref={containerRef}>
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover"
          autoPlay
          muted
          playsInline
        />
        <MeasurementOverlay
          objects={objects}
          videoWidth={videoWidth}
          videoHeight={videoHeight}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      </div>

      <div className="mt-6 flex space-x-4">
        <button
          className={`px-4 py-2 rounded-md text-white font-semibold ${
            isMeasuring ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
          onClick={toggleMeasuring}
        >
          {isMeasuring ? 'Stop Measuring' : 'Start Measuring'}
        </button>
        <button
          className="px-4 py-2 rounded-md text-gray-700 font-semibold bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          onClick={toggleCalibrationPanel}
        >
          {showCalibrationPanel ? 'Hide Calibration' : 'Show Calibration'}
        </button>
      </div>

      {showCalibrationPanel && (
        <div className="mt-6 w-full max-w-lg">
          <CalibrationPanel onCalibrationComplete={handleCalibrationComplete} />
        </div>
      )}

      <RealTimeMeasurement
        videoRef={videoRef}
        onObjectsDetected={handleObjectsDetected}
        isActive={isMeasuring}
      />

      <footer className="bg-white shadow-md w-full p-4 mt-8">
        <p className="text-sm text-center text-gray-600">
          &copy; 2024 Real-time Object Measurement. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Index;
