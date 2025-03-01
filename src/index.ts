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
import { ConversationStatusEnum, Entities, IConversations, IConversationsEntity, StateTypes } from "./types";
import { SERVICES } from "./services";

const app = express();
app.use(bodyParser.json());
app.use(cors());

dotenv.config(); 




// Token de verificación para el webhook
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;


app.get("/test", (req, res) => {
  res.status(200).json({ message: "El endpoint de prueba funciona correctamente" });
});

// Ruta para verificar el webhook
app.get("/webhook", (req, res) => {
  console.log('entro')
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log(mode, token, challenge, VERIFY_TOKEN)

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado");
    res.status(200).send(challenge);
  } else {
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
          const from: string = message.from; // Número del remitente
          const text: string = message.text?.body || ""; // Texto del mensaje

          console.log(`Mensaje recibido de ${from}: ${text}`);

          // Verificar si la conversación ya existe
          const conversationRef = db.collection("conversations").doc(from);
          const conversationDoc = await conversationRef.get();

          if (!conversationDoc.exists) {
            // Crear nueva conversación si no existe y responder con IA

            // STATS NEW CONVERSATION
            const payload:IConversations = {
              phoneNumber: from,
              status: ConversationStatusEnum.INPROGRESS,
              auto: true,
              lastMessage: new Date(),
            }

            SERVICES.CMS.create(Entities.conversations, payload);
         
            console.log(`Conversación creada para ${from}`);

            // Responder con la IA
            await sendMessage(from, text);
          } else {
            // La conversación ya existe, verificamos el valor de `auto`
            const conversationData = conversationDoc.data();


            // AGREGAR
            if (conversationData?.auto) {
              // Si `auto` es true, responder con IA
              await sendMessage(from, text);
            } else {
              console.log(`No se responde al usuario ${from} porque auto es false.`);
            }
          }

          // Registrar mensaje entrante en la colección "messages"
          await db.collection("messages").add({
            conversationId: from,
            sender: "customer",
            message: text,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Mensaje registrado de ${from}`);
        }
      }
    }

    res.sendStatus(200); // Confirmar recepción al webhook
  } else {
    res.sendStatus(404);
  }
});




const sendMessage = async (to: string, messageReceived: string) => {
  console.log(to, messageReceived)

  const currentHat = db.collection("hats").doc("7f47b7ea-fc49-491a-9bbf-df8da1d3582d");
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
  const res = await chatGpt(currentPrompt,[{role:'user',content:messageReceived}]);
  
  if(!res.content) return;
  sendWhatsappMessage(to, res.content)


};

app.post("/summarize", async (req, res) => {
  const { conversation } = req.body;

  if (!conversation || typeof conversation !== "string") {
    return res.status(400).json({ error: "Debe proporcionar el campo 'conversation' como string" });
  }

  // Definir el prompt de sistema para la IA
  const systemPrompt =
    "Eres un asistente que resumen conversaciones de whatsapp. Se te muestra una conversación de WhatsApp entre un asistente que vende actas italianas y un interesado. Tu tarea es resumir de forma super breve y sin hablar del contexto el cual esta implicito y aparte resaltar que tan cerca esta de comprar y el nivel de interes";

  try {
    // Llama a tu servicio de IA (chatGpt) pasando el prompt y la conversación
    const aiResponse = await chatGpt(systemPrompt, [{ role: "user", content: conversation }]);

    if (!aiResponse.content) {
      return res.status(500).json({ error: "No se obtuvo respuesta del modelo IA" });
    }

    // Retornar el resumen generado
    return res.status(200).json({ summary: aiResponse.content });
  } catch (error: any) {
    console.error("Error en /summarize:", error.response?.data || error);
    return res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Ruta para enviar mensajes
const sendWhatsappMessage = async (to: string, message: string) => {  try {
  console.log(to, message)
    // Enviar mensaje a través de la API de WhatsApp
    const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    // Registrar mensaje saliente en la colección "messages"
    await db.collection("messages").add({
      conversationId: to,
      sender: "company",
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Mensaje enviado a ${to}: ${message}`);
   
  } catch (error: any) {
    console.error("Error enviando mensaje:", error.response?.data || error);
   
  }
}

// Ruta para enviar mensajes manualmente desde el backend
app.post("/send-message", async (req, res) => {
  console.log('Enviando mensaje...')
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Debe proporcionar 'to' y 'message'" });
  }

  try {
    // Llamamos al servicio para enviar el mensaje
    await sendWhatsappMessage(to, message);
    return res.status(200).json({ success: true, message: `Mensaje enviado a ${to}` });
  } catch (error: any) {
    console.error("Error enviando mensaje:", error.response?.data || error);
    return res.status(500).json({ error: "Error enviando mensaje" });
  }
});



const options = {
  key: fs.readFileSync('/etc/cert/privkey.pem'),
  cert: fs.readFileSync('/etc/cert/fullchain.pem')
};


// En lugar de usar app.listen, crea un servidor HTTPS:
const PORT = process.env.PORT || 5150; // o el puerto que desees usar
const server = https.createServer(options, app);

// Arranca el servidor HTTPS:
server.listen(PORT, () => {
  console.log(`Servidor HTTPS escuchando en el puerto ${PORT}`);
});
