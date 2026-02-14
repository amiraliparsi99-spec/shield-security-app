"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ShieldAI, ShieldAIButton } from "./ShieldAI";

interface AIContextType {
  isOpen: boolean;
  openAI: () => void;
  closeAI: () => void;
  toggleAI: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
}

interface AIProviderProps {
  children: ReactNode;
  userRole?: "venue" | "personnel" | "agency";
  userName?: string;
  showButton?: boolean;
}

export function AIProvider({ 
  children, 
  userRole, 
  userName, 
  showButton = true 
}: AIProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openAI = () => setIsOpen(true);
  const closeAI = () => setIsOpen(false);
  const toggleAI = () => setIsOpen((prev) => !prev);

  return (
    <AIContext.Provider value={{ isOpen, openAI, closeAI, toggleAI }}>
      {children}
      
      {showButton && !isOpen && (
        <ShieldAIButton onClick={openAI} />
      )}
      
      <ShieldAI
        isOpen={isOpen}
        onClose={closeAI}
        userRole={userRole}
        userName={userName}
      />
    </AIContext.Provider>
  );
}
