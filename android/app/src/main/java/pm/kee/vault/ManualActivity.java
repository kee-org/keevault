/*
 * Copyright (C) 2018 The Android Open Source Project
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
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.RecyclerView;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.google.common.collect.ImmutableList;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

import pm.kee.vault.data.ClientViewMetadata;
import pm.kee.vault.data.ClientViewMetadataBuilder;
import pm.kee.vault.data.DataCallback;
import pm.kee.vault.data.adapter.DatasetAdapter;
import pm.kee.vault.data.adapter.ResponseAdapter;
import pm.kee.vault.data.source.local.ESPAutofillDataSource;
import pm.kee.vault.model.AutofillDataset;
import pm.kee.vault.model.DatasetWithFilledAutofillFields;
import pm.kee.vault.model.FieldType;
import pm.kee.vault.model.FieldTypeWithHints;
import pm.kee.vault.model.FilledAutofillField;
import pm.kee.vault.util.AppExecutors;

import static android.view.autofill.AutofillManager.EXTRA_ASSIST_STRUCTURE;
import static android.view.autofill.AutofillManager.EXTRA_AUTHENTICATION_RESULT;
import static pm.kee.vault.util.Util.logd;

/**
 * When the user long-presses on an autofillable field and selects "Autofill", this activity is
 * launched to allow the user to select the dataset.
 */
public class ManualActivity extends AppCompatActivity {

    private static final int RC_SELECT_FIELD = 1;

    // Unique id for dataset intents.
    private static int sDatasetPendingIntentId = 0;

    private ESPAutofillDataSource mESPAutofillDataSource;
    private DatasetAdapter mDatasetAdapter;
    private ResponseAdapter mResponseAdapter;
    private ClientViewMetadata mClientViewMetadata;
    private String mPackageName;
    private Intent mReplyIntent;
    private List<DatasetWithFilledAutofillFields> mAllDatasets;
    private RecyclerView mRecyclerView;

    public static IntentSender getManualIntentSenderForResponse(Context context) {
        final Intent intent = new Intent(context, ManualActivity.class);
        return PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_CANCEL_CURRENT).getIntentSender();
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.multidataset_service_manual_activity);
        SharedPreferences sharedPreferences =
                getSharedPreferences(ESPAutofillDataSource.SHARED_PREF_KEY, Context.MODE_PRIVATE);
//        mESPAutofillDataSource = ESPAutofillDataSource.getInstance(sharedPreferences,
//                new AppExecutors());
        mPackageName = getPackageName();
        mRecyclerView = findViewById(R.id.suggestionsList);
        mRecyclerView.addItemDecoration(new DividerItemDecoration(this, RecyclerView.VERTICAL));
