import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, User, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function MessagingPane({ currentUser, allUsers }) {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
    enabled: !!user?.id,
  });

  const sendMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from("messages").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setDraft("");
    },
  });

  // Group messages by other user
  const threadMap = {};
  messages.forEach(m => {
    const otherId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
    if (!otherId) return;
    if (!threadMap[otherId]) threadMap[otherId] = { messages: [], unread: 0 };
    threadMap[otherId].messages.push(m);
    if (!m.is_read && m.recipient_id === user?.id) threadMap[otherId].unread++;
  });

  const threads = Object.entries(threadMap).sort(([, a], [, b]) => {
    const aLast = Math.max(...a.messages.map(m => new Date(m.created_at)));
    const bLast = Math.max(...b.messages.map(m => new Date(m.created_at)));
    return bLast - aLast;
  });

  const threadMessages = selectedUser
    ? messages
        .filter(m => m.sender_id === selectedUser.user_id || m.recipient_id === selectedUser.user_id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length]);

  const handleSend = () => {
    if (!draft.trim() || !selectedUser) return;
    sendMutation.mutate({
      sender_id: user.id,
      recipient_id: selectedUser.user_id,
      content: draft.trim(),
      subject: null,
    });
  };

  // Filter users who have conversations or all for admins
  const conversationUserIds = new Set(Object.keys(threadMap));
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "unit_leader";

  const otherUsers = allUsers
    .filter(u => u.user_id !== user?.id)
    .filter(u => isAdmin || conversationUserIds.has(u.user_id));

  return (
    <div className="flex gap-4 h-[600px]">
      <Card className="border-0 shadow-sm w-64 shrink-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {otherUsers.map(u => {
            const thread = threadMap[u.user_id];
            const isSelected = selectedUser?.user_id === u.user_id;
            return (
              <button
                key={u.user_id}
                onClick={() => setSelectedUser(u)}
                className={`w-full text-left px-3 py-3 flex items-center gap-2 border-b border-border/50 hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.full_name || u.email}</p>
                </div>
                {thread?.unread > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-xs h-5 w-5 flex items-center justify-center p-0 rounded-full shrink-0">
                    {thread.unread}
                  </Badge>
                )}
              </button>
            );
          })}
          {otherUsers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center p-6">No other users registered</p>
          )}
        </div>
      </Card>

      <Card className="border-0 shadow-sm flex-1 flex flex-col overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{selectedUser.full_name || selectedUser.email}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadMessages.map(m => {
                const isMe = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <p className="leading-relaxed">{m.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {m.created_at ? format(new Date(m.created_at), "h:mm a, dd MMM") : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {threadMessages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-20">No messages yet. Start the conversation!</p>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <Textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="resize-none flex-1"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <Button onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending} className="self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a person to start messaging</p>
          </div>
        )}
      </Card>
    </div>
  );
}
