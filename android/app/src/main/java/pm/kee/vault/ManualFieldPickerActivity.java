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
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.RecyclerView;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.google.gson.GsonBuilder;

import java.util.List;

import pm.kee.vault.data.DataCallback;
import pm.kee.vault.data.source.local.ESPAutofillDataSource;
import pm.kee.vault.model.DatasetWithFilledAutofillFields;
import pm.kee.vault.model.FilledAutofillField;
import pm.kee.vault.util.AppExecutors;

import static androidx.recyclerview.widget.LinearLayoutManager.VERTICAL;

public class ManualFieldPickerActivity extends AppCompatActivity {
    private static final String EXTRA_DATASET_ID = "extra_dataset_id";
    public static final String EXTRA_SELECTED_FIELD_DATASET_ID = "selected_field_dataset_id";
    public static final String EXTRA_SELECTED_FIELD_TYPE_NAME = "selected_field_type_name";

    private ESPAutofillDataSource mESPAutofillDataSource;

    private RecyclerView mRecyclerView;
    private TextView mListTitle;
    private DatasetWithFilledAutofillFields mDataset;

    public static Intent getIntent(Context originContext, String datasetId) {
        Intent intent = new Intent(originContext, ManualFieldPickerActivity.class);
        intent.putExtra(EXTRA_DATASET_ID, datasetId);
        return intent;
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_field_picker);
        SharedPreferences sharedPreferences = getSharedPreferences(
                ESPAutofillDataSource.SHARED_PREF_KEY, Context.MODE_PRIVATE);
        String datasetId = getIntent().getStringExtra(EXTRA_DATASET_ID);
        mRecyclerView = findViewById(R.id.fieldsList);
        mRecyclerView.addItemDecoration(new DividerItemDecoration(this, VERTICAL));
        mListTitle = findViewById(R.id.listTitle);
//        mESPAutofillDataSource = ESPAutofillDataSource.getInstance(sharedPreferences, new AppExecutors());
//        mESPAutofillDataSource.getAutofillDatasetWithId(datasetId,
//                new DataCallback<DatasetWithFilledAutofillFields>() {
//                    @Override
//                    public void onLoaded(DatasetWithFilledAutofillFields dataset) {
//                        mDataset = dataset;
//                        if (mDataset != null) {
//                            onLoadedDataset();
//                        }
//                    }
//
//                    @Override
//                    public void onDataNotAvailable(String msg, Object... params) {
//
//                    }
//                });
    }

    public void onSelectedDataset(FilledAutofillField field) {
        Intent data = new Intent()
                .putExtra(EXTRA_SELECTED_FIELD_DATASET_ID, field.getDatasetId())
                .putExtra(EXTRA_SELECTED_FIELD_TYPE_NAME, field.getFieldTypeName());
        setResult(RESULT_OK, data);
        finish();
    }

    public void onLoadedDataset() {
        FieldsAdapter fieldsAdapter = new FieldsAdapter(this, mDataset.filledAutofillFields);
        mRecyclerView.setAdapter(fieldsAdapter);
        mListTitle.setText(getString(R.string.manual_data_picker_title,
                mDataset.autofillDataset.getDatasetName()));
    }

    private static class FieldsAdapter extends RecyclerView.Adapter<FieldViewHolder> {
        private final Activity mActivity;
        private final List<FilledAutofillField> mFields;

        public FieldsAdapter(Activity activity, List<FilledAutofillField> fields) {
            mActivity = activity;
            mFields = fields;
        }

        @Override
        public FieldViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
            return new FieldViewHolder(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.dataset_field, parent, false), mActivity);
        }

        @Override
        public void onBindViewHolder(FieldViewHolder holder, int position) {
            FilledAutofillField field = mFields.get(position);
            holder.bind(field);
        }

        @Override
        public int getItemCount() {
            return mFields.size();
        }
    }

    private static class FieldViewHolder extends RecyclerView.ViewHolder {
        private final View mRootView;
        private final TextView mFieldTypeText;
        private final Activity mActivity;

        public FieldViewHolder(View itemView, Activity activity) {
            super(itemView);
            mRootView = itemView;
            mFieldTypeText = itemView.findViewById(R.id.fieldType);
            mActivity = activity;
        }

        public void bind(FilledAutofillField field) {
            mFieldTypeText.setText(field.getFieldTypeName());
            mRootView.setOnClickListener((view) -> {
                ((ManualFieldPickerActivity) mActivity).onSelectedDataset(field);
            });
        }
    }
}
