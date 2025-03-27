"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const firebase_1 = require("./firebase");
const chatGpt_1 = require("./services/chatGpt");
const services_1 = require("./services");
const types_1 = require("./types");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use((0, cors_1.default)());
/**
 * Clase encargada de gestionar el documento "hat" en Firestore.
 * Se suscribe a cambios y mantiene en memoria el prompt actualizado.
 */
class HatManager {
    constructor(docId) {
        this.docId = docId;
        this.hatData = null;
        const hatRef = firebase_1.db.collection("hats").doc(this.docId);
        hatRef.onSnapshot((snapshot) => {
            if (snapshot.exists) {
                const data = snapshot.data();
                if (data && data.prompt) {
                    this.hatData = { prompt: data.prompt };
                    console.log("🔄 Hat actualizado:", this.hatData);
                }
                else {
                    console.warn("⚠️ Documento 'hat' sin prompt.");
                    this.hatData = null;
                }
            }
            else {
                console.error("❌ Documento 'hat' no encontrado.");
                this.hatData = null;
            }
        }, (error) => {
            console.error("❌ Error en la suscripción de hat:", error);
        });
    }
    /**
     * Retorna el prompt actual o null si no está disponible.
     */
    getPrompt() {
        return this.hatData?.prompt || null;
    }
}
const hatManager = new HatManager("7f47b7ea-fc49-491a-9bbf-df8da1d3582d");
// Controlador centralizado de conversaciones con bloqueo estricto
class ConversationController {
    constructor() {
        this.conversations = new Map();
        // Constructor vacío
    }
    /**
     * Gestiona un nuevo mensaje recibido.
     * Si hay un temporizador pendiente, lo cancela.
     * Si no hay procesamiento en curso, programa uno nuevo.
     */
    handleNewMessage(phoneNumber, message) {
        console.log(`Mensaje recibido de ${phoneNumber}: ${message}`);
        // Obtener o crear estado de conversación
        if (!this.conversations.has(phoneNumber)) {
            this.conversations.set(phoneNumber, {
                messages: [],
                timer: null,
                processing: false,
                lastProcessedTimestamp: 0
            });
        }
        const conversation = this.conversations.get(phoneNumber);
        // Añadir mensaje a la cola
        conversation.messages.push(message);
        // Cancelar temporizador pendiente si existe
        if (conversation.timer) {
            clearTimeout(conversation.timer);
            conversation.timer = null;
        }
        // Si no hay procesamiento en curso, programar procesamiento con delay
        if (!conversation.processing) {
            conversation.timer = setTimeout(() => {
                this.processConversation(phoneNumber);
            }, 800); // Esperar 800ms para ver si llegan más mensajes
        }
        // Si ya hay procesamiento, el nuevo mensaje ya está en cola y se procesará al terminar
    }
    /**
     * Procesa los mensajes pendientes de una conversación.
     * Implementa un bloqueo para que solo haya un procesamiento a la vez por número.
     */
    async processConversation(phoneNumber) {
        const conversation = this.conversations.get(phoneNumber);
        if (!conversation || conversation.messages.length === 0 || conversation.processing) {
            return;
        }
        // Marcar como en procesamiento para bloquear nuevas solicitudes
        conversation.processing = true;
        conversation.timer = null;
        try {
            // Tomar el último mensaje y vaciar la cola
            const latestMessage = conversation.messages[conversation.messages.length - 1];
            conversation.messages = [];
            console.log(`📩 Procesando conversación para ${phoneNumber}, último mensaje: "${latestMessage}"`);
            // Registrar timestamp del inicio de procesamiento
            conversation.lastProcessedTimestamp = Date.now();
            // Recuperar historial de mensajes
            const messagesSnapshot = await firebase_1.db
                .collection("messages")
                .where("conversationId", "==", phoneNumber)
                .orderBy("createdAt")
                .get();
            const conversationMessages = messagesSnapshot.docs.map((doc) => doc.data());
            // Ordenar mensajes por timestamp
            conversationMessages.sort((a, b) => {
                if (a.createdAt.seconds === b.createdAt.seconds) {
                    return a.createdAt.nanoseconds - b.createdAt.nanoseconds;
                }
                return a.createdAt.seconds - b.createdAt.seconds;
            });
            // Crear conversación completa
            const conversationText = conversationMessages
                .map((msg) => {
                const senderLabel = msg.sender === "company" ? "Empresa" : "Cliente";
                return `${senderLabel}: ${msg.message}`;
            })
                .join("\n");
            const fullConversation = conversationText + "\nCliente: " + latestMessage;
            // Verificar prompt
            const prompt = hatManager.getPrompt();
            if (!prompt) {
                console.error("⚠️ No se encontró un prompt actualizado. No se puede responder.");
                conversation.processing = false;
                return;
            }
            // Verificar si llegaron nuevos mensajes mientras se preparaba
            if (conversation.messages.length > 0) {
                console.log(`Abortando respuesta a "${latestMessage}" porque llegaron nuevos mensajes.`);
                // Reprogramar procesamiento para el nuevo lote de mensajes
                setTimeout(() => {
                    this.processConversation(phoneNumber);
                }, 100);
                conversation.processing = false;
                return;
            }
            // Generar respuesta con IA
            const startTime = Date.now();
            const aiResponse = await (0, chatGpt_1.chatGpt)(prompt, [{ role: "user", content: fullConversation }]);
            if (!aiResponse.content) {
                conversation.processing = false;
                return;
            }
            // Verificar nuevamente si hay mensajes nuevos después de la generación IA
            if (conversation.messages.length > 0) {
                console.log(`Abortando envío de respuesta a "${latestMessage}" después de IA porque llegaron nuevos mensajes.`);
                // Reprogramar procesamiento para el nuevo lote
                setTimeout(() => {
                    this.processConversation(phoneNumber);
                }, 100);
                conversation.processing = false;
                return;
            }
            // Calcular delay para naturalidad
            const questionLength = latestMessage.length;
            const answerLength = aiResponse.content.length;
            const computedDelay = 3500 + (questionLength + answerLength) * 40;
            const aiResponseTime = Date.now() - startTime;
            console.log(`Tiempo de respuesta de IA: ${aiResponseTime}ms. Delay calculado: ${computedDelay}ms.`);
            if (aiResponseTime < computedDelay) {
                const waitTime = computedDelay - aiResponseTime;
                console.log(`Esperando ${waitTime}ms para que la respuesta parezca natural.`);
                // Esperar y verificar mensajes nuevos periódicamente durante la espera
                const checkInterval = 500; // Verificar cada 500ms
                let waitedSoFar = 0;
                while (waitedSoFar < waitTime) {
                    await new Promise(resolve => setTimeout(resolve, Math.min(checkInterval, waitTime - waitedSoFar)));
                    waitedSoFar += checkInterval;
                    // Verificar si hay mensajes nuevos durante la espera
                    if (conversation.messages.length > 0) {
                        console.log(`Abortando envío de respuesta a "${latestMessage}" durante espera porque llegaron nuevos mensajes.`);
                        // Reprogramar procesamiento
                        setTimeout(() => {
                            this.processConversation(phoneNumber);
                        }, 100);
                        conversation.processing = false;
                        return;
                    }
                }
            }
            // Verificación final antes de enviar
            if (conversation.messages.length > 0) {
                console.log(`Abortando envío final de respuesta a "${latestMessage}" porque llegaron nuevos mensajes.`);
                // Reprogramar procesamiento
                setTimeout(() => {
                    this.processConversation(phoneNumber);
                }, 100);
                conversation.processing = false;
                return;
            }
            // Enviar mensaje vía WhatsApp
            await sendWhatsappMessage(phoneNumber, aiResponse.content);
        }
        catch (error) {
            console.error(`Error procesando conversación para ${phoneNumber}:`, error);
        }
        finally {
            // Verificar si hay más mensajes pendientes y programar su procesamiento
            if (conversation.messages.length > 0) {
                conversation.timer = setTimeout(() => {
                    this.processConversation(phoneNumber);
                }, 500);
            }
            // Liberar bloqueo
            conversation.processing = false;
        }
    }
}
// Instanciar el controlador de conversaciones
const conversationController = new ConversationController();
/**
 * Función para enviar mensajes vía la API de WhatsApp
 * y registrar el mensaje enviado en Firestore.
 */
