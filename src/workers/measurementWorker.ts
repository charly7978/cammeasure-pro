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

// Native contour detection without OpenCV
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

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    postMessage({ type: 'READY' } as Outgoing);
    return;
  }

  if (msg.type === 'DETECT') {
    try {
      const rects = detectContoursNative(msg.imageData, msg.minArea);
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Worker error', e);
    }
  }
};
