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
package pm.kee.vault.model;

import android.view.autofill.AutofillId;

public class FilledAutofillField {

    private final String mDatasetId;

    private final String mTextValue;

    private final Long mDateValue;

    private final Boolean mToggleValue;

    private final String mFieldTypeName;

    private final AutofillId mAutofillId;

    public FilledAutofillField(AutofillId autofillId, String datasetId, String fieldTypeName,
                               String textValue, Long dateValue,
                               Boolean toggleValue) {
        mDatasetId = datasetId;
        mFieldTypeName = fieldTypeName;
        mTextValue = textValue;
        mDateValue = dateValue;
        mToggleValue = toggleValue;
        mAutofillId = autofillId;
    }

    public FilledAutofillField(AutofillId autofillId, String datasetId,
            String fieldTypeName, String textValue, Long dateValue) {
        this(autofillId, datasetId, fieldTypeName, textValue, dateValue, null);
    }

    public FilledAutofillField(AutofillId autofillId, String datasetId, String fieldTypeName,
                               String textValue) {
        this(autofillId, datasetId, fieldTypeName, textValue, null, null);
    }

    public FilledAutofillField(AutofillId autofillId, String datasetId, String fieldTypeName,
                               Long dateValue) {
        this(autofillId, datasetId, fieldTypeName, null, dateValue, null);
    }

    public FilledAutofillField(AutofillId autofillId, String datasetId, String fieldTypeName,
                               Boolean toggleValue) {
        this(autofillId, datasetId, fieldTypeName, null, null, toggleValue);
    }

    public FilledAutofillField(AutofillId autofillId, String datasetId, String fieldTypeName) {
        this(autofillId, datasetId, fieldTypeName, null, null, null);
    }

    public String getDatasetId() {
        return mDatasetId;
    }

    public String getTextValue() {
        return mTextValue;
    }

    public Long getDateValue() {
        return mDateValue;
    }

    public Boolean getToggleValue() {
        return mToggleValue;
    }

    public String getFieldTypeName() {
        return mFieldTypeName;
    }

    public AutofillId getAutofillId() { return mAutofillId; }

    public boolean isNull() {
        return mTextValue == null && mDateValue == null && mToggleValue == null;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        FilledAutofillField that = (FilledAutofillField) o;

        if (mTextValue != null ? !mTextValue.equals(that.mTextValue) : that.mTextValue != null)
            return false;
        if (mDateValue != null ? !mDateValue.equals(that.mDateValue) : that.mDateValue != null)
            return false;
        if (mToggleValue != null ? !mToggleValue.equals(that.mToggleValue) : that.mToggleValue != null)
            return false;
        if (mAutofillId != null ? !mAutofillId.equals(that.mAutofillId) : that.mAutofillId != null)
            return false;
        return mFieldTypeName.equals(that.mFieldTypeName);
    }

    @Override
    public int hashCode() {
        int result = mTextValue != null ? mTextValue.hashCode() : 0;
        result = 31 * result + (mDateValue != null ? mDateValue.hashCode() : 0);
        result = 31 * result + (mToggleValue != null ? mToggleValue.hashCode() : 0);
        result = 31 * result + (mAutofillId != null ? mAutofillId.hashCode() : 0);
        result = 31 * result + mFieldTypeName.hashCode();
        return result;
    }
}
