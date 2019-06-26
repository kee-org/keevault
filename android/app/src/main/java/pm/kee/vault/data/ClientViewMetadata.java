package pm.kee.vault.data;

import android.service.autofill.SaveInfo;
import android.view.autofill.AutofillId;

import java.util.Arrays;
import java.util.List;

import pm.kee.vault.model.ClientField;

public class ClientViewMetadata {
    private final List<String> mAllHints;
    private final int mSaveType;
    private final AutofillId[] mAutofillIds;
    private final String mWebDomain;
    private final AutofillId[] mFocusedIds;
    private final List<ClientField> mClientFields;
    private final Boolean mIsHTTPS;

    public ClientViewMetadata(List<String> allHints, int saveType, AutofillId[] autofillIds,
                              AutofillId[] focusedIds, String webDomain,
                              List<ClientField> clientFields, Boolean isHTTPS) {
        mAllHints = allHints;
        mSaveType = saveType;
        mAutofillIds = autofillIds;
        mWebDomain = webDomain;
        mFocusedIds = focusedIds;
        mClientFields = clientFields;
        mIsHTTPS = isHTTPS;
    }

    public List<String> getAllHints() {
        return mAllHints;
    }

    public AutofillId[] getAutofillIds() {
        return mAutofillIds;
    }

    public AutofillId[] getFocusedIds() {
        return mFocusedIds;
    }

    public int getSaveType() {
        return mSaveType;
    }

    public String getWebDomain() {
        return mWebDomain;
    }

    public List<ClientField> getClientFields() {
        return mClientFields;
    }

    public Boolean getIsHTTPS() {
        return mIsHTTPS;
    }

    @Override public String toString() {
        return "ClientViewMetadata{" +
                "mAllHints=" + mAllHints +
                ", mSaveType=" + mSaveType +
                ", mAutofillIds=" + Arrays.toString(mAutofillIds) +
                ", mWebDomain='" + mWebDomain + '\'' +
                ", mFocusedIds=" + Arrays.toString(mFocusedIds) +
                '}';
    }
}
