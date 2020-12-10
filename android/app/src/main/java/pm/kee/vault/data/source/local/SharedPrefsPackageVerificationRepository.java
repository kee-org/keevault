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

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import pm.kee.vault.data.source.PackageVerificationDataSource;
import pm.kee.vault.util.SecurityHelper;

import static pm.kee.vault.util.Util.logd;
import static pm.kee.vault.util.Util.logw;

public class SharedPrefsPackageVerificationRepository implements PackageVerificationDataSource {

    private static final String SHARED_PREF_KEY = "pm.kee.vault.service.autofill"
            + ".datasource.PackageVerificationDataSource";
    private static PackageVerificationDataSource sInstance;

    private final SharedPreferences mSharedPrefs;
    private final Context mContext;

    private SharedPrefsPackageVerificationRepository(Context context) {
        mSharedPrefs = context.getApplicationContext()
                .getSharedPreferences(SHARED_PREF_KEY, Context.MODE_PRIVATE);
        mContext = context.getApplicationContext();
    }

    public static PackageVerificationDataSource getInstance(Context context) {
        if (sInstance == null) {
            sInstance = new SharedPrefsPackageVerificationRepository(
                    context.getApplicationContext());
        }
        return sInstance;
    }

    @Override
    public void clear() {
        mSharedPrefs.edit().clear().apply();
    }

    @Override
    public boolean putPackageSignatures(String packageName) {
        String hash;
        try {
            PackageManager pm = mContext.getPackageManager();
            PackageInfo packageInfo = pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
            hash = SecurityHelper.getFingerprint(packageInfo, packageName);
            logd("Hash for %s: %s", packageName, hash); //TODO: This gets called dozens of times. Verify it is not recalculating the same hash every time
        } catch (Exception e) {
            logw(e, "Error getting hash for %s.", packageName);
            return false;
        }

        if (!containsSignatureForPackage(packageName)) {
            // Storage does not yet contain signature for this package name.
            mSharedPrefs.edit().putString(packageName, hash).apply();
            return true;
        }
        return containsMatchingSignatureForPackage(packageName, hash);
    }

    private boolean containsSignatureForPackage(String packageName) {
        return mSharedPrefs.contains(packageName);
    }

    private boolean containsMatchingSignatureForPackage(String packageName,
            String hash) {
        return hash.equals(mSharedPrefs.getString(packageName, null));
    }
}
