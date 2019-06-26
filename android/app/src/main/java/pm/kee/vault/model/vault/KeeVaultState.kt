package pm.kee.vault.model.vault

data class KeeVaultState (
	val id : String,
	val config : NativeConfig,
	val vault : Vault
)