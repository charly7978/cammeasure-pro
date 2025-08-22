// COORDINADOR DE PROCESOS PARA EVITAR SOLAPAMIENTO Y MEMORY LEAKS
// Sistema de mutex para evitar inicializaciones múltiples y procesos simultáneos

interface ProcessLock {
  id: string;
  isLocked: boolean;
  lastUsed: number;
  component: string;
}

interface ResourceManager {
  imageDataCount: number;
  streamCount: number;
  rafCount: number;
  lastCleanup: number;
}

class ProcessCoordinator {
  private locks: Map<string, ProcessLock> = new Map();
  private activeProcesses: Set<string> = new Set();
  private resourceManager: ResourceManager = {
    imageDataCount: 0,
    streamCount: 0,
    rafCount: 0,
    lastCleanup: 0
  };
  
  private readonly LOCK_TIMEOUT = 10000; // 10 segundos timeout para locks
  private readonly CLEANUP_INTERVAL = 2000; // 2 segundos entre limpiezas

  constructor() {
    this.startResourceMonitoring();
  }

  // ADQUIRIR LOCK EXCLUSIVO
  async acquireLock(processId: string, component: string, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (!this.locks.has(processId) || !this.locks.get(processId)?.isLocked) {
        this.locks.set(processId, {
          id: processId,
          isLocked: true,
          lastUsed: Date.now(),
          component
        });
        this.activeProcesses.add(processId);
        return true;
      }
      
      // Esperar 10ms antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return false; // Timeout
  }

  // LIBERAR LOCK
  releaseLock(processId: string): void {
    if (this.locks.has(processId)) {
      this.locks.delete(processId);
      this.activeProcesses.delete(processId);
    }
  }

  // VERIFICAR SI PROCESO ESTÁ ACTIVO
  isProcessActive(processId: string): boolean {
    return this.activeProcesses.has(processId);
  }

  // OBTENER CONTEO DE PROCESOS ACTIVOS
  getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }

  // LIMPIAR PROCESOS CADUCADOS
  private cleanExpiredLocks(): void {
    const now = Date.now();
    
    for (const [id, lock] of this.locks.entries()) {
      if (now - lock.lastUsed > this.LOCK_TIMEOUT) {
        console.warn(`🔓 Liberando lock caducado: ${id} (${lock.component})`);
        this.releaseLock(id);
      }
    }
  }

  // REGISTRAR USO DE RECURSO
  registerResource(type: 'imageData' | 'stream' | 'raf'): void {
    switch (type) {
      case 'imageData':
        this.resourceManager.imageDataCount++;
        break;
      case 'stream':
        this.resourceManager.streamCount++;
        break;
      case 'raf':
        this.resourceManager.rafCount++;
        break;
    }
  }

  // LIBERAR RECURSO
  releaseResource(type: 'imageData' | 'stream' | 'raf'): void {
    switch (type) {
      case 'imageData':
        this.resourceManager.imageDataCount = Math.max(0, this.resourceManager.imageDataCount - 1);
        break;
      case 'stream':
        this.resourceManager.streamCount = Math.max(0, this.resourceManager.streamCount - 1);
        break;
      case 'raf':
        this.resourceManager.rafCount = Math.max(0, this.resourceManager.rafCount - 1);
        break;
    }
  }

  // VERIFICAR ESTADO DE RECURSOS
  getResourceStatus(): ResourceManager & { isOverloaded: boolean } {
    const isOverloaded = 
      this.resourceManager.imageDataCount > 5 ||
      this.resourceManager.streamCount > 2 ||
      this.resourceManager.rafCount > 10 ||
      this.activeProcesses.size > 5;

    return {
      ...this.resourceManager,
      isOverloaded
    };
  }

  // FORZAR LIMPIEZA DE RECURSOS
  forceCleanup(): void {
    const now = Date.now();
    
    if (now - this.resourceManager.lastCleanup < this.CLEANUP_INTERVAL) {
      return; // No limpiar muy frecuentemente
    }

    console.log('🧹 Forzando limpieza coordinada de recursos...');
    
    // Limpiar locks caducados
    this.cleanExpiredLocks();
    
    // Forzar garbage collection si está disponible
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
    
    // Resetear contadores si están muy altos
    if (this.resourceManager.imageDataCount > 10) {
      this.resourceManager.imageDataCount = Math.floor(this.resourceManager.imageDataCount * 0.5);
    }
    
    this.resourceManager.lastCleanup = now;
  }

  // PAUSAR TODOS LOS PROCESOS
  pauseAllProcesses(): void {
    console.log('⏸️ Pausando todos los procesos activos...');
    
    for (const processId of this.activeProcesses) {
      const lock = this.locks.get(processId);
      if (lock) {
        console.log(`⏸️ Pausando proceso: ${processId} (${lock.component})`);
      }
    }
  }

  // REANUDAR PROCESOS
  resumeAllProcesses(): void {
    console.log('▶️ Reanudando procesos...');
    // Los procesos se reanudarán automáticamente al intentar adquirir locks
  }

  // MONITOREO AUTOMÁTICO DE RECURSOS
  private startResourceMonitoring(): void {
    setInterval(() => {
      const status = this.getResourceStatus();
      
      if (status.isOverloaded) {
        console.warn('⚠️ Sistema sobrecargado, iniciando limpieza automática:', status);
        this.forceCleanup();
      }
      
      // Limpiar locks caducados regularmente
      this.cleanExpiredLocks();
      
    }, this.CLEANUP_INTERVAL);
  }

  // CREAR DEBOUNCE PARA FUNCIÓN
  createDebounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  // OBTENER ESTADÍSTICAS
  getStats(): {
    activeLocks: number;
    activeProcesses: number;
    resourceStatus: ResourceManager & { isOverloaded: boolean };
    lockDetails: { id: string; component: string; age: number }[];
  } {
    const now = Date.now();
    const lockDetails = Array.from(this.locks.values()).map(lock => ({
      id: lock.id,
      component: lock.component,
      age: now - lock.lastUsed
    }));

    return {
      activeLocks: this.locks.size,
      activeProcesses: this.activeProcesses.size,
      resourceStatus: this.getResourceStatus(),
      lockDetails
    };
  }
}

// INSTANCIA SINGLETON
export const processCoordinator = new ProcessCoordinator();

// HOOK PARA COORDINACIÓN DE PROCESOS
export const useProcessCoordinator = () => {
  return {
    acquireLock: processCoordinator.acquireLock.bind(processCoordinator),
    releaseLock: processCoordinator.releaseLock.bind(processCoordinator),
    isProcessActive: processCoordinator.isProcessActive.bind(processCoordinator),
    getActiveProcessCount: processCoordinator.getActiveProcessCount.bind(processCoordinator),
    registerResource: processCoordinator.registerResource.bind(processCoordinator),
    releaseResource: processCoordinator.releaseResource.bind(processCoordinator),
    getResourceStatus: processCoordinator.getResourceStatus.bind(processCoordinator),
    forceCleanup: processCoordinator.forceCleanup.bind(processCoordinator),
    createDebounce: processCoordinator.createDebounce.bind(processCoordinator),
    getStats: processCoordinator.getStats.bind(processCoordinator)
  };
};