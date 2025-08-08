/**
 * CONFIGURACIÓN DE OPENCV PARA CAMMEASURE PRO
 * Configuraciones optimizadas para diferentes dispositivos y escenarios
 */

export interface OpenCVDeviceConfig {
  deviceType: 'mobile' | 'desktop' | 'tablet';
  platform: 'android' | 'ios' | 'web';
  capabilities: {
    hasOpenCV: boolean;
    hasWebGL: boolean;
    hasWebWorkers: boolean;
    maxImageSize: number;
  };
  performance: {
    targetFPS: number;
    maxProcessingTime: number;
    memoryLimit: number;
  };
}

export interface OpenCVDetectionConfig {
  // Configuración de detección
  minObjectArea: number;
  maxObjects: number;
  confidenceThreshold: number;
  
  // Configuración de procesamiento
  enableMultiScale: boolean;
  enableTemporalStabilization: boolean;
  enable3D: boolean;
  
  // Configuración de filtros
  gaussianBlurSigma: number;
  cannyLowThreshold: number;
  cannyHighThreshold: number;
  
  // Configuración de morfología
  morphologyKernelSize: number;
  morphologyIterations: number;
}

export interface OpenCVMeasurementConfig {
  // Configuración de cámara
  focalLength: number;
  principalPointX: number;
  principalPointY: number;
  sensorWidth: number;
  sensorHeight: number;
  
  // Configuración de calibración
  pixelsPerMm: number;
  calibrationPattern: {
    type: 'checkerboard' | 'circles' | 'asymmetric_circles';
    rows: number;
    cols: number;
    squareSize: number;
  };
  
  // Configuración de medición 3D
  enable3DMeasurement: boolean;
  depthEstimationMethod: 'size' | 'blur' | 'perspective' | 'stereo';
  measurementUnits: 'mm' | 'cm' | 'm';
}

// Configuraciones predefinidas para diferentes dispositivos
export const DEVICE_CONFIGS: Record<string, OpenCVDeviceConfig> = {
  mobile_android: {
    deviceType: 'mobile',
    platform: 'android',
    capabilities: {
      hasOpenCV: true,
      hasWebGL: true,
      hasWebWorkers: true,
      maxImageSize: 1920 * 1080
    },
    performance: {
      targetFPS: 15,
      maxProcessingTime: 100,
      memoryLimit: 100 * 1024 * 1024 // 100MB
    }
  },
  
  mobile_ios: {
    deviceType: 'mobile',
    platform: 'ios',
    capabilities: {
      hasOpenCV: true,
      hasWebGL: true,
      hasWebWorkers: true,
      maxImageSize: 1920 * 1080
    },
    performance: {
      targetFPS: 15,
      maxProcessingTime: 100,
      memoryLimit: 100 * 1024 * 1024 // 100MB
    }
  },
  
  desktop: {
    deviceType: 'desktop',
    platform: 'web',
    capabilities: {
      hasOpenCV: true,
      hasWebGL: true,
      hasWebWorkers: true,
      maxImageSize: 3840 * 2160
    },
    performance: {
      targetFPS: 30,
      maxProcessingTime: 50,
      memoryLimit: 500 * 1024 * 1024 // 500MB
    }
  },
  
  tablet: {
    deviceType: 'tablet',
    platform: 'web',
    capabilities: {
      hasOpenCV: true,
      hasWebGL: true,
      hasWebWorkers: true,
      maxImageSize: 2560 * 1440
    },
    performance: {
      targetFPS: 20,
      maxProcessingTime: 75,
      memoryLimit: 200 * 1024 * 1024 // 200MB
    }
  }
};

// Configuraciones de detección optimizadas
export const DETECTION_CONFIGS: Record<string, OpenCVDetectionConfig> = {
  fast: {
    minObjectArea: 500,
    maxObjects: 3,
    confidenceThreshold: 0.3,
    enableMultiScale: false,
    enableTemporalStabilization: false,
    enable3D: false,
    gaussianBlurSigma: 1.0,
    cannyLowThreshold: 50,
    cannyHighThreshold: 150,
    morphologyKernelSize: 3,
    morphologyIterations: 1
  },
  
  balanced: {
    minObjectArea: 1000,
    maxObjects: 5,
    confidenceThreshold: 0.5,
    enableMultiScale: true,
    enableTemporalStabilization: true,
    enable3D: true,
    gaussianBlurSigma: 1.4,
    cannyLowThreshold: 50,
    cannyHighThreshold: 150,
    morphologyKernelSize: 5,
    morphologyIterations: 2
  },
  
  accurate: {
    minObjectArea: 2000,
    maxObjects: 10,
    confidenceThreshold: 0.7,
    enableMultiScale: true,
    enableTemporalStabilization: true,
    enable3D: true,
    gaussianBlurSigma: 2.0,
    cannyLowThreshold: 30,
    cannyHighThreshold: 200,
    morphologyKernelSize: 7,
    morphologyIterations: 3
  }
};

