import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  
  if (openaiClient) {
    return openaiClient;
  }
  
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000, // 2 minutes for vision requests
    maxRetries: 2,
  });
  
  return openaiClient;
}

interface ExtractTextRequest {
  image: string;
  sourceLanguage: string;
}

interface CleanTextRequest {
  text: string;
  documentType: string;
  sourceLanguage: string;
}

interface TranslateRequest {
  text: string;
  sourceLanguage: string;
}

interface ProcessDocumentRequest {
  images: string[]; // Array of base64 encoded images
  documentType: string;
  sourceLanguage: string;
}

/**
 * Extract text from a single image using GPT-4 Vision
 * POST /api/document-ocr/extract
 */
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { image, sourceLanguage = 'English' } = req.body as ExtractTextRequest;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert OCR system specialized in extracting text from scanned documents, particularly handwritten documents.
The document is written in ${sourceLanguage}. Your task is to accurately extract ALL text from the provided image.

CRITICAL RULES FOR ACCURATE EXTRACTION:

1. LETTER-BY-LETTER ACCURACY: Examine each letter carefully. For handwritten text:
   - Look at the overall shape of each letter
   - Consider how different people form letters (e.g., 'a' vs 'o', 'n' vs 'u', 'l' vs 'i')
   - Pay attention to connecting strokes in cursive writing
   - Distinguish between similar-looking letters (e.g., 'c' and 'e', 'm' and 'n')

2. WORD VERIFICATION: After extracting each word:
   - Verify it is a real word in ${sourceLanguage}
   - If a word doesn't make sense, re-examine the letters
   - Consider common handwriting variations (e.g., 'tlie' should be 'the')
   - Names and proper nouns may not be dictionary words - use context clues

3. CONTEXT AWARENESS:
   - Use sentence context to help interpret unclear words
   - If a word seems wrong, look at surrounding words for clues
   - Consider what makes grammatical sense in ${sourceLanguage}

4. HANDWRITING PATTERNS TO WATCH:
   - Letters 'r' and 'n' often look similar
   - Letter 'u' may look like 'v' or 'n'
   - Letter 'a' may look like 'o' or 'u'
   - Letter 'e' may look like 'c' or 'i'
   - Letter 'd' may look like 'cl' or 'ol'
   - Letter 'h' may look like 'li' or 'b'
   - Letters 'f' and 't' are often confused
   - Double letters may appear as single or vice versa

5. PRESERVE ORIGINAL TEXT:
   - Extract text exactly as written, preserving line breaks
   - Keep original paragraph structure
   - Maintain any dates, numbers, and names exactly as they appear
   - Do NOT correct spelling or grammar at this stage - just extract accurately

Return your response in this exact JSON format:
{
    "extractedText": "the full extracted text here with accurate letter-by-letter transcription",
    "isHandwritten": true/false,
    "detectedLanguage": "${sourceLanguage}",
    "confidence": 0.0-1.0,
    "unclearSections": ["list of sections that were difficult to read, if any"]
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please extract all text from this scanned document image. The document is in ${sourceLanguage}.

IMPORTANT: Read each word carefully, letter by letter. For handwritten text:
- Take your time to identify each letter correctly
- Every word you extract should be a real ${sourceLanguage} word (except names/proper nouns)
- If a word doesn't look right, re-examine the letters

Return the result in the specified JSON format.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    });
    
    const content = completion.choices[0]?.message?.content || '';
    
    // Try to parse as JSON
    try {
      // Clean up markdown code blocks if present
      let jsonContent = content;
      if (content.includes('```json')) {
        jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (content.includes('```')) {
        jsonContent = content.replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(jsonContent.trim());
      return res.json({ success: true, data: parsed });
    } catch {
      // Return as plain text if not JSON
      return res.json({
        success: true,
        data: {
          extractedText: content,
          isHandwritten: false,
          detectedLanguage: sourceLanguage,
          confidence: 0.7,
          unclearSections: []
        }
      });
    }
    
  } catch (error: any) {
    console.error('Document OCR extraction error:', error);
    return res.status(500).json({ 
      error: 'Failed to extract text',
      message: error.message || 'An error occurred during text extraction'
    });
  }
});

/**
 * Clean and structure extracted text
 * POST /api/document-ocr/clean
 */
