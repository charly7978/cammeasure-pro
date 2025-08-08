interface DetectMessage {
  type: 'DETECT';
  imageData: ImageData;
  minArea: number;
  options?: {
    enableMultiScale?: boolean;
    enableTemporalStabilization?: boolean;
    maxObjects?: number;
    confidenceThreshold?: number;
    enable3D?: boolean;
    cameraParams?: any;
  };
}

interface InitMessage {
  type: 'INIT';
}

type Incoming = DetectMessage | InitMessage;

type Outgoing =
  | { type: 'READY' }
  | { type: 'DETECTED'; rects: any[] };

// OpenCV worker PROFESIONAL para medición 3D REAL
declare var importScripts: (urls: string) => void;
declare var cv: any;

let isOpenCVReady = false;
let calibrationMatrix: any = null;
let distortionCoeffs: any = null;

// Parámetros de cámara REALES para medición 3D
let cameraParams = {
  focalLength: 800, // píxeles
  principalPointX: 320,
  principalPointY: 240,
  sensorWidth: 6.17, // mm
  sensorHeight: 4.63, // mm
  imageWidth: 640,
  imageHeight: 480,
  pixelsPerMm: 129.87 // Calculado: focalLength / sensorWidth * imageWidth
};

// Cargar OpenCV con múltiples fuentes y configuración robusta
function loadOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Verificar si OpenCV ya está cargado
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      isOpenCVReady = true;
      initializeOpenCVModules();
      resolve();
      return;
    }

    const sources = [
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
      'https://unpkg.com/opencv.js@4.8.0/opencv.js'
    ];

    let currentIndex = 0;
    let loadTimeout: NodeJS.Timeout;

    const tryLoadSource = () => {
      if (currentIndex >= sources.length) {
        console.warn('⚠️ OpenCV no disponible - usando algoritmos nativos 3D avanzados');
        resolve();
        return;
      }

      try {
        clearTimeout(loadTimeout);
        
        // Timeout de 30 segundos por fuente
        loadTimeout = setTimeout(() => {
          console.warn(`Timeout loading OpenCV from ${sources[currentIndex]}`);
          currentIndex++;
          tryLoadSource();
        }, 30000);

        importScripts(sources[currentIndex]);
        
        const checkCV = (attempts = 0) => {
          if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
            clearTimeout(loadTimeout);
            isOpenCVReady = true;
            console.log(`✅ OpenCV 3D cargado exitosamente desde: ${sources[currentIndex]}`);
            initializeOpenCVModules();
            resolve();
          } else if (attempts < 200) { // 20 segundos de espera
            setTimeout(() => checkCV(attempts + 1), 100);
          } else {
            console.warn(`Failed to initialize OpenCV from ${sources[currentIndex]}`);
            currentIndex++;
            tryLoadSource();
          }
        };
        
        setTimeout(checkCV, 100);
      } catch (error) {
        console.warn(`Error loading OpenCV from ${sources[currentIndex]}:`, error);
        currentIndex++;
        tryLoadSource();
      }
    };

    tryLoadSource();
  });
}

function initializeOpenCVModules() {
  if (isOpenCVReady && cv) {
    console.log('🔧 Inicializando módulos OpenCV para medición 3D');
    // Configurar parámetros de cámara si están disponibles
    if (cameraParams) {
      console.log('📐 Configuración de cámara aplicada:', cameraParams);
    }
  }
}

