// Worker de medición en tiempo real que SÍ FUNCIONA
interface MeasurementMessage {
  type: 'MEASURE';
  imageData: ImageData;
  calibrationData: {
    pixelsPerMm: number;
    referenceSize: number;
  };
}

interface InitMessage {
  type: 'INIT';
}

type WorkerMessage = MeasurementMessage | InitMessage;

interface MeasurementResult {
  type: 'MEASUREMENT_RESULT';
  objects: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    widthMm: number;
    heightMm: number;
    area: number;
    areaMm2: number;
    confidence: number;
  }>;
  timestamp: number;
}

let isReady = false;

// Función principal de detección y medición
function detectAndMeasure(imageData: ImageData, calibrationData: any): MeasurementResult {
  const { width, height, data } = imageData;
  const { pixelsPerMm } = calibrationData;
  
  // 1. Convertir a escala de grises
  const grayData = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grayData[i / 4] = gray;
  }
  
  // 2. Aplicar filtro de detección de bordes
  const edges = detectEdges(grayData, width, height);
  
  // 3. Encontrar contornos
  const contours = findContours(edges, width, height);
  
  // 4. Filtrar y medir objetos
  const objects = contours
    .filter(contour => {
      const area = contour.width * contour.height;
      return area > 400 && area < (width * height * 0.5); // Filtrar por tamaño
    })
    .map((contour, index) => {
      const widthMm = contour.width / pixelsPerMm;
      const heightMm = contour.height / pixelsPerMm;
      const areaMm2 = (contour.width * contour.height) / (pixelsPerMm * pixelsPerMm);
      
      return {
        id: `obj_${index}_${Date.now()}`,
        x: contour.x,
        y: contour.y,
        width: contour.width,
        height: contour.height,
        widthMm: Math.round(widthMm * 10) / 10,
        heightMm: Math.round(heightMm * 10) / 10,
        area: contour.width * contour.height,
        areaMm2: Math.round(areaMm2 * 100) / 100,
        confidence: calculateConfidence(contour, width, height)
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3); // Máximo 3 objetos
  
  return {
    type: 'MEASUREMENT_RESULT',
    objects,
    timestamp: Date.now()
  };
}

// Detección de bordes usando Sobel
function detectEdges(grayData: Uint8Array, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Operador Sobel
      const gx = 
        -1 * grayData[(y-1) * width + (x-1)] +
        -2 * grayData[y * width + (x-1)] +
        -1 * grayData[(y+1) * width + (x-1)] +
         1 * grayData[(y-1) * width + (x+1)] +
         2 * grayData[y * width + (x+1)] +
         1 * grayData[(y+1) * width + (x+1)];
      
      const gy = 
        -1 * grayData[(y-1) * width + (x-1)] +
        -2 * grayData[(y-1) * width + x] +
        -1 * grayData[(y-1) * width + (x+1)] +
         1 * grayData[(y+1) * width + (x-1)] +
         2 * grayData[(y+1) * width + x] +
         1 * grayData[(y+1) * width + (x+1)];
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = magnitude > 50 ? 255 : 0;
    }
  }
  
  return edges;
}

// Encontrar contornos usando flood fill
function findContours(edges: Uint8Array, width: number, height: number) {
  const visited = new Array(width * height).fill(false);
  const contours = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (edges[idx] > 0 && !visited[idx]) {
        const contour = floodFill(edges, visited, x, y, width, height);
        if (contour.width > 10 && contour.height > 10) {
          contours.push(contour);
        }
      }
    }
  }
  
  return contours;
}

// Flood fill para encontrar componentes conectados
function floodFill(edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let pixelCount = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] === 0) {
      continue;
    }
    
    visited[idx] = true;
    pixelCount++;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // Agregar vecinos
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    pixelCount
  };
}

// Calcular confianza del objeto detectado
function calculateConfidence(contour: any, imageWidth: number, imageHeight: number): number {
  const area = contour.width * contour.height;
  const imageArea = imageWidth * imageHeight;
  
  // Factores de confianza
  const sizeScore = Math.min(area / 1000, 1.0); // Objetos más grandes = más confianza
  const aspectRatio = Math.min(contour.width, contour.height) / Math.max(contour.width, contour.height);
  const aspectScore = aspectRatio > 0.3 ? 1.0 : aspectRatio / 0.3; // Preferir formas no muy alargadas
  const fillRatio = contour.pixelCount / area;
  const fillScore = fillRatio > 0.3 ? 1.0 : fillRatio / 0.3; // Objetos más sólidos
  
  // Posición central es mejor
  const centerX = contour.x + contour.width / 2;
  const centerY = contour.y + contour.height / 2;
  const distanceFromCenter = Math.sqrt(
    Math.pow(centerX - imageWidth / 2, 2) + 
    Math.pow(centerY - imageHeight / 2, 2)
  );
  const maxDistance = Math.sqrt(Math.pow(imageWidth / 2, 2) + Math.pow(imageHeight / 2, 2));
  const positionScore = 1 - (distanceFromCenter / maxDistance);
  
  return Math.min((sizeScore * 0.3 + aspectScore * 0.2 + fillScore * 0.3 + positionScore * 0.2), 1.0);
}

// Manejo de mensajes del worker
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  
  if (message.type === 'INIT') {
    isReady = true;
    self.postMessage({ type: 'READY' });
    return;
  }
  
  if (message.type === 'MEASURE' && isReady) {
    try {
      const result = detectAndMeasure(message.imageData, message.calibrationData);
      self.postMessage(result);
    } catch (error) {
      console.error('Error en medición:', error);
      self.postMessage({
        type: 'MEASUREMENT_RESULT',
        objects: [],
        timestamp: Date.now()
      });
    }
  }
};

// Inicializar worker
console.log('Worker de medición en tiempo real iniciado');