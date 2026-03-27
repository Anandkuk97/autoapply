"use client";

import { useState, KeyboardEvent, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TagInputProps {
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
  placeholder: string;
  icon?: React.ReactNode;
}

export function TagInput({ tags, setTags, placeholder, icon }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = useCallback((value: string) => {
    const newTag = value.trim();
    if (!newTag) return;
    // Use functional updater to always get latest state
    setTags(prev => {
      if (prev.includes(newTag)) return prev;
      const updated = [...prev, newTag];
      console.log("[TagInput] Added tag:", newTag, "-> all tags:", updated);
      return updated;
    });
    setInputValue("");
  }, [setTags]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // ALWAYS prevent Enter from submitting the parent form
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  // Auto-commit typed text when user clicks away
  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="w-full bg-black/50 border border-white/10 rounded-xl p-2 flex flex-wrap gap-2 items-center focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition min-h-[52px]">
      {icon && <div className="pl-2 text-[var(--color-primary)]">{icon}</div>}
      <AnimatePresence>
        {tags.map((tag, index) => (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, width: 0, padding: 0 }}
            className="flex items-center gap-1 bg-white/10 text-white px-3 py-1 rounded-full text-sm font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-gray-400 hover:text-red-400 transition hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 bg-transparent border-none outline-none text-white px-2 py-1 min-w-[120px]"
      />
    </div>
  );
}
