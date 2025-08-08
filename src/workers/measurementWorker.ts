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

// Worker MEJORADO para detección precisa de contornos
declare var importScripts: (urls: string) => void;
declare var cv: any;

let isOpenCVReady = false;
let isInitialized = false;

// Cargar OpenCV
function loadOpenCV(): Promise<void> {
  return new Promise((resolve) => {
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
          console.log('✅ OpenCV cargado - detección precisa habilitada');
          resolve();
        } else {
          setTimeout(checkCV, 100);
        }
      };
      
      setTimeout(checkCV, 100);
      
    } catch (error) {
      console.warn('⚠️ OpenCV no disponible, usando detección nativa mejorada');
      resolve();
    }
  });
}

// DETECCIÓN PRINCIPAL: Priorizar OpenCV para mejor precisión
function detectContoursEnhanced(imageData: ImageData, minArea: number) {
  if (isOpenCVReady && cv) {
    return detectContoursOpenCVEnhanced(imageData, minArea);
  } else {
    return detectContoursNativeEnhanced(imageData, minArea);
  }
}

// DETECCIÓN OPENCV MEJORADA para contornos precisos
function detectContoursOpenCVEnhanced(imageData: ImageData, minArea: number) {
  try {
    const src = cv.matFromImageData(imageData);
    
    // 1. Convertir a escala de grises
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // 2. Reducir ruido con filtro bilateral (preserva bordes)
    const denoised = new cv.Mat();
    cv.bilateralFilter(gray, denoised, 9, 75, 75);
    
    // 3. Mejorar contraste con CLAHE
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    const enhanced = new cv.Mat();
    clahe.apply(denoised, enhanced);
    
    // 4. Detección de bordes Canny con parámetros optimizados
    const edges = new cv.Mat();
    cv.Canny(enhanced, edges, 30, 90, 3, false); // Umbrales más bajos para mejor detección
    
    // 5. Operaciones morfológicas para cerrar contornos
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
    const morphed = new cv.Mat();
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);
    
    // 6. Dilatación ligera para conectar bordes cercanos
    const dilated = new cv.Mat();
    cv.dilate(morphed, dilated, kernel, new cv.Point(-1, -1), 1);
    
    // 7. Encontrar contornos con jerarquía
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    const rects = [];
    const imageArea = imageData.width * imageData.height;
    
    console.log(`🔍 OpenCV encontró ${contours.size()} contornos`);
    
    // 8. Procesar cada contorno con análisis detallado
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      
      // Aproximar contorno para reducir puntos
      const epsilon = 0.01 * cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, epsilon, true);
      
      const rect = cv.boundingRect(contour);
      const area = cv.contourArea(contour);
      const perimeter = cv.arcLength(contour, true);
      
      // Calcular métricas de calidad del contorno
      const aspectRatio = rect.width / rect.height;
      const extent = area / (rect.width * rect.height);
      
      // Calcular convex hull para solidez
      const hull = new cv.Mat();
      cv.convexHull(contour, hull, false, true);
      const hullArea = cv.contourArea(hull);
      const solidity = area / hullArea;
      
      // Calcular circularidad
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      
      // Filtros mejorados para objetos reales
      const isValidSize = area >= minArea && area <= imageArea * 0.5;
      const isValidShape = aspectRatio > 0.1 && aspectRatio < 10.0;
      const isValidExtent = extent > 0.2;
      const isValidSolidity = solidity > 0.4;
      const isValidCircularity = circularity > 0.02;
      const hasMinimumDimensions = rect.width > 20 && rect.height > 20;
      const notTooThin = Math.min(rect.width, rect.height) > 15;
      
      if (isValidSize && isValidShape && isValidExtent && isValidSolidity && 
          isValidCircularity && hasMinimumDimensions && notTooThin) {
        
        // Calcular confianza basada en múltiples factores
        const sizeScore = Math.min(area / (minArea * 3), 1.0);
        const shapeScore = Math.min(circularity * 5, 1.0);
        const solidityScore = solidity;
        const extentScore = extent;
        const positionScore = calculatePositionScore(rect, imageData.width, imageData.height);
        const contourQuality = Math.min(approx.rows / 20, 1.0); // Más puntos = mejor contorno
        
        const confidence = (
          sizeScore * 0.2 + 
          shapeScore * 0.2 + 
          solidityScore * 0.2 + 
          extentScore * 0.15 + 
          positionScore * 0.15 +
          contourQuality * 0.1
        );
        
        rects.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          area: area,
          confidence: Math.min(confidence, 1.0),
          circularity: circularity,
          solidity: solidity,
          extent: extent,
          aspectRatio: aspectRatio,
          perimeter: perimeter,
          contourPoints: approx.rows
        });
      }
      
      approx.delete();
      hull.delete();
    }
    
    // Liberar memoria OpenCV
    src.delete();
    gray.delete();
    denoised.delete();
    enhanced.delete();
    edges.delete();
    kernel.delete();
    morphed.delete();
    dilated.delete();
    contours.delete();
    hierarchy.delete();
    clahe.delete();
    
    // Filtrar objetos superpuestos y ordenar por calidad
    const filteredRects = filterOverlappingRectsEnhanced(rects);
    filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
    
    console.log(`✅ OpenCV procesó ${filteredRects.length} objetos válidos`);
    return filteredRects.slice(0, 5); // Top 5 objetos
    
  } catch (error) {
    console.error('Error en OpenCV mejorado:', error);
    return detectContoursNativeEnhanced(imageData, minArea);
  }
}

