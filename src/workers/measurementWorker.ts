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

// Advanced Computer Vision Worker para detección de objetos de alta precisión
declare var importScripts: (urls: string) => void;
declare var cv: any;

let isOpenCVReady = false;
let isAdvancedModeEnabled = true;

// Cargar OpenCV con múltiples fuentes de respaldo
function loadOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Verificar si OpenCV ya está cargado
    if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
      isOpenCVReady = true;
      resolve();
      return;
    }

    const opencvSources = [
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
      'https://unpkg.com/opencv.js@4.8.0/opencv.js'
    ];

    let currentIndex = 0;

    const tryLoadSource = () => {
      if (currentIndex >= opencvSources.length) {
        console.warn('All OpenCV sources failed, using advanced native algorithms');
        resolve();
        return;
      }

      try {
        importScripts(opencvSources[currentIndex]);
        
        const checkCV = (attempts = 0) => {
          if (typeof self !== 'undefined' && (self as any).cv && (self as any).cv.Mat) {
            isOpenCVReady = true;
            console.log(`OpenCV loaded successfully from: ${opencvSources[currentIndex]}`);
            resolve();
          } else if (attempts < 100) {
            setTimeout(() => checkCV(attempts + 1), 50);
          } else {
            currentIndex++;
            tryLoadSource();
          }
        };
        
        setTimeout(checkCV, 100);
        
      } catch (error) {
        console.warn(`Failed to load OpenCV from ${opencvSources[currentIndex]}:`, error);
        currentIndex++;
        tryLoadSource();
      }
    };

    tryLoadSource();
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

// Algoritmo avanzado de detección multi-modal con OpenCV
function detectContoursOpenCV(imageData: ImageData, minArea: number) {
  if (!isOpenCVReady || !cv) {
    return detectAdvancedNative(imageData, minArea);
  }

  try {
    const src = cv.matFromImageData(imageData);
    const results = [];

    // MÉTODO 1: Detección por contornos con múltiples umbrales
    const contourResults = detectByContours(src, minArea);
    results.push(...contourResults);

    // MÉTODO 2: Detección por bordes Canny avanzado
    const edgeResults = detectByEdges(src, minArea);
    results.push(...edgeResults);

    // MÉTODO 3: Detección por características FAST/ORB
    const featureResults = detectByFeatures(src, minArea);
    results.push(...featureResults);

    // MÉTODO 4: Detección por análisis de gradientes
    const gradientResults = detectByGradients(src, minArea);
    results.push(...gradientResults);

    src.delete();

    // Fusionar y filtrar resultados
    const mergedResults = mergeDetectionResults(results);
    return rankAndFilterResults(mergedResults, imageData.width * imageData.height);

  } catch (error) {
    console.error('Advanced OpenCV detection error:', error);
    return detectAdvancedNative(imageData, minArea);
  }
}

