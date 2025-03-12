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

/**
 * Función para procesar y responder a mensajes recibidos.
 * Utiliza el prompt actualizado obtenido del HatManager.
 */
const sendMessage = async (to: string, messageReceived: string) => {
  console.log(`📩 Mensaje recibido de ${to}: ${messageReceived}`);

  // Recuperar todo el hilo de mensajes para la conversación "to"
  const messagesSnapshot = await db
    .collection("messages")
    .where("conversationId", "==", to)
    // Asumiendo que el campo "createdAt" es de tipo Timestamp de Firestore,
    // orderBy('createdAt') ordena de forma precisa
    .orderBy("createdAt")
    .get();

  // Extraer los mensajes y tiparlos (asumiendo que cada documento tiene la estructura de IMessageEntity)
  const conversationMessages = messagesSnapshot.docs.map((doc) => doc.data()) as IMessage[];

  // Si fuera necesario, se puede ordenar manualmente hasta el nanosegundo:
  conversationMessages.sort((a, b) => {
    // Si los seconds son iguales, ordena por nanosegundos
    if ((a as any).createdAt.seconds === (b as any).createdAt.seconds) {
      return (a as any).createdAt.nanoseconds - (b as any).createdAt.nanoseconds;
    }
    return (a as any).createdAt.seconds - (b as any).createdAt.seconds;
  });

  // Crear un string con todo el hilo, agregando alguna etiqueta para identificar al remitente (opcional)
  const conversationText = conversationMessages
    .map((msg) => {
      const senderLabel = msg.sender === "company" ? "Empresa" : "Cliente";
      return `${senderLabel}: ${msg.message}`;
    })
    .join("\n");

  // Opcional: Agregar el nuevo mensaje recibido al hilo
  const fullConversation = conversationText + "\nCliente: " + messageReceived;

  // Obtener el prompt actualizado
  const prompt = hatManager.getPrompt();
  if (!prompt) {
    console.error("⚠️ No se encontró un prompt actualizado. No se puede responder.");
    return;
  }

  // Se genera la respuesta usando el servicio de IA pasando el hilo completo
  const aiResponse = await chatGpt(prompt, [{ role: "user", content: fullConversation }]);
  if (!aiResponse.content) return;

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

          // Verifica si la conversación ya existe
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

            await sendMessage(from, text);
          } else {
            const conversationData = conversationDoc.data();
            if (conversationData?.auto) {
              await sendMessage(from, text);
            } else {
              console.log(`No se responde al usuario ${from} porque auto es false.`);
            }
          }

          // Registrar el mensaje recibido


          const payload: IMessage = {              
            conversationId: from,
            sender: "customer",
            message: text,
          };

          await SERVICES.CMS.create(Entities.messages, payload);          
          console.log(`Mensaje registrado de ${from}`);
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
