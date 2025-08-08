interface DetectMessage {
  type: 'DETECT';
  imageData: ImageData;
  minArea: number;
}

interface InitMessage {
  type: 'INIT';
}

type Incoming = DetectMessage | InitMessage;

type Outgoing =
  | { type: 'READY' }
  | { type: 'DETECTED'; rects: any[] };

// OpenCV worker para detección de objetos
declare var importScripts: (urls: string) => void;
declare var cv: any;

let isOpenCVReady = false;

// Cargar OpenCV en el worker
function loadOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Verificar si OpenCV ya está cargado
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      isOpenCVReady = true;
      resolve();
      return;
    }

    // En el worker, intentar cargar OpenCV mediante importScripts
    try {
      // Intentar cargar OpenCV desde una URL CDN
      importScripts('https://docs.opencv.org/4.8.0/opencv.js');
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      isOpenCVReady = true;
      resolve();
      return;
    }

    try {
      importScripts('https://docs.opencv.org/4.8.0/opencv.js');
      
      const checkCV = () => {
        if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
          isOpenCVReady = true;
          console.log('Advanced OpenCV loaded in worker');
          resolve();
        } else {
          setTimeout(checkCV, 100);
        }
      };
      
      setTimeout(checkCV, 100);
      
    } catch (error) {
      console.error('Failed to load OpenCV in worker:', error);
      resolve(); // Continuar sin OpenCV
    }
  });
}

// Detección avanzada de contornos usando OpenCV
function detectContoursAdvanced(imageData: ImageData, minArea: number, options: any = {}) {
  if (!isOpenCVReady || !cv) {
    return detectContoursNative(imageData, minArea);
  }

  try {
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 1. Preprocesamiento avanzado con múltiples técnicas
    const enhanced = enhanceImageForDetection(gray);

    // 2. Detección multi-escala si está habilitada
    let detections;
    if (options.enableMultiScale) {
      detections = detectMultiScale(enhanced, minArea);
    } else {
      detections = detectSingleScale(enhanced, minArea);
    }

    // 3. Análisis de forma avanzado
    const shapeAnalyzedResults = analyzeShapes(detections, src);

    // 4. Filtrado inteligente basado en contexto
    const contextFilteredResults = applyContextualFiltering(
      shapeAnalyzedResults, 
      imageData, 
      options.confidenceThreshold || 0.3
    );

    // 5. Tracking temporal para estabilidad
    let finalResults = contextFilteredResults;
    if (options.enableTemporalStabilization) {
      finalResults = applyTemporalStabilization(contextFilteredResults);
    }

    // Liberar memoria
    src.delete();
    gray.delete();
    enhanced.delete();

    const maxObjects = options.maxObjects || 3;
    return finalResults.slice(0, maxObjects);

  } catch (error) {
    console.error('Advanced OpenCV detection error:', error);
    return detectContoursNative(imageData, minArea);
  }
}

// Mejora de imagen con técnicas avanzadas
function enhanceImageForDetection(gray: any) {
  // 1. Ecualización de histograma adaptativa (CLAHE)
  const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
  const enhanced = new cv.Mat();
  clahe.apply(gray, enhanced);

  // 2. Desenfoque bilateral para preservar bordes
  const bilateral = new cv.Mat();
  cv.bilateralFilter(enhanced, bilateral, 9, 75, 75);

  // 3. Detección de bordes multi-umbral
  const edges1 = new cv.Mat();
  const edges2 = new cv.Mat();
  const edges3 = new cv.Mat();
  
  cv.Canny(bilateral, edges1, 50, 150);   // Bordes suaves
  cv.Canny(bilateral, edges2, 100, 200); // Bordes medios
  cv.Canny(bilateral, edges3, 150, 250); // Bordes fuertes

  // 4. Combinación ponderada de bordes
  const combinedEdges = new cv.Mat();
  cv.addWeighted(edges1, 0.3, edges2, 0.4, 0, combinedEdges);
  cv.addWeighted(combinedEdges, 1.0, edges3, 0.3, 0, combinedEdges);

  // 5. Operaciones morfológicas adaptativas
  const kernel1 = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const kernel2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  
  const morphed = new cv.Mat();
  cv.morphologyEx(combinedEdges, morphed, cv.MORPH_CLOSE, kernel1);
  cv.morphologyEx(morphed, morphed, cv.MORPH_OPEN, kernel2);

  // Limpiar memoria intermedia
  enhanced.delete();
  bilateral.delete();
  edges1.delete();
  edges2.delete();
  edges3.delete();
  combinedEdges.delete();
  kernel1.delete();
  kernel2.delete();

  return morphed;
}

