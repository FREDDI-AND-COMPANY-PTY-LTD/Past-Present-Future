import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Loader2, CheckCircle2, XCircle, Trophy, RotateCcw, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

const QUESTIONS_PER_ROUND = 10;

export default function Quiz() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.QuizResult.list('-score', 10)
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const generateRound = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setQuestions([]);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setFinished(false);
    try {
      const ancestors = await base44.entities.Ancestor.list();
      const facts = (ancestors || [])
        .filter(a => a.full_name && (a.birth_place || a.birth_date || a.nationality || a.bloodline || a.biography))
        .map(a => ({
          full_name: a.full_name,
          birth_place: a.birth_place,
          birth_date: a.birth_date,
          nationality: a.nationality,
          bloodline: a.bloodline,
          sex: a.sex,
          maiden_name: a.maiden_name,
          biography: a.biography ? a.biography.slice(0, 200) : undefined,
        }));

      const prompt = `You are writing a family-history trivia quiz for the Freddi family archive.
Use ONLY the real ancestor facts below. Do not invent facts that are not present.
Generate exactly ${QUESTIONS_PER_ROUND} multiple-choice questions about specific things in this family archive.
Each question must have 4 options and exactly one correct answer.
Vary the question types: birthplaces, nationalities, bloodlines, maiden names, dates, and biographical details.
Return JSON matching the schema.

Real ancestor facts:
${JSON.stringify(facts, null, 2)}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  correct_index: { type: 'number' },
                  explanation: { type: 'string', description: 'One sentence explaining the correct answer with the real fact' },
                },
                required: ['question', 'options', 'correct_index', 'explanation'],
              },
            },
          },
          required: ['questions'],
        },
      });

      const qs = (res && res.questions) || [];
      if (qs.length === 0) throw new Error('No questions generated');
      setQuestions(qs);
    } catch (e) {
      setError('Could not generate the quiz right now. Please try again.');
    }
    setGenerating(false);
  }, []);

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (idx === questions[current].correct_index) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      setFinished(true);
      const name = user?.full_name || user?.email || 'Family Member';
      const label = `Family Trivia — ${new Date().toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`;
      base44.entities.QuizResult.create({
        player_name: name,
        score: score,
        total: questions.length,
        round_label: label,
      }).then(() => base44.entities.QuizResult.list('-score', 10).then(setLeaderboard).catch(() => {}));
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const restart = () => generateRound();

  if (loading) {
    return <Layout><div className="flex justify-center py-12"><Loader2 size={24} className="text-gold animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
            <Brain size={22} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-parchment">Family Trivia</h1>
            <p className="text-parchment/50 text-sm">The AI quizzes you on real facts from the Freddi family archive.</p>
          </div>
        </div>

        {/* Start screen */}
        {questions.length === 0 && !generating && !error && (
          <div className="aged-card rounded-2xl p-8 mt-6 text-center">
            <Sparkles size={28} className="text-gold mx-auto mb-3" />
            <p className="text-parchment/70 mb-1">Each round draws {QUESTIONS_PER_ROUND} fresh questions from the real ancestor records.</p>
            <p className="text-parchment/40 text-sm mb-6">Birthplaces, bloodlines, maiden names, dates and more — see how well you know your family.</p>
            <button onClick={generateRound}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold hover:opacity-90 transition-opacity mx-auto">
              <Brain size={18} /> Start a Round
            </button>
          </div>
        )}

        {generating && (
          <div className="aged-card rounded-2xl p-12 mt-6 text-center">
            <Loader2 size={28} className="text-gold animate-spin mx-auto mb-3" />
            <p className="text-parchment/60">Generating your questions from the archive…</p>
          </div>
        )}

        {error && (
          <div className="aged-card rounded-2xl p-8 mt-6 text-center">
            <p className="text-red-400/80 mb-4">{error}</p>
            <button onClick={generateRound}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light font-medium hover:bg-[rgba(201,145,58,0.08)] transition-colors mx-auto">
              <RotateCcw size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Active question */}
        {questions.length > 0 && !finished && (
          <div className="aged-card rounded-2xl p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-parchment/40">Question {current + 1} of {questions.length}</span>
              <span className="text-xs text-amber-light/70">Score: {score}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[rgba(201,145,58,0.1)] mb-6 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#C9913A] to-[#E8C97A] transition-all" style={{ width: `${((current) / questions.length) * 100}%` }} />
            </div>
            <h2 className="font-display text-xl text-parchment mb-5">{questions[current].question}</h2>
            <div className="space-y-2.5">
              {questions[current].options.map((opt, idx) => {
                const isCorrect = idx === questions[current].correct_index;
                const isChosen = idx === selected;
                let cls = 'border-[rgba(201,145,58,0.15)] text-parchment hover:border-[rgba(201,145,58,0.35)] hover:bg-[rgba(201,145,58,0.04)]';
                if (revealed) {
                  if (isCorrect) cls = 'border-green-700/40 bg-green-900/20 text-green-300';
                  else if (isChosen) cls = 'border-red-800/40 bg-red-900/15 text-red-300';
                  else cls = 'border-[rgba(201,145,58,0.1)] text-parchment/40';
                }
                return (
                  <button key={idx} onClick={() => handleSelect(idx)} disabled={revealed}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${cls} ${!revealed ? 'cursor-pointer' : 'cursor-default'}`}>
                    <span className="text-sm">{opt}</span>
                    {revealed && isCorrect && <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />}
                    {revealed && isChosen && !isCorrect && <XCircle size={18} className="text-red-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            {revealed && (
              <div className="mt-4">
                <p className="text-xs text-amber-light/70 bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.12)] rounded-lg px-3 py-2.5 mb-4">
                  {questions[current].explanation}
                </p>
                <button onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold text-sm hover:opacity-90 transition-opacity">
                  {current + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {finished && (
          <div className="aged-card rounded-2xl p-8 mt-6 text-center">
            <Trophy size={32} className="text-gold mx-auto mb-3" />
            <h2 className="font-display text-3xl text-parchment mb-1">{score} / {questions.length}</h2>
            <p className="text-parchment/50 mb-6">
              {score === questions.length ? 'Perfect — you know this family inside out.' : score >= questions.length / 2 ? 'Nicely done.' : 'A good start — have another go.'}
            </p>
            <button onClick={restart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold text-sm hover:opacity-90 transition-opacity mx-auto">
              <RotateCcw size={16} /> Play Again
            </button>
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-xl text-parchment mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-gold" /> Family Leaderboard
            </h2>
            <div className="space-y-2">
              {leaderboard.map((r, i) => (
                <div key={r.id} className="aged-card rounded-lg p-3 flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-[#C9913A] text-charcoal' : 'bg-[rgba(201,145,58,0.1)] text-amber-light'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-parchment truncate">{r.player_name}</p>
                    <p className="text-xs text-parchment/40">{r.round_label}</p>
                  </div>
                  <span className="text-sm text-amber-light font-medium">{r.score}/{r.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}