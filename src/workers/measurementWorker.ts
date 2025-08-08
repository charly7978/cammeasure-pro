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

// OpenCV worker para detección de objetos profesional
declare var cv: any;

let isOpenCVReady = false;

// Cargar OpenCV en el worker
function loadOpenCV(): Promise<void> {
  return new Promise((resolve) => {
    // Verificar si OpenCV ya está cargado
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      isOpenCVReady = true;
      resolve();
      return;
    }

    // En el worker, intentar cargar OpenCV
    try {
      // Usar importScripts del contexto global del worker
      (self as any).importScripts('https://docs.opencv.org/4.8.0/opencv.js');
      
      const checkCV = () => {
        if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
          isOpenCVReady = true;
          console.log('OpenCV loaded in professional worker');
          resolve();
        } else {
          setTimeout(checkCV, 100);
        }
      };
      
      setTimeout(checkCV, 100);
      
    } catch (error) {
      console.error('Failed to load OpenCV in worker:', error);
      // Continuar sin OpenCV
      resolve();
    }
  });
}

// Función para filtrar rectángulos superpuestos
function filterOverlappingRects(rects: any[]) {
  const filtered = [];
  
  for (let i = 0; i < rects.length; i++) {
    let isOverlapping = false;
    
    for (let j = 0; j < filtered.length; j++) {
      const overlap = calculateOverlap(rects[i], filtered[j]);
      
      if (overlap > 0.5) {
        isOverlapping = true;
        
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

// Detección profesional usando OpenCV
function detectContoursOpenCV(imageData: ImageData, minArea: number) {
  if (!isOpenCVReady || !cv) {
    return detectContoursNative(imageData, minArea);
  }

  try {
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Preprocesamiento profesional
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Detección de bordes Canny optimizada
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);

    // Operaciones morfológicas
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    const morphed = new cv.Mat();
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);

    // Encontrar contornos
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const rects = [];
    const imageArea = imageData.width * imageData.height;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < minArea) {
        contour.delete();
        continue;
      }

      const rect = cv.boundingRect(contour);
      const aspectRatio = rect.width / rect.height;

      // Análisis de forma profesional
      const hull = new cv.Mat();
      cv.convexHull(contour, hull);
      const hullArea = cv.contourArea(hull);
      const solidity = hullArea > 0 ? area / hullArea : 0;

      // Filtros de calidad profesional
      if (
        area > imageArea * 0.001 &&
        area < imageArea * 0.8 &&
        aspectRatio > 0.1 && aspectRatio < 10.0 &&
        solidity > 0.5 &&
        rect.width > 10 && rect.height > 10
      ) {
        // Calcular confianza profesional
        let confidence = solidity * 0.4;
        confidence += Math.min(area / (minArea * 10), 1.0) * 0.3;
        confidence += (aspectRatio > 0.5 && aspectRatio < 2.0 ? 1.0 : 0.5) * 0.3;

        rects.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: area,
          confidence: Math.min(confidence, 1.0),
          solidity: solidity,
          aspectRatio: aspectRatio
        });
      }
      
      contour.delete();
      hull.delete();
    }

    // Liberar memoria
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    morphed.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();

    // Filtrar y ordenar
    const filteredRects = filterOverlappingRects(rects);
    filteredRects.sort((a, b) => b.confidence - a.confidence);

    return filteredRects.slice(0, 3);

  } catch (error) {
    console.error('OpenCV detection error:', error);
    return detectContoursNative(imageData, minArea);
  }
}

// Detección nativa profesional (fallback)
function detectContoursNative(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  // Algoritmo de detección de bordes Sobel
  const edges = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
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
      edges[y * width + x] = magnitude > 60 ? 255 : 0;
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
        
        if (area >= minArea && 
            area <= imageArea * 0.5 &&
            rect.width > 15 && rect.height > 15 &&
            rect.width / rect.height > 0.2 && rect.width / rect.height < 5.0) {
          
          const sizeScore = Math.min(area / (minArea * 5), 1.0);
          const shapeScore = Math.min(rect.width / rect.height, rect.height / rect.width);
          const confidence = (sizeScore * 0.6) + (shapeScore * 0.4);
          
          rects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: area,
            confidence: Math.min(confidence, 0.9)
          });
        }
      }
    }
  }
  
  const filteredRects = filterOverlappingRects(rects);
  filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
  
  return filteredRects.slice(0, 2);
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
        console.log('Professional measurement worker initialized');
      } catch (error) {
        console.error('Failed to initialize OpenCV:', error);
        isInitialized = true;
      }
    }
    postMessage({ type: 'READY' } as Outgoing);
    return;
  }

  if (msg.type === 'DETECT') {
    try {
      const rects = isOpenCVReady 
        ? detectContoursOpenCV(msg.imageData, msg.minArea)
        : detectContoursNative(msg.imageData, msg.minArea);
      
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Worker error:', e);
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