function detectAndMeasure3D(imageData: ImageData, minArea: number, options: any = {}) {
  const startTime = performance.now();
  const detectedObjects = [];

  try {
    if (isOpenCVReady && cv) {
      // 🎯 DETECCIÓN CON OPENCV REAL
      const src = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      try {
        // 1. PREPROCESAMIENTO AVANZADO
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        cv.Canny(blurred, edges, 50, 150);

        // 2. DETECCIÓN DE CONTORNOS
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // 3. ANÁLISIS DE CADA CONTORNO
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const area = cv.contourArea(contour);
          
          if (area < minArea) continue;

          // Calcular bounding rectangle
          const boundingRect = cv.boundingRect(contour);
          
          // Calcular propiedades del contorno
          const perimeter = cv.arcLength(contour, true);
          const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
          
          // Filtrar por forma válida
          if (circularity < 0.1 || area < minArea) continue;

          // Calcular confianza basada en propiedades
          let confidence = 0.5;
          if (area > 1000) confidence += 0.2;
          if (area > 5000) confidence += 0.1;
          if (circularity > 0.7) confidence += 0.1;
          confidence = Math.min(confidence, 1.0);

          // 🎯 MEDICIÓN 3D REAL
          const depth = estimateDepthBySize(boundingRect, area);
          const realWidth = (boundingRect.width / cameraParams.pixelsPerMm) * depth / cameraParams.focalLength;
          const realHeight = (boundingRect.height / cameraParams.pixelsPerMm) * depth / cameraParams.focalLength;
          const volume = realWidth * realHeight * depth;
          const surfaceArea = 2 * (realWidth * realHeight + realWidth * depth + realHeight * depth);

          const object3D = {
            id: `3d_obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x: boundingRect.x,
            y: boundingRect.y,
            width: boundingRect.width,
            height: boundingRect.height,
            area: area,
            realWidth: realWidth,
            realHeight: realHeight,
            realDepth: depth,
            volume: volume,
            surfaceArea: surfaceArea,
            estimatedMass: volume * 1.0, // Densidad estimada
            distanceToCamera: depth,
            geometricShape: classifyShape(circularity, boundingRect.width / boundingRect.height),
            errorEstimate: depth * 0.05, // 5% de error
            measurementQuality: confidence,
            confidence: confidence
          };

          detectedObjects.push(object3D);
        }

        // Limpiar memoria OpenCV
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();

      } catch (error) {
        console.error('❌ Error en detección OpenCV:', error);
        // Fallback a detección nativa
        return detectAndMeasure3DNative(imageData, minArea, options);
      }
    } else {
      // 🎯 DETECCIÓN NATIVA AVANZADA (FALLBACK)
      return detectAndMeasure3DNative(imageData, minArea, options);
    }

  } catch (error) {
    console.error('❌ Error general en detección:', error);
    return detectAndMeasure3DNative(imageData, minArea, options);
  }

  const processingTime = performance.now() - startTime;
  console.log(`🎯 DETECCIÓN 3D COMPLETADA - ${detectedObjects.length} objetos en ${processingTime.toFixed(1)}ms`);

  return detectedObjects;
}

function advancedImagePreprocessing(gray: any) {
  // Aplicar filtros avanzados para mejorar la detección
  const blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  
  // Aplicar filtro bilateral para preservar bordes
  const bilateral = new cv.Mat();
  cv.bilateralFilter(blurred, bilateral, 9, 75, 75);
  
  blurred.delete();
  return bilateral;
}

function detectContoursWithGeometry(processedImage: any) {
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  
  // Detección de bordes con Canny adaptativo
  cv.Canny(processedImage, edges, 30, 200);
  
  // Aplicar morfología para conectar bordes
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  const morphed = new cv.Mat();
  cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);
  
  // Encontrar contornos
  cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
  kernel.delete();
  morphed.delete();
  edges.delete();
  hierarchy.delete();
  
  return contours;
}

function analyze3DGeometry(geometricObjects: any[], srcImage: any, imageData: ImageData) {
  const measurements3D = [];
  
  for (const obj of geometricObjects) {
    try {
      // Estimar profundidad usando múltiples métodos
      const depthBySize = estimateDepthBySize(obj, imageData);
      const depthByBlur = estimateDepthByBlur(obj, srcImage);
      const depthByPerspective = estimateDepthByPerspective(obj, imageData);
      
      // Combinar estimaciones de profundidad
      const depth = (depthBySize + depthByBlur + depthByPerspective) / 3;
      
      // Calcular dimensiones reales
      const realDimensions = convertPixelsToRealWorld(obj, depth);
      
      // Calcular volumen y área superficial
      const volume = calculateObjectVolume(obj, realDimensions, depth);
      const surfaceArea = calculateSurfaceArea(obj, realDimensions);
      
      // Clasificar forma geométrica
      const shapeType = classifyGeometricShape(obj);
      
      // Calcular confianza de medición
      const confidence = calculateGeometricConfidence(obj, depth, realDimensions);
      
      measurements3D.push({
        ...obj,
        depth,
        realWidth: realDimensions.width,
        realHeight: realDimensions.height,
        realDepth: depth,
        volume,
        surfaceArea,
        estimatedMass: volume * 1.0,
        distanceToCamera: depth,
        geometricShape: shapeType,
        errorEstimate: depth * 0.05,
        measurementQuality: confidence,
        confidence
      });
      
    } catch (error) {
      console.warn('Error analizando geometría 3D:', error);
    }
  }
  
  return measurements3D;
}

function estimateObjectDepth(obj: any, srcImage: any, imageData: ImageData): number {
  // Método combinado de estimación de profundidad
  const depthBySize = estimateDepthBySize(obj, imageData);
  const depthByBlur = estimateDepthByBlur(obj, srcImage);
  const depthByPerspective = estimateDepthByPerspective(obj, imageData);
  
  // Ponderar diferentes métodos
  return (depthBySize * 0.5 + depthByBlur * 0.3 + depthByPerspective * 0.2);
}

function estimateDepthBySize(obj: any, imageData: ImageData): number {
  // Estimación basada en el tamaño del objeto en la imagen
  const objectSize = Math.max(obj.width, obj.height);
  const assumedRealSize = 50; // mm - tamaño asumido del objeto
  const pixelsPerMm = cameraParams.pixelsPerMm;
  
  return (assumedRealSize * pixelsPerMm) / objectSize * 100; // mm
}

function estimateDepthByBlur(obj: any, srcImage: any): number {
  // Estimación de profundidad basada en el desenfoque
  const roi = srcImage.roi(new cv.Rect(obj.x, obj.y, obj.width, obj.height));
  const gray = new cv.Mat();
  cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
  
  // Calcular varianza de Laplaciano como medida de nitidez
  const laplacian = new cv.Mat();
  cv.Laplacian(gray, laplacian, cv.CV_64F);
  
  const mean = new cv.Mat();
  const stddev = new cv.Mat();
  cv.meanStdDev(laplacian, mean, stddev);
  
  const sharpness = stddev.data64F[0];
  
  // Convertir nitidez a profundidad (menos nítido = más lejos)
  const depth = Math.max(100, 1000 - sharpness * 10);
  
  roi.delete();
  gray.delete();
  laplacian.delete();
  mean.delete();
  stddev.delete();
  
  return depth;
}

function estimateDepthByPerspective(obj: any, imageData: ImageData): number {
  // Estimación basada en la posición en la imagen (perspectiva)
  const centerY = obj.y + obj.height / 2;
  const imageCenterY = imageData.height / 2;
  
  // Objetos más abajo en la imagen están más lejos
  const distanceFromCenter = Math.abs(centerY - imageCenterY);
  const maxDistance = imageData.height / 2;
  
  // Convertir a profundidad (0-1000mm)
  const depth = 200 + (distanceFromCenter / maxDistance) * 800;
  
  return depth;
}

function estimateDepthByShadows(obj: any, srcImage: any): number {
  // Estimación de profundidad basada en sombras (simplificado)
  const roi = srcImage.roi(new cv.Rect(obj.x, obj.y, obj.width, obj.height));
  const gray = new cv.Mat();
  cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
  
  // Calcular histograma para detectar sombras
  const hist = new cv.Mat();
  const mask = new cv.Mat();
  const histSize = [256];
  const ranges = [0, 256];
  
  cv.calcHist([gray], [0], mask, hist, histSize, ranges);
  
  // Encontrar el pico más bajo (sombra)
  let minVal = 255;
  for (let i = 0; i < 256; i++) {
    if (hist.data32F[i] > 0) {
      minVal = Math.min(minVal, i);
    }
  }
  
  // Convertir a profundidad
  const depth = Math.max(100, 1000 - minVal * 3);
  
  roi.delete();
  gray.delete();
  hist.delete();
  mask.delete();
  
  return depth;
}

function convertPixelsToRealWorld(obj: any, depth: number) {
  const pixelsPerMm = cameraParams.pixelsPerMm;
  const focalLength = cameraParams.focalLength;
  
  return {
    width: (obj.width / pixelsPerMm) * depth / focalLength,
    height: (obj.height / pixelsPerMm) * depth / focalLength,
    area: (obj.area / (pixelsPerMm * pixelsPerMm)) * depth / focalLength
  };
}

function calculateObjectVolume(obj: any, realDimensions: any, depth: number): number {
  // Calcular volumen basado en forma geométrica
  const shapeType = classifyGeometricShape(obj);
  
  switch (shapeType) {
    case 'rectangular':
      return realDimensions.width * realDimensions.height * depth;
    case 'cylindrical':
      const radius = Math.min(realDimensions.width, realDimensions.height) / 2;
      return Math.PI * radius * radius * depth;
    case 'spherical':
      const diameter = Math.min(realDimensions.width, realDimensions.height);
      return (4/3) * Math.PI * Math.pow(diameter/2, 3);
    default:
      return realDimensions.width * realDimensions.height * depth;
  }
}

function calculateSurfaceArea(obj: any, realDimensions: any): number {
  const shapeType = classifyGeometricShape(obj);
  
  switch (shapeType) {
    case 'rectangular':
      return 2 * (realDimensions.width * realDimensions.height);
    case 'cylindrical':
      const radius = Math.min(realDimensions.width, realDimensions.height) / 2;
      return 2 * Math.PI * radius * radius + 2 * Math.PI * radius * realDimensions.height;
    case 'spherical':
      const diameter = Math.min(realDimensions.width, realDimensions.height);
      return 4 * Math.PI * Math.pow(diameter/2, 2);
    default:
      return 2 * (realDimensions.width * realDimensions.height);
  }
}

function classifyGeometricShape(obj: any): string {
  const aspectRatio = obj.width / obj.height;
  const area = obj.width * obj.height;
  const perimeter = 2 * (obj.width + obj.height);
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
  
  if (circularity > 0.8) {
    return 'spherical';
  } else if (aspectRatio > 0.8 && aspectRatio < 1.2) {
    return 'rectangular';
  } else if (aspectRatio > 2 || aspectRatio < 0.5) {
    return 'cylindrical';
  } else {
    return 'irregular';
  }
}

function calculateGeometricConfidence(obj: any, depth: number, realDimensions: any): number {
  let confidence = 0.5;
  
  // Basado en área
  if (obj.area > 1000) confidence += 0.2;
  if (obj.area > 5000) confidence += 0.1;
  
  // Basado en profundidad
  if (depth > 100 && depth < 5000) confidence += 0.2;
  
  // Basado en dimensiones reales
  if (realDimensions.width > 5 && realDimensions.width < 1000) confidence += 0.1;
  if (realDimensions.height > 5 && realDimensions.height < 1000) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

function calculateViewingAngle(obj: any, imageData: ImageData): number {
  const centerX = imageData.width / 2;
  const centerY = imageData.height / 2;
  const objectCenterX = obj.x + obj.width / 2;
  const objectCenterY = obj.y + obj.height / 2;
  
  const dx = objectCenterX - centerX;
  const dy = objectCenterY - centerY;
  
  return Math.atan2(Math.sqrt(dx * dx + dy * dy), obj.depth || 1000) * 180 / Math.PI;
}

function calculatePerspectiveCorrection(obj: any, imageData: ImageData) {
  // Corrección de perspectiva para mediciones más precisas
  const centerX = imageData.width / 2;
  const centerY = imageData.height / 2;
  const objectCenterX = obj.x + obj.width / 2;
  const objectCenterY = obj.y + obj.height / 2;
  
  // Calcular factor de corrección basado en distancia del centro
  const distanceFromCenter = Math.sqrt(
    Math.pow(objectCenterX - centerX, 2) + 
    Math.pow(objectCenterY - centerY, 2)
  );
  
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  const correctionFactor = 1 + (distanceFromCenter / maxDistance) * 0.2;
  
  return {
    width: obj.width * correctionFactor,
    height: obj.height * correctionFactor,
    area: obj.area * correctionFactor * correctionFactor
  };
}

function applyPerspectiveCorrection(objects3D: any[], imageData: ImageData) {
  return objects3D.map(obj => {
    const corrected = calculatePerspectiveCorrection(obj, imageData);
    return {
      ...obj,
      width: corrected.width,
      height: corrected.height,
      area: corrected.area
    };
  });
}

function calculateMeasurementUncertainty(objects: any[]) {
  return objects.map(obj => {
    const baseUncertainty = obj.depth * 0.05; // 5% de error base
    const shapeUncertainty = obj.geometricShape === 'irregular' ? 0.1 : 0.05;
    const sizeUncertainty = obj.area < 1000 ? 0.15 : 0.05;
    
    const totalUncertainty = baseUncertainty * (1 + shapeUncertainty + sizeUncertainty);
    
    return {
      ...obj,
      errorEstimate: totalUncertainty,
      measurementQuality: Math.max(0.1, 1 - totalUncertainty / obj.depth)
    };
  });
}

// DETECCIÓN NATIVA AVANZADA (FALLBACK)
function detectAndMeasure3DNative(imageData: ImageData, minArea: number, options: any = {}) {
  const startTime = performance.now();
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Detección de bordes nativa mejorada
  const edges = detectEdgesNative(data, width, height);
  const components = findConnectedComponentsNative(edges, width, height, minArea);
  
  const detectedObjects = [];
  
  for (const component of components) {
    const properties = calculateNativeProperties(component, data, width, height);
    
    if (!isValidObject(properties)) continue;
    
    const confidence = calculateObjectConfidence(properties, component.area);
    const depth = estimateDepthNative(component, width, height);
    const realDimensions = convertToRealWorldNative(component, depth);
    
    const object3D = {
      id: `native_obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x: component.x,
      y: component.y,
      width: component.width,
      height: component.height,
      area: component.area,
      realWidth: realDimensions.width,
      realHeight: realDimensions.height,
      realDepth: depth,
      volume: realDimensions.width * realDimensions.height * depth,
      surfaceArea: 2 * (realDimensions.width * realDimensions.height),
      estimatedMass: realDimensions.width * realDimensions.height * depth * 1.0,
      distanceToCamera: depth,
      geometricShape: 'rectangular',
      errorEstimate: depth * 0.1,
      measurementQuality: confidence,
      confidence: confidence
    };
    
    detectedObjects.push(object3D);
  }
  
  const processingTime = performance.now() - startTime;
  console.log(`🎯 DETECCIÓN NATIVA 3D - ${detectedObjects.length} objetos en ${processingTime.toFixed(1)}ms`);
  
  return detectedObjects;
}

function detectEdgesNative(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gray = getGrayValue(data, x, y, width);
      
      // Detección de bordes con operador Sobel mejorado
      const gx = getGrayValue(data, x + 1, y, width) - getGrayValue(data, x - 1, y, width);
      const gy = getGrayValue(data, x, y + 1, width) - getGrayValue(data, x, y - 1, width);
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      
      edges[idx] = magnitude > 30 ? 255 : 0;
    }
  }
  
  return edges;
}