//        mESPAutofillDataSource.getAllAutofillDatasets(
//                new DataCallback<List<DatasetWithFilledAutofillFields>>() {
//                    @Override
//                    public void onLoaded(List<DatasetWithFilledAutofillFields> datasets) {
//                        mAllDatasets = datasets;
//                        buildAdapter();
//                    }
//
//                    @Override
//                    public void onDataNotAvailable(String msg, Object... params) {
//
//                    }
//                });
    }

    private void buildAdapter() {
        List<String> datasetIds = new ArrayList<>();
        List<String> datasetNames = new ArrayList<>();
        List<List<String>> allFieldTypes = new ArrayList<>();
        for (DatasetWithFilledAutofillFields dataset : mAllDatasets) {
            String datasetName = dataset.autofillDataset.getDatasetName();
            String datasetId = dataset.autofillDataset.getId();
            List<String> fieldTypes = new ArrayList<>();
            for (FilledAutofillField filledAutofillField : dataset.filledAutofillFields) {
                fieldTypes.add(filledAutofillField.getFieldTypeName());
            }
            datasetIds.add(datasetId);
            datasetNames.add(datasetName);
            allFieldTypes.add(fieldTypes);
        }
        AutofillDatasetsAdapter adapter = new AutofillDatasetsAdapter(datasetIds, datasetNames,
                allFieldTypes, this);
        mRecyclerView.setAdapter(adapter);
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

    private void onFieldSelected(FilledAutofillField field, FieldType fieldType) {
        DatasetWithFilledAutofillFields datasetWithFilledAutofillFields = new DatasetWithFilledAutofillFields();
        String newDatasetId = UUID.randomUUID().toString();
        FilledAutofillField copyOfField = new FilledAutofillField(field.getAutofillId(), newDatasetId,
                field.getFieldTypeName(), field.getTextValue(), field.getDateValue(),
                field.getToggleValue());
        String datasetName = "dataset-manual";
        AutofillDataset autofillDataset = new AutofillDataset(newDatasetId, 0, datasetName, mPackageName);
        datasetWithFilledAutofillFields.filledAutofillFields = ImmutableList.of(copyOfField);
        datasetWithFilledAutofillFields.autofillDataset = autofillDataset;
        Intent intent = getIntent();
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
                        mResponseAdapter = new ResponseAdapter(ManualActivity.this,
                                mClientViewMetadata, mPackageName, mDatasetAdapter);
                        FillResponse fillResponse = mResponseAdapter.buildResponseForFocusedNode(
                                datasetName, field, fieldType);
                        setResponseIntent(fillResponse);
                        finish();
                    }

                    @Override
                    public void onDataNotAvailable(String msg, Object... params) {
                    }
                });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != RC_SELECT_FIELD || resultCode != RESULT_OK) {
            logd("Ignoring requestCode == %d | resultCode == %d", requestCode,
                    resultCode);
            return;
        }
        String datasetId = data.getStringExtra(ManualFieldPickerActivity.EXTRA_SELECTED_FIELD_DATASET_ID);
        String fieldTypeName = data.getStringExtra(ManualFieldPickerActivity.EXTRA_SELECTED_FIELD_TYPE_NAME);
        mESPAutofillDataSource.getFilledAutofillField(datasetId, fieldTypeName, new DataCallback<FilledAutofillField>() {
            @Override
            public void onLoaded(FilledAutofillField field) {
                mESPAutofillDataSource.getFieldType(field.getFieldTypeName(), new DataCallback<FieldType>() {
                    @Override
                    public void onLoaded(FieldType fieldType) {
                        onFieldSelected(field, fieldType);
                    }

                    @Override
                    public void onDataNotAvailable(String msg, Object... params) {

                    }
                });
            }

            @Override
            public void onDataNotAvailable(String msg, Object... params) {

            }
        });
    }


    private void updateHeuristics() {
//        TODO: update heuristics in data source; something like:
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
    }

    private void setResponseIntent(FillResponse fillResponse) {
        mReplyIntent.putExtra(EXTRA_AUTHENTICATION_RESULT, fillResponse);
    }

    private void setDatasetIntent(Dataset dataset) {
        mReplyIntent.putExtra(EXTRA_AUTHENTICATION_RESULT, dataset);
    }

    /**
     * Adapter for the {@link RecyclerView} that holds a list of datasets.
     */
    private static class AutofillDatasetsAdapter extends RecyclerView.Adapter<DatasetViewHolder> {

        private final List<String> mDatasetIds;
        private final List<String> mDatasetNames;
        private final List<List<String>> mFieldTypes;
        private final Activity mActivity;

        AutofillDatasetsAdapter(List<String> datasetIds, List<String> datasetNames,
                List<List<String>> fieldTypes, Activity activity) {
            mDatasetIds = datasetIds;
            mDatasetNames = datasetNames;
            mFieldTypes = fieldTypes;
            mActivity = activity;
        }

        @Override
        public DatasetViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
            return DatasetViewHolder.newInstance(parent, mActivity);
        }

        @Override
        public void onBindViewHolder(final DatasetViewHolder holder, final int position) {
            holder.bind(mDatasetIds.get(position), mDatasetNames.get(position),
                    mFieldTypes.get(position));
        }

        @Override
        public int getItemCount() {
            return mDatasetNames.size();
        }
    }

    /**
     * Contains views needed in each row of the list of datasets.
     */
    private static class DatasetViewHolder extends RecyclerView.ViewHolder {
        private final View mRootView;
        private final TextView mDatasetNameText;
        private final TextView mFieldTypesText;
        private final Activity mActivity;

        public DatasetViewHolder(View itemView, Activity activity) {
            super(itemView);
            mRootView = itemView;
            mDatasetNameText = itemView.findViewById(R.id.datasetName);
            mFieldTypesText = itemView.findViewById(R.id.fieldTypes);
            mActivity = activity;
        }

        public static DatasetViewHolder newInstance(ViewGroup parent, Activity activity) {
            return new DatasetViewHolder(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.dataset_suggestion, parent, false), activity);
        }

        public void bind(String datasetId, String datasetName, List<String> fieldTypes) {
            mDatasetNameText.setText(datasetName);
            String firstFieldType = null;
            String secondFieldType = null;
            int numOfFieldTypes = 0;
            if (fieldTypes != null) {
                numOfFieldTypes = fieldTypes.size();
                if (numOfFieldTypes > 0) {
                    firstFieldType = fieldTypes.get(0);
                }
                if (numOfFieldTypes > 1) {
                    secondFieldType = fieldTypes.get(1);
                }
            }
            String fieldTypesString;
            if (numOfFieldTypes == 1) {
                fieldTypesString = "Contains data for " + firstFieldType + ".";
            } else if (numOfFieldTypes == 2) {
                fieldTypesString = "Contains data for " + firstFieldType + " and " + secondFieldType + ".";
            } else if (numOfFieldTypes > 2) {
                fieldTypesString = "Contains data for " + firstFieldType + ", " + secondFieldType + ", and more.";
            } else {
                fieldTypesString = "Ignore: Contains no data.";
            }
            mFieldTypesText.setText(fieldTypesString);
            mRootView.setOnClickListener((view) -> {
                Intent intent = ManualFieldPickerActivity.getIntent(mActivity, datasetId);
                mActivity.startActivityForResult(intent, RC_SELECT_FIELD);
            });
        }
    }
}
