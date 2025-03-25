import express from "express";
import bodyParser from "body-parser";
import admin from "firebase-admin";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import https from "https";

import { db } from "./firebase";
import { chatGpt } from "./services/chatGpt";
import { SERVICES } from "./services";
import { ConversationStatusEnum, Entities, IConversations, IMessage } from "./types";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

/**
 * Clase encargada de gestionar el documento "hat" en Firestore.
 * Se suscribe a cambios y mantiene en memoria el prompt actualizado.
 */
class HatManager {
  private hatData: { prompt: string } | null = null;

  constructor(private docId: string) {
    const hatRef = db.collection("hats").doc(this.docId);
    hatRef.onSnapshot(
      (snapshot) => {
        if (snapshot.exists) {
          const data = snapshot.data();
          if (data && data.prompt) {
            this.hatData = { prompt: data.prompt };
            console.log("🔄 Hat actualizado:", this.hatData);
          } else {
            console.warn("⚠️ Documento 'hat' sin prompt.");
            this.hatData = null;
          }
        } else {
          console.error("❌ Documento 'hat' no encontrado.");
          this.hatData = null;
        }
      },
      (error) => {
        console.error("❌ Error en la suscripción de hat:", error);
      }
    );
  }

  /**
   * Retorna el prompt actual o null si no está disponible.
   */
  getPrompt(): string | null {
    return this.hatData?.prompt || null;
  }
}

// Instanciamos el gestor del hat con el ID del documento correspondiente.
const hatManager = new HatManager("7f47b7ea-fc49-491a-9bbf-df8da1d3582d");

const latestMessageToken = new Map<string, string>();

/**
 * Función para procesar y responder a mensajes recibidos.
 * Utiliza el prompt actualizado obtenido del HatManager.
 */
