package pm.kee.vault.model.vault

data class Vault (
	val dbs : List<Db>? = null,
	val config : KeeSettingsWrapper
)