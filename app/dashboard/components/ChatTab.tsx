"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Course, Day } from "@/lib/BookwormContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
}

// Each user can send 10 messages to BookPal per day, per course.
const DAILY_CHAT_LIMIT = 10;

// localStorage key scoped to this course AND today's date, so the count
// resets automatically when a new day starts.
function dailyKey(courseId: string) {
  const d = new Date();
  const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  return `bookpal_chat_${courseId}_${day}`;
}

export default function ChatTab({ course, day }: { course: Course; day: Day }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [usedToday, setUsedToday] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const remaining = Math.max(0, DAILY_CHAT_LIMIT - usedToday);
  const limitReached = remaining <= 0;

  // Load today's used count once the component mounts (and when course changes).
  useEffect(() => {
    const stored = localStorage.getItem(dailyKey(course.id));
    setUsedToday(stored ? parseInt(stored, 10) || 0 : 0);
  }, [course.id]);

  // Use this day's AI-written starter questions when available; otherwise a
  // sensible generic set (e.g. before the day's lesson has been generated).
  const suggestedPrompts =
    day.chatSeed && day.chatSeed.length > 0
      ? day.chatSeed
      : [
          "What is the core message of this book?",
          "Explain the most important principle.",
          "How can I apply this book to my life?",
        ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    if (limitReached) return;

    // Count this message against today's allowance and persist it.
    const newUsed = usedToday + 1;
    setUsedToday(newUsed);
    localStorage.setItem(dailyKey(course.id), String(newUsed));

    const newUserMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, newUserMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.book.title,
          author: course.book.author,
          message: text,
          lesson: day.lesson,
          dayTitle: day.title,
          dayNumber: day.dayNumber
        })
      });
      const data = await res.json();
      
      if (res.ok && data.reply) {
        const aiMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          role: "ai", 
          content: data.reply
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || "Failed to fetch response");
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", content: "My connection to Bookworm APIs is currently unavailable. Please verify your Gemini API Key." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto overflow-hidden animate-in fade-in duration-500">
      
      {/* Chat Header */}
      <div className="shrink-0 p-4 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur flex items-center gap-4 z-10">
        <div className="w-10 h-14 relative rounded overflow-hidden shadow shrink-0">
          <Image src={course.book.coverUrl} alt="Cover" fill className="object-cover" loading="lazy" unoptimized />
        </div>
        <div className="min-w-0">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-transparent leading-none">
            BookPal
          </h2>
          <p className="text-xs text-white/50 truncate">Your AI companion for {course.book.title}</p>
        </div>
        {/* Daily message countdown */}
        <div className="ml-auto shrink-0 text-right">
          <div className={`text-2xl font-black tabular-nums ${limitReached ? "text-white/30" : "text-[#00D4FF]"}`}>
            {remaining}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/40 leading-tight">
            left today
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center pt-8 pb-32">
            <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
              <span className="text-4xl">🤖</span>
            </div>
            <h3 className="text-4xl md:text-5xl font-black mb-2 bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-transparent">
              Meet BookPal
            </h3>
            <p className="text-white/50 text-center max-w-md mb-8">
              Your AI companion, trained on the complete text and concepts of the book. Ask me anything — you have {remaining} messages today.
            </p>
            
            <div className="grid grid-cols-1 gap-3 w-full max-w-xl px-4">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="bg-[#1a1a1a]/50 hover:bg-[#1a1a1a] border border-white/10 hover:border-[#00D4FF]/50 text-sm text-left p-4 rounded-xl transition-all hover:-translate-y-1"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-24">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-[85%] md:max-w-[70%] rounded-2xl p-4
                  ${msg.role === 'user' 
                    ? 'bg-gradient-to-br from-[#00D4FF] to-[#0096ff] text-white rounded-br-sm shadow-md' 
                    : 'bg-[#1a1a1a] border border-white/10 text-white/90 rounded-bl-sm'}
                `}>
                  {msg.role === 'ai' && <div className="text-xs text-[#FF006E] font-bold mb-2 uppercase tracking-wider">BookPal</div>}
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex w-full justify-start">
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl rounded-bl-sm p-4 flex items-center gap-2">
                   <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                   <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                   <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 p-4 bg-[#0a0a0a] border-t border-white/10 z-20 pb-20 md:pb-6">
        {limitReached ? (
          <div className="max-w-4xl mx-auto rounded-xl border border-white/10 bg-[#1a1a1a] px-6 py-4 text-center">
            <p className="font-bold text-white">You've used all {DAILY_CHAT_LIMIT} messages for today 🌙</p>
            <p className="text-sm text-white/50 mt-1">Your messages refresh tomorrow. Come back to keep learning!</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex gap-2 max-w-4xl mx-auto"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask BookPal anything... (${remaining} left today)`}
              className="flex-1 bg-[#1a1a1a] border-white/20 h-14 rounded-xl text-lg focus-visible:ring-[#00D4FF]"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="h-14 w-14 rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#FF006E] flex items-center justify-center group transition-transform hover:scale-105"
            >
              <Send className="w-6 h-6 text-white group-hover:-translate-y-1 transition-transform cursor-pointer" />
            </Button>
          </form>
        )}
      </div>

    </div>
  );
}
