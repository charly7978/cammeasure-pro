/**
 * GESTOR AVANZADO DE OPENCV PARA MEDICIÓN PROFESIONAL
 * Sistema robusto de carga y gestión de OpenCV con fallback nativo
 */

export interface OpenCVConfig {
  enableMultiScale?: boolean;
  enableTemporalStabilization?: boolean;
  maxObjects?: number;
  confidenceThreshold?: number;
  enable3D?: boolean;
  cameraParams?: CameraParameters;
}

export interface CameraParameters {
  focalLength: number;
  principalPointX: number;
  principalPointY: number;
  sensorWidth: number;
  sensorHeight: number;
  imageWidth: number;
  imageHeight: number;
  pixelsPerMm: number;
}

export interface OpenCVStatus {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  version: string | null;
  capabilities: string[];
}

export interface DetectionResult {
  objects: DetectedObject[];
  processingTime: number;
  algorithm: 'OpenCV' | 'Native';
  metadata: DetectionMetadata;
}

export interface DetectedObject {
  id: string;
  bounds: BoundingRect;
  contour: Point[];
  properties: ObjectProperties;
  confidence: number;
  timestamp: number;
  // Datos 3D reales
  depth?: number;
  realWidth?: number;
  realHeight?: number;
  realDepth?: number;
  volume?: number;
  surfaceArea?: number;
  estimatedMass?: number;
  distanceToCamera?: number;
  viewingAngle?: number;
  geometricShape?: string;
  errorEstimate?: number;
  measurementQuality?: number;
}

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  centerX: number;
  centerY: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ObjectProperties {
  area: number;
  perimeter: number;
  circularity: number;
  solidity: number;
  aspectRatio: number;
  extent: number;
  orientation: number;
  moments: ImageMoments;
  shapeType: ShapeType;
  edgeStrength: number;
  textureComplexity: number;
}

export interface ImageMoments {
  m00: number;
  m10: number;
  m01: number;
  m20: number;
  m11: number;
  m02: number;
  mu20: number;
  mu11: number;
  mu02: number;
}

export enum ShapeType {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  ELLIPSE = 'ellipse',
  TRIANGLE = 'triangle',
  POLYGON = 'polygon',
  IRREGULAR = 'irregular'
}

export interface DetectionMetadata {
  processingTime: number;
  algorithm: 'OpenCV' | 'Native';
  objectCount: number;
  averageConfidence: number;
  opencvVersion?: string;
}

declare global {
  interface Window {
    cv: any;
  }
}

class OpenCVManager {
  private static instance: OpenCVManager;
  private status: OpenCVStatus = {
    isLoaded: false,
    isLoading: false,
    error: null,
    version: null,
    capabilities: []
  };

  private opencvSources = [
    'https://docs.opencv.org/4.8.0/opencv.js',
    'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
    'https://unpkg.com/opencv.js@4.8.0/opencv.js',
    'https://raw.githubusercontent.com/opencv/opencv/master/platforms/js/opencv.js'
  ];

  private defaultCameraParams: CameraParameters = {
    focalLength: 800,
    principalPointX: 320,
    principalPointY: 240,
    sensorWidth: 6.17,
    sensorHeight: 4.63,
    imageWidth: 640,
    imageHeight: 480,
    pixelsPerMm: 129.87
  };

  private constructor() {}

  static getInstance(): OpenCVManager {
    if (!OpenCVManager.instance) {
      OpenCVManager.instance = new OpenCVManager();
    }
    return OpenCVManager.instance;
  }

