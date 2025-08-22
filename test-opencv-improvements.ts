/**
 * SCRIPT DE PRUEBA PARA VERIFICAR LAS MEJORAS DE OPENCV
 */

import { openCVSystem } from './src/lib/opencv';

// Función de prueba para crear una imagen sintética con un objeto grande central
function createTestImage(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Fondo blanco
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // Objeto grande central (círculo)
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.3;
  
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Agregar algunos detalles para hacer más interesante la detección
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(centerX - radius/3, centerY - radius/3, radius/5, 0, 2 * Math.PI);
  ctx.fill();
  
  return ctx.getImageData(0, 0, width, height);
}

// Función principal de prueba
async function testOpenCVImprovements() {
  console.log('🚀 INICIANDO PRUEBA DE MEJORAS DE OPENCV...\n');
  
  try {
    // Inicializar el sistema
    await openCVSystem.initialize();
    console.log('✅ Sistema OpenCV inicializado\n');
    
    // Crear imagen de prueba
    const testImage = createTestImage(640, 480);
    console.log('📷 Imagen de prueba creada: 640x480\n');
    
    // Probar detección sin calibración
    console.log('🔍 Probando detección sin calibración...');
    const result1 = await openCVSystem.detectObjectSilhouettes(testImage, null);
    console.log(`Resultado sin calibración:`);
    console.log(`  - Objetos detectados: ${result1.objects.length}`);
    console.log(`  - Tiempo de procesamiento: ${result1.processingTime.toFixed(1)}ms`);
    console.log(`  - Píxeles de borde: ${result1.edgePixels}`);
    console.log(`  - Contornos encontrados: ${result1.contours.length}\n`);
    
    if (result1.objects.length > 0) {
      const obj = result1.objects[0];
      console.log(`📊 Objeto principal detectado:`);
      console.log(`  - Posición: (${obj.x.toFixed(0)}, ${obj.y.toFixed(0)})`);
      console.log(`  - Tamaño: ${obj.width}x${obj.height} px`);
      console.log(`  - Área: ${obj.area.toFixed(0)} px²`);
      console.log(`  - Confianza: ${(obj.confidence * 100).toFixed(1)}%`);
      console.log(`  - Puntos de contorno: ${obj.contourPoints || 0}`);
      console.log(`  - Solidez: ${((obj.solidity || 0) * 100).toFixed(1)}%`);
      console.log(`  - Circularidad: ${((obj.circularity || 0) * 100).toFixed(1)}%\n`);
    }
    
    // Probar con calibración
    console.log('🔍 Probando detección con calibración...');
    const calibrationData = {
      pixelsPerMm: 2.5, // 2.5 píxeles por milímetro
      isCalibrated: true
    };
    
    const result2 = await openCVSystem.detectObjectSilhouettes(testImage, calibrationData);
    console.log(`Resultado con calibración:`);
    console.log(`  - Objetos detectados: ${result2.objects.length}`);
    console.log(`  - Tiempo de procesamiento: ${result2.processingTime.toFixed(1)}ms\n`);
    
    if (result2.objects.length > 0) {
      const obj = result2.objects[0];
      console.log(`📏 Medidas calibradas del objeto:`);
      console.log(`  - Ancho: ${obj.dimensions.width.toFixed(1)} ${obj.dimensions.unit}`);
      console.log(`  - Alto: ${obj.dimensions.height.toFixed(1)} ${obj.dimensions.unit}`);
      console.log(`  - Área: ${obj.dimensions.area.toFixed(0)} ${obj.dimensions.unit}²`);
      console.log(`  - Perímetro: ${obj.dimensions.perimeter?.toFixed(1) || 'N/A'} ${obj.dimensions.unit}\n`);
      
      if (obj.depth3D) {
        console.log(`🎯 Información 3D:`);
        console.log(`  - Distancia: ${obj.depth3D.distance.toFixed(0)} mm`);
        console.log(`  - Profundidad: ${obj.depth3D.depth.toFixed(1)} mm`);
        console.log(`  - Volumen: ${(obj.depth3D.volume / 1000).toFixed(1)} cm³`);
        console.log(`  - Método: ${obj.depth3D.method}`);
        console.log(`  - Confianza 3D: ${(obj.depth3D.confidence * 100).toFixed(0)}%\n`);
      }
    }
    
    // Verificar estadísticas del sistema
    const stats = openCVSystem.getSystemStats();
    console.log('📊 Estadísticas del sistema:');
    console.log(`  - Inicializado: ${stats.isInitialized}`);
    console.log(`  - Versión: ${stats.version}`);
    console.log(`  - Componentes: ${stats.components.join(', ')}\n`);
    
    console.log('✅ PRUEBA COMPLETADA EXITOSAMENTE');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

// Ejecutar prueba si este archivo se ejecuta directamente
if (typeof window === 'undefined') {
  testOpenCVImprovements();
}

export { testOpenCVImprovements };
