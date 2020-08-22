package pm.kee.vault.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.IOException
import javax.crypto.Cipher
import javax.crypto.SecretKey
import java.security.*


/**
 * Wraps [SecretKey] instances using a public/private key pair stored in
 * the platform [KeyStore]. This allows us to protect symmetric keys with
 * hardware-backed crypto, if provided by the device.
 *
 *
 * See [key wrapping](http://en.wikipedia.org/wiki/Key_Wrap) for more
 * details.
 *
 *
 * Not inherently thread safe.
 */
class SecretKeyWrapper
/**
 * Create a wrapper using the public/private key pair with the given alias.
 * If no pair with that alias exists, it will be generated.
 */
@Throws(GeneralSecurityException::class, IOException::class)
constructor(alias: String, accessRestrictions: AccessRestrictions) {
    private val mCipher: Cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding")
    private val mPair: KeyPair

    init {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        if (!keyStore.containsAlias(alias)) {
            generateKeyPair(alias, accessRestrictions)
        }
        // Even if we just generated the key, always read it back to ensure we
        // can read it successfully.
//        val entry = keyStore.getEntry(
//                alias, null) as KeyStore.PrivateKeyEntry
        val privateKey = keyStore.getKey(alias, null) as PrivateKey
        val publicKey = keyStore.getCertificate(alias).publicKey
        mPair = KeyPair(publicKey, privateKey)
    }

    @Throws(GeneralSecurityException::class)
    private fun generateKeyPair(alias: String, accessRestrictions: AccessRestrictions) {
//        val start = GregorianCalendar()
//        val end = GregorianCalendar()
//        end.add(Calendar.YEAR, 100)
        val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_DECRYPT )
//                .setSubject(X500Principal("CN=$alias"))
//                .setSerialNumber(BigInteger.ONE)
//                .setStartDate(start.time)
//                .setEndDate(end.time)
                .setUserAuthenticationValidityDurationSeconds(if (accessRestrictions.presenceTimeout < 1) -1 else accessRestrictions.presenceTimeout)
                .setUserAuthenticationRequired(accessRestrictions.presenceRequired)
                .setKeyValidityEnd(accessRestrictions.expiresAt)
                .build()
        val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore")
        gen.initialize(spec)
        gen.generateKeyPair()
    }

    /**
     * Wrap a [SecretKey] using the public key assigned to this wrapper.
     * Use [.unwrap] to later recover the original
     * [SecretKey].
     *
     * @return a wrapped version of the given [SecretKey] that can be
     * safely stored on untrusted storage.
     */
    @Throws(GeneralSecurityException::class)
    fun wrap(key: SecretKey): ByteArray {
        mCipher.init(Cipher.WRAP_MODE, mPair.public)
        return mCipher.wrap(key)
    }

    /**
     * Unwrap a [SecretKey] using the private key assigned to this
     * wrapper.
     *
     * @param blob a wrapped [SecretKey] as previously returned by
     * [.wrap].
     */
    @Throws(GeneralSecurityException::class)
    fun unwrap(blob: ByteArray): SecretKey {
        mCipher.init(Cipher.UNWRAP_MODE, mPair.private)
        return mCipher.unwrap(blob, "AES", Cipher.SECRET_KEY) as SecretKey
    }
}