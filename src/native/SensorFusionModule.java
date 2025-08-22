
/**
 * SensorFusionModule para Android - Fusión avanzada de sensores
 * Implementa acceso completo al SensorManager y fusión matemática exacta
 * 
 * PROHIBIDA la simulación - Solo mediciones reales de hardware físico
 */
package com.cammeasurepro.sensorfusion;

// Corregido: Importaciones necesarias para sensores en Android
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class SensorFusionModule extends ReactContextBaseJavaModule implements SensorEventListener, LocationListener {
    
    private static final String MODULE_NAME = "SensorFusionModule";
    
    // Managers de sensores y ubicación
    private SensorManager sensorManager;
    private LocationManager locationManager;
    private ReactApplicationContext reactContext;
    
    // Sensores físicos disponibles
    private Sensor accelerometer;
    private Sensor gyroscope;
    private Sensor magnetometer;
    private Sensor barometer;
    private Sensor ambientTemperature;
    private Sensor relativeHumidity;
    private Sensor ambientLight;
    private Sensor proximity;
    private Sensor linearAcceleration;
    private Sensor rotationVector;
    private Sensor gravity;
    
    // Datos de sensores sincronizados
    private ConcurrentHashMap<String, SensorData> latestSensorData;
    private ConcurrentHashMap<String, Long> sensorTimestamps;
    
    // Sincronización temporal exacta
    private ScheduledExecutorService syncExecutor;
    private boolean isCollecting;
    private long collectionStartTime;
    
    // Native bridge para procesamiento en C++
    static {
        System.loadLibrary("sensorfusion");
    }
    
    // Declaraciones JNI para algoritmos de fusión avanzados
    private native void nativeInitializeFusion(int sensorCount);
    private native void nativeProcessSensorData(float[] accelData, float[] gyroData, 
                                               float[] magData, float[] baroData, 
                                               double[] gpsData, long timestamp);
    private native float[] nativeGetFusedOrientation();
    private native float[] nativeGetFusedPosition();
    private native void nativeCleanupFusion();

    public SensorFusionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.sensorManager = (SensorManager) reactContext.getSystemService(Context.SENSOR_SERVICE);
        this.locationManager = (LocationManager) reactContext.getSystemService(Context.LOCATION_SERVICE);
        this.latestSensorData = new ConcurrentHashMap<>();
        this.sensorTimestamps = new ConcurrentHashMap<>();
        this.syncExecutor = Executors.newSingleThreadScheduledExecutor();
        this.isCollecting = false;
        
        initializeSensors();
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Inicialización completa de todos los sensores disponibles
     * Detecta automáticamente capacidades del hardware
     */
    private void initializeSensors() {
        // Sensores de movimiento (IMU)
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
        magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        linearAcceleration = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
        rotationVector = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        gravity = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY);
        
        // Sensores ambientales
        barometer = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE);
        ambientTemperature = sensorManager.getDefaultSensor(Sensor.TYPE_AMBIENT_TEMPERATURE);
        relativeHumidity = sensorManager.getDefaultSensor(Sensor.TYPE_RELATIVE_HUMIDITY);
        ambientLight = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT);
        proximity = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY);
        
        // Contar sensores disponibles
        int availableSensorCount = 0;
        List<Sensor> sensorList = sensorManager.getSensorList(Sensor.TYPE_ALL);
        
        System.out.println("📱 Sensores disponibles en dispositivo:");
        for (Sensor sensor : sensorList) {
            System.out.println("   - " + sensor.getName() + " (Tipo: " + sensor.getType() + ")");
            availableSensorCount++;
        }
        
        // Inicializar procesador nativo
        nativeInitializeFusion(availableSensorCount);
        
        System.out.println("🔧 SensorFusionModule inicializado con " + availableSensorCount + " sensores");
    }

    /**
     * Iniciar recolección simultánea de todos los sensores
     * Implementa sincronización temporal de alta precisión
     */
    @ReactMethod
    public void startSensorCollection(ReadableMap config, Promise promise) {
        try {
            if (isCollecting) {
                promise.reject("ALREADY_COLLECTING", "La recolección ya está activa");
                return;
            }
            
            // Configurar frecuencia de muestreo según especificaciones
            int samplingRate = config.hasKey("samplingRate") ? 
                config.getInt("samplingRate") : SensorManager.SENSOR_DELAY_FASTEST;
            
            boolean includeGPS = config.hasKey("includeGPS") ? config.getBoolean("includeGPS") : true;
            boolean includeEnvironmental = config.hasKey("includeEnvironmental") ? 
                config.getBoolean("includeEnvironmental") : true;
            
            collectionStartTime = System.nanoTime();
            
            // Registrar sensores de movimiento (críticos para medición)
            if (accelerometer != null) {
                sensorManager.registerListener(this, accelerometer, samplingRate);
            }
            if (gyroscope != null) {
                sensorManager.registerListener(this, gyroscope, samplingRate);
            }
            if (magnetometer != null) {
                sensorManager.registerListener(this, magnetometer, samplingRate);
            }
            if (linearAcceleration != null) {
                sensorManager.registerListener(this, linearAcceleration, samplingRate);
            }
            if (rotationVector != null) {
                sensorManager.registerListener(this, rotationVector, samplingRate);
            }
            if (gravity != null) {
                sensorManager.registerListener(this, gravity, samplingRate);
            }
            
            // Registrar sensores ambientales si están habilitados
            if (includeEnvironmental) {
                if (barometer != null) {
                    sensorManager.registerListener(this, barometer, samplingRate);
                }
                if (ambientTemperature != null) {
                    sensorManager.registerListener(this, ambientTemperature, samplingRate);
                }
                if (relativeHumidity != null) {
                    sensorManager.registerListener(this, relativeHumidity, samplingRate);
                }
                if (ambientLight != null) {
                    sensorManager.registerListener(this, ambientLight, samplingRate);
                }
                if (proximity != null) {
                    sensorManager.registerListener(this, proximity, samplingRate);
                }
            }
            
            // Activar GPS si está habilitado y disponible
            if (includeGPS && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                try {
                    locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER, 
                        100, // 100ms
                        0.1f, // 0.1 metro
                        this
                    );
                    
                    // También usar proveedor de red si está disponible
                    if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                        locationManager.requestLocationUpdates(
                            LocationManager.NETWORK_PROVIDER,
                            500, // 500ms
                            1.0f, // 1 metro
                            this
                        );
                    }
                    
                } catch (SecurityException e) {
                    System.err.println("⚠️ Sin permisos de ubicación: " + e.getMessage());
                }
            }
            
            // Iniciar sincronización temporal periódica
            syncExecutor.scheduleAtFixedRate(this::synchronizeAndFuseSensorData, 0, 10, TimeUnit.MILLISECONDS);
            
            isCollecting = true;
            
            WritableMap result = Arguments.createMap();
            result.putString("status", "started");
            result.putDouble("startTime", collectionStartTime / 1e9);
            result.putInt("activeSensors", latestSensorData.size());
            
            promise.resolve(result);
            
            // Notificar inicio de recolección
            sendSensorEvent("SensorCollectionStarted", result);
            
        } catch (Exception e) {
            promise.reject("START_ERROR", "Error iniciando recolección: " + e.getMessage());
        }
    }

    /**
     * Detener recolección de sensores
     */
    @ReactMethod
    public void stopSensorCollection(Promise promise) {
        try {
            if (!isCollecting) {
                promise.reject("NOT_COLLECTING", "La recolección no está activa");
                return;
            }
            
            // Desregistrar todos los sensores
            sensorManager.unregisterListener(this);
            
            // Detener actualizaciones GPS
            locationManager.removeUpdates(this);
            
            // Detener sincronización
            syncExecutor.shutdown();
            syncExecutor = Executors.newSingleThreadScheduledExecutor();
            
            isCollecting = false;
            
            WritableMap result = Arguments.createMap();
            result.putString("status", "stopped");
            result.putDouble("duration", (System.nanoTime() - collectionStartTime) / 1e9);
            
            promise.resolve(result);
            
            sendSensorEvent("SensorCollectionStopped", result);
            
        } catch (Exception e) {
            promise.reject("STOP_ERROR", "Error deteniendo recolección: " + e.getMessage());
        }
    }

    /**
     * Obtener datos fusionados actuales
     */
    @ReactMethod
    public void getFusedSensorData(Promise promise) {
        try {
            WritableMap fusedData = Arguments.createMap();
            
            // Obtener orientación fusionada del procesador nativo
            float[] orientation = nativeGetFusedOrientation();
            if (orientation != null && orientation.length >= 3) {
                WritableMap orientationData = Arguments.createMap();
                orientationData.putDouble("roll", orientation[0]);
                orientationData.putDouble("pitch", orientation[1]);
                orientationData.putDouble("yaw", orientation[2]);
                fusedData.putMap("orientation", orientationData);
            }
            
            // Obtener posición fusionada
            float[] position = nativeGetFusedPosition();
            if (position != null && position.length >= 3) {
                WritableMap positionData = Arguments.createMap();
                positionData.putDouble("x", position[0]);
                positionData.putDouble("y", position[1]);
                positionData.putDouble("z", position[2]);
                fusedData.putMap("position", positionData);
            }
            
            // Agregar datos de sensores individuales
            WritableMap rawSensorData = Arguments.createMap();
            for (String sensorType : latestSensorData.keySet()) {
                SensorData data = latestSensorData.get(sensorType);
                Long timestamp = sensorTimestamps.get(sensorType);
                
                if (data != null && timestamp != null) {
                    WritableMap sensorInfo = Arguments.createMap();
                    sensorInfo.putArray("values", data.getValuesArray());
                    sensorInfo.putDouble("accuracy", data.accuracy);
                    sensorInfo.putDouble("timestamp", timestamp / 1e9);
                    rawSensorData.putMap(sensorType, sensorInfo);
                }
            }
            fusedData.putMap("rawSensors", rawSensorData);
            
            fusedData.putDouble("fusionTimestamp", System.nanoTime() / 1e9);
            fusedData.putBoolean("isCollecting", isCollecting);
            
            promise.resolve(fusedData);
            
        } catch (Exception e) {
            promise.reject("GET_DATA_ERROR", "Error obteniendo datos: " + e.getMessage());
        }
    }

    // Implementación de SensorEventListener
    
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!isCollecting) return;
        
        String sensorType = getSensorTypeName(event.sensor.getType());
        long timestamp = event.timestamp;
        
        // Crear objeto de datos del sensor
        SensorData sensorData = new SensorData(
            event.values.clone(),
            event.accuracy,
            event.sensor.getName()
        );
        
        // Almacenar datos con sincronización thread-safe
        latestSensorData.put(sensorType, sensorData);
        sensorTimestamps.put(sensorType, timestamp);
        
        // Emitir evento de actualización de sensor individual
        if (shouldEmitSensorUpdate(sensorType)) {
            WritableMap sensorUpdate = Arguments.createMap();
            sensorUpdate.putString("sensorType", sensorType);
            sensorUpdate.putArray("values", sensorData.getValuesArray());
            sensorUpdate.putDouble("accuracy", sensorData.accuracy);
            sensorUpdate.putDouble("timestamp", timestamp / 1e9);
            
            sendSensorEvent("SensorDataUpdate", sensorUpdate);
        }
    }
    
    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        String sensorType = getSensorTypeName(sensor.getType());
        
        WritableMap accuracyUpdate = Arguments.createMap();
        accuracyUpdate.putString("sensorType", sensorType);
        accuracyUpdate.putInt("accuracy", accuracy);
        accuracyUpdate.putString("accuracyDescription", getAccuracyDescription(accuracy));
        
        sendSensorEvent("SensorAccuracyChanged", accuracyUpdate);
    }

    // Implementación de LocationListener
    
    @Override
    public void onLocationChanged(Location location) {
        if (!isCollecting) return;
        
        // Crear datos de GPS de alta precisión
        double[] gpsData = new double[] {
            location.getLatitude(),
            location.getLongitude(),
            location.getAltitude(),
            location.getAccuracy(),
            location.getSpeed(),
            location.getBearing(),
            location.getTime()
        };
        
        // Almacenar datos GPS
        SensorData gpsDataObj = new SensorData(
            new float[] {
                (float) location.getLatitude(),
                (float) location.getLongitude(), 
                (float) location.getAltitude()
            },
            (int) location.getAccuracy(),
            "GPS"
        );
        
        latestSensorData.put("GPS", gpsDataObj);
        sensorTimestamps.put("GPS", System.nanoTime());
        
        // Procesar en algoritmo de fusión nativo
        float[] accelData = getLatestSensorValues("ACCELEROMETER");
        float[] gyroData = getLatestSensorValues("GYROSCOPE");
        float[] magData = getLatestSensorValues("MAGNETOMETER");
        float[] baroData = getLatestSensorValues("PRESSURE");
        
        nativeProcessSensorData(accelData, gyroData, magData, baroData, gpsData, System.nanoTime());
        
        // Emitir evento GPS
        WritableMap gpsUpdate = Arguments.createMap();
        gpsUpdate.putDouble("latitude", location.getLatitude());
        gpsUpdate.putDouble("longitude", location.getLongitude());
        gpsUpdate.putDouble("altitude", location.getAltitude());
        gpsUpdate.putDouble("accuracy", location.getAccuracy());
        gpsUpdate.putDouble("speed", location.getSpeed());
        gpsUpdate.putDouble("bearing", location.getBearing());
        gpsUpdate.putString("provider", location.getProvider());
        
        sendSensorEvent("GPSLocationUpdate", gpsUpdate);
    }
    
    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        WritableMap statusUpdate = Arguments.createMap();
        statusUpdate.putString("provider", provider);
        statusUpdate.putInt("status", status);
        sendSensorEvent("LocationProviderStatusChanged", statusUpdate);
    }
    
    @Override
    public void onProviderEnabled(String provider) {
        WritableMap providerUpdate = Arguments.createMap();
        providerUpdate.putString("provider", provider);
        providerUpdate.putString("status", "enabled");
        sendSensorEvent("LocationProviderEnabled", providerUpdate);
    }
    
    @Override
    public void onProviderDisabled(String provider) {
        WritableMap providerUpdate = Arguments.createMap();
        providerUpdate.putString("provider", provider);
        providerUpdate.putString("status", "disabled");
        sendSensorEvent("LocationProviderDisabled", providerUpdate);
    }

    // Métodos auxiliares
    
    /**
     * Sincronización y fusión periódica de datos de sensores
     */
    private void synchronizeAndFuseSensorData() {
        if (!isCollecting || latestSensorData.isEmpty()) return;
        
        try {
            // Obtener datos más recientes de sensores críticos
            float[] accelData = getLatestSensorValues("ACCELEROMETER");
            float[] gyroData = getLatestSensorValues("GYROSCOPE");
            float[] magData = getLatestSensorValues("MAGNETOMETER");
            float[] baroData = getLatestSensorValues("PRESSURE");
            
            // Datos GPS (si están disponibles)
            double[] gpsData = getLatestGPSData();
            
            long currentTimestamp = System.nanoTime();
            
            // Procesar en algoritmo de fusión nativo (C++)
            nativeProcessSensorData(accelData, gyroData, magData, baroData, gpsData, currentTimestamp);
            
            // Emitir evento de datos fusionados cada cierto tiempo (reducir spam)
            if (currentTimestamp % 100_000_000 == 0) { // Cada 100ms
                WritableMap fusionUpdate = Arguments.createMap();
                fusionUpdate.putDouble("timestamp", currentTimestamp / 1e9);
                fusionUpdate.putInt("activeSensors", latestSensorData.size());
                
                sendSensorEvent("SensorFusionUpdate", fusionUpdate);
            }
            
        } catch (Exception e) {
            System.err.println("❌ Error en sincronización de sensores: " + e.getMessage());
        }
    }
    
    private String getSensorTypeName(int sensorType) {
        switch (sensorType) {
            case Sensor.TYPE_ACCELEROMETER: return "ACCELEROMETER";
            case Sensor.TYPE_GYROSCOPE: return "GYROSCOPE";
            case Sensor.TYPE_MAGNETIC_FIELD: return "MAGNETOMETER";
            case Sensor.TYPE_PRESSURE: return "PRESSURE";
            case Sensor.TYPE_AMBIENT_TEMPERATURE: return "AMBIENT_TEMPERATURE";
            case Sensor.TYPE_RELATIVE_HUMIDITY: return "RELATIVE_HUMIDITY";
            case Sensor.TYPE_LIGHT: return "AMBIENT_LIGHT";
            case Sensor.TYPE_PROXIMITY: return "PROXIMITY";
            case Sensor.TYPE_LINEAR_ACCELERATION: return "LINEAR_ACCELERATION";
            case Sensor.TYPE_ROTATION_VECTOR: return "ROTATION_VECTOR";
            case Sensor.TYPE_GRAVITY: return "GRAVITY";
            default: return "UNKNOWN_" + sensorType;
        }
    }
    
    private String getAccuracyDescription(int accuracy) {
        switch (accuracy) {
            case SensorManager.SENSOR_STATUS_NO_CONTACT: return "NO_CONTACT";
            case SensorManager.SENSOR_STATUS_UNRELIABLE: return "UNRELIABLE";
            case SensorManager.SENSOR_STATUS_ACCURACY_LOW: return "LOW";
            case SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM: return "MEDIUM";
            case SensorManager.SENSOR_STATUS_ACCURACY_HIGH: return "HIGH";
            default: return "UNKNOWN";
        }
    }
    
    private boolean shouldEmitSensorUpdate(String sensorType) {
        // Filtrar eventos para evitar spam (emitir solo sensores críticos con frecuencia)
        switch (sensorType) {
            case "ACCELEROMETER":
            case "GYROSCOPE":
            case "MAGNETOMETER":
                return true;
            default:
                return false;
        }
    }
    
    private float[] getLatestSensorValues(String sensorType) {
        SensorData data = latestSensorData.get(sensorType);
        return data != null ? data.values : new float[]{0, 0, 0};
    }
    
    private double[] getLatestGPSData() {
        SensorData gpsData = latestSensorData.get("GPS");
        if (gpsData == null || gpsData.values.length < 3) {
            return new double[]{0, 0, 0, 0, 0, 0, 0};
        }
        
        return new double[] {
            gpsData.values[0], // latitude
            gpsData.values[1], // longitude
            gpsData.values[2], // altitude
            gpsData.accuracy,  // accuracy
            0, // speed (no disponible en datos almacenados)
            0, // bearing (no disponible en datos almacenados)
            System.currentTimeMillis() // timestamp
        };
    }
    
    private void sendSensorEvent(String eventName, WritableMap data) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, data);
    }
    
    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        
        // Limpiar recursos
        if (isCollecting) {
            sensorManager.unregisterListener(this);
            locationManager.removeUpdates(this);
        }
        
        syncExecutor.shutdown();
        nativeCleanupFusion();
        
        latestSensorData.clear();
        sensorTimestamps.clear();
    }
    
    // Clase auxiliar para datos de sensores
    private static class SensorData {
        public final float[] values;
        public final int accuracy;
        public final String sensorName;
        
        public SensorData(float[] values, int accuracy, String sensorName) {
            this.values = values;
            this.accuracy = accuracy;
            this.sensorName = sensorName;
        }
        
        public WritableArray getValuesArray() {
            WritableArray array = Arguments.createArray();
            for (float value : values) {
                array.pushDouble(value);
            }
            return array;
        }
    }
}
