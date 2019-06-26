package pm.kee.vault.capacitor

import android.content.Context

import com.getcapacitor.NativePlugin
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.google.gson.Gson
import pm.kee.vault.data.AccessRestrictions

import pm.kee.vault.data.EncryptedDataStorage
import pm.kee.vault.data.source.local.ESPAutofillDataSource
import pm.kee.vault.model.vault.KeeVaultState

import pm.kee.vault.util.Util.logw
import java.util.*

@NativePlugin
class NativeCache : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        val id = call.getString("id")
        val message = call.data
        logw(message.toString())
        var gson = Gson()
        val json = message.toString()
        var model = gson.fromJson(json, KeeVaultState::class.java)

        model ?: throw SecurityException()

        val localAfDataSourceSharedPrefs = this.context.getSharedPreferences(ESPAutofillDataSource.SHARED_PREF_KEY, Context.MODE_PRIVATE)
        val storageState = EncryptedDataStorage("cache", AccessRestrictions(
                Date(Date().time + model.config.cache.expiry * 1000),
                model.config.cache.authPresenceLimit >= 1,
                model.config.cache.authPresenceLimit
        ), localAfDataSourceSharedPrefs)
        storageState.setString(id, gson.toJson(model.vault))
        val storageAuth = EncryptedDataStorage("auth", AccessRestrictions(
                Date(Date().time + model.config.auth.interactiveExpiry * 1000),
                true,
                -1
        ), localAfDataSourceSharedPrefs)
        storageAuth.setString(id, gson.toJson(model.config.auth))
        call.resolve()
    }

}
