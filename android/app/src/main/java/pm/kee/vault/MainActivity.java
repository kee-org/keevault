package pm.kee.vault;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
//import com.getcapacitor.PluginHandle;

import java.util.ArrayList;

import pm.kee.vault.capacitor.NativeCache;
import pm.kee.vault.capacitor.NativeConfig;

//import static pm.kee.vault.util.Util.loge;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Initializes the Bridge
    this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
      // Additional plugins you've installed go here
      // Ex: add(TotallyAwesomePlugin.class);
      add(NativeCache.class);
      add(NativeConfig.class);
    }});
    View webview = findViewById(R.id.webview);
    webview.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);

//    loge("onCreate");
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onCreate' }");
  }

  @Override
  public void onNewIntent(Intent intent) {
//    loge("onNewIntent");
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onNewIntent1' }");
    setIntent(intent);
    boolean autofill = intent.getBooleanExtra("autofill", false);
    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onNewIntent2-" + autofill + "' }");
  }
//
//  @Override
//  public void onStart() {
//    loge("onStart");
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onStart1' }");
//    super.onStart();
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onStart2' }");
//  }
//
//  @Override
//  public void onRestart() {
//    loge("onRestart");
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onRestart1' }");
//    super.onRestart();
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onRestart2' }");
//  }
//
//  @Override
//  public void onResume() {
//    loge("onResume");
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onResume1' }");
//    super.onResume();
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onResume2' }");
//  }

//  public NativeCachePlugin getPlugin() {
//    PluginHandle handle = this.bridge.getPlugin("NativeCachePlugin");
//    if (handle == null) {
//      return null;
//    }
//    NativeCachePlugin myPlugin = (NativeCachePlugin) handle.getInstance();
//    return myPlugin;
//  }
}
