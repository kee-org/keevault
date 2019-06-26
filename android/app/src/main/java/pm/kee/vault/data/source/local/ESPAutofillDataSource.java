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

package pm.kee.vault.data.source.local;

import android.content.SharedPreferences;
import android.service.autofill.Dataset;

import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;

import pm.kee.vault.data.ClientViewMetadata;
import pm.kee.vault.data.DataCallback;
import pm.kee.vault.data.EncryptedDataStorage;
import pm.kee.vault.data.source.AutofillDataSource;
import pm.kee.vault.data.source.local.dao.EDSDao;
import pm.kee.vault.model.AutofillDataset;
import pm.kee.vault.model.AutofillHint;
import pm.kee.vault.model.DatasetWithFilledAutofillFields;
import pm.kee.vault.model.FieldType;
import pm.kee.vault.model.FieldTypeWithHints;
import pm.kee.vault.model.FilledAutofillField;
import pm.kee.vault.model.vault.Entry;
import pm.kee.vault.util.AppExecutors;

import static pm.kee.vault.data.MatchFieldsKt.matchFields;
import static pm.kee.vault.util.Util.logw;

public class ESPAutofillDataSource implements AutofillDataSource {
    public static final String SHARED_PREF_KEY = "pm.kee.vault.service.autofill"
            + ".datasource.ESPAutofillDataSource";
//    private static final String DATASET_NUMBER_KEY = "datasetNumber";
    private static final Object sLock = new Object();

    private static ESPAutofillDataSource sInstance;

    private final EncryptedDataStorage mEDS;
    private final AppExecutors mAppExecutors;
    private final EDSDao mEDSDao;

    private ESPAutofillDataSource(EncryptedDataStorage eds, AppExecutors appExecutors) {
        mEDS = eds;
        mAppExecutors = appExecutors;
        mEDSDao = new EDSDao(eds);
    }

    public static ESPAutofillDataSource getInstance(EncryptedDataStorage eds,
            AppExecutors appExecutors) {
        synchronized (sLock) {
            if (sInstance == null) {
                sInstance = new ESPAutofillDataSource(eds, appExecutors);
            }
            return sInstance;
        }
    }

    public static void clearInstance() {
        synchronized (sLock) {
            sInstance = null;
        }
    }

    @Override
    public void getAutofillDatasets(ClientViewMetadata clientViewMetadata, DataCallback<List<DatasetWithFilledAutofillFields>> datasetsCallback) {
        List<Entry> matchedEntries = mEDSDao.getMatchingEntries(clientViewMetadata.getWebDomain(), clientViewMetadata.getIsHTTPS());
        List<DatasetWithFilledAutofillFields> datasetsWithFilledAutofillFields = matchFields(matchedEntries, clientViewMetadata);
        datasetsCallback.onLoaded(datasetsWithFilledAutofillFields);
    }

//
//    @Override
//    public void getAutofillDatasets(ClientViewMetadata clientViewMetadata, DataCallback<List<DatasetWithFilledAutofillFields>> datasetsCallback) {
//        mAppExecutors.diskIO().execute(() -> {
////            final List<String> typeNames = getFieldTypesForAutofillHints(allAutofillHints)
////                    .stream()
////                    .map((u) -> u.fieldType)
////                    .map(FieldType::getTypeName)
////                    .collect(Collectors.toList());
//            List<Entry> matchedEntries = mEDSDao.getMatchingEntries(clientViewMetadata.getWebDomain(), clientViewMetadata.getIsHTTPS());
//            List<DatasetWithFilledAutofillFields> datasetsWithFilledAutofillFields = matchFields(matchedEntries, clientViewMetadata);
//            mAppExecutors.mainThread().execute(() ->
//                    datasetsCallback.onLoaded(datasetsWithFilledAutofillFields)
//            );
//        });
//    }
//
//    @Override
//    public void getAllAutofillDatasets(
//            DataCallback<List<DatasetWithFilledAutofillFields>> datasetsCallback) {
//        mAppExecutors.diskIO().execute(() -> {
//            List<DatasetWithFilledAutofillFields> datasetsWithFilledAutofillFields =
//                    mEDSDao.getAllDatasets();
//            mAppExecutors.mainThread().execute(() ->
//                    datasetsCallback.onLoaded(datasetsWithFilledAutofillFields)
//            );
//        });
//    }
//
//    @Override
//    public void getAutofillDataset(List<String> allAutofillHints, String datasetName,
//            DataCallback<DatasetWithFilledAutofillFields> datasetsCallback) {
//        mAppExecutors.diskIO().execute(() -> {
//            // Room does not support TypeConverters for collections.
//            List<DatasetWithFilledAutofillFields> autofillDatasetFields =
//                    mEDSDao.getDatasetsWithName(allAutofillHints, datasetName);
//            if (autofillDatasetFields != null && !autofillDatasetFields.isEmpty()) {
//                if (autofillDatasetFields.size() > 1) {
//                    logw("More than 1 dataset with name %s", datasetName);
//                }
//                DatasetWithFilledAutofillFields dataset = autofillDatasetFields.get(0);
//
//                mAppExecutors.mainThread().execute(() ->
//                        datasetsCallback.onLoaded(dataset)
//                );
//            } else {
//                mAppExecutors.mainThread().execute(() ->
//                        datasetsCallback.onDataNotAvailable("No data found.")
//                );
//            }
//        });
//    }


