/*
 * Copyright (C) 2017 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package pm.kee.vault;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import androidx.annotation.NonNull;

import android.widget.RemoteViews;

import java.util.Date;
import java.util.HashMap;
import java.util.List;

import pm.kee.vault.data.AccessRestrictions;
import pm.kee.vault.data.AutofillDataBuilder;
//import pm.kee.vault.data.ClientAutofillDataBuilder;
import pm.kee.vault.data.ClientViewMetadata;
import pm.kee.vault.data.ClientViewMetadataBuilder;
import pm.kee.vault.data.DataCallback;
import pm.kee.vault.data.EncryptedDataStorage;
import pm.kee.vault.data.adapter.DatasetAdapter;
import pm.kee.vault.data.adapter.ResponseAdapter;
import pm.kee.vault.data.source.PackageVerificationDataSource;
import pm.kee.vault.data.source.local.ESPAutofillDataSource;
import pm.kee.vault.data.source.local.DigitalAssetLinksRepository;
import pm.kee.vault.data.source.local.SharedPrefsPackageVerificationRepository;
import pm.kee.vault.model.DalCheck;
import pm.kee.vault.model.DalInfo;
import pm.kee.vault.model.DatasetWithFilledAutofillFields;
import pm.kee.vault.model.FieldTypeWithHints;
import pm.kee.vault.util.AppExecutors;
import pm.kee.vault.util.SecurityHelper;
import pm.kee.vault.util.Util;

import static android.content.Intent.FLAG_ACTIVITY_NEW_TASK;
import static java.util.stream.Collectors.toList;
import static pm.kee.vault.util.Util.bundleToString;
import static pm.kee.vault.util.Util.dumpStructure;
import static pm.kee.vault.util.Util.logVerboseEnabled;
import static pm.kee.vault.util.Util.logd;
import static pm.kee.vault.util.Util.loge;
import static pm.kee.vault.util.Util.logv;
import static pm.kee.vault.util.Util.logw;

public class MyAutofillService extends AutofillService {

    private ESPAutofillDataSource mESPAutofillDataSource;
    private DigitalAssetLinksRepository mDalRepository;
    private PackageVerificationDataSource mPackageVerificationRepository;
    private AutofillDataBuilder mAutofillDataBuilder;
    private ResponseAdapter mResponseAdapter;
    private ClientViewMetadata mClientViewMetadata;

    @Override
    public void onCreate() {
        super.onCreate();
        Util.setLoggingLevel(Util.LogLevel.Verbose);
        logd("onCreate()");
        mDalRepository = DigitalAssetLinksRepository.getInstance(getPackageManager());
        mPackageVerificationRepository = SharedPrefsPackageVerificationRepository.getInstance(this);
    }

    @Override
    public void onFillRequest(@NonNull FillRequest request,
                              @NonNull CancellationSignal cancellationSignal, @NonNull FillCallback callback) {

        // Note that callback.onFailure should NEVER be called until we remove support for Android P and
        // earlier. This is due to an unspecified bug documented at:
        // https://developer.android.com/reference/android/service/autofill/FillCallback.html#onFailure(java.lang.CharSequence)

        ApplicationInfo appInfo = getApplicationInfo();
        List<FillContext> fillContexts = request.getFillContexts();

        // No idea why the sample code tries to parse every structure - might be missing something relating to saving though?
//        List<AssistStructure> structures =
//                fillContexts.stream().map(FillContext::getStructure).collect(toList());

        AssistStructure latestStructure = fillContexts.get(fillContexts.size() - 1).getStructure();
        ClientParser parser = new ClientParser(latestStructure);
        String packageName = latestStructure.getActivityComponent().getPackageName();
        if (packageName.equals(appInfo.packageName)) {
            callback.onSuccess(null);
            return;
        }

        // Check user's settings for authenticating Responses and Datasets.
        //TODO: should depend upon whether capacitor link tells us user is already authenticated or not, as well as any settings in there such as using just a fingerprint?
        boolean responseAuth = false;
        boolean datasetAuth = false;
        boolean manual = (request.getFlags() & FillRequest.FLAG_MANUAL_REQUEST) != 0;
        mESPAutofillDataSource.getFieldTypeByAutofillHints(
                new DataCallback<HashMap<String, FieldTypeWithHints>>() {
                    @Override
                    public void onLoaded(HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint) {
                        DatasetAdapter datasetAdapter = new DatasetAdapter(parser);
                        ClientViewMetadataBuilder clientViewMetadataBuilder =
                                new ClientViewMetadataBuilder(parser, fieldTypesByAutofillHint);
                        mClientViewMetadata = clientViewMetadataBuilder.buildClientViewMetadata();
                        mResponseAdapter = new ResponseAdapter(MyAutofillService.this,
                                mClientViewMetadata, getPackageName(), datasetAdapter);
                        if (!mPackageVerificationRepository.putPackageSignatures(packageName)) {
                            logw(getString(R.string.invalid_package_signature));
                            callback.onSuccess(null);
                            return;
                        }
                        if (logVerboseEnabled()) {
                            logv("onFillRequest(): clientState=%s",
                                    bundleToString(request.getClientState()));
                            dumpStructure(latestStructure);
                        }
                        cancellationSignal.setOnCancelListener(() ->
                                logw("Cancel autofill not implemented in this sample.")
                        );
                        fetchDataAndGenerateResponse(fieldTypesByAutofillHint, responseAuth,
                                datasetAuth, manual, callback);
                    }

                    @Override
                    public void onDataNotAvailable(String msg, Object... params) {
                        loge("field type data not found");
                        callback.onSuccess(null);
                    }
                });
    }

    private void fetchDataAndGenerateResponse(
            HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint, boolean responseAuth,
            boolean datasetAuth, boolean manual, FillCallback callback) {
        if (responseAuth) {
            // If the entire Autofill Response is authenticated, AuthActivity is used
            // to generate Response.
            IntentSender sender = AuthActivity.getAuthIntentSenderForResponse(this);
            RemoteViews remoteViews = RemoteViewsHelper.viewsWithAuth(getPackageName(),
                    getString(R.string.autofill_sign_in_prompt));
            FillResponse response = mResponseAdapter.buildResponse(sender, remoteViews);
            if (response != null) {
                callback.onSuccess(response);
            }
        } else {
            try {
                mESPAutofillDataSource.getAutofillDatasets(mClientViewMetadata,
                        new DataCallback<List<DatasetWithFilledAutofillFields>>() {
                            @Override
                            public void onLoaded(List<DatasetWithFilledAutofillFields> datasets) {
                                if ((datasets == null || datasets.isEmpty()) && manual) {
                                    IntentSender sender = ManualActivity
                                            .getManualIntentSenderForResponse(MyAutofillService.this);
                                    RemoteViews remoteViews = RemoteViewsHelper.viewsWithNoAuth(
                                            getPackageName(),
                                            getString(R.string.autofill_manual_prompt));
                                    FillResponse response = mResponseAdapter.buildManualResponse(sender,
                                            remoteViews);
                                    if (response != null) {
                                        callback.onSuccess(response);
                                    }
                                } else {
                                    FillResponse response = mResponseAdapter.buildResponse(
                                            fieldTypesByAutofillHint, datasets, datasetAuth);
                                    callback.onSuccess(response);
                                }
                            }

                            @Override
                            public void onDataNotAvailable(String msg, Object... params) {
                                logw(msg, params);
                                callback.onSuccess(null);
                            }
                        });
            } catch (SecurityException se) {
                Context context;
                try {
                    context = this.createPackageContext(getPackageName(), 0);
                } catch (PackageManager.NameNotFoundException ex) {
                    loge("Installation failure. Our own package was not found.");
                    return;
                }
                final Intent intent = new Intent(context, MainActivity.class);
                intent.addFlags(FLAG_ACTIVITY_NEW_TASK); // Required - manifest declaration appears to be ignored - maybe Android system is modifying the intent on its way through the autofill code... dunno.
                intent.putExtra("autofill", true);
                IntentSender sender = PendingIntent.getActivity(context, 22469524, intent,
                        PendingIntent.FLAG_UPDATE_CURRENT).getIntentSender();
                RemoteViews remoteViews = RemoteViewsHelper.viewsWithAuth(getPackageName(),
                        getString(R.string.autofill_sign_in_prompt));
                FillResponse response = mResponseAdapter.buildResponse(sender, remoteViews);
                if (response != null) {
                    callback.onSuccess(response);
                }
            }
        }
    }

    @Override
    public void onSaveRequest(@NonNull SaveRequest request, @NonNull SaveCallback callback) {

        // TODO: Note that callback.onFailure should NEVER be called until we remove support for Android P and
        // earlier. This is due to an unspecified bug documented at:
        // https://developer.android.com/reference/android/service/autofill/FillCallback.html#onFailure(java.lang.CharSequence)

        callback.onFailure("saving not implemented in Kee Vault N yet");
//        List<FillContext> fillContexts = request.getFillContexts();
//        List<AssistStructure> structures =
//                fillContexts.stream().map(FillContext::getStructure).collect(toList());
//        AssistStructure latestStructure = fillContexts.get(fillContexts.size() - 1).getStructure();
//        ClientParser parser = new ClientParser(structures);
//        mESPAutofillDataSource.getFieldTypeByAutofillHints(
//                new DataCallback<HashMap<String, FieldTypeWithHints>>() {
//                    @Override
//                    public void onLoaded(
//                            HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint) {
//                        mAutofillDataBuilder = new ClientAutofillDataBuilder(
//                                fieldTypesByAutofillHint, getPackageName(), parser);
//                        ClientViewMetadataBuilder clientViewMetadataBuilder =
//                                new ClientViewMetadataBuilder(parser, fieldTypesByAutofillHint);
//                        mClientViewMetadata = clientViewMetadataBuilder.buildClientViewMetadata();
//                        String packageName = latestStructure.getActivityComponent().getPackageName();
//                        if (!mPackageVerificationRepository.putPackageSignatures(packageName)) {
//                            callback.onFailure(getString(R.string.invalid_package_signature));
//                            return;
//                        }
//                        if (logVerboseEnabled()) {
//                            logv("onSaveRequest(): clientState=%s",
//                                    bundleToString(request.getClientState()));
//                        }
//                        dumpStructure(latestStructure);
//                        checkWebDomainAndBuildAutofillData(packageName, callback);
//                    }
//
//                    @Override
//                    public void onDataNotAvailable(String msg, Object... params) {
//                        loge("Should not happen - could not find field types.");
//                    }
//                });
    }

    private void checkWebDomainAndBuildAutofillData(String packageName, SaveCallback callback) {
        String webDomain;
        try {
            webDomain = mClientViewMetadata.getWebDomain();
        } catch (SecurityException e) {
            logw(e.getMessage());
            callback.onFailure(getString(R.string.security_exception));
            return;
        }
        if (webDomain != null && webDomain.length() > 0) {
            Util.DalCheckRequirement req = Util.DalCheckRequirement.AllUrls;
            mDalRepository.checkValid(req, new DalInfo(webDomain, packageName),
                    new DataCallback<DalCheck>() {
                        @Override
                        public void onLoaded(DalCheck dalCheck) {
                            if (dalCheck.linked) {
                                logd("Domain %s is valid for %s", webDomain, packageName);
                                buildAndSaveAutofillData();
                            } else {
                                loge("Could not associate web domain %s with app %s",
                                        webDomain, packageName);
                                callback.onFailure(getString(R.string.dal_exception));
                            }
                        }

                        @Override
                        public void onDataNotAvailable(String msg, Object... params) {
                            logw(msg, params);
                            callback.onFailure(getString(R.string.dal_exception));
                        }
                    });
        } else {
            logd("no web domain");
            buildAndSaveAutofillData();
        }
    }

    private void buildAndSaveAutofillData() {
        int datasetNumber = 1; // mESPAutofillDataSource.getDatasetNumber();
        List<DatasetWithFilledAutofillFields> datasetsWithFilledAutofillFields =
                mAutofillDataBuilder.buildDatasetsByPartition(datasetNumber);
        mESPAutofillDataSource.saveAutofillDatasets(datasetsWithFilledAutofillFields);
    }

    @Override
    public void onConnected() {
        logd("onConnected");
        // Set up each time system binds to the service since user could have signed in
        // as a different vault user since this native Kee Vault app service was last created
        SharedPreferences localAfDataSourceSharedPrefs =
                getSharedPreferences(ESPAutofillDataSource.SHARED_PREF_KEY, Context.MODE_PRIVATE);
        EncryptedDataStorage storage = new EncryptedDataStorage("cache",
                new AccessRestrictions(new Date(), true, 30), //TODO: is 30 seconds OK as a default? Could try -1 if we detect biometrics are valid at startup
                localAfDataSourceSharedPrefs);
        mESPAutofillDataSource = ESPAutofillDataSource.getInstance(storage,
                new AppExecutors());
    }

    @Override
    public void onDisconnected() {
        logd("onDisconnected");
    }
}