// Detección por contornos con múltiples técnicas
function detectByContours(src: any, minArea: number) {
  const results = [];
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Técnica 1: Umbral adaptativo
  const adaptiveThresh = new cv.Mat();
  cv.adaptiveThreshold(gray, adaptiveThresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
  results.push(...findContoursInMat(adaptiveThresh, minArea, 'adaptive'));

  // Técnica 2: Umbral Otsu
  const otsuThresh = new cv.Mat();
  cv.threshold(gray, otsuThresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
  results.push(...findContoursInMat(otsuThresh, minArea, 'otsu'));

  // Técnica 3: Múltiples umbrales fijos
  for (let threshold = 50; threshold <= 200; threshold += 50) {
    const fixedThresh = new cv.Mat();
    cv.threshold(gray, fixedThresh, threshold, 255, cv.THRESH_BINARY);
    results.push(...findContoursInMat(fixedThresh, minArea, `fixed_${threshold}`));
    fixedThresh.delete();
  }

  gray.delete();
  adaptiveThresh.delete();
  otsuThresh.delete();
  
  return results;
}

// Detección por bordes Canny con múltiples parámetros
function detectByEdges(src: any, minArea: number) {
  const results = [];
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Múltiples configuraciones de Canny
  const cannyConfigs = [
    { low: 50, high: 150 },
    { low: 100, high: 200 },
    { low: 30, high: 100 },
    { low: 80, high: 240 }
  ];

  for (const config of cannyConfigs) {
    const edges = new cv.Mat();
    cv.Canny(gray, edges, config.low, config.high);
    
    // Dilatación para conectar bordes cercanos
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.dilate(edges, edges, kernel);
    
    results.push(...findContoursInMat(edges, minArea, `canny_${config.low}_${config.high}`));
    
    edges.delete();
    kernel.delete();
  }

  gray.delete();
  return results;
}

// Detección por características FAST
function detectByFeatures(src: any, minArea: number) {
  const results = [];
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  try {
    // Detector FAST
    const fast = new cv.FastFeatureDetector();
    const keypoints = new cv.KeyPointVector();
    fast.detect(gray, keypoints);

    // Agrupar keypoints en regiones
    const regions = clusterKeypoints(keypoints, gray.cols, gray.rows);
    
    for (const region of regions) {
      if (region.area >= minArea) {
        results.push({
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          area: region.area,
          confidence: region.density,
          method: 'features'
        });
      }
    }

    fast.delete();
    keypoints.delete();
  } catch (error) {
    console.warn('Feature detection failed:', error);
  }

  gray.delete();
  return results;
}

// Detección por análisis de gradientes
function detectByGradients(src: any, minArea: number) {
  const results = [];
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Gradientes Sobel
  const gradX = new cv.Mat();
  const gradY = new cv.Mat();
  cv.Sobel(gray, gradX, cv.CV_32F, 1, 0, 3);
  cv.Sobel(gray, gradY, cv.CV_32F, 0, 1, 3);

  // Magnitud del gradiente
  const magnitude = new cv.Mat();
  cv.magnitude(gradX, gradY, magnitude);

  // Umbralizar magnitud
  const thresh = new cv.Mat();
  cv.threshold(magnitude, thresh, 50, 255, cv.THRESH_BINARY);
  thresh.convertTo(thresh, cv.CV_8U);

  results.push(...findContoursInMat(thresh, minArea, 'gradient'));

  gray.delete();
  gradX.delete();
  gradY.delete();
  magnitude.delete();
  thresh.delete();

  return results;
}

// Función auxiliar para encontrar contornos en una matriz
function findContoursInMat(mat: any, minArea: number, method: string) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const results = [];
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    
    if (area >= minArea) {
      const rect = cv.boundingRect(contour);
      const hull = new cv.Mat();
      cv.convexHull(contour, hull);
      const hullArea = cv.contourArea(hull);
      const solidity = hullArea > 0 ? area / hullArea : 0;
      
      // Calcular momentos para características adicionales
      const moments = cv.moments(contour);
      const aspectRatio = rect.width / rect.height;
      const extent = area / (rect.width * rect.height);
      
      results.push({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        area: area,
        confidence: calculateAdvancedConfidence(solidity, aspectRatio, extent, moments),
        method: method,
        solidity: solidity,
        aspectRatio: aspectRatio,
        extent: extent,
        moments: moments
      });
      
      hull.delete();
    }
    
    contour.delete();
  }

  contours.delete();
  hierarchy.delete();
  return results;
}

// Calcular confianza avanzada basada en múltiples métricas
function calculateAdvancedConfidence(solidity: number, aspectRatio: number, extent: number, moments: any): number {
  let confidence = 0;
  
  // Factor de solidez (0.3)
  confidence += Math.min(solidity, 1.0) * 0.3;
  
  // Factor de relación de aspecto (0.2)
  const aspectScore = aspectRatio > 0.2 && aspectRatio < 5.0 ? 1.0 : 0.5;
  confidence += aspectScore * 0.2;
  
  // Factor de extensión (0.2)
  confidence += Math.min(extent, 1.0) * 0.2;
  
  // Factor de compacidad basado en momentos (0.3)
  if (moments.m00 > 0) {
    const compactness = (moments.m00 * moments.m00) / (2 * Math.PI * (moments.mu20 + moments.mu02));
    confidence += Math.min(compactness / 100, 1.0) * 0.3;
  }
  
  return Math.min(confidence, 1.0);
}

