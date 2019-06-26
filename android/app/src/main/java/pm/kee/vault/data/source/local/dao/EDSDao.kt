package pm.kee.vault.data.source.local.dao

import com.google.gson.Gson
import pm.kee.vault.data.EncryptedDataStorage
import java.util.Arrays

import pm.kee.vault.model.AutofillDataset
import pm.kee.vault.model.AutofillHint
import pm.kee.vault.model.DatasetWithFilledAutofillFields
import pm.kee.vault.model.FieldType
import pm.kee.vault.model.FieldTypeWithHints
import pm.kee.vault.model.FilledAutofillField
import pm.kee.vault.model.vault.Entry
import pm.kee.vault.model.vault.Group
import pm.kee.vault.model.vault.KeeVaultState
import pm.kee.vault.model.vault.Vault

class EDSDao(private val eds: EncryptedDataStorage) {


//
//    val allDatasets: List<DatasetWithFilledAutofillFields>
//        get() = Arrays.asList(object : DatasetWithFilledAutofillFields() {
//            init {
//                filledAutofillFields = Arrays.asList(
//                        FilledAutofillField("1", "username", "my username 1"),
//                        FilledAutofillField("1", "password", "my password 1"))
//                autofillDataset = AutofillDataset("1", "2", "3")
//            }
//        },
//                object : DatasetWithFilledAutofillFields() {
//                    init {
//                        filledAutofillFields = Arrays.asList(
//                                FilledAutofillField("2", "username", "my username 2"),
//                                FilledAutofillField("2", "password", "my password 2"))
//                        autofillDataset = AutofillDataset("2", "4", "5")
//                    }
//                }
//        )
//
//    private fun getAllDatasets() : List<DatasetWithFilledAutofillFields>
//        {
//            var gson = Gson()
////            var jsonString = gson.toJson(TestModel(1,"Test"))
//            val json = eds.getJSON()
//            var testModel = gson.fromJson(json, KeeVaultState::class.java)
//            return Arrays.asList(object : DatasetWithFilledAutofillFields() {
//            init {
//                filledAutofillFields = Arrays.asList(
//                        FilledAutofillField("1", "username", "my username 1"),
//                        FilledAutofillField("1", "password", "my password 1"))
//                autofillDataset = AutofillDataset("1", "2", "3")
//            }
//        },
//                object : DatasetWithFilledAutofillFields() {
//                    init {
//                        filledAutofillFields = Arrays.asList(
//                                FilledAutofillField("2", "username", "my username 2"),
//                                FilledAutofillField("2", "password", "my password 2"))
//                        autofillDataset = AutofillDataset("2", "4", "5")
//                    }
//                }
//        )
//        }

    //TODO: probably want to match on email hints too and get rid of below type?
    //return null;
    val fieldTypesWithHints: List<FieldTypeWithHints>
        get() = Arrays.asList(
                object : FieldTypeWithHints() {
                    init {
                        fieldType = FieldType("password", Arrays.asList(1), 1, 0)
                        autofillHints = Arrays.asList(AutofillHint("password", "password"),
                                AutofillHint("current-password", "password"))
                    }
                },
                object : FieldTypeWithHints() {
                    init {
                        fieldType = FieldType("username", Arrays.asList(1), 1, 0)
                        autofillHints = Arrays.asList(AutofillHint("username", "username"),
                                AutofillHint("user", "username"))
                    }
                },
                object : FieldTypeWithHints() {
                    init {
                        fieldType = FieldType("emailAddress", Arrays.asList(1, 3), 16, 2)
                        autofillHints = Arrays.asList(AutofillHint("emailAddress", "emailAddress"),
                                AutofillHint("email", "emailAddress"))
                    }
                }
        )
//
//    tailrec fun <A, B> fold(init: B, col: Collection<A>, f: (A, B) -> B): B = if (col.isEmpty()) init else {
//        val head = col.take(1)[0]
//        fold(f(head, init), col.drop(1), f)
//    }
//
    private fun groupsSelector (g: Group): List<Group> = g.childGroups ?: emptyList()
    private fun entriesSelector (g: Group): List<Entry> = g.childEntries ?: emptyList()
    private fun entryAccumulator (list: List<Entry>, e: Entry): List<Entry> {
        return list + e
    }
    private fun <T> traverse(group: Group, init: T, acc: (T, Entry) -> T): T {
        var accumulated = entriesSelector(group).fold(init, acc)
        groupsSelector(group).forEach { accumulated = traverse(it, accumulated, acc) }
        return accumulated
    }
//            fold(init, Files.list(root).toList(),
//                    {path, acc -> if (! group.) f(path, acc) else if (! Files.isSymbolicLink(path)) traverse(path, acc, f) else acc})
//
//    fun main(args: Array<String>) {
//        val f = {path: Path, acc: String -> "$acc\n${path.toAbsolutePath()}"}
//        val g = {path: Path, acc: Long -> acc + Files.size(path)}
//        println(traverse(Paths.get(args[0]), "", f))
//        println(traverse(Paths.get(args[0]), 0, g))
//    }