// Detección multi-escala
function detectMultiScale(processedImage: any, minArea: number) {
  const results = [];
  const scales = [0.8, 1.0, 1.2]; // Diferentes escalas

  for (const scale of scales) {
    const scaledImage = new cv.Mat();
    const size = new cv.Size(
      Math.round(processedImage.cols * scale),
      Math.round(processedImage.rows * scale)
    );
    
    cv.resize(processedImage, scaledImage, size);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(scaledImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour) / (scale * scale);

      if (area >= minArea) {
        const rect = cv.boundingRect(contour);
        
        results.push({
          x: Math.round(rect.x / scale),
          y: Math.round(rect.y / scale),
          width: Math.round(rect.width / scale),
          height: Math.round(rect.height / scale),
          area: area,
          scale: scale,
          contour: contour.clone()
        });
      }
      
      contour.delete();
    }

    scaledImage.delete();
    contours.delete();
    hierarchy.delete();
  }

  return results;
}

// Detección de escala única optimizada
function detectSingleScale(processedImage: any, minArea: number) {
  const results = [];
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  
  cv.findContours(processedImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);

    if (area >= minArea) {
      const rect = cv.boundingRect(contour);
      
      results.push({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        area: area,
        scale: 1.0,
        contour: contour.clone()
      });
    }
    
    contour.delete();
  }

  contours.delete();
  hierarchy.delete();
  return results;
}

// Análisis avanzado de formas
function analyzeShapes(detections: any[], srcImage: any) {
  return detections.map(detection => {
    const contour = detection.contour;
    
    // 1. Análisis de convexidad
    const hull = new cv.Mat();
    cv.convexHull(contour, hull);
    const hullArea = cv.contourArea(hull);
    const solidity = hullArea > 0 ? detection.area / hullArea : 0;

    // 2. Análisis de circularidad
    const perimeter = cv.arcLength(contour, true);
    const circularity = perimeter > 0 ? (4 * Math.PI * detection.area) / (perimeter * perimeter) : 0;

    // 3. Análisis de rectangularidad
    const boundingArea = detection.width * detection.height;
    const rectangularity = boundingArea > 0 ? detection.area / boundingArea : 0;

    // 4. Análisis de momentos para orientación
    const moments = cv.moments(contour);
    const orientation = moments.m20 !== moments.m02 ? 
      0.5 * Math.atan2(2 * moments.m11, moments.m20 - moments.m02) : 0;

    // 5. Detección de esquinas
    const approx = new cv.Mat();
    const epsilon = 0.02 * cv.arcLength(contour, true);
    cv.approxPolyDP(contour, approx, epsilon, true);
    const cornerCount = approx.rows;

    // 6. Análisis de textura básico
    const textureScore = analyzeTexture(srcImage, detection);

    // 7. Cálculo de confianza compuesta
    const shapeScore = (solidity * 0.25) + (circularity * 0.15) + (rectangularity * 0.25) + 
                      (Math.min(cornerCount / 4, 1) * 0.15) + (textureScore * 0.2);

    // Limpiar memoria
    hull.delete();
    approx.delete();
    contour.delete();

    return {
      ...detection,
      solidity,
      circularity,
      rectangularity,
      orientation,
      cornerCount,
      textureScore,
      confidence: Math.min(shapeScore, 1.0)
    };
  });
}