// Agrupar keypoints en regiones
function clusterKeypoints(keypoints: any, width: number, height: number) {
  const regions = [];
  const gridSize = 50;
  const grid = Array(Math.ceil(height / gridSize)).fill(null).map(() => 
    Array(Math.ceil(width / gridSize)).fill(0)
  );

  // Contar keypoints por celda
  for (let i = 0; i < keypoints.size(); i++) {
    const kp = keypoints.get(i);
    const gridX = Math.floor(kp.pt.x / gridSize);
    const gridY = Math.floor(kp.pt.y / gridSize);
    
    if (gridY < grid.length && gridX < grid[0].length) {
      grid[gridY][gridX]++;
    }
  }

  // Encontrar regiones con alta densidad
  for (let y = 0; y < grid.length - 1; y++) {
    for (let x = 0; x < grid[0].length - 1; x++) {
      const density = grid[y][x] + grid[y][x+1] + grid[y+1][x] + grid[y+1][x+1];
      
      if (density > 10) { // Umbral de densidad
        regions.push({
          x: x * gridSize,
          y: y * gridSize,
          width: gridSize * 2,
          height: gridSize * 2,
          area: gridSize * gridSize * 4,
          density: density / 40 // Normalizar
        });
      }
    }
  }

  return regions;
}

// Algoritmo nativo avanzado con múltiples técnicas de detección
function detectAdvancedNative(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const results = [];

  // TÉCNICA 1: Detección por gradientes multi-direccionales
  const gradientResults = detectByAdvancedGradients(data, width, height, minArea);
  results.push(...gradientResults);

  // TÉCNICA 2: Detección por análisis de textura
  const textureResults = detectByTextureAnalysis(data, width, height, minArea);
  results.push(...textureResults);

  // TÉCNICA 3: Detección por análisis de frecuencia
  const frequencyResults = detectByFrequencyAnalysis(data, width, height, minArea);
  results.push(...frequencyResults);

  // TÉCNICA 4: Detección por clustering de colores
  const colorResults = detectByColorClustering(data, width, height, minArea);
  results.push(...colorResults);

  // TÉCNICA 5: Detección por análisis morfológico
  const morphResults = detectByMorphologicalAnalysis(data, width, height, minArea);
  results.push(...morphResults);

  // Fusionar y filtrar resultados
  const mergedResults = mergeDetectionResults(results);
  return rankAndFilterResults(mergedResults, width * height);
}

// Detección por gradientes avanzados (Sobel, Prewitt, Roberts, Laplacian)
function detectByAdvancedGradients(data: Uint8ClampedArray, width: number, height: number, minArea: number) {
  const results = [];
  
  // Convertir a escala de grises
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  }

  // Operadores de gradiente
  const operators = {
    sobel: { x: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], y: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]] },
    prewitt: { x: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], y: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]] },
    roberts: { x: [[1, 0], [0, -1]], y: [[0, 1], [-1, 0]] },
    laplacian: [[0, -1, 0], [-1, 4, -1], [0, -1, 0]]
  };

  for (const [name, op] of Object.entries(operators)) {
    const edges = applyGradientOperator(gray, width, height, op, name);
    const components = findConnectedComponents(edges, width, height, minArea);
    
    for (const comp of components) {
      results.push({
        ...comp,
        method: `gradient_${name}`,
        confidence: calculateGradientConfidence(comp, edges, width, height)
      });
    }
  }

  return results;
}

// Detección por análisis de textura usando matrices de co-ocurrencia
function detectByTextureAnalysis(data: Uint8ClampedArray, width: number, height: number, minArea: number) {
  const results = [];
  const blockSize = 32; // Tamaño del bloque para análisis
  
  for (let y = 0; y < height - blockSize; y += blockSize / 2) {
    for (let x = 0; x < width - blockSize; x += blockSize / 2) {
      const textureFeatures = calculateTextureFeatures(data, x, y, blockSize, width);
      
      if (textureFeatures.uniformity < 0.1 && textureFeatures.contrast > 50) {
        // Región con textura interesante
        const region = refineTextureRegion(data, x, y, blockSize, width, height);
        
        if (region.area >= minArea) {
          results.push({
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            area: region.area,
            method: 'texture',
            confidence: textureFeatures.confidence,
            textureFeatures: textureFeatures
          });
        }
      }
    }
  }

  return results;
}