  /**
   * CARGAR OPENCV CON MÚLTIPLES FUENTES Y CONFIGURACIÓN ROBUSTA
   */
  async loadOpenCV(): Promise<OpenCVStatus> {
    if (this.status.isLoaded) {
      return this.status;
    }

    if (this.status.isLoading) {
      // Esperar si ya está cargando
      while (this.status.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.status;
    }

    this.status.isLoading = true;
    this.status.error = null;

    try {
      // Verificar si OpenCV ya está disponible
      if (window.cv && window.cv.Mat) {
        this.status.isLoaded = true;
        this.status.isLoading = false;
        this.status.version = this.getOpenCVVersion();
        this.status.capabilities = this.getCapabilities();
        console.log('✅ OpenCV ya cargado:', this.status.version);
        return this.status;
      }

      // Intentar cargar desde múltiples fuentes
      for (const source of this.opencvSources) {
        try {
          console.log(`🔄 Intentando cargar OpenCV desde: ${source}`);
          await this.loadFromSource(source);
          break; // Éxito, salir del bucle
        } catch (error) {
          console.warn(`❌ Falló carga desde ${source}:`, error);
          if (source === this.opencvSources[this.opencvSources.length - 1]) {
            // Última fuente falló
            this.status.error = 'No se pudo cargar OpenCV desde ninguna fuente';
            this.status.isLoading = false;
            console.warn('⚠️ OpenCV no disponible - usando algoritmos nativos');
          }
        }
      }

      if (this.status.isLoaded) {
        this.status.version = this.getOpenCVVersion();
        this.status.capabilities = this.getCapabilities();
        console.log('✅ OpenCV cargado exitosamente:', this.status.version);
      }

    } catch (error) {
      this.status.error = error instanceof Error ? error.message : 'Error desconocido';
      this.status.isLoading = false;
      console.error('❌ Error cargando OpenCV:', error);
    }

    return this.status;
  }

  /**
   * CARGAR OPENCV DESDE UNA FUENTE ESPECÍFICA
   */
  private async loadFromSource(source: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remover scripts existentes de OpenCV
      const existingScripts = document.querySelectorAll('script[src*="opencv.js"]');
      existingScripts.forEach(script => script.remove());

      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.crossOrigin = 'anonymous';

      let loadTimeout: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(loadTimeout);
        script.remove();
      };

      loadTimeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout cargando OpenCV desde ${source}`));
      }, 30000); // 30 segundos timeout

      script.onload = () => {
        clearTimeout(loadTimeout);
        
        // Verificar que OpenCV se inicializó correctamente
        const checkOpenCV = (attempts = 0) => {
          if (window.cv && window.cv.Mat) {
            this.status.isLoaded = true;
            this.status.isLoading = false;
            this.status.error = null;
            resolve();
          } else if (attempts < 200) { // 20 segundos máximo
            setTimeout(() => checkOpenCV(attempts + 1), 100);
          } else {
            cleanup();
            reject(new Error('OpenCV no se inicializó correctamente'));
          }
        };

        setTimeout(checkOpenCV, 100);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error(`Error cargando script desde ${source}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * DETECTAR OBJETOS CON OPENCV AVANZADO
   */
  async detectObjects(imageData: ImageData, config: OpenCVConfig = {}): Promise<DetectionResult> {
    const startTime = performance.now();

    try {
      if (!this.status.isLoaded || !window.cv) {
        // Fallback a algoritmos nativos
        return this.detectWithNativeAlgorithms(imageData, config);
      }

      const objects = await this.detectWithOpenCV(imageData, config);
      const processingTime = performance.now() - startTime;

      return {
        objects,
        processingTime,
        algorithm: 'OpenCV',
        metadata: {
          processingTime,
          algorithm: 'OpenCV',
          objectCount: objects.length,
          averageConfidence: this.calculateAverageConfidence(objects),
          opencvVersion: this.status.version
        }
      };

    } catch (error) {
      console.warn('⚠️ Error con OpenCV, usando algoritmos nativos:', error);
      return this.detectWithNativeAlgorithms(imageData, config);
    }
  }

  /**
   * DETECCIÓN AVANZADA CON OPENCV
   */
  private async detectWithOpenCV(imageData: ImageData, config: OpenCVConfig): Promise<DetectedObject[]> {
    const src = window.cv.matFromImageData(imageData);
    const gray = new window.cv.Mat();
    const detectedObjects: DetectedObject[] = [];

    try {
      // 1. PREPROCESAMIENTO AVANZADO
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
      
      // Aplicar filtros de suavizado
      const blurred = new window.cv.Mat();
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0);
      
      // Detección de bordes con Canny
      const edges = new window.cv.Mat();
      window.cv.Canny(blurred, edges, 50, 150);

      // 2. DETECCIÓN DE CONTORNOS
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();
      window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

      // 3. ANÁLISIS DE CADA CONTORNO
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);
        
        if (area < (config.confidenceThreshold || 100)) continue;

        // Calcular propiedades del contorno
        const properties = this.calculateOpenCVProperties(contour, area);
        
        if (!this.isValidObject(properties)) continue;

        // Calcular bounding rectangle
        const boundingRect = window.cv.boundingRect(contour);
        
        // Extraer puntos del contorno
        const contourPoints = this.extractContourPoints(contour);
        
        // Calcular confianza
        const confidence = this.calculateObjectConfidence(properties, area);
        
        // Crear objeto detectado
        const detectedObject: DetectedObject = {
          id: this.generateObjectId(),
          bounds: {
            x: boundingRect.x,
            y: boundingRect.y,
            width: boundingRect.width,
            height: boundingRect.height,
            area: area,
            centerX: boundingRect.x + boundingRect.width / 2,
            centerY: boundingRect.y + boundingRect.height / 2
          },
          contour: contourPoints,
          properties,
          confidence,
          timestamp: Date.now()
        };

        // Aplicar medición 3D si está habilitada
        if (config.enable3D) {
          const object3D = await this.calculate3DMeasurements(detectedObject, imageData, config.cameraParams);
          Object.assign(detectedObject, object3D);
        }

        detectedObjects.push(detectedObject);
      }