// Análisis básico de textura
function analyzeTexture(srcImage: any, detection: any) {
  try {
    // Extraer ROI (Region of Interest)
    const roi = srcImage.roi(new cv.Rect(detection.x, detection.y, detection.width, detection.height));
    const grayRoi = new cv.Mat();
    cv.cvtColor(roi, grayRoi, cv.COLOR_RGBA2GRAY);

    // Calcular varianza como medida de textura
    const mean = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(grayRoi, mean, stddev);
    
    const variance = Math.pow(stddev.data64F[0], 2);
    const textureScore = Math.min(variance / 1000, 1.0); // Normalizar

    roi.delete();
    grayRoi.delete();
    mean.delete();
    stddev.delete();

    return textureScore;
  } catch (error) {
    return 0.5; // Valor por defecto en caso de error
  }
}

// Filtrado contextual inteligente
function applyContextualFiltering(detections: any[], imageData: ImageData, confidenceThreshold: number) {
  const imageArea = imageData.width * imageData.height;
  const imageCenter = { x: imageData.width / 2, y: imageData.height / 2 };

  return detections.filter(detection => {
    // 1. Filtro de tamaño relativo
    const sizeRatio = detection.area / imageArea;
    if (sizeRatio < 0.001 || sizeRatio > 0.7) return false;

    // 2. Filtro de relación de aspecto
    const aspectRatio = detection.width / detection.height;
    if (aspectRatio < 0.1 || aspectRatio > 10) return false;

    // 3. Filtro de posición (objetos cerca del centro son mejores)
    const centerX = detection.x + detection.width / 2;
    const centerY = detection.y + detection.height / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - imageCenter.x, 2) + Math.pow(centerY - imageCenter.y, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(imageData.width / 2, 2) + Math.pow(imageData.height / 2, 2));
    const centerScore = 1 - (distanceFromCenter / maxDistance);

    // 4. Filtro de confianza mínima
    if (detection.confidence < confidenceThreshold) return false;

    // 5. Ajustar confianza con score de posición
    detection.confidence = (detection.confidence * 0.7) + (centerScore * 0.3);

    return true;
  }).sort((a, b) => b.confidence - a.confidence);
}

// Estabilización temporal
function applyTemporalStabilization(currentDetections: any[]) {
  if (previousDetections.length === 0) {
    previousDetections = currentDetections;
    return currentDetections;
  }

  // Mantener historial
  detectionHistory.push([...currentDetections]);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }

  // Matching con detecciones previas
  const stabilized = currentDetections.map(current => {
    let bestMatch = null;
    let bestDistance = Infinity;

    for (const prev of previousDetections) {
      const distance = Math.sqrt(
        Math.pow(current.x - prev.x, 2) + 
        Math.pow(current.y - prev.y, 2)
      );

      if (distance < bestDistance && distance < 50) {
        bestDistance = distance;
        bestMatch = prev;
      }
    }

    if (bestMatch) {
      // Suavizado temporal
      const alpha = 0.7;
      return {
        ...current,
        x: Math.round(current.x * alpha + bestMatch.x * (1 - alpha)),
        y: Math.round(current.y * alpha + bestMatch.y * (1 - alpha)),
        width: Math.round(current.width * alpha + bestMatch.width * (1 - alpha)),
        height: Math.round(current.height * alpha + bestMatch.height * (1 - alpha)),
        confidence: Math.min(current.confidence + 0.1, 1.0)
      };
    }

    return current;
  });

  previousDetections = stabilized;
  return stabilized;
}

