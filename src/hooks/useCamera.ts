// HOOK REAL DE CÁMARA - IMPLEMENTACIÓN NATIVA COMPLETA
// Gestión real de cámara usando Web API nativa sin dependencias externas

import { useState, useRef, useCallback, useEffect } from 'react';

// INTERFACES PARA CÁMARA REAL
export interface CameraConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
  frameRate: number;
}

export interface CameraStream {
  stream: MediaStream;
  track: MediaStreamTrack;
  settings: MediaTrackSettings;
}

export interface CameraError {
  code: string;
  message: string;
  details?: any;
}

// CLASE PRINCIPAL DE GESTIÓN DE CÁMARA REAL
class RealCameraManager {
  private currentStream: MediaStream | null = null;
  private currentTrack: MediaStreamTrack | null = null;
  private deviceList: MediaDeviceInfo[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.initializeCameraManager();
  }

  // INICIALIZACIÓN REAL DEL GESTOR DE CÁMARA
  private async initializeCameraManager(): Promise<void> {
    try {
      console.log('🔍 INICIANDO GESTOR REAL DE CÁMARA...');
      
      // Verificar soporte para MediaDevices API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API no soportada en este navegador');
      }
      
      // Verificar soporte para enumerateDevices
      if (!navigator.mediaDevices.enumerateDevices) {
        throw new Error('enumerateDevices no soportado en este navegador');
      }
      
      // Enumerar dispositivos disponibles
      await this.enumerateDevices();
      
      this.isInitialized = true;
      console.log('✅ Gestor real de cámara inicializado');
      
    } catch (error) {
      console.error('❌ Error inicializando gestor de cámara:', error);
      throw error;
    }
  }

  // ENUMERACIÓN REAL DE DISPOSITIVOS
  private async enumerateDevices(): Promise<void> {
    try {
      console.log('🔍 Enumerando dispositivos de cámara reales...');
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.deviceList = devices.filter(device => device.kind === 'videoinput');
      
      console.log('✅ Dispositivos de cámara encontrados:', this.deviceList.length);
      
      // Log de dispositivos disponibles
      this.deviceList.forEach((device, index) => {
        console.log(`📹 Cámara ${index + 1}:`, {
          deviceId: device.deviceId,
          label: device.label || `Cámara ${index + 1}`,
          groupId: device.groupId
        });
      });
      
    } catch (error) {
      console.error('❌ Error enumerando dispositivos:', error);
      throw error;
    }
  }

  // SOLICITUD REAL DE PERMISOS DE CÁMARA
  async requestCameraPermissions(): Promise<boolean> {
    try {
      console.log('🔐 Solicitando permisos reales de cámara...');
      
      if (!this.isInitialized) {
        await this.initializeCameraManager();
      }
      
      // Verificar permisos existentes
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          
          if (permissionStatus.state === 'granted') {
            console.log('✅ Permisos de cámara ya concedidos');
            return true;
          } else if (permissionStatus.state === 'denied') {
            console.log('❌ Permisos de cámara denegados permanentemente');
            return false;
          }
        } catch (permError) {
          console.warn('⚠️ No se pudo verificar estado de permisos:', permError);
        }
      }
      
      // Solicitar permisos con getUserMedia
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'environment'
        }
      });
      
      // Limpiar stream de prueba
      testStream.getTracks().forEach(track => track.stop());
      
      console.log('✅ Permisos de cámara concedidos exitosamente');
      return true;
      
    } catch (error) {
      console.error('❌ Error solicitando permisos de cámara:', error);
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            console.error('❌ Permisos de cámara denegados por el usuario');
            break;
          case 'NotFoundError':
            console.error('❌ No se encontraron dispositivos de cámara');
            break;
          case 'NotReadableError':
            console.error('❌ Cámara no disponible o en uso');
            break;
          case 'OverconstrainedError':
            console.error('❌ Restricciones de cámara no satisfechas');
            break;
          default:
            console.error('❌ Error de cámara:', error.name);
        }
      }
      
      return false;
    }
  }

  // INICIO REAL DE CÁMARA
  async startCamera(config: CameraConfig): Promise<CameraStream> {
    try {
      console.log('📹 INICIANDO CÁMARA REAL CON CONFIGURACIÓN:', config);
      
      if (!this.isInitialized) {
        await this.initializeCameraManager();
      }
      
      // Detener stream anterior si existe
      if (this.currentStream) {
        await this.stopCamera();
      }
      
      // Configuración real de video
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: config.width, min: 320, max: 1920 },
        height: { ideal: config.height, min: 240, max: 1080 },
        facingMode: config.facingMode,
        frameRate: { ideal: config.frameRate, min: 15, max: 60 }
      };
      
      console.log('📋 Restricciones de video aplicadas:', videoConstraints);
      
      // Obtener stream real de cámara
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      
      // Obtener track de video
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No se pudo obtener track de video');
      }
      
      // Obtener configuración real del track
      const settings = videoTrack.getSettings();
      console.log('⚙️ Configuración real del track de video:', settings);
      
      // Verificar capacidades del track
      const capabilities = videoTrack.getCapabilities();
      console.log('🔧 Capacidades del track de video:', capabilities);
      
      // Almacenar referencias
      this.currentStream = stream;
      this.currentTrack = videoTrack;
      
      const cameraStream: CameraStream = {
        stream,
        track: videoTrack,
        settings
      };
      
      console.log('✅ CÁMARA REAL INICIADA EXITOSAMENTE');
      return cameraStream;
      
    } catch (error) {
      console.error('❌ Error iniciando cámara real:', error);
      throw this.createCameraError(error);
    }
  }

  // DETENCIÓN REAL DE CÁMARA
  async stopCamera(): Promise<void> {
    try {
      console.log('🛑 DETENIENDO CÁMARA REAL...');
      
      if (this.currentStream) {
        // Detener todos los tracks
        this.currentStream.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Track detenido:', track.kind);
        });
        
        this.currentStream = null;
        this.currentTrack = null;
        
        console.log('✅ CÁMARA REAL DETENIDA EXITOSAMENTE');
      } else {
        console.log('ℹ️ No hay cámara activa para detener');
      }
      
    } catch (error) {
      console.error('❌ Error deteniendo cámara real:', error);
      throw this.createCameraError(error);
    }
  }

  // CAMBIO REAL DE CÁMARA
  async switchCamera(facingMode: 'user' | 'environment'): Promise<CameraStream> {
    try {
      console.log(`🔄 CAMBIANDO A CÁMARA REAL: ${facingMode}`);
      
      if (!this.isInitialized) {
        await this.initializeCameraManager();
      }
      
      // Detener cámara actual
      if (this.currentStream) {
        await this.stopCamera();
      }
      
      // Iniciar nueva cámara con configuración actualizada
      const currentConfig = this.getCurrentCameraConfig();
      const newConfig: CameraConfig = {
        ...currentConfig,
        facingMode
      };
      
      const newCameraStream = await this.startCamera(newConfig);
      
      console.log(`✅ CÁMARA REAL CAMBIADA A: ${facingMode}`);
      return newCameraStream;
      
    } catch (error) {
      console.error('❌ Error cambiando cámara real:', error);
      throw this.createCameraError(error);
    }
  }

  // OBTENCIÓN REAL DE CONFIGURACIÓN ACTUAL
  private getCurrentCameraConfig(): CameraConfig {
    if (this.currentTrack) {
      const settings = this.currentTrack.getSettings();
      return {
        width: settings.width || 640,
        height: settings.height || 480,
        facingMode: settings.facingMode as 'user' | 'environment' || 'environment',
        frameRate: settings.frameRate || 30
      };
    }
    
    // Configuración por defecto
    return {
      width: 640,
      height: 480,
      facingMode: 'environment',
      frameRate: 30
    };
  }

  // OBTENCIÓN REAL DE LISTA DE DISPOSITIVOS
  async getCameraDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (!this.isInitialized) {
        await this.initializeCameraManager();
      }
      
      // Actualizar lista de dispositivos
      await this.enumerateDevices();
      
      return this.deviceList;
      
    } catch (error) {
      console.error('❌ Error obteniendo dispositivos de cámara:', error);
      return [];
    }
  }

  // OBTENCIÓN REAL DE CAPACIDADES DE CÁMARA
  async getCameraCapabilities(): Promise<MediaTrackCapabilities | null> {
    try {
      if (!this.currentTrack) {
        console.warn('⚠️ No hay track de cámara activo');
        return null;
      }
      
      const capabilities = this.currentTrack.getCapabilities();
      console.log('🔧 Capacidades reales de cámara:', capabilities);
      
      return capabilities;
      
    } catch (error) {
      console.error('❌ Error obteniendo capacidades de cámara:', error);
      return null;
    }
  }

  // APLICACIÓN REAL DE RESTRICCIONES DE CÁMARA
  async applyCameraConstraints(constraints: MediaTrackConstraints): Promise<boolean> {
    try {
      if (!this.currentTrack) {
        console.warn('⚠️ No hay track de cámara activo');
        return false;
      }
      
      console.log('⚙️ Aplicando restricciones reales de cámara:', constraints);
      
      // Aplicar restricciones al track actual
      await this.currentTrack.applyConstraints(constraints);
      
      // Verificar que se aplicaron correctamente
      const settings = this.currentTrack.getSettings();
      console.log('✅ Restricciones aplicadas, configuración actual:', settings);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error aplicando restricciones de cámara:', error);
      return false;
    }
  }

  // OBTENCIÓN REAL DE ESTADO DE CÁMARA
  getCameraStatus(): {
    isActive: boolean;
    isInitialized: boolean;
    deviceCount: number;
    currentFacingMode: string | null;
    currentResolution: string | null;
  } {
    const isActive = this.currentStream !== null && this.currentTrack !== null;
    const isInitialized = this.isInitialized;
    const deviceCount = this.deviceList.length;
    
    let currentFacingMode: string | null = null;
    let currentResolution: string | null = null;
    
    if (this.currentTrack) {
      const settings = this.currentTrack.getSettings();
      currentFacingMode = settings.facingMode || null;
      currentResolution = settings.width && settings.height ? 
        `${settings.width}x${settings.height}` : null;
    }
    
    return {
      isActive,
      isInitialized,
      deviceCount,
      currentFacingMode,
      currentResolution
    };
  }

  // LIMPIEZA REAL DE RECURSOS
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 LIMPIANDO RECURSOS REALES DE CÁMARA...');
      
      // Detener cámara si está activa
      if (this.currentStream) {
        await this.stopCamera();
      }
      
      // Limpiar lista de dispositivos
      this.deviceList = [];
      this.isInitialized = false;
      
      console.log('✅ Recursos de cámara limpiados');
      
    } catch (error) {
      console.error('❌ Error limpiando recursos de cámara:', error);
    }
  }

  // CREACIÓN REAL DE ERRORES DE CÁMARA
  private createCameraError(error: any): CameraError {
    let code = 'UNKNOWN_ERROR';
    let message = 'Error desconocido de cámara';
    
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          code = 'PERMISSION_DENIED';
          message = 'Permisos de cámara denegados';
          break;
        case 'NotFoundError':
          code = 'DEVICE_NOT_FOUND';
          message = 'No se encontraron dispositivos de cámara';
          break;
        case 'NotReadableError':
          code = 'DEVICE_BUSY';
          message = 'Cámara no disponible o en uso';
          break;
        case 'OverconstrainedError':
          code = 'CONSTRAINTS_NOT_SATISFIED';
          message = 'Restricciones de cámara no satisfechas';
          break;
        case 'AbortError':
          code = 'OPERATION_ABORTED';
          message = 'Operación de cámara abortada';
          break;
        case 'NotSupportedError':
          code = 'NOT_SUPPORTED';
          message = 'Operación de cámara no soportada';
          break;
        default:
          code = error.name;
          message = error.message || 'Error de cámara';
      }
    } else if (error instanceof Error) {
      code = error.name;
      message = error.message;
    }
    
    return {
      code,
      message,
      details: error
    };
  }
}

