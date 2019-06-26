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

public class AutofillDataset {
    private final String mId;

    private final String mDatasetName;

    private final String mPackageName;

    private final Integer mScore;

    public AutofillDataset(String id, Integer score, String datasetName,
                           String packageName) {
        mId = id;
        mDatasetName = datasetName;
        mPackageName = packageName;
        mScore = score;
    }

    public String getId() {
        return mId;
    }

    public String getDatasetName() {
        return mDatasetName;
    }

    public String getPackageName() {
        return mPackageName;
    }

    public Integer getScore() {
        return mScore;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        AutofillDataset that = (AutofillDataset) o;

        if (!mId.equals(that.mId)) return false;
        if (!mDatasetName.equals(that.mDatasetName)) return false;
        return mPackageName.equals(that.mPackageName);
    }

    @Override
    public int hashCode() {
        int result = mId.hashCode();
        result = 31 * result + mDatasetName.hashCode();
        result = 31 * result + mPackageName.hashCode();
        return result;
    }
}
