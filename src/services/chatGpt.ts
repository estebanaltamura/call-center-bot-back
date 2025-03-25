import OpenAI from "openai";
import dotenv from "dotenv";


dotenv.config(); 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

type message = {
  role: 'user' | 'assistant';
  content: string;
};





export const chatGpt = async (contextPromt: string, messages: message[])=>{
  const completion = await openai.chat.completions.create({
    model: 'o3-mini-2025-01-31pt-4o',
    messages: [
      {
        role: 'system',
        content: contextPromt,
      },
      ...messages
    ],
    
    max_completion_tokens: 1000,
  });
  
  return completion.choices[0].message;


}