// Detección por análisis de frecuencia usando FFT simulada
function detectByFrequencyAnalysis(data: Uint8ClampedArray, width: number, height: number, minArea: number) {
  const results = [];
  const blockSize = 64;
  
  for (let y = 0; y < height - blockSize; y += blockSize / 2) {
    for (let x = 0; x < width - blockSize; x += blockSize / 2) {
      const freqFeatures = calculateFrequencyFeatures(data, x, y, blockSize, width);
      
      if (freqFeatures.highFreqEnergy > 0.3 && freqFeatures.edgeStrength > 0.5) {
        const region = {
          x: x,
          y: y,
          width: blockSize,
          height: blockSize,
          area: blockSize * blockSize
        };
        
        if (region.area >= minArea) {
          results.push({
            ...region,
            method: 'frequency',
            confidence: freqFeatures.confidence,
            frequencyFeatures: freqFeatures
          });
        }
      }
    }
  }

  return results;
}

// Detección por clustering de colores en espacio LAB
function detectByColorClustering(data: Uint8ClampedArray, width: number, height: number, minArea: number) {
  const results = [];
  
  // Convertir RGB a LAB
  const labData = convertRGBtoLAB(data);
  
  // K-means clustering en espacio de color
  const clusters = performKMeansClustering(labData, 8); // 8 clusters
  
  // Encontrar regiones coherentes por color
  const colorRegions = findColorRegions(clusters, width, height, minArea);
  
  for (const region of colorRegions) {
    results.push({
      ...region,
      method: 'color_clustering',
      confidence: region.coherence
    });
  }

  return results;
}

// Detección por análisis morfológico
function detectByMorphologicalAnalysis(data: Uint8ClampedArray, width: number, height: number, minArea: number) {
  const results = [];
  
  // Convertir a binario usando múltiples umbrales
  const thresholds = [64, 128, 192];
  
  for (const threshold of thresholds) {
    const binary = new Uint8Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      binary[i] = gray > threshold ? 255 : 0;
    }
    
    // Operaciones morfológicas
    const opened = morphologicalOpening(binary, width, height, 3);
    const closed = morphologicalClosing(opened, width, height, 5);
    
    const components = findConnectedComponents(closed, width, height, minArea);
    
    for (const comp of components) {
      results.push({
        ...comp,
        method: `morphological_${threshold}`,
        confidence: calculateMorphologicalConfidence(comp, binary, width, height)
      });
    }
  }

  return results;
}

// Fusionar resultados de múltiples métodos de detección
function mergeDetectionResults(results: any[]) {
  const merged = [];
  const processed = new Set();

  for (let i = 0; i < results.length; i++) {
    if (processed.has(i)) continue;
    
    const current = results[i];
    const similar = [current];
    processed.add(i);

    // Buscar detecciones similares
    for (let j = i + 1; j < results.length; j++) {
      if (processed.has(j)) continue;
      
      const other = results[j];
      const overlap = calculateOverlap(current, other);
      
      if (overlap > 0.3) { // 30% de superposición
        similar.push(other);
        processed.add(j);
      }
    }

    // Fusionar detecciones similares
    if (similar.length > 1) {
      const fusedResult = fuseDetections(similar);
      merged.push(fusedResult);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// Clasificar y filtrar resultados finales
function rankAndFilterResults(results: any[], imageArea: number) {
  // Calcular puntuación final para cada resultado
  for (const result of results) {
    result.finalScore = calculateFinalScore(result, imageArea);
  }

  // Ordenar por puntuación
  results.sort((a, b) => b.finalScore - a.finalScore);

  // Filtrar resultados de alta calidad
  const filtered = results.filter(r => 
    r.finalScore > 0.3 && 
    r.area >= 100 && 
    r.area <= imageArea * 0.8
  );

  return filtered.slice(0, 5); // Devolver top 5 detecciones
}

// Calcular puntuación final basada en múltiples factores
function calculateFinalScore(result: any, imageArea: number): number {
  let score = 0;

  // Factor de confianza del método (40%)
  score += result.confidence * 0.4;

  // Factor de tamaño relativo (20%)
  const sizeRatio = result.area / imageArea;
  const sizeScore = sizeRatio > 0.01 && sizeRatio < 0.5 ? 1.0 : 0.5;
  score += sizeScore * 0.2;

  // Factor de forma (20%)
  const aspectRatio = result.width / result.height;
  const shapeScore = aspectRatio > 0.2 && aspectRatio < 5.0 ? 1.0 : 0.6;
  score += shapeScore * 0.2;

  // Factor de posición (10%)
  const centerX = result.x + result.width / 2;
  const centerY = result.y + result.height / 2;
  const imageWidth = Math.sqrt(imageArea * (result.width / result.height));
  const imageHeight = imageArea / imageWidth;
  
  const distanceFromCenter = Math.sqrt(
    Math.pow(centerX - imageWidth / 2, 2) + 
    Math.pow(centerY - imageHeight / 2, 2)
  );
  const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
  const positionScore = 1 - (distanceFromCenter / maxDistance);
  score += positionScore * 0.1;

  // Factor de consistencia entre métodos (10%)
  const methodBonus = result.methods && result.methods.length > 1 ? 1.0 : 0.7;
  score += methodBonus * 0.1;

  return Math.min(score, 1.0);
}

// Funciones auxiliares avanzadas para procesamiento de imágenes

function applyGradientOperator(gray: Float32Array, width: number, height: number, operator: any, name: string): Uint8Array {
  const result = new Uint8Array(width * height);
  
  if (name === 'laplacian') {
    // Operador Laplaciano
    const kernel = operator;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const px = x + kx - 1;
            const py = y + ky - 1;
            sum += gray[py * width + px] * kernel[ky][kx];
          }
        }
        result[y * width + x] = Math.abs(sum) > 50 ? 255 : 0;
      }
    }
  } else {
    // Operadores direccionales (Sobel, Prewitt, Roberts)
    const kernelX = operator.x;
    const kernelY = operator.y;
    const kernelSize = kernelX.length;
    const offset = Math.floor(kernelSize / 2);
    
    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        let sumX = 0, sumY = 0;
        
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const px = x + kx - offset;
            const py = y + ky - offset;
            const pixel = gray[py * width + px];
            sumX += pixel * kernelX[ky][kx];
            sumY += pixel * kernelY[ky][kx];
          }
        }
        
        const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
        result[y * width + x] = magnitude > 30 ? 255 : 0;
      }
    }
  }
  
  return result;
}

