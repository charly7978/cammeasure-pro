import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// UTILIDADES DE PROCESAMIENTO DE IMAGEN
// ============================================================================

// Convertir canvas a ImageData
export const canvasToImageData = (canvas: HTMLCanvasElement): ImageData => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener contexto 2D');
  
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

// Convertir ImageData a canvas
export const imageDataToCanvas = (imageData: ImageData): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener contexto 2D');
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

// Crear ImageData vacío
export const createImageData = (width: number, height: number): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  return canvasToImageData(canvas);
};

// ============================================================================
// UTILIDADES MATEMÁTICAS
// ============================================================================

// Calcular distancia entre dos puntos
export const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Calcular área de un polígono
export const calculateArea = (points: { x: number; y: number }[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
};

// Calcular perímetro de un polígono
export const calculatePerimeter = (points: { x: number; y: number }[]): number => {
  if (points.length < 2) return 0;
  
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const distance = calculateDistance(points[i], points[j]);
    perimeter += distance;
  }
  
  return perimeter;
};

// ============================================================================
// UTILIDADES DE VALIDACIÓN
// ============================================================================

// Validar ImageData
export const isValidImageData = (imageData: any): boolean => {
  return (
    imageData &&
    imageData.data &&
    ArrayBuffer.isView(imageData.data) &&
    imageData.width > 0 &&
    imageData.height > 0 &&
    imageData.data.length === imageData.width * imageData.height * 4
  );
};

// Validar contorno
export const isValidContour = (contour: any): boolean => {
  return (
    contour &&
    contour.points &&
    Array.isArray(contour.points) &&
    contour.points.length >= 3 &&
    contour.boundingBox &&
    typeof contour.area === 'number' &&
    typeof contour.perimeter === 'number'
  );
};

// ============================================================================
// CONSTANTES DE CONFIGURACIÓN
// ============================================================================

export const DEFAULT_CONFIG = {
  edgeDetection: {
    kernelSize: 3,
    sigma: 1.0,
    lowThreshold: 50,
    highThreshold: 150
  },
  contourDetection: {
    minArea: 100,
    maxArea: 1000000,
    minPerimeter: 50,
    confidenceThreshold: 0.6
  },
  measurement: {
    enable3D: true,
    enableAdvancedProperties: true,
    precision: 2,
    units: 'mm'
  }
};

// ============================================================================
// FUNCIONES DE INICIALIZACIÓN
// ============================================================================

// Inicializar sistema
export const initializeSystem = async (): Promise<boolean> => {
  try {
    console.log('🚀 Inicializando sistema de medición avanzado...');
    
    // Verificar compatibilidad del navegador
    if (!window.HTMLCanvasElement || !window.CanvasRenderingContext2D) {
      throw new Error('Canvas 2D no soportado');
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('API de cámara no soportada');
    }
    
    console.log('✅ Sistema inicializado correctamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error inicializando sistema:', error);
    return false;
  }
};

// Limpiar sistema
export const cleanupSystem = (): void => {
  console.log('🧹 Limpiando sistema...');
  // Aquí se pueden agregar tareas de limpieza si es necesario
};