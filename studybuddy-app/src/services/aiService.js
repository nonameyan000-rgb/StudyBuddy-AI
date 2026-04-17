import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const generateFlashcardsForFile = async (file) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const isPDF = file.type === 'application/pdf';

  let content;
  if (isPDF) {
    const reader = new FileReader();
    const text = await new Promise((resolve) => {
      reader.onload = async (e) => {
        const pdf = await pdfjsLib.getDocument(new Uint8Array(e.target.result)).promise;
        let t = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          t += content.items.map(item => item.str).join(" ");
        }
        resolve(t);
      };
      reader.readAsArrayBuffer(file);
    });
    content = [{ type: "text", text: `Create 10-15 flashcards from this text: ${text.substring(0, 20000)}` }];
  } else {
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    content = [
      { type: "text", text: "Create 10-15 flashcards from this image. Return ONLY a JSON array: [{\"front\": \"...\", \"back\": \"...\"}]" },
      { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } }
    ];
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // САМОЕ ВАЖНОЕ: СТАБИЛЬНАЯ МОДЕЛЬ БЕЗ ПРИПИСКИ PREVIEW
      model: "llama-3.2-11b-vision",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Groq Error");

  const rawContent = data.choices[0].message.content;
  const parsed = JSON.parse(rawContent);
  return parsed.cards || parsed; // Берем массив карточек
};