function findConnectedComponents(binary: Uint8Array, width: number, height: number, minArea: number): any[] {
  const visited = new Array(width * height).fill(false);
  const components = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] > 0 && !visited[idx]) {
        const component = floodFillAdvanced(binary, visited, x, y, width, height);
        if (component.area >= minArea) {
          components.push(component);
        }
      }
    }
  }
  
  return components;
}

function floodFillAdvanced(binary: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let pixelCount = 0;
  let sumX = 0, sumY = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || binary[idx] === 0) {
      continue;
    }
    
    visited[idx] = true;
    pixelCount++;
    sumX += x;
    sumY += y;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // 8-conectividad
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx !== 0 || dy !== 0) {
          stack.push([x + dx, y + dy]);
        }
      }
    }
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    area: pixelCount,
    centroidX: sumX / pixelCount,
    centroidY: sumY / pixelCount,
    boundingArea: (maxX - minX + 1) * (maxY - minY + 1),
    fillRatio: pixelCount / ((maxX - minX + 1) * (maxY - minY + 1))
  };
}

function calculateTextureFeatures(data: Uint8ClampedArray, x: number, y: number, blockSize: number, width: number) {
  const glcm = new Array(256).fill(null).map(() => new Array(256).fill(0));
  let totalPairs = 0;
  
  // Calcular matriz de co-ocurrencia
  for (let dy = 0; dy < blockSize - 1; dy++) {
    for (let dx = 0; dx < blockSize - 1; dx++) {
      const idx1 = ((y + dy) * width + (x + dx)) * 4;
      const idx2 = ((y + dy) * width + (x + dx + 1)) * 4;
      
      const gray1 = Math.floor((data[idx1] + data[idx1 + 1] + data[idx1 + 2]) / 3);
      const gray2 = Math.floor((data[idx2] + data[idx2 + 1] + data[idx2 + 2]) / 3);
      
      glcm[gray1][gray2]++;
      totalPairs++;
    }
  }
  
  // Normalizar GLCM
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      glcm[i][j] /= totalPairs;
    }
  }
  
  // Calcular características de textura
  let contrast = 0, uniformity = 0, entropy = 0;
  
  for (let i = 0; i < 256; i++) {
    for (let j = 0; j < 256; j++) {
      const p = glcm[i][j];
      if (p > 0) {
        contrast += (i - j) * (i - j) * p;
        uniformity += p * p;
        entropy -= p * Math.log2(p);
      }
    }
  }
  
  return {
    contrast: contrast,
    uniformity: uniformity,
    entropy: entropy,
    confidence: Math.min((contrast / 1000) * (entropy / 10), 1.0)
  };
}

