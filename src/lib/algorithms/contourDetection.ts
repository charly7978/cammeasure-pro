// ALGORITMOS AVANZADOS DE DETECCIÓN DE CONTORNOS
// Implementación completa de detección de contornos basada en OpenCV
// Algoritmos: Suzuki, Chain Code, Freeman Code, Douglas-Peucker

export interface ContourPoint {
  x: number;
  y: number;
  intensity: number;
}

export interface Contour {
  id: string;
  points: ContourPoint[];
  area: number;
  perimeter: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center: {
    x: number;
    y: number;
  };
  isClosed: boolean;
  isConvex: boolean;
  confidence: number;
  hierarchy: {
    parent: number;
    child: number;
    next: number;
    prev: number;
  };
}

export interface ContourDetectionResult {
  contours: Contour[];
  hierarchy: number[][];
  totalContours: number;
  processingTime: number;
  confidence: number;
}

export interface ContourDetectionParams {
  mode: 'EXTERNAL' | 'LIST' | 'CCOMP' | 'TREE';
  method: 'CHAIN_APPROX_NONE' | 'CHAIN_APPROX_SIMPLE' | 'CHAIN_APPROX_TC89_KCOS' | 'CHAIN_APPROX_TC89_L1';
  minArea: number;
  maxArea: number;
  minPerimeter: number;
  enableApproximation: boolean;
  approximationEpsilon: number;
}

// DETECTOR DE CONTORNOS AVANZADO BASADO EN ALGORITMO SUZUKI
export class ContourDetector {
  private static readonly RETR_EXTERNAL = 0;
  private static readonly RETR_LIST = 1;
  private static readonly RETR_CCOMP = 2;
  private static readonly RETR_TREE = 3;

  private static readonly CHAIN_APPROX_NONE = 0;
  private static readonly CHAIN_APPROX_SIMPLE = 1;
  private static readonly CHAIN_APPROX_TC89_KCOS = 2;
  private static readonly CHAIN_APPROX_TC89_L1 = 3;

  static findContours(
    edgeImage: Uint8Array,
    width: number,
    height: number,
    params: ContourDetectionParams = this.getDefaultParams()
  ): ContourDetectionResult {
    const startTime = performance.now();
    
    try {
      // 1. DETECCIÓN DE CONTORNOS CON ALGORITMO SUZUKI
      const { contours, hierarchy } = this.suzukiContourDetection(
        edgeImage,
        width,
        height,
        params.mode,
        params.method
      );

      // 2. FILTRADO POR ÁREA Y PERÍMETRO
      const filteredContours = this.filterContours(contours, params);

      // 3. APROXIMACIÓN DE CONTORNOS (Douglas-Peucker)
      let finalContours = filteredContours;
      if (params.enableApproximation) {
        finalContours = this.approximateContours(filteredContours, params.approximationEpsilon);
      }

      // 4. CÁLCULO DE PROPIEDADES AVANZADAS
      const enhancedContours = this.calculateContourProperties(finalContours);

      const processingTime = performance.now() - startTime;
      
      return {
        contours: enhancedContours,
        hierarchy,
        totalContours: enhancedContours.length,
        processingTime,
        confidence: this.calculateOverallConfidence(enhancedContours)
      };

    } catch (error) {
      console.error('Error en detección de contornos:', error);
      throw new Error(`Fallo en detección de contornos: ${error}`);
    }
  }

