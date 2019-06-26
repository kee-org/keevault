package pm.kee.vault.capacitor;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.NativePlugin;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;

import pm.kee.vault.data.EncryptedDataStorage;
import pm.kee.vault.data.source.local.ESPAutofillDataSource;

import static pm.kee.vault.util.Util.logw;

@NativePlugin()
public class NativeConfig extends Plugin {

    @PluginMethod()
    public void get(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("added", true);
        JSObject info = new JSObject();
        info.put("id", "unique-id-1234");
        ret.put("info", info);
        call.resolve(ret);
    }
}
