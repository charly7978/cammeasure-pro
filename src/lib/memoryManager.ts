// GESTOR DE MEMORIA OPTIMIZADO - FASE 1 DEL PLAN DE OPTIMIZACIÓN
// Automatiza limpieza de memoria y previene memory leaks

interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  percentage: number;
}

interface MemoryConfig {
  maxMemoryThreshold: number; // Porcentaje 0-1
  cleanupInterval: number; // ms
  forceGCThreshold: number; // Porcentaje 0-1
  bufferLimit: number; // Número máximo de buffers
}

interface ManagedBuffer {
  id: string;
  data: ImageData | Uint8Array | Float32Array;
  timestamp: number;
  lastAccess: number;
  size: number;
  type: 'image' | 'array' | 'float';
  priority: 'high' | 'medium' | 'low';
}

class OptimizedMemoryManager {
  private buffers: Map<string, ManagedBuffer> = new Map();
  private config: MemoryConfig = {
    maxMemoryThreshold: 0.8, // 80% de memoria máxima
    cleanupInterval: 5000, // 5 segundos
    forceGCThreshold: 0.9, // 90% fuerza garbage collection
    bufferLimit: 50
  };
  
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isCleaningUp: boolean = false;

  constructor(customConfig?: Partial<MemoryConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    this.startMemoryMonitoring();
  }

  // REGISTRAR BUFFER PARA GESTIÓN AUTOMÁTICA
  registerBuffer(
    id: string, 
    data: ImageData | Uint8Array | Float32Array, 
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): void {
    const now = Date.now();
    const type = this.detectBufferType(data);
    const size = this.calculateBufferSize(data);

    const buffer: ManagedBuffer = {
      id,
      data,
      timestamp: now,
      lastAccess: now,
      size,
      type,
      priority
    };

    // Limpieza preventiva si alcanzamos el límite
    if (this.buffers.size >= this.config.bufferLimit) {
      this.cleanupOldBuffers();
    }

    this.buffers.set(id, buffer);
  }

  // ACCEDER A BUFFER REGISTRADO
  accessBuffer(id: string): ImageData | Uint8Array | Float32Array | null {
    const buffer = this.buffers.get(id);
    if (buffer) {
      buffer.lastAccess = Date.now();
      return buffer.data;
    }
    return null;
  }

  // LIBERAR BUFFER ESPECÍFICO
  releaseBuffer(id: string): boolean {
    const buffer = this.buffers.get(id);
    if (buffer) {
      // Limpiar referencias
      if (buffer.type === 'image') {
        (buffer.data as ImageData).data.fill(0);
      } else if (buffer.type === 'array') {
        (buffer.data as Uint8Array).fill(0);
      } else if (buffer.type === 'float') {
        (buffer.data as Float32Array).fill(0);
      }
      
      return this.buffers.delete(id);
    }
    return false;
  }

  // LIBERAR TODOS LOS BUFFERS
  releaseAllBuffers(): void {
    for (const [id] of this.buffers) {
      this.releaseBuffer(id);
    }
  }

  // DETECTAR TIPO DE BUFFER
  private detectBufferType(data: any): 'image' | 'array' | 'float' {
    if (data instanceof ImageData) return 'image';
    if (data instanceof Float32Array) return 'float';
    return 'array';
  }

  // CALCULAR TAMAÑO DE BUFFER
  private calculateBufferSize(data: ImageData | Uint8Array | Float32Array): number {
    if (data instanceof ImageData) {
      return data.data.length * 4; // 4 bytes por píxel RGBA
    }
    if (data instanceof Float32Array) {
      return data.length * 4; // 4 bytes por float
    }
    if (data instanceof Uint8Array) {
      return data.length; // 1 byte por elemento
    }
    return 0;
  }

  // OBTENER USO ACTUAL DE MEMORIA
  getCurrentMemoryUsage(): MemoryUsage {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      const memory = (window.performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        percentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit
      };
    }
    
