import { BoundingRect, detectContours } from '../lib/imageProcessing';

// Declare worker globals for TypeScript
declare const self: any;
declare function importScripts(...urls: string[]): void;

// Enhanced measurement worker with real computer vision algorithms
let cv: any = null;
let isInitialized = false;

// Advanced filtering parameters for real object detection
const DETECTION_CONFIG = {
  // Multi-scale edge detection thresholds
  cannyLower: [30, 50, 80],
  cannyUpper: [90, 150, 240],
  
  // Morphological operations
  morphKernelSizes: [3, 5, 7],
  
  // Contour filtering
  minContourArea: 500,
  maxContourArea: 50000,
  minAspectRatio: 0.2,
  maxAspectRatio: 5.0,
  
  // Shape analysis
  minCircularity: 0.1,
  minSolidity: 0.3,
  
  // Approximation accuracy
  epsilonFactor: 0.02
};

self.onmessage = function(e: MessageEvent) {
  const { type, imageData, minArea } = e.data;

  switch (type) {
    case 'INIT':
      initializeWorker();
      break;
    case 'DETECT':
      performAdvancedDetection(imageData, minArea || DETECTION_CONFIG.minContourArea);
      break;
  }
};

function initializeWorker() {
  try {
    // Try to load OpenCV in worker context
    importScripts('https://docs.opencv.org/4.8.0/opencv.js');
    
    const checkOpenCV = () => {
      if (typeof (self as any).cv !== 'undefined' && (self as any).cv.Mat) {
        cv = (self as any).cv;
        isInitialized = true;
        console.log('OpenCV initialized in worker');
        self.postMessage({ type: 'READY' });
      } else {
        // Fallback to native algorithms
        console.log('OpenCV not available, using native algorithms');
        isInitialized = true;
        self.postMessage({ type: 'READY' });
      }
    };
    
    setTimeout(checkOpenCV, 1000);
  } catch (error) {
    console.log('OpenCV loading failed, using native algorithms');
    isInitialized = true;
    self.postMessage({ type: 'READY' });
  }
}

function performAdvancedDetection(imageData: ImageData, minArea: number) {
  try {
    let detectedRects: BoundingRect[];
    
    if (cv && cv.Mat) {
      // Use OpenCV for advanced detection
      detectedRects = detectWithOpenCV(imageData, minArea);
    } else {
      // Use enhanced native algorithms
      detectedRects = detectWithNativeAlgorithms(imageData, minArea);
    }
    
    // Apply advanced filtering and quality assessment
    const filteredRects = applyAdvancedFiltering(detectedRects);
    
    self.postMessage({ type: 'DETECTED', rects: filteredRects });
  } catch (error) {
    console.error('Detection failed:', error);
    self.postMessage({ type: 'DETECTED', rects: [] });
  }
}

function detectWithOpenCV(imageData: ImageData, minArea: number): BoundingRect[] {
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const rects: BoundingRect[] = [];
  
  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Multi-scale edge detection for better results
    for (let i = 0; i < DETECTION_CONFIG.cannyLower.length; i++) {
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      
      try {
        // Apply Gaussian blur to reduce noise
        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.4, 1.4, cv.BORDER_DEFAULT);
        
        // Canny edge detection with current thresholds
        cv.Canny(blurred, edges, DETECTION_CONFIG.cannyLower[i], DETECTION_CONFIG.cannyUpper[i]);
        
        // Morphological operations to close gaps
        const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(DETECTION_CONFIG.morphKernelSizes[i], DETECTION_CONFIG.morphKernelSizes[i]));
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
        cv.morphologyEx(edges, edges, cv.MORPH_OPEN, kernel);
        
        // Find contours
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // Process each contour
        for (let j = 0; j < contours.size(); j++) {
          const contour = contours.get(j);
          const area = cv.contourArea(contour);
          
          if (area >= minArea && area <= DETECTION_CONFIG.maxContourArea) {
            const rect = cv.boundingRect(contour);
            const aspectRatio = rect.width / rect.height;
            
            // Calculate advanced geometric properties
            const perimeter = cv.arcLength(contour, true);
            const hull = new cv.Mat();
            cv.convexHull(contour, hull);
            const hullArea = cv.contourArea(hull);
            
            // Calculate shape descriptors
            const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            const solidity = area / hullArea;
            const extent = area / (rect.width * rect.height);
            
            // Apply geometric filters
            if (aspectRatio >= DETECTION_CONFIG.minAspectRatio && 
                aspectRatio <= DETECTION_CONFIG.maxAspectRatio &&
                circularity >= DETECTION_CONFIG.minCircularity &&
                solidity >= DETECTION_CONFIG.minSolidity) {
              
              // Approximate contour for shape analysis
              const epsilon = DETECTION_CONFIG.epsilonFactor * perimeter;
              const approxContour = new cv.Mat();
              cv.approxPolyDP(contour, approxContour, epsilon, true);
              
              const boundingRect: BoundingRect = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                area: area,
                confidence: calculateConfidence(circularity, solidity, extent, area, minArea)
              };
              
              rects.push(boundingRect);
              
              hull.delete();
              approxContour.delete();
            } else {
              hull.delete();
            }
          }
          
          contour.delete();
        }
        
        blurred.delete();
        kernel.delete();
        contours.delete();
        hierarchy.delete();
      } finally {
        edges.delete();
      }
    }
    
  } finally {
    src.delete();
    gray.delete();
  }
  
  return rects;
}