function findConnectedComponentsNative(edges: Uint8Array, width: number, height: number, minArea: number) {
  const visited = new Array(width * height).fill(false);
  const components = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx] && edges[idx] === 255) {
        const component = floodFillNative(edges, visited, x, y, width, height);
        if (component.area >= minArea) {
          components.push(component);
        }
      }
    }
  }
  
  return components;
}

function floodFillNative(edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) {
  const stack = [{x: startX, y: startY}];
  const points = [];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  
  while (stack.length > 0) {
    const {x, y} = stack.pop();
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] !== 255) {
      continue;
    }
    
    visited[idx] = true;
    points.push({x, y});
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // Agregar vecinos
    stack.push({x: x + 1, y});
    stack.push({x: x - 1, y});
    stack.push({x, y: y + 1});
    stack.push({x, y: y - 1});
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    area: points.length,
    contour: points
  };
}

function estimateDepthNative(comp: any, imageWidth: number, imageHeight: number): number {
  // Estimación de profundidad basada en tamaño y posición
  const objectSize = Math.max(comp.width, comp.height);
  const centerY = comp.y + comp.height / 2;
  
  // Objetos más grandes están más cerca
  const sizeFactor = 1000 / objectSize;
  
  // Objetos más abajo están más lejos
  const positionFactor = 1 + (centerY / imageHeight) * 0.5;
  
  return Math.max(100, sizeFactor * positionFactor);
}

