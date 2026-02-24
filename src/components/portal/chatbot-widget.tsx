"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
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
};

export function ChatbotWidget() {
  const t = useTranslations("chatbot");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Initialize welcome message with translation
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

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Build history from existing messages (exclude welcome)
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }));

      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      const data = await response.json();
      const answer =
        typeof data?.answer === "string" && data.answer.trim().length > 0
          ? data.answer
          : t("cannotAnswer");

      const botMessage: ChatMessage = {
        id: `${Date.now()}-bot`,
        role: "bot",
        content: answer,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "bot",
          content: t("error"),
        },
      ]);
    } finally {
      setLoading(false);
    }
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
                <div
                  key={message.id}
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
              ))}
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
                onClick={sendMessage}
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
