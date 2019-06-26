package pm.kee.vault.model.vault

data class MatchedURLAccuracyOverride (
    val domain : String? = null,
    val method : String? = null // 'Exact' | 'Hostname' | 'Domain'
)
