"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TagInputProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  placeholder: string;
  icon?: React.ReactNode;
}

export function TagInput({ tags, setTags, placeholder, icon }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
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
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 bg-transparent border-none outline-none text-white px-2 py-1 min-w-[120px]"
      />
    </div>
  );
}