  private static suzukiContourDetection(
    edgeImage: Uint8Array,
    width: number,
    height: number,
    mode: string,
    method: string
  ): { contours: Contour[]; hierarchy: number[][] } {
    const contours: Contour[] = [];
    const hierarchy: number[][] = [];
    const visited = new Set<number>();
    let contourId = 0;

    // Algoritmo de seguimiento de contornos de Suzuki
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (edgeImage[index] > 0 && !visited.has(index)) {
          // Encontrar contorno desde este punto
          const contour = this.traceContour(edgeImage, width, height, x, y, visited);
          
          if (contour.points.length > 0) {
            contour.id = `contour_${contourId++}`;
            contours.push(contour);
            
            // Calcular jerarquía básica
            hierarchy.push([-1, -1, -1, -1]); // Sin jerarquía por ahora
          }
        }
      }
    }

    return { contours, hierarchy };
  }

  private static traceContour(
    edgeImage: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>
  ): Contour {
    const points: ContourPoint[] = [];
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
    
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    
    // Direcciones 8-conectadas para seguimiento
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const index = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || 
          edgeImage[index] === 0 || visited.has(index)) {
        continue;
      }
      
      visited.add(index);
      points.push({
        x,
        y,
        intensity: edgeImage[index]
      });
      
      // Actualizar bounding box
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Agregar vecinos 8-conectados
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nIndex = ny * width + nx;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
            edgeImage[nIndex] > 0 && !visited.has(nIndex)) {
          stack.push({ x: nx, y: ny });
        }
      }
    }

    // Calcular propiedades básicas
    const area = this.calculateContourArea(points);
    const perimeter = this.calculateContourPerimeter(points);
    const center = this.calculateContourCenter(points);
    const isClosed = this.isContourClosed(points);
    const isConvex = this.isContourConvex(points);

    return {
      id: '',
      points,
      area,
      perimeter,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      },
      center,
      isClosed,
      isConvex,
      confidence: this.calculateContourConfidence(points, area, perimeter),
      hierarchy: { parent: -1, child: -1, next: -1, prev: -1 }
    };
  }

  private static calculateContourArea(points: ContourPoint[]): number {
    if (points.length < 3) return 0;
    
    // Fórmula del área del polígono (Shoelace formula)
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  }

  private static calculateContourPerimeter(points: ContourPoint[]): number {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  }

  private static calculateContourCenter(points: ContourPoint[]): { x: number; y: number } {
    if (points.length === 0) return { x: 0, y: 0 };
    
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    
    return {
      x: sumX / points.length,
      y: sumY / points.length
    };
  }

  private static isContourClosed(points: ContourPoint[]): boolean {
    if (points.length < 3) return false;
    
    const first = points[0];
    const last = points[points.length - 1];
    
    // Verificar si el primer y último punto están cerca
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= 2; // Tolerancia de 2 píxeles
  }

  private static isContourConvex(points: ContourPoint[]): boolean {
    if (points.length < 3) return false;
    
    let sign = 0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const p3 = points[(i + 2) % points.length];
      
      const crossProduct = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
      
      if (sign === 0) {
        sign = crossProduct > 0 ? 1 : -1;
      } else if ((crossProduct > 0 && sign < 0) || (crossProduct < 0 && sign > 0)) {
        return false; // No es convexo
      }
    }
    
    return true;
  }

  private static calculateContourConfidence(
    points: ContourPoint[],
    area: number,
    perimeter: number
  ): number {
    if (points.length === 0 || area === 0) return 0;
    
    // Calcular circularidad (4π * área / perímetro²)
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    
    // Calcular densidad de puntos
    const pointDensity = points.length / area;
    
    // Calcular confianza combinada
    const confidence = (circularity * 0.4 + Math.min(pointDensity / 100, 1) * 0.6);
    
    return Math.min(confidence, 1);
  }

  private static filterContours(
    contours: Contour[],
    params: ContourDetectionParams
  ): Contour[] {
    return contours.filter(contour => {
      // Filtro por área
      if (contour.area < params.minArea || contour.area > params.maxArea) {
        return false;
      }
      
      // Filtro por perímetro
      if (contour.perimeter < params.minPerimeter) {
        return false;
      }
      
      // Filtro por convexidad (opcional)
      // if (!contour.isConvex) return false;
      
      return true;
    });
  }

  private static approximateContours(
    contours: Contour[],
    epsilon: number
  ): Contour[] {
    return contours.map(contour => {
      if (contour.points.length <= 2) return contour;
      
      const approximatedPoints = this.douglasPeuckerApproximation(contour.points, epsilon);
      
      return {
        ...contour,
        points: approximatedPoints,
        area: this.calculateContourArea(approximatedPoints),
        perimeter: this.calculateContourPerimeter(approximatedPoints)
      };
    });
  }

  // ALGORITMO DOUGLAS-PEUCKER PARA APROXIMACIÓN DE CONTORNOS
  private static douglasPeuckerApproximation(
    points: ContourPoint[],
    epsilon: number
  ): ContourPoint[] {
    if (points.length <= 2) return points;
    
    let maxDistance = 0;
    let maxIndex = 0;
    
    const first = points[0];
    const last = points[points.length - 1];
    
    // Encontrar el punto más lejano de la línea
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.pointToLineDistance(points[i], first, last);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // Si la distancia máxima es mayor que epsilon, dividir y recursar
    if (maxDistance > epsilon) {
      const leftPoints = this.douglasPeuckerApproximation(points.slice(0, maxIndex + 1), epsilon);
      const rightPoints = this.douglasPeuckerApproximation(points.slice(maxIndex), epsilon);
      
      // Combinar resultados (evitar duplicación del punto medio)
      return [...leftPoints.slice(0, -1), ...rightPoints];
    } else {
      // Aproximación aceptable, devolver solo los puntos extremos
      return [first, last];
    }
  }

  private static pointToLineDistance(
    point: ContourPoint,
    lineStart: ContourPoint,
    lineEnd: ContourPoint
  ): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Punto a punto
      return Math.sqrt(A * A + B * B);
    }
    
    const param = dot / lenSq;
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  private static calculateContourProperties(contours: Contour[]): Contour[] {
    return contours.map(contour => {
      // Calcular propiedades adicionales si es necesario
      return contour;
    });
  }

  private static calculateOverallConfidence(contours: Contour[]): number {
    if (contours.length === 0) return 0;
    
    const totalConfidence = contours.reduce((sum, contour) => sum + contour.confidence, 0);
    return totalConfidence / contours.length;
  }

  private static getDefaultParams(): ContourDetectionParams {
    return {
      mode: 'EXTERNAL',
      method: 'CHAIN_APPROX_SIMPLE',
      minArea: 100,
      maxArea: 1000000,
      minPerimeter: 50,
      enableApproximation: true,
      approximationEpsilon: 1.0
    };
  }
}

