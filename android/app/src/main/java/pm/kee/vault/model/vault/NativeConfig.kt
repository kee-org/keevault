package pm.kee.vault.model.vault

data class NativeConfig (
        val cache: NativeCacheConfig,
        val auth: NativeAuthConfig
)

data class NativeCacheConfig (
        val expiry : Int,
        val authPresenceLimit : Int
)
data class NativeAuthConfig (
        val expiry : Int,
        val interactiveExpiry : Int,
        val secretKey: String
)