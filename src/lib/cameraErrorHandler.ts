// MANEJO INTELIGENTE DE ERRORES DE CÁMARA
// Sistema robusto para prevenir congelamientos y manejar errores de cámara

interface CameraErrorState {
  hasError: boolean;
  errorType: string;
  errorMessage: string;
  retryCount: number;
  lastErrorTime: number;
  canRetry: boolean;
}

interface RetryStrategy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  resetTime: number;
}

class CameraErrorHandler {
  private errorState: CameraErrorState = {
    hasError: false,
    errorType: 'none',
    errorMessage: '',
    retryCount: 0,
    lastErrorTime: 0,
    canRetry: true
  };

  private retryStrategy: RetryStrategy = {
    maxRetries: 3,
    retryDelay: 2000, // 2 segundos
    backoffMultiplier: 1.5,
    resetTime: 30000 // 30 segundos para reset
  };

  private activeStreams: Set<MediaStream> = new Set();
  private cleanupCallbacks: Set<() => void> = new Set();

  // MANEJAR ERROR DE CÁMARA
  handleCameraError(error: any, context: string = 'unknown'): boolean {
    const currentTime = Date.now();
    
    // Reset contador si ha pasado suficiente tiempo
    if (currentTime - this.errorState.lastErrorTime > this.retryStrategy.resetTime) {
      this.errorState.retryCount = 0;
    }

    this.errorState.hasError = true;
    this.errorState.lastErrorTime = currentTime;
    this.errorState.retryCount++;

    // Clasificar tipo de error
    const errorType = this.classifyError(error);
    this.errorState.errorType = errorType;
    this.errorState.errorMessage = this.getHumanReadableError(error, errorType);

    console.error(`🚨 Error de cámara [${context}]:`, {
      type: errorType,
      message: this.errorState.errorMessage,
      retryCount: this.errorState.retryCount,
      originalError: error
    });

    // Determinar si se puede reintentar
    this.errorState.canRetry = this.canRetryError(errorType) && 
                              this.errorState.retryCount < this.retryStrategy.maxRetries;

    // Limpiar recursos automáticamente
    this.cleanupCameraResources();

    return this.errorState.canRetry;
  }

  // CLASIFICAR TIPO DE ERROR
  private classifyError(error: any): string {
    if (!error) return 'unknown';

    const errorName = error.name || error.code || '';
    const errorMessage = error.message || '';

    // Errores específicos de cámara
    if (errorName === 'NotAllowedError') return 'permission_denied';
    if (errorName === 'NotFoundError') return 'device_not_found';
    if (errorName === 'NotReadableError') return 'device_busy';
    if (errorName === 'OverconstrainedError') return 'constraints_not_satisfied';
    if (errorName === 'AbortError') return 'operation_aborted';
    if (errorName === 'NotSupportedError') return 'not_supported';

    // Errores por mensaje
    if (errorMessage.includes('Permission denied')) return 'permission_denied';
    if (errorMessage.includes('not found') || errorMessage.includes('No devices')) return 'device_not_found';
    if (errorMessage.includes('in use') || errorMessage.includes('busy')) return 'device_busy';
    if (errorMessage.includes('Could not start')) return 'initialization_failed';

    return 'unknown';
  }

  // OBTENER MENSAJE LEGIBLE
  private getHumanReadableError(error: any, errorType: string): string {
    const messages = {
      permission_denied: 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara.',
      device_not_found: 'No se encontraron dispositivos de cámara. Verifica que hay una cámara conectada.',
      device_busy: 'La cámara está siendo usada por otra aplicación. Cierra otras apps que usen la cámara.',
      constraints_not_satisfied: 'La configuración de cámara solicitada no es compatible con tu dispositivo.',
      operation_aborted: 'La operación de cámara fue cancelada.',
      not_supported: 'Tu navegador no soporta las funciones de cámara requeridas.',
      initialization_failed: 'Error al inicializar la cámara. Intenta recargar la página.',
      unknown: 'Error desconocido de cámara. Intenta recargar la página.'
    };

    return messages[errorType as keyof typeof messages] || messages.unknown;
  }

  // VERIFICAR SI SE PUEDE REINTENTAR
  private canRetryError(errorType: string): boolean {
    const nonRetryableErrors = ['permission_denied', 'device_not_found', 'not_supported'];
    return !nonRetryableErrors.includes(errorType);
  }