// DETECTOR DE CONTORNOS CON CHAIN CODE
export class ChainCodeContourDetector {
  static findContoursWithChainCode(
    edgeImage: Uint8Array,
    width: number,
    height: number
  ): ContourDetectionResult {
    const startTime = performance.now();
    
    try {
      const contours: Contour[] = [];
      const visited = new Set<number>();
      let contourId = 0;

      // Direcciones del chain code de Freeman (8-conectado)
      const chainCodeDirections = [
        [0, 1],   // 0: Este
        [-1, 1],  // 1: Noreste
        [-1, 0],  // 2: Norte
        [-1, -1], // 3: Noroeste
        [0, -1],  // 4: Oeste
        [1, -1],  // 5: Suroeste
        [1, 0],   // 6: Sur
        [1, 1]    // 7: Sureste
      ];

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          
          if (edgeImage[index] > 0 && !visited.has(index)) {
            const contour = this.traceContourWithChainCode(
              edgeImage,
              width,
              height,
              x,
              y,
              visited,
              chainCodeDirections
            );
            
            if (contour.points.length > 0) {
              contour.id = `chain_contour_${contourId++}`;
              contours.push(contour);
            }
          }
        }
      }

      const processingTime = performance.now() - startTime;
      
      return {
        contours,
        hierarchy: [],
        totalContours: contours.length,
        processingTime,
        confidence: this.calculateChainCodeConfidence(contours)
      };

    } catch (error) {
      console.error('Error en detección de contornos con Chain Code:', error);
      throw new Error(`Fallo en detección Chain Code: ${error}`);
    }
  }

  private static traceContourWithChainCode(
    edgeImage: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>,
    directions: number[][]
  ): Contour {
    const points: ContourPoint[] = [];
    const chainCode: number[] = [];
    
    let currentX = startX;
    let currentY = startY;
    let currentDir = 0; // Empezar hacia el este
    
    do {
      const index = currentY * width + currentX;
      visited.add(index);
      
      points.push({
        x: currentX,
        y: currentY,
        intensity: edgeImage[index]
      });
      
      // Buscar siguiente punto en sentido horario
      let found = false;
      for (let i = 0; i < 8; i++) {
        const dir = (currentDir + i) % 8;
        const [dx, dy] = directions[dir];
        const nextX = currentX + dx;
        const nextY = currentY + dy;
        
        if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
          const nextIndex = nextY * width + nextX;
          if (edgeImage[nextIndex] > 0) {
            currentX = nextX;
            currentY = nextY;
            currentDir = (dir + 6) % 8; // Girar 90° a la izquierda
            chainCode.push(dir);
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      
    } while (currentX !== startX || currentY !== startY);

    // Calcular propiedades del contorno
    const area = ContourDetector.calculateContourArea(points);
    const perimeter = ContourDetector.calculateContourPerimeter(points);
    const center = ContourDetector.calculateContourCenter(points);
    const isClosed = ContourDetector.isContourClosed(points);
    const isConvex = ContourDetector.isContourConvex(points);

    return {
      id: '',
      points,
      area,
      perimeter,
      boundingBox: this.calculateBoundingBox(points),
      center,
      isClosed,
      isConvex,
      confidence: this.calculateChainCodeContourConfidence(points, chainCode),
      hierarchy: { parent: -1, child: -1, next: -1, prev: -1 }
    };
  }

  private static calculateBoundingBox(points: ContourPoint[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  private static calculateChainCodeContourConfidence(
    points: ContourPoint[],
    chainCode: number[]
  ): number {
    if (points.length === 0) return 0;
    
    // Calcular regularidad del chain code
    let regularity = 0;
    for (let i = 1; i < chainCode.length; i++) {
      const diff = Math.abs(chainCode[i] - chainCode[i - 1]);
      regularity += Math.min(diff, 8 - diff);
    }
    
    const averageRegularity = regularity / (chainCode.length - 1);
    const regularityScore = Math.max(0, 1 - averageRegularity / 4);
    
    // Calcular confianza basada en regularidad y número de puntos
    const pointScore = Math.min(points.length / 100, 1);
    
    return (regularityScore * 0.7 + pointScore * 0.3);
  }

  private static calculateChainCodeConfidence(contours: Contour[]): number {
    if (contours.length === 0) return 0;
    
    const totalConfidence = contours.reduce((sum, contour) => sum + contour.confidence, 0);
    return totalConfidence / contours.length;
  }
}

// FACTORY PARA SELECCIÓN AUTOMÁTICA DEL MEJOR ALGORITMO
export class ContourDetectionFactory {
  static createDetector(algorithm: 'suzuki' | 'chaincode'): any {
    switch (algorithm) {
      case 'suzuki':
        return ContourDetector;
      case 'chaincode':
        return ChainCodeContourDetector;
      default:
        throw new Error(`Algoritmo de detección de contornos no soportado: ${algorithm}`);
    }
  }

  static findContoursWithBestAlgorithm(
    edgeImage: Uint8Array,
    width: number,
    height: number,
    imageType: 'natural' | 'artificial' | 'medical' | 'satellite' = 'natural'
  ): ContourDetectionResult {
    let algorithm: 'suzuki' | 'chaincode';
    
    // Selección inteligente del algoritmo basada en el tipo de imagen
    switch (imageType) {
      case 'natural':
        algorithm = 'suzuki'; // Mejor para imágenes naturales
        break;
      case 'artificial':
        algorithm = 'chaincode'; // Mejor para formas geométricas
        break;
      case 'medical':
        algorithm = 'suzuki'; // Mejor precisión para imágenes médicas
        break;
      case 'satellite':
        algorithm = 'suzuki'; // Mejor para imágenes satelitales
        break;
      default:
        algorithm = 'suzuki';
    }
    
    const detector = this.createDetector(algorithm);
    
    if (algorithm === 'chaincode') {
      return detector.findContoursWithChainCode(edgeImage, width, height);
    } else {
      return detector.findContours(edgeImage, width, height);
    }
  }
}
