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

package pm.kee.vault.data;

import android.app.assist.AssistStructure;
import android.os.Build;
import android.util.MutableInt;
import android.util.Pair;
import android.view.View;
import android.view.ViewStructure;
import android.view.autofill.AutofillId;

import com.google.common.base.Strings;

import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import pm.kee.vault.ClientParser;
import pm.kee.vault.model.ClientField;
import pm.kee.vault.model.FieldType;
import pm.kee.vault.model.FieldTypeWithHints;

import static android.text.InputType.TYPE_CLASS_TEXT;
import static android.text.InputType.TYPE_NULL;
import static android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS;
import static android.text.InputType.TYPE_TEXT_VARIATION_NORMAL;
import static android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD;
import static android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD;
import static android.text.InputType.TYPE_TEXT_VARIATION_WEB_EDIT_TEXT;
import static android.text.InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS;
import static android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD;
import static pm.kee.vault.util.Util.logd;
import static pm.kee.vault.util.Util.logw;

public class ClientViewMetadataBuilder {
    private ClientParser mClientParser;
    private HashMap<String, FieldTypeWithHints> mFieldTypesByAutofillHint;

    public ClientViewMetadataBuilder(ClientParser parser,
            HashMap<String, FieldTypeWithHints> fieldTypesByAutofillHint) {
        mClientParser = parser;
        mFieldTypesByAutofillHint = fieldTypesByAutofillHint;
    }

    public ClientViewMetadata buildClientViewMetadata() {
        List<String> allHints = new ArrayList<>();
        MutableInt saveType = new MutableInt(0);
        List<AutofillId> autofillIds = new ArrayList<>();
        StringBuilder webDomainBuilder = new StringBuilder();
        List<AutofillId> focusedAutofillIds = new ArrayList<>();
        List<ClientField> clientFields = new ArrayList<>();
        AtomicBoolean isHTTPS = new AtomicBoolean();
        logw("fields: " + clientFields.size());
        mClientParser.parse((node) -> parseNode(node, allHints, saveType, autofillIds, focusedAutofillIds, clientFields));
        mClientParser.parse((node) -> parseWebDomain(node, webDomainBuilder, isHTTPS));
        logw("fields end: " + clientFields.size());
        String webDomain = webDomainBuilder.toString();
        AutofillId[] autofillIdsArray = autofillIds.toArray(new AutofillId[autofillIds.size()]);
        AutofillId[] focusedIds = focusedAutofillIds.toArray(new AutofillId[focusedAutofillIds.size()]);
        return new ClientViewMetadata(allHints, saveType.value, autofillIdsArray, focusedIds, webDomain, clientFields, isHTTPS.get());
    }

    private void parseWebDomain(AssistStructure.ViewNode viewNode, StringBuilder validWebDomain, AtomicBoolean isHTTPS) {
        String webDomain = viewNode.getWebDomain();
        if (webDomain != null) {
            logd("child web domain: %s", webDomain);
            if (validWebDomain.length() > 0) {
                if (!webDomain.equals(validWebDomain.toString())) {
                    throw new SecurityException("Found multiple web domains: valid= "
                            + validWebDomain + ", child=" + webDomain);
                }
            } else {
                validWebDomain.append(webDomain);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                isHTTPS.set(viewNode.getWebScheme().equals("https") ? true : false);
            }

        }
    }

    private void parseNode(AssistStructure.ViewNode node, List<String> allHints,
                           MutableInt autofillSaveType, List<AutofillId> autofillIds,
                           List<AutofillId> focusedAutofillIds, List<ClientField> clientFields) {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            int important = node.getImportantForAutofill();
            if (important == View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS ||
                    important == View.IMPORTANT_FOR_AUTOFILL_NO) {
                return;
            }
        }

        String htmlId = null;
        String htmlType = null;
        String htmlName = null;
        String htmlValue;
        String htmlClass;
        String htmlAutocomplete;
        ViewStructure.HtmlInfo htmlInfo = node.getHtmlInfo();
        if (htmlInfo != null) {
            if (!htmlInfo.getTag().equals("input")) return; //TODO: support SELECT and maybe others?
            List<Pair<String, String>> attrs = htmlInfo.getAttributes();
            for (Pair<String, String> p : attrs) {
                switch (p.first) {
                    case "id": htmlId = p.second; break;
                    case "type": htmlType = evaluateHtmlType(p.second); break;
                    case "name": htmlName = p.second; break;
                    case "value": htmlValue = p.second; break;
                    case "class": htmlClass = p.second; break;
                    case "autocomplete": htmlAutocomplete = p.second; break;
                }
            }
        }