    @Override
    public void saveAutofillDatasets(List<DatasetWithFilledAutofillFields>
            datasetsWithFilledAutofillFields) {
        mAppExecutors.diskIO().execute(() -> {
            for (DatasetWithFilledAutofillFields datasetWithFilledAutofillFields :
                    datasetsWithFilledAutofillFields) {
                List<FilledAutofillField> filledAutofillFields =
                        datasetWithFilledAutofillFields.filledAutofillFields;
                AutofillDataset autofillDataset = datasetWithFilledAutofillFields.autofillDataset;
                mEDSDao.insertAutofillDataset(autofillDataset);
                mEDSDao.insertFilledAutofillFields(filledAutofillFields);
            }
        });
//        incrementDatasetNumber();
    }
//
//    @Override
//    public void saveResourceIdHeuristic(ResourceIdHeuristic resourceIdHeuristic) {
//        mAppExecutors.diskIO().execute(() -> {
//            mCapDao.insertResourceIdHeuristic(resourceIdHeuristic);
//        });
//    }

    @Override
    public void getFieldTypes(DataCallback<List<FieldTypeWithHints>> fieldTypesCallback) {
        mAppExecutors.diskIO().execute(() -> {
            List<FieldTypeWithHints> fieldTypeWithHints = mEDSDao.getFieldTypesWithHints();
            mAppExecutors.mainThread().execute(() -> {
                if (fieldTypeWithHints != null) {
                    fieldTypesCallback.onLoaded(fieldTypeWithHints);
                } else {
                    fieldTypesCallback.onDataNotAvailable("Field Types not found.");
                }
            });
        });
    }


    @Override
    public void getFieldTypeByAutofillHints(
        DataCallback<HashMap<String, FieldTypeWithHints>> fieldTypeMapCallback) {
        HashMap<String, FieldTypeWithHints> hintMap = getFieldTypeByAutofillHints();
        if (hintMap != null) {
            fieldTypeMapCallback.onLoaded(hintMap);
        } else {
            fieldTypeMapCallback.onDataNotAvailable("FieldTypes not found");
        }
    }

    //
//    @Override
//    public void getFieldTypeByAutofillHints(
//            DataCallback<HashMap<String, FieldTypeWithHints>> fieldTypeMapCallback) {
//        mAppExecutors.diskIO().execute(() -> {
//            HashMap<String, FieldTypeWithHints> hintMap = getFieldTypeByAutofillHints();
//            mAppExecutors.mainThread().execute(() -> {
//                if (hintMap != null) {
//                    fieldTypeMapCallback.onLoaded(hintMap);
//                } else {
//                    fieldTypeMapCallback.onDataNotAvailable("FieldTypes not found");
//                }
//            });
//        });
//    }

    @Override
    public void getFilledAutofillField(String datasetId, String fieldTypeName, DataCallback<FilledAutofillField> fieldCallback) {
        mAppExecutors.diskIO().execute(() -> {
            FilledAutofillField filledAutofillField = mEDSDao.getFilledAutofillField(datasetId, fieldTypeName);
            mAppExecutors.mainThread().execute(() -> {
                fieldCallback.onLoaded(filledAutofillField);
            });
        });
    }

    @Override
    public void getFieldType(String fieldTypeName, DataCallback<FieldType> fieldTypeCallback) {
        mAppExecutors.diskIO().execute(() -> {
            FieldType fieldType = mEDSDao.getFieldType(fieldTypeName);
            mAppExecutors.mainThread().execute(() -> {
                fieldTypeCallback.onLoaded(fieldType);
            });
        });
    }

    public void getAutofillDatasetWithId(String datasetId,
            DataCallback<DatasetWithFilledAutofillFields> callback) {
        mAppExecutors.diskIO().execute(() -> {
            DatasetWithFilledAutofillFields dataset =
                    mEDSDao.getAutofillDatasetWithId(datasetId);
            mAppExecutors.mainThread().execute(() -> {
                callback.onLoaded(dataset);
            });
        });
    }

    private HashMap<String, FieldTypeWithHints> getFieldTypeByAutofillHints() {
        HashMap<String, FieldTypeWithHints> hintMap = new HashMap<>();
        List<FieldTypeWithHints> fieldTypeWithHints =
                mEDSDao.getFieldTypesWithHints();
        if (fieldTypeWithHints != null) {
            for (FieldTypeWithHints fieldType : fieldTypeWithHints) {
                for (AutofillHint hint : fieldType.autofillHints) {
                    hintMap.put(hint.mAutofillHint, fieldType);
                }
            }
            return hintMap;
        } else {
            return null;
        }
    }

    private List<FieldTypeWithHints> getFieldTypesForAutofillHints(List<String> autofillHints) {
        return mEDSDao.getFieldTypesForAutofillHints(autofillHints);
    }
//
//    @Override
//    public void clear() {
//        mAppExecutors.diskIO().execute(() -> {
//            mCapDao.clearAll();
//            mSharedPreferences.edit().putInt(DATASET_NUMBER_KEY, 0).apply();
//        });
//    }
//
//    /**
//     * For simplicity, {@link Dataset}s will be named in the form {@code dataset-X.P} where
//     * {@code X} means this was the Xth group of datasets saved, and {@code P} refers to the dataset
//     * partition number. This method returns the appropriate {@code X}.
//     */
//    public int getDatasetNumber() {
//        return mSharedPreferences.getInt(DATASET_NUMBER_KEY, 0);
//    }
//
//    /**
//     * Every time a dataset is saved, this should be called to increment the dataset number.
//     * (only important for this service's dataset naming scheme).
//     */
//    private void incrementDatasetNumber() {
//        mSharedPreferences.edit().putInt(DATASET_NUMBER_KEY, getDatasetNumber() + 1).apply();
//    }
}
