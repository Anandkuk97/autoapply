import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, History, MessageSquare, Minimize2, Target, Sparkles, X } from 'lucide-react';

export type TailoringStrategy = 'skill' | 'experience' | 'tone' | 'concise' | 'keyword';

interface TailoringOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (strategy: TailoringStrategy) => void;
  jobTitle: string;
}

export function TailoringOptionsModal({ isOpen, onClose, onGenerate, jobTitle }: TailoringOptionsModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<TailoringStrategy>('skill');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[var(--color-surface)] border border-[var(--color-outline-variant)]/20 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8"
        >
          {/* Header */}
          <div className="p-6 md:p-8 flex items-start justify-between border-b border-[var(--color-outline-variant)]/10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-[var(--color-primary-container)]/20 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-widest rounded-full">
                  AI Engine Ready
                </span>
                <span className="text-[11px] text-[var(--color-secondary)] font-medium">Target: {jobTitle}</span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tighter text-[var(--color-on-surface)]">
                Tailoring <span className="text-[var(--color-primary)] italic">Options</span>
              </h2>
              <p className="text-[var(--color-secondary)] text-sm mt-2 max-w-md">
                Select your optimization strategy to align your profile with the specific demands of this role.
              </p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[var(--color-surface-container-highest)] flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-on-surface)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Option 1: Skill-focused */}
              <button
                onClick={() => setSelectedStrategy('skill')}
                className={`md:col-span-2 relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 border-2 flex flex-col group ${
                  selectedStrategy === 'skill'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 shadow-[0_10px_30px_rgba(0,109,54,0.1)]'
                    : 'border-transparent bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedStrategy === 'skill' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-container-highest)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]'
                  }`}>
                    <Zap className="w-6 h-6" />
                  </div>
                  {selectedStrategy === 'skill' && (
                    <div className="bg-[var(--color-primary)] px-3 py-1 rounded-full">
                      <span className="text-[10px] font-bold text-[var(--color-on-primary)] uppercase tracking-tight">Active</span>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-bold tracking-tight text-[var(--color-on-surface)] mb-1">Skill-focused</h3>
                <p className={`text-sm leading-relaxed ${selectedStrategy === 'skill' ? 'text-[var(--color-on-surface-variant)]' : 'text-[var(--color-secondary)]'}`}>
                  Highlights your technical competencies and hard skills to pass through dense technical screening filters.
                </p>
              </button>

              {/* Option 2: Experience-focused */}
              <button
                onClick={() => setSelectedStrategy('experience')}
                className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 border-2 flex flex-col group ${
                  selectedStrategy === 'experience'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 shadow-[0_10px_30px_rgba(0,109,54,0.1)]'
                    : 'border-transparent bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedStrategy === 'experience' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-container-highest)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]'
                  }`}>
                    <History className="w-5 h-5" />
                  </div>
                  {selectedStrategy === 'experience' && (
                    <div className="border border-[var(--color-primary)] px-2.5 py-0.5 rounded-full"><span className="text-[9px] font-bold text-[var(--color-primary)] uppercase">Active</span></div>
                  )}
                </div>
                <h3 className="text-lg font-bold tracking-tight text-[var(--color-on-surface)] mb-1">Experience-focused</h3>
                <p className="text-[11px] leading-snug text-[var(--color-secondary)]">Prioritizes career progression and leadership impact.</p>
              </button>

              {/* Option 3: Tone-matched */}
              <button
                onClick={() => setSelectedStrategy('tone')}
                className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 border-2 flex flex-col group ${
                  selectedStrategy === 'tone'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 shadow-[0_10px_30px_rgba(0,109,54,0.1)]'
                    : 'border-transparent bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedStrategy === 'tone' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-container-highest)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]'
                  }`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  {selectedStrategy === 'tone' && (
                    <div className="border border-[var(--color-primary)] px-2.5 py-0.5 rounded-full"><span className="text-[9px] font-bold text-[var(--color-primary)] uppercase">Active</span></div>
                  )}
                </div>
                <h3 className="text-lg font-bold tracking-tight text-[var(--color-on-surface)] mb-1">Tone-matched</h3>
                <p className="text-[11px] leading-snug text-[var(--color-secondary)]">Adapts your language to match the company culture.</p>
              </button>

              {/* Option 4: Concise */}
              <button
                onClick={() => setSelectedStrategy('concise')}
                className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 border-2 flex flex-col group ${
                  selectedStrategy === 'concise'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 shadow-[0_10px_30px_rgba(0,109,54,0.1)]'
                    : 'border-transparent bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedStrategy === 'concise' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-container-highest)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]'
                  }`}>
                    <Minimize2 className="w-5 h-5" />
                  </div>
                  {selectedStrategy === 'concise' && (
                    <div className="border border-[var(--color-primary)] px-2.5 py-0.5 rounded-full"><span className="text-[9px] font-bold text-[var(--color-primary)] uppercase">Active</span></div>
                  )}
                </div>
                <h3 className="text-lg font-bold tracking-tight text-[var(--color-on-surface)] mb-1">Concise</h3>
                <p className="text-[11px] leading-snug text-[var(--color-secondary)]">Aggressive trimming for maximum readability impact.</p>
              </button>

              {/* Option 5: Keyword-optimized */}
              <button
                onClick={() => setSelectedStrategy('keyword')}
                className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 border-2 flex flex-col group ${
                  selectedStrategy === 'keyword'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]/10 shadow-[0_10px_30px_rgba(0,109,54,0.1)]'
                    : 'border-transparent bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)]'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedStrategy === 'keyword' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-container-highest)] text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]'
                  }`}>
                    <Target className="w-5 h-5" />
                  </div>
                  {selectedStrategy === 'keyword' && (
                    <div className="border border-[var(--color-primary)] px-2.5 py-0.5 rounded-full"><span className="text-[9px] font-bold text-[var(--color-primary)] uppercase">Active</span></div>
                  )}
                </div>
                <h3 className="text-lg font-bold tracking-tight text-[var(--color-on-surface)] mb-1">Keyword-optimized</h3>
                <p className="text-[11px] leading-snug text-[var(--color-secondary)]">Hyper-focused on ATS-critical phrases from descriptions.</p>
              </button>

            </div>

            {/* CTA */}
            <div className="mt-8">
              <button 
                onClick={() => onGenerate(selectedStrategy)}
                className="w-full h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)] text-[var(--color-on-primary)] rounded-xl font-bold text-lg shadow-[0_10px_25px_rgba(0,109,54,0.3)] flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 duration-200 transition-all"
              >
                Generate Optimized Version
                <Sparkles className="w-5 h-5" />
              </button>
              <p className="text-center text-xs text-[var(--color-secondary)] mt-4 px-4 md:px-8 leading-relaxed font-medium">
                Our AI model uses advanced natural language processing to restructure your content instantly.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
