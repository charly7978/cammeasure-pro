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

// Worker OPTIMIZADO para evitar congelación
let isInitialized = false;

// Detección RÁPIDA y SIMPLE (sin OpenCV complejo)
function detectContoursSimple(imageData: ImageData, minArea: number) {
  const { width, height, data } = imageData;
  const rects = [];
  
  // Convertir a escala de grises RÁPIDO
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  
  // Detección de bordes SIMPLIFICADA (más rápida)
  const edges = new Uint8Array(width * height);
  const threshold = 50;
  
  // Operador Sobel simplificado
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Gradiente horizontal simplificado
      const gx = gray[idx + 1] - gray[idx - 1];
      // Gradiente vertical simplificado  
      const gy = gray[(y + 1) * width + x] - gray[(y - 1) * width + x];
      
      // Magnitud del gradiente
      const magnitude = Math.abs(gx) + Math.abs(gy); // Más rápido que sqrt
      edges[idx] = magnitude > threshold ? 255 : 0;
    }
  }
  
  // Encontrar componentes conectados SIMPLIFICADO
  const visited = new Array(width * height).fill(false);
  const imageArea = width * height;
  
  // Buscar solo en una grilla para ser más rápido
  const step = 5; // Saltar píxeles para ser más rápido
  
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = y * width + x;
      if (edges[idx] > 0 && !visited[idx]) {
        const rect = floodFillSimple(edges, visited, x, y, width, height);
        const area = rect.width * rect.height;
        
        // Filtros básicos
        const aspectRatio = rect.width / rect.height;
        const sizeRatio = area / imageArea;
        
        if (area >= minArea && 
            area <= imageArea * 0.4 &&
            aspectRatio > 0.2 && aspectRatio < 5.0 &&
            rect.width > 30 && rect.height > 30 &&
            sizeRatio > 0.001 && sizeRatio < 0.3) {
          
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
  
  // Ordenar por área y tomar solo los mejores
  rects.sort((a, b) => b.area - a.area);
  
  // Retornar solo los 3 mejores objetos para evitar sobrecarga
  return rects.slice(0, 3);
}

// Flood fill SIMPLIFICADO y más rápido
function floodFillSimple(edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let count = 0;
  const maxIterations = 1000; // Limitar iteraciones para evitar cuelgue
  
  while (stack.length > 0 && count < maxIterations) {
    count++;
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
    
    // Agregar solo vecinos directos (no diagonales) para ser más rápido
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

// Inicializar worker SIMPLE
self.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    if (!isInitialized) {
      console.log('🚀 Worker inicializado en modo RÁPIDO');
      isInitialized = true;
    }
    postMessage({ type: 'READY' } as Outgoing);
    return;
  }

  if (msg.type === 'DETECT') {
    try {
      // Usar solo detección simple y rápida
      const rects = detectContoursSimple(msg.imageData, msg.minArea);
      
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Worker error:', e);
      // En caso de error, devolver array vacío
      postMessage({ type: 'DETECTED', rects: [] } as Outgoing);
    }
  }
};