function detectWithNativeAlgorithms(imageData: ImageData, minArea: number): BoundingRect[] {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Convert to grayscale
  const grayData = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grayData[i / 4] = gray;
  }
  
  // Apply Gaussian blur
  const blurred = applyGaussianBlur(grayData, width, height, 1.4);
  
  // Multi-threshold edge detection
  const rects: BoundingRect[] = [];
  
  for (const threshold of [30, 60, 90]) {
    // Simple edge detection using Sobel operator
    const edges = applySobelEdgeDetection(blurred, width, height, threshold);
    
    // Morphological operations
    const processed = applyMorphology(edges, width, height);
    
    // Connected component analysis
    const components = findConnectedComponents(processed, width, height, minArea);
    
    for (const component of components) {
      if (component.area >= minArea && component.area <= DETECTION_CONFIG.maxContourArea) {
        const aspectRatio = component.width / component.height;
        
        if (aspectRatio >= DETECTION_CONFIG.minAspectRatio && 
            aspectRatio <= DETECTION_CONFIG.maxAspectRatio) {
          
          const rect: BoundingRect = {
            x: component.x,
            y: component.y,
            width: component.width,
            height: component.height,
            area: component.area,
            confidence: calculateNativeConfidence(component, minArea)
          };
          
          rects.push(rect);
        }
      }
    }
  }
  
  return rects;
}

function calculateConfidence(circularity: number, solidity: number, extent: number, area: number, minArea: number): number {
  // Weighted confidence calculation based on shape quality
  const circularityScore = Math.min(circularity * 2, 1.0); // Prefer circular objects
  const solidityScore = solidity; // Higher solidity is better
  const extentScore = extent; // Higher extent means better fit
  const sizeScore = Math.min(area / (minArea * 4), 1.0); // Prefer reasonably sized objects
  
  return (circularityScore * 0.3 + solidityScore * 0.3 + extentScore * 0.2 + sizeScore * 0.2);
}

function calculateNativeConfidence(component: any, minArea: number): number {
  const aspectRatio = component.width / component.height;
  const sizeScore = Math.min(component.area / (minArea * 2), 1.0);
  const aspectScore = 1.0 - Math.abs(aspectRatio - 1.0) / 2.0; // Prefer square-ish objects
  
  return (sizeScore * 0.6 + aspectScore * 0.4);
}

// Native image processing functions
function applyGaussianBlur(data: Uint8Array, width: number, height: number, sigma: number): Uint8Array {
  const kernel = generateGaussianKernel(sigma);
  const kernelSize = kernel.length;
  const offset = Math.floor(kernelSize / 2);
  const result = new Uint8Array(width * height);
  
  for (let y = offset; y < height - offset; y++) {
    for (let x = offset; x < width - offset; x++) {
      let sum = 0;
      let weightSum = 0;
      
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - offset;
          const py = y + ky - offset;
          const weight = kernel[ky] * kernel[kx];
          sum += data[py * width + px] * weight;
          weightSum += weight;
        }
      }
      
      result[y * width + x] = Math.round(sum / weightSum);
    }
  }
  
  return result;
}