const sendMessage = async (to: string, messageReceived: string, token: string) => {
  // Registrar el token para la conversación
  latestMessageToken.set(to, token);

  // Capturamos el tiempo de inicio para calcular el delay
  const startTime = Date.now();
  console.log(`📩 Mensaje recibido de ${to}: ${messageReceived}`);

  // Recuperar todo el hilo de mensajes para la conversación "to"
  const messagesSnapshot = await db
    .collection("messages")
    .where("conversationId", "==", to)
    .orderBy("createdAt")
    .get();

  const conversationMessages = messagesSnapshot.docs.map((doc) => doc.data()) as IMessage[];

  // Ordenar manualmente hasta el nanosegundo si es necesario
  conversationMessages.sort((a, b) => {
    if ((a as any).createdAt.seconds === (b as any).createdAt.seconds) {
      return (a as any).createdAt.nanoseconds - (b as any).createdAt.nanoseconds;
    }
    return (a as any).createdAt.seconds - (b as any).createdAt.seconds;
  });

  // Crear el string con el hilo completo de conversación
  const conversationText = conversationMessages
    .map((msg) => {
      const senderLabel = msg.sender === "company" ? "Empresa" : "Cliente";
      return `${senderLabel}: ${msg.message}`;
    })
    .join("\n");

  // Agregar el nuevo mensaje al hilo
  const fullConversation = conversationText + "\nCliente: " + messageReceived;
  console.log(fullConversation);

  // Obtener el prompt actualizado
  const prompt = hatManager.getPrompt();
  if (!prompt) {
    console.error("⚠️ No se encontró un prompt actualizado. No se puede responder.");
    return;
  }

  // Se genera la respuesta usando el servicio de IA pasando el hilo completo
  const aiResponse = await chatGpt(prompt, [{ role: "user", content: fullConversation }]);
  if (!aiResponse.content) return;

  // Cálculo del delay:
  // Base de 5000ms + 70ms por cada caracter de la pregunta y 70ms por cada caracter de la respuesta.
  const questionLength = messageReceived.length;
  console.log('MENSAJE RECIBIDO', messageReceived, messageReceived.length)
  const answerLength = aiResponse.content.length;
  console.log('RESPUESTA', aiResponse.content, aiResponse.content.length)
  const computedDelay = 5000 + (questionLength + answerLength) * 70; // milisegundos

  const aiResponseTime = Date.now() - startTime;
  console.log(`Tiempo de respuesta de IA: ${aiResponseTime}ms. Delay calculado: ${computedDelay}ms.`);

  // Si la respuesta fue más rápida que el delay calculado, esperamos la diferencia
  if (aiResponseTime < computedDelay) {
    const waitTime = computedDelay - aiResponseTime;
    console.log(`Esperando ${waitTime}ms para que la respuesta parezca natural.`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  // Verificar que no haya llegado un nuevo mensaje para este usuario
  if (latestMessageToken.get(to) !== token) {
    console.log(`Abortando envío de respuesta a ${to} debido a la llegada de un mensaje más reciente.`);
    return;
  }

  // Enviar el mensaje vía WhatsApp
  await sendWhatsappMessage(to, aiResponse.content);
};


/**
 * Función para enviar mensajes vía la API de WhatsApp
 * y registrar el mensaje enviado en Firestore.
 */
const sendWhatsappMessage = async (to: string, message: string) => {
  try {
    console.log(`📤 Enviando mensaje a ${to}: ${message}`);
    const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    };

    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    // Registro del mensaje saliente en Firestore
    const messagePayload: IMessage = {              
      conversationId: to,
      sender: "company",
      message,
    };

    await SERVICES.CMS.create(Entities.messages, messagePayload);   

    const conversationPayload = {
      lastMessageDate: admin.firestore.Timestamp.fromDate(new Date()),
    }

    const conversationId = to
    await SERVICES.CMS.update(Entities.conversations, conversationId, conversationPayload);

    console.log(`✅ Mensaje enviado a ${to}`);
  } catch (error: any) {
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
  } else {
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
      to, // Número del destinatario en formato internacional sin el signo +
      type: "template",
      template: {
        name: "saludo_contacto_nuevo", // Nombre exacto de la plantilla aprobada
        language: { code: "es_AR" } // Código de idioma que coincide con la plantilla en Facebook
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    console.error("Error al enviar el mensaje:", error.response?.data || error.message);
    res.status(500).json({
      error: "Error al enviar el mensaje"
    });
  }
});

// Webhook para recibir mensajes
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object) {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const message of value.messages || []) {
          const from: string = message.from;
          const text: string = message.text?.body || "";
          console.log(`Mensaje recibido de ${from}: ${text}`);

          // Generar un token único para este mensaje (por ejemplo, usando el timestamp)
          const token = Date.now().toString();
          latestMessageToken.set(from, token);

          // Verificar si la conversación ya existe
          const conversationRef = db.collection("conversations").doc(from);
          const conversationDoc = await conversationRef.get();

          if (!conversationDoc.exists) {
            const payload: IConversations & { id: string } = {              
              phoneNumber: from,
              status: ConversationStatusEnum.INPROGRESS,
              auto: true,
              lastMessageDate: admin.firestore.Timestamp.fromDate(new Date()),
              id: from
            };
            await SERVICES.CMS.create(Entities.conversations, payload);
            console.log(`Conversación creada para ${from}`);

            // Registrar el mensaje recibido
            const messagePayload: IMessage = {              
              conversationId: from,
              sender: "customer",
              message: text,            
            };
            await SERVICES.CMS.create(Entities.messages, messagePayload);          
            console.log(`Mensaje registrado de ${from}`);

            // Procesar el mensaje pasando el token
            await sendMessage(from, text, token);
          } else {
            const conversationData = conversationDoc.data();
            if (conversationData?.auto) {
              const conversationPayload = {
                lastMessageDate: admin.firestore.Timestamp.fromDate(new Date()),
              };
              const conversationId = conversationData.id;
              await SERVICES.CMS.update(Entities.conversations, conversationId, conversationPayload);

              // Registrar el mensaje recibido
              const messagePayload: IMessage = {              
                conversationId: from,
                sender: "customer",
                message: text,
              };
              await SERVICES.CMS.create(Entities.messages, messagePayload);      

              // Procesar el mensaje con el token actual
              await sendMessage(from, text, token);
            } else {
              console.log(`No se responde al usuario ${from} porque auto es false.`);
            }
          }
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Ruta para resumir conversaciones usando IA
app.post("/summarize", async (req, res) => {
  const { conversation } = req.body;

  if (!conversation || typeof conversation !== "string") {
    return res.status(400).json({ error: "Debe proporcionar el campo 'conversation' como string" });
  }

  const systemPrompt =
    "Eres un asistente que resume conversaciones de WhatsApp. Se te muestra una conversación entre un asistente que vende actas italianas y un interesado. Tu tarea es resumir de forma super breve, sin mencionar el contexto, y resaltar el nivel de interés y la cercanía a la compra.";
  try {
    const aiResponse = await chatGpt(systemPrompt, [{ role: "user", content: conversation }]);
    if (!aiResponse.content) {
      return res.status(500).json({ error: "No se obtuvo respuesta del modelo IA" });
    }
    return res.status(200).json({ summary: aiResponse.content });
  } catch (error: any) {
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
  } catch (error: any) {
    console.error("Error enviando mensaje:", error.response?.data || error);
    return res.status(500).json({ error: "Error enviando mensaje" });
  }
});

// Configuración del servidor HTTPS
const options = {
  key: fs.readFileSync('/etc/cert/privkey.pem'),
  cert: fs.readFileSync('/etc/cert/fullchain.pem')
};

const PORT = process.env.PORT || 5150;
const server = https.createServer(options, app);

server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTPS escuchando en el puerto ${PORT}`);
});