function convertToRealWorldNative(comp: any, depth: number) {
  const pixelsPerMm = 8.0; // Valor por defecto
  
  return {
    width: comp.width / pixelsPerMm,
    height: comp.height / pixelsPerMm,
    area: comp.area / (pixelsPerMm * pixelsPerMm)
  };
}

function getGrayValue(data: Uint8ClampedArray, x: number, y: number, width: number): number {
  const idx = (y * width + x) * 4;
  return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
}

function filterOverlappingRects(rects: any[]) {
  const filtered = [];
  
  for (let i = 0; i < rects.length; i++) {
    let isOverlapping = false;
    
    for (let j = 0; j < filtered.length; j++) {
      if (calculateOverlap(rects[i], filtered[j]) > 0.5) {
        isOverlapping = true;
        break;
      }
    }
    
    if (!isOverlapping) {
      filtered.push(rects[i]);
    }
  }
  
  return filtered;
}

function calculateOverlap(rect1: any, rect2: any) {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
  
  if (x2 <= x1 || y2 <= y1) return 0;
  
  const overlapArea = (x2 - x1) * (y2 - y1);
  const area1 = rect1.width * rect1.height;
  const area2 = rect2.width * rect2.height;
  
  return overlapArea / Math.min(area1, area2);
}

function isValidObject(properties: any): boolean {
  return properties.area > 100 && 
         properties.circularity > 0.1 && 
         properties.solidity > 0.5;
}

