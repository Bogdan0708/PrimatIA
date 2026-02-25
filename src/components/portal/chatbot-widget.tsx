"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Loader2, ThumbsUp, ThumbsDown, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: string[];
  citations?: { article: string; title: string }[];
  feedback?: "up" | "down" | null;
};

const SUGGESTED_QUESTIONS = [
  "deadlines",
  "payOnline",
  "bonificatie",
  "certificate",
  "penalties",
];

export function ChatbotWidget() {
  const t = useTranslations("chatbot");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>(SUGGESTED_QUESTIONS);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        { id: "welcome", role: "bot", content: t("welcome") },
      ]);
    }
  }, [t, messages.length]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const sendMessage = async (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }));

      // Try streaming first
      const useStreaming = typeof ReadableStream !== "undefined";

      if (useStreaming) {
        const streamId = `${Date.now()}-bot`;
        setMessages((prev) => [
          ...prev,
          { id: streamId, role: "bot", content: "" },
        ]);

        const response = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history, stream: true }),
        });

        if (response.ok && response.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullContent += parsed.content;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === streamId ? { ...m, content: fullContent } : m
                      )
                    );
                  }
                } catch {
                  // Skip malformed chunks
                }
              }
            }
          }

          if (!fullContent) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamId ? { ...m, content: t("cannotAnswer") } : m
              )
            );
          }
        } else {
          // Fallback: non-streaming response
          const data = await response.json();
          const answer = typeof data?.answer === "string" && data.answer.trim()
            ? data.answer
            : t("cannotAnswer");

          if (data?.suggestedQuestions) {
            setApiSuggestions(data.suggestedQuestions);
            setShowSuggestions(true);
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? {
                    ...m,
                    content: answer,
                    sources: data?.sources,
                    citations: data?.citations,
                  }
                : m
            )
          );
        }
      } else {
        // No streaming support — standard request
        const response = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history }),
        });

        const data = await response.json();
        const answer = typeof data?.answer === "string" && data.answer.trim()
          ? data.answer
          : t("cannotAnswer");

        if (data?.suggestedQuestions) {
          setApiSuggestions(data.suggestedQuestions);
          setShowSuggestions(true);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-bot`,
            role: "bot",
            content: answer,
            sources: data?.sources,
            citations: data?.citations,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-error`, role: "bot", content: t("error") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const setFeedback = (messageId: string, feedback: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback } : m
      )
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      <div
        className={cn(
          "w-[calc(100vw-2rem)] sm:w-96 transition-all duration-300 origin-bottom-right",
          open
            ? "opacity-100 translate-y-0 scale-100"
            : "pointer-events-none opacity-0 translate-y-4 scale-95"
        )}
      >
        <Card className="flex h-[70vh] max-h-[520px] flex-col overflow-hidden border-portal-primary/20 shadow-xl">
          <div className="flex items-center justify-between border-b bg-portal-primary px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">{t("title")}</p>
              <p className="text-xs text-portal-primary-subtle">{t("subtitle")}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-portal-primary-subtle0"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 bg-slate-50 px-4 py-3">
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id}>
                  <div
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                        message.role === "user"
                          ? "bg-portal-primary text-white"
                          : "bg-white text-slate-800 border"
                      )}
                    >
                      {message.content}
                    </div>
                  </div>

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-1">
                      {message.citations.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-0.5 text-[10px] text-portal-primary bg-portal-primary-subtle rounded px-1.5 py-0.5"
                        >
                          <Scale className="h-2.5 w-2.5" />
                          Art. {c.article}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Feedback buttons for bot messages */}
                  {message.role === "bot" && message.id !== "welcome" && message.content && (
                    <div className="flex gap-1 mt-1 ml-1">
                      <button
                        onClick={() => setFeedback(message.id, "up")}
                        className={cn(
                          "p-0.5 rounded transition-colors",
                          message.feedback === "up"
                            ? "text-portal-primary"
                            : "text-muted-foreground/40 hover:text-muted-foreground"
                        )}
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setFeedback(message.id, "down")}
                        className={cn(
                          "p-0.5 rounded transition-colors",
                          message.feedback === "down"
                            ? "text-destructive"
                            : "text-muted-foreground/40 hover:text-muted-foreground"
                        )}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Suggested questions */}
              {showSuggestions && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {apiSuggestions.map((key) => (
                    <button
                      key={key}
                      onClick={() => sendMessage(t(`suggestions.${key}`))}
                      className="text-xs bg-white border rounded-full px-3 py-1.5 text-muted-foreground hover:text-portal-primary hover:border-portal-primary transition-colors"
                    >
                      {t(`suggestions.${key}`)}
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("processing")}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t bg-white p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t("placeholder")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={loading}
              />
              <Button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || input.trim().length === 0}
                className="bg-portal-primary hover:bg-portal-primary-hover"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {t("poweredBy")}
            </p>
          </div>
        </Card>
      </div>

      <Button
        type="button"
        className={cn(
          "h-12 w-12 rounded-full bg-portal-primary text-white shadow-lg hover:bg-portal-primary-hover",
          open && "hidden"
        )}
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    </div>
  );
}
