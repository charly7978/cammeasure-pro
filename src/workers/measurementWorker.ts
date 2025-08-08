// Worker de Medición Avanzado para CamMeasure Pro
// Soporta OpenCV y algoritmos nativos para detección de objetos

interface DetectMessage {
  type: 'DETECT';
  taskId: string;
  imageData: ImageData;
  minArea: number;
}

interface InitMessage {
  type: 'INIT';
  taskId: string;
}

interface StatusMessage {
  type: 'STATUS';
  taskId: string;
  status: 'processing' | 'completed' | 'error';
  message?: string;
}

type IncomingMessage = DetectMessage | InitMessage | StatusMessage;

interface DetectedObject {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  confidence: number;
  circularity: number;
  solidity: number;
  extent: number;
  aspectRatio: number;
  compactness: number;
  perimeter: number;
  contourPoints: number;
  centerX: number;
  centerY: number;
  huMoments: number[];
  isConvex: boolean;
  boundingCircleRadius: number;
  depth?: number;
  realWidth?: number;
  realHeight?: number;
}

interface DetectionResult {
  taskId: string;
  objects: DetectedObject[];
  processingTime: number;
  algorithm: 'opencv' | 'native';
  isOpenCVReady: boolean;
}

interface WorkerResponse {
  taskId: string;
  type: 'SUCCESS' | 'ERROR' | 'STATUS';
  data?: DetectionResult;
  error?: string;
  message?: string;
}

declare var importScripts: (urls: string) => void;
declare var cv: any;

let workerState = {
  isOpenCVReady: false,
  isInitialized: false,
  isProcessing: false,
  totalProcessed: 0,
  averageProcessingTime: 0,
  lastError: null as string | null
};

function sendStatus(taskId: string, status: 'processing' | 'completed' | 'error', message?: string): void {
  const response: WorkerResponse = {
    taskId,
    type: 'STATUS',
    message: message || `Estado: ${status}`
  };
  self.postMessage(response);
}

function sendSuccess(taskId: string, data: DetectionResult): void {
  const response: WorkerResponse = {
    taskId,
    type: 'SUCCESS',
    data
  };
  self.postMessage(response);
}

function sendError(taskId: string, error: string): void {
  const response: WorkerResponse = {
    taskId,
    type: 'ERROR',
    error
  };
  self.postMessage(response);
}

async function loadOpenCV(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      workerState.isOpenCVReady = true;
      resolve(true);
      return;
    }

    const opencvSources = [
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
      'https://unpkg.com/opencv.js@4.8.0/opencv.js'
    ];

    const tryLoadSource = (index: number): void => {
      if (index >= opencvSources.length) {
        console.warn('⚠️ OpenCV no disponible, usando algoritmos nativos avanzados');
        workerState.isOpenCVReady = false;
        resolve(false);
        return;
      }

      try {
        importScripts(opencvSources[index]);
        
        const checkCV = () => {
          if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
            workerState.isOpenCVReady = true;
            console.log('✅ OpenCV cargado - algoritmos avanzados habilitados');
            resolve(true);
          } else {
            setTimeout(checkCV, 100);
          }
        };
        
        setTimeout(checkCV, 100);
        
      } catch (error) {
        console.warn(`Falló fuente ${index}, probando siguiente...`);
        tryLoadSource(index + 1);
      }
    };

    tryLoadSource(0);
  });
}

