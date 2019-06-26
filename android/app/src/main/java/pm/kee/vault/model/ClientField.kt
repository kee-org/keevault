package pm.kee.vault.model

import android.view.autofill.AutofillId

data class ClientField (val autofillId: AutofillId, val fieldType: String, val htmlId: String?,
                        val htmlName: String?, val visible: Boolean)