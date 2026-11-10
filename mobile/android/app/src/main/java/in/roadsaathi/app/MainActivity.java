package in.roadsaathi.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(RoadMotionPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
