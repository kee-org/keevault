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
import android.os.Bundle;
import android.service.autofill.Dataset;
import android.service.autofill.FillResponse;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import android.text.Editable;
import android.widget.EditText;
import android.widget.RemoteViews;
import android.widget.Toast;

import com.google.gson.GsonBuilder;

import java.util.HashMap;
import java.util.List;

import pm.kee.vault.data.ClientViewMetadata;
import pm.kee.vault.data.ClientViewMetadataBuilder;
import pm.kee.vault.data.DataCallback;
import pm.kee.vault.data.adapter.DatasetAdapter;
import pm.kee.vault.data.adapter.ResponseAdapter;
import pm.kee.vault.data.source.local.ESPAutofillDataSource;
import pm.kee.vault.data.source.local.DigitalAssetLinksRepository;
import pm.kee.vault.model.DatasetWithFilledAutofillFields;
import pm.kee.vault.model.FieldTypeWithHints;
import pm.kee.vault.util.AppExecutors;

import static android.view.autofill.AutofillManager.EXTRA_ASSIST_STRUCTURE;
import static android.view.autofill.AutofillManager.EXTRA_AUTHENTICATION_RESULT;
import static pm.kee.vault.util.Util.EXTRA_DATASET_NAME;
import static pm.kee.vault.util.Util.EXTRA_FOR_RESPONSE;
import static pm.kee.vault.util.Util.loge;
import static pm.kee.vault.util.Util.logw;

// TODO: Replace UI with calls to Capacitor in whatever way that is possible
/**
 * This Activity controls the UI for logging in to the Autofill service.
 * It is launched when an Autofill Response or specific Dataset within the Response requires
 * authentication to access. It bundles the result in an Intent.
 */
public class AuthActivity extends AppCompatActivity {

    // Unique id for dataset intents.
    private static int sDatasetPendingIntentId = 0;

    private ESPAutofillDataSource mESPAutofillDataSource;
    private DigitalAssetLinksRepository mDalRepository;
    private EditText mMasterPassword;
    private DatasetAdapter mDatasetAdapter;
    private ResponseAdapter mResponseAdapter;
    private ClientViewMetadata mClientViewMetadata;
    private String mPackageName;
    private Intent mReplyIntent;

    public static IntentSender getAuthIntentSenderForResponse(Context context) {
        final Intent intent = new Intent(context, AuthActivity.class);
        return PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_CANCEL_CURRENT).getIntentSender();
    }

    public static IntentSender getAuthIntentSenderForDataset(Context originContext,
            String datasetName) {
        Intent intent = new Intent(originContext, AuthActivity.class);
        intent.putExtra(EXTRA_DATASET_NAME, datasetName);
        intent.putExtra(EXTRA_FOR_RESPONSE, false);
        return PendingIntent.getActivity(originContext, ++sDatasetPendingIntentId, intent,
                PendingIntent.FLAG_CANCEL_CURRENT).getIntentSender();
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.multidataset_service_auth_activity);
        SharedPreferences sharedPreferences =
                getSharedPreferences(ESPAutofillDataSource.SHARED_PREF_KEY, Context.MODE_PRIVATE);
