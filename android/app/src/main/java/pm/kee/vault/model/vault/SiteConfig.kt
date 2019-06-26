package pm.kee.vault.model.vault

data class SiteConfig (
    val whiteList : FormMatchConfig? = null,
    val blackList : FormMatchConfig? = null,
    val preventSaveNotification : Boolean? = null
)