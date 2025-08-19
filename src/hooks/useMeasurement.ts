// HOOK ESPECIALIZADO PARA MEDICIONES AVANZADAS
// Integra motor de mediciones geométricas
// Proporciona cálculos 2D, 3D y propiedades de forma

import { useState, useCallback, useRef, useEffect } from 'react';
import { MeasurementFactory, MeasurementResult, MeasurementParams } from '@/lib/algorithms/measurementEngine';

export interface MeasurementState {
  isCalculating: boolean;
  currentMeasurements: MeasurementResult | null;
  measurementHistory: MeasurementResult[];
  processingTime: number;
  error: string | null;
}

export interface MeasurementConfig {
  enable3D: boolean;
  enableAdvancedProperties: boolean;
  depthEstimationMethod: 'stereo' | 'size' | 'focus' | 'structured_light';
  calibrationData: {
    focalLength: number;
    sensorSize: number;
    baseline: number;
    pixelsPerMm: number;
  };
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  precision: number;
}

export interface MeasurementRequest {
  contour: any;
  imageData: ImageData;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

export const useMeasurement = (config: MeasurementConfig = getDefaultMeasurementConfig()) => {
  // ESTADO DE MEDICIONES
  const [measurementState, setMeasurementState] = useState<MeasurementState>({
    isCalculating: false,
    currentMeasurements: null,
    measurementHistory: [],
    processingTime: 0,
    error: null
  });

  // REFERENCIAS PARA PROCESAMIENTO
  const processingRef = useRef<boolean>(false);
  const measurementQueueRef = useRef<MeasurementRequest[]>([]);
  const lastResultRef = useRef<MeasurementResult | null>(null);

  // FUNCIÓN PRINCIPAL DE CÁLCULO DE MEDICIONES
  const calculateMeasurements = useCallback(async (
    contour: any,
    imageData: ImageData,
    forceCalculation: boolean = false
  ): Promise<MeasurementResult> => {
    if (processingRef.current && !forceCalculation) {
      return lastResultRef.current || createEmptyMeasurementResult();
    }

    try {
      processingRef.current = true;
      setMeasurementState(prev => ({ ...prev, isCalculating: true, error: null }));

      const startTime = performance.now();

      // 1. VALIDAR CONTOUR
      if (!isValidContour(contour)) {
        throw new Error('Contorno inválido para medición');
      }

      // 2. PREPARAR PARÁMETROS DE MEDICIÓN
      const measurementParams: MeasurementParams = {
        enable3D: config.enable3D,
        enableAdvancedProperties: config.enableAdvancedProperties,
        depthEstimationMethod: config.depthEstimationMethod,
        calibrationData: config.calibrationData
      };

      // 3. CALCULAR MEDICIONES CON MOTOR AVANZADO
      const measurementEngine = MeasurementFactory.createEngine('advanced');
      const result = await measurementEngine.calculateMeasurements(contour, imageData, measurementParams);

      // 4. CONVERTIR UNIDADES SI ES NECESARIO
      const convertedResult = convertUnits(result, config.units);

      // 5. APLICAR PRECISIÓN
      const preciseResult = applyPrecision(convertedResult, config.precision);

      const processingTime = performance.now() - startTime;

      // 6. ACTUALIZAR ESTADO
      const newState: MeasurementState = {
        isCalculating: false,
        currentMeasurements: preciseResult,
        measurementHistory: [...measurementState.measurementHistory, preciseResult].slice(-10), // Mantener últimos 10
        processingTime,
        error: null
      };

      setMeasurementState(newState);
      lastResultRef.current = preciseResult;
      processingRef.current = false;

      return preciseResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido en medición';
      
      setMeasurementState(prev => ({
        ...prev,
        isCalculating: false,
        error: errorMessage
      }));

      processingRef.current = false;
      throw new Error(`Fallo en cálculo de mediciones: ${errorMessage}`);
    }
  }, [config, measurementState.measurementHistory]);

  // VALIDACIÓN DE CONTOUR
  const isValidContour = (contour: any): boolean => {
    try {
      return (
        contour &&
        contour.points &&
        Array.isArray(contour.points) &&
        contour.points.length >= 3 &&
        contour.boundingBox &&
        typeof contour.area === 'number' &&
        typeof contour.perimeter === 'number'
      );
    } catch (error) {
      return false;
    }
  };

  // CONVERSIÓN DE UNIDADES
  const convertUnits = (result: MeasurementResult, targetUnit: string): MeasurementResult => {
    try {
      const conversionFactors = {
        'mm': 1,
        'cm': 0.1,
        'm': 0.001,
        'in': 0.0393701,
        'ft': 0.00328084
      };

      const factor = conversionFactors[targetUnit] || 1;

      return {
        ...result,
        width: result.width * factor,
        height: result.height * factor,
        area: result.area * (factor * factor),
        perimeter: result.perimeter * factor,
        depth: result.depth * factor,
        volume: result.volume * (factor * factor * factor),
        surfaceArea: result.surfaceArea * (factor * factor),
        unit: targetUnit
      };
    } catch (error) {
      console.error('Error en conversión de unidades:', error);
      return result;
    }
  };

  // APLICACIÓN DE PRECISIÓN
  const applyPrecision = (result: MeasurementResult, precision: number): MeasurementResult => {
    try {
      const roundToPrecision = (value: number): number => {
        return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
      };

      return {
        ...result,
        width: roundToPrecision(result.width),
        height: roundToPrecision(result.height),
        area: roundToPrecision(result.area),
        perimeter: roundToPrecision(result.perimeter),
        depth: roundToPrecision(result.depth),
        volume: roundToPrecision(result.volume),
        surfaceArea: roundToPrecision(result.surfaceArea),
        aspectRatio: roundToPrecision(result.aspectRatio),
        circularity: roundToPrecision(result.circularity),
        compactness: roundToPrecision(result.compactness),
        solidity: roundToPrecision(result.solidity),
        extent: roundToPrecision(result.extent),
        curvature: roundToPrecision(result.curvature),
        smoothness: roundToPrecision(result.smoothness),
        symmetry: roundToPrecision(result.symmetry),
        orientation: roundToPrecision(result.orientation),
        confidence: roundToPrecision(result.confidence)
      };
    } catch (error) {
      console.error('Error en aplicación de precisión:', error);
      return result;
    }
  };

  // CÁLCULO DE MEDICIONES EN LOTE
  const calculateBatchMeasurements = useCallback(async (
    contours: any[],
    imageData: ImageData
  ): Promise<MeasurementResult[]> => {
    try {
      const results: MeasurementResult[] = [];
      
      for (const contour of contours) {
        try {
          const result = await calculateMeasurements(contour, imageData, true);
          results.push(result);
        } catch (error) {
          console.error(`Error en medición de contorno ${contour.id}:`, error);
          // Continuar con el siguiente contorno
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error en mediciones en lote:', error);
      throw new Error(`Fallo en mediciones en lote: ${error}`);
    }
  }, [calculateMeasurements]);

  // CÁLCULO DE MEDICIONES COMPARATIVAS
  const calculateComparativeMeasurements = useCallback(async (
    referenceContour: any,
    targetContour: any,
    imageData: ImageData
  ): Promise<{
    reference: MeasurementResult;
    target: MeasurementResult;
    comparison: {
      sizeRatio: number;
      areaRatio: number;
      similarity: number;
    };
  }> => {
    try {
      const [referenceResult, targetResult] = await Promise.all([
        calculateMeasurements(referenceContour, imageData, true),
        calculateMeasurements(targetContour, imageData, true)
      ]);

      // Calcular ratios comparativos
      const sizeRatio = targetResult.width / referenceResult.width;
      const areaRatio = targetResult.area / referenceResult.area;
      
      // Calcular similitud basada en propiedades de forma
      const similarity = calculateShapeSimilarity(referenceResult, targetResult);

      return {
        reference: referenceResult,
        target: targetResult,
        comparison: {
          sizeRatio,
          areaRatio,
          similarity
        }
      };
    } catch (error) {
      console.error('Error en mediciones comparativas:', error);
      throw new Error(`Fallo en mediciones comparativas: ${error}`);
    }
  }, [calculateMeasurements]);

  // CÁLCULO DE SIMILITUD DE FORMA
  const calculateShapeSimilarity = (result1: MeasurementResult, result2: MeasurementResult): number => {
    try {
      // Factores de similitud
      const aspectRatioSimilarity = 1 - Math.abs(result1.aspectRatio - result2.aspectRatio) / Math.max(result1.aspectRatio, result2.aspectRatio);
      const circularitySimilarity = 1 - Math.abs(result1.circularity - result2.circularity);
      const soliditySimilarity = 1 - Math.abs(result1.solidity - result2.solidity);
      
      // Similitud ponderada
      const similarity = (
        aspectRatioSimilarity * 0.4 +
        circularitySimilarity * 0.3 +
        soliditySimilarity * 0.3
      );
      
      return Math.max(0, Math.min(1, similarity));
    } catch (error) {
      return 0;
    }
  };

  // AGREGAR MEDICIÓN A LA COLA
  const queueMeasurement = useCallback((request: MeasurementRequest) => {
    measurementQueueRef.current.push(request);
    
    // Ordenar por prioridad
    measurementQueueRef.current.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, []);

  // PROCESAR COLA DE MEDICIONES
  const processMeasurementQueue = useCallback(async () => {
    if (measurementQueueRef.current.length === 0 || processingRef.current) {
      return;
    }

    const request = measurementQueueRef.current.shift();
    if (request) {
      try {
        await calculateMeasurements(request.contour, request.imageData, true);
      } catch (error) {
        console.error('Error procesando medición de la cola:', error);
      }
    }
  }, [calculateMeasurements]);

  // LIMPIAR ESTADO
  const clearMeasurements = useCallback(() => {
    setMeasurementState({
      isCalculating: false,
      currentMeasurements: null,
      measurementHistory: [],
      processingTime: 0,
      error: null
    });
    lastResultRef.current = null;
    measurementQueueRef.current = [];
  }, []);

  // EXPORTAR MEDICIONES
  const exportMeasurements = useCallback((format: 'json' | 'csv' | 'txt' = 'json') => {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        measurements: measurementState.measurementHistory,
        config
      };

      switch (format) {
        case 'json':
          return JSON.stringify(data, null, 2);
        case 'csv':
          return convertToCSV(data.measurements);
        case 'txt':
          return convertToText(data.measurements);
        default:
          return JSON.stringify(data, null, 2);
      }
    } catch (error) {
      console.error('Error exportando mediciones:', error);
      throw new Error(`Fallo en exportación: ${error}`);
    }
  }, [measurementState.measurementHistory, config]);

  // CONVERSIÓN A CSV
  const convertToCSV = (measurements: MeasurementResult[]): string => {
    try {
      if (measurements.length === 0) return '';
      
      const headers = Object.keys(measurements[0]).join(',');
      const rows = measurements.map(m => 
        Object.values(m).map(v => typeof v === 'string' ? `"${v}"` : v).join(',')
      );
      
      return [headers, ...rows].join('\n');
    } catch (error) {
      return '';
    }
  };

  // CONVERSIÓN A TEXTO
  const convertToText = (measurements: MeasurementResult[]): string => {
    try {
      if (measurements.length === 0) return 'No hay mediciones disponibles';
      
      return measurements.map((m, i) => 
        `Medición ${i + 1}:\n` +
        `  Ancho: ${m.width} ${m.unit}\n` +
        `  Alto: ${m.height} ${m.unit}\n` +
        `  Área: ${m.area} ${m.unit}²\n` +
        `  Perímetro: ${m.perimeter} ${m.unit}\n` +
        `  Confianza: ${(m.confidence * 100).toFixed(1)}%\n`
      ).join('\n');
    } catch (error) {
      return 'Error en conversión a texto';
    }
  };

  // EFECTO PARA PROCESAR COLA PERIÓDICAMENTE
  useEffect(() => {
    const interval = setInterval(processMeasurementQueue, 100);
    return () => clearInterval(interval);
  }, [processMeasurementQueue]);

  return {
    // ESTADO
    ...measurementState,
    
    // FUNCIONES PRINCIPALES
    calculateMeasurements,
    calculateBatchMeasurements,
    calculateComparativeMeasurements,
    
    // FUNCIONES DE CONTROL
    queueMeasurement,
    processMeasurementQueue,
    clearMeasurements,
    exportMeasurements,
    
    // REFERENCIAS
    lastResult: lastResultRef.current,
    measurementQueue: measurementQueueRef.current
  };
};

// FUNCIÓN PARA OBTENER CONFIGURACIÓN POR DEFECTO
export const getDefaultMeasurementConfig = (): MeasurementConfig => ({
  enable3D: true,
  enableAdvancedProperties: true,
  depthEstimationMethod: 'size',
  calibrationData: {
    focalLength: 1000,
    sensorSize: 6.17,
    baseline: 100,
    pixelsPerMm: 10
  },
  units: 'mm',
  precision: 2
});

// FUNCIÓN PARA CREAR RESULTADO DE MEDICIÓN VACÍO
export const createEmptyMeasurementResult = (): MeasurementResult => ({
  width: 0,
  height: 0,
  area: 0,
  perimeter: 0,
  depth: 0,
  volume: 0,
  surfaceArea: 0,
  aspectRatio: 0,
  circularity: 0,
  compactness: 0,
  solidity: 0,
  extent: 0,
  curvature: 0,
  smoothness: 0,
  symmetry: 0,
  orientation: 0,
  unit: 'mm',
  confidence: 0,
  pixelsPerMm: 10,
  processingTime: 0
});

// FUNCIÓN PARA OBTENER CONFIGURACIÓN OPTIMIZADA POR TIPO DE APLICACIÓN
export const getOptimizedMeasurementConfig = (applicationType: string): MeasurementConfig => {
  const baseConfig = getDefaultMeasurementConfig();
  
  switch (applicationType) {
    case 'precision_engineering':
      return {
        ...baseConfig,
        precision: 4,
        units: 'mm',
        enableAdvancedProperties: true
      };
      
    case 'medical_imaging':
      return {
        ...baseConfig,
        precision: 3,
        units: 'mm',
        depthEstimationMethod: 'focus',
        enable3D: true
      };
      
    case 'construction':
      return {
        ...baseConfig,
        precision: 1,
        units: 'cm',
        enable3D: true,
        depthEstimationMethod: 'stereo'
      };
      
    case 'quality_control':
      return {
        ...baseConfig,
        precision: 2,
        units: 'mm',
        enableAdvancedProperties: true,
        confidence: 0.8
      };
      
    default:
      return baseConfig;
  }
};