    fun getMatchingEntries(url: String, isHTTPS: Boolean?): List<Entry> {
        try {
            var gson = Gson()
            val json = eds.getString()
            var model = gson.fromJson(json, Vault::class.java)

//        model ?: throw SecurityException()
            model ?: return emptyList()
//        if (model.config.expiry <= System.currentTimeMillis()) throw SecurityException("expired")

            //TODO: consider URLs, whether we know it should be https, and configs to produce list
            return traverse(model.dbs!![0]?.root!!, ArrayList(), ::entryAccumulator)
        } catch (e: Exception) {
            throw SecurityException("error", e)
        }
    }
//
//    /**
//     * Fetches a list of datasets associated to autofill fields. It should only return a dataset
//     * if that dataset has an autofill field associate with the view the user is focused on, and
//     * if that dataset's name matches the name passed in.
//     *
//     * @param fieldTypes  Filtering parameter; represents all of the field types associated with
//     * all of the views on the page.
//     * @param datasetName Filtering parameter; only return datasets with this name.
//     */
//    fun getDatasetsWithName(
//            fieldTypes: List<String>, datasetName: String): List<DatasetWithFilledAutofillFields> {
//        return getMatchingEntries("bullshit", null)
//    }

    fun getFieldTypesForAutofillHints(autofillHints: List<String>): List<FieldTypeWithHints> {
        return fieldTypesWithHints.filter { f -> f.autofillHints.any { h1 -> autofillHints.any { h2 -> h2 === h1.mFieldTypeName } } }
    }

    fun getAutofillDatasetWithId(datasetId: String): DatasetWithFilledAutofillFields? {
        return null
    }

    fun getFilledAutofillField(datasetId: String, fieldTypeName: String): FilledAutofillField? {
        return null
    }

    fun getFieldType(fieldTypeName: String): FieldType? {
        //TODO: Maybe this should be mapped to existing field types in KPRPC?
        when (fieldTypeName) {
            "emailAddress" -> return FieldType(fieldTypeName, Arrays.asList(1, 3), 16, 2)
            "password" -> return FieldType(fieldTypeName, Arrays.asList(1), 1, 0)
            "name" -> return FieldType(fieldTypeName, Arrays.asList(1, 3), 0, 0)
            "new-password" -> return FieldType(fieldTypeName, Arrays.asList(1), 1, 0)
            "username" -> return FieldType(fieldTypeName, Arrays.asList(1, 3), 8, 0)
        }
        return null
    }

    /**
     * @param autofillFields Collection of autofill fields to be saved to the db.
     */
    fun insertFilledAutofillFields(autofillFields: Collection<FilledAutofillField>) {

    }

    fun insertAutofillDataset(datasets: AutofillDataset) {

    }

    //    public void insertAutofillHints(List<AutofillHint> autofillHints) {
    //
    //    }
    //
    //    public void insertResourceIdHeuristic(ResourceIdHeuristic resourceIdHeuristic) {
    //
    //    }
    //
    //    public void insertFieldTypes(List<FieldType> fieldTypes) {
    //
    //    }

    fun clearAll() {

    }
}