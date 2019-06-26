package pm.kee.vault.data

import com.google.common.base.Strings
import com.google.common.net.InternetDomainName
import pm.kee.vault.model.AutofillDataset
import pm.kee.vault.model.ClientField
import pm.kee.vault.model.DatasetWithFilledAutofillFields
import pm.kee.vault.model.FilledAutofillField
import pm.kee.vault.model.vault.Entry
import pm.kee.vault.model.vault.FormField
import pm.kee.vault.util.Util.logd
import java.util.*
import kotlin.collections.ArrayList

fun matchFields(matchedEntries: List<Entry>, clientViewMetadata: ClientViewMetadata): List<DatasetWithFilledAutofillFields> {
    val datasets = ArrayList<DatasetWithFilledAutofillFields>()
    for (entry in matchedEntries) {
        entry.formFieldList ?: continue
        val dataset = fillManyFormFields(clientViewMetadata.clientFields, entry.formFieldList)
        dataset ?: continue
        dataset.autofillDataset = AutofillDataset(
                entry.uniqueID,
                dataset.highestFieldMatchScore, // TODO: higher score for hostname matches compared to domain only : entry.matchAccuracy
                entry.title,
                "this is for something I suppose")
        datasets.add(dataset)
    }
    return datasets
}


fun getCanonicalDomain(domain: String): String? {
    var idn: InternetDomainName? = InternetDomainName.from(domain)
    while (idn != null && !idn.isTopPrivateDomain) {
        idn = idn.parent()
    }
    return idn?.toString()
}






fun calculateFieldMatchScore(formField: ClientField, dataField: FormField): Int
{
    // Default score is 1 so that bad matches which are at least the correct type
    // have a chance of being selected if no good matches are found
    var score = 1

    // Do not allow any match if field types are significantly mismatched (e.g. checkbox vs text field)
    if ((formField.fieldType == "password" && dataField.type != "FFTpassword") ||
            (formField.fieldType == "text" && dataField.type != "FFTtext" && dataField.type != "FFTusername")) {
        return 0
    }

    // If field IDs match +++++
    if (!formField.htmlId.isNullOrEmpty() && formField.htmlId == dataField.id) {
        score += 50
    } else if (!dataField.id.isNullOrEmpty()) {
        score -= 5
    }

    // If field names match ++++
    // (We do not treat ID and NAME as mutually exclusive because some badly written
    // websites might have duplicate IDs but different names so this combined approach
    // might allow them to work correctly)
    if (!formField.htmlName.isNullOrEmpty() && formField.htmlName == dataField.name) {
        score += 40
    } else if (!dataField.name.isNullOrEmpty()) {
        score -= 5
    }

//    // Radio buttons have their values set by the website and hence can provide
//    // a useful cue when both id and name matching fails
//    if (formField.type == "radio" && formField.value != null && formField.value != undefined
//            && formField.value != "" && formField.value == dataField.value
//    )
//        score += 30;

    score += if (formField.visible) 35 else 0

    return score;
}

fun fillManyFormFields (formFields: List<ClientField>, dataFields: List<FormField>): DatasetWithFilledAutofillFields?
{
    if (formFields.isEmpty() || dataFields.isEmpty()) return null

    // we try to fill every form field. We try to match by id first and then name before just guessing.
    // Generally we'll only fill if the matched field is of the same type as the form field but
    // we are flexible RE text and username fields because that's an artificial difference
    // for the sake of the Kee password management software. However, usernames will be chosen above
    // text fields if all else is equal

    // We want to make sure each data field is matched to only one form field but we
    // don't know which field will be the best match and we don't want to ignore
    // less accurate matches just because they happen to appear later.

    // We create a matrix of objects representing each possible combination of data field
    // and form field and the score for that match.
    // We choose what to fill by sorting that list by score.
    // After filling a field we remove all objects from the list which are for the
    // data field we just filled in and the form field we filled in.

    // This means we always fill each form field only once, with the best match
    // selected from all data fields that haven't already been selected for another form field

    // The above algorithm could maybe be tweaked slightly in order to auto-fill
    // a "change password" form if we ever manage to make that automated

    // (score is reduced by one for each position we find in the form - this gives
    // a slight priority to fields at the top of a form which can be useful occasionally)

    val fieldScoreMatrix = calculateAllScores(formFields, dataFields)

    fieldScoreMatrix.sortByDescending { s -> s.score }

    val filledFields = DatasetWithFilledAutofillFields()
    filledFields.highestFieldMatchScore = fieldScoreMatrix[0].score

    // Keep filling in fields until we find no more with a positive score
    while (fieldScoreMatrix.size > 0 && fieldScoreMatrix[0].score > 0)
    {
        val ffi = fieldScoreMatrix[0].formFieldIndex;
        val dfi = fieldScoreMatrix[0].dataFieldIndex;

        logd("We will populate field " + ffi + " (id:" + formFields[ffi].htmlId + ")")

        filledFields.add(FilledAutofillField(formFields[ffi].autofillId, UUID.randomUUID().toString(), formFields[ffi].htmlName, dataFields[dfi].value))
        //id: formFields[ffi].fieldId,

        fieldScoreMatrix.retainAll { s -> s.dataFieldIndex != dfi && s.formFieldIndex != ffi }
    }
    return filledFields
}

private fun calculateAllScores(formFields: List<ClientField>, dataFields: List<FormField>): ArrayList<Score> {
    val fieldScoreMatrix = ArrayList<Score>()

    for ((i, formField) in formFields.withIndex()) {
        for ((j, dataField) in dataFields.withIndex()) {
            val score = calculateFieldMatchScore(formField, dataField)
            logd("Suitability of putting data field " + j + " into form field " + i
                    + " (id: " + formField.htmlId + ") is " + score)
            fieldScoreMatrix.add(Score(score, j, i))
        }
    }
    return fieldScoreMatrix
}