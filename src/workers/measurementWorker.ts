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

// OpenCV worker AVANZADO pero OPTIMIZADO
declare var importScripts: (urls: string) => void;
declare var cv: any;

let isOpenCVReady = false;
let isInitialized = false;

// Cargar OpenCV de forma asíncrona
function loadOpenCV(): Promise<void> {
  return new Promise((resolve) => {
    // Verificar si OpenCV ya está cargado
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      isOpenCVReady = true;
      resolve();
      return;
    }

    // Intentar cargar OpenCV
    try {
      importScripts('https://docs.opencv.org/4.8.0/opencv.js');
      
      const checkCV = () => {
        if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
          isOpenCVReady = true;
          console.log('✅ OpenCV cargado en worker');
          resolve();
        } else {
          setTimeout(checkCV, 100);
        }
      };
      
      setTimeout(checkCV, 100);
      
    } catch (error) {
      console.warn('⚠️ OpenCV no disponible, usando detección nativa avanzada');
      resolve();
    }
  });
}

// DETECCIÓN AVANZADA CON OPENCV (optimizada)
function detectContoursOpenCV(imageData: ImageData, minArea: number) {
  if (!isOpenCVReady || !cv) {
    return detectContoursAdvanced(imageData, minArea);
  }

  try {
    const src = cv.matFromImageData(imageData);
    
    // Convertir a escala de grises
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Filtro bilateral para reducir ruido manteniendo bordes
    const bilateral = new cv.Mat();
    cv.bilateralFilter(gray, bilateral, 9, 75, 75);
    
    // Detección de bordes Canny optimizada
    const edges = new cv.Mat();
    cv.Canny(bilateral, edges, 50, 150, 3, false);
    
    // Operación morfológica para mejorar contornos
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    const morphed = new cv.Mat();
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);
    
    // Encontrar contornos
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const rects = [];
    const imageArea = imageData.width * imageData.height;
    
    // Procesar contornos con filtros inteligentes
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      
      // Aproximar contorno
      const epsilon = 0.02 * cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, epsilon, true);
      
      const rect = cv.boundingRect(contour);
      const area = cv.contourArea(contour);
      const perimeter = cv.arcLength(contour, true);
      
      // Métricas de calidad
      const aspectRatio = rect.width / rect.height;
      const extent = area / (rect.width * rect.height);
      const solidity = area / cv.contourArea(cv.convexHull(contour, new cv.Mat(), false, true));
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      
      // Filtros avanzados para objetos reales
      const isValidSize = area >= minArea && area <= imageArea * 0.4;
      const isValidShape = aspectRatio > 0.2 && aspectRatio < 5.0;
      const isValidExtent = extent > 0.3;
      const isValidSolidity = solidity > 0.6;
      const isValidCircularity = circularity > 0.1;
      const hasMinimumDimensions = rect.width > 40 && rect.height > 40;
      
      if (isValidSize && isValidShape && isValidExtent && isValidSolidity && 
          isValidCircularity && hasMinimumDimensions) {
        
        // Calcular confianza basada en múltiples factores
        const sizeScore = Math.min(area / (minArea * 3), 1.0);
        const shapeScore = Math.min(circularity * 3, 1.0);
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
    
    // Liberar memoria OpenCV
    src.delete();
    gray.delete();
    bilateral.delete();
    edges.delete();
    kernel.delete();
    morphed.delete();
    contours.delete();
    hierarchy.delete();
    
    // Filtrar objetos superpuestos
    const filteredRects = filterOverlappingRects(rects);
    
    // Ordenar por calidad y área
    filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
    
    // Retornar los mejores objetos (máximo 5 para rendimiento)
    return filteredRects.slice(0, 5);
    
  } catch (error) {
    console.error('Error en detección OpenCV:', error);
    return detectContoursAdvanced(imageData, minArea);
  }
}

