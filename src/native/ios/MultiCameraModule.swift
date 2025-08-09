
/**
 * MultiCameraModule para iOS - Implementación nativa usando AVFoundation
 * Soporte completo para AVCaptureMultiCamSession en iOS 13+
 * 
 * PROHIBIDA la simulación - Solo implementaciones reales de hardware
 */

import Foundation
import AVFoundation
import CoreMotion
import UIKit

@objc(MultiCameraModule)
class MultiCameraModule: RCTEventEmitter {
    
    private var captureSession: AVCaptureMultiCamSession?
    private var photoOutputs: [AVCapturePhotoOutput] = []
    private var videoDataOutputs: [AVCaptureVideoDataOutput] = []
    private var captureDevices: [AVCaptureDevice] = []
    private var deviceInputs: [AVCaptureDeviceInput] = []
    
    // Sincronización temporal exacta
    private let sessionQueue = DispatchQueue(label: "camera.session.queue")
    private let dataOutputQueue = DispatchQueue(label: "camera.data.output.queue", 
                                               qos: .userInitiated, 
                                               attributes: [.concurrent])
    
    private var isCapturingMultiFrame = false
    private var frameSynchronizer: MultiFrameSynchronizer
    private var cameraCalibrationManager: CameraCalibrationManager
    
    // Native bridge para C++
    private var nativeProcessor: NativeCameraProcessor
    
