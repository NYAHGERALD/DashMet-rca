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

export default router;
