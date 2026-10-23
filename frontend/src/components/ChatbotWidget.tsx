import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatbotExperience } from './ChatbotExperience';

export const ChatbotWidget: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      <div className={`${open ? 'block' : 'hidden'} w-[min(420px,calc(100vw-2rem))] shadow-2xl`}>
        <div className="flex justify-end gap-2 mb-2">
          <Link
            to="/chatbot"
            onClick={() => setOpen(false)}
            className="rounded-full px-3 py-1.5 bg-surface-container-high text-label-sm text-on-surface hover:bg-surface-bright border border-surface-container-high"
          >
            Open full chat
          </Link>
        </div>
        <ChatbotExperience />
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close Inspectra Assistant' : 'Open Inspectra Assistant'}
        aria-expanded={open}
        className="w-14 h-14 rounded-full bg-primary text-on-primary shadow-xl flex items-center justify-center hover:brightness-110 transition"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
};
