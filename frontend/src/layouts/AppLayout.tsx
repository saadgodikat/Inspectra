import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { ChatbotWidget } from '../components/ChatbotWidget';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col selection:bg-primary-container selection:text-on-primary-container">
      <Navbar />
      <Sidebar />
      <div className="pl-64 pt-14 flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full bg-background overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
};