  // INTENTAR RECUPERACIÓN AUTOMÁTICA
  async attemptRecovery(initFunction: () => Promise<void>): Promise<boolean> {
    if (!this.errorState.canRetry) {
      console.log('❌ No se puede reintentar, error no recuperable');
      return false;
    }

    const delay = this.calculateRetryDelay();
    console.log(`🔄 Intentando recuperación en ${delay}ms (intento ${this.errorState.retryCount}/${this.retryStrategy.maxRetries})`);

    // Esperar delay con backoff exponencial
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Limpiar completamente antes de reintentar
      await this.forceCleanupAll();
      
      // Intentar inicialización nuevamente
      await initFunction();
      
      // Si llega aquí, la recuperación fue exitosa
      this.clearErrorState();
      console.log('✅ Recuperación de cámara exitosa');
      return true;

    } catch (recoveryError) {
      console.error('❌ Fallo en recuperación:', recoveryError);
      return this.handleCameraError(recoveryError, 'recovery');
    }
  }

  // CALCULAR DELAY DE REINTENTO
  private calculateRetryDelay(): number {
    const baseDelay = this.retryStrategy.retryDelay;
    const multiplier = Math.pow(this.retryStrategy.backoffMultiplier, this.errorState.retryCount - 1);
    return Math.min(baseDelay * multiplier, 10000); // Max 10 segundos
  }

  // LIMPIAR RECURSOS DE CÁMARA
  private cleanupCameraResources(): void {
    console.log('🧹 Limpiando recursos de cámara...');

    // Ejecutar callbacks de limpieza
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Error en callback de limpieza:', error);
      }
    });

    // Detener todos los streams activos
    this.activeStreams.forEach(stream => {
      try {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Track detenido:', track.kind, track.label);
        });
      } catch (error) {
        console.warn('Error deteniendo stream:', error);
      }
    });

    this.activeStreams.clear();
  }

  // LIMPIEZA FORZADA COMPLETA
  private async forceCleanupAll(): Promise<void> {
    console.log('🧹 Limpieza forzada completa...');

    // Detener todos los streams
    this.cleanupCameraResources();

    // Esperar un momento para que se liberen los recursos
    await new Promise(resolve => setTimeout(resolve, 500));

    // Limpiar cualquier referencia en el DOM
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    });

    // Forzar garbage collection si está disponible
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc();
    }
  }

  // REGISTRAR STREAM ACTIVO
  registerStream(stream: MediaStream): void {
    this.activeStreams.add(stream);
    console.log(`📹 Stream registrado, total activos: ${this.activeStreams.size}`);
  }

  // DESREGISTRAR STREAM
  unregisterStream(stream: MediaStream): void {
    this.activeStreams.delete(stream);
    console.log(`📹 Stream desregistrado, total activos: ${this.activeStreams.size}`);
  }

  // REGISTRAR CALLBACK DE LIMPIEZA
  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  // DESREGISTRAR CALLBACK DE LIMPIEZA
  unregisterCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }

  // LIMPIAR ESTADO DE ERROR
  private clearErrorState(): void {
    this.errorState = {
      hasError: false,
      errorType: 'none',
      errorMessage: '',
      retryCount: 0,
      lastErrorTime: 0,
      canRetry: true
    };
  }

  // OBTENER ESTADO ACTUAL
  getErrorState(): CameraErrorState {
    return { ...this.errorState };
  }

  // VERIFICAR SI HAY ERROR
  hasError(): boolean {
    return this.errorState.hasError;
  }

  // VERIFICAR SI PUEDE REINTENTAR
  canRetry(): boolean {
    return this.errorState.canRetry && this.errorState.retryCount < this.retryStrategy.maxRetries;
  }

  // OBTENER SUGERENCIA DE ACCIÓN
  getActionSuggestion(): string {
    const errorType = this.errorState.errorType;
    
    const suggestions = {
      permission_denied: 'Haz clic en el icono de cámara en la barra de direcciones y permite el acceso.',
      device_not_found: 'Conecta una cámara y recarga la página.',
      device_busy: 'Cierra otras aplicaciones que usen la cámara y recarga la página.',
      constraints_not_satisfied: 'Tu cámara no soporta la configuración requerida. Intenta con una cámara diferente.',
      initialization_failed: 'Recarga la página o reinicia tu navegador.',
      unknown: 'Recarga la página. Si el problema persiste, reinicia tu navegador.'
    };

    return suggestions[errorType as keyof typeof suggestions] || suggestions.unknown;
  }

  // RESET COMPLETO
  reset(): void {
    this.forceCleanupAll();
    this.clearErrorState();
    this.cleanupCallbacks.clear();
    console.log('🔄 Handler de errores de cámara reseteado');
  }

  // OBTENER ESTADÍSTICAS
  getStats(): {
    totalErrors: number;
    canRetry: boolean;
    timeUntilReset: number;
    activeStreams: number;
  } {
    const currentTime = Date.now();
    const timeSinceLastError = currentTime - this.errorState.lastErrorTime;
    const timeUntilReset = Math.max(0, this.retryStrategy.resetTime - timeSinceLastError);

    return {
      totalErrors: this.errorState.retryCount,
      canRetry: this.canRetry(),
      timeUntilReset,
      activeStreams: this.activeStreams.size
    };
  }
}

// INSTANCIA SINGLETON
export const cameraErrorHandler = new CameraErrorHandler();

// HOOK PARA USAR EL MANEJADOR DE ERRORES
export const useCameraErrorHandler = () => {
  return {
    handleError: cameraErrorHandler.handleCameraError.bind(cameraErrorHandler),
    attemptRecovery: cameraErrorHandler.attemptRecovery.bind(cameraErrorHandler),
    registerStream: cameraErrorHandler.registerStream.bind(cameraErrorHandler),
    unregisterStream: cameraErrorHandler.unregisterStream.bind(cameraErrorHandler),
    registerCleanupCallback: cameraErrorHandler.registerCleanupCallback.bind(cameraErrorHandler),
    unregisterCleanupCallback: cameraErrorHandler.unregisterCleanupCallback.bind(cameraErrorHandler),
    getErrorState: cameraErrorHandler.getErrorState.bind(cameraErrorHandler),
    hasError: cameraErrorHandler.hasError.bind(cameraErrorHandler),
    canRetry: cameraErrorHandler.canRetry.bind(cameraErrorHandler),
    getActionSuggestion: cameraErrorHandler.getActionSuggestion.bind(cameraErrorHandler),
    reset: cameraErrorHandler.reset.bind(cameraErrorHandler),
    getStats: cameraErrorHandler.getStats.bind(cameraErrorHandler)
  };
};