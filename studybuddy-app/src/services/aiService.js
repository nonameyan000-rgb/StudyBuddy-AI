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

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function extractTextFromPDF(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      try {
        const pdf = await pdfjsLib.getDocument(new Uint8Array(e.target.result)).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(" ");
        }
        resolve(text);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

export const generateFlashcardsForFile = async (file) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  let content;

  if (isPDFFile(file)) {
    const text = await extractTextFromPDF(file);
    content = [{ type: "text", text: `Create 15 flashcards from this text. Return ONLY JSON array: [{\"front\": \"...\", \"back\": \"...\"}]. Text: ${text.substring(0, 20000)}` }];
  } else {
    const base64 = await fileToBase64(file);
    content = [
      { type: "text", text: "Create 15 flashcards from this image. Return ONLY JSON array." },
      { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } }
    ];
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "llama-3.2-11b-vision",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "AI Error");
  const parsed = JSON.parse(data.choices[0].message.content);
  return parsed.cards || parsed;
};