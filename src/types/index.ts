// ** Types
import admin from "firebase-admin";

export enum Entities {
  'reviews' = 'reviews',
  'messages' = 'messages',
  'conversations' = 'conversations',
  'systemPrompt' = 'systemPrompt',
  'settings' = 'settings',
  'business' = 'business',
  'assistant' = 'assistant',
  'rules' = 'rules',
  'knowledge' = 'knowledge',
  'hats' = 'hats',
  'leads' = 'leads',
  'sales' = 'sales',
  'stats_newConversations' = 'stats_newConversations',
  'stats_returnedConversations' = 'stats_returnedConversations',
  'stats_leads' = 'stats_leads',
  'stats_sales' = 'stats_sales',
  'stats_whatsappApiCost' = 'stats_whatsappApiCost',
  'stats_iaCost' = 'stats_iaCost',
  'stats_facebookAdsCost' = 'stats_facebookAdsCost',
  'stats_googleAdsCost' = 'stats_googleAdsCost',
  'stats_iaCostPlatform' = 'stats_iaCostPlatform',
  'stats_firebaseCostPlatfrom' = 'stats_firebaseCostPlatfrom',
  'scenes_Stats' = 'scenes_Stats',
}

export type EntityTypesMapReturnedValues = {
  [Entities.reviews]: IReviewsEntity;
  [Entities.messages]: IMessageEntity;
  [Entities.conversations]: IConversationsEntity;
  [Entities.systemPrompt]: ISystemPromptEntity;
  [Entities.settings]: ISettingsEntity;

  // Prompt
  [Entities.business]: IBusinessEntity;
  [Entities.assistant]: IAssistantEntity;
  [Entities.rules]: IRulesEntity;
  [Entities.knowledge]: IKnowledgeEntity;
  [Entities.hats]: IHatEntity;

  // Leads
  [Entities.leads]: ILeadsEntity;

  // Sales
  [Entities.sales]: ISalesEntity;

  // Estadisticas
  [Entities.stats_newConversations]: IStats_newConversationsEntity;
  [Entities.stats_returnedConversations]: IStats_returnedConversationsEntity;
  [Entities.stats_leads]: IStats_leadsEntity;
  [Entities.stats_sales]: IStats_salesEntity;
  [Entities.stats_whatsappApiCost]: IStats_whatsappApiCostEntity;
  [Entities.stats_iaCost]: IStats_iaCostEntity;
  [Entities.stats_facebookAdsCost]: IStats_facebookAdsCostEntity;
  [Entities.stats_googleAdsCost]: IStats_googleAdsCostEntity;
  [Entities.scenes_Stats]: IScenesStatsEntity;
  [Entities.stats_iaCostPlatform]: IStats_iaCostPlatformEntity;
  [Entities.stats_firebaseCostPlatfrom]: IStats_firebaseCostPlatfromEntity;
};

export type EntityTypesMapPayloadValues = {
  [Entities.reviews]: IReview;
  [Entities.messages]: IMessage;
  [Entities.conversations]: IConversations;
  [Entities.systemPrompt]: ISystemPrompt;
  [Entities.settings]: ISettings;
  [Entities.business]: IBusiness;
  [Entities.assistant]: IAssistant;
  [Entities.rules]: IRules;
  [Entities.knowledge]: IKnowledge;
  [Entities.hats]: IHat;
  [Entities.leads]: ILead;
  [Entities.sales]: ISales;
  [Entities.stats_newConversations]: IStats_newConversations;
  [Entities.stats_returnedConversations]: IStats_returnedConversations;
  [Entities.stats_leads]: IStats_leads;
  [Entities.stats_sales]: IStats_sales;
  [Entities.stats_whatsappApiCost]: IStats_whatsappApiCost;
  [Entities.stats_iaCost]: IStats_iaCost;
  [Entities.stats_facebookAdsCost]: IStats_facebookAdsCost;
  [Entities.stats_googleAdsCost]: IStats_googleAdsCost;
  [Entities.scenes_Stats]: IScenesStats;
  [Entities.stats_iaCostPlatform]: IStats_iaCostPlatform;
  [Entities.stats_firebaseCostPlatfrom]: IStats_firebaseCostPlatfrom;
};

export interface IScenesStats {
  name: string;
  selectedStats: string[];
}

export interface IMessage {
  conversationId: string;
  message: string;
  sender: 'company' | 'customer';
}

export interface IReview {
  conversationId: string;
  confirmed: boolean;
  changes?: string[];
  comment?: string;
}
export interface IConversations {
  phoneNumber: string;
  status: ConversationStatusEnum;
  auto: boolean;
  lastMessageDate: admin.firestore.Timestamp;
  lastReviewDate?: admin.firestore.Timestamp;
  brief?: string;
  name?: string;
  lastName?: string;
}

export enum ConversationStatusEnum {
  INPROGRESS = 'inProgress',
  LEAD = 'lead',
  SALES = 'sales',
  NOLEAD = 'noLead',
  NOEVALUABLE = 'noEvaluable',
}
export interface ISystemPrompt {
  currentSystemPrompt: string;
}