// DETECCIÓN NATIVA MEJORADA (fallback robusto)
function detectContoursNativeEnhanced(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  console.log('🔧 Usando detección nativa mejorada');
  
  // 1. Convertir a escala de grises con mejor precisión
  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  
  // 2. Filtro Gaussiano para reducir ruido
  const blurred = applyGaussianBlurEnhanced(gray, width, height, 1.0);
  
  // 3. Mejorar contraste local
  const enhanced = enhanceLocalContrast(blurred, width, height);
  
  // 4. Detección de bordes multi-direccional
  const edges = detectEdgesMultiDirectional(enhanced, width, height);
  
  // 5. Umbralización adaptativa mejorada
  const threshold = calculateAdaptiveThreshold(edges, width, height);
  const binaryEdges = new Uint8Array(width * height);
  for (let i = 0; i < edges.length; i++) {
    binaryEdges[i] = edges[i] > threshold ? 255 : 0;
  }
  
  // 6. Operaciones morfológicas para cerrar contornos
  const closed = applyMorphologicalClosingEnhanced(binaryEdges, width, height);
  
  // 7. Encontrar componentes conectados con mejor algoritmo
  const visited = new Array(width * height).fill(false);
  const imageArea = width * height;
  
  for (let y = 0; y < height; y += 2) { // Optimización controlada
    for (let x = 0; x < width; x += 2) {
      const idx = y * width + x;
      if (closed[idx] > 0 && !visited[idx]) {
        const component = floodFillEnhanced(closed, visited, x, y, width, height);
        const area = component.area;
        
        // Filtros mejorados
        const aspectRatio = component.width / component.height;
        const sizeRatio = area / imageArea;
        const compactness = area / (component.width * component.height);
        
        if (area >= minArea && 
            area <= imageArea * 0.5 &&
            aspectRatio > 0.1 && aspectRatio < 10.0 &&
            component.width > 20 && component.height > 20 &&
            sizeRatio > 0.0005 && sizeRatio < 0.4 &&
            compactness > 0.2) {
          
          const positionScore = calculatePositionScore(component, width, height);
          const sizeScore = Math.min(area / (minArea * 2), 1.0);
          const shapeScore = 1 / (1 + Math.abs(Math.log(Math.max(aspectRatio, 1/aspectRatio))));
          const compactnessScore = compactness;
          
          const confidence = (
            sizeScore * 0.3 + 
            positionScore * 0.25 + 
            shapeScore * 0.25 + 
            compactnessScore * 0.2
          );
          
          rects.push({
            x: component.x,
            y: component.y,
            width: component.width,
            height: component.height,
            area: area,
            confidence: confidence,
            aspectRatio: aspectRatio,
            compactness: compactness
          });
        }
      }
    }
  }
  
  // Filtrar objetos superpuestos y ordenar
  const filteredRects = filterOverlappingRectsEnhanced(rects);
  filteredRects.sort((a, b) => (b.confidence * b.area) - (a.confidence * a.area));
  
  console.log(`✅ Detección nativa procesó ${filteredRects.length} objetos válidos`);
  return filteredRects.slice(0, 5); // Top 5 objetos
}

