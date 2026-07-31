"use client";

import { useState, useRef, useEffect } from "react";
import { Course, Day } from "@/lib/BookwormContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { DAILY_CHAT_LIMIT, type ChatQuota } from "@/lib/useChatQuota";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
}

/**
 * BookPal. Deliberately chrome-free: the book cover, the "BookPal" title and
 * the remaining-messages count all live in the dashboard's top bar, so this
 * component is nothing but the conversation and the composer. That's what lets
 * the messages fill the screen on a phone.
 */
export default function ChatTab({
  course,
  day,
  quota,
}: {
  course: Course;
  day: Day;
  /** Owned by the dashboard so the top-bar counter and the chat agree. */
  quota: ChatQuota;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { remaining, limitReached, consume } = quota;

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

    consume();

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

      {/* Messages Area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#1a1a1a] shadow-[0_0_30px_rgba(0,212,255,0.1)]">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="mb-1.5 bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-2xl font-black text-transparent">
              Meet BookPal
            </h3>
            <p className="mb-5 max-w-md text-center text-sm text-white/50">
              Ask me anything about this book. You have {remaining} messages today.
            </p>

            <div className="grid w-full max-w-xl grid-cols-1 gap-2.5">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="rounded-xl border border-white/10 bg-[#1a1a1a]/50 p-3.5 text-left text-sm transition-all hover:-translate-y-1 hover:border-[#00D4FF]/50 hover:bg-[#1a1a1a]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
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

      {/* Composer — sits flush against the bottom nav. The old pb-20 here was
          left over from when the nav overlapped the content; the nav is a
          sibling now, so that padding was just a dead band above the tabs. */}
      <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a] p-3 z-20">
        {limitReached ? (
          <div className="mx-auto max-w-4xl rounded-xl border border-white/10 bg-[#1a1a1a] px-6 py-3.5 text-center">
            <p className="font-bold text-white">You&apos;ve used all {DAILY_CHAT_LIMIT} messages for today 🌙</p>
            <p className="mt-1 text-sm text-white/50">Your messages refresh tomorrow. Come back to keep learning!</p>
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
              className="h-12 flex-1 rounded-xl border-white/20 bg-[#1a1a1a] text-base focus-visible:ring-[#00D4FF]"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#FF006E] transition-transform hover:scale-105 group"
            >
              <Send className="w-5 h-5 text-white group-hover:-translate-y-1 transition-transform cursor-pointer" />
            </Button>
          </form>
        )}
      </div>

    </div>
  );
}
