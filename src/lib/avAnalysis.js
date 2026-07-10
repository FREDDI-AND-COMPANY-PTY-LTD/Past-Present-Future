import { base44 } from '@/api/base44Client';

export async function analyzeAudioVideo(fileUrl, fileName, fileType) {
  const isAudio = fileType.startsWith('audio/');

  let transcript = '';
  if (isAudio) {
    try {
      const res = await base44.integrations.Core.TranscribeAudio({ audio_url: fileUrl });
      transcript = typeof res === 'string' ? res : (res?.text || '');
    } catch (e) {
      // transcription failed — continue with filename only
    }
  }

  const prompt = `You are a genealogical and family history analyst working on a private family archive. A family member has uploaded a ${isAudio ? 'audio' : 'video'} recording.

--- FILE NAME ---
The file is named: "${fileName}"
File names often contain valuable genealogical metadata — names of people, places, dates, event types, or other identifying information. Parse the file name carefully and use ANY information found in it to populate the fields below.
--- END FILE NAME ---
${transcript ? `
--- TRANSCRIPT ---
The following transcript was extracted from the audio recording:
${transcript}
--- END TRANSCRIPT ---` : ''}

Your job is to extract any family history relevant information from this ${isAudio ? 'audio' : 'video'} file, using the file name${transcript ? ' and transcript' : ''} as your sources.

Identify:
- Any names of people mentioned or implied
- Any dates (in any format)
- Any locations or place names
- The type of event or content (interview, family gathering, oral history, speech, music performance, home video, documentary, etc.)
- Any other genealogically relevant information

Return JSON with this structure:
{
  "type": "${isAudio ? 'audio' : 'video'}",
  "document_subtype": "",
  "ai_confidence": 0.0 to 1.0 (your confidence in the classification and extracted data),
  "categorization_notes": "Your reasoning for the classification and what information you extracted from the file name${transcript ? ' and transcript' : ''}",
  "transcription": ${transcript ? `"The full transcript text"` : '""'},
  "extracted_fields": {
    "full_name": "", "date_of_event": "", "place_of_event": "", "event_type": "", "participants": "", "notes": ""
  },
  "event_location": "The geographic location WHERE THE EVENT took place, if determinable from the file name${transcript ? ' or transcript' : ''}. Be as specific as possible (city, state, country). Empty string if no location can be determined.",
  "visual_elements": {},
  "suggested_title": "A short descriptive title for this item, including the type and primary person/place/date if known (e.g. 'Oral History Interview — Nonna Maria (1985)', 'Family Video — Christmas at Home, Melbourne')",
  "suggested_description": "A brief description of what this item is and its potential significance to family history",
  "suggested_tags": ["array", "of", "relevant", "tags", "e.g.", "oral history", "interview", "Melbourne", "1980s"]
}`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        document_subtype: { type: 'string' },
        ai_confidence: { type: 'number' },
        categorization_notes: { type: 'string' },
        transcription: { type: 'string' },
        extracted_fields: { type: 'object' },
        event_location: { type: 'string' },
        visual_elements: { type: 'object' },
        suggested_title: { type: 'string' },
        suggested_description: { type: 'string' },
        suggested_tags: { type: 'array', items: { type: 'string' } },
      },
    },
  });

  return result;
}