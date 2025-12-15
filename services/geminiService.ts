import { GoogleGenAI, Type } from "@google/genai";
import { ExternalModelPrediction } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert object detection system. 
Analyze the image and return a JSON array of detected objects.
For each object, provide the 'label' and the bounding box coordinates.
Coordinates must be normalized (0 to 1).
Return strict JSON.
`;

export const detectObjectsWithGemini = async (
  imageBase64: string,
  mimeType: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<ExternalModelPrediction[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
          {
            text: "Detect all objects in this image. Be precise with bounding boxes.",
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              ymin: { type: Type.NUMBER, description: "Normalized top coordinate (0-1)" },
              xmin: { type: Type.NUMBER, description: "Normalized left coordinate (0-1)" },
              ymax: { type: Type.NUMBER, description: "Normalized bottom coordinate (0-1)" },
              xmax: { type: Type.NUMBER, description: "Normalized right coordinate (0-1)" },
            },
            required: ["label", "ymin", "xmin", "ymax", "xmax"],
          },
        },
      },
    });

    let text = response.text || "[]";
    // Remove markdown code blocks if present
    text = text.replace(/```json\n?|\n?```/g, "").trim();

    const result = JSON.parse(text) as ExternalModelPrediction[];
    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};