function calculateFrequencyFeatures(data: Uint8ClampedArray, x: number, y: number, blockSize: number, width: number) {
  // Simulación de análisis de frecuencia usando gradientes locales
  let highFreqEnergy = 0;
  let lowFreqEnergy = 0;
  let edgeStrength = 0;
  
  for (let dy = 1; dy < blockSize - 1; dy++) {
    for (let dx = 1; dx < blockSize - 1; dx++) {
      const idx = ((y + dy) * width + (x + dx)) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // Calcular gradientes locales
      const idxLeft = ((y + dy) * width + (x + dx - 1)) * 4;
      const idxRight = ((y + dy) * width + (x + dx + 1)) * 4;
      const idxUp = ((y + dy - 1) * width + (x + dx)) * 4;
      const idxDown = ((y + dy + 1) * width + (x + dx)) * 4;
      
      const grayLeft = (data[idxLeft] + data[idxLeft + 1] + data[idxLeft + 2]) / 3;
      const grayRight = (data[idxRight] + data[idxRight + 1] + data[idxRight + 2]) / 3;
      const grayUp = (data[idxUp] + data[idxUp + 1] + data[idxUp + 2]) / 3;
      const grayDown = (data[idxDown] + data[idxDown + 1] + data[idxDown + 2]) / 3;
      
      const gradX = grayRight - grayLeft;
      const gradY = grayDown - grayUp;
      const magnitude = Math.sqrt(gradX * gradX + gradY * gradY);
      
      if (magnitude > 50) {
        highFreqEnergy += magnitude;
        edgeStrength += 1;
      } else {
        lowFreqEnergy += magnitude;
      }
    }
  }
  
  const totalEnergy = highFreqEnergy + lowFreqEnergy;
  
  return {
    highFreqEnergy: totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0,
    lowFreqEnergy: totalEnergy > 0 ? lowFreqEnergy / totalEnergy : 0,
    edgeStrength: edgeStrength / ((blockSize - 2) * (blockSize - 2)),
    confidence: Math.min(highFreqEnergy / 10000, 1.0)
  };
}

function convertRGBtoLAB(data: Uint8ClampedArray): Float32Array {
  const labData = new Float32Array(data.length);
  
  for (let i = 0; i < data.length; i += 4) {
    // Normalizar RGB
    let r = data[i] / 255.0;
    let g = data[i + 1] / 255.0;
    let b = data[i + 2] / 255.0;
    
    // Gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    // RGB to XYZ
    let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
    
    // Normalize by D65 illuminant
    x /= 0.95047;
    y /= 1.00000;
    z /= 1.08883;
    
    // XYZ to LAB
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);
    
    labData[i] = (116 * y) - 16;     // L
    labData[i + 1] = 500 * (x - y);  // A
    labData[i + 2] = 200 * (y - z);  // B
    labData[i + 3] = data[i + 3];    // Alpha
  }
  
  return labData;
}

function performKMeansClustering(labData: Float32Array, k: number): Uint8Array {
  const numPixels = labData.length / 4;
  const clusters = new Uint8Array(numPixels);
  const centroids = new Float32Array(k * 3);
  
  // Inicializar centroides aleatoriamente
  for (let i = 0; i < k; i++) {
    const randomPixel = Math.floor(Math.random() * numPixels) * 4;
    centroids[i * 3] = labData[randomPixel];
    centroids[i * 3 + 1] = labData[randomPixel + 1];
    centroids[i * 3 + 2] = labData[randomPixel + 2];
  }
  
  // Iteraciones K-means (simplificado)
  for (let iter = 0; iter < 10; iter++) {
    // Asignar píxeles a clusters
    for (let p = 0; p < numPixels; p++) {
      let minDist = Infinity;
      let bestCluster = 0;
      
      for (let c = 0; c < k; c++) {
        const dist = Math.sqrt(
          Math.pow(labData[p * 4] - centroids[c * 3], 2) +
          Math.pow(labData[p * 4 + 1] - centroids[c * 3 + 1], 2) +
          Math.pow(labData[p * 4 + 2] - centroids[c * 3 + 2], 2)
        );
        
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      
      clusters[p] = bestCluster;
    }
    
    // Actualizar centroides
    const counts = new Array(k).fill(0);
    const sums = new Array(k * 3).fill(0);
    
    for (let p = 0; p < numPixels; p++) {
      const cluster = clusters[p];
      counts[cluster]++;
      sums[cluster * 3] += labData[p * 4];
      sums[cluster * 3 + 1] += labData[p * 4 + 1];
      sums[cluster * 3 + 2] += labData[p * 4 + 2];
    }
    
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c * 3] = sums[c * 3] / counts[c];
        centroids[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
        centroids[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
      }
    }
  }
  
  return clusters;
}

