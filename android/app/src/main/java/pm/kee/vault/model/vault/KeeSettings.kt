package pm.kee.vault.model.vault

// Users will only have an instance of this config object if they have used and synchronised a
// desktop Kee browser extension with their Kee Vault account. We currently do nothing with this
// information but could gradually introduce support for a subset of these configuration options
data class KeeSettings (
    val animateWhenOfferingSave : Boolean? = null,
    val autoFillForms : Boolean? = null,
    val autoFillFormsWithMultipleMatches : Boolean? = null,
    val autoSubmitForms : Boolean? = null,
    val autoSubmitMatchedForms : Boolean? = null,
    val autoSubmitNetworkAuthWithSingleMatch : Boolean? = null,
    val currentSearchTermTimeout : Int? = null,
    val listAllOpenDBs : Boolean? = null,
    val logLevel : Int? = null,
    val manualSubmitOverrideProhibited : Boolean? = null,
    val mruGroup : Map<String, String>? = null,
    val notificationCountGeneric : Int? = null,
    val notificationCountSavePassword : Int? = null,
    val notifyWhenEntryUpdated : Boolean? = null,
    val overWriteFieldsAutomatically : Boolean? = null,
    val rememberMRUDB : Boolean? = null,
    val rememberMRUGroup : Boolean? = null,
    val saveFavicons : Boolean? = null,
    val searchAllOpenDBs : Boolean? = null,
    val siteConfig : SiteConfigIndex? = null
)