router.post('/clean', async (req: Request, res: Response) => {
  try {
    const { text, documentType, sourceLanguage = 'English' } = req.body as CleanTextRequest;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert document editor specializing in workplace complaints and HR documents.
The original document was written in ${sourceLanguage}.
Your task is to clean, correct, and structure the provided text while preserving its meaning.

CRITICAL CLEANING RULES:

1. CONTEXTUAL SENTENCE ANALYSIS:
   - Read each sentence as a whole to understand the intended meaning
   - Use context from surrounding sentences to interpret unclear parts
   - If a word seems wrong, consider what word would make sense in that context
   - Ensure each sentence is grammatically correct and makes logical sense

2. INTELLIGENT ERROR CORRECTION:
   - Fix spelling errors by considering what the word should be based on context
   - Correct grammar while maintaining the speaker's voice and style
   - Fix word fragments that may have been misread (e.g., "tlie" → "the", "witli" → "with")
   - Recognize common OCR errors and correct them contextually

3. PROPER NAME HANDLING:
   - Identify names of people, places, and organizations
   - Ensure names are spelled consistently throughout the document
   - If a name appears multiple times with slight variations, standardize to the most likely correct spelling

4. STRUCTURAL IMPROVEMENTS:
   - Organize the text into logical paragraphs
   - Add appropriate paragraph breaks where the topic changes
   - Ensure dates and times are formatted consistently
   - Maintain chronological flow of events if present

5. PRESERVE ORIGINAL INTENT:
   - Do NOT add information that isn't present in the original
   - Do NOT change the meaning of any statements
   - Preserve all specific details, accusations, and claims exactly
   - Keep the emotional tone of the original writer

Return your response in this exact JSON format:
{
    "cleanedText": "the cleaned and properly structured text with all corrections applied",
    "corrections": ["list of significant corrections made with before→after format"],
    "keyPoints": ["list of main points from the document"],
    "mentionedNames": ["list of all names mentioned (people, places, organizations)"],
    "mentionedDates": ["list of all dates and times mentioned"],
    "summary": "brief 2-3 sentence summary of the document's content"
}`
        },
        {
          role: 'user',
          content: `Please clean and structure the following text from a ${documentType}.

The text was extracted from a handwritten/scanned document in ${sourceLanguage}, so it may contain OCR errors.
Focus on making every sentence clear, grammatically correct, and meaningful based on context.

Original extracted text:

${text}`
        }
      ],
      max_tokens: 4096,
      temperature: 0.2
    });
    
    const content = completion.choices[0]?.message?.content || '';
    
    // Try to parse as JSON
    try {
      let jsonContent = content;
      if (content.includes('```json')) {
        jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (content.includes('```')) {
        jsonContent = content.replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(jsonContent.trim());
      return res.json({ success: true, data: parsed });
    } catch {
      return res.json({
        success: true,
        data: {
          cleanedText: content,
          corrections: [],
          keyPoints: [],
          mentionedNames: [],
          mentionedDates: [],
          summary: ''
        }
      });
    }
    
  } catch (error: any) {
    console.error('Document OCR cleaning error:', error);
    return res.status(500).json({ 
      error: 'Failed to clean text',
      message: error.message || 'An error occurred during text cleaning'
    });
  }
});

/**
 * Translate text to English
 * POST /api/document-ocr/translate
 */
router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { text, sourceLanguage } = req.body as TranslateRequest;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    if (sourceLanguage?.toLowerCase() === 'english') {
      return res.json({ success: true, data: { translatedText: text } });
    }
    
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text from ${sourceLanguage} to English.
Maintain the original meaning, tone, and any specific terminology.
Return ONLY the translated text, no explanations.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    });
    
    const translatedText = completion.choices[0]?.message?.content || text;
    return res.json({ success: true, data: { translatedText } });
    
  } catch (error: any) {
    console.error('Document OCR translation error:', error);
    return res.status(500).json({ 
      error: 'Failed to translate text',
      message: error.message || 'An error occurred during translation'
    });
  }
});

