// SISTEMA OPENCV AVANZADO - MEDICIÓN REAL FUNCIONAL
// Implementación completa de algoritmos OpenCV para medición precisa

export interface AdvancedOpenCVResult {
  contours: Array<Array<{x: number, y: number}>>;
  boundingBoxes: Array<{x: number, y: number, width: number, height: number}>;
  areas: number[];
  perimeters: number[];
  confidences: number[];
  circularity: number[];
  moments: Array<{m00: number, m10: number, m01: number}>;
  centralizedObject: {
    contour: Array<{x: number, y: number}>;
    boundingBox: {x: number, y: number, width: number, height: number};
    area: number;
    perimeter: number;
    confidence: number;
    circularity: number;
    moments: {m00: number, m10: number, m01: number};
    centroid: {x: number, y: number};
  } | null;
}

export class AdvancedOpenCVSystem {
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    try {
      console.log('🔍 INICIALIZANDO SISTEMA OPENCV AVANZADO...');
      this.isInitialized = true;
      console.log('✅ SISTEMA OPENCV AVANZADO LISTO');
      return true;
    } catch (error) {
      console.error('❌ Error inicializando OpenCV avanzado:', error);
      return false;
    }
  }

  // CONVERSIÓN A ESCALA DE GRISES CON ALGORITMO OPTIMIZADO
  private rgbaToGray(imageData: ImageData): Uint8Array {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Uint8Array(width * height);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Fórmula luminancia optimizada: 0.299*R + 0.587*G + 0.114*B
      gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    return gray;
  }

  // FILTRO GAUSSIANO REAL - REDUCCIÓN DE RUIDO
  private gaussianBlur(gray: Uint8Array, width: number, height: number, sigma: number = 2): Uint8Array {
    const kernelSize = Math.max(3, Math.ceil(sigma * 6) | 1);
    const kernel = this.createGaussianKernel(kernelSize, sigma);
    const result = new Uint8Array(width * height);
    
    const half = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const pixelY = Math.max(0, Math.min(height - 1, y + ky));
            const pixelX = Math.max(0, Math.min(width - 1, x + kx));
            const weight = kernel[ky + half][kx + half];
            
            sum += gray[pixelY * width + pixelX] * weight;
            weightSum += weight;
          }
        }
        
        result[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    return result;
  }

  // GENERACIÓN DE KERNEL GAUSSIANO
  private createGaussianKernel(size: number, sigma: number): number[][] {
    const kernel: number[][] = [];
    const half = Math.floor(size / 2);
    const variance = sigma * sigma;
    let sum = 0;
    
    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - half;
        const dy = y - half;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * variance));
        kernel[y][x] = value;
        sum += value;
      }
    }
    
    // Normalizar kernel
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum;
      }
    }
    
    return kernel;
  }

  // DETECCIÓN DE BORDES CANNY REAL
  private cannyEdgeDetection(gray: Uint8Array, width: number, height: number, lowThreshold: number = 50, highThreshold: number = 150): Uint8Array {
    // 1. Calcular gradientes
    const gradientMagnitude = new Float32Array(width * height);
    const gradientDirection = new Float32Array(width * height);
    
    // Operadores Sobel
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = gray[(y + ky) * width + (x + kx)];
            gx += pixel * sobelX[ky + 1][kx + 1];
            gy += pixel * sobelY[ky + 1][kx + 1];
          }
        }
        
        const idx = y * width + x;
        gradientMagnitude[idx] = Math.sqrt(gx * gx + gy * gy);
        gradientDirection[idx] = Math.atan2(gy, gx);
      }
    }
    
    // 2. Supresión no máxima
    const suppressed = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const magnitude = gradientMagnitude[idx];
        const direction = gradientDirection[idx];
        
        // Obtener pixeles vecinos en dirección del gradiente
        let neighbor1 = 0, neighbor2 = 0;
        const angle = (direction * 180 / Math.PI + 180) % 180;
        
        if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
          neighbor1 = gradientMagnitude[y * width + (x - 1)];
          neighbor2 = gradientMagnitude[y * width + (x + 1)];
        } else if (angle >= 22.5 && angle < 67.5) {
          neighbor1 = gradientMagnitude[(y - 1) * width + (x + 1)];
          neighbor2 = gradientMagnitude[(y + 1) * width + (x - 1)];
        } else if (angle >= 67.5 && angle < 112.5) {
          neighbor1 = gradientMagnitude[(y - 1) * width + x];
          neighbor2 = gradientMagnitude[(y + 1) * width + x];
        } else {
          neighbor1 = gradientMagnitude[(y - 1) * width + (x - 1)];
          neighbor2 = gradientMagnitude[(y + 1) * width + (x + 1)];
        }
        
        if (magnitude >= neighbor1 && magnitude >= neighbor2) {
          suppressed[idx] = Math.min(255, magnitude);
        }
      }
    }
    
    // 3. Umbralización por histéresis
    const edges = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    
    // Marcar bordes fuertes
    for (let i = 0; i < suppressed.length; i++) {
      if (suppressed[i] >= highThreshold) {
        edges[i] = 255;
      }
    }
    
    // Seguir bordes débiles conectados a bordes fuertes
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edges[idx] === 255 && !visited[idx]) {
          this.traceEdge(suppressed, edges, visited, x, y, width, height, lowThreshold);
        }
      }
    }
    
    return edges;
  }

  // SEGUIMIENTO DE BORDES
  private traceEdge(suppressed: Uint8Array, edges: Uint8Array, visited: Uint8Array, x: number, y: number, width: number, height: number, lowThreshold: number): void {
    const stack: Array<{x: number, y: number}> = [{x, y}];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      const idx = current.y * width + current.x;
      
      if (visited[idx]) continue;
      visited[idx] = 1;
      
      // Revisar vecinos 8-conectados
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = current.x + dx;
          const ny = current.y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx] && suppressed[nIdx] >= lowThreshold) {
              edges[nIdx] = 255;
              stack.push({x: nx, y: ny});
            }
          }
        }
      }
    }
  }

  // ENCONTRAR CONTORNOS AVANZADO
  private findContours(edges: Uint8Array, width: number, height: number): Array<Array<{x: number, y: number}>> {
    const contours: Array<Array<{x: number, y: number}>> = [];
    const visited = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (edges[idx] === 255 && !visited[idx]) {
          const contour = this.traceContour(edges, visited, x, y, width, height);
          if (contour.length > 10) { // Filtrar contornos muy pequeños
            contours.push(contour);
          }
        }
      }
    }
    
    return contours;
  }

  // SEGUIMIENTO DE CONTORNOS
  private traceContour(edges: Uint8Array, visited: Uint8Array, startX: number, startY: number, width: number, height: number): Array<{x: number, y: number}> {
    const contour: Array<{x: number, y: number}> = [];
    const directions = [
      {dx: 1, dy: 0}, {dx: 1, dy: 1}, {dx: 0, dy: 1}, {dx: -1, dy: 1},
      {dx: -1, dy: 0}, {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1}
    ];
    
    let x = startX, y = startY;
    let direction = 0;
    
    do {
      contour.push({x, y});
      visited[y * width + x] = 1;
      
      // Buscar siguiente punto del contorno
      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (direction + i) % 8;
        const nx = x + directions[newDir].dx;
        const ny = y + directions[newDir].dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          if (edges[idx] === 255 && !visited[idx]) {
            x = nx;
            y = ny;
            direction = (newDir + 6) % 8; // Actualizar dirección de búsqueda
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      
    } while (!(x === startX && y === startY) && contour.length < 10000);
    
    return contour;
  }

  // CALCULAR ÁREA DE CONTORNO
  private calculateContourArea(contour: Array<{x: number, y: number}>): number {
    if (contour.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      area += contour[i].x * contour[j].y;
      area -= contour[j].x * contour[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  // CALCULAR PERÍMETRO DE CONTORNO
  private calculateContourPerimeter(contour: Array<{x: number, y: number}>): number {
    if (contour.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      const dx = contour[j].x - contour[i].x;
      const dy = contour[j].y - contour[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  }

  // CALCULAR BOUNDING BOX
  private calculateBoundingBox(contour: Array<{x: number, y: number}>): {x: number, y: number, width: number, height: number} {
    if (contour.length === 0) return {x: 0, y: 0, width: 0, height: 0};
    
    let minX = contour[0].x, maxX = contour[0].x;
    let minY = contour[0].y, maxY = contour[0].y;
    
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  // CALCULAR CIRCULARIDAD
  private calculateCircularity(area: number, perimeter: number): number {
    if (perimeter === 0) return 0;
    return (4 * Math.PI * area) / (perimeter * perimeter);
  }

  // CALCULAR MOMENTOS
  private calculateMoments(contour: Array<{x: number, y: number}>): {m00: number, m10: number, m01: number} {
    let m00 = 0, m10 = 0, m01 = 0;
    
    for (const point of contour) {
      m00 += 1;
      m10 += point.x;
      m01 += point.y;
    }
    
    return {m00, m10, m01};
  }

  // ENCONTRAR OBJETO MÁS CENTRAL Y GRANDE
  private findCentralizedObject(result: AdvancedOpenCVResult, imageWidth: number, imageHeight: number): AdvancedOpenCVResult['centralizedObject'] {
    if (result.contours.length === 0) return null;
    
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    
    let bestScore = -1;
    let bestIndex = -1;
    
    for (let i = 0; i < result.contours.length; i++) {
      const bbox = result.boundingBoxes[i];
      const area = result.areas[i];
      
      // Calcular distancia al centro
      const objCenterX = bbox.x + bbox.width / 2;
      const objCenterY = bbox.y + bbox.height / 2;
      const distanceToCenter = Math.sqrt((objCenterX - centerX) ** 2 + (objCenterY - centerY) ** 2);
      
      // Normalizar distancia (0-1)
      const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
      const normalizedDistance = distanceToCenter / maxDistance;
      
      // Normalizar área (0-1)
      const maxArea = imageWidth * imageHeight;
      const normalizedArea = area / maxArea;
      
      // Score: 70% área + 30% proximidad al centro
      const score = normalizedArea * 0.7 + (1 - normalizedDistance) * 0.3;
      
      if (score > bestScore && area > 100) { // Filtrar objetos muy pequeños
        bestScore = score;
        bestIndex = i;
      }
    }
    
    if (bestIndex === -1) return null;
    
    const moments = result.moments[bestIndex];
    const centroid = {
      x: moments.m00 > 0 ? moments.m10 / moments.m00 : 0,
      y: moments.m00 > 0 ? moments.m01 / moments.m00 : 0
    };
    
    return {
      contour: result.contours[bestIndex],
      boundingBox: result.boundingBoxes[bestIndex],
      area: result.areas[bestIndex],
      perimeter: result.perimeters[bestIndex],
      confidence: result.confidences[bestIndex],
      circularity: result.circularity[bestIndex],
      moments: result.moments[bestIndex],
      centroid
    };
  }

  // PROCESAMIENTO PRINCIPAL
  async processImage(imageData: ImageData): Promise<AdvancedOpenCVResult> {
    if (!this.isInitialized) {
      throw new Error('Sistema OpenCV no inicializado');
    }

    console.log('🔍 PROCESANDO IMAGEN CON OPENCV AVANZADO...');
    const startTime = Date.now();

    try {
      const width = imageData.width;
      const height = imageData.height;

      // 1. Conversión a escala de grises
      const gray = this.rgbaToGray(imageData);
      
      // 2. Filtro Gaussiano para reducir ruido
      const blurred = this.gaussianBlur(gray, width, height, 2);
      
      // 3. Detección de bordes Canny
      const edges = this.cannyEdgeDetection(blurred, width, height, 50, 150);
      
      // 4. Encontrar contornos
      const contours = this.findContours(edges, width, height);
      
      // 5. Calcular propiedades de cada contorno
      const boundingBoxes: Array<{x: number, y: number, width: number, height: number}> = [];
      const areas: number[] = [];
      const perimeters: number[] = [];
      const confidences: number[] = [];
      const circularity: number[] = [];
      const moments: Array<{m00: number, m10: number, m01: number}> = [];

      for (const contour of contours) {
        const area = this.calculateContourArea(contour);
        const perimeter = this.calculateContourPerimeter(contour);
        const bbox = this.calculateBoundingBox(contour);
        const circ = this.calculateCircularity(area, perimeter);
        const mom = this.calculateMoments(contour);
        
        // Calcular confianza basada en área y circularidad
        const confidence = Math.min(1.0, Math.max(0.1, 
          (area / 1000) * 0.7 + circ * 0.3
        ));

        boundingBoxes.push(bbox);
        areas.push(area);
        perimeters.push(perimeter);
        confidences.push(confidence);
        circularity.push(circ);
        moments.push(mom);
      }

      const result: AdvancedOpenCVResult = {
        contours,
        boundingBoxes,
        areas,
        perimeters,
        confidences,
        circularity,
        moments,
        centralizedObject: null
      };

      // 6. Encontrar objeto centralizado
      result.centralizedObject = this.findCentralizedObject(result, width, height);

      const processingTime = Date.now() - startTime;
      console.log(`✅ PROCESAMIENTO OPENCV COMPLETADO en ${processingTime}ms:`, {
        contornos: contours.length,
        objetoCentral: result.centralizedObject ? 'Detectado' : 'No detectado',
        areaCentral: result.centralizedObject?.area || 0
      });

      return result;

    } catch (error) {
      console.error('❌ Error en procesamiento OpenCV:', error);
      throw error;
    }
  }
}

// Instancia singleton del sistema
export const advancedOpenCVSystem = new AdvancedOpenCVSystem();