//        AutofillDao autofillDao = AutofillDatabase.getInstance(this,
//                defaultFieldTypesSource, new AppExecutors()).autofillDao();
//        mESPAutofillDataSource = ESPAutofillDataSource.getInstance(sharedPreferences,
//                new AppExecutors());
        mDalRepository = DigitalAssetLinksRepository.getInstance(getPackageManager());
        mMasterPassword = findViewById(R.id.master_password);
        mPackageName = getPackageName();
        findViewById(R.id.login).setOnClickListener((view) -> login());
        findViewById(R.id.cancel).setOnClickListener((view) -> {
            onFailure();
            AuthActivity.this.finish();
        });
    }

    private void login() {
        Editable password = mMasterPassword.getText();
        String correctPassword = "whatever";
        if (password.toString().equals(correctPassword)) {
            onSuccess();
        } else {
            Toast.makeText(this, "Password incorrect", Toast.LENGTH_SHORT).show();
            onFailure();
        }
    }

    @Override
    public void finish() {
        if (mReplyIntent != null) {
            setResult(RESULT_OK, mReplyIntent);
        } else {
            setResult(RESULT_CANCELED);
        }
        super.finish();
    }

    private void onFailure() {
        logw("Failed auth.");
        mReplyIntent = null;
    }

    private void onSuccess() {
        Intent intent = getIntent();
        boolean forResponse = intent.getBooleanExtra(EXTRA_FOR_RESPONSE, true);
        AssistStructure structure = intent.getParcelableExtra(EXTRA_ASSIST_STRUCTURE);
        ClientParser clientParser = new ClientParser(structure);
        mReplyIntent = new Intent();
        mESPAutofillDataSource.getFieldTypeByAutofillHints(
                new DataCallback<HashMap<String, FieldTypeWithHints>>() {
            @Override
            public void onLoaded(HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint) {
                ClientViewMetadataBuilder builder = new ClientViewMetadataBuilder(clientParser,
                        fieldTypesByAutofillHint);
                mClientViewMetadata = builder.buildClientViewMetadata();
                mDatasetAdapter = new DatasetAdapter(clientParser);
                mResponseAdapter = new ResponseAdapter(AuthActivity.this,
                        mClientViewMetadata, mPackageName, mDatasetAdapter);
                if (forResponse) {
                    fetchAllDatasetsAndSetIntent(fieldTypesByAutofillHint);
                } else {
                    loge("Fuck knows what this is supposed to do");
//                    String datasetName = intent.getStringExtra(EXTRA_DATASET_NAME);
//                    fetchDatasetAndSetIntent(fieldTypesByAutofillHint, datasetName);
                }
            }

            @Override
            public void onDataNotAvailable(String msg, Object... params) {

            }
        });
    }
//
//    private void fetchDatasetAndSetIntent(
//            HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint, String datasetName) {
//        mESPAutofillDataSource.getAutofillDataset(mClientViewMetadata.getAllHints(),
//                datasetName, new DataCallback<DatasetWithFilledAutofillFields>() {
//                    @Override
//                    public void onLoaded(DatasetWithFilledAutofillFields dataset) {
//                        String datasetName = dataset.autofillDataset.getDatasetName();
//                        RemoteViews remoteViews = RemoteViewsHelper.viewsWithNoAuth(
//                                mPackageName, datasetName);
//                        setDatasetIntent(mDatasetAdapter.buildDataset(fieldTypesByAutofillHint,
//                                dataset, remoteViews));
//                        finish();
//                    }
//
//                    @Override
//                    public void onDataNotAvailable(String msg, Object... params) {
//                        logw(msg, params);
//                        finish();
//                    }
//                });
//    }

    private void fetchAllDatasetsAndSetIntent(
            HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint) {
        mESPAutofillDataSource.getAutofillDatasets(mClientViewMetadata,
                new DataCallback<List<DatasetWithFilledAutofillFields>>() {
                    @Override
                    public void onLoaded(List<DatasetWithFilledAutofillFields> datasets) {
                        boolean datasetAuth = false;
                        FillResponse fillResponse = mResponseAdapter.buildResponse(
                                fieldTypesByAutofillHint, datasets, datasetAuth);
                        setResponseIntent(fillResponse);
                        finish();
                    }

                    @Override
                    public void onDataNotAvailable(String msg, Object... params) {
                        logw(msg, params);
                        finish();
                    }
                });
    }

    private void setResponseIntent(FillResponse fillResponse) {
        mReplyIntent.putExtra(EXTRA_AUTHENTICATION_RESULT, fillResponse);
    }

    private void setDatasetIntent(Dataset dataset) {
        mReplyIntent.putExtra(EXTRA_AUTHENTICATION_RESULT, dataset);
    }
}