async function detectObjects(imageData: ImageData, minArea: number, taskId: string): Promise<DetectionResult> {
  const startTime = performance.now();
  
  try {
    sendStatus(taskId, 'processing', 'Iniciando detección de objetos...');
    
    if (workerState.isOpenCVReady && cv) {
      const result = await detectContoursOpenCVAdvanced(imageData, minArea, taskId);
      const processingTime = performance.now() - startTime;
      
      return {
        taskId,
        objects: result,
        processingTime,
        algorithm: 'opencv',
        isOpenCVReady: true
      };
    } else {
      const result = await detectContoursNativeAdvanced(imageData, minArea, taskId);
      const processingTime = performance.now() - startTime;
      
      return {
        taskId,
        objects: result,
        processingTime,
        algorithm: 'native',
        isOpenCVReady: false
      };
    }
  } catch (error) {
    const processingTime = performance.now() - startTime;
    throw new Error(`Error en detección: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

async function detectContoursOpenCVAdvanced(imageData: ImageData, minArea: number, taskId: string): Promise<DetectedObject[]> {
  sendStatus(taskId, 'processing', 'Aplicando algoritmos OpenCV avanzados...');
  
  try {
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    const denoised = new cv.Mat();
    cv.bilateralFilter(gray, denoised, 15, 80, 80);
    
    const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    const enhanced = new cv.Mat();
    clahe.apply(denoised, enhanced);
    
    const edges = new cv.Mat();
    cv.Canny(enhanced, edges, 50, 150, 3, false);
    
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    const morphed = new cv.Mat();
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);
    
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const objects: DetectedObject[] = [];
    
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const area = cv.contourArea(contour);
      
      if (area < minArea) continue;
      
      const perimeter = cv.arcLength(contour, true);
      const moments = cv.moments(contour);
      const centerX = moments.m10 / moments.m00;
      const centerY = moments.m01 / moments.m00;
      
      const hull = new cv.Mat();
      cv.convexHull(contour, hull, false, true);
      const hullArea = cv.contourArea(hull);
      
      const solidity = hullArea > 0 ? area / hullArea : 0;
      const extent = area / (rect.width * rect.height);
      const aspectRatio = rect.width / rect.height;
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      const compactness = (perimeter * perimeter) / area;
      
      const huMoments = cv.HuMoments(moments);
      const huMomentsArray = [];
      for (let j = 0; j < huMoments.rows; j++) {
        huMomentsArray.push(huMoments.data32F[j]);
      }
      
      const minEnclosingCircle = cv.minEnclosingCircle(contour);
      const boundingCircleRadius = minEnclosingCircle.radius;
      const isConvex = cv.isContourConvex(contour);
      
      const confidence = calculateAdvancedPositionScore({
        area, solidity, circularity, extent, aspectRatio, compactness, perimeter
      });
      
      objects.push({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        area,
        confidence,
        circularity,
        solidity,
        extent,
        aspectRatio,
        compactness,
        perimeter,
        contourPoints: contour.rows,
        centerX,
        centerY,
        huMoments: huMomentsArray,
        isConvex,
        boundingCircleRadius
      });
    }
    
    src.delete();
    gray.delete();
    denoised.delete();
    enhanced.delete();
    edges.delete();
    kernel.delete();
    morphed.delete();
    contours.delete();
    hierarchy.delete();
    
    return objects;
  } catch (error) {
    throw new Error(`Error en detección OpenCV: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

async function detectContoursNativeAdvanced(imageData: ImageData, minArea: number, taskId: string): Promise<DetectedObject[]> {
  sendStatus(taskId, 'processing', 'Aplicando algoritmos nativos avanzados...');
  
  try {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    const grayData = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      grayData[i / 4] = gray;
    }
    
    const edges = new Uint8ClampedArray(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const gx = -grayData[idx - width - 1] + grayData[idx - width + 1] +
                   -2 * grayData[idx - 1] + 2 * grayData[idx + 1] +
                   -grayData[idx + width - 1] + grayData[idx + width + 1];
        const gy = -grayData[idx - width - 1] - 2 * grayData[idx - width] - grayData[idx - width + 1] +
                   grayData[idx + width - 1] + 2 * grayData[idx + width] + grayData[idx + width + 1];
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = magnitude > 50 ? 255 : 0;
      }
    }
    
    const labeled = new Uint16Array(width * height);
    const objects: DetectedObject[] = [];
    let currentLabel = 1;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] === 255 && labeled[idx] === 0) {
          const region = floodFill(edges, labeled, x, y, width, height, currentLabel);
          
          if (region.area < minArea) continue;
          
          const rect = calculateBoundingBox(region.points);
          const perimeter = calculatePerimeter(region.points);
          const centerX = region.points.reduce((sum, p) => sum + p.x, 0) / region.points.length;
          const centerY = region.points.reduce((sum, p) => sum + p.y, 0) / region.points.length;
          
          const aspectRatio = rect.width / rect.height;
          const extent = region.area / (rect.width * rect.height);
          const circularity = (4 * Math.PI * region.area) / (perimeter * perimeter);
          const compactness = (perimeter * perimeter) / region.area;
          
          const confidence = calculateAdvancedPositionScore({
            area: region.area,
            solidity: 1,
            circularity,
            extent,
            aspectRatio,
            compactness,
            perimeter
          });
          
          objects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: region.area,
            confidence,
            circularity,
            solidity: 1,
            extent,
            aspectRatio,
            compactness,
            perimeter,
            contourPoints: region.points.length,
            centerX,
            centerY,
            huMoments: [],
            isConvex: true,
            boundingCircleRadius: Math.max(rect.width, rect.height) / 2
          });
          
          currentLabel++;
        }
      }
    }
    
    return objects;
  } catch (error) {
    throw new Error(`Error en detección nativa: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

function calculateAdvancedPositionScore(params: {
  area: number;
  solidity: number;
  circularity: number;
  extent: number;
  aspectRatio: number;
  compactness: number;
  perimeter: number;
}): number {
  const { area, solidity, circularity, extent, aspectRatio, compactness, perimeter } = params;
  
  const areaScore = Math.min(area / 1000, 1);
  const solidityScore = solidity;
  const circularityScore = Math.min(circularity, 1);
  const extentScore = extent;
  const aspectRatioScore = aspectRatio > 0.5 && aspectRatio < 2 ? 1 : 0.5;
  const compactnessScore = Math.max(0, 1 - compactness / 100);
  
  return (areaScore * 0.2 + solidityScore * 0.2 + circularityScore * 0.2 + 
          extentScore * 0.15 + aspectRatioScore * 0.15 + compactnessScore * 0.1);
}

function floodFill(
  edges: Uint8ClampedArray,
  labeled: Uint16Array,
  startX: number,
  startY: number,
  width: number,
  height: number,
  label: number
): { points: { x: number; y: number }[]; area: number } {
  const points: { x: number; y: number }[] = [];
  const stack: [number, number][] = [[startX, startY]];
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || edges[idx] !== 255 || labeled[idx] !== 0) {
      continue;
    }
    
    labeled[idx] = label;
    points.push({ x, y });
    
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return { points, area: points.length };
}

function calculateBoundingBox(points: { x: number; y: number }[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function calculatePerimeter(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  
  return perimeter;
}

self.onmessage = async (event: MessageEvent<IncomingMessage>): Promise<void> => {
  const { type, taskId } = event.data;
  
  try {
    switch (type) {
      case 'INIT':
        if (!workerState.isInitialized) {
          await loadOpenCV();
          workerState.isInitialized = true;
          sendStatus(taskId, 'completed', 'Worker inicializado correctamente');
        } else {
          sendStatus(taskId, 'completed', 'Worker ya estaba inicializado');
        }
        break;
        
      case 'DETECT': {
        const { imageData, minArea } = event.data as DetectMessage;
        
        if (workerState.isProcessing) {
          sendError(taskId, 'Worker ya está procesando otra tarea');
          return;
        }
        
        workerState.isProcessing = true;
        
        try {
          const result = await detectObjects(imageData, minArea, taskId);
          sendSuccess(taskId, result);
          
          workerState.totalProcessed++;
          const totalTime = workerState.averageProcessingTime * (workerState.totalProcessed - 1) + result.processingTime;
          workerState.averageProcessingTime = totalTime / workerState.totalProcessed;
          
        } catch (error) {
          sendError(taskId, error instanceof Error ? error.message : 'Error desconocido');
        } finally {
          workerState.isProcessing = false;
        }
        break;
      }
        
      case 'STATUS':
        sendStatus(taskId, 'completed', `Worker status: ${workerState.isOpenCVReady ? 'OpenCV listo' : 'Modo nativo'}`);
        break;
        
      default:
        sendError(taskId, `Tipo de mensaje no soportado: ${type}`);
    }
  } catch (error) {
    sendError(taskId, error instanceof Error ? error.message : 'Error crítico en el worker');
  }
};