function generateGaussianKernel(sigma: number): number[] {
  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel = new Array(size);
  const center = Math.floor(size / 2);
  let sum = 0;
  
  for (let i = 0; i < size; i++) {
    const x = i - center;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  
  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }
  
  return kernel;
}

function applySobelEdgeDetection(data: Uint8Array, width: number, height: number, threshold: number): Uint8Array {
  const result = new Uint8Array(width * height);
  
  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const px = x + kx - 1;
          const py = y + ky - 1;
          const pixel = data[py * width + px];
          const ki = ky * 3 + kx;
          
          gx += pixel * sobelX[ki];
          gy += pixel * sobelY[ki];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      result[y * width + x] = magnitude > threshold ? 255 : 0;
    }
  }
  
  return result;
}

function applyMorphology(data: Uint8Array, width: number, height: number): Uint8Array {
  // Simple closing operation (dilation followed by erosion)
  let result = dilate(data, width, height, 2);
  result = erode(result, width, height, 2);
  return result;
}

function dilate(data: Uint8Array, width: number, height: number, size: number): Uint8Array {
  const result = new Uint8Array(width * height);
  
  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      let maxVal = 0;
      
      for (let ky = -size; ky <= size; ky++) {
        for (let kx = -size; kx <= size; kx++) {
          const px = x + kx;
          const py = y + ky;
          maxVal = Math.max(maxVal, data[py * width + px]);
        }
      }
      
      result[y * width + x] = maxVal;
    }
  }
  
  return result;
}

function erode(data: Uint8Array, width: number, height: number, size: number): Uint8Array {
  const result = new Uint8Array(width * height);
  
  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      let minVal = 255;
      
      for (let ky = -size; ky <= size; ky++) {
        for (let kx = -size; kx <= size; kx++) {
          const px = x + kx;
          const py = y + ky;
          minVal = Math.min(minVal, data[py * width + px]);
        }
      }
      
      result[y * width + x] = minVal;
    }
  }
  
  return result;
}

function findConnectedComponents(data: Uint8Array, width: number, height: number, minArea: number): any[] {
  const visited = new Array(width * height).fill(false);
  const components: any[] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      if (data[idx] > 0 && !visited[idx]) {
        const component = floodFill(data, visited, width, height, x, y);
        
        if (component.area >= minArea) {
          components.push(component);
        }
      }
    }
  }
  
  return components;
}

function floodFill(data: Uint8Array, visited: boolean[], width: number, height: number, startX: number, startY: number): any {
  const stack = [{ x: startX, y: startY }];
  visited[startY * width + startX] = true;
  
  let minX = startX, maxX = startX;
  let minY = startY, maxY = startY;
  let area = 0;
  
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    area++;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    // Check 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const nIdx = ny * width + nx;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
            !visited[nIdx] && data[nIdx] > 0) {
          visited[nIdx] = true;
          stack.push({ x: nx, y: ny });
        }
      }
    }
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    area: area
  };
}

function applyAdvancedFiltering(rects: BoundingRect[]): BoundingRect[] {
  // Remove overlapping rectangles, keeping the one with highest confidence
  const filtered: BoundingRect[] = [];
  
  for (const rect of rects) {
    let shouldAdd = true;
    
    for (let i = filtered.length - 1; i >= 0; i--) {
      const existing = filtered[i];
      const overlap = calculateOverlap(rect, existing);
      
      if (overlap > 0.3) { // 30% overlap threshold
        if ((rect.confidence || 0) > (existing.confidence || 0)) {
          filtered.splice(i, 1); // Remove existing, add new
        } else {
          shouldAdd = false; // Skip this rect
          break;
        }
      }
    }
    
    if (shouldAdd) {
      filtered.push(rect);
    }
  }
  
  // Sort by confidence and return top candidates
  return filtered
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 3); // Maximum 3 objects
}

function calculateOverlap(rect1: BoundingRect, rect2: BoundingRect): number {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
  
  if (x2 <= x1 || y2 <= y1) return 0;
  
  const intersectionArea = (x2 - x1) * (y2 - y1);
  const unionArea = rect1.area + rect2.area - intersectionArea;
  
  return intersectionArea / unionArea;
}
