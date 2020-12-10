package pm.kee.vault.capacitor

import android.content.Context
import com.getcapacitor.*
import com.google.gson.Gson
import pm.kee.vault.MainActivity
import pm.kee.vault.data.AccessRestrictions
import pm.kee.vault.data.EncryptedDataStorage
import pm.kee.vault.data.source.local.ESPAutofillDataSource
import pm.kee.vault.model.vault.NativeAuthConfig
import pm.kee.vault.util.Util
import java.util.*

@NativePlugin
class NativeConfig : Plugin() {
    @PluginMethod
    operator fun get(call: PluginCall) {
        saveCall(call)
        val localAfDataSourceSharedPrefs = this.context.getSharedPreferences(ESPAutofillDataSource.SHARED_PREF_KEY, Context.MODE_PRIVATE)
        val storageAuth = EncryptedDataStorage("auth", AccessRestrictions(
            Date(Date().time),
            false,
            -1  //TODO: I think we can ignore all these values since it won't be used unless there is no secret data already stored? If so, refactor so this var is not required for reading
        ), localAfDataSourceSharedPrefs)

        val activity: MainActivity = getActivity() as MainActivity
        var authkey: String? = null
        activity.executeWithAuthenticationIfRequired(
            action = {

                    val json = storageAuth.getString()
                    var gson = Gson()
                    var model = gson.fromJson(json, NativeAuthConfig::class.java)
                authkey = model.secretKey

            },
            onSuccess = {

                sendResultToWebApp(activity, authkey, call)
            },
            onFailure = {
                Util.logw("Exception while retrieving auth key")
                sendResultToWebApp(activity, null, call)
            }
        )


    }

    private fun sendResultToWebApp(activity: MainActivity, authkey: String?, call: PluginCall) {
        val intent = activity.getIntent()
        val autofill = intent.getBooleanExtra("autofill", false)

        val ret = JSObject()
        ret.put("authkey", authkey)
        ret.put("autofill", autofill)
        call.resolve(ret) //TODO: probably this still refers to the old call instance, not the one that is loaded after the activity restarts
    }
}