      // Limpiar memoria
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();

      return detectedObjects;

    } catch (error) {
      // Limpiar memoria en caso de error
      if (src) src.delete();
      if (gray) gray.delete();
      throw error;
    }
  }

  /**
   * DETECCIÓN CON ALGORITMOS NATIVOS (FALLBACK)
   */
  private detectWithNativeAlgorithms(imageData: ImageData, config: OpenCVConfig): DetectionResult {
    const startTime = performance.now();
    
    // Implementar detección nativa básica
    const objects: DetectedObject[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Detección de bordes nativa
    const edges = this.detectEdgesNative(data, width, height);
    const components = this.findConnectedComponentsNative(edges, width, height, config.confidenceThreshold || 100);

    // Procesar componentes
    for (const component of components) {
      const properties = this.calculateNativeProperties(component, data, width, height);
      
      if (!this.isValidObject(properties)) continue;

      const confidence = this.calculateObjectConfidence(properties, component.area);
      
      const detectedObject: DetectedObject = {
        id: this.generateObjectId(),
        bounds: {
          x: component.x,
          y: component.y,
          width: component.width,
          height: component.height,
          area: component.area,
          centerX: component.x + component.width / 2,
          centerY: component.y + component.height / 2
        },
        contour: component.contour,
        properties,
        confidence,
        timestamp: Date.now()
      };

      objects.push(detectedObject);
    }

    const processingTime = performance.now() - startTime;

    return {
      objects,
      processingTime,
      algorithm: 'Native',
      metadata: {
        processingTime,
        algorithm: 'Native',
        objectCount: objects.length,
        averageConfidence: this.calculateAverageConfidence(objects)
      }
    };
  }

  /**
   * CALCULAR PROPIEDADES CON OPENCV
   */
  private calculateOpenCVProperties(contour: any, area: number): ObjectProperties {
    const perimeter = window.cv.arcLength(contour, true);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    
    // Calcular momentos
    const moments = window.cv.moments(contour);
    
    // Calcular orientación
    const orientation = Math.atan2(2 * moments.mu11, moments.mu20 - moments.mu02) * 180 / Math.PI;
    
    // Calcular bounding rectangle para aspect ratio
    const boundingRect = window.cv.boundingRect(contour);
    const aspectRatio = boundingRect.width / boundingRect.height;
    
    // Calcular solidity
    const hull = new window.cv.Mat();
    window.cv.convexHull(contour, hull);
    const hullArea = window.cv.contourArea(hull);
    const solidity = area / hullArea;
    hull.delete();

    return {
      area,
      perimeter,
      circularity,
      solidity,
      aspectRatio,
      extent: area / (boundingRect.width * boundingRect.height),
      orientation,
      moments: {
        m00: moments.m00,
        m10: moments.m10,
        m01: moments.m01,
        m20: moments.m20,
        m11: moments.m11,
        m02: moments.m02,
        mu20: moments.mu20,
        mu11: moments.mu11,
        mu02: moments.mu02
      },
      shapeType: this.classifyShape(contour, aspectRatio, circularity, solidity),
      edgeStrength: this.calculateEdgeStrength(contour),
      textureComplexity: this.calculateTextureComplexity(contour)
    };
  }

  /**
   * CALCULAR MEDICIONES 3D
   */
  private async calculate3DMeasurements(
    object: DetectedObject, 
    imageData: ImageData, 
    cameraParams?: CameraParameters
  ): Promise<Partial<DetectedObject>> {
    const params = cameraParams || this.defaultCameraParams;
    
    // Estimación de profundidad basada en tamaño
    const depth = this.estimateDepthBySize(object, imageData, params);
    
    // Calcular dimensiones reales
    const realWidth = (object.bounds.width / params.pixelsPerMm) * depth / params.focalLength;
    const realHeight = (object.bounds.height / params.pixelsPerMm) * depth / params.focalLength;
    
    // Calcular volumen y área superficial
    const volume = this.calculateVolume(realWidth, realHeight, depth);
    const surfaceArea = this.calculateSurfaceArea(realWidth, realHeight, depth);
    
    // Calcular ángulo de visión
    const viewingAngle = this.calculateViewingAngle(object, imageData);
    
    return {
      depth,
      realWidth,
      realHeight,
      realDepth: depth,
      volume,
      surfaceArea,
      estimatedMass: volume * 1.0, // Densidad estimada
      distanceToCamera: depth,
      viewingAngle,
      geometricShape: object.properties.shapeType,
      errorEstimate: this.calculateErrorEstimate(depth, params),
      measurementQuality: this.calculateMeasurementQuality(object, depth)
    };
  }

  /**
   * FUNCIONES AUXILIARES
   */
  private getOpenCVVersion(): string {
    return window.cv?.version || 'Unknown';
  }

  private getCapabilities(): string[] {
    const capabilities = ['Basic Detection'];
    if (this.status.isLoaded) {
      capabilities.push('OpenCV Algorithms', 'Advanced Filtering', '3D Measurement');
    }
    return capabilities;
  }

  private generateObjectId(): string {
    return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateAverageConfidence(objects: DetectedObject[]): number {
    if (objects.length === 0) return 0;
    const sum = objects.reduce((acc, obj) => acc + obj.confidence, 0);
    return sum / objects.length;
  }

  private isValidObject(properties: ObjectProperties): boolean {
    return properties.area > 100 && 
           properties.circularity > 0.1 && 
           properties.solidity > 0.5;
  }

  private calculateObjectConfidence(properties: ObjectProperties, area: number): number {
    let confidence = 0.5;
    
    // Basado en área
    if (area > 1000) confidence += 0.2;
    if (area > 5000) confidence += 0.1;
    
    // Basado en circularidad
    if (properties.circularity > 0.7) confidence += 0.1;
    
    // Basado en solidity
    if (properties.solidity > 0.8) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private classifyShape(contour: any, aspectRatio: number, circularity: number, solidity: number): ShapeType {
    if (circularity > 0.8) return ShapeType.CIRCLE;
    if (circularity > 0.6 && aspectRatio > 0.8 && aspectRatio < 1.2) return ShapeType.ELLIPSE;
    if (aspectRatio > 0.8 && aspectRatio < 1.2 && solidity > 0.9) return ShapeType.RECTANGLE;
    if (solidity > 0.7) return ShapeType.POLYGON;
    return ShapeType.IRREGULAR;
  }

  private calculateEdgeStrength(contour: any): number {
    // Implementación simplificada
    return 0.7;
  }

  private calculateTextureComplexity(contour: any): number {
    // Implementación simplificada
    return 0.5;
  }

  private extractContourPoints(contour: any): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < contour.rows; i++) {
      points.push({
        x: contour.data32S[i * 2],
        y: contour.data32S[i * 2 + 1]
      });
    }
    return points;
  }

  // Funciones nativas de detección
  private detectEdgesNative(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
    const edges = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const gray = this.getGrayValue(data, x, y, width);
        
        // Detección de bordes simple
        const gx = this.getGrayValue(data, x + 1, y, width) - this.getGrayValue(data, x - 1, y, width);
        const gy = this.getGrayValue(data, x, y + 1, width) - this.getGrayValue(data, x, y - 1, width);
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        edges[idx] = magnitude > 30 ? 255 : 0;
      }
    }
    
    return edges;
  }

  private findConnectedComponentsNative(edges: Uint8Array, width: number, height: number, minArea: number): any[] {
    const visited = new Array(width * height).fill(false);
    const components: any[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!visited[idx] && edges[idx] === 255) {
          const component = this.floodFillNative(edges, visited, x, y, width, height);
          if (component.area >= minArea) {
            components.push(component);
          }
        }
      }
    }
    
    return components;
  }

  private floodFillNative(edges: Uint8Array, visited: boolean[], startX: number, startY: number, width: number, height: number): any {
    const stack = [{x: startX, y: startY}];
    const points: Point[] = [];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    
    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || edges[idx] !== 255) {
        continue;
      }
      
      visited[idx] = true;
      points.push({x, y});
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Agregar vecinos
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area: points.length,
      contour: points
    };
  }

  private calculateNativeProperties(component: any, data: Uint8ClampedArray, width: number, height: number): ObjectProperties {
    const area = component.area;
    const perimeter = this.calculatePerimeter(component.contour);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    const aspectRatio = component.width / component.height;
    
    return {
      area,
      perimeter,
      circularity,
      solidity: 0.8, // Estimación
      aspectRatio,
      extent: area / (component.width * component.height),
      orientation: 0, // Simplificado
      moments: {
        m00: area,
        m10: 0,
        m01: 0,
        m20: 0,
        m11: 0,
        m02: 0,
        mu20: 0,
        mu11: 0,
        mu02: 0
      },
      shapeType: this.classifyShape(null, aspectRatio, circularity, 0.8),
      edgeStrength: 0.7,
      textureComplexity: 0.5
    };
  }

  private calculatePerimeter(contour: Point[]): number {
    let perimeter = 0;
    for (let i = 0; i < contour.length; i++) {
      const next = (i + 1) % contour.length;
      const dx = contour[next].x - contour[i].x;
      const dy = contour[next].y - contour[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  }

  private getGrayValue(data: Uint8ClampedArray, x: number, y: number, width: number): number {
    const idx = (y * width + x) * 4;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  }

  // Funciones 3D
  private estimateDepthBySize(object: DetectedObject, imageData: ImageData, params: CameraParameters): number {
    // Estimación basada en el tamaño del objeto en la imagen
    const objectSize = Math.max(object.bounds.width, object.bounds.height);
    return (params.focalLength * params.sensorWidth) / (objectSize * params.pixelsPerMm);
  }

  private calculateVolume(width: number, height: number, depth: number): number {
    return width * height * depth;
  }

  private calculateSurfaceArea(width: number, height: number, depth: number): number {
    return 2 * (width * height + width * depth + height * depth);
  }

  private calculateViewingAngle(object: DetectedObject, imageData: ImageData): number {
    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;
    const objectCenterX = object.bounds.centerX;
    const objectCenterY = object.bounds.centerY;
    
    const dx = objectCenterX - centerX;
    const dy = objectCenterY - centerY;
    
    return Math.atan2(Math.sqrt(dx * dx + dy * dy), object.depth || 1000) * 180 / Math.PI;
  }

  private calculateErrorEstimate(depth: number, params: CameraParameters): number {
    // Error estimado basado en la profundidad
    return depth * 0.05; // 5% de error
  }

  private calculateMeasurementQuality(object: DetectedObject, depth: number): number {
    let quality = 0.5;
    
    if (object.confidence > 0.8) quality += 0.2;
    if (depth > 100 && depth < 5000) quality += 0.2;
    if (object.properties.circularity > 0.7) quality += 0.1;
    
    return Math.min(quality, 1.0);
  }

  /**
   * OBTENER ESTADO ACTUAL
   */
  getStatus(): OpenCVStatus {
    return { ...this.status };
  }

  /**
   * REINICIAR EL SISTEMA
   */
  reset(): void {
    this.status = {
      isLoaded: false,
      isLoading: false,
      error: null,
      version: null,
      capabilities: []
    };
  }
}

export default OpenCVManager;
