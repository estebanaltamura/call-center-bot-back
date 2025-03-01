"use strict";
// ** Types
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptComponentsEnum = exports.StateTypes = exports.ConversationStatusEnum = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["conversations"] = "conversations";
    Entities["systemPrompt"] = "systemPrompt";
    Entities["settings"] = "settings";
    Entities["business"] = "business";
    Entities["assistant"] = "assistant";
    Entities["rules"] = "rules";
    Entities["knowledge"] = "knowledge";
    Entities["hats"] = "hats";
    Entities["stats_newConversations"] = "stats_newConversations";
    Entities["stats_returnedConversations"] = "stats_returnedConversations";
    Entities["stats_leads"] = "stats_leads";
    Entities["stats_sales"] = "stats_sales";
    Entities["stats_whatsappApiCost"] = "stats_whatsappApiCost";
    Entities["stats_iaCost"] = "stats_iaCost";
    Entities["stats_facebookAdsCost"] = "stats_facebookAdsCost";
    Entities["stats_googleAdsCost"] = "stats_googleAdsCost";
})(Entities || (exports.Entities = Entities = {}));
var ConversationStatusEnum;
(function (ConversationStatusEnum) {
    ConversationStatusEnum["INPROGRESS"] = "inProgress";
    ConversationStatusEnum["LEAD"] = "lead";
    ConversationStatusEnum["NOLEAD"] = "noLead";
    ConversationStatusEnum["NOEVALUABLE"] = "noEvaluable";
})(ConversationStatusEnum || (exports.ConversationStatusEnum = ConversationStatusEnum = {}));
var StateTypes;
(function (StateTypes) {
    StateTypes["active"] = "active";
    StateTypes["inactive"] = "inactive";
})(StateTypes || (exports.StateTypes = StateTypes = {}));
var PromptComponentsEnum;
(function (PromptComponentsEnum) {
    PromptComponentsEnum["ASSISTANT"] = "ASSISTANT";
    PromptComponentsEnum["RULE"] = "RULE";
    PromptComponentsEnum["KNOWLEDGE"] = "KNOWLEDGE";
    PromptComponentsEnum["BUSINESS"] = "BUSINESS";
})(PromptComponentsEnum || (exports.PromptComponentsEnum = PromptComponentsEnum = {}));
