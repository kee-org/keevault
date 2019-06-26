package pm.kee.vault.model.vault

data class SiteConfigIndex (
	val pageExact : Map<String, SiteConfigNode>? = null,
	val pagePrefix : Map<String, SiteConfigNode>? = null,
	val pageRegex : Map<String, SiteConfigNode>? = null,
	val hostExact : Map<String, SiteConfigNode>? = null,
	val hostPrefix : Map<String, SiteConfigNode>? = null,
	val hostRegex : Map<String, SiteConfigNode>? = null,
	val domainExact : Map<String, SiteConfigNode>? = null,
	val domainPrefix : Map<String, SiteConfigNode>? = null,
	val domainRegex : Map<String, SiteConfigNode>? = null
)