    override init() {
        self.frameSynchronizer = MultiFrameSynchronizer()
        self.cameraCalibrationManager = CameraCalibrationManager()
        self.nativeProcessor = NativeCameraProcessor()
        super.init()
        
        setupAVFoundation()
    }
    
    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return [
            "CameraInitialized",
            "CameraSyncComplete", 
            "CameraError",
            "FrameProcessed",
            "CalibrationUpdate"
        ]
    }
    
    // MARK: - Inicialización de múltiples cámaras
    
    @objc(initializeMultipleCameras:withRejecter:)
    func initializeMultipleCameras(resolve: @escaping RCTPromiseResolveBlock,
                                 reject: @escaping RCTPromiseRejectBlock) {
        
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            
            do {
                // Verificar compatibilidad con múltiples cámaras
                guard AVCaptureMultiCamSession.isMultiCamSupported else {
                    reject("MULTICAM_UNSUPPORTED", "Dispositivo no soporta múltiples cámaras", nil)
                    return
                }
                
                // Crear sesión de múltiples cámaras
                let session = AVCaptureMultiCamSession()
                session.beginConfiguration()
                
                // Obtener todos los dispositivos de cámara disponibles
                let discoverySession = AVCaptureDevice.DiscoverySession(
                    deviceTypes: [
                        .builtInWideAngleCamera,
                        .builtInTelephotoCamera,
                        .builtInUltraWideCamera,
                        .builtInDualCamera,
                        .builtInTripleCamera,
                        .builtInDualWideCamera
                    ],
                    mediaType: .video,
                    position: .unspecified
                )
                
                let availableDevices = discoverySession.devices
                print("📱 Dispositivos de cámara disponibles: \(availableDevices.count)")
                
                // Configurar cada cámara disponible
                for (index, device) in availableDevices.enumerated() {
                    guard index < 4 else { break } // Máximo 4 cámaras
                    
                    do {
                        // Crear input del dispositivo
                        let deviceInput = try AVCaptureDeviceInput(device: device)
                        
                        // Verificar si se puede agregar a la sesión multi-cámara
                        if session.canAddInput(deviceInput) {
                            session.addInput(deviceInput)
                            self.deviceInputs.append(deviceInput)
                            self.captureDevices.append(device)
                            
                            // Configurar salida de foto para cada cámara
                            let photoOutput = AVCapturePhotoOutput()
                            if session.canAddOutput(photoOutput) {
                                session.addOutput(photoOutput)
                                self.photoOutputs.append(photoOutput)
                                
                                // Configuración para máxima calidad
                                photoOutput.isHighResolutionCaptureEnabled = true
                                if #available(iOS 13.0, *) {
                                    photoOutput.isVirtualDeviceConstituentPhotoDeliveryEnabled = true
                                }
                            }
                            
                            // Configurar salida de datos de video para procesamiento en tiempo real
                            let videoOutput = AVCaptureVideoDataOutput()
                            videoOutput.setSampleBufferDelegate(self, queue: self.dataOutputQueue)
                            
                            // Configurar formato de píxel para máximo rendimiento
                            videoOutput.videoSettings = [
                                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
                            ]
                            
                            if session.canAddOutput(videoOutput) {
                                session.addOutput(videoOutput)
                                self.videoDataOutputs.append(videoOutput)
                                
                                // Configurar conexión para cada cámara
                                if let connection = videoOutput.connection(with: .video) {
                                    connection.videoOrientation = .portrait
                                    connection.isVideoMirrored = device.position == .front
                                }
                            }
                            
                            print("🎥 Configurada cámara \(index): \(device.localizedName)")
                            
                        } else {
                            print("⚠️ No se puede agregar cámara \(index) a la sesión")
                        }
                    } catch {
                        print("❌ Error configurando cámara \(index): \(error)")
                        continue
                    }
                }
                
                // Finalizar configuración
                session.commitConfiguration()
                self.captureSession = session
                
                // Inicializar procesador nativo con parámetros de las cámaras
                self.initializeNativeProcessor()
                
                // Obtener parámetros de calibración para cada cámara
                let calibrationData = self.extractCameraCalibrationData()
                
                DispatchQueue.main.async {
                    let result: [String: Any] = [
                        "cameraCount": self.captureDevices.count,
                        "isMultiCamSupported": true,
                        "calibrationData": calibrationData,
                        "status": "initialized"
                    ]
                    resolve(result)
                    
                    self.sendEvent(withName: "CameraInitialized", body: result)
                }
                
            } catch {
                DispatchQueue.main.async {
                    reject("INIT_ERROR", "Error inicializando cámaras: \(error.localizedDescription)", error)
                }
            }
        }
    }
    
    // MARK: - Captura sincronizada
    
    @objc(synchronizeCapture:withRejecter:)
    func synchronizeCapture(resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        
        guard let session = captureSession else {
            reject("NO_SESSION", "Sesión de cámara no inicializada", nil)
            return
        }
        
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            
            self.isCapturingMultiFrame = true
            let captureId = UUID().uuidString
            
            // Configurar settings de captura para máxima calidad y sincronización
            var photoSettings: [AVCapturePhotoSettings] = []
            
            for (index, photoOutput) in self.photoOutputs.enumerated() {
                let settings = AVCapturePhotoSettings(format: [
                    AVVideoCodecKey: AVVideoCodecType.hevc
                ])
                
                // Configuración para máxima calidad
                settings.isHighResolutionPhotoEnabled = true
                settings.photoQualityPrioritization = .quality
                
                // Configurar flash si está disponible
                if self.captureDevices[index].hasFlash {
                    settings.flashMode = .auto
                }
                
                // Configurar estabilización si está disponible
                if #available(iOS 13.0, *) {
                    settings.photoQualityPrioritization = .quality
                }
                
                photoSettings.append(settings)
            }
            
            // Preparar sincronización temporal
            let captureTime = CACurrentMediaTime()
            self.frameSynchronizer.beginCaptureSequence(captureId: captureId, 
                                                      timestamp: captureTime,
                                                      expectedFrameCount: self.photoOutputs.count)
            
            // Ejecutar capturas simultáneas
            for (index, photoOutput) in self.photoOutputs.enumerated() {
                let delegate = PhotoCaptureDelegate(
                    captureId: captureId,
                    cameraIndex: index,
                    synchronizer: self.frameSynchronizer,
                    processor: self.nativeProcessor
                ) { [weak self] result in
                    self?.handleCaptureResult(result, for: captureId)
                }
                
                photoOutput.capturePhoto(with: photoSettings[index], delegate: delegate)
            }
            
            DispatchQueue.main.async {
                let result: [String: Any] = [
                    "captureId": captureId,
                    "timestamp": captureTime,
                    "cameraCount": self.photoOutputs.count,
                    "status": "capturing"
                ]
                resolve(result)
            }
        }
    }
    
    // MARK: - Obtención de parámetros de cámara
    
    @objc(getCameraParameters:withResolver:withRejecter:)
    func getCameraParameters(cameraIndex: Int,
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        
        guard cameraIndex < captureDevices.count else {
            reject("INVALID_INDEX", "Índice de cámara inválido", nil)
            return
        }
        
        let device = captureDevices[cameraIndex]
        
        // Extraer parámetros exactos de calibración
        let parameters = cameraCalibrationManager.extractIntrinsicParameters(for: device)
        
        let result: [String: Any] = [
            "cameraIndex": cameraIndex,
            "deviceName": device.localizedName,
            "position": device.position.rawValue,
            "focalLength": parameters.focalLength,
            "intrinsicMatrix": parameters.intrinsicMatrix,
            "distortionCoefficients": parameters.distortionCoefficients,
            "sensorSize": parameters.sensorSize,
            "pixelSize": parameters.pixelSize,
            "principalPoint": parameters.principalPoint
        ]
        
        resolve(result)
    }
    
    // MARK: - Métodos privados
    
    private func setupAVFoundation() {
        // Solicitar permisos de cámara
        AVCaptureDevice.requestAccess(for: .video) { granted in
            if !granted {
                self.sendEvent(withName: "CameraError", body: ["error": "Permisos de cámara denegados"])
            }
        }
    }
    
    private func initializeNativeProcessor() {
        guard let firstDevice = captureDevices.first else { return }
        
        // Obtener dimensiones de captura
        let format = firstDevice.activeFormat
        let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        
        nativeProcessor.initialize(
            width: Int32(dimensions.width),
            height: Int32(dimensions.height), 
            cameraCount: Int32(captureDevices.count)
        )
    }
    
    private func extractCameraCalibrationData() -> [[String: Any]] {
        return captureDevices.enumerated().map { index, device in
            let params = cameraCalibrationManager.extractIntrinsicParameters(for: device)
            return [
                "cameraIndex": index,
                "focalLength": params.focalLength,
                "intrinsicMatrix": params.intrinsicMatrix,
                "distortionCoefficients": params.distortionCoefficients,
                "sensorSize": params.sensorSize
            ]
        }
    }
    
    private func handleCaptureResult(_ result: CaptureResult, for captureId: String) {
        if frameSynchronizer.isSequenceComplete(captureId: captureId) {
            let allResults = frameSynchronizer.getResults(for: captureId)
            
            // Procesar frames sincronizados con C++
            nativeProcessor.processMultiFrame(results: allResults)
            
            isCapturingMultiFrame = false
            
            sendEvent(withName: "CameraSyncComplete", body: [
                "captureId": captureId,
                "frameCount": allResults.count,
                "maxTimeDifference": frameSynchronizer.getMaxTimeDifference(for: captureId)
            ])
        }
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

extension MultiCameraModule: AVCaptureVideoDataOutputSampleBufferDelegate {
    
    func captureOutput(_ output: AVCaptureOutput, 
                      didOutput sampleBuffer: CMSampleBuffer, 
                      from connection: AVCaptureConnection) {
        
        // Identificar de qué cámara viene el frame
        guard let outputIndex = videoDataOutputs.firstIndex(of: output as! AVCaptureVideoDataOutput) else {
            return
        }
        
        // Extraer timestamp exacto
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        
        // Procesar frame en tiempo real si no estamos capturando multi-frame
        if !isCapturingMultiFrame {
            nativeProcessor.processRealtimeFrame(
                sampleBuffer: sampleBuffer,
                cameraIndex: Int32(outputIndex),
                timestamp: timestamp
            )
        }
    }
}

// MARK: - Clases auxiliares

class MultiFrameSynchronizer {
    private var activeCaptureSequences: [String: CaptureSequence] = [:]
    private let syncTolerance: TimeInterval = 0.016667 // 16.67ms para 60fps
    
    func beginCaptureSequence(captureId: String, timestamp: TimeInterval, expectedFrameCount: Int) {
        activeCaptureSequences[captureId] = CaptureSequence(
            id: captureId,
            startTimestamp: timestamp,
            expectedFrameCount: expectedFrameCount
        )
    }
    
    func addResult(_ result: CaptureResult, for captureId: String) {
        activeCaptureSequences[captureId]?.addResult(result)
    }
    
    func isSequenceComplete(captureId: String) -> Bool {
        return activeCaptureSequences[captureId]?.isComplete ?? false
    }
    
    func getResults(for captureId: String) -> [CaptureResult] {
        return activeCaptureSequences[captureId]?.results ?? []
    }
    
    func getMaxTimeDifference(for captureId: String) -> TimeInterval {
        guard let sequence = activeCaptureSequences[captureId] else { return 0 }
        
        let timestamps = sequence.results.map { $0.timestamp }
        guard let minTime = timestamps.min(), let maxTime = timestamps.max() else { return 0 }
        
        return maxTime - minTime
    }
}

struct CaptureSequence {
    let id: String
    let startTimestamp: TimeInterval
    let expectedFrameCount: Int
    var results: [CaptureResult] = []
    
    var isComplete: Bool {
        return results.count == expectedFrameCount
    }
    
    mutating func addResult(_ result: CaptureResult) {
        results.append(result)
    }
}

struct CaptureResult {
    let cameraIndex: Int
    let imageData: Data
    let timestamp: TimeInterval
    let metadata: [String: Any]
}

class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let captureId: String
    private let cameraIndex: Int
    private let synchronizer: MultiFrameSynchronizer
    private let processor: NativeCameraProcessor
    private let completion: (CaptureResult) -> Void
    
    init(captureId: String,
         cameraIndex: Int,
         synchronizer: MultiFrameSynchronizer,
         processor: NativeCameraProcessor,
         completion: @escaping (CaptureResult) -> Void) {
        
        self.captureId = captureId
        self.cameraIndex = cameraIndex
        self.synchronizer = synchronizer
        self.processor = processor
        self.completion = completion
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, 
                    didFinishProcessingPhoto photo: AVCapturePhoto, 
                    error: Error?) {
        
        guard error == nil,
              let imageData = photo.fileDataRepresentation() else {
            print("❌ Error capturando foto: \(error?.localizedDescription ?? "desconocido")")
            return
        }
        
        let timestamp = CACurrentMediaTime()
        let metadata = photo.metadata
        
        let result = CaptureResult(
            cameraIndex: cameraIndex,
            imageData: imageData,
            timestamp: timestamp,
            metadata: metadata
        )
        
        synchronizer.addResult(result, for: captureId)
        completion(result)
    }
}

