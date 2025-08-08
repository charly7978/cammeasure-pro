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

// Detección de contornos usando OpenCV
function detectContoursOpenCV(imageData: ImageData, minArea: number) {
  if (!isOpenCVReady || !cv) {
    // Fallback a detección nativa si OpenCV no está disponible
    return detectContoursNative(imageData, minArea);
  }

  try {
    // Crear matriz OpenCV desde ImageData
    const src = cv.matFromImageData(imageData);
    
    // Convertir a escala de grises
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Aplicar desenfoque gaussiano más fuerte para reducir ruido
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 0);
    
    // Detección de bordes Canny con umbrales más altos para ser más selectivo
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 80, 200);
    
    // Operación morfológica para cerrar pequeños huecos
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
    kernel.delete();
    
    // Encontrar contornos
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const rects = [];
    const imageArea = imageData.width * imageData.height;
    
    // Procesar cada contorno con filtros más estrictos
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      
      // Obtener rectángulo delimitador
      const rect = cv.boundingRect(contour);
      
      // Calcular propiedades del contorno para mejor detección
      const area = cv.contourArea(contour);
      const perimeter = cv.arcLength(contour, true);
      
      // Calcular circularidad para filtrar formas no deseadas
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      
      // Calcular relación de aspecto
      const aspectRatio = rect.width / rect.height;
      
      // Calcular densidad del área (área del contorno vs área del rectángulo)
      const rectArea = rect.width * rect.height;
      const density = area / rectArea;
      
      // Filtros más estrictos:
      // 1. Área mínima más grande
      // 2. Área máxima (no más del 30% de la imagen)
      // 3. Circularidad mínima
      // 4. Relación de aspecto razonable
      // 5. Densidad mínima
      // 6. Dimensiones mínimas
      if (area >= minArea * 3 && 
          area <= imageArea * 0.3 &&
          circularity > 0.2 && 
          aspectRatio > 0.3 && aspectRatio < 3.0 &&
          density > 0.4 &&
          rect.width > 30 && rect.height > 30) {
        
        rects.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: area,
          confidence: Math.min(circularity * density * 2, 1.0) // Calcular confianza basada en forma
        });
      }
    }
    
    // Liberar memoria
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    
    // Filtrar objetos superpuestos
    const filteredRects = filterOverlappingRects(rects);
    
    // Ordenar por confianza y área
    filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
    
    // Retornar solo los 2 mejores objetos
    return filteredRects.slice(0, 2);
    
  } catch (error) {
    console.error('OpenCV detection error:', error);
    // Fallback a detección nativa
    return detectContoursNative(imageData, minArea);
  }
}

// Detección nativa (fallback) - también mejorada para ser más estricta
function detectContoursNative(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  // Simple edge detection using Sobel operator
  const edges = new Uint8Array(width * height);
  
  // Convert to grayscale and detect edges with higher threshold
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Convert to grayscale
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // Sobel X
      const sobelX = 
        -1 * getGrayValue(data, x - 1, y - 1, width) +
        -2 * getGrayValue(data, x - 1, y, width) +
        -1 * getGrayValue(data, x - 1, y + 1, width) +
         1 * getGrayValue(data, x + 1, y - 1, width) +
         2 * getGrayValue(data, x + 1, y, width) +
         1 * getGrayValue(data, x + 1, y + 1, width);
      
      // Sobel Y
      const sobelY = 
        -1 * getGrayValue(data, x - 1, y - 1, width) +
        -2 * getGrayValue(data, x, y - 1, width) +
        -1 * getGrayValue(data, x + 1, y - 1, width) +
         1 * getGrayValue(data, x - 1, y + 1, width) +
         2 * getGrayValue(data, x, y + 1, width) +
         1 * getGrayValue(data, x + 1, y + 1, width);
      
      // Magnitude with higher threshold
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
      edges[y * width + x] = magnitude > 80 ? 255 : 0; // Increased threshold
    }
  }
  
  // Find bounding boxes of connected components
  const visited = new Array(width * height).fill(false);
  const imageArea = width * height;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] > 0 && !visited[idx]) {
        const rect = floodFill(edges, visited, x, y, width, height);
        const area = rect.width * rect.height;
        
        // More strict filtering for native detection
        if (area >= minArea * 2 && 
            area <= imageArea * 0.3 &&
            rect.width > 20 && rect.height > 20 &&
            rect.width / rect.height > 0.3 && rect.width / rect.height < 3.0) {
          
          rects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: area,
            confidence: Math.min(area / (minArea * 10), 1.0) // Simple confidence based on size
          });
        }
      }
    }
  }
  
  // Filter overlapping rectangles
  const filteredRects = filterOverlappingRects(rects);
  
  // Sort by confidence and area
  filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
  
  // Return only top 2 objects
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