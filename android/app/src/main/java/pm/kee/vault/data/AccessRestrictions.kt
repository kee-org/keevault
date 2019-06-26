package pm.kee.vault.data

import java.util.*

data class AccessRestrictions (val expiresAt: Date, val presenceRequired: Boolean, val presenceTimeout: Int)
