import { base44 } from '@/api/base44Client';

const ANALYSIS_PROMPT = `You are a sophisticated genealogical and historical document analyst working on a family history archive. You are analysing an image that could be ANYTHING — a photograph (portrait, landscape, group photo), a document (certificate, letter, passport, newspaper), a poster, a concert ticket, a postcard, a drawing, a map, a receipt, or any other type of visual artifact from a family's history.

Your job is to:
1. Identify what the image IS — but be honest about uncertainty
2. Extract ALL visible data — every piece of text, every visible object, every person, every date, every location, every notable visual element
3. Provide a confidence score for your classification
4. Note your reasoning — what visual elements led to your conclusion, and what uncertainty remains

CATEGORIES (choose the single best fit, or "uncategorized" if you cannot confidently classify):
1. "photo" — A PHOTOGRAPH of a person, place, or event (portrait, landscape, group photo, etc.)
2. "narrative" — A DIARY ENTRY, MEMOIR, or handwritten personal story — transcribe the full text
3. "correspondence" — A LETTER, POSTCARD, or TELEGRAM (personal correspondence) — transcribe the full text, note sender/recipient
4. "press_clipping" — A NEWSPAPER ARTICLE or published media clipping — transcribe the full text
5. "passport" — A PASSPORT or travel document
6. "identity_document" — Other IDENTITY/TRAVEL documents (driver's licence, national ID, visa, residency permit)
7. "certificate" — Any FORMAL RECORD, official document, or certificate (birth, death, marriage, baptism, military, census, immigration, naturalization, etc.)
8. "memorial" — A MEMORIAL, obituary, or commemorative item
9. "uncategorized" — Use when you CANNOT confidently classify the image.

REGARDLESS OF CATEGORY — always extract ALL visible data:
- Transcribe ALL readable text
- Note ALL visible dates (in any format)
- Note ALL visible names
- Note ALL visible locations/places
- Describe ALL visible objects, subjects, and visual elements
- Describe any people visible (age estimate, gender, clothing, posture, count)
- Note the format, layout, style, and condition of the image
- Note any era indicators (clothing style, photo quality, document format, language, etc.)
- Identify any family history relevance

For certificates and formal documents, extract all genealogically relevant fields including:
- Full names (subject, parents, spouse, witnesses, informant)
- Dates (birth, death, marriage, event, registration, issue, arrival, naturalization)
- Places (birth, death, marriage, residence, origin, destination, issuing authority)
- Nationality, citizenship, religion, occupation
- Document numbers, registration numbers, volume/page references
- Ship name, port of departure/arrival (for passenger manifests)
- Military unit, rank, service number (for military records)

Return JSON with this structure:
{
  "type": "photo" | "narrative" | "correspondence" | "press_clipping" | "passport" | "identity_document" | "certificate" | "memorial" | "uncategorized",
  "document_subtype": "birth_certificate" | "death_certificate" | "marriage_certificate" | "baptism_or_church_record" | "passenger_manifest_or_ship_record" | "passport_or_travel_document" | "naturalization_or_citizenship" | "census_record" | "military_record" | "immigration_or_border_record" | "statutory_declaration_or_affidavit" | "property_or_land_record" | "other_official_record" | "" (empty if not applicable),
  "ai_confidence": 0.0 to 1.0 (your confidence in the classification — be honest),
  "categorization_notes": "Your reasoning for the classification.",
  "transcription": "Full text transcribed from the image, if any readable text exists — otherwise empty string.",
  "extracted_fields": {
    "full_name": "", "date_of_birth": "", "place_of_birth": "", "date_of_death": "", "place_of_death": "",
    "mother_name": "", "father_name": "", "spouse_name": "", "witnesses": "", "issuing_authority": "",
    "date_of_event": "", "place_of_event": "", "nationality": "", "religion": "", "occupation": "",
    "document_number": "", "registration_number": "", "ship_name": "", "port_of_departure": "", "port_of_arrival": "",
    "military_unit": "", "rank": "", "service_number": "", "residence_address": "",
    "passport_number": "", "date_of_issue": "", "date_of_expiry": "", "issuing_country": "",
    "place_of_issue": "", "surname": "", "given_names": "", "national_id_number": "",
    "sex": "", "height": "", "profession": "", "distinguishing_marks": "", "photograph_present": ""
  },
  "event_location": "The geographic location WHERE THE EVENT DEPICTED in this image/document took place — NOT the location of the person viewing or uploading it. For a photo, this is where the photo was taken. For a certificate, this is where the birth/marriage/death was registered. Be as specific as possible (city, state, country). Empty string if no location can be determined.",
  "visual_elements": {
    "objects": ["list of ALL visible objects"],
    "people": ["descriptions of visible people"],
    "text_elements": ["notable text elements visible"],
    "dates_visible": ["any dates visible in any format"],
    "locations_visible": ["any place names visible"],
    "format_description": "description of the image format, layout, and style",
    "era_indicators": ["visual clues about the time period"],
    "notable_features": ["any other notable visual features"]
  },
  "suggested_title": "a short descriptive title for this item",
  "suggested_description": "a brief description of what this item is and its potential significance to family history",
  "suggested_tags": ["array", "of", "relevant", "tags"]
}`;

export async function analyzeImage(fileUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: ANALYSIS_PROMPT,
    file_urls: [fileUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['photo', 'narrative', 'correspondence', 'press_clipping', 'passport', 'identity_document', 'certificate', 'memorial', 'uncategorized'] },
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