export interface ISettings {
  currentBussinesName: string | null;
  currentAssistantName: string | null;
  currentRulesName: string | null;
  currentKnowledgeName: string | null;
}

export interface IBusiness {
  title: string;
  features: IOptionTextItem[];
  services: IService[];
}

export interface IAssistant {
  title: string;
  features: IOptionTextItem[];
}

export interface IRules {
  title: string;
  features: IOptionTextItem[];
}

export interface IKnowledge {
  title: string;
  features: IOptionTextItem[];
}
export interface IHat {
  title: string;
  description: string;
  knowledgeId: string | null;
  assistantId: string | null;
  businessId: string | null;
  ruleId: string | null;
  prompt: string;
  inUse: boolean;
}

export interface ILead {
  conversationId: string;
  startDate: admin.firestore.Timestamp;
  conversionDate: admin.firestore.Timestamp;
  messageQuantity: number;
  activityDaysQuantity: number;
}

export interface ISales {
  conversationId: string;
  startDate: admin.firestore.Timestamp;
  conversionDateLead: admin.firestore.Timestamp;
  messageQuantityLead: number;
  activityDaysQuantityLead: number;
  conversionDateSales: admin.firestore.Timestamp;
  messageQuantitySales: number;
  activityDaysQuantitySales: number;
  fullRefunded: boolean;
  partialRefunded: boolean;
}

export interface IStats_newConversations {
  value: number;
  date: admin.firestore.Timestamp;
}
export interface IStats_returnedConversations {
  value: number;
  date: admin.firestore.Timestamp;
}
export interface IStats_leads {
  value: number;
  date: admin.firestore.Timestamp;
  conversationId: string;
}
export interface IStats_sales {
  value: number;
  date: admin.firestore.Timestamp;
  conversationId: string;
}
export interface IStats_whatsappApiCost {
  value: number;
  date: admin.firestore.Timestamp;
}
export interface IStats_iaCost {
  value: number;
  date: admin.firestore.Timestamp;
}
export interface IStats_facebookAdsCost {
  value: number;
  date: admin.firestore.Timestamp;
}
export interface IStats_googleAdsCost {
  value: number;
  date: admin.firestore.Timestamp;
}

interface IStats_iaCostPlatform {
  value: number;
  date: admin.firestore.Timestamp;
}
interface IStats_firebaseCostPlatfrom {
  value: number;
  date: admin.firestore.Timestamp;
}

interface IEntity {
  id: string;
  softState: StateTypes;
  state: StateTypes;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  softDeletedAt: admin.firestore.Timestamp;
  reactivatedAt: admin.firestore.Timestamp;
}

export interface IMessageEntity extends IMessage, IEntity {}

export interface IReviewsEntity extends IReview, IEntity {}

export interface IConversationsEntity extends IConversations, IEntity {}

export interface IStats_newConversationsEntity extends IStats_newConversations, IEntity {}

export interface IStats_returnedConversationsEntity extends IStats_returnedConversations, IEntity {}

export interface IStats_leadsEntity extends IStats_leads, IEntity {}

export interface IStats_salesEntity extends IStats_sales, IEntity {}

export interface ILeadsEntity extends ILead, IEntity {}

export interface ISalesEntity extends ISales, IEntity {}

export interface IStats_whatsappApiCostEntity extends IStats_whatsappApiCost, IEntity {}

export interface IStats_iaCostEntity extends IStats_iaCost, IEntity {}

export interface IStats_facebookAdsCostEntity extends IStats_facebookAdsCost, IEntity {}

export interface IStats_googleAdsCostEntity extends IStats_googleAdsCost, IEntity {}

export interface IStats_iaCostPlatformEntity extends IStats_iaCostPlatform, IEntity {}

export interface IStats_firebaseCostPlatfromEntity extends IStats_firebaseCostPlatfrom, IEntity {}

export interface IKnowledgeEntity extends IKnowledge, IEntity {}

export interface ISystemPromptEntity extends ISystemPrompt, IEntity {}

export interface ISettingsEntity extends ISettings, IEntity {}

export interface IBusinessEntity extends IBusiness, IEntity {}

export interface IAssistantEntity extends IAssistant, IEntity {}

export interface IRulesEntity extends IRules, IEntity {}

export interface IHatEntity extends IHat, IEntity {}

export interface IScenesStatsEntity extends IScenesStats, IEntity {}

export enum StateTypes {
  'active' = 'active',
  'inactive' = 'inactive',
}

export interface IMessage {
  conversationId: string;
  message: string;
  sender: 'company' | 'customer';
 
}
export interface IOptionTextItem {
  option: string;
  text: string;
}

export interface IService {
  title: string;
  description: string;
  items: IOptionTextItem[];
}

export enum PromptComponentsEnum {
  ASSISTANT = 'ASSISTANT',
  RULE = 'RULE',
  KNOWLEDGE = 'KNOWLEDGE',
  BUSINESS = 'BUSINESS',
}
