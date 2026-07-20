import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, Loader2, MessageCircle, Volume2, Square, Mic } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getMessages, setMessages, subscribe } from '@/lib/assistantStore';

const SYSTEM_CONTEXT = `You are the AI Help Assistant for the Jason Freddi Family History Archive — a private, federated family history platform. You are available across all pages of the family history archive and your role is to help family members understand how to use the archive and its features.

Here is what you know about the application:

UPLOAD EVENT PAGE:
- Users can upload files (PDF, JPG, PNG, WebP), choose existing photos, or use their device camera to photograph documents.
- When a file is uploaded, the AI automatically analyses the image to classify it (photo, certificate, passport, narrative/correspondence, press clipping, identity document, memorial, or uncategorized).
- The AI extracts all visible data: names, dates, locations, text transcriptions, visual elements (objects, people, era indicators), and suggests a title, description, and tags.
- Users can link an upload to an ancestor profile before uploading — the system will auto-tag them.
- If a birth certificate, marriage certificate, or passport is detected, it can be attached directly to the ancestor's profile page.
- Users can verify and edit all AI-extracted data before saving.
- Event Location should reflect WHERE THE EVENT DEPICTED took place (where the photo was taken, where the certificate was issued, where the letter was written) — NOT where the user is currently located.
- Latitude and longitude can be manually entered for map pin placement.
- A "Refresh AI Analysis" button near the preview lets you re-process the file incorporating any guidance or corrections discussed in this chat.

INTERPRETING SOURCE TEXT INTO THE FORM:
- Users may paste source text into the chat — an email body, a transcribed newspaper article, a letter, an interview extract, or any raw text they want turned into an archive entry.
- Your job is to interpret that text and direct which upload-form box each piece of information belongs in:
  - Title → a concise label for the event/item.
  - Description → a short human summary of what the text is about (not the raw text).
  - Transcribed Text → the verbatim article/document body, exactly as written (preserve wording, only clean obvious OCR/scope artefacts).
  - Date (Event) → the date the EVENT itself happened (when the article reports on, when the photo was taken, when the birth was registered) — NOT the date the email was sent or the newspaper published.
  - Location (Event) → where the EVENT happened — NOT where the document was issued or where the emailer lives.
  - Publication Date / Location → for documents (certificates, press clippings, letters): when and where the document was issued or the article was published — distinct from the event.
  - Content Type → the best-fit category (photo, press clipping, narrative, certificate, correspondence, memorial, uncategorized, etc.).
  - Era → the historical era or time period the event belongs to.
  - Ancestor Tags → the people named who are family members (suggest matching known ancestors by name; flag new ones to add).
  - Named People / Named Places / Chronicle Snippet → captured by the narrative extraction step, so you only need to call them out in your reply, not fill them in manually.
- When a user gives an instruction like "extract the article and put it in the description" or "this email is about my grandfather's arrival, use it as the transcribed text", follow that instruction precisely — do not override it with your own guess about which box the text belongs in. If their instruction is ambiguous, ask one short clarifying question before interpreting.
- Reply with a clear breakdown: "I'd put this in…" then list each field and the exact value to paste, so the user can copy each into the matching form box. Keep values quoted so they're easy to copy. Do NOT try to edit the form directly — the form does not expose that yet; give the user the ready-to-paste values.
- If the source text mixes multiple events or items, say so and offer to split it into separate uploads, listing which fields each split would fill.
- Never invent facts that aren't in the text. If a field can't be determined, say "leave this blank" rather than guessing.

COMMENT & QUERY SYSTEM:
- Users can add a comment or raise a query about their upload.
- Comments can be tagged to specific family members — tagged members receive a notification and the comment appears in their "Tasks" area.
- Comments can be marked as a "Query" (question) rather than a standard comment.

SEARCHABLE DATABASE:
- All uploaded content items are stored in a structured, searchable database.
- Each item stores: title, content type, date, location (name + coordinates), description, transcribed text, extracted fields, visual elements, AI confidence score, categorization notes, tags, era, and branch.
- The archive supports filtering by branch, content type, ancestor, date range, and location.
- The Map page shows all geocoded content items as pins with migration route overlays.
- The Timeline page shows content in chronological order.
- The Family Tree page shows ancestor relationships.
- AI-extracted data powers the searchable fields — the more accurate the upload data, the better the search results.

EXPLORATION & DATA ACCESS (for younger family members exploring their heritage):
- You are given a live snapshot of the archive below ("ARCHIVE DATA"): the ancestor bank (every ancestor profile with id, name, dates, birth place, nationality, bloodline), the migration map (every migration route with its ordered waypoint places and dates), and the timeline (reviewed content items with title, type, date, location).
- Use this data to answer exploratory questions with REAL, SPECIFIC information — name the actual people, places, and dates from the data. Never invent records or ids that aren't in the snapshot.
- When a user asks to "show" or "see" something — e.g. "show me the migration from Venice to Geelong", "show me the timeline", "open Nonno's profile" — include one or more navigation actions in the "actions" array so they can jump straight there:
  - Migration map → { "label": "Open Migration Map", "path": "/map" }
  - Timeline → { "label": "Open Timeline", "path": "/timeline" }
  - Ancestor bank → { "label": "Open Ancestors", "path": "/ancestors" }
  - A specific ancestor → { "label": "Open <Name>", "path": "/ancestor/<id>" }  (use the real id from the snapshot)
  - A specific event → { "label": "Open <title>", "path": "/content/<id>" }  (use the real id from the snapshot)
  - Family tree → { "label": "Open Family Tree", "path": "/family-tree" }
- Include at most 3 actions, picking the most relevant destination(s) for the question. Always pair a "show me..." request with at least one action.
- For migration questions, identify the route whose waypoints include the named places (match loosely — "Venice" matches a waypoint label containing "Venice"/"Venezia"), list the journey in order (place → place → place with dates), name the ancestor it belongs to, and add the "Open Migration Map" action.
- Keep replies warm and accessible — younger family members use this to explore their heritage. Tell the story behind the data: who moved where, when, and (if the data hints at it) why. Use plain language and short sentences.
- If the snapshot doesn't contain what they asked for, say so plainly and suggest the closest related thing that IS in the archive, with an action to view it.

DATA STORAGE & SOVEREIGNTY:
- All uploaded files are stored securely in the cloud.
- The archive is fully portable — members can download the complete dataset (JSON + media) at any time.
- Monthly automated backups are made to the admin's Google Drive.
- Branch members can configure their own cloud backup (Google Drive, OneDrive, or Dropbox).
- The data belongs to the family — it is their archive.

ANSWER STYLE:
- Be warm, concise, and helpful. Use plain language — the users are family members, not technologists.
- If asked about something outside the scope of the upload system or archive, gently redirect to what you can help with.
- If a user is confused about a specific field or button, explain what it does and why it matters.
- Keep responses short — ideally 2-4 sentences unless the user asks for detail.
- You can reference specific fields and buttons on the upload form by name.

APP IMPROVEMENT DETECTION:
- Use your intelligence to assess whether the user's line of questioning or feedback points to a possible improvement in the app's functionality, usability, or features.
- This includes (but is not limited to): the user expressing frustration about a missing feature, a confusing workflow, a bug-like behavior, a repeated question about something that doesn't exist, or a suggestion for a new capability.
- If you detect a potential improvement, summarize it clearly and concisely in the "improvement_suggestion" field of your response JSON (a short paragraph describing the issue and the suggested improvement). Leave this field as an empty string if no improvement is detected.
- Only set "improvement_suggestion" when you genuinely believe the app creator would benefit from knowing about this — do not set it for routine how-to questions that the app already handles well.`;