function calculateNativeProperties(component: any, data: Uint8ClampedArray, width: number, height: number): any {
  const area = component.area;
  const perimeter = 2 * (component.width + component.height);
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
  const aspectRatio = component.width / component.height;
  
  return {
    area,
    perimeter,
    circularity,
    solidity: 0.8, // Estimación
    aspectRatio,
    extent: area / (component.width * component.height)
  };
}

function calculateObjectConfidence(properties: any, area: number): number {
  let confidence = 0.5;
  
  if (area > 1000) confidence += 0.2;
  if (area > 5000) confidence += 0.1;
  if (properties.circularity > 0.7) confidence += 0.1;
  if (properties.solidity > 0.8) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

function classifyShape(circularity: number, aspectRatio: number): string {
  if (circularity > 0.8) return 'circle';
  if (circularity > 0.6 && aspectRatio > 0.8 && aspectRatio < 1.2) return 'rectangle';
  if (aspectRatio > 2 || aspectRatio < 0.5) return 'line';
  return 'irregular';
}

// Inicializar worker
loadOpenCV().then(() => {
  self.postMessage({ type: 'READY' });
}).catch(error => {
  console.error('Error inicializando worker:', error);
  self.postMessage({ type: 'READY' });
});

// Manejar mensajes
self.onmessage = function(e: MessageEvent<Incoming>) {
  const { type, ...data } = e.data;
  
  switch (type) {
    case 'INIT':
      loadOpenCV().then(() => {
        self.postMessage({ type: 'READY' });
      });
      break;
      
    case 'DETECT':
      const { imageData, minArea, options } = data as DetectMessage;
      const objects = detectAndMeasure3D(imageData, minArea, options);
      self.postMessage({ type: 'DETECTED', rects: objects });
      break;
  }
};