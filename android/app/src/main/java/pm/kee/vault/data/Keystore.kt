//package pm.kee.vault.data
//
///* This Source Code Form is subject to the terms of the Mozilla Public
// * License, v. 2.0. If a copy of the MPL was not distributed with this
// * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
//// https://github.com/mozilla-mobile/android-components/tree/master/components
//// /lib/dataprotect/src/main/java/mozilla/components/lib/dataprotect
//
//import android.annotation.TargetApi
//import android.os.Build
//import android.security.keystore.KeyGenParameterSpec
//import android.security.keystore.KeyProperties
//import pm.kee.vault.util.Util.loge
//import java.security.*
//import javax.crypto.Cipher
//import javax.crypto.KeyGenerator
//import javax.crypto.SecretKey
//import javax.crypto.spec.GCMParameterSpec
//import android.provider.SyncStateContract.Helpers.update
//import java.io.ByteArrayInputStream
//import java.io.ByteArrayOutputStream
//import java.io.DataOutputStream
//import java.nio.file.Files.exists
//
//
//
//
///**
// * Exception type thrown by {@link Keystore} when an error is encountered that
// * is not otherwise covered by an existing sub-class to `GeneralSecurityException`.
// *
// */
//class KeystoreException(
//        message: String? = null,
//        cause: Throwable? = null
//) : GeneralSecurityException(message, cause)
//
//private const val KEYSTORE_TYPE = "AndroidKeyStore"
//private const val ENCRYPTED_VERSION = 0x02
//
//internal const val CIPHER_ALG = KeyProperties.KEY_ALGORITHM_AES
//internal const val CIPHER_MOD = KeyProperties.BLOCK_MODE_GCM
//internal const val CIPHER_PAD = KeyProperties.ENCRYPTION_PADDING_NONE
//internal const val CIPHER_KEY_LEN = 256
//internal const val CIPHER_TAG_LEN = 128
//internal const val CIPHER_SPEC = "$CIPHER_ALG/$CIPHER_MOD/$CIPHER_PAD"
//
//internal const val CIPHER_NONCE_LEN = 12
////
/////**
//// * Wraps the critical functions around a Java KeyStore to better facilitate testing
//// * and instrumenting.
//// *
//// */
////@TargetApi(Build.VERSION_CODES.M)
////open class KeyStoreWrapper {
////    private var keystore: KeyStore? = null
////
////    /**
////     * Retrieves the underlying KeyStore, loading it if necessary.
////     */
////    fun getKeyStore(): KeyStore {
////        var ks = keystore
////        if (ks == null) {
////            ks = loadKeyStore()
////            keystore = ks
////        }
////
////        return ks
////    }
////
////    /**
////     * Retrieves the SecretKey for the given label.
////     *
////     * This method queries for a SecretKey with the given label and no passphrase.
////     *
////     * Subclasses override this method if additional properties are needed
////     * to retrieve the key.
////     *
////     * @param label The label to query
////     * @return The key for the given label, or `null` if not present
////     * @throws InvalidKeyException If there is a Key but it is not a SecretKey
////     * @throws NoSuchAlgorithmException If the recovery algorithm is not supported
////     * @throws UnrecoverableKeyException If the key could not be recovered for some reason
////     */
////    open fun getKeyFor(label: String): Key? =
////            loadKeyStore().getKey(label, null)
////
////    /**
////     * Creates a SecretKey for the given label.
////     *
////     * This method generates a SecretKey pre-bound to the `AndroidKeyStore` and configured
////     * with the strongest "algorithm/blockmode/padding" (and key size) available.
////     *
////     * Subclasses override this method to properly associate the generated key with
////     * the given label in the underlying KeyStore.
////     *
////     * @param label The label to associate with the created key
////     * @return The newly-generated key for `label`
////     * @throws NoSuchAlgorithmException If the cipher algorithm is not supported
////     */
////    open fun makeKeyFor(label: String, accessRestrictions: AccessRestrictions): SecretKey {
////        val spec = KeyGenParameterSpec.Builder(label,
////                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
////                .setKeySize(CIPHER_KEY_LEN)
////                .setBlockModes(CIPHER_MOD)
////                .setEncryptionPaddings(CIPHER_PAD)
////                .setUserAuthenticationValidityDurationSeconds(if (accessRestrictions.presenceTimeout < 1) -1 else accessRestrictions.presenceTimeout)
////                .setUserAuthenticationRequired(accessRestrictions.presenceRequired)
////                .setKeyValidityEnd(accessRestrictions.expiresAt)
////                .build()
////        val gen = KeyGenerator.getInstance(CIPHER_ALG, KEYSTORE_TYPE)
////        gen.init(spec)
////        return gen.generateKey()
////    }
////
////    /**
////     * Deletes a key with the given label.
////     *
////     * @param label The label of the associated key to delete
////     * @throws KeyStoreException If there is no key for `label`
////     */
////    fun removeKeyFor(label: String) {
////        getKeyStore().deleteEntry(label)
////    }
////
////    /**
////     * Creates and initializes the KeyStore in use.
////     *
////     * This method loads a`"AndroidKeyStore"` type KeyStore.
////     *
////     * Subclasses override this to load a KeyStore appropriate to the testing environment.
////     *
////     * @return The KeyStore, already initialized
////     * @throws KeyStoreException if the type of store is not supported
////     */
////    open fun loadKeyStore(): KeyStore {
////        val ks = KeyStore.getInstance(KEYSTORE_TYPE)
////        ks.load(null)
////        return ks
////    }
////}
//
///**
// * Manages data protection using a system-isolated cryptographic key.
// *
// * This class provides for both:
// * * management for a specific crypto graphic key (identified by a string label)
// * * protection (encryption/decryption) of data using the managed key
// *
// * The specific cryptographic properties are pre-chosen to be the following:
// * * Algorithm is "AES/GCM/NoPadding"
// * * Key size is 256 bits
// * * Tag size is 128 bits
// *
// * @property label The label the cryptographic key is identified as
// * @constructor Creates a new instance around a key identified by the given label
// *
// * Unless `manual` is `true`, the key is created if not already present in the
// * platform's key storage.
// */
//@TargetApi(Build.VERSION_CODES.M)
//open class Keystore(
//        val label: String,
//        val accessRestrictions: AccessRestrictions,
//        manual: Boolean = false
////        internal val wrapper: KeyStoreWrapper = KeyStoreWrapper()
//) {
//    init {
//        if (!manual and !available()) {
//            generateKey()
//        }
//    }
//
//    private fun getKey(): SecretKey? =
//            wrapper.getKeyFor(label) as? SecretKey?
//
//    /**
//     * Determines if the managed key is available for use.  Consumers can use this to
//     * determine if the key was somehow lost and should treat any previously-protected
//     * data as invalid.
//     *
//     * @return `true` if the managed key exists and ready for use.
//     */
//    fun available(): Boolean = (getKey() != null)
//
//    /**
//     * Generates the managed key if it does not already exist.
//     *
//     * @return `true` if a new key was generated; `false` if the key already exists and can
//     * be used.
//     * @throws GeneralSecurityException If the key could not be created
//     */
//    @Throws(GeneralSecurityException::class)
//    fun generateKey(): Boolean {
//        val key = wrapper.getKeyFor(label)
//        if (key != null) {
//            when (key) {
//                is SecretKey -> return false
//                else -> throw InvalidKeyException("unsupported key type")
//            }
//        }
//
//        wrapper.makeKeyFor(label, accessRestrictions)
//
//        return true
//    }
//
//    /**
//     *  Deletes the managed key.
//     *
//     *  **NOTE:** Once this method returns, any data protected with the (formerly) managed
//     *  key cannot be decrypted and therefore is inaccessble.
//     */
//    fun deleteKey() {
//        val key = wrapper.getKeyFor(label)
//        if (key != null) {
//            wrapper.removeKeyFor(label)
//        }
//    }
//
//}