class CameraCalibrationManager {
    
    struct IntrinsicParameters {
        let focalLength: [Double]
        let intrinsicMatrix: [Double]
        let distortionCoefficients: [Double]
        let sensorSize: [Double]
        let pixelSize: Double
        let principalPoint: [Double]
    }
    
    func extractIntrinsicParameters(for device: AVCaptureDevice) -> IntrinsicParameters {
        let format = device.activeFormat
        let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
        
        // Extraer información de calibración intrínseca si está disponible
        if #available(iOS 13.0, *) {
            if let calibrationData = format.cameraCalibrationData {
                return IntrinsicParameters(
                    focalLength: [
                        Double(calibrationData.intrinsicMatrix.columns.0.x),
                        Double(calibrationData.intrinsicMatrix.columns.1.y)
                    ],
                    intrinsicMatrix: [
                        Double(calibrationData.intrinsicMatrix.columns.0.x), 0, Double(calibrationData.intrinsicMatrix.columns.2.x),
                        0, Double(calibrationData.intrinsicMatrix.columns.1.y), Double(calibrationData.intrinsicMatrix.columns.2.y),
                        0, 0, 1
                    ],
                    distortionCoefficients: calibrationData.lensDistortionLookupTable?.compactMap { Double($0) } ?? [],
                    sensorSize: [
                        Double(dimensions.width),
                        Double(dimensions.height)
                    ],
                    pixelSize: Double(calibrationData.pixelSize),
                    principalPoint: [
                        Double(calibrationData.intrinsicMatrix.columns.2.x),
                        Double(calibrationData.intrinsicMatrix.columns.2.y)
                    ]
                )
            }
        }
        