// Función para filtrar rectángulos superpuestos (mejorada)
function filterOverlappingRects(rects: any[], overlapThreshold: number = 0.5) {
  const filtered = [];
  
  for (let i = 0; i < rects.length; i++) {
    let isOverlapping = false;
    
    for (let j = 0; j < filtered.length; j++) {
      const overlap = calculateOverlap(rects[i], filtered[j]);
      
      if (overlap > overlapThreshold) {
        isOverlapping = true;
        
        // Mantener el objeto con mayor confianza
        if (rects[i].confidence && filtered[j].confidence && rects[i].confidence > filtered[j].confidence) {
          filtered[j] = rects[i];
        }
        break;
      }
    }
    
    if (!isOverlapping) {
      filtered.push(rects[i]);
    }
  }
  
  return filtered;
}

// Calcular superposición entre dos rectángulos
function calculateOverlap(rect1: any, rect2: any) {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
  
  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }
  
  const overlapArea = (x2 - x1) * (y2 - y1);
  const rect1Area = rect1.width * rect1.height;
  const rect2Area = rect2.width * rect2.height;
  const unionArea = rect1Area + rect2Area - overlapArea;
  
  return overlapArea / unionArea;
}

// Detección nativa mejorada (fallback)
function detectContoursNative(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  // Algoritmo de detección de bordes mejorado
  const edges = new Uint8Array(width * height);
  
  // Aplicar filtro Sobel con umbral adaptativo
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Sobel X y Y
      const sobelX = 
        -1 * getGrayValue(data, x - 1, y - 1, width) +
        -2 * getGrayValue(data, x - 1, y, width) +
        -1 * getGrayValue(data, x - 1, y + 1, width) +
         1 * getGrayValue(data, x + 1, y - 1, width) +
         2 * getGrayValue(data, x + 1, y, width) +
         1 * getGrayValue(data, x + 1, y + 1, width);
      
      const sobelY = 
        -1 * getGrayValue(data, x - 1, y - 1, width) +
        -2 * getGrayValue(data, x, y - 1, width) +
        -1 * getGrayValue(data, x + 1, y - 1, width) +
         1 * getGrayValue(data, x - 1, y + 1, width) +
         2 * getGrayValue(data, x, y + 1, width) +
         1 * getGrayValue(data, x + 1, y + 1, width);
      
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
      edges[y * width + x] = magnitude > 80 ? 255 : 0;
    }
  }
  
  // Encontrar componentes conectados
  const visited = new Array(width * height).fill(false);
  const imageArea = width * height;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] > 0 && !visited[idx]) {
        const rect = floodFill(edges, visited, x, y, width, height);
        const area = rect.width * rect.height;
        
        if (area >= minArea * 2 && 
            area <= imageArea * 0.3 &&
            rect.width > 20 && rect.height > 20) {
          
          rects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: area,
            confidence: Math.min(area / (minArea * 10), 1.0)
          });
        }
      }
    }
  }
  
  return filterOverlappingRects(rects).slice(0, 2);
}

function getGrayValue(data: Uint8ClampedArray, x: number, y: number, width: number) {
  const idx = (y * width + x) * 4;
  return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
}

function floodFill(edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] === 0) {
      continue;
    }
    
    visited[idx] = true;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

// Inicializar worker
let isInitialized = false;

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    if (!isInitialized) {
      try {
        await loadOpenCV();
        isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize advanced OpenCV:', error);
      }
    }
    postMessage({ type: 'READY' } as Outgoing);
    return;
  }

  if (msg.type === 'DETECT') {
    try {
      const options = msg.options || {};
      const rects = isOpenCVReady 
        ? detectContoursAdvanced(msg.imageData, msg.minArea, options)
        : detectContoursNative(msg.imageData, msg.minArea);
      
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Advanced worker error:', e);
      try {
        const rects = detectContoursNative(msg.imageData, msg.minArea);
        postMessage({ type: 'DETECTED', rects } as Outgoing);
      } catch (nativeError) {
        console.error('Native detection also failed:', nativeError);
        postMessage({ type: 'DETECTED', rects: [] } as Outgoing);
      }
    }
  }
};