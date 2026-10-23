import React from 'react';
import { MessageCircle } from 'lucide-react';
import { ChatbotExperience } from '../components/ChatbotExperience';

export const ChatbotPage: React.FC = () => (
  <div className="w-full min-h-screen p-margin flex flex-col gap-space-md pb-12">
    <div className="flex items-end gap-space-sm">
      <MessageCircle className="w-6 h-6 text-primary mb-1" />
      <div>
        <span className="text-label-sm uppercase tracking-widest font-mono text-primary font-bold">PROJECT DATA ASSISTANT</span>
        <h1 className="font-headline text-headline-lg text-on-surface tracking-tight font-bold">Ask Inspectra</h1>
      </div>
    </div>
    <ChatbotExperience fullPage />
  </div>
);