// Configuraciones de medición optimizadas
export const MEASUREMENT_CONFIGS: Record<string, OpenCVMeasurementConfig> = {
  smartphone: {
    focalLength: 800,
    principalPointX: 960,
    principalPointY: 540,
    sensorWidth: 6.17,
    sensorHeight: 4.63,
    pixelsPerMm: 129.87,
    calibrationPattern: {
      type: 'checkerboard',
      rows: 7,
      cols: 10,
      squareSize: 25
    },
    enable3DMeasurement: true,
    depthEstimationMethod: 'size',
    measurementUnits: 'mm'
  },
  
  tablet: {
    focalLength: 1000,
    principalPointX: 1280,
    principalPointY: 720,
    sensorWidth: 8.0,
    sensorHeight: 6.0,
    pixelsPerMm: 160.0,
    calibrationPattern: {
      type: 'checkerboard',
      rows: 9,
      cols: 12,
      squareSize: 30
    },
    enable3DMeasurement: true,
    depthEstimationMethod: 'size',
    measurementUnits: 'mm'
  },
  
  desktop: {
    focalLength: 1200,
    principalPointX: 1920,
    principalPointY: 1080,
    sensorWidth: 10.0,
    sensorHeight: 7.5,
    pixelsPerMm: 192.0,
    calibrationPattern: {
      type: 'checkerboard',
      rows: 11,
      cols: 14,
      squareSize: 35
    },
    enable3DMeasurement: true,
    depthEstimationMethod: 'size',
    measurementUnits: 'mm'
  }
};

// Función para detectar automáticamente la configuración del dispositivo
export function detectDeviceConfig(): OpenCVDeviceConfig {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
  const isTablet = /tablet|ipad/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  
  if (isMobile) {
    if (isAndroid) {
      return DEVICE_CONFIGS.mobile_android;
    } else if (isIOS) {
      return DEVICE_CONFIGS.mobile_ios;
    }
  }
  
  if (isTablet) {
    return DEVICE_CONFIGS.tablet;
  }
  
  return DEVICE_CONFIGS.desktop;
}

// Función para obtener la configuración óptima de detección
export function getOptimalDetectionConfig(deviceConfig: OpenCVDeviceConfig): OpenCVDetectionConfig {
  if (deviceConfig.deviceType === 'mobile') {
    return DETECTION_CONFIGS.fast;
  } else if (deviceConfig.deviceType === 'tablet') {
    return DETECTION_CONFIGS.balanced;
  } else {
    return DETECTION_CONFIGS.accurate;
  }
}

// Función para obtener la configuración óptima de medición
export function getOptimalMeasurementConfig(deviceConfig: OpenCVDeviceConfig): OpenCVMeasurementConfig {
  if (deviceConfig.deviceType === 'mobile') {
    return MEASUREMENT_CONFIGS.smartphone;
  } else if (deviceConfig.deviceType === 'tablet') {
    return MEASUREMENT_CONFIGS.tablet;
  } else {
    return MEASUREMENT_CONFIGS.desktop;
  }
}

// Función para ajustar configuración según el rendimiento
export function adjustConfigForPerformance(
  baseConfig: OpenCVDetectionConfig,
  performanceMetrics: {
    averageProcessingTime: number;
    targetFPS: number;
    currentFPS: number;
  }
): OpenCVDetectionConfig {
  const adjustedConfig = { ...baseConfig };
  
  // Si el procesamiento es muy lento, reducir la complejidad
  if (performanceMetrics.averageProcessingTime > 100) {
    adjustedConfig.enableMultiScale = false;
    adjustedConfig.enableTemporalStabilization = false;
    adjustedConfig.maxObjects = Math.max(2, adjustedConfig.maxObjects - 2);
    adjustedConfig.gaussianBlurSigma = Math.max(0.5, adjustedConfig.gaussianBlurSigma - 0.5);
  }
  
  // Si el FPS es muy bajo, simplificar más
  if (performanceMetrics.currentFPS < performanceMetrics.targetFPS * 0.5) {
    adjustedConfig.enable3D = false;
    adjustedConfig.morphologyIterations = Math.max(1, adjustedConfig.morphologyIterations - 1);
    adjustedConfig.confidenceThreshold = Math.min(0.9, adjustedConfig.confidenceThreshold + 0.1);
  }
  
  return adjustedConfig;
}

// Función para validar configuración
export function validateConfig(config: OpenCVDetectionConfig): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  if (config.minObjectArea < 100) {
    warnings.push('Área mínima muy pequeña puede causar detecciones falsas');
  }
  
  if (config.maxObjects > 20) {
    warnings.push('Demasiados objetos pueden afectar el rendimiento');
  }
  
  if (config.confidenceThreshold < 0.1) {
    errors.push('Umbral de confianza muy bajo');
  }
  
  if (config.confidenceThreshold > 0.95) {
    warnings.push('Umbral de confianza muy alto puede perder objetos válidos');
  }
  
  if (config.gaussianBlurSigma < 0.1 || config.gaussianBlurSigma > 5.0) {
    errors.push('Sigma de blur Gaussiano fuera de rango válido');
  }
  
  if (config.cannyLowThreshold >= config.cannyHighThreshold) {
    errors.push('Umbral bajo de Canny debe ser menor que el alto');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}
