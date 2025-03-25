"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatGpt = void 0;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});
const chatGpt = async (contextPromt, messages) => {
    const completion = await openai.chat.completions.create({
        model: 'o3-mini-2025-01-31',
        messages: [
            {
                role: 'system',
                content: contextPromt,
            },
            ...messages
        ],
    });
    return completion.choices[0].message;
};
exports.chatGpt = chatGpt;
