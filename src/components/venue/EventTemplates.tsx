"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type StaffRequirement = {
  role: string;
  quantity: number;
  rate: number;
};

type EventTemplate = {
  id: string;
  name: string;
  eventType: string;
  staffRequirements: StaffRequirement[];
  briefNotes: string;
  estimatedCost: number;
  lastUsed?: string;
  timesUsed: number;
};

const mockTemplates: EventTemplate[] = [
  {
    id: "1",
    name: "Friday Night Standard",
    eventType: "Regular Night",
    staffRequirements: [
      { role: "Door Security", quantity: 4, rate: 18 },
      { role: "Floor Security", quantity: 2, rate: 16 },
    ],
    briefNotes: "Standard Friday setup. Main entrance + smoking area coverage.",
    estimatedCost: 576,
    lastUsed: "2026-01-24",
    timesUsed: 24,
  },
  {
    id: "2",
    name: "VIP Event",
    eventType: "Special Event",
    staffRequirements: [
      { role: "Door Security", quantity: 6, rate: 18 },
      { role: "VIP Security", quantity: 2, rate: 22 },
      { role: "Floor Security", quantity: 4, rate: 16 },
    ],
    briefNotes: "High-profile event. Smart dress code for all staff. VIP area requires experienced personnel only.",
    estimatedCost: 1024,
    lastUsed: "2026-01-18",
    timesUsed: 8,
  },
  {
    id: "3",
    name: "Midweek Quiet",
    eventType: "Regular Night",
    staffRequirements: [
      { role: "Door Security", quantity: 2, rate: 18 },
      { role: "Floor Security", quantity: 1, rate: 16 },
    ],
    briefNotes: "Light coverage for Tuesday/Wednesday.",
    estimatedCost: 232,
    lastUsed: "2026-01-22",
    timesUsed: 45,
  },
];

const roleOptions = [
  "Door Security",
  "Floor Security",
  "VIP Security",
  "Event Security",
  "CCTV Operator",
  "Supervisor",
];

