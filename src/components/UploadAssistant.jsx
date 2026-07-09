import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, MessageCircle } from 'lucide-react';
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
- You can reference specific fields and buttons on the upload form by name.`;

const SUGGESTED_QUESTIONS = [
  "How does the camera upload work?",
  "What happens after I upload a file?",
  "Where are my uploaded photos stored?",
  "How do I tag a family member in a comment?",
  "What's the difference between a comment and a query?",
  "How does the searchable database work?",
];

export default function UploadAssistant() {
  const [messages, setLocalMessages] = useState(getMessages());
  useEffect(() => subscribe(setLocalMessages), []);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
      const conversationHistory = newMessages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `${SYSTEM_CONTEXT}\n\n--- Conversation so far ---\n${conversationHistory}\n\nAssistant:`,
        response_json_schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
          },
        },
      });

      setMessages(prev => [...prev, { role: 'assistant', content: result.reply || 'Sorry, I could not generate a response. Please try again.' }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'I encountered an error. Please try again in a moment.' }]);
    }
    setLoading(false);
  };

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
                <p className="font-display text-sm text-parchment leading-tight">Archive Assistant</p>
                <p className="text-[10px] text-amber-light/50 leading-tight">AI help for uploads & the archive</p>
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
                <p className="text-sm text-parchment/60 mb-3">Hi! I'm here to help with the upload form and the archive.</p>
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
                  {msg.content}
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
                placeholder="Ask about uploads, storage, the database..."
              />
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