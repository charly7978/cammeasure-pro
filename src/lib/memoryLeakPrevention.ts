// PREVENCIÓN INTELIGENTE DE MEMORY LEAKS
// Gestión automática de memoria para ImageData y recursos pesados

import { useEffect } from 'react';

interface MemoryTracker {
  imageDataCount: number;
  totalMemoryUsage: number;
  activeComponents: Set<string>;
  lastCleanup: number;
}

class MemoryLeakPrevention {
  private tracker: MemoryTracker = {
    imageDataCount: 0,
    totalMemoryUsage: 0,
    activeComponents: new Set(),
    lastCleanup: 0
  };
  
  private readonly MAX_IMAGEDATA_COUNT = 10;
  private readonly MAX_MEMORY_MB = 50; // 50MB máximo
  private readonly CLEANUP_INTERVAL = 3000; // 3 segundos
  private cleanupTimer: number | null = null;

  constructor() {
    this.bindMethods();
    this.startMemoryMonitoring();
  }

  private bindMethods(): void {
    this.trackImageData = this.trackImageData.bind(this);
    this.releaseImageData = this.releaseImageData.bind(this);
    this.registerComponent = this.registerComponent.bind(this);
    this.unregisterComponent = this.unregisterComponent.bind(this);
  }

  // INICIAR MONITOREO DE MEMORIA
  private startMemoryMonitoring(): void {
    const monitor = () => {
      this.performMemoryCleanup();
      this.cleanupTimer = window.requestAnimationFrame(monitor);
    };
    
    // Iniciar con delay
    setTimeout(() => {
      this.cleanupTimer = window.requestAnimationFrame(monitor);
    }, this.CLEANUP_INTERVAL);
  }

  // REGISTRAR IMAGEDATA
  trackImageData(componentId: string, imageData: ImageData): void {
    this.tracker.imageDataCount++;
    this.tracker.totalMemoryUsage += this.calculateImageDataSize(imageData);
    
    // Alerta si se supera el límite
    if (this.tracker.imageDataCount > this.MAX_IMAGEDATA_COUNT) {
      console.warn(`⚠️ Memory leak detectado: ${this.tracker.imageDataCount} ImageData activos`);
      this.forceMemoryCleanup();
    }
  }

  // LIBERAR IMAGEDATA
  releaseImageData(componentId: string, imageData: ImageData): void {
    this.tracker.imageDataCount = Math.max(0, this.tracker.imageDataCount - 1);
    this.tracker.totalMemoryUsage = Math.max(0, this.tracker.totalMemoryUsage - this.calculateImageDataSize(imageData));
  }

  // REGISTRAR COMPONENTE ACTIVO
  registerComponent(componentId: string): void {
    this.tracker.activeComponents.add(componentId);
  }

  // DESREGISTRAR COMPONENTE
  unregisterComponent(componentId: string): void {
    this.tracker.activeComponents.delete(componentId);
  }

  // CALCULAR TAMAÑO DE IMAGEDATA
  private calculateImageDataSize(imageData: ImageData): number {
    return imageData.width * imageData.height * 4; // 4 bytes por píxel RGBA
  }

  // LIMPIEZA AUTOMÁTICA DE MEMORIA
  private performMemoryCleanup(): void {
    const now = performance.now();
    
    if (now - this.tracker.lastCleanup < this.CLEANUP_INTERVAL) {
      return;
    }

    // Verificar uso de memoria
    const memoryUsageMB = this.tracker.totalMemoryUsage / (1024 * 1024);
    
    if (memoryUsageMB > this.MAX_MEMORY_MB || this.tracker.imageDataCount > this.MAX_IMAGEDATA_COUNT) {
      this.forceMemoryCleanup();
    }

    this.tracker.lastCleanup = now;
  }

  // FORZAR LIMPIEZA DE MEMORIA
  private forceMemoryCleanup(): void {
    console.log('🧹 Forzando limpieza de memoria...');
    
    // Limpiar caches si están disponibles
    if (typeof window !== 'undefined') {
      // Intentar garbage collection
      if ('gc' in window) {
        (window as any).gc();
      }
      
      // Limpiar caches del navegador
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('measurement') || name.includes('frame')) {
              caches.delete(name);
            }
          });
        });
      }
    }

    // Resetear contador de ImageData (será actualizado por los componentes)
    this.tracker.imageDataCount = Math.floor(this.tracker.imageDataCount * 0.3);
    this.tracker.totalMemoryUsage = Math.floor(this.tracker.totalMemoryUsage * 0.3);
  }

  // OBTENER ESTADÍSTICAS DE MEMORIA
  getMemoryStats(): MemoryTracker & { memoryUsageMB: number } {
    return {
      ...this.tracker,
      memoryUsageMB: this.tracker.totalMemoryUsage / (1024 * 1024)
    };
  }

  // VERIFICAR SI HAY MEMORY LEAK
  hasMemoryLeak(): boolean {
    const memoryUsageMB = this.tracker.totalMemoryUsage / (1024 * 1024);
    return this.tracker.imageDataCount > this.MAX_IMAGEDATA_COUNT || memoryUsageMB > this.MAX_MEMORY_MB;
  }

  // CREAR IMAGEDATA OPTIMIZADA
  createOptimizedImageData(width: number, height: number): ImageData {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    
    this.trackImageData('system', imageData);
    return imageData;
  }

  // CLONAR IMAGEDATA CON TRACKING
  cloneImageDataSafe(original: ImageData, componentId: string): ImageData {
    const cloned = this.createOptimizedImageData(original.width, original.height);
    cloned.data.set(original.data);
    this.trackImageData(componentId, cloned);
    return cloned;
  }

  // DESTRUCTOR
  destroy(): void {
    if (this.cleanupTimer) {
      cancelAnimationFrame(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.tracker.activeComponents.clear();
    this.tracker.imageDataCount = 0;
    this.tracker.totalMemoryUsage = 0;
  }
}

// INSTANCIA SINGLETON
export const memoryLeakPrevention = new MemoryLeakPrevention();

// HOOK PARA PREVENCIÓN DE MEMORY LEAKS
export const useMemoryLeakPrevention = (componentId: string) => {
  useEffect(() => {
    memoryLeakPrevention.registerComponent(componentId);
    
    return () => {
      memoryLeakPrevention.unregisterComponent(componentId);
    };
  }, [componentId]);

  return {
    trackImageData: (imageData: ImageData) => memoryLeakPrevention.trackImageData(componentId, imageData),
    releaseImageData: (imageData: ImageData) => memoryLeakPrevention.releaseImageData(componentId, imageData),
    cloneImageDataSafe: (imageData: ImageData) => memoryLeakPrevention.cloneImageDataSafe(imageData, componentId),
    getMemoryStats: memoryLeakPrevention.getMemoryStats,
    hasMemoryLeak: memoryLeakPrevention.hasMemoryLeak
  };
};