// AI Template Generator
async function generateTemplateWithAI(prompt: string): Promise<Partial<EventTemplate> | null> {
  try {
    const response = await fetch("/api/ai/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    
    if (!response.ok) throw new Error("AI generation failed");
    
    const data = await response.json();
    return data.template;
  } catch (error) {
    console.error("AI template generation error:", error);
    return null;
  }
}

// Fallback AI generation (when no API key)
function generateTemplateFallback(prompt: string): Partial<EventTemplate> {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detect event type and size
  const isLarge = lowerPrompt.includes("large") || lowerPrompt.includes("big") || lowerPrompt.includes("major") || lowerPrompt.includes("1000") || lowerPrompt.includes("500");
  const isMedium = lowerPrompt.includes("medium") || lowerPrompt.includes("regular") || lowerPrompt.includes("standard") || lowerPrompt.includes("200") || lowerPrompt.includes("300");
  const isSmall = lowerPrompt.includes("small") || lowerPrompt.includes("quiet") || lowerPrompt.includes("intimate") || lowerPrompt.includes("50") || lowerPrompt.includes("100");
  
  const isVIP = lowerPrompt.includes("vip") || lowerPrompt.includes("celebrity") || lowerPrompt.includes("high-profile") || lowerPrompt.includes("exclusive");
  const isConcert = lowerPrompt.includes("concert") || lowerPrompt.includes("live music") || lowerPrompt.includes("gig") || lowerPrompt.includes("band");
  const isCorporate = lowerPrompt.includes("corporate") || lowerPrompt.includes("business") || lowerPrompt.includes("conference") || lowerPrompt.includes("meeting");
  const isClub = lowerPrompt.includes("club") || lowerPrompt.includes("nightclub") || lowerPrompt.includes("friday") || lowerPrompt.includes("saturday") || lowerPrompt.includes("weekend");
  const isPrivate = lowerPrompt.includes("private") || lowerPrompt.includes("birthday") || lowerPrompt.includes("wedding") || lowerPrompt.includes("party");
  
  // Generate staff requirements based on event type
  let staffRequirements: StaffRequirement[] = [];
  let eventType = "Regular Night";
  let briefNotes = "";
  let name = "Custom Event";
  
  if (isVIP) {
    eventType = "Special Event";
    name = "VIP Event";
    staffRequirements = isLarge ? [
      { role: "Door Security", quantity: 8, rate: 18 },
      { role: "VIP Security", quantity: 4, rate: 22 },
      { role: "Floor Security", quantity: 6, rate: 16 },
      { role: "Supervisor", quantity: 2, rate: 25 },
    ] : [
      { role: "Door Security", quantity: 4, rate: 18 },
      { role: "VIP Security", quantity: 2, rate: 22 },
      { role: "Floor Security", quantity: 2, rate: 16 },
    ];
    briefNotes = "VIP event - all staff must wear smart attire. VIP area requires experienced personnel only. Discretion is essential. Brief staff on any high-profile guests.";
  } else if (isConcert) {
    eventType = "Concert/Live Music";
    name = "Concert Security";
    staffRequirements = isLarge ? [
      { role: "Door Security", quantity: 6, rate: 18 },
      { role: "Event Security", quantity: 10, rate: 16 },
      { role: "Supervisor", quantity: 2, rate: 25 },
    ] : [
      { role: "Door Security", quantity: 4, rate: 18 },
      { role: "Event Security", quantity: 4, rate: 16 },
    ];
    briefNotes = "Live music event - expect high energy crowd. Position staff near stage barrier. Brief on crowd surge protocols. Ear protection recommended.";
  } else if (isCorporate) {
    eventType = "Corporate Event";
    name = "Corporate Security";
    staffRequirements = isLarge ? [
      { role: "Door Security", quantity: 4, rate: 18 },
      { role: "Floor Security", quantity: 4, rate: 16 },
      { role: "CCTV Operator", quantity: 1, rate: 17 },
    ] : [
      { role: "Door Security", quantity: 2, rate: 18 },
      { role: "Floor Security", quantity: 2, rate: 16 },
    ];
    briefNotes = "Corporate event - professional appearance essential. Suit and tie required. Focus on access control and guest list management.";
  } else if (isPrivate) {
    eventType = "Private Hire";
    name = "Private Event";
    staffRequirements = isLarge ? [
      { role: "Door Security", quantity: 4, rate: 18 },
      { role: "Floor Security", quantity: 3, rate: 16 },
    ] : [
      { role: "Door Security", quantity: 2, rate: 18 },
      { role: "Floor Security", quantity: 1, rate: 16 },
    ];
    briefNotes = "Private event - check guest list at entry. Maintain low-key presence. Be available but not intrusive.";
  } else if (isClub) {
    eventType = "Regular Night";
    name = isLarge ? "Big Weekend Night" : isMedium ? "Standard Club Night" : "Quiet Night";
    staffRequirements = isLarge ? [
      { role: "Door Security", quantity: 6, rate: 18 },
      { role: "Floor Security", quantity: 4, rate: 16 },
      { role: "Supervisor", quantity: 1, rate: 25 },
    ] : isMedium ? [
      { role: "Door Security", quantity: 4, rate: 18 },
      { role: "Floor Security", quantity: 2, rate: 16 },
    ] : [
      { role: "Door Security", quantity: 2, rate: 18 },
      { role: "Floor Security", quantity: 1, rate: 16 },
    ];
    briefNotes = isLarge 
      ? "Busy night expected - maintain queue management. Brief on capacity limits. Regular floor sweeps."
      : "Standard night - focus on entry control and periodic floor checks.";
  } else {
    // Default
    staffRequirements = isMedium || isLarge ? [
      { role: "Door Security", quantity: 4, rate: 18 },
      { role: "Floor Security", quantity: 2, rate: 16 },
    ] : [
      { role: "Door Security", quantity: 2, rate: 18 },
      { role: "Floor Security", quantity: 1, rate: 16 },
    ];
    briefNotes = "Standard security coverage. Focus on entry control and maintaining safe environment.";
  }
  
  return {
    name,
    eventType,
    staffRequirements,
    briefNotes,
  };
}

export function EventTemplates() {
  const [templates, setTemplates] = useState<EventTemplate[]>(mockTemplates);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplate | null>(null);
  
  // AI Generation State
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  
  const [newTemplate, setNewTemplate] = useState<Partial<EventTemplate>>({
    name: "",
    eventType: "Regular Night",
    staffRequirements: [{ role: "Door Security", quantity: 1, rate: 18 }],
    briefNotes: "",
  });

  const calculateCost = (requirements: StaffRequirement[], hours: number = 8) => {
    return requirements.reduce((sum, req) => sum + (req.quantity * req.rate * hours), 0);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setAiGenerating(true);
    
    // Try API first, fall back to local generation
    let generated = await generateTemplateWithAI(aiPrompt);
    
    if (!generated) {
      // Use fallback
      generated = generateTemplateFallback(aiPrompt);
    }
    
    if (generated) {
      setNewTemplate(prev => ({
        ...prev,
        ...generated,
      }));
      setAiGenerated(true);
      setShowAIGenerator(false);
    }
    
    setAiGenerating(false);
  };

  const addStaffRequirement = () => {
    setNewTemplate(prev => ({
      ...prev,
      staffRequirements: [
        ...(prev.staffRequirements || []),
        { role: "Floor Security", quantity: 1, rate: 16 }
      ]
    }));
  };

  const updateStaffRequirement = (index: number, field: keyof StaffRequirement, value: string | number) => {
    setNewTemplate(prev => ({
      ...prev,
      staffRequirements: prev.staffRequirements?.map((req, i) =>
        i === index ? { ...req, [field]: value } : req
      )
    }));
  };

  const removeStaffRequirement = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      staffRequirements: prev.staffRequirements?.filter((_, i) => i !== index)
    }));
  };

  const handleCreateTemplate = () => {
    const template: EventTemplate = {
      id: String(Date.now()),
      name: newTemplate.name || "Untitled Template",
      eventType: newTemplate.eventType || "Regular Night",
      staffRequirements: newTemplate.staffRequirements || [],
      briefNotes: newTemplate.briefNotes || "",
      estimatedCost: calculateCost(newTemplate.staffRequirements || []),
      timesUsed: 0,
    };
    setTemplates(prev => [template, ...prev]);
    setShowCreate(false);
    setNewTemplate({
      name: "",
      eventType: "Regular Night",
      staffRequirements: [{ role: "Door Security", quantity: 1, rate: 18 }],
      briefNotes: "",
    });
  };

  const handleBookFromTemplate = (template: EventTemplate) => {
    // In a real app, this would navigate to booking with pre-filled data
    alert(`Booking created from "${template.name}" template!\n\nIn production, this would open the booking form pre-filled with:\n- ${template.staffRequirements.map(r => `${r.quantity}x ${r.role}`).join('\n- ')}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Event Templates</h2>
          <p className="text-sm text-zinc-400">Save your common setups, book in one click</p>
        </div>
        <motion.button
          onClick={() => setShowCreate(true)}
          className="bg-shield-500 hover:bg-shield-600 text-white px-4 py-2 rounded-xl font-medium transition"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + New Template
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Templates</p>
          <p className="text-2xl font-bold text-white">{templates.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Bookings</p>
          <p className="text-2xl font-bold text-emerald-400">
            {templates.reduce((sum, t) => sum + t.timesUsed, 0)}
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg Cost</p>
          <p className="text-2xl font-bold text-blue-400">
            £{Math.round(templates.reduce((sum, t) => sum + t.estimatedCost, 0) / templates.length)}
          </p>
        </div>
      </div>

      {/* Create Template Form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Create New Template</h3>
            <button
              onClick={() => {
                setShowCreate(false);
                setShowAIGenerator(false);
                setAiGenerated(false);
                setAiPrompt("");
              }}
              className="text-zinc-400 hover:text-white transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* AI Generator Toggle */}
          <div className="mb-6">
            <AnimatePresence mode="wait">
              {!showAIGenerator && !aiGenerated ? (
                <motion.button
                  key="ai-button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAIGenerator(true)}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 transition group"
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-xl">✨</span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-white group-hover:text-purple-300 transition">Generate with AI</p>
                      <p className="text-sm text-zinc-500">Describe your event and let AI create the template</p>
                    </div>
                    <svg className="w-5 h-5 text-purple-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.button>
              ) : showAIGenerator ? (
                <motion.div
                  key="ai-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-sm">✨</span>
                    </div>
                    <h4 className="font-medium text-white">AI Template Generator</h4>
                    <button
                      onClick={() => setShowAIGenerator(false)}
                      className="ml-auto text-zinc-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <p className="text-sm text-zinc-400 mb-3">
                    Describe your event in natural language. Include details like event type, expected attendance, special requirements, etc.
                  </p>
                  
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Large Friday night club event, expecting 500 people, VIP area with celebrities, need extra door staff for busy periods..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition h-24 resize-none mb-3"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {["Friday club night", "VIP event", "Corporate event", "Concert security"].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => setAiPrompt(suggestion)}
                          className="text-xs bg-white/10 text-zinc-400 hover:text-white px-2 py-1 rounded transition"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <motion.button
                      onClick={handleAIGenerate}
                      disabled={!aiPrompt.trim() || aiGenerating}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-zinc-600 disabled:to-zinc-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                      whileHover={{ scale: aiPrompt.trim() ? 1.02 : 1 }}
                      whileTap={{ scale: aiPrompt.trim() ? 0.98 : 1 }}
                    >
                      {aiGenerating ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          ✨ Generate Template
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              ) : aiGenerated ? (
                <motion.div
                  key="ai-success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-400">✓</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-400">AI generated your template!</p>
                    <p className="text-xs text-zinc-500">Review and edit below, then save.</p>
                  </div>
                  <button
                    onClick={() => {
                      setAiGenerated(false);
                      setShowAIGenerator(true);
                    }}
                    className="text-xs text-zinc-400 hover:text-white transition"
                  >
                    Regenerate
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Template Name</label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
                placeholder="e.g. Friday Night Standard"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Event Type</label>
              <select
                value={newTemplate.eventType}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, eventType: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition"
              >
                <option value="Regular Night">Regular Night</option>
                <option value="Special Event">Special Event</option>
                <option value="Private Hire">Private Hire</option>
                <option value="Concert/Live Music">Concert/Live Music</option>
                <option value="Corporate Event">Corporate Event</option>
              </select>
            </div>
          </div>

          {/* Staff Requirements */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-zinc-400">Staff Requirements</label>
              <button
                onClick={addStaffRequirement}
                className="text-sm text-shield-400 hover:text-shield-300 transition"
              >
                + Add Role
              </button>
            </div>
            <div className="space-y-3">
              {newTemplate.staffRequirements?.map((req, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={req.role}
                    onChange={(e) => updateStaffRequirement(index, "role", e.target.value)}
                    className="col-span-5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition"
                  >
                    {roleOptions.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <div className="col-span-3 flex items-center gap-2">
                    <input
                      type="number"
                      value={req.quantity}
                      onChange={(e) => updateStaffRequirement(index, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition text-center"
                      min="1"
                    />
                    <span className="text-zinc-500 text-sm">staff</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="text-zinc-500 text-sm">£</span>
                    <input
                      type="number"
                      value={req.rate}
                      onChange={(e) => updateStaffRequirement(index, "rate", parseInt(e.target.value) || 15)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-shield-500 focus:outline-none transition text-center"
                      min="10"
                    />
                    <span className="text-zinc-500 text-sm">/hr</span>
                  </div>
                  <button
                    onClick={() => removeStaffRequirement(index)}
                    className="col-span-1 text-red-400 hover:text-red-300 transition p-2"
                    disabled={newTemplate.staffRequirements?.length === 1}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right">
              <span className="text-zinc-400">Est. cost (8hr shift): </span>
              <span className="text-xl font-bold text-white">
                £{calculateCost(newTemplate.staffRequirements || [])}
              </span>
            </div>
          </div>

          {/* Brief Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-400 mb-1">Brief Notes</label>
            <textarea
              value={newTemplate.briefNotes}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, briefNotes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-shield-500 focus:outline-none transition h-24 resize-none"
              placeholder="Add notes for security staff (dress code, special requirements, etc.)"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            <motion.button
              onClick={handleCreateTemplate}
              className="bg-shield-500 hover:bg-shield-600 text-white px-6 py-2 rounded-xl font-medium transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Save Template
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Templates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <motion.div
            key={template.id}
            className="glass rounded-xl p-4 hover:border-shield-500/30 transition"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-white">{template.name}</h3>
                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded">
                  {template.eventType}
                </span>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                £{template.estimatedCost}
              </span>
            </div>

            {/* Staff Requirements */}
            <div className="space-y-1 mb-4">
              {template.staffRequirements.map((req, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{req.role}</span>
                  <span className="text-white">{req.quantity}x @ £{req.rate}/hr</span>
                </div>
              ))}
            </div>

            {/* Brief Preview */}
            {template.briefNotes && (
              <p className="text-xs text-zinc-500 mb-4 line-clamp-2">
                {template.briefNotes}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
              <span>Used {template.timesUsed} times</span>
              {template.lastUsed && (
                <span>Last: {new Date(template.lastUsed).toLocaleDateString("en-GB")}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <motion.button
                onClick={() => handleBookFromTemplate(template)}
                className="flex-1 bg-shield-500 hover:bg-shield-600 text-white py-2 rounded-lg text-sm font-medium transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Book Now
              </motion.button>
              <button className="p-2 glass rounded-lg text-zinc-400 hover:text-white transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button className="p-2 glass rounded-lg text-zinc-400 hover:text-white transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
