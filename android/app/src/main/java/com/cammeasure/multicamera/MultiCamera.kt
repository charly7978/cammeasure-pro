package com.cammeasure.multicamera

import android.app.Activity
import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.view.Surface
import androidx.annotation.RequiresApi
import org.json.JSONObject
import java.nio.ByteBuffer

class MultiCamera(private val context: Context, private val activity: Activity) {
  private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
  private var leftDevice: CameraDevice? = null
  private var rightDevice: CameraDevice? = null
  private var leftSession: CameraCaptureSession? = null
  private var rightSession: CameraCaptureSession? = null
  private var leftReader: ImageReader? = null
  private var rightReader: ImageReader? = null
  private var bgThread: HandlerThread? = null
  private var bgHandler: Handler? = null
  private var frameCallback: ((left: List<Int>, right: List<Int>, w: Int, h: Int) -> Unit)? = null
  private var frameW = 0
  private var frameH = 0

  fun listCameras(): List<JSONObject> {
    val out = mutableListOf<JSONObject>()
    for (id in cameraManager.cameraIdList) {
      val char = cameraManager.getCameraCharacteristics(id)
      val facing = char.get(CameraCharacteristics.LENS_FACING)
      val isBack = facing == CameraCharacteristics.LENS_FACING_BACK
      val phys = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) char.physicalCameraIds else emptySet<String>()
      val o = JSONObject()
      o.put("id", id)
      o.put("isBack", isBack)
      o.put("physicalIds", phys)
      out.add(o)
    }
    return out
  }

  private fun startBg() {
    bgThread = HandlerThread("multiCamBg").also { it.start() }
    bgHandler = Handler(bgThread!!.looper)
  }

  @RequiresApi(Build.VERSION_CODES.P)
  fun startStereo(leftId: String, rightId: String, width: Int, height: Int,
                  onFrame: (List<Int>, List<Int>, Int, Int) -> Unit) {
    stop()
    startBg()
    frameCallback = onFrame
    frameW = width
    frameH = height

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val concurrentSets = cameraManager.concurrentCameraIds
      val supported = concurrentSets.any { it.contains(leftId) && it.contains(rightId) }
      if (!supported) {
        throw RuntimeException("Este dispositivo no soporta cámaras concurrentes para $leftId y $rightId")
      }
    }

    leftReader = ImageReader.newInstance(width, height, ImageFormat.YUV_420_888, 2)
    rightReader = ImageReader.newInstance(width, height, ImageFormat.YUV_420_888, 2)

    leftReader!!.setOnImageAvailableListener({ reader ->
      val img = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
      val rgba = yuvToRgba(img.planes, frameW, frameH)
      img.close()
      val rightImg = rightReader?.acquireLatestImage()
      if (rightImg != null) {
        val rgbaR = yuvToRgba(rightImg.planes, frameW, frameH)
        rightImg.close()
        frameCallback?.invoke(rgba, rgbaR, frameW, frameH)
      }
    }, bgHandler)

    rightReader!!.setOnImageAvailableListener({ }, bgHandler)

    openDevice(leftId) { dev ->
      leftDevice = dev
      openDevice(rightId) { devR ->
        rightDevice = devR
        createSession(leftDevice!!, leftReader!!.surface) { sessionL ->
          leftSession = sessionL
          createSession(rightDevice!!, rightReader!!.surface) { sessionR ->
            rightSession = sessionR
            startRepeating(leftSession!!, leftReader!!.surface)
            startRepeating(rightSession!!, rightReader!!.surface)
          }
        }
      }
    }
  }

  fun stop() {
    leftSession?.close(); leftSession = null
    rightSession?.close(); rightSession = null
    leftDevice?.close(); leftDevice = null
    rightDevice?.close(); rightDevice = null
    leftReader?.close(); leftReader = null
    rightReader?.close(); rightReader = null
    bgThread?.quitSafely(); bgThread = null; bgHandler = null
  }

  private fun openDevice(id: String, onOpened: (CameraDevice) -> Unit) {
    cameraManager.openCamera(id, object : CameraDevice.StateCallback() {
      override fun onOpened(camera: CameraDevice) { onOpened(camera) }
      override fun onDisconnected(camera: CameraDevice) { camera.close() }
      override fun onError(camera: CameraDevice, error: Int) { camera.close() }
    }, bgHandler)
  }

  private fun createSession(device: CameraDevice, surface: Surface, onReady: (CameraCaptureSession) -> Unit) {
    device.createCaptureSession(listOf(surface), object: CameraCaptureSession.StateCallback() {
      override fun onConfigured(session: CameraCaptureSession) { onReady(session) }
      override fun onConfigureFailed(session: CameraCaptureSession) {}
    }, bgHandler)
  }

  private fun startRepeating(session: CameraCaptureSession, surface: Surface) {
    val builder = session.device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
      addTarget(surface)
    }
    session.setRepeatingRequest(builder.build(), null, bgHandler)
  }

  private fun yuvToRgba(planes: Array<ImageReader.ImagePlane>, w: Int, h: Int): List<Int> {
    val yBuf: ByteBuffer = planes[0].buffer
    val y = ByteArray(yBuf.remaining())
    yBuf.get(y)
    val out = IntArray(w * h * 4)
    for (i in 0 until (w * h)) {
      val g = (y[i].toInt() and 0xFF)
      out[i * 4] = g
      out[i * 4 + 1] = g
      out[i * 4] = g
      out[i * 4 + 3] = 255
    }
    return out.toList()
  }
}