/**
 * Process complete document (extract + translate + clean)
 * POST /api/document-ocr/process
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { images, documentType, sourceLanguage = 'English' } = req.body as ProcessDocumentRequest;
    
    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }
    
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured. Please contact your administrator.'
      });
    }
    
    let allExtractedText = '';
    let isHandwritten = false;
    let totalConfidence = 0;
    
    // Step 1: Extract text from each image
    for (let i = 0; i < images.length; i++) {
      const imageBase64 = images[i];
      
      const extractCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert OCR system. Extract ALL text from this ${sourceLanguage} document image accurately.
Focus on letter-by-letter accuracy, especially for handwritten text.
Verify each word is a real ${sourceLanguage} word.

Return JSON: {"extractedText": "...", "isHandwritten": true/false, "confidence": 0.0-1.0}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Extract text from page ${i + 1}. Language: ${sourceLanguage}` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1
      });
      
      const content = extractCompletion.choices[0]?.message?.content || '';
      try {
        let jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const parsed = JSON.parse(jsonContent.trim());
        
        if (i > 0) allExtractedText += `\n\n--- Page ${i + 1} ---\n\n`;
        allExtractedText += parsed.extractedText || content;
        if (parsed.isHandwritten) isHandwritten = true;
        totalConfidence += parsed.confidence || 0.7;
      } catch {
        if (i > 0) allExtractedText += `\n\n--- Page ${i + 1} ---\n\n`;
        allExtractedText += content;
        totalConfidence += 0.7;
      }
    }
    
    // Step 2: Translate if needed
    let translatedText: string | null = null;
    if (sourceLanguage.toLowerCase() !== 'english') {
      const translateCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `Translate from ${sourceLanguage} to English. Return only the translation.` },
          { role: 'user', content: allExtractedText }
        ],
        max_tokens: 4096,
        temperature: 0.1
      });
      translatedText = translateCompletion.choices[0]?.message?.content || null;
    }
    
    // Step 3: Clean and structure
    const textToClean = translatedText || allExtractedText;
    const cleanCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Clean and structure this ${documentType} text. Fix OCR errors contextually. Make sentences grammatically correct.
Return JSON: {"cleanedText": "...", "corrections": [], "keyPoints": [], "mentionedNames": [], "mentionedDates": [], "summary": "..."}`
        },
        { role: 'user', content: textToClean }
      ],
      max_tokens: 4096,
      temperature: 0.2
    });
    
    const cleanContent = cleanCompletion.choices[0]?.message?.content || '';
    let cleanedResult = {
      cleanedText: cleanContent,
      corrections: [] as string[],
      keyPoints: [] as string[],
      mentionedNames: [] as string[],
      mentionedDates: [] as string[],
      summary: ''
    };
    
    try {
      let jsonContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      cleanedResult = JSON.parse(jsonContent.trim());
    } catch {}
    
    // Return complete result
    return res.json({
      success: true,
      data: {
        originalText: allExtractedText,
        translatedText,
        cleanedText: cleanedResult.cleanedText,
        detectedLanguage: sourceLanguage,
        isHandwritten,
        keyPoints: cleanedResult.keyPoints,
        mentionedNames: cleanedResult.mentionedNames,
        mentionedDates: cleanedResult.mentionedDates,
        summary: cleanedResult.summary,
        corrections: cleanedResult.corrections,
        pageCount: images.length,
        confidence: totalConfidence / images.length
      }
    });
    
  } catch (error: any) {
    console.error('Document OCR process error:', error);
    return res.status(500).json({ 
      error: 'Failed to process document',
      message: error.message || 'An error occurred during document processing'
    });
  }
});

// ============================================================
// TEXT-TO-SPEECH ENDPOINT
// ============================================================

interface TTSRequest {
  text: string;
  employeeName: string;
  documentType?: string;
  languageCode?: string;  // e.g., "en-US", "fr-FR", "zh-CN"
}

// Language-specific greetings and phrases
const languageScripts: Record<string, {
  greeting: (name: string) => string;
  purpose: (docType: string) => string;
  transition: string;
  closing: (name: string) => string;
}> = {
  // English (default and all variants)
  'en': {
    greeting: (name) => `Hello ${name}. Thank you for taking the time to review this document with me.`,
    purpose: (docType) => `Before you accept this ${docType}, I'd like to read it aloud so you can confirm that it accurately reflects what you wrote. This typed version is for clarity and documentation purposes. Please listen carefully, and let us know if anything needs to be corrected.`,
    transition: `I'll begin reading now.`,
    closing: (name) => `That concludes the document. If everything looks correct, you may proceed to accept it. Thank you, ${name}.`
  },
  // French
  'fr': {
    greeting: (name) => `Bonjour ${name}. Merci de prendre le temps de réviser ce document avec moi.`,
    purpose: (docType) => `Avant d'accepter cette ${docType}, je vais vous la lire à haute voix pour que vous puissiez confirmer qu'elle reflète fidèlement ce que vous avez écrit. Cette version dactylographiée est destinée à la clarté et à la documentation. Veuillez écouter attentivement et nous faire savoir si quelque chose doit être corrigé.`,
    transition: `Je commence la lecture maintenant.`,
    closing: (name) => `Voilà qui conclut le document. Si tout est correct, vous pouvez procéder à son acceptation. Merci, ${name}.`
  },
  // Spanish
  'es': {
    greeting: (name) => `Hola ${name}. Gracias por tomarte el tiempo de revisar este documento conmigo.`,
    purpose: (docType) => `Antes de aceptar esta ${docType}, me gustaría leerla en voz alta para que puedas confirmar que refleja con precisión lo que escribiste. Esta versión mecanografiada es para mayor claridad y documentación. Por favor, escucha atentamente y avísanos si algo necesita ser corregido.`,
    transition: `Comenzaré a leer ahora.`,
    closing: (name) => `Eso concluye el documento. Si todo está correcto, puedes proceder a aceptarlo. Gracias, ${name}.`
  },
  // German
  'de': {
    greeting: (name) => `Hallo ${name}. Vielen Dank, dass Sie sich die Zeit nehmen, dieses Dokument mit mir durchzugehen.`,
    purpose: (docType) => `Bevor Sie diese ${docType} akzeptieren, möchte ich sie Ihnen vorlesen, damit Sie bestätigen können, dass sie genau das widerspiegelt, was Sie geschrieben haben. Diese getippte Version dient der Klarheit und Dokumentation. Bitte hören Sie aufmerksam zu und lassen Sie uns wissen, wenn etwas korrigiert werden muss.`,
    transition: `Ich beginne jetzt mit dem Lesen.`,
    closing: (name) => `Das schließt das Dokument ab. Wenn alles korrekt ist, können Sie es akzeptieren. Danke, ${name}.`
  },
  // Portuguese
  'pt': {
    greeting: (name) => `Olá ${name}. Obrigado por dedicar tempo para revisar este documento comigo.`,
    purpose: (docType) => `Antes de aceitar esta ${docType}, gostaria de lê-la em voz alta para que você possa confirmar que ela reflete com precisão o que você escreveu. Esta versão digitada é para maior clareza e documentação. Por favor, ouça atentamente e nos avise se algo precisar ser corrigido.`,
    transition: `Vou começar a ler agora.`,
    closing: (name) => `Isso conclui o documento. Se estiver tudo correto, você pode aceitar. Obrigado, ${name}.`
  },
  // Chinese (Simplified)
  'zh': {
    greeting: (name) => `你好 ${name}。感谢您抽出时间与我一起审阅这份文件。`,
    purpose: (docType) => `在您接受这份${docType}之前，我想大声朗读给您听，以便您确认它准确反映了您所写的内容。这份打字版本是为了清晰和记录目的。请仔细聆听，如有任何需要更正的地方请告诉我们。`,
    transition: `我现在开始朗读。`,
    closing: (name) => `文件朗读完毕。如果一切正确，您可以继续接受它。谢谢，${name}。`
  },
  // Japanese
  'ja': {
    greeting: (name) => `こんにちは ${name}さん。この書類を一緒に確認していただきありがとうございます。`,
    purpose: (docType) => `この${docType}を承認する前に、あなたが書いた内容が正確に反映されていることを確認できるよう、声に出して読み上げたいと思います。このタイプされたバージョンは、明確さと記録のためのものです。よく聞いて、修正が必要な点があればお知らせください。`,
    transition: `それでは読み上げを始めます。`,
    closing: (name) => `以上で書類の読み上げは終了です。問題がなければ、承認に進んでください。ありがとうございます、${name}さん。`
  },
  // Korean
  'ko': {
    greeting: (name) => `안녕하세요 ${name}님. 이 문서를 함께 검토해 주셔서 감사합니다.`,
    purpose: (docType) => `이 ${docType}를 수락하기 전에, 작성하신 내용이 정확하게 반영되었는지 확인하실 수 있도록 소리 내어 읽어드리겠습니다. 이 타이핑된 버전은 명확성과 기록을 위한 것입니다. 주의 깊게 듣고 수정이 필요한 부분이 있으면 알려주세요.`,
    transition: `지금부터 읽기 시작하겠습니다.`,
    closing: (name) => `문서 읽기가 끝났습니다. 모든 것이 정확하다면 수락하실 수 있습니다. 감사합니다, ${name}님.`
  },
  // Arabic
  'ar': {
    greeting: (name) => `مرحباً ${name}. شكراً لك على تخصيص الوقت لمراجعة هذه الوثيقة معي.`,
    purpose: (docType) => `قبل قبول هذه ${docType}، أود قراءتها بصوت عالٍ حتى تتمكن من التأكد من أنها تعكس بدقة ما كتبته. هذه النسخة المطبوعة هي للوضوح والتوثيق. يرجى الاستماع بعناية وإخبارنا إذا كان هناك أي شيء يحتاج إلى تصحيح.`,
    transition: `سأبدأ القراءة الآن.`,
    closing: (name) => `هذا يختتم الوثيقة. إذا كان كل شيء صحيحاً، يمكنك المتابعة لقبولها. شكراً لك، ${name}.`
  },
  // Hindi
  'hi': {
    greeting: (name) => `नमस्ते ${name}। इस दस्तावेज़ की समीक्षा के लिए समय देने के लिए धन्यवाद।`,
    purpose: (docType) => `इस ${docType} को स्वीकार करने से पहले, मैं इसे जोर से पढ़ना चाहूंगी ताकि आप पुष्टि कर सकें कि यह आपने जो लिखा है उसे सटीक रूप से दर्शाता है। यह टाइप किया गया संस्करण स्पष्टता और दस्तावेज़ीकरण के लिए है। कृपया ध्यान से सुनें और हमें बताएं कि क्या कुछ सुधार की आवश्यकता है।`,
    transition: `मैं अब पढ़ना शुरू करती हूं।`,
    closing: (name) => `दस्तावेज़ समाप्त होता है। यदि सब कुछ सही है, तो आप इसे स्वीकार कर सकते हैं। धन्यवाद, ${name}।`
  },
  // Italian
  'it': {
    greeting: (name) => `Ciao ${name}. Grazie per aver dedicato del tempo a rivedere questo documento con me.`,
    purpose: (docType) => `Prima di accettare questa ${docType}, vorrei leggerla ad alta voce in modo che tu possa confermare che riflette accuratamente ciò che hai scritto. Questa versione dattiloscritta è per chiarezza e documentazione. Per favore ascolta attentamente e facci sapere se qualcosa deve essere corretto.`,
    transition: `Inizierò a leggere ora.`,
    closing: (name) => `Questo conclude il documento. Se tutto è corretto, puoi procedere ad accettarlo. Grazie, ${name}.`
  },
  // Dutch
  'nl': {
    greeting: (name) => `Hallo ${name}. Bedankt dat je de tijd neemt om dit document met mij door te nemen.`,
    purpose: (docType) => `Voordat je deze ${docType} accepteert, wil ik het graag hardop voorlezen zodat je kunt bevestigen dat het nauwkeurig weergeeft wat je hebt geschreven. Deze getypte versie is voor duidelijkheid en documentatie. Luister alsjeblieft goed en laat ons weten als er iets gecorrigeerd moet worden.`,
    transition: `Ik begin nu met lezen.`,
    closing: (name) => `Dat is het einde van het document. Als alles correct is, kun je het accepteren. Bedankt, ${name}.`
  },
  // Polish
  'pl': {
    greeting: (name) => `Cześć ${name}. Dziękuję za poświęcenie czasu na przejrzenie tego dokumentu ze mną.`,
    purpose: (docType) => `Zanim zaakceptujesz tę ${docType}, chciałabym przeczytać ją na głos, abyś mógł potwierdzić, że dokładnie odzwierciedla to, co napisałeś. Ta wersja maszynowa służy przejrzystości i dokumentacji. Proszę, słuchaj uważnie i daj nam znać, jeśli coś wymaga poprawienia.`,
    transition: `Zaczynam czytać.`,
    closing: (name) => `To kończy dokument. Jeśli wszystko jest poprawne, możesz przystąpić do jego zaakceptowania. Dziękuję, ${name}.`
  },
  // Russian
  'ru': {
    greeting: (name) => `Здравствуйте ${name}. Спасибо, что уделили время для просмотра этого документа вместе со мной.`,
    purpose: (docType) => `Прежде чем принять эту ${docType}, я хотела бы прочитать её вслух, чтобы вы могли подтвердить, что она точно отражает то, что вы написали. Эта печатная версия предназначена для ясности и документации. Пожалуйста, внимательно слушайте и сообщите нам, если что-то нужно исправить.`,
    transition: `Я начинаю читать.`,
    closing: (name) => `На этом документ завершается. Если всё верно, вы можете его принять. Спасибо, ${name}.`
  },
  // Turkish
  'tr': {
    greeting: (name) => `Merhaba ${name}. Bu belgeyi benimle birlikte incelemeye zaman ayırdığınız için teşekkürler.`,
    purpose: (docType) => `Bu ${docType}'yı kabul etmeden önce, yazdıklarınızı doğru yansıttığını onaylayabilmeniz için yüksek sesle okumak istiyorum. Bu yazılı versiyon netlik ve belgeleme içindir. Lütfen dikkatli dinleyin ve düzeltilmesi gereken bir şey varsa bize bildirin.`,
    transition: `Şimdi okumaya başlıyorum.`,
    closing: (name) => `Belge burada sona eriyor. Her şey doğruysa, kabul etmeye devam edebilirsiniz. Teşekkürler, ${name}.`
  },
  // Thai
  'th': {
    greeting: (name) => `สวัสดีค่ะ ${name} ขอบคุณที่สละเวลามาตรวจสอบเอกสารนี้กับฉัน`,
    purpose: (docType) => `ก่อนที่คุณจะยอมรับ${docType}นี้ ฉันอยากจะอ่านออกเสียงให้คุณฟังเพื่อยืนยันว่าเอกสารสะท้อนสิ่งที่คุณเขียนได้อย่างถูกต้อง เอกสารฉบับพิมพ์นี้มีไว้เพื่อความชัดเจนและการจัดทำเอกสาร กรุณาฟังอย่างตั้งใจและแจ้งให้เราทราบหากมีสิ่งใดต้องแก้ไข`,
    transition: `ฉันจะเริ่มอ่านแล้วนะคะ`,
    closing: (name) => `เอกสารจบลงที่นี่ หากทุกอย่างถูกต้อง คุณสามารถดำเนินการยอมรับได้ ขอบคุณค่ะ ${name}`
  },
  // Vietnamese
  'vi': {
    greeting: (name) => `Xin chào ${name}. Cảm ơn bạn đã dành thời gian xem xét tài liệu này cùng tôi.`,
    purpose: (docType) => `Trước khi bạn chấp nhận ${docType} này, tôi muốn đọc to để bạn có thể xác nhận rằng nó phản ánh chính xác những gì bạn đã viết. Phiên bản đánh máy này nhằm mục đích rõ ràng và lưu trữ. Xin hãy lắng nghe cẩn thận và cho chúng tôi biết nếu có điều gì cần chỉnh sửa.`,
    transition: `Tôi sẽ bắt đầu đọc ngay bây giờ.`,
    closing: (name) => `Đó là kết thúc tài liệu. Nếu mọi thứ đều chính xác, bạn có thể tiếp tục chấp nhận. Cảm ơn bạn, ${name}.`
  },
  // Indonesian
  'id': {
    greeting: (name) => `Halo ${name}. Terima kasih telah meluangkan waktu untuk meninjau dokumen ini bersama saya.`,
    purpose: (docType) => `Sebelum Anda menerima ${docType} ini, saya ingin membacakannya dengan keras agar Anda dapat mengonfirmasi bahwa itu mencerminkan dengan akurat apa yang Anda tulis. Versi yang diketik ini untuk kejelasan dan dokumentasi. Silakan dengarkan dengan seksama dan beri tahu kami jika ada yang perlu diperbaiki.`,
    transition: `Saya akan mulai membaca sekarang.`,
    closing: (name) => `Itu mengakhiri dokumen. Jika semuanya benar, Anda dapat melanjutkan untuk menerimanya. Terima kasih, ${name}.`
  },
  // Malay
  'ms': {
    greeting: (name) => `Hai ${name}. Terima kasih kerana meluangkan masa untuk menyemak dokumen ini bersama saya.`,
    purpose: (docType) => `Sebelum anda menerima ${docType} ini, saya ingin membacanya dengan kuat supaya anda boleh mengesahkan bahawa ia mencerminkan dengan tepat apa yang anda tulis. Versi yang ditaip ini adalah untuk kejelasan dan dokumentasi. Sila dengar dengan teliti dan beritahu kami jika ada sesuatu yang perlu diperbetulkan.`,
    transition: `Saya akan mula membaca sekarang.`,
    closing: (name) => `Itu mengakhiri dokumen. Jika semuanya betul, anda boleh teruskan untuk menerimanya. Terima kasih, ${name}.`
  },
  // Swedish
  'sv': {
    greeting: (name) => `Hej ${name}. Tack för att du tar dig tid att granska detta dokument med mig.`,
    purpose: (docType) => `Innan du accepterar denna ${docType} vill jag läsa den högt så att du kan bekräfta att den korrekt återspeglar vad du skrev. Denna maskinskrivna version är för tydlighet och dokumentation. Lyssna noga och låt oss veta om något behöver korrigeras.`,
    transition: `Jag börjar läsa nu.`,
    closing: (name) => `Det avslutar dokumentet. Om allt är korrekt kan du fortsätta att acceptera det. Tack, ${name}.`
  },
  // Norwegian
  'nb': {
    greeting: (name) => `Hei ${name}. Takk for at du tar deg tid til å gjennomgå dette dokumentet med meg.`,
    purpose: (docType) => `Før du godtar denne ${docType}, vil jeg gjerne lese den høyt slik at du kan bekrefte at den nøyaktig gjenspeiler det du skrev. Denne maskinskrevne versjonen er for klarhet og dokumentasjon. Vennligst lytt nøye og gi oss beskjed hvis noe trenger å korrigeres.`,
    transition: `Jeg begynner å lese nå.`,
    closing: (name) => `Det avslutter dokumentet. Hvis alt er korrekt, kan du fortsette å godta det. Takk, ${name}.`
  },
  // Danish
  'da': {
    greeting: (name) => `Hej ${name}. Tak fordi du tager dig tid til at gennemgå dette dokument med mig.`,
    purpose: (docType) => `Før du accepterer denne ${docType}, vil jeg gerne læse den højt, så du kan bekræfte, at den nøjagtigt afspejler, hvad du skrev. Denne maskinskrevne version er til klarhed og dokumentation. Lyt venligst omhyggeligt og lad os vide, hvis noget skal rettes.`,
    transition: `Jeg begynder at læse nu.`,
    closing: (name) => `Det afslutter dokumentet. Hvis alt er korrekt, kan du fortsætte med at acceptere det. Tak, ${name}.`
  },
  // Finnish
  'fi': {
    greeting: (name) => `Hei ${name}. Kiitos, että käytät aikaa tämän asiakirjan tarkasteluun kanssani.`,
    purpose: (docType) => `Ennen kuin hyväksyt tämän ${docType}, haluaisin lukea sen ääneen, jotta voit vahvistaa, että se heijastaa tarkasti sitä, mitä kirjoitit. Tämä konekirjoitettu versio on selkeyden ja dokumentoinnin vuoksi. Kuuntele tarkasti ja kerro meille, jos jotain pitää korjata.`,
    transition: `Aloitan lukemisen nyt.`,
    closing: (name) => `Tämä päättää asiakirjan. Jos kaikki on oikein, voit jatkaa sen hyväksymistä. Kiitos, ${name}.`
  },
  // Hebrew
  'he': {
    greeting: (name) => `שלום ${name}. תודה שהקדשת זמן לסקור את המסמך הזה איתי.`,
    purpose: (docType) => `לפני שתקבל את ה${docType} הזו, אני רוצה לקרוא אותה בקול כדי שתוכל לאשר שהיא משקפת במדויק את מה שכתבת. הגרסה המודפסת הזו היא לשם בהירות ותיעוד. אנא הקשב בתשומת לב והודע לנו אם משהו צריך תיקון.`,
    transition: `אני מתחיל לקרוא עכשיו.`,
    closing: (name) => `זה מסיים את המסמך. אם הכל נכון, תוכל להמשיך לקבל אותו. תודה, ${name}.`
  },
  // Greek
  'el': {
    greeting: (name) => `Γεια σου ${name}. Σε ευχαριστώ που αφιερώνεις χρόνο για να εξετάσεις αυτό το έγγραφο μαζί μου.`,
    purpose: (docType) => `Πριν αποδεχτείς αυτή την ${docType}, θα ήθελα να τη διαβάσω δυνατά για να επιβεβαιώσεις ότι αντικατοπτρίζει με ακρίβεια αυτό που έγραψες. Αυτή η δακτυλογραφημένη έκδοση είναι για σαφήνεια και τεκμηρίωση. Παρακαλώ άκουσε προσεκτικά και ενημέρωσέ μας αν κάτι χρειάζεται διόρθωση.`,
    transition: `Θα αρχίσω να διαβάζω τώρα.`,
    closing: (name) => `Αυτό ολοκληρώνει το έγγραφο. Αν όλα είναι σωστά, μπορείς να προχωρήσεις στην αποδοχή του. Ευχαριστώ, ${name}.`
  },
  // Czech
  'cs': {
    greeting: (name) => `Ahoj ${name}. Děkuji, že si najdeš čas na kontrolu tohoto dokumentu se mnou.`,
    purpose: (docType) => `Než přijmeš tuto ${docType}, ráda bych ji přečetla nahlas, abys mohl potvrdit, že přesně odráží to, co jsi napsal. Tato psaná verze je pro přehlednost a dokumentaci. Prosím, poslouchej pozorně a dej nám vědět, pokud je třeba něco opravit.`,
    transition: `Začínám číst.`,
    closing: (name) => `Tím dokument končí. Pokud je vše v pořádku, můžeš pokračovat v jeho přijetí. Děkuji, ${name}.`
  },
  // Hungarian
  'hu': {
    greeting: (name) => `Szia ${name}. Köszönöm, hogy időt szánsz ennek a dokumentumnak az áttekintésére velem.`,
    purpose: (docType) => `Mielőtt elfogadod ezt a ${docType}-t, szeretném felolvasni, hogy megerősíthesd, pontosan tükrözi-e azt, amit írtál. Ez a gépelt verzió az egyértelműség és a dokumentálás érdekében készült. Kérlek, figyelj jól, és szólj, ha valamit javítani kell.`,
    transition: `Most kezdem az olvasást.`,
    closing: (name) => `Ezzel a dokumentum végére értünk. Ha minden helyes, folytathatod az elfogadással. Köszönöm, ${name}.`
  },
  // Romanian
  'ro': {
    greeting: (name) => `Bună ${name}. Îți mulțumesc că îți faci timp să revizuiești acest document cu mine.`,
    purpose: (docType) => `Înainte de a accepta această ${docType}, aș dori să o citesc cu voce tare pentru ca tu să poți confirma că reflectă cu acuratețe ceea ce ai scris. Această versiune dactilografiată este pentru claritate și documentare. Te rog să asculți cu atenție și să ne anunți dacă ceva trebuie corectat.`,
    transition: `Voi începe să citesc acum.`,
    closing: (name) => `Aceasta încheie documentul. Dacă totul este corect, poți continua să îl accepți. Mulțumesc, ${name}.`
  },
  // Ukrainian
  'uk': {
    greeting: (name) => `Привіт ${name}. Дякую, що знайшли час переглянути цей документ зі мною.`,
    purpose: (docType) => `Перед тим як прийняти цю ${docType}, я хотіла б прочитати її вголос, щоб ви могли підтвердити, що вона точно відображає те, що ви написали. Ця друкована версія призначена для ясності та документування. Будь ласка, уважно слухайте і повідомте нам, якщо щось потрібно виправити.`,
    transition: `Я починаю читати.`,
    closing: (name) => `На цьому документ завершується. Якщо все правильно, ви можете прийняти його. Дякую, ${name}.`
  },
  // Swahili
  'sw': {
    greeting: (name) => `Habari ${name}. Asante kwa kuchukua muda kukagua hati hii pamoja nami.`,
    purpose: (docType) => `Kabla ya kukubali ${docType} hii, ningependa kuisoma kwa sauti ili uweze kuthibitisha kwamba inaakisi kwa usahihi ulichoandika. Toleo hili lililoandikwa kwa kompyuta ni kwa uwazi na nyaraka. Tafadhali sikiliza kwa makini na tuambie ikiwa kuna kitu kinachohitaji kusahihishwa.`,
    transition: `Nitaanza kusoma sasa.`,
    closing: (name) => `Hiyo inahitimisha hati. Ikiwa kila kitu ni sahihi, unaweza kuendelea kuikubali. Asante, ${name}.`
  },
  // Afrikaans
  'af': {
    greeting: (name) => `Hallo ${name}. Dankie dat jy die tyd geneem het om hierdie dokument saam met my te hersien.`,
    purpose: (docType) => `Voordat jy hierdie ${docType} aanvaar, wil ek dit graag hardop lees sodat jy kan bevestig dat dit akkuraat weerspieël wat jy geskryf het. Hierdie getikte weergawe is vir duidelikheid en dokumentasie. Luister asseblief noukeurig en laat ons weet as iets reggestel moet word.`,
    transition: `Ek sal nou begin lees.`,
    closing: (name) => `Dit sluit die dokument af. As alles korrek is, kan jy voortgaan om dit te aanvaar. Dankie, ${name}.`
  }
};

// Helper function to get base language code (e.g., "en-US" -> "en")
function getBaseLanguageCode(languageCode: string): string {
  return languageCode.split('-')[0].toLowerCase();
}

/**
 * Convert text to speech using OpenAI TTS API with female voice
 * Supports multiple languages with localized greetings
 * POST /api/document-ocr/text-to-speech
 */
