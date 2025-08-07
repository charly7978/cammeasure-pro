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
      
      const checkCV = () => {
        if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
          isOpenCVReady = true;
          console.log('OpenCV loaded in worker');
          resolve();
        } else {
          // Esperar un poco más y verificar de nuevo
          setTimeout(checkCV, 100);
        }
      };
      
      // Iniciar la verificación
      setTimeout(checkCV, 100);
      
    } catch (error) {
      console.error('Failed to load OpenCV in worker:', error);
      // No rechazar la promesa, simplemente continuar sin OpenCV
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
      
      // Si hay más del 50% de superposición, considerar como el mismo objeto
      if (overlap > 0.5) {
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
    return 0; // No hay superposición
  }
  
  const overlapArea = (x2 - x1) * (y2 - y1);
  const rect1Area = rect1.width * rect1.height;
  const rect2Area = rect2.width * rect2.height;
  const unionArea = rect1Area + rect2Area - overlapArea;
  
  return overlapArea / unionArea;
}

// Detección de contornos usando OpenCV MEJORADA
function detectContoursOpenCV(imageData: ImageData, minArea: number) {
  if (!isOpenCVReady || !cv) {
    return detectContoursNative(imageData, minArea);
  }

  try {
    // Crear matriz OpenCV desde ImageData
    const src = cv.matFromImageData(imageData);
    
    // Convertir a escala de grises
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Aplicar filtro bilateral para reducir ruido manteniendo bordes
    const bilateral = new cv.Mat();
    cv.bilateralFilter(gray, bilateral, 9, 75, 75);
    
    // Aplicar desenfoque gaussiano suave
    const blurred = new cv.Mat();
    cv.GaussianBlur(bilateral, blurred, new cv.Size(5, 5), 0);
    
    // Detección de bordes Canny con parámetros optimizados
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150, 3, false);
    
    // Operación morfológica para cerrar pequeños huecos
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    const closed = new cv.Mat();
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
    
    // Dilatación para conectar bordes cercanos
    const dilated = new cv.Mat();
    cv.dilate(closed, dilated, kernel, new cv.Point(-1, -1), 1);
    
    // Encontrar contornos
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const rects = [];
    const imageArea = imageData.width * imageData.height;
    
    // Procesar cada contorno con filtros mejorados
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      
      // Aproximar el contorno para reducir puntos
      const epsilon = 0.02 * cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, epsilon, true);
      
      // Obtener rectángulo delimitador
      const rect = cv.boundingRect(contour);
      
      // Calcular propiedades del contorno
      const area = cv.contourArea(contour);
      const perimeter = cv.arcLength(contour, true);
      
      // Calcular métricas de calidad
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      const aspectRatio = rect.width / rect.height;
      const rectArea = rect.width * rect.height;
      const extent = area / rectArea; // Qué tan lleno está el rectángulo
      const solidity = area / cv.contourArea(cv.convexHull(contour, new cv.Mat(), false, true));
      
      // Filtros más inteligentes para objetos reales
      const isValidSize = area >= minArea && area <= imageArea * 0.4;
      const isValidShape = aspectRatio > 0.2 && aspectRatio < 5.0;
      const isValidExtent = extent > 0.3; // Al menos 30% del rectángulo está lleno
      const isValidSolidity = solidity > 0.7; // Forma relativamente sólida
      const isValidCircularity = circularity > 0.1; // No demasiado irregular
      const hasMinimumSize = rect.width > 30 && rect.height > 30;
      
      if (isValidSize && isValidShape && isValidExtent && isValidSolidity && 
          isValidCircularity && hasMinimumSize) {
        
        // Calcular confianza basada en múltiples factores
        const sizeScore = Math.min(area / (minArea * 5), 1.0);
        const shapeScore = Math.min(circularity * 2, 1.0);
        const solidityScore = solidity;
        const extentScore = extent;
        
        const confidence = (sizeScore * 0.3 + shapeScore * 0.2 + solidityScore * 0.3 + extentScore * 0.2);
        
        rects.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: area,
          confidence: Math.min(confidence, 1.0),
          circularity: circularity,
          solidity: solidity,
          extent: extent
        });
      }
      
      approx.delete();
    }
    
    // Liberar memoria
    src.delete();
    gray.delete();
    bilateral.delete();
    blurred.delete();
    edges.delete();
    closed.delete();
    dilated.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
    
    // Filtrar objetos superpuestos
    const filteredRects = filterOverlappingRects(rects);
    
    // Ordenar por confianza y área
    filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
    
    // Retornar solo el mejor objeto
    return filteredRects.slice(0, 1);
    
  } catch (error) {
    console.error('OpenCV detection error:', error);
    return detectContoursNative(imageData, minArea);
  }
}

