package in.roadsaathi.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Real Android sensor readings, foreground only, 50 Hz. No synthetic fallback. */
@CapacitorPlugin(name = "RoadMotion")
public class RoadMotionPlugin extends Plugin implements SensorEventListener {
  private SensorManager manager;
  private boolean running;
  private boolean linear;

  @Override
  public void load() {
    manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
  }

  @PluginMethod
  public void start(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              if (running) {
                call.resolve();
                return;
              }
              if (manager == null) {
                call.reject("Motion sensing is unavailable on this device");
                return;
              }
              Sensor sensor = manager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
              linear = sensor != null;
              if (sensor == null) sensor = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
              if (sensor == null || !manager.registerListener(this, sensor, 20_000)) {
                call.reject("No supported accelerometer is available");
                return;
              }
              running = true;
              getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
              call.resolve();
            });
  }

  @PluginMethod
  public void stop(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              stopSensors();
              call.resolve();
            });
  }

  private void stopSensors() {
    if (manager != null) manager.unregisterListener(this);
    running = false;
    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  }

  @Override
  protected void handleOnPause() {
    if (running) notifyListeners("paused", new JSObject(), true);
    stopSensors();
  }

  @Override
  protected void handleOnDestroy() {
    stopSensors();
  }

  @Override
  public void onSensorChanged(SensorEvent event) {
    if (!running) return;
    JSObject vector =
        new JSObject()
            .put("x", (double) event.values[0])
            .put("y", (double) event.values[1])
            .put("z", (double) event.values[2]);
    JSObject reading = new JSObject();
    reading.put(linear ? "acceleration" : "accelerationIncludingGravity", vector);
    reading.put("timestamp", System.currentTimeMillis());
    notifyListeners("accel", reading);
  }

  @Override
  public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
