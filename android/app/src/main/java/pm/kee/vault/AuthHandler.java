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

import android.app.Activity;
import android.app.assist.AssistStructure;
import android.content.Intent;
import android.service.autofill.FillResponse;

import java.util.HashMap;
import java.util.List;

import pm.kee.vault.data.ClientViewMetadata;
import pm.kee.vault.data.ClientViewMetadataBuilder;
import pm.kee.vault.data.DataCallback;
import pm.kee.vault.data.adapter.DatasetAdapter;
import pm.kee.vault.data.adapter.ResponseAdapter;
import pm.kee.vault.data.source.local.ESPAutofillDataSource;
import pm.kee.vault.model.DatasetWithFilledAutofillFields;
import pm.kee.vault.model.FieldTypeWithHints;

import static android.app.Activity.RESULT_OK;
import static android.view.autofill.AutofillManager.EXTRA_ASSIST_STRUCTURE;
import static android.view.autofill.AutofillManager.EXTRA_AUTHENTICATION_RESULT;
import static pm.kee.vault.util.Util.EXTRA_FOR_RESPONSE;
import static pm.kee.vault.util.Util.loge;
import static pm.kee.vault.util.Util.logw;

public class AuthHandler {

    private DatasetAdapter mDatasetAdapter;
    private ResponseAdapter mResponseAdapter;
    private ClientViewMetadata mClientViewMetadata;
    private Intent mReplyIntent;
//
//    public static IntentSender getAuthIntentSenderForResponse(Context context) {
//        final Intent intent = new Intent(context, AuthHandler.class);
//        return PendingIntent.getActivity(context, 0, intent,
//                PendingIntent.FLAG_CANCEL_CURRENT).getIntentSender();
//    }
//
//    public static IntentSender getAuthIntentSenderForDataset(Context originContext,
//            String datasetName) {
//        Intent intent = new Intent(originContext, AuthHandler.class);
//        intent.putExtra(EXTRA_DATASET_NAME, datasetName);
//        intent.putExtra(EXTRA_FOR_RESPONSE, false);
//        return PendingIntent.getActivity(originContext, ++sDatasetPendingIntentId, intent,
//                PendingIntent.FLAG_CANCEL_CURRENT).getIntentSender();
//    }

    public void doIt(Activity ourActivity, ESPAutofillDataSource mESPAutofillDataSource) {
        Intent intent = ourActivity.getIntent();
        boolean forResponse = intent.getBooleanExtra(EXTRA_FOR_RESPONSE, true);
        AssistStructure structure = intent.getParcelableExtra(EXTRA_ASSIST_STRUCTURE); //TODO: These are probably not set cos I make my own activity rather than use the google one? maybe. fuck knows
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
                mResponseAdapter = new ResponseAdapter(ourActivity,
                        mClientViewMetadata, ourActivity.getPackageName(), mDatasetAdapter);
                if (forResponse) {
                    fetchAllDatasetsAndSetIntent(fieldTypesByAutofillHint, ourActivity, mESPAutofillDataSource);
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

    private void fetchAllDatasetsAndSetIntent(
        HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint, Activity ourActivity, ESPAutofillDataSource mESPAutofillDataSource) {
        mESPAutofillDataSource.getAutofillDatasets(mClientViewMetadata,
                new DataCallback<List<DatasetWithFilledAutofillFields>>() {
                    @Override
                    public void onLoaded(List<DatasetWithFilledAutofillFields> datasets) {
                        boolean datasetAuth = false;
                        FillResponse fillResponse = mResponseAdapter.buildResponse(
                                fieldTypesByAutofillHint, datasets, datasetAuth);
                        setResponseIntent(fillResponse);
                        ourActivity.setResult(RESULT_OK, mReplyIntent);
                        ourActivity.finish();
                    }

                    @Override
                    public void onDataNotAvailable(String msg, Object... params) {
                        logw(msg, params);
                        ourActivity.setResult(RESULT_OK, mReplyIntent);
                        ourActivity.finish();
                    }
                });
    }

    private void setResponseIntent(FillResponse fillResponse) {
        mReplyIntent.putExtra(EXTRA_AUTHENTICATION_RESULT, fillResponse);
    }

}
