export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CameraParameters {
  focalLength: number;
  sensorWidth: number;
  sensorHeight: number;
  imageWidth: number;
  imageHeight: number;
  distortionCoefficients?: number[];
}

export interface Object3D {
  id: string;
  vertices: Point3D[];
  faces: number[][];
  boundingBox: {
    min: Point3D;
    max: Point3D;
  };
  volume: number;
  surfaceArea: number;
  centroid: Point3D;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  confidence: number;
}

export interface DepthMap {
  width: number;
  height: number;
  data: Float32Array; // Valores de profundidad en mm
  confidence: Float32Array; // Confianza de cada píxel (0-1)
}

export interface StereoCalibration {
  leftCamera: CameraParameters;
  rightCamera: CameraParameters;
  rotationMatrix: number[][];
  translationVector: number[];
  essentialMatrix: number[][];
  fundamentalMatrix: number[][];
}

export class Advanced3DMeasurementSystem {
  private cameraParams: CameraParameters;
  private depthEstimationMethod: 'monocular' | 'stereo' | 'structured-light' = 'monocular';

  constructor(cameraParams: CameraParameters) {
    this.cameraParams = cameraParams;
  }

  // Estimación de profundidad monocular usando múltiples técnicas
  estimateDepthMonocular(
    imageData: ImageData,
    detectedObjects: any[]
  ): DepthMap {
    const width = imageData.width;
    const height = imageData.height;
    const depthData = new Float32Array(width * height);
    const confidenceData = new Float32Array(width * height);

    // Combinar múltiples métodos de estimación de profundidad
    const methods = [
      this.depthFromDefocus.bind(this),
      this.depthFromPerspective.bind(this),
      this.depthFromShadows.bind(this),
      this.depthFromTexture.bind(this)
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const estimates: { depth: number; confidence: number }[] = [];

        // Aplicar cada método
        for (const method of methods) {
          try {
            const estimate = method(imageData, x, y, detectedObjects);
            if (estimate.depth > 0 && estimate.confidence > 0.1) {
              estimates.push(estimate);
            }
          } catch (error) {
            // Continuar con otros métodos si uno falla
          }
        }

        if (estimates.length > 0) {
          // Combinar estimaciones usando promedio ponderado
          const totalWeight = estimates.reduce((sum, est) => sum + est.confidence, 0);
          const weightedDepth = estimates.reduce(
            (sum, est) => sum + (est.depth * est.confidence / totalWeight), 
            0
          );
          const avgConfidence = totalWeight / estimates.length;

          depthData[idx] = weightedDepth;
          confidenceData[idx] = Math.min(avgConfidence, 1.0);
        } else {
          // Usar estimación por defecto basada en posición
          depthData[idx] = this.defaultDepthEstimate(x, y, width, height);
          confidenceData[idx] = 0.3;
        }
      }
    }

    // Aplicar suavizado espacial
    this.smoothDepthMap(depthData, confidenceData, width, height);

