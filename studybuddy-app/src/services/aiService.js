import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI } from '@google/genai';

// Vite-friendly way to load the PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function isImageFile(file) {
  return SUPPORTED_IMAGE_TYPES.includes(file.type);
}

export function isPDFFile(file) {
  return file.type === 'application/pdf';
}

/**
 * Extract text from a PDF file using pdfjs-dist
 */
export async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async function () {
      try {
        const typedArray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let extractedText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          extractedText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        resolve(extractedText);
      } catch (err) {
        console.error("PDF Parsing error:", err);
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert a file to a Base64 string (for image uploads)
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Strip the "data:image/xxx;base64," prefix — Gemini wants raw base64
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const SYSTEM_PROMPT = `You are an elite Academic Assistant. Your goal is to create high-impact flashcards for exam preparation. Use active recall and breadcrumbing techniques. For math/science, always use LaTeX. For languages, focus on context and usage examples. Avoid redundant information.

CRITICAL OUTPUT FORMAT: Return ONLY a valid JSON array. Do NOT include markdown code fences, explanations, or any text outside the JSON. Each element in the array must have exactly two string keys: "front" (a clear question or concept) and "back" (the concise, accurate answer or definition). Aim for 10-25 cards depending on material density.`;


/**
 * Generate flashcards from a PDF text string
 */
export async function generateFlashcardsFromText(text) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in environment variables.");

  const truncatedText = text.substring(0, 50000);
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `\n\nStudy Material (PDF Text):\n${truncatedText}` }
        ]
      }
    ],
    config: { responseMimeType: "application/json" }
  });

  return parseFlashcardsFromResponse(response.text);
}

/**
 * Generate flashcards from an image file using Gemini's multimodal vision
 */
export async function generateFlashcardsFromImage(file) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in environment variables.");

  const base64Data = await fileToBase64(file);
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          }
        ]
      }
    ],
    config: { responseMimeType: "application/json" }
  });

  return parseFlashcardsFromResponse(response.text);
}

/**
 * Unified entry point: auto-detects file type and routes accordingly
 */
export async function generateFlashcardsForFile(file, onProgress) {
  if (isImageFile(file)) {
    onProgress?.('Sending image to Gemini Vision AI...');
    return generateFlashcardsFromImage(file);
  }

  if (isPDFFile(file)) {
    onProgress?.('Reading & Extracting PDF text blocks...');
    const text = await extractTextFromPDF(file);
    onProgress?.('Gemini AI is synthesizing flashcards...');
    return generateFlashcardsFromText(text);
  }

  throw new Error(`Unsupported file type: ${file.type}`);
}

/**
 * Safely parse the Gemini JSON output
 */
function parseFlashcardsFromResponse(outputText) {
  try {
    // Strip markdown code fences as a safety fallback
    const clean = outputText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const flashcards = JSON.parse(clean);

    if (!Array.isArray(flashcards)) {
      throw new Error("AI response was not a JSON array.");
    }

    return flashcards;
  } catch (err) {
    console.error("Failed to parse AI response:", outputText);
    throw new Error("AI returned an invalid format. Try again or use a different document.");
  }
}