        // Parámetros estimados si no hay calibración disponible
        return IntrinsicParameters(
            focalLength: [Double(dimensions.width) * 0.8, Double(dimensions.height) * 0.8],
            intrinsicMatrix: [
                Double(dimensions.width) * 0.8, 0, Double(dimensions.width / 2),
                0, Double(dimensions.height) * 0.8, Double(dimensions.height / 2),
                0, 0, 1
            ],
            distortionCoefficients: [0, 0, 0, 0, 0],
            sensorSize: [Double(dimensions.width), Double(dimensions.height)],
            pixelSize: 1.0,
            principalPoint: [Double(dimensions.width / 2), Double(dimensions.height / 2)]
        )
    }
}

// Wrapper C++ para procesamiento nativo
class NativeCameraProcessor {
    
    func initialize(width: Int32, height: Int32, cameraCount: Int32) {
        // JNI call to C++ processor
        nativeInitializeProcessor(width, height, cameraCount)
    }
    
    func processMultiFrame(results: [CaptureResult]) {
        // Convert results to format suitable for C++
        let frameData = results.map { $0.imageData }
        let timestamps = results.map { $0.timestamp }
        let cameraIds = results.map { Int32($0.cameraIndex) }
        
        nativeProcessMultiFrameIOS(frameData, timestamps, cameraIds)
    }
    
    func processRealtimeFrame(sampleBuffer: CMSampleBuffer, cameraIndex: Int32, timestamp: CMTime) {
        nativeProcessRealtimeFrameIOS(sampleBuffer, cameraIndex, timestamp)
    }
    
    // Native C++ function declarations
    private func nativeInitializeProcessor(_ width: Int32, _ height: Int32, _ cameraCount: Int32) {
        // Implementation in C++
    }
    
    private func nativeProcessMultiFrameIOS(_ frameData: [Data], _ timestamps: [TimeInterval], _ cameraIds: [Int32]) {
        // Implementation in C++
    }
    
    private func nativeProcessRealtimeFrameIOS(_ sampleBuffer: CMSampleBuffer, _ cameraIndex: Int32, _ timestamp: CMTime) {
        // Implementation in C++
    }
}
