package pm.kee.vault.model.vault

data class FormMatchConfig (
	val form : FormMatchConfigLists? = null,
	val fields : FormMatchConfigLists? = null,
	val querySelectors: List<String>? = null
)