package pm.kee.vault.model.vault

data class Db (
    val name : String? = null,
    val fileName : String? = null,
    val active : Boolean? = null,
    val root : Group? = null,
    val iconImageData : String? = null,

    // Both null for MVP...
    val defaultMatchAccuracy : String? = null, // Domain | Hostname | Exact
    val matchedURLAccuracyOverrides: List<MatchedURLAccuracyOverride>? = null
)