    // Fallback para navegadores sin API de memoria
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      percentage: 0
    };
  }

  // INICIAR MONITOREO DE MEMORIA
  private startMemoryMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.performMemoryMaintenance();
    }, this.config.cleanupInterval);
  }

  // REALIZAR MANTENIMIENTO DE MEMORIA
  private performMemoryMaintenance(): void {
    if (this.isCleaningUp) return;
    
    this.isCleaningUp = true;
    
    try {
      const memoryUsage = this.getCurrentMemoryUsage();
      
      // Limpieza de buffers antiguos
      this.cleanupOldBuffers();
      
      // Forzar garbage collection si es necesario
      if (memoryUsage.percentage > this.config.forceGCThreshold) {
        this.forceGarbageCollection();
      }
      
      // Limpieza preventiva si la memoria está alta
      if (memoryUsage.percentage > this.config.maxMemoryThreshold) {
        this.aggressiveCleanup();
      }
      
    } finally {
      this.isCleaningUp = false;
    }
  }

  // LIMPIAR BUFFERS ANTIGUOS
  private cleanupOldBuffers(): void {
    const now = Date.now();
    const maxAge = 30000; // 30 segundos
    const keysToDelete: string[] = [];

    for (const [id, buffer] of this.buffers) {
      if (buffer.priority === 'high') continue; // No limpiar alta prioridad
      
      if (now - buffer.lastAccess > maxAge) {
        keysToDelete.push(id);
      }
    }

    keysToDelete.forEach(id => this.releaseBuffer(id));
  }

  // LIMPIEZA AGRESIVA
  private aggressiveCleanup(): void {
    const bufferArray = Array.from(this.buffers.entries());
    
    // Ordenar por prioridad y tiempo de acceso
    bufferArray.sort(([, a], [, b]) => {
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.lastAccess - b.lastAccess;
    });

    // Eliminar hasta el 30% de los buffers menos importantes
    const toDelete = Math.floor(bufferArray.length * 0.3);
    for (let i = 0; i < toDelete; i++) {
      const [id] = bufferArray[i];
      this.releaseBuffer(id);
    }
  }

  // FORZAR GARBAGE COLLECTION
  private forceGarbageCollection(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc();
      } catch (error) {
        // Garbage collection no disponible
      }
    }
    
    // Forzar algunas operaciones que ayuden al GC
    if (typeof window !== 'undefined') {
      // Crear y eliminar arrays temporales para forzar limpieza
      for (let i = 0; i < 10; i++) {
        const temp = new Array(1000).fill(0);
        temp.length = 0;
      }
    }
  }

  // OBTENER ESTADÍSTICAS DE BUFFERS
  getBufferStats(): {
    totalBuffers: number;
    totalSize: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  } {
    let totalSize = 0;
    const byType: Record<string, number> = { image: 0, array: 0, float: 0 };
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };

    for (const buffer of this.buffers.values()) {
      totalSize += buffer.size;
      byType[buffer.type]++;
      byPriority[buffer.priority]++;
    }

    return {
      totalBuffers: this.buffers.size,
      totalSize,
      byType,
      byPriority
    };
  }

  // DETENER MONITOREO
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.releaseAllBuffers();
  }

  // CONFIGURAR PARÁMETROS
  configure(newConfig: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// INSTANCIA SINGLETON DEL GESTOR DE MEMORIA
export const memoryManager = new OptimizedMemoryManager();

// HOOK PARA USAR EL GESTOR DE MEMORIA
export const useMemoryManager = () => {
  return {
    register: memoryManager.registerBuffer.bind(memoryManager),
    access: memoryManager.accessBuffer.bind(memoryManager),
    release: memoryManager.releaseBuffer.bind(memoryManager),
    releaseAll: memoryManager.releaseAllBuffers.bind(memoryManager),
    getUsage: memoryManager.getCurrentMemoryUsage.bind(memoryManager),
    getStats: memoryManager.getBufferStats.bind(memoryManager),
    configure: memoryManager.configure.bind(memoryManager)
  };
};