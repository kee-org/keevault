package pm.kee.vault.model.vault

data class SiteConfigNode (
	val config : SiteConfig,
	val matchWeight : Int,
	val source : String // "Migration" | "User" | "Default"
)