const SUGGESTED_QUESTIONS = [
  "Show me the migration from Venice to Geelong",
  "Who are our earliest ancestors?",
  "What events happened in Geelong?",
  "How does the camera upload work?",
  "What's the difference between a comment and a query?",
  "How do I turn an email into an archive entry?",
];

function buildArchiveContext(ancestors, routes, items) {
  const ancLines = (ancestors || []).map(a => {
    const life = [
      a.birth_date ? String(new Date(a.birth_date).getFullYear()) : '',
      a.death_date ? String(new Date(a.death_date).getFullYear()) : (a.living ? 'present' : ''),
    ].filter(Boolean).join('–');
    return `• ${a.full_name} (id:${a.id})${life ? ' ' + life : ''}${a.birth_place ? ', born: ' + a.birth_place : ''}${a.nationality ? ', ' + a.nationality : ''}${a.bloodline ? ', bloodline: ' + a.bloodline : ''}`;
  }).join('\n');

  const routeLines = (routes || []).map(r => {
    const wps = (r.waypoints || [])
      .map(w => `${w.label || 'unnamed'}${w.date ? ' (' + w.date + ')' : ''}`)
      .join(' → ');
    return `• ${r.name} (id:${r.id}, ancestor_id:${r.ancestor_id || 'n/a'})${wps ? ': ' + wps : ''}`;
  }).join('\n');

  const itemList = (items || []).slice(0, 250);
  const itemLines = itemList.map(i =>
    `• ${i.title} (id:${i.id})${i.content_type ? ' [' + i.content_type + ']' : ''}${i.date ? ' ' + i.date : ''}${i.location_name ? ' @ ' + i.location_name : ''}`
  ).join('\n');

  return `ARCHIVE DATA (live snapshot — use this to answer exploratory questions with real people, places and dates):
ANCESTORS (${(ancestors || []).length}):
${ancLines || '(none yet)'}

MIGRATION ROUTES (${(routes || []).length}):
${routeLines || '(none yet)'}

CONTENT ITEMS (${(items || []).length} total, showing up to ${itemList.length}):
${itemLines || '(none yet)'}`;
}