function findColorRegions(clusters: Uint8Array, width: number, height: number, minArea: number): any[] {
  const regions = [];
  const visited = new Array(width * height).fill(false);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx]) {
        const region = floodFillColor(clusters, visited, x, y, width, height, clusters[idx]);
        if (region.area >= minArea) {
          regions.push({
            ...region,
            coherence: region.area / region.boundingArea
          });
        }
      }
    }
  }
  
  return regions;
}

function floodFillColor(clusters: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number, targetCluster: number) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let pixelCount = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || clusters[idx] !== targetCluster) {
      continue;
    }
    
    visited[idx] = true;
    pixelCount++;
    
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
    height: maxY - minY + 1,
    area: pixelCount,
    boundingArea: (maxX - minX + 1) * (maxY - minY + 1)
  };
}

function morphologicalOpening(binary: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
  const eroded = morphologicalErosion(binary, width, height, kernelSize);
  return morphologicalDilation(eroded, width, height, kernelSize);
}

function morphologicalClosing(binary: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
  const dilated = morphologicalDilation(binary, width, height, kernelSize);
  return morphologicalErosion(dilated, width, height, kernelSize);
}

function morphologicalErosion(binary: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
  const result = new Uint8Array(width * height);
  const offset = Math.floor(kernelSize / 2);
  
  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let minVal = 255;
      
      for (let ky = -offset; ky <= offset; ky++) {
        for (let kx = -offset; kx <= offset; kx++) {
          const idx = (y + ky) * width + (x + kx);
          minVal = Math.min(minVal, binary[idx]);
        }
      }
      
      result[y * width + x] = minVal;
    }
  }
  
  return result;
}

function morphologicalDilation(binary: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
  const result = new Uint8Array(width * height);
  const offset = Math.floor(kernelSize / 2);
  
  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let maxVal = 0;
      
      for (let ky = -offset; ky <= offset; ky++) {
        for (let kx = -offset; kx <= offset; kx++) {
          const idx = (y + ky) * width + (x + kx);
          maxVal = Math.max(maxVal, binary[idx]);
        }
      }
      
      result[y * width + x] = maxVal;
    }
  }
  
  return result;
}

function calculateGradientConfidence(component: any, edges: Uint8Array, width: number, height: number): number {
  let edgePixels = 0;
  let totalPixels = 0;
  
  for (let y = component.y; y < component.y + component.height; y++) {
    for (let x = component.x; x < component.x + component.width; x++) {
      const idx = y * width + x;
      totalPixels++;
      if (edges[idx] > 0) edgePixels++;
    }
  }
  
  const edgeDensity = edgePixels / totalPixels;
  return Math.min(edgeDensity * 2, 1.0);
}

function calculateMorphologicalConfidence(component: any, binary: Uint8Array, width: number, height: number): number {
  return component.fillRatio * 0.7 + (component.area / component.boundingArea) * 0.3;
}

function fuseDetections(detections: any[]): any {
  // Calcular bounding box fusionado
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let totalConfidence = 0;
  let totalArea = 0;
  const methods = new Set();
  
  for (const det of detections) {
    minX = Math.min(minX, det.x);
    minY = Math.min(minY, det.y);
    maxX = Math.max(maxX, det.x + det.width);
    maxY = Math.max(maxY, det.y + det.height);
    totalConfidence += det.confidence;
    totalArea += det.area;
    methods.add(det.method);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    area: totalArea / detections.length,
    confidence: totalConfidence / detections.length,
    method: 'fused',
    methods: Array.from(methods),
    fusedFrom: detections.length
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