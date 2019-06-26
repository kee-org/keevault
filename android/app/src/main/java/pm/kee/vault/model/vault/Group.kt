package pm.kee.vault.model.vault

data class Group (
	val title : String? = null,
	val iconImageData : String? = null,
	val uniqueID : String,
	val path : String? = null,
	val childEntries : List<Entry>? = null,
	val childLightEntries : List<String>? = null,
	val childGroups : List<Group>? = null
)