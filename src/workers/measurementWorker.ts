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
    
    // Aplicar desenfoque gaussiano para reducir ruido
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    
    // Detección de bordes Canny
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);
    
    // Encontrar contornos
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const rects = [];
    
    // Procesar cada contorno
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      
      // Obtener rectángulo delimitador
      const rect = cv.boundingRect(contour);
      
      // Calcular propiedades del contorno para mejor detección
      const area = cv.contourArea(contour);
      const perimeter = cv.arcLength(contour, true);
      
      // Calcular circularidad para filtrar formas no deseadas
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      
      // Filtrar objetos muy pequeños o con forma irregular
      if (area >= minArea && circularity > 0.1) {
        rects.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: area
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
    
    // Ordenar por área (mayor a menor)
    rects.sort((a, b) => b.area - a.area);
    
    // Retornar solo los 5 objetos más grandes
    return rects.slice(0, 5);
    
  } catch (error) {
    console.error('OpenCV detection error:', error);
    // Fallback a detección nativa
    return detectContoursNative(imageData, minArea);
  }
}

// Detección nativa (fallback)
function detectContoursNative(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  // Simple edge detection using Sobel operator
  const edges = new Uint8Array(width * height);
  
  // Convert to grayscale and detect edges
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
      
      // Magnitude
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
      edges[y * width + x] = magnitude > 50 ? 255 : 0;
    }
  }
  
  // Find bounding boxes of connected components
  const visited = new Array(width * height).fill(false);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] > 0 && !visited[idx]) {
        const rect = floodFill(edges, visited, x, y, width, height);
        const area = rect.width * rect.height;
        
        if (area >= minArea) {
          rects.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            area: area
          });
        }
      }
    }
  }
  
  // Sort by area (largest first)
  rects.sort((a, b) => b.area - a.area);
  
  // Return only top 5 objects
  return rects.slice(0, 5);
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