// INSTANCIA GLOBAL DEL GESTOR DE CÁMARA
const cameraManager = new RealCameraManager();

// HOOK PRINCIPAL DE CÁMARA REAL
export function useCamera() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<CameraError | null>(null);
  const [cameraStatus, setCameraStatus] = useState(cameraManager.getCameraStatus());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isCapturingRef = useRef(false);

  // INICIALIZACIÓN REAL DE CÁMARA
  const initializeCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 INICIANDO INICIALIZACIÓN REAL DE CÁMARA...');
      
      // Solicitar permisos
      const hasPermissions = await cameraManager.requestCameraPermissions();
      
      if (!hasPermissions) {
        throw new Error('Permisos de cámara denegados');
      }
      
      setIsReady(true);
      console.log('✅ CÁMARA REAL INICIALIZADA');
      
    } catch (err) {
      const cameraError = err instanceof Error ? 
        { code: 'INIT_ERROR', message: err.message, details: err } :
        { code: 'UNKNOWN_ERROR', message: 'Error desconocido', details: err };
      
      setError(cameraError);
      console.error('❌ Error inicializando cámara real:', cameraError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // INICIO REAL DE CÁMARA
  const startCamera = useCallback(async (config?: Partial<CameraConfig>) => {
    try {
      setError(null);
      
      const defaultConfig: CameraConfig = {
        width: 640,
        height: 480,
        facingMode: 'environment',
        frameRate: 30,
        ...config
      };
      
      console.log('📹 INICIANDO CÁMARA REAL...');
      
      const cameraStream = await cameraManager.startCamera(defaultConfig);
      
      // Asignar stream al video element
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream.stream;
        await videoRef.current.play();
      }
      
      cameraStreamRef.current = cameraStream.stream;
      
      // Actualizar estado
      setCameraStatus(cameraManager.getCameraStatus());
      
      console.log('✅ CÁMARA REAL INICIADA');
      
    } catch (err) {
      const cameraError = err instanceof Error ? 
        { code: 'START_ERROR', message: err.message, details: err } :
        { code: 'UNKNOWN_ERROR', message: 'Error desconocido', details: err };
      
      setError(cameraError);
      console.error('❌ Error iniciando cámara real:', cameraError);
      throw cameraError;
    }
  }, []);

  // DETENCIÓN REAL DE CÁMARA
  const stopCamera = useCallback(async () => {
    try {
      console.log('🛑 DETENIENDO CÁMARA REAL...');
      
      // Detener reproducción del video
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      
      // Detener stream de cámara
      await cameraManager.stopCamera();
      
      cameraStreamRef.current = null;
      
      // Actualizar estado
      setCameraStatus(cameraManager.getCameraStatus());
      
      console.log('✅ CÁMARA REAL DETENIDA');
      
    } catch (err) {
      const cameraError = err instanceof Error ? 
        { code: 'STOP_ERROR', message: err.message, details: err } :
        { code: 'UNKNOWN_ERROR', message: 'Error desconocido', details: err };
      
      setError(cameraError);
      console.error('❌ Error deteniendo cámara real:', cameraError);
    }
  }, []);

  // CAMBIO REAL DE CÁMARA
  const switchCamera = useCallback(async (facingMode: 'user' | 'environment') => {
    try {
      console.log(`🔄 CAMBIANDO CÁMARA REAL A: ${facingMode}`);
      
      const cameraStream = await cameraManager.switchCamera(facingMode);
      
      // Asignar nuevo stream al video element
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream.stream;
        await videoRef.current.play();
      }
      
      cameraStreamRef.current = cameraStream.stream;
      
      // Actualizar estado
      setCameraStatus(cameraManager.getCameraStatus());
      
      console.log(`✅ CÁMARA REAL CAMBIADA A: ${facingMode}`);
      
    } catch (err) {
      const cameraError = err instanceof Error ? 
        { code: 'SWITCH_ERROR', message: err.message, details: err } :
        { code: 'UNKNOWN_ERROR', message: 'Error desconocido', details: err };
      
      setError(cameraError);
      console.error('❌ Error cambiando cámara real:', cameraError);
      throw cameraError;
    }
  }, []);

  // SOLICITUD REAL DE PERMISOS
  const requestCameraPermissions = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔐 SOLICITANDO PERMISOS REALES DE CÁMARA...');
      
      const hasPermissions = await cameraManager.requestCameraPermissions();
      
      if (hasPermissions) {
        setIsReady(true);
        setError(null);
      }
      
      return hasPermissions;
      
    } catch (err) {
      const cameraError = err instanceof Error ? 
        { code: 'PERMISSION_ERROR', message: err.message, details: err } :
        { code: 'UNKNOWN_ERROR', message: 'Error desconocido', details: err };
      
      setError(cameraError);
      console.error('❌ Error solicitando permisos de cámara:', cameraError);
      return false;
    }
  }, []);

  // OBTENCIÓN REAL DE DISPOSITIVOS
  const getCameraDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      return await cameraManager.getCameraDevices();
    } catch (error) {
      console.error('❌ Error obteniendo dispositivos de cámara:', error);
      return [];
    }
  }, []);

  // OBTENCIÓN REAL DE CAPACIDADES
  const getCameraCapabilities = useCallback(async (): Promise<MediaTrackCapabilities | null> => {
    try {
      return await cameraManager.getCameraCapabilities();
    } catch (error) {
      console.error('❌ Error obteniendo capacidades de cámara:', error);
      return null;
    }
  }, []);

  // APLICACIÓN REAL DE RESTRICCIONES
  const applyCameraConstraints = useCallback(async (constraints: MediaTrackConstraints): Promise<boolean> => {
    try {
      return await cameraManager.applyCameraConstraints(constraints);
    } catch (error) {
      console.error('❌ Error aplicando restricciones de cámara:', error);
      return false;
    }
  }, []);

  // INICIALIZACIÓN AUTOMÁTICA
  useEffect(() => {
    initializeCamera();
    
    // Limpieza al desmontar
    return () => {
      cameraManager.cleanup();
    };
  }, [initializeCamera]);

  // ACTUALIZACIÓN OPTIMIZADA DEL ESTADO (RequestAnimationFrame)
  useEffect(() => {
    let rafId: number;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 1000; // 1 segundo
    
    const updateStatus = (currentTime: number) => {
      if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
        setCameraStatus(cameraManager.getCameraStatus());
        lastUpdateTime = currentTime;
      }
      
      rafId = requestAnimationFrame(updateStatus);
    };
    
    rafId = requestAnimationFrame(updateStatus);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return {
    // Referencias
    videoRef,
    
    // Estados
    isReady,
    isLoading,
    error,
    cameraStatus,
    
    // Streams
    cameraStream: cameraStreamRef.current,
    isCapturing: isCapturingRef.current,
    
    // Funciones
    startCamera,
    stopCamera,
    switchCamera,
    requestCameraPermissions,
    getCameraDevices,
    getCameraCapabilities,
    applyCameraConstraints,
    
    // Funciones auxiliares
    initializeCamera
  };
}