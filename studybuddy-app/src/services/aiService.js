import * as pdfjsLib from 'pdfjs-dist';
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
        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(' ');
          extractedText += `--- Page ${i} ---\n${pageText}\n\n`;
        }
        resolve(extractedText);
      } catch (err) {
        console.error('PDF Parsing error:', err);
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert a file to a Base64 string (without the data URI prefix)
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.2-90b-vision-preview';

const SYSTEM_PROMPT = `You are an elite Academic Assistant. Your goal is to create high-impact flashcards for exam preparation.
Use active recall techniques. For math/science, use LaTeX notation where appropriate.
CRITICAL OUTPUT FORMAT: Return ONLY a valid JSON array with no markdown fences, no extra text.
Each item must have exactly two string keys: "front" (question/concept) and "back" (concise answer/definition).
Aim for 10-25 cards depending on content density.`;

/**
 * Shared Groq fetch wrapper with full error handling
 */
async function callGroq(messages) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing VITE_GROQ_API_KEY in environment variables.');

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages }),
  });

  const data = await response.json();
  console.log('[Groq] Full API response:', data);

  if (!response.ok) {
    throw new Error(`Groq API error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
  }

  return data.choices[0].message.content;
}

/**
 * Generate flashcards from PDF text
 */
export async function generateFlashcardsFromText(text) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Study Material:\n${text.substring(0, 50000)}` },
  ];
  const outputText = await callGroq(messages);
  return parseFlashcardsFromResponse(outputText);
}

/**
 * Generate flashcards from an image file using vision
 */
export async function generateFlashcardsFromImage(file) {
  const base64Data = await fileToBase64(file);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Generate flashcards from this document image.' },
        { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Data}` } },
      ],
    },
  ];
  const outputText = await callGroq(messages);
  return parseFlashcardsFromResponse(outputText);
}

/**
 * Unified entry point — auto-detects file type and routes accordingly
 */
export async function generateFlashcardsForFile(file, onProgress) {
  if (isImageFile(file)) {
    onProgress?.('Sending image to Groq AI...');
    return generateFlashcardsFromImage(file);
  }
  if (isPDFFile(file)) {
    onProgress?.('Reading & Extracting PDF text...');
    const text = await extractTextFromPDF(file);
    onProgress?.('Groq AI is synthesizing flashcards...');
    return generateFlashcardsFromText(text);
  }
  throw new Error(`Unsupported file type: ${file.type}`);
}

/**
 * Safely parse JSON from AI response, stripping markdown fences if present
 */
function parseFlashcardsFromResponse(outputText) {
  try {
    const clean = outputText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(clean);

    // Handle both top-level array and wrapped { cards: [...] } format
    const flashcards = Array.isArray(parsed) ? parsed : (parsed.cards ?? parsed.flashcards ?? null);

    if (!Array.isArray(flashcards)) {
      throw new Error('AI response was not a JSON array.');
    }

    return flashcards;
  } catch (err) {
    console.error('[Groq] Failed to parse AI response:', err, outputText);
    throw new Error('AI returned an invalid format. Please try again.');
  }
}