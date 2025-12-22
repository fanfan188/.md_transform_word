
import { GoogleGenAI } from "@google/genai";

export const polishMarkdown = async (content: string): Promise<string> => {
  try {
    // Fix: Using named parameter and strictly process.env.API_KEY as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional technical writer. 
      Please fix any formatting issues in the following Markdown content. 
      Ensure headers are consistent, fix broken lists, and sanitize syntax without changing the actual meaning of the text.
      Return ONLY the fixed Markdown content.
      
      Content:
      ${content}`,
    });
    // Fix: Access the text property directly (it's a getter, not a method)
    return response.text || content;
  } catch (error) {
    console.error("AI Polishing failed:", error);
    return content;
  }
};