router.post('/text-to-speech', async (req: Request, res: Response) => {
  try {
    const { text, employeeName, documentType = 'complaint', languageCode = 'en-US' } = req.body as TTSRequest;

    if (!text || !employeeName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Both text and employeeName are required'
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'OpenAI API key not configured'
      });
    }

    // Get the appropriate language script
    const baseLanguage = getBaseLanguageCode(languageCode);
    const scripts = languageScripts[baseLanguage] || languageScripts['en'];
    
    // Build the complete speech script with greeting and introduction
    const firstName = employeeName.split(' ')[0];
    const greeting = scripts.greeting(firstName);
    const purpose = scripts.purpose(documentType);
    const transition = scripts.transition;
    const closing = scripts.closing(firstName);

    const fullScript = `${greeting} ${purpose} ${transition} ... ${text} ... ${closing}`;

    console.log(`TTS request for ${employeeName}, language: ${languageCode}, text length: ${text.length}`);

    // Call OpenAI TTS API with "nova" voice (confident female)
    // OpenAI TTS automatically handles multiple languages
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1-hd', // High definition for better quality
      voice: 'nova',     // Confident, friendly female voice
      input: fullScript,
      response_format: 'mp3',
      speed: 0.95        // Slightly slower for clarity
    });

    // Convert to base64
    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    const audioBase64 = buffer.toString('base64');

    return res.json({
      success: true,
      data: {
        audioBase64,
        format: 'mp3',
        languageCode,
        greeting,
        purpose,
        transition,
        closing,
        documentText: text
      }
    });

  } catch (error: any) {
    console.error('TTS error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate speech',
      message: error.message || 'An error occurred during text-to-speech conversion'
    });
  }
});

export default router;