const sendWhatsappMessage = async (to, message) => {
    try {
        console.log(`📤 Enviando mensaje a ${to}: ${message}`);
        const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message },
        };
        await axios_1.default.post(url, payload, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        // Registro del mensaje saliente en Firestore
        const messagePayload = {
            conversationId: to,
            sender: "company",
            message,
        };
        await services_1.SERVICES.CMS.create(types_1.Entities.messages, messagePayload);
        const conversationPayload = {
            lastMessageDate: firebase_admin_1.default.firestore.Timestamp.fromDate(new Date()),
        };
        const conversationId = to;
        await services_1.SERVICES.CMS.update(types_1.Entities.conversations, conversationId, conversationPayload);
        console.log(`✅ Mensaje enviado a ${to}`);
    }
    catch (error) {
        console.error("❌ Error enviando mensaje:", error.response?.data || error);
    }
};
// Webhook para verificar la conexión
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("Webhook verificado");
        res.status(200).send(challenge);
    }
    else {
        res.sendStatus(403);
    }
});
app.post("/send-first-message", async (req, res) => {
    const { to } = req.body;
    if (!to) {
        return res.status(400).json({ error: "El campo 'to' es obligatorio." });
    }
    try {
        const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
                name: "saludo_contacto_nuevo",
                language: { code: "es_AR" }
            }
        };
        const response = await axios_1.default.post(url, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
            }
        });
        res.status(200).json({
            success: true,
            data: response.data
        });
    }
    catch (error) {
        console.error("Error al enviar el mensaje:", error.response?.data || error.message);
        res.status(500).json({
            error: "Error al enviar el mensaje"
        });
    }
});
// Webhook para recibir mensajes con mecanismo de cola y procesamiento secuencial
app.post("/webhook", async (req, res) => {
    const body = req.body;
    if (body.object) {
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value || {};
                for (const message of value.messages || []) {
                    const from = message.from;
                    const text = message.text?.body || "";
                    // Verificar si la conversación ya existe
                    const conversationRef = firebase_1.db.collection("conversations").doc(from);
                    const conversationDoc = await conversationRef.get();
                    if (!conversationDoc.exists) {
                        // Crear nueva conversación
                        const payload = {
                            phoneNumber: from,
                            status: types_1.ConversationStatusEnum.INPROGRESS,
                            auto: true,
                            lastMessageDate: firebase_admin_1.default.firestore.Timestamp.fromDate(new Date()),
                            id: from
                        };
                        await services_1.SERVICES.CMS.create(types_1.Entities.conversations, payload);
                        console.log(`Conversación creada para ${from}`);
                        // Registrar el mensaje recibido
                        const messagePayload = {
                            conversationId: from,
                            sender: "customer",
                            message: text,
                        };
                        await services_1.SERVICES.CMS.create(types_1.Entities.messages, messagePayload);
                        console.log(`Mensaje registrado de ${from}`);
                        // Enviar a cola de procesamiento
                        conversationController.handleNewMessage(from, text);
                    }
                    else {
                        const conversationData = conversationDoc.data();
                        if (conversationData?.auto) {
                            // Actualizar conversación existente
                            const conversationPayload = {
                                lastMessageDate: firebase_admin_1.default.firestore.Timestamp.fromDate(new Date()),
                            };
                            const conversationId = conversationData.id;
                            await services_1.SERVICES.CMS.update(types_1.Entities.conversations, conversationId, conversationPayload);
                            // Registrar el mensaje recibido
                            const messagePayload = {
                                conversationId: from,
                                sender: "customer",
                                message: text,
                            };
                            await services_1.SERVICES.CMS.create(types_1.Entities.messages, messagePayload);
                            // Enviar a cola de procesamiento
                            conversationController.handleNewMessage(from, text);
                        }
                        else {
                            console.log(`No se responde al usuario ${from} porque auto es false.`);
                        }
                    }
                }
            }
        }
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }
});
// Ruta para resumir conversaciones usando IA
app.post("/summarize", async (req, res) => {
    const { conversation } = req.body;
    if (!conversation || typeof conversation !== "string") {
        return res.status(400).json({ error: "Debe proporcionar el campo 'conversation' como string" });
    }
    const systemPrompt = "Eres un asistente que resume conversaciones de WhatsApp. Se te muestra una conversación entre un asistente que vende actas italianas y un interesado. Tu tarea es resumir de forma super breve, sin mencionar el contexto, y resaltar el nivel de interés y la cercanía a la compra.";
    try {
        const aiResponse = await (0, chatGpt_1.chatGpt)(systemPrompt, [{ role: "user", content: conversation }]);
        if (!aiResponse.content) {
            return res.status(500).json({ error: "No se obtuvo respuesta del modelo IA" });
        }
        return res.status(200).json({ summary: aiResponse.content });
    }
    catch (error) {
        console.error("Error en /summarize:", error.response?.data || error);
        return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
});
// Ruta para enviar mensajes manualmente desde el backend
app.post("/send-message", async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ error: "Debe proporcionar 'to' y 'message'" });
    }
    try {
        await sendWhatsappMessage(to, message);
        return res.status(200).json({ success: true, message: `Mensaje enviado a ${to}` });
    }
    catch (error) {
        console.error("Error enviando mensaje:", error.response?.data || error);
        return res.status(500).json({ error: "Error enviando mensaje" });
    }
});
// Configuración del servidor HTTPS
const options = {
    key: fs_1.default.readFileSync('/etc/cert/privkey.pem'),
    cert: fs_1.default.readFileSync('/etc/cert/fullchain.pem')
};
const PORT = process.env.PORT || 5150;
const server = https_1.default.createServer(options, app);
server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTPS escuchando en el puerto ${PORT}`);
});