// MEJORA DE CONTRASTE LOCAL
function enhanceLocalContrast(data: Float32Array, width: number, height: number): Float32Array {
  const result = new Float32Array(width * height);
  const windowSize = 15;
  const half = Math.floor(windowSize / 2);
  
  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      const idx = y * width + x;
      
      // Calcular media y desviación estándar local
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const val = data[(y + dy) * width + (x + dx)];
          sum += val;
          sumSq += val * val;
          count++;
        }
      }
      
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      const stdDev = Math.sqrt(Math.max(variance, 1));
      
      // Normalización local
      const normalized = (data[idx] - mean) / stdDev;
      result[idx] = Math.max(0, Math.min(255, 128 + normalized * 50));
    }
  }
  
  return result;
}

// DETECCIÓN DE BORDES MULTI-DIRECCIONAL
function detectEdgesMultiDirectional(data: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Operadores Sobel X e Y
      const sobelX = 
        -1 * data[(y-1) * width + (x-1)] + 1 * data[(y-1) * width + (x+1)] +
        -2 * data[y * width + (x-1)] + 2 * data[y * width + (x+1)] +
        -1 * data[(y+1) * width + (x-1)] + 1 * data[(y+1) * width + (x+1)];
      
      const sobelY = 
        -1 * data[(y-1) * width + (x-1)] - 2 * data[(y-1) * width + x] - 1 * data[(y-1) * width + (x+1)] +
        1 * data[(y+1) * width + (x-1)] + 2 * data[(y+1) * width + x] + 1 * data[(y+1) * width + (x+1)];
      
      // Operadores diagonales adicionales
      const diag1 = 
        -2 * data[(y-1) * width + (x-1)] + 2 * data[(y+1) * width + (x+1)];
      
      const diag2 = 
        -2 * data[(y-1) * width + (x+1)] + 2 * data[(y+1) * width + (x-1)];
      
      // Combinar todas las direcciones
      const magnitude = Math.sqrt(sobelX * sobelX + sobelY * sobelY + diag1 * diag1 + diag2 * diag2);
      edges[idx] = magnitude;
    }
  }
  
  return edges;
}

// UMBRALIZACIÓN ADAPTATIVA MEJORADA
function calculateAdaptiveThreshold(edges: Float32Array, width: number, height: number): number {
  // Calcular histograma
  const histogram = new Array(256).fill(0);
  let max = 0;
  
  for (let i = 0; i < edges.length; i++) {
    const value = Math.min(255, Math.max(0, Math.round(edges[i])));
    histogram[value]++;
    max = Math.max(max, edges[i]);
  }
  
  // Método de Otsu mejorado
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
  
  // Ajustar umbral basado en contenido de la imagen
  const adaptiveThreshold = Math.max(threshold * 0.7, max * 0.15);
  return adaptiveThreshold;
}

// FILTRO GAUSSIANO MEJORADO
function applyGaussianBlurEnhanced(data: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const result = new Float32Array(width * height);
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
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
  
  // Aplicar filtro separable (horizontal + vertical)
  const temp = new Float32Array(width * height);
  
  // Filtro horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const px = x + k - center;
        if (px >= 0 && px < width) {
          value += data[y * width + px] * kernel[k];
        } else {
          // Manejo de bordes por reflexión
          const reflectedPx = px < 0 ? -px : (2 * width - px - 2);
          const clampedPx = Math.max(0, Math.min(width - 1, reflectedPx));
          value += data[y * width + clampedPx] * kernel[k];
        }
      }
      temp[y * width + x] = value;
    }
  }
  
  // Filtro vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let k = 0; k < kernelSize; k++) {
        const py = y + k - center;
        if (py >= 0 && py < height) {
          value += temp[py * width + x] * kernel[k];
        } else {
          // Manejo de bordes por reflexión
          const reflectedPy = py < 0 ? -py : (2 * height - py - 2);
          const clampedPy = Math.max(0, Math.min(height - 1, reflectedPy));
          value += temp[clampedPy * width + x] * kernel[k];
        }
      }
      result[y * width + x] = value;
    }
  }
  
  return result;
}