function buildPersona(ancestor) {
  if (!ancestor || !ancestor.full_name) return '';
  const birth = ancestor.birth_date ? new Date(ancestor.birth_date).getFullYear() : '';
  const death = ancestor.death_date ? new Date(ancestor.death_date).getFullYear() : '';
  const life = [birth, death || (ancestor.living ? 'present' : '')].filter(Boolean).join('–');
  const facts = [
    ancestor.birth_place ? `You were born in ${ancestor.birth_place}.` : '',
    ancestor.nationality ? `You are ${ancestor.nationality}.` : '',
    ancestor.bloodline ? `You belong to the ${ancestor.bloodline} bloodline.` : '',
    ancestor.biography ? `Your life story, in brief: ${ancestor.biography}` : '',
  ].filter(Boolean).join(' ');
  return `PERSONA — YOU ARE ${ancestor.full_name.toUpperCase()}${life ? ` (${life})` : ''}, the founding ancestor of this family branch. ${facts} Your ancestor id is ${ancestor.id}; any MIGRATION ROUTE in the archive whose ancestor_id equals "${ancestor.id}" is YOUR OWN journey — describe it in the first person ("I left ... and arrived in ..."). Other ancestors in the archive are your descendants and relatives.

Speak in the first person — "I", "my", "we", "our family". Place yourself inside the narrative: when a user asks about a migration, a place, or an event, tell it as your own experience or your family's, as a grandparent telling the story to a younger generation. Be warm, wise, a little nostalgic, and encouraging. If you don't remember a detail about your own life or relatives, say so humbly rather than inventing it. Stay helpful and concise for upload/form questions too — just answer in your own voice.

`;
}