// DETECCIÓN NATIVA AVANZADA (fallback mejorado)
function detectContoursAdvanced(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  // Convertir a escala de grises con mejor precisión
  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  
  // Filtro Gaussiano para reducir ruido
  const blurred = applyGaussianBlur(gray, width, height, 1.0);
  
  // Detección de bordes Sobel mejorada
  const edges = new Float32Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Operador Sobel X
      const sobelX = 
        -1 * blurred[(y-1) * width + (x-1)] + 1 * blurred[(y-1) * width + (x+1)] +
        -2 * blurred[y * width + (x-1)] + 2 * blurred[y * width + (x+1)] +
        -1 * blurred[(y+1) * width + (x-1)] + 1 * blurred[(y+1) * width + (x+1)];
      
      // Operador Sobel Y
      const sobelY = 
        -1 * blurred[(y-1) * width + (x-1)] + -2 * blurred[(y-1) * width + x] + -1 * blurred[(y-1) * width + (x+1)] +
        1 * blurred[(y+1) * width + (x-1)] + 2 * blurred[(y+1) * width + x] + 1 * blurred[(y+1) * width + (x+1)];
      
      // Magnitud del gradiente
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
      edges[idx] = magnitude;
    }
  }
  
  // Umbralización adaptativa
  const threshold = calculateAdaptiveThreshold(edges);
  const binaryEdges = new Uint8Array(width * height);
  for (let i = 0; i < edges.length; i++) {
    binaryEdges[i] = edges[i] > threshold ? 255 : 0;
  }
  
  // Operación morfológica de cierre
  const closed = applyMorphologicalClosing(binaryEdges, width, height);
  
  // Encontrar componentes conectados con mejor algoritmo
  const visited = new Array(width * height).fill(false);
  const imageArea = width * height;
  
  for (let y = 0; y < height; y += 2) { // Optimización: saltar píxeles
    for (let x = 0; x < width; x += 2) {
      const idx = y * width + x;
      if (closed[idx] > 0 && !visited[idx]) {
        const rect = floodFillAdvanced(closed, visited, x, y, width, height);
        const area = rect.width * rect.height;
        
        // Filtros mejorados
        const aspectRatio = rect.width / rect.height;
        const sizeRatio = area / imageArea;
        
        if (area >= minArea && 
            area <= imageArea * 0.4 &&
            aspectRatio > 0.2 && aspectRatio < 5.0 &&
            rect.width > 40 && rect.height > 40 &&
            sizeRatio > 0.002 && sizeRatio < 0.3) {
          
          const confidence = Math.min(area / (minArea * 2), 1.0);
          
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
  
  // Retornar los mejores objetos
  return filteredRects.slice(0, 5);
}

// Filtro Gaussiano optimizado
function applyGaussianBlur(data: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const result = new Float32Array(width * height);
  const kernelSize = Math.ceil(sigma * 2) * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  const center = Math.floor(kernelSize / 2);
  
  // Generar kernel Gaussiano
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - center;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  
  // Normalizar kernel
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }
  
  // Aplicar filtro horizontal
  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const px = x + k - center;
        if (px >= 0 && px < width) {
          value += data[y * width + px] * kernel[k];
        }
      }
      temp[y * width + x] = value;
    }
  }
  
  // Aplicar filtro vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const py = y + k - center;
        if (py >= 0 && py < height) {
          value += temp[py * width + x] * kernel[k];
        }
      }
      result[y * width + x] = value;
    }
  }
  
  return result;
}

// Umbralización adaptativa
function calculateAdaptiveThreshold(edges: Float32Array): number {
  // Calcular histograma
  const histogram = new Array(256).fill(0);
  let max = 0;
  
  for (let i = 0; i < edges.length; i++) {
    const value = Math.min(255, Math.max(0, Math.round(edges[i])));
    histogram[value]++;
    max = Math.max(max, edges[i]);
  }
  
  // Método de Otsu simplificado
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }
  
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 0;
  
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    
    wF = edges.length - wB;
    if (wF === 0) break;
    
    sumB += t * histogram[t];
    
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  
  return Math.max(threshold, max * 0.3); // Asegurar umbral mínimo
}

// Operación morfológica de cierre mejorada
function applyMorphologicalClosing(data: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(width * height);
  const kernelSize = 3;
  const offset = Math.floor(kernelSize / 2);
  
  // Dilatación
  const dilated = new Uint8Array(width * height);
  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let maxVal = 0;
      for (let ky = -offset; ky <= offset; ky++) {
        for (let kx = -offset; kx <= offset; kx++) {
          maxVal = Math.max(maxVal, data[(y + ky) * width + (x + kx)]);
        }
      }
      dilated[y * width + x] = maxVal;
    }
  }
  
  // Erosión
  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let minVal = 255;
      for (let ky = -offset; ky <= offset; ky++) {
        for (let kx = -offset; kx <= offset; kx++) {
          minVal = Math.min(minVal, dilated[(y + ky) * width + (x + kx)]);
        }
      }
      result[y * width + x] = minVal;
    }
  }
  
  return result;
}

// Flood fill avanzado con límites de rendimiento
function floodFillAdvanced(edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let iterations = 0;
  const maxIterations = 5000; // Límite para rendimiento
  
  while (stack.length > 0 && iterations < maxIterations) {
    iterations++;
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
    
    // Agregar vecinos (4-conectividad para mejor rendimiento)
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

// Filtrar rectángulos superpuestos
function filterOverlappingRects(rects: any[]) {
  const filtered = [];
  
  for (let i = 0; i < rects.length; i++) {
    let isOverlapping = false;
    
    for (let j = 0; j < filtered.length; j++) {
      const overlap = calculateOverlap(rects[i], filtered[j]);
      
      if (overlap > 0.5) {
        isOverlapping = true;
        
        // Mantener el objeto con mayor confianza
        if (rects[i].confidence > filtered[j].confidence) {
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

// Calcular superposición entre rectángulos
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

// Inicializar worker
self.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    if (!isInitialized) {
      try {
        await loadOpenCV();
        isInitialized = true;
        console.log('🚀 Worker inicializado con detección avanzada');
      } catch (error) {
        console.error('Error inicializando worker:', error);
      }
    }
    postMessage({ type: 'READY' } as Outgoing);
    return;
  }

  if (msg.type === 'DETECT') {
    try {
      // Usar detección avanzada (OpenCV si está disponible, nativo avanzado si no)
      const rects = isOpenCVReady 
        ? detectContoursOpenCV(msg.imageData, msg.minArea)
        : detectContoursAdvanced(msg.imageData, msg.minArea);
      
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Error en detección:', e);
      postMessage({ type: 'DETECTED', rects: [] } as Outgoing);
    }
  }
};