// OPERACIÓN MORFOLÓGICA MEJORADA
function applyMorphologicalClosingEnhanced(data: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(width * height);
  const kernelSize = 5; // Kernel más grande para mejor cierre
  const offset = Math.floor(kernelSize / 2);
  
  // Kernel circular para mejor resultado
  const kernel = [];
  for (let dy = -offset; dy <= offset; dy++) {
    for (let dx = -offset; dx <= offset; dx++) {
      if (dx * dx + dy * dy <= offset * offset) {
        kernel.push({dx, dy});
      }
    }
  }
  
  // Dilatación
  const dilated = new Uint8Array(width * height);
  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let maxVal = 0;
      for (const {dx, dy} of kernel) {
        maxVal = Math.max(maxVal, data[(y + dy) * width + (x + dx)]);
      }
      dilated[y * width + x] = maxVal;
    }
  }
  
  // Erosión
  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let minVal = 255;
      for (const {dx, dy} of kernel) {
        minVal = Math.min(minVal, dilated[(y + dy) * width + (x + dx)]);
      }
      result[y * width + x] = minVal;
    }
  }
  
  return result;
}

// FLOOD FILL MEJORADO
function floodFillEnhanced(edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let area = 0;
  let iterations = 0;
  const maxIterations = 5000;
  
  while (stack.length > 0 && iterations < maxIterations) {
    iterations++;
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] === 0) {
      continue;
    }
    
    visited[idx] = true;
    area++;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // Agregar vecinos (8-conectividad para mejor detección)
    stack.push(
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
      [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]
    );
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    area: area
  };
}

// Calcular puntuación por posición
function calculatePositionScore(rect: any, imageWidth: number, imageHeight: number): number {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const imageCenterX = imageWidth / 2;
  const imageCenterY = imageHeight / 2;
  
  const distanceFromCenter = Math.sqrt(
    Math.pow(centerX - imageCenterX, 2) + 
    Math.pow(centerY - imageCenterY, 2)
  );
  const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
  
  return Math.pow(1 - (distanceFromCenter / maxDistance), 1.2);
}

// FILTRADO MEJORADO de objetos superpuestos
function filterOverlappingRectsEnhanced(rects: any[]) {
  const filtered = [];
  
  for (let i = 0; i < rects.length; i++) {
    let isOverlapping = false;
    
    for (let j = 0; j < filtered.length; j++) {
      const overlap = calculateOverlap(rects[i], filtered[j]);
      
      if (overlap > 0.3) { // Umbral más estricto
        isOverlapping = true;
        
        // Mantener el objeto con mejor puntuación combinada
        const score1 = rects[i].confidence * rects[i].area;
        const score2 = filtered[j].confidence * filtered[j].area;
        
        if (score1 > score2) {
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

// Inicializar worker mejorado
self.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    if (!isInitialized) {
      try {
        await loadOpenCV();
        isInitialized = true;
        console.log('🚀 Worker de detección mejorada inicializado:', {
          openCV: isOpenCVReady ? 'Disponible - Máxima precisión' : 'No disponible',
          nativeEnhanced: 'Algoritmos nativos mejorados activos',
          features: [
            'Detección de bordes multi-direccional',
            'Umbralización adaptativa',
            'Operaciones morfológicas avanzadas',
            'Filtrado inteligente de contornos'
          ]
        });
      } catch (error) {
        console.error('Error inicializando worker mejorado:', error);
      }
    }
    postMessage({ type: 'READY' } as Outgoing);
    return;
  }

  if (msg.type === 'DETECT') {
    try {
      const startTime = performance.now();
      
      // Usar detección mejorada
      const rects = detectContoursEnhanced(msg.imageData, msg.minArea);
      
      const endTime = performance.now();
      console.log(`⚡ Detección completada en ${(endTime - startTime).toFixed(1)}ms - ${rects.length} objetos encontrados`);
      
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Error en detección mejorada:', e);
      postMessage({ type: 'DETECTED', rects: [] } as Outgoing);
    }
  }
};