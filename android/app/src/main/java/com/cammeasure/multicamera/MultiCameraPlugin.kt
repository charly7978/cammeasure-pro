package com.cammeasure.multicamera

import android.util.Log
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "MultiCamera")
class MultiCameraPlugin : Plugin() {
  private var impl: MultiCamera? = null

  override fun load() {
    impl = MultiCamera(context, activity)
  }

  @PluginMethod
  fun listCameras(call: PluginCall) {
    try {
      val data = impl?.listCameras() ?: emptyList()
      val ret = JSObject()
      ret.put("devices", JSArray(data))
      call.resolve(ret)
    } catch (e: Exception) {
      call.reject("listCameras error: ${e.message}")
    }
  }

  @PluginMethod
  fun startStereo(call: PluginCall) {
    val leftId = call.getString("leftId")
    val rightId = call.getString("rightId")
    val width = call.getInt("width") ?: 1280
    val height = call.getInt("height") ?: 720

    if (leftId == null || rightId == null) {
      call.reject("leftId y rightId son requeridos")
      return
    }
    try {
      impl?.startStereo(leftId, rightId, width, height) { left, right, w, h ->
        val payload = JSObject().apply {
          put("width", w)
          put("height", h)
          put("left", JSArray(left))
          put("right", JSArray(right))
        }
        notifyListeners("stereoFrame", payload, true)
      }
      call.resolve()
    } catch (e: Exception) {
      Log.e("MultiCamera", "startStereo error", e)
      call.reject("startStereo error: ${e.message}")
    }
  }

  @PluginMethod
  fun stop(call: PluginCall) {
    impl?.stop()
    call.resolve()
  }
}