        String[] hints = node.getAutofillHints();
        ArrayList<FieldTypeWithHints> typesFromHints = new ArrayList<>();
        if (hints != null) {
            for (String hint : hints) {
                FieldTypeWithHints fieldTypeWithHints = mFieldTypesByAutofillHint.get(hint);
                if (fieldTypeWithHints != null && fieldTypeWithHints.fieldType != null) {
                    allHints.add(hint);
                    autofillSaveType.value |= fieldTypeWithHints.fieldType.getSaveInfo();
                    typesFromHints.add(fieldTypeWithHints);
                }
            }
        }
        if (node.isFocused()) {
            focusedAutofillIds.add(node.getAutofillId());
        }

        String hintType = evaluateHintType(typesFromHints);
        String inputType = evaluateInputType(node.getInputType());
        String likelyType = determineType(htmlType, hintType, inputType);
        if (!likelyType.equals("text") && !likelyType.equals("password")) {
            return; // TODO: Support OTP and maybe other field types?
        }

        // TODO: node.getMaxTextLength() (API 28) and/or html maxlength attributes

        ClientField field = new ClientField(node.getAutofillId(), likelyType, htmlId, htmlName, node.getVisibility() == View.VISIBLE);
        clientFields.add(field);
        autofillIds.add(node.getAutofillId());
    }

    private String evaluateHtmlType(String t) {
        switch (t) {
            case "password":
                return "password";
            case "checkbox":
            case "select-one":
            case "radio":
            case "hidden":
            case "submit":
            case "button":
            case "file":
            case "image":
            case "reset":
                return "other";
            default:
                return "text";
        }
    }

    private String evaluateHintType(ArrayList<FieldTypeWithHints> typesFromHints) {
        String hintType = null;
        for (FieldTypeWithHints t : typesFromHints) {
            if (t.fieldType.getTypeName().equals("new-password") || t.fieldType.getTypeName().equals("password")) {
                // do a thing
                if (hintType != null && !hintType.equals("password")) {
                    hintType = null; // inconsistent hints from View so must ignore
                    break;
                }
                hintType = "password";
            } else if (t.fieldType.getTypeName().equals("emailAddress") || t.fieldType.getTypeName().equals("name")
                    || t.fieldType.getTypeName().equals("username")) {
                // do a thing
                if (hintType != null && !hintType.equals("text")) {
                    hintType = null; // inconsistent hints from View so must ignore
                    break;
                }
                hintType = "text";
            }
        }
        return hintType;
    }

    private String determineType (String htmlType, String hintType, String inputType) {
        if (!Strings.isNullOrEmpty(hintType)) {
            return hintType;
        }
        if (!Strings.isNullOrEmpty((inputType)) && !inputType.equals("unknown")) {
            return inputType;
        }
        if (!Strings.isNullOrEmpty(htmlType)) {
            return htmlType;
        }
        return "unknown";
    }

    private String evaluateInputType (Integer inputType) {

        switch (inputType) {
            case TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_EMAIL_ADDRESS:
            case TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_NORMAL:
            case TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_WEB_EDIT_TEXT:
            case TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS:
                return "text";
            case TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_VISIBLE_PASSWORD:
            case TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_PASSWORD:
            case TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_WEB_PASSWORD:
                return "password";
            case TYPE_NULL:
                return "unknown";
        }
        return "other";
        /*
OTP?:
TYPE_CLASS_NUMBER | TYPE_NUMBER_VARIATION_NORMAL
TYPE_CLASS_NUMBER | TYPE_NUMBER_VARIATION_PASSWORD

post-MVP maybe want to implement a blacklist to treat more aggressively than "other":
TYPE_CLASS_TEXT | TYPE_TEXT_FLAG_MULTI_LINE
TYPE_CLASS_TEXT | TYPE_TEXT_FLAG_IME_MULTI_LINE
TYPE_CLASS_TEXT | TYPE_TEXT_FLAG_AUTO_COMPLETE
TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_FILTER
TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_EMAIL_SUBJECT
TYPE_CLASS_TEXT | TYPE_TEXT_VARIATION_POSTAL_ADDRESS
         */
    }
}
