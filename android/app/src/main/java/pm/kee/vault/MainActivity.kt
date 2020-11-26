package pm.kee.vault

import android.app.Activity
import android.app.AlertDialog
import android.app.KeyguardManager
import android.content.Context
import android.content.DialogInterface
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.security.keystore.UserNotAuthenticatedException
import android.view.View
import com.getcapacitor.BridgeActivity
import com.getcapacitor.Plugin
import pm.kee.vault.capacitor.NativeCache
import pm.kee.vault.capacitor.NativeConfig
import pm.kee.vault.util.Util.logd
import pm.kee.vault.util.Util.loge
import java.util.*


//import com.getcapacitor.PluginHandle;
//import static pm.kee.vault.util.Util.loge;
class MainActivity : BridgeActivity() {

    private var pendingRunnable: Runnable? = null
    private var successRunnable: Runnable? = null
    private var failureRunnable: Runnable? = null

    public override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val kgManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (!kgManager.isKeyguardSecure) {
            //TODO: Find some way to notify the user that this is the reason the app does not start
            loge("Secure lock screen not enabled.")
            logd("Startup checks failed.")
            finish()
        }

        logd("Startup checks complete.")

        // Initializes the Bridge
        this.init(savedInstanceState, object : ArrayList<Class<out Plugin?>?>() {
            init {
                // Additional plugins you've installed go here
                // Ex: add(TotallyAwesomePlugin.class);
                add(NativeCache::class.java)
                add(NativeConfig::class.java)
            }
        })
        val webview = findViewById<View>(R.id.webview)
        webview.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS

//    loge("onCreate");
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onCreate' }");
    }

    public override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
//    loge("onNewIntent");
//    this.bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onNewIntent1' }");
        setIntent(intent)
        val autofill = intent.getBooleanExtra("autofill", false)
        bridge.triggerWindowJSEvent("capacitorConfigUpdated", "{ 'message': 'onNewIntent2-$autofill' }")
    } //
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

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == AUTHENTICATE_FOR_ENCRYPTION) {
            if (resultCode == Activity.RESULT_OK) {
                try {
                    pendingRunnable?.run()
                    successRunnable?.run()
                } catch (e: Exception){
                    failureRunnable?.run()
                }
            } else {
                failureRunnable?.run()
            }
            pendingRunnable = null
            failureRunnable = null
            successRunnable = null
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    companion object {
        const val AUTHENTICATE_FOR_ENCRYPTION = 23 //TODO: Why this number?
    }

    public fun safeExecuteWithKeystore(action: Runnable, onSuccess: Runnable?, onFailure: Runnable?) {
        try {
            action.run()
            onSuccess?.run()
        } catch (e: SecurityException) {
            if (e.cause is UserNotAuthenticatedException) {
                pendingRunnable = action
                successRunnable = onSuccess
                failureRunnable = onFailure
                showAuthenticationScreen(this, AUTHENTICATE_FOR_ENCRYPTION)
            } else {
                onFailure?.run()
            }
        } catch (e: Exception) {
            onFailure?.run()
        }
    }

    private fun showAuthenticationScreen(activity: Activity, requestCode: Int) {
        val mKeyguardManager = activity.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val intent: Intent? = mKeyguardManager.createConfirmDeviceCredentialIntent("Authorization required", "")
        activity.startActivityForResult(intent, requestCode)
    }
}
