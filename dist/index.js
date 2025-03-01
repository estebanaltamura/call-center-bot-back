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
const types_1 = require("./types");
const services_1 = require("./services");
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use((0, cors_1.default)());
dotenv_1.default.config();
// Token de verificación para el webhook
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// Ruta para verificar el webhook
app.get("/webhook", (req, res) => {
    console.log('entro');
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    console.log(mode, token, challenge, VERIFY_TOKEN);
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verificado");
        res.status(200).send(challenge);
    }
    else {
        res.sendStatus(403);
    }
});
app.post("/webhook", async (req, res) => {
    const body = req.body;
    console.log(body);
    if (body.object) {
        const entries = body.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                const value = change.value || {};
                const messages = value.messages || [];
                for (const message of messages) {
                    const from = message.from; // Número del remitente
                    const text = message.text?.body || ""; // Texto del mensaje
                    console.log(`Mensaje recibido de ${from}: ${text}`);
                    // Verificar si la conversación ya existe
                    const conversationRef = firebase_1.db.collection("conversations").doc(from);
                    const conversationDoc = await conversationRef.get();
                    if (!conversationDoc.exists) {
                        // Crear nueva conversación si no existe y responder con IA
                        // STATS NEW CONVERSATION
                        const payload = {
                            phoneNumber: from,
                            status: types_1.ConversationStatusEnum.INPROGRESS,
                            auto: true,
                            lastMessage: new Date(),
                        };
                        services_1.SERVICES.CMS.create(types_1.Entities.conversations, payload);
                        console.log(`Conversación creada para ${from}`);
                        // Responder con la IA
                        await sendMessage(from, text);
                    }
                    else {
                        // La conversación ya existe, verificamos el valor de `auto`
                        const conversationData = conversationDoc.data();
                        // AGREGAR
                        if (conversationData?.auto) {
                            // Si `auto` es true, responder con IA
                            await sendMessage(from, text);
                        }
                        else {
                            console.log(`No se responde al usuario ${from} porque auto es false.`);
                        }
                    }
                    // Registrar mensaje entrante en la colección "messages"
                    await firebase_1.db.collection("messages").add({
                        conversationId: from,
                        sender: "customer",
                        message: text,
                        timestamp: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                    });
                    console.log(`Mensaje registrado de ${from}`);
                }
            }
        }
        res.sendStatus(200); // Confirmar recepción al webhook
    }
    else {
        res.sendStatus(404);
    }
});
const sendMessage = async (to, messageReceived) => {
    console.log(to, messageReceived);
    const currentHat = firebase_1.db.collection("hats").doc("7f47b7ea-fc49-491a-9bbf-df8da1d3582d");
    const currentHatDoc = await currentHat.get();
    if (!currentHatDoc.exists) {
        console.error("El sombrero no existe.");
        return;
    }
    const currentPrompt = currentHatDoc.data()?.prompt;
    if (!currentPrompt) {
        console.error("No hay un prompt para el sombrero asignado.");
        return;
    }
    const res = await (0, chatGpt_1.chatGpt)(currentPrompt, [{ role: 'user', content: messageReceived }]);
    if (!res.content)
        return;
    sendWhatsappMessage(to, res.content);
};
app.post("/summarize", async (req, res) => {
    const { conversation } = req.body;
    if (!conversation || typeof conversation !== "string") {
        return res.status(400).json({ error: "Debe proporcionar el campo 'conversation' como string" });
    }
    // Definir el prompt de sistema para la IA
    const systemPrompt = "Eres un asistente que resumen conversaciones de whatsapp. Se te muestra una conversación de WhatsApp entre un asistente que vende actas italianas y un interesado. Tu tarea es resumir de forma super breve y sin hablar del contexto el cual esta implicito y aparte resaltar que tan cerca esta de comprar y el nivel de interes";
    try {
        // Llama a tu servicio de IA (chatGpt) pasando el prompt y la conversación
        const aiResponse = await (0, chatGpt_1.chatGpt)(systemPrompt, [{ role: "user", content: conversation }]);
        if (!aiResponse.content) {
            return res.status(500).json({ error: "No se obtuvo respuesta del modelo IA" });
        }
        // Retornar el resumen generado
        return res.status(200).json({ summary: aiResponse.content });
    }
    catch (error) {
        console.error("Error en /summarize:", error.response?.data || error);
        return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
});
// Ruta para enviar mensajes
const sendWhatsappMessage = async (to, message) => {
    try {
        console.log(to, message);
        // Enviar mensaje a través de la API de WhatsApp
        const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message },
        };
        const response = await axios_1.default.post(url, payload, {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        // Registrar mensaje saliente en la colección "messages"
        await firebase_1.db.collection("messages").add({
            conversationId: to,
            sender: "company",
            message,
            timestamp: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Mensaje enviado a ${to}: ${message}`);
    }
    catch (error) {
        console.error("Error enviando mensaje:", error.response?.data || error);
    }
};
// Ruta para enviar mensajes manualmente desde el backend
app.post("/send-message", async (req, res) => {
    console.log('Enviando mensaje...');
    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ error: "Debe proporcionar 'to' y 'message'" });
    }
    try {
        // Llamamos al servicio para enviar el mensaje
        await sendWhatsappMessage(to, message);
        return res.status(200).json({ success: true, message: `Mensaje enviado a ${to}` });
    }
    catch (error) {
        console.error("Error enviando mensaje:", error.response?.data || error);
        return res.status(500).json({ error: "Error enviando mensaje" });
    }
});
const options = {
    key: fs_1.default.readFileSync('/etc/cert/privkey.pem'),
    cert: fs_1.default.readFileSync('/etc/cert/fullchain.pem')
};
// En lugar de usar app.listen, crea un servidor HTTPS:
const PORT = process.env.PORT || 5150; // o el puerto que desees usar
const server = https_1.default.createServer(options, app);
// Arranca el servidor HTTPS:
server.listen(PORT, () => {
    console.log(`Servidor HTTPS escuchando en el puerto ${PORT}`);
});