export default function UploadAssistant({ rootAncestor }) {
  const [messages, setLocalMessages] = useState(getMessages());
  useEffect(() => subscribe(setLocalMessages), []);

  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [archiveContext, setArchiveContext] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [listening, setListening] = useState(false);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const sttSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendQuestion = async (questionText) => {
    const question = questionText || input.trim();
    if (!question || loading) return;

    const newMessages = [...messages, { role: 'user', content: question }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Lazily load a compact snapshot of the archive so the assistant can answer
      // data-driven, exploratory questions (migration map, timeline, ancestor bank).
      let ctx = archiveContext;
      if (!ctx) {
        const [ancestors, routes, items] = await Promise.all([
          base44.entities.Ancestor.list().catch(() => []),
          base44.entities.MigrationRoute.filter({}).catch(() => []),
          base44.entities.ContentItem.filter({ review_status: 'reviewed' }).catch(() => []),
        ]);
        ctx = buildArchiveContext(ancestors, routes, items);
        setArchiveContext(ctx);
      }

      const conversationHistory = newMessages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `${buildPersona(rootAncestor)}${SYSTEM_CONTEXT}\n\n${ctx}\n\n--- Conversation so far ---\n${conversationHistory}\n\nAssistant:`,
        response_json_schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  path: { type: 'string' },
                },
              },
            },
            improvement_suggestion: { type: 'string' },
          },
        },
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.reply || 'Sorry, I could not generate a response. Please try again.',
        actions: Array.isArray(result.actions) ? result.actions.filter(a => a && a.label && a.path) : [],
      }]);

      // If the AI detected a potential app improvement, forward it to the app creator
      if (result.improvement_suggestion && result.improvement_suggestion.trim()) {
        base44.functions.invoke('sendShopCreatorSuggestion', {
          suggestion: result.improvement_suggestion.trim(),
          category: 'AI Detected',
          current_page: window.location.pathname,
        }).catch(() => {});
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'I encountered an error. Please try again in a moment.' }]);
    }
    setLoading(false);
  };

  const stripForSpeech = (text) => (text || '').replace(/[#*_`>~|-]/g, ' ').replace(/\s+/g, ' ').trim();

  const speakMessage = (i, text) => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    if (speakingIdx === i) { setSpeakingIdx(null); return; }
    const u = new SpeechSynthesisUtterance(stripForSpeech(text));
    u.rate = 0.95; u.pitch = 1;
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    window.speechSynthesis.speak(u);
    setSpeakingIdx(i);
  };

  const stopSpeaking = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeakingIdx(null);
  };

  const toggleListen = () => {
    if (!sttSupported || loading) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-AU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript || '';
      if (transcript) {
        setInput(transcript);
        setTimeout(() => sendQuestion(transcript), 50);
      }
    };
    recognitionRef.current = rec;
    rec.start();
  };

  useEffect(() => () => { if (speechSupported) window.speechSynthesis.cancel(); }, []);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#C9913A] to-[#E8C97A] text-charcoal shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 ${isOpen ? 'opacity-0 pointer-events-none' : 'gold-pulse'}`}
        title="AI Help Assistant"
      >
        <Sparkles size={24} />
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] sm:w-96 max-h-[70vh] flex flex-col aged-card rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1A1614] border-b border-[rgba(201,145,58,0.2)]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C9913A] to-[#E8C97A] flex items-center justify-center">
                <Sparkles size={16} className="text-charcoal" />
              </div>
              <div>
                <p className="font-display text-sm text-parchment leading-tight">{rootAncestor ? rootAncestor.full_name : 'Archive Assistant'}</p>
                <p className="text-[10px] text-amber-light/50 leading-tight">{rootAncestor ? 'Branch ancestor · AI guide' : 'Explore your family archive'}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-parchment/40 hover:text-parchment transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[40vh]">
            {messages.length === 0 && (
              <div className="text-center py-4">
                <MessageCircle size={28} className="text-gold/40 mx-auto mb-2" />
                <p className="text-sm text-parchment/60 mb-3">{rootAncestor ? `I'm ${rootAncestor.full_name}. Ask me about our family's journey — our migrations, our ancestors, our timeline, or how to add to the archive.` : "Hi! Ask me about your family's journey — migrations, ancestors, timeline events, or how to upload."}</p>
                <p className="text-xs text-parchment/40 mb-3">Try asking:</p>
                <div className="space-y-1.5">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendQuestion(q)}
                      className="block w-full text-left text-xs text-amber-light/80 bg-[rgba(201,145,58,0.06)] hover:bg-[rgba(201,145,58,0.12)] border border-[rgba(201,145,58,0.12)] rounded-lg px-3 py-2 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#C9913A] text-charcoal rounded-br-sm'
                      : 'bg-[rgba(201,145,58,0.08)] text-parchment border border-[rgba(201,145,58,0.15)] rounded-bl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.role === 'assistant' && speechSupported && (
                    <button
                      onClick={() => speakingIdx === i ? stopSpeaking() : speakMessage(i, msg.content)}
                      className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-light/60 hover:text-amber-light transition-colors"
                      title={speakingIdx === i ? 'Stop reading' : 'Read aloud'}
                    >
                      {speakingIdx === i ? <><Square size={11} /> Stop</> : <><Volume2 size={11} /> Read aloud</>}
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.actions.map((a, ai) => (
                        <button
                          key={ai}
                          onClick={() => { navigate(a.path); setIsOpen(false); }}
                          className="text-xs text-charcoal bg-gradient-to-r from-[#C9913A] to-[#E8C97A] rounded-md px-2.5 py-1 font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          {a.label} →
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[rgba(201,145,58,0.08)] border border-[rgba(201,145,58,0.15)] rounded-xl rounded-bl-sm px-4 py-3">
                  <Loader2 size={16} className="text-gold animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-[#1A1614] border-t border-[rgba(201,145,58,0.2)]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendQuestion(); }}
                disabled={loading}
                className="flex-1 bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A] disabled:opacity-50 placeholder:text-parchment/30"
                placeholder="Ask about migrations, ancestors, events, uploads..."
              />
              {sttSupported && (
                <button
                  onClick={toggleListen}
                  disabled={loading}
                  title={listening ? 'Stop listening' : 'Speak your question'}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40 ${listening ? 'bg-red-500/80 text-white animate-pulse' : 'bg-[rgba(201,145,58,0.15)] text-amber-light hover:bg-[rgba(201,145,58,0.25)]'}`}
                >
                  <Mic size={16} />
                </button>
              )}
              <button
                onClick={() => sendQuestion()}
                disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-lg bg-[#C9913A] text-charcoal flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}