    return {
      width,
      height,
      data: depthData,
      confidence: confidenceData
    };
  }

  // Estimación de profundidad por desenfoque
  private depthFromDefocus(
    imageData: ImageData,
    x: number,
    y: number,
    objects: any[]
  ): { depth: number; confidence: number } {
    const kernelSize = 5;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Calcular gradiente local para detectar desenfoque
    let gradientSum = 0;
    let pixelCount = 0;

    for (let dy = -halfKernel; dy <= halfKernel; dy++) {
      for (let dx = -halfKernel; dx <= halfKernel; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < imageData.width && ny >= 0 && ny < imageData.height) {
          const idx = (ny * imageData.width + nx) * 4;
          const gray = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
          
          // Calcular gradiente usando Sobel
          if (nx > 0 && nx < imageData.width - 1) {
            const leftIdx = (ny * imageData.width + (nx - 1)) * 4;
            const rightIdx = (ny * imageData.width + (nx + 1)) * 4;
            const leftGray = (imageData.data[leftIdx] + imageData.data[leftIdx + 1] + imageData.data[leftIdx + 2]) / 3;
            const rightGray = (imageData.data[rightIdx] + imageData.data[rightIdx + 1] + imageData.data[rightIdx + 2]) / 3;
            
            gradientSum += Math.abs(rightGray - leftGray);
            pixelCount++;
          }
        }
      }
    }

    const avgGradient = pixelCount > 0 ? gradientSum / pixelCount : 0;
    
    // Convertir gradiente a estimación de profundidad
    // Menor gradiente = más desenfoque = mayor distancia
    const maxGradient = 50; // Valor empírico
    const normalizedGradient = Math.min(avgGradient / maxGradient, 1.0);
    const depth = 100 + (1 - normalizedGradient) * 400; // 100-500mm
    const confidence = normalizedGradient > 0.1 ? 0.6 : 0.2;

    return { depth, confidence };
  }

  // Estimación de profundidad por perspectiva
  private depthFromPerspective(
    imageData: ImageData,
    x: number,
    y: number,
    objects: any[]
  ): { depth: number; confidence: number } {
    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;
    
    // Distancia del punto al centro de la imagen
    const distanceFromCenter = Math.sqrt(
      Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
    );
    const maxDistance = Math.sqrt(
      Math.pow(centerX, 2) + Math.pow(centerY, 2)
    );
    const normalizedDistance = distanceFromCenter / maxDistance;

    // Buscar si el punto está dentro de un objeto detectado
    let objectSize = 0;
    let isInObject = false;
    
    for (const obj of objects) {
      if (x >= obj.x && x <= obj.x + obj.width &&
          y >= obj.y && y <= obj.y + obj.height) {
        objectSize = Math.sqrt(obj.width * obj.height);
        isInObject = true;
        break;
      }
    }

    if (isInObject && objectSize > 0) {
      // Usar tamaño del objeto para estimar distancia
      // Objetos más grandes están más cerca
      const avgObjectSize = 100; // Tamaño promedio esperado en píxeles
      const sizeRatio = avgObjectSize / objectSize;
      const depth = 200 * Math.pow(sizeRatio, 0.8); // Relación no lineal
      const confidence = 0.7;
      
      return { depth: Math.max(50, Math.min(1000, depth)), confidence };
    } else {
      // Usar perspectiva general
      const depth = 300 + normalizedDistance * 200; // 300-500mm
      const confidence = 0.4;
      
      return { depth, confidence };
    }
  }

  // Estimación de profundidad por sombras
  private depthFromShadows(
    imageData: ImageData,
    x: number,
    y: number,
    objects: any[]
  ): { depth: number; confidence: number } {
    const kernelSize = 7;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Analizar variación de luminosidad local
    let minLuminance = 255;
    let maxLuminance = 0;
    let avgLuminance = 0;
    let pixelCount = 0;

    for (let dy = -halfKernel; dy <= halfKernel; dy++) {
      for (let dx = -halfKernel; dx <= halfKernel; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < imageData.width && ny >= 0 && ny < imageData.height) {
          const idx = (ny * imageData.width + nx) * 4;
          const luminance = 0.299 * imageData.data[idx] + 
                           0.587 * imageData.data[idx + 1] + 
                           0.114 * imageData.data[idx + 2];
          
          minLuminance = Math.min(minLuminance, luminance);
          maxLuminance = Math.max(maxLuminance, luminance);
          avgLuminance += luminance;
          pixelCount++;
        }
      }
    }

    if (pixelCount > 0) {
      avgLuminance /= pixelCount;
      const luminanceRange = maxLuminance - minLuminance;
      
      // Áreas con mayor contraste tienden a estar más cerca
      const contrastFactor = luminanceRange / 255;
      const depth = 400 - contrastFactor * 200; // 200-400mm
      const confidence = contrastFactor > 0.2 ? 0.5 : 0.2;
      
      return { depth: Math.max(50, depth), confidence };
    }

    return { depth: 300, confidence: 0.1 };
  }

  // Estimación de profundidad por textura
  private depthFromTexture(
    imageData: ImageData,
    x: number,
    y: number,
    objects: any[]
  ): { depth: number; confidence: number } {
    const kernelSize = 9;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Calcular entropía local como medida de textura
    const histogram = new Array(256).fill(0);
    let pixelCount = 0;

    for (let dy = -halfKernel; dy <= halfKernel; dy++) {
      for (let dx = -halfKernel; dx <= halfKernel; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < imageData.width && ny >= 0 && ny < imageData.height) {
          const idx = (ny * imageData.width + nx) * 4;
          const gray = Math.round(
            (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3
          );
          
          histogram[gray]++;
          pixelCount++;
        }
      }
    }

    // Calcular entropía
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (histogram[i] > 0) {
        const probability = histogram[i] / pixelCount;
        entropy -= probability * Math.log2(probability);
      }
    }

    // Normalizar entropía (máximo teórico es 8 para 8 bits)
    const normalizedEntropy = entropy / 8;
    
    // Texturas más complejas tienden a estar más cerca
    const depth = 350 - normalizedEntropy * 150; // 200-350mm
    const confidence = normalizedEntropy > 0.3 ? 0.4 : 0.2;
    
    return { depth: Math.max(50, depth), confidence };
  }

  // Estimación por defecto basada en posición
  private defaultDepthEstimate(x: number, y: number, width: number, height: number): number {
    const centerX = width / 2;
    const centerY = height / 2;
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
    );
    const maxDistance = Math.sqrt(
      Math.pow(centerX, 2) + Math.pow(centerY, 2)
    );
    
    // Objetos en el centro tienden a estar más cerca
    const normalizedDistance = distanceFromCenter / maxDistance;
    return 250 + normalizedDistance * 100; // 250-350mm
  }

  // Suavizado del mapa de profundidad
  private smoothDepthMap(
    depthData: Float32Array,
    confidenceData: Float32Array,
    width: number,
    height: number
  ): void {
    const smoothed = new Float32Array(depthData.length);
    const kernelSize = 3;
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = halfKernel; y < height - halfKernel; y++) {
      for (let x = halfKernel; x < width - halfKernel; x++) {
        const idx = y * width + x;
        
        let weightedSum = 0;
        let totalWeight = 0;

        for (let dy = -halfKernel; dy <= halfKernel; dy++) {
          for (let dx = -halfKernel; dx <= halfKernel; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            const nIdx = ny * width + nx;
            
            const weight = confidenceData[nIdx];
            weightedSum += depthData[nIdx] * weight;
            totalWeight += weight;
          }
        }

        if (totalWeight > 0) {
          smoothed[idx] = weightedSum / totalWeight;
        } else {
          smoothed[idx] = depthData[idx];
        }
      }
    }

    // Copiar datos suavizados
    for (let i = 0; i < depthData.length; i++) {
      depthData[i] = smoothed[i];
    }
  }

  // Reconstruir objeto 3D a partir del mapa de profundidad
  reconstruct3DObject(
    depthMap: DepthMap,
    objectBounds: { x: number; y: number; width: number; height: number },
    pixelsPerMm: number
  ): Object3D {
    const vertices: Point3D[] = [];
    const faces: number[][] = [];
    
    // Extraer región del objeto
    const startX = Math.max(0, objectBounds.x);
    const endX = Math.min(depthMap.width, objectBounds.x + objectBounds.width);
    const startY = Math.max(0, objectBounds.y);
    const endY = Math.min(depthMap.height, objectBounds.y + objectBounds.height);

    // Crear vértices de la malla
    const vertexMap = new Map<string, number>();
    let vertexIndex = 0;

    for (let y = startY; y < endY; y += 2) { // Submuestrear para eficiencia
      for (let x = startX; x < endX; x += 2) {
        const idx = y * depthMap.width + x;
        const depth = depthMap.data[idx];
        const confidence = depthMap.confidence[idx];

        if (confidence > 0.3) { // Solo usar píxeles con buena confianza
          // Convertir coordenadas de imagen a coordenadas del mundo
          const worldX = (x - depthMap.width / 2) / pixelsPerMm;
          const worldY = (depthMap.height / 2 - y) / pixelsPerMm;
          const worldZ = depth;

          const vertex: Point3D = { x: worldX, y: worldY, z: worldZ };
          vertices.push(vertex);
          
          const key = `${x},${y}`;
          vertexMap.set(key, vertexIndex++);
        }
      }
    }

    // Crear caras triangulares
    for (let y = startY; y < endY - 2; y += 2) {
      for (let x = startX; x < endX - 2; x += 2) {
        const keys = [
          `${x},${y}`,
          `${x + 2},${y}`,
          `${x},${y + 2}`,
          `${x + 2},${y + 2}`
        ];

        const indices = keys.map(key => vertexMap.get(key)).filter(idx => idx !== undefined);

        if (indices.length >= 3) {
          // Crear triángulos
          faces.push([indices[0]!, indices[1]!, indices[2]!]);
          if (indices.length === 4) {
            faces.push([indices[1]!, indices[3]!, indices[2]!]);
          }
        }
      }
    }

    // Calcular bounding box
    const boundingBox = this.calculateBoundingBox(vertices);
    
    // Calcular dimensiones
    const dimensions = {
      width: boundingBox.max.x - boundingBox.min.x,
      height: boundingBox.max.y - boundingBox.min.y,
      depth: boundingBox.max.z - boundingBox.min.z
    };

    // Calcular volumen y área superficial
    const volume = this.calculateVolume(vertices, faces);
    const surfaceArea = this.calculateSurfaceArea(vertices, faces);
    
    // Calcular centroide
    const centroid = this.calculateCentroid(vertices);

    // Calcular confianza general
    const avgConfidence = vertices.length > 0 ? 
      vertices.reduce((sum, _, i) => {
        const x = Math.round(startX + (i % Math.ceil((endX - startX) / 2)) * 2);
        const y = Math.round(startY + Math.floor(i / Math.ceil((endX - startX) / 2)) * 2);
        const idx = y * depthMap.width + x;
        return sum + (depthMap.confidence[idx] || 0);
      }, 0) / vertices.length : 0;

    return {
      id: `object3d_${Date.now()}`,
      vertices,
      faces,
      boundingBox,
      volume,
      surfaceArea,
      centroid,
      dimensions,
      confidence: avgConfidence
    };
  }

  // Calcular bounding box
  private calculateBoundingBox(vertices: Point3D[]): { min: Point3D; max: Point3D } {
    if (vertices.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }

    const min = { ...vertices[0] };
    const max = { ...vertices[0] };

    for (const vertex of vertices) {
      min.x = Math.min(min.x, vertex.x);
      min.y = Math.min(min.y, vertex.y);
      min.z = Math.min(min.z, vertex.z);
      max.x = Math.max(max.x, vertex.x);
      max.y = Math.max(max.y, vertex.y);
      max.z = Math.max(max.z, vertex.z);
    }

    return { min, max };
  }

  // Calcular volumen usando método de tetraedros
  private calculateVolume(vertices: Point3D[], faces: number[][]): number {
    let volume = 0;
    const origin = { x: 0, y: 0, z: 0 };

    for (const face of faces) {
      if (face.length >= 3) {
        const v1 = vertices[face[0]];
        const v2 = vertices[face[1]];
        const v3 = vertices[face[2]];

        // Volumen del tetraedro formado por el origen y la cara
        const tetraVolume = Math.abs(
          v1.x * (v2.y * v3.z - v2.z * v3.y) +
          v2.x * (v3.y * v1.z - v3.z * v1.y) +
          v3.x * (v1.y * v2.z - v1.z * v2.y)
        ) / 6;

        volume += tetraVolume;
      }
    }

    return Math.abs(volume);
  }

  // Calcular área superficial
  private calculateSurfaceArea(vertices: Point3D[], faces: number[][]): number {
    let area = 0;

    for (const face of faces) {
      if (face.length >= 3) {
        const v1 = vertices[face[0]];
        const v2 = vertices[face[1]];
        const v3 = vertices[face[2]];

        // Vectores de los lados del triángulo
        const edge1 = {
          x: v2.x - v1.x,
          y: v2.y - v1.y,
          z: v2.z - v1.z
        };
        const edge2 = {
          x: v3.x - v1.x,
          y: v3.y - v1.y,
          z: v3.z - v1.z
        };

        // Producto cruzado para obtener el área
        const cross = {
          x: edge1.y * edge2.z - edge1.z * edge2.y,
          y: edge1.z * edge2.x - edge1.x * edge2.z,
          z: edge1.x * edge2.y - edge1.y * edge2.x
        };

        const triangleArea = 0.5 * Math.sqrt(
          cross.x * cross.x + cross.y * cross.y + cross.z * cross.z
        );

        area += triangleArea;
      }
    }

    return area;
  }

  // Calcular centroide
  private calculateCentroid(vertices: Point3D[]): Point3D {
    if (vertices.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    const sum = vertices.reduce(
      (acc, vertex) => ({
        x: acc.x + vertex.x,
        y: acc.y + vertex.y,
        z: acc.z + vertex.z
      }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: sum.x / vertices.length,
      y: sum.y / vertices.length,
      z: sum.z / vertices.length
    };
  }

  // Proyectar punto 3D a coordenadas de imagen
  project3DToImage(point3D: Point3D): Point2D {
    const focalLengthPx = (this.cameraParams.focalLength * this.cameraParams.imageWidth) / 
                         this.cameraParams.sensorWidth;
    
    const x = (point3D.x * focalLengthPx / point3D.z) + this.cameraParams.imageWidth / 2;
    const y = (point3D.y * focalLengthPx / point3D.z) + this.cameraParams.imageHeight / 2;
    
    return { x, y };
  }

  // Convertir coordenadas de imagen a rayo 3D
  imageToRay(imagePoint: Point2D): { origin: Point3D; direction: Point3D } {
    const focalLengthPx = (this.cameraParams.focalLength * this.cameraParams.imageWidth) / 
                         this.cameraParams.sensorWidth;
    
    const x = (imagePoint.x - this.cameraParams.imageWidth / 2) / focalLengthPx;
    const y = (imagePoint.y - this.cameraParams.imageHeight / 2) / focalLengthPx;
    
    const direction = { x, y, z: 1 };
    const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    
    return {
      origin: { x: 0, y: 0, z: 0 },
      direction: {
        x: direction.x / length,
        y: direction.y / length,
        z: direction.z / length
      }
    };
  }
}