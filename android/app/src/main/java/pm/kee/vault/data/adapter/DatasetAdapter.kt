/*
 * Copyright (C) 2017 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package pm.kee.vault.data.adapter

import android.app.assist.AssistStructure
import android.content.IntentSender
import android.service.autofill.Dataset
import android.util.MutableBoolean
import android.view.View
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews

import java.util.Arrays
import java.util.HashMap
import java.util.function.Function

import pm.kee.vault.AutofillHints
import pm.kee.vault.ClientParser
import pm.kee.vault.model.DatasetWithFilledAutofillFields
import pm.kee.vault.model.FieldType
import pm.kee.vault.model.FieldTypeWithHints
import pm.kee.vault.model.FilledAutofillField

import java.util.stream.Collectors.toMap
import pm.kee.vault.util.Util.indexOf
import pm.kee.vault.util.Util.logv
import pm.kee.vault.util.Util.logw

class DatasetAdapter(private val mClientParser: ClientParser) {

    /**
     * Wraps autofill data in a [Dataset] object which can then be sent back to the client.
     */
    fun buildDatasetForFocusedNode(filledAutofillField: FilledAutofillField,
                                   fieldType: FieldType, remoteViews: RemoteViews): Dataset? {
        val datasetBuilder = Dataset.Builder(remoteViews)
        val setAtLeastOneValue = bindDatasetToFocusedNode(filledAutofillField,
                fieldType, datasetBuilder)
        return if (!setAtLeastOneValue) { null } else datasetBuilder.build()
    }

    /**
     * Wraps autofill data in a [Dataset] object with an IntentSender, which can then be
     * sent back to the client.
     */
    @JvmOverloads
    fun buildDataset(fieldTypesByAutofillHint: HashMap<String, FieldTypeWithHints>,
                     datasetWithFilledAutofillFields: DatasetWithFilledAutofillFields,
                     remoteViews: RemoteViews, intentSender: IntentSender? = null): Dataset? {
        val datasetBuilder = Dataset.Builder(remoteViews)
        if (intentSender != null) {
            datasetBuilder.setAuthentication(intentSender)
        }
        val setAtLeastOneValue = bindDataset(fieldTypesByAutofillHint,
                datasetWithFilledAutofillFields, datasetBuilder)
        return if (!setAtLeastOneValue) {
            null
        } else datasetBuilder.build()
    }

    /**
     * Build an autofill [Dataset] using saved data and the client's AssistStructure.
     */
    private fun bindDataset(fieldTypesByAutofillHint: HashMap<String, FieldTypeWithHints>,
                            datasetWithFilledAutofillFields: DatasetWithFilledAutofillFields,
                            datasetBuilder: Dataset.Builder): Boolean {
        val setValueAtLeastOnce = MutableBoolean(false)
        if (datasetWithFilledAutofillFields.filledAutofillFields == null) return false
        //        Map<String, FilledAutofillField> filledAutofillFieldsByTypeName =
        //                datasetWithFilledAutofillFields.filledAutofillFields.stream()
        //                        .collect(toMap(FilledAutofillField::getFieldTypeName, Function.identity()));
        mClientParser.parse { node ->
            parseAutofillFields(node, datasetWithFilledAutofillFields.filledAutofillFields,
                    datasetBuilder, setValueAtLeastOnce)
        }
        return setValueAtLeastOnce.value
    }

    private fun bindDatasetToFocusedNode(field: FilledAutofillField,
                                         fieldType: FieldType, builder: Dataset.Builder): Boolean {
        val setValueAtLeastOnce = MutableBoolean(false)
        mClientParser.parse { node ->
            if (node.isFocused && node.autofillId != null) {
                bindValueToNode(node, field, builder, setValueAtLeastOnce)
            }
        }
        return setValueAtLeastOnce.value
    }

    private fun parseAutofillFields(viewNode: AssistStructure.ViewNode,
                                    fields: List<FilledAutofillField>,
                                    builder: Dataset.Builder, setValueAtLeastOnce: MutableBoolean) {
        val autofillId = viewNode.autofillId
        if (autofillId == null) {
            logw("Autofill ID null for %s", viewNode.toString())
            return
        }
        for (field in fields) {
            if (autofillId.equals(field.autofillId)) {
                bindValueToNode(viewNode, fields[0], builder, setValueAtLeastOnce)
            }
        }
    }

    //
    //    private void parseAutofillFields(AssistStructure.ViewNode viewNode,
    //            HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint,
    //            Map<String, FilledAutofillField> filledAutofillFieldsByTypeName,
    //            Dataset.Builder builder, MutableBoolean setValueAtLeastOnce) {
    //        String[] rawHints = viewNode.getAutofillHints();
    //        if (rawHints == null || rawHints.length == 0) {
    //            logv("No af hints at ViewNode - %s", viewNode.getIdEntry());
    //            return;
    //        }
    //        String fieldTypeName = AutofillHints.getFieldTypeNameFromAutofillHints(
    //                fieldTypesByAutofillHint, Arrays.asList(rawHints));
    //        if (fieldTypeName == null) {
    //            return;
    //        }
    //        FilledAutofillField field = filledAutofillFieldsByTypeName.get(fieldTypeName);
    //        if (field == null) {
    //            return;
    //        }
    //        bindValueToNode(viewNode, field, builder, setValueAtLeastOnce);
    //    }

    internal fun bindValueToNode(viewNode: AssistStructure.ViewNode,
                                 field: FilledAutofillField, builder: Dataset.Builder,
                                 setValueAtLeastOnce: MutableBoolean) {
        val autofillId = viewNode.autofillId
        val autofillType = viewNode.autofillType
        when (autofillType) {
            View.AUTOFILL_TYPE_LIST -> {
                val options = viewNode.autofillOptions
                var listValue = -1
                if (options != null) {
                    listValue = indexOf(viewNode.autofillOptions!!, field.textValue)
                }
                if (listValue != -1) {
                    builder.setValue(autofillId!!, AutofillValue.forList(listValue))
                    setValueAtLeastOnce.value = true
                }
            }
            View.AUTOFILL_TYPE_DATE -> {
                val dateValue = field.dateValue
                if (dateValue != null) {
                    builder.setValue(autofillId!!, AutofillValue.forDate(dateValue))
                    setValueAtLeastOnce.value = true
                }
            }
            View.AUTOFILL_TYPE_TEXT -> {
                val textValue = field.textValue
                if (textValue != null) {
                    builder.setValue(autofillId!!, AutofillValue.forText(textValue))
                    setValueAtLeastOnce.value = true
                }
            }
            View.AUTOFILL_TYPE_TOGGLE -> {
                val toggleValue = field.toggleValue
                if (toggleValue != null) {
                    builder.setValue(autofillId!!, AutofillValue.forToggle(toggleValue))
                    setValueAtLeastOnce.value = true
                }
            }
            View.AUTOFILL_TYPE_NONE -> logw("Invalid autofill type - %d", autofillType)
            else -> logw("Invalid autofill type - %d", autofillType)
        }
    }
}