// Detección nativa mejorada (fallback)
function detectContoursNative(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  // Convertir a escala de grises
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  
  // Aplicar filtro de mediana para reducir ruido
  const filtered = applyMedianFilter(gray, width, height);
  
  // Detección de bordes mejorada usando Sobel
  const edges = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Operador Sobel X
      const sobelX = 
        -1 * filtered[(y-1) * width + (x-1)] + 1 * filtered[(y-1) * width + (x+1)] +
        -2 * filtered[y * width + (x-1)] + 2 * filtered[y * width + (x+1)] +
        -1 * filtered[(y+1) * width + (x-1)] + 1 * filtered[(y+1) * width + (x+1)];
      
      // Operador Sobel Y
      const sobelY = 
        -1 * filtered[(y-1) * width + (x-1)] + -2 * filtered[(y-1) * width + x] + -1 * filtered[(y-1) * width + (x+1)] +
        1 * filtered[(y+1) * width + (x-1)] + 2 * filtered[(y+1) * width + x] + 1 * filtered[(y+1) * width + (x+1)];
      
      // Magnitud del gradiente
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
      edges[idx] = magnitude > 60 ? 255 : 0;
    }
  }
  
  // Operación de cierre morfológico
  const closed = applyMorphologicalClosing(edges, width, height);
  
  // Encontrar componentes conectados
  const visited = new Array(width * height).fill(false);
  const imageArea = width * height;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (closed[idx] > 0 && !visited[idx]) {
        const rect = floodFill(closed, visited, x, y, width, height);
        const area = rect.width * rect.height;
        
        // Filtros similares a OpenCV
        const aspectRatio = rect.width / rect.height;
        const sizeRatio = area / imageArea;
        
        if (area >= minArea && 
            area <= imageArea * 0.4 &&
            aspectRatio > 0.2 && aspectRatio < 5.0 &&
            rect.width > 30 && rect.height > 30 &&
            sizeRatio > 0.001 && sizeRatio < 0.3) {
          
          const confidence = Math.min(area / (minArea * 3), 1.0);
          
          rects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: area,
            confidence: confidence
          });
        }
      }
    }
  }
  
  // Filtrar objetos superpuestos
  const filteredRects = filterOverlappingRects(rects);
  
  // Ordenar por confianza y área
  filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
  
  // Retornar solo el mejor objeto
  return filteredRects.slice(0, 1);
}

// Filtro de mediana para reducir ruido
function applyMedianFilter(data: Uint8Array, width: number, height: number): Uint8Array {
  const filtered = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const neighbors = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          neighbors.push(data[(y + dy) * width + (x + dx)]);
        }
      }
      neighbors.sort((a, b) => a - b);
      filtered[y * width + x] = neighbors[4]; // Mediana de 9 elementos
    }
  }
  
  return filtered;
}

// Operación morfológica de cierre
function applyMorphologicalClosing(data: Uint8Array, width: number, height: number): Uint8Array {
  // Dilatación seguida de erosi��n
  const dilated = new Uint8Array(width * height);
  const closed = new Uint8Array(width * height);
  
  // Dilatación
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let maxVal = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          maxVal = Math.max(maxVal, data[(y + dy) * width + (x + dx)]);
        }
      }
      dilated[y * width + x] = maxVal;
    }
  }
  
  // Erosión
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let minVal = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          minVal = Math.min(minVal, dilated[(y + dy) * width + (x + dx)]);
        }
      }
      closed[y * width + x] = minVal;
    }
  }
  
  return closed;
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
    
    // Add neighbors
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

// Inicializar worker y cargar OpenCV
let isInitialized = false;

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    if (!isInitialized) {
      try {
        await loadOpenCV();
        isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize OpenCV:', error);
        // Continuar con detección nativa
      }
    }
    postMessage({ type: 'READY' } as Outgoing);
    return;
  }

  if (msg.type === 'DETECT') {
    try {
      // Usar OpenCV si está disponible, si no usar detección nativa
      const rects = isOpenCVReady 
        ? detectContoursOpenCV(msg.imageData, msg.minArea)
        : detectContoursNative(msg.imageData, msg.minArea);
      
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Worker error:', e);
      // En caso de error, intentar con detección nativa
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