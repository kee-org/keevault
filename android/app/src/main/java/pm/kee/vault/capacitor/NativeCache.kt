package pm.kee.vault.capacitor

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.getcapacitor.NativePlugin
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.google.gson.Gson
import pm.kee.vault.AuthHandler
import pm.kee.vault.MainActivity
import pm.kee.vault.data.AccessRestrictions
import pm.kee.vault.data.EncryptedDataStorage
import pm.kee.vault.data.source.local.ESPAutofillDataSource
import pm.kee.vault.model.vault.KeeVaultState
import pm.kee.vault.util.AppExecutors
import pm.kee.vault.util.Util.logw
import java.util.*

@NativePlugin
class NativeCache : Plugin() {

    private lateinit var mReplyIntent: Intent

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
        ), localAfDataSourceSharedPrefs) //TODO: Pass through some kind of Runnable which can be called when key has expired and thus trigger an activity to recreate it by user re-entering master password?
        storageState.setString(id, gson.toJson(model.vault))
        val storageAuth = EncryptedDataStorage("auth", AccessRestrictions(
            Date(Date().time + model.config.auth.interactiveExpiry * 1000),
            true,
            30  //TODO: is 30 seconds OK as a default? Could try -1 if we detect biometrics are valid at startup
        ), localAfDataSourceSharedPrefs)
        storageAuth.setString(id, gson.toJson(model.config.auth))
        //TODO:
        // check for intent.autofill flag. if true...

        val activity: MainActivity = getActivity() as MainActivity
        val intent = activity.getIntent()
        val autofill = intent.getBooleanExtra("autofill", false)
        if (autofill) {

            activity.executeWithAuthenticationIfRequired(
                action = {

                    // "complete" the AuthIntent.... somehow.
                    dotheactivitystuff(storageState, activity)
                },
                onSuccess = {
                    // modify the intent using setIntent once we're done (I think due to async this happens before we have finished and subsequently "Finished"
                    // the activity that this plugin runs in but needs to be verified before production use
                    intent.putExtra("autofill", false)
                    getActivity().intent = intent //TODO: is this line necessary or is the intent all done by reference anyway?
//TODO: probably this causes warning about failing to access dead WebView                    call.resolve()
                    call.resolve()
                },
                onFailure = null //TODO: At least log that something went wrong
            )
        } else {
                call.resolve()
            }
//        call.resolve()
    }

    fun dotheactivitystuff(storageState: EncryptedDataStorage, activity: Activity) {
        var mESPAutofillDataSource = ESPAutofillDataSource.getInstance(storageState,
            AppExecutors())
        AuthHandler().doIt(activity, mESPAutofillDataSource)

//        mReplyIntent = Intent()
//        mESPAutofillDataSource.getFieldTypeByAutofillHints(
//            object : DataCallback<HashMap<String?, FieldTypeWithHints?>?> {
//                fun onLoaded(fieldTypesByAutofillHint: HashMap<String?, FieldTypeWithHints?>) {
//                    val builder = ClientViewMetadataBuilder(clientParser,
//                        fieldTypesByAutofillHint)
//                    mClientViewMetadata = builder.buildClientViewMetadata()
//                    mDatasetAdapter = DatasetAdapter(clientParser)
//                    mResponseAdapter = ResponseAdapter(this@AuthActivity,
//                        mClientViewMetadata, mPackageName, mDatasetAdapter)
//                    if (forResponse) {
//                        fetchAllDatasetsAndSetIntent(fieldTypesByAutofillHint)
//                    } else {
//                        Util.loge("Fuck knows what this is supposed to do")
//                        //                    String datasetName = intent.getStringExtra(EXTRA_DATASET_NAME);
////                    fetchDatasetAndSetIntent(fieldTypesByAutofillHint, datasetName);
//                    }
//                }
//
//                override fun onDataNotAvailable(msg: String, vararg params: Any) {}
//            })
//
//
//
//        mESPAutofillDataSource.getAutofillDatasets(mClientViewMetadata,
//            object : DataCallback<List<DatasetWithFilledAutofillFields?>?> {
//                fun onLoaded(datasets: List<DatasetWithFilledAutofillFields?>) {
//                    val response: FillResponse = mResponseAdapter.buildResponse(
//                        fieldTypesByAutofillHint, datasets, datasetAuth)
//                    callback.onSuccess(response)
//                }
//
//                override fun onDataNotAvailable(msg: String, vararg params: Any) {
//                    logw(msg, *params)
//                    callback.onSuccess(null)
//                }
//            })
    }

}
