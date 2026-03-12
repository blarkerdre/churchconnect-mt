import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, User, MessageSquare } from "lucide-react";
import { format } from "date-fns";

function getThreadId(emailA, emailB) {
  return [emailA, emailB].sort().join("|");
}

export default function MessagingPane({ currentUser, allUsers }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", currentUser?.email],
    queryFn: () => base44.entities.Message.list("-created_date", 500),
    refetchInterval: 5000,
    enabled: !!currentUser?.email,
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setDraft("");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Message.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });

  // Get conversations (unique threads involving currentUser)
  const myMessages = messages.filter(
    m => m.from_email === currentUser?.email || m.to_email === currentUser?.email
  );

  const threadMap = {};
  myMessages.forEach(m => {
    const other = m.from_email === currentUser?.email ? { email: m.to_email, name: m.to_name } : { email: m.from_email, name: m.from_name };
    const tid = getThreadId(currentUser.email, other.email);
    if (!threadMap[tid]) threadMap[tid] = { other, messages: [], unread: 0 };
    threadMap[tid].messages.push(m);
    if (!m.read && m.to_email === currentUser.email) threadMap[tid].unread++;
  });

  const threads = Object.values(threadMap).sort((a, b) => {
    const aLast = Math.max(...a.messages.map(m => new Date(m.created_date)));
    const bLast = Math.max(...b.messages.map(m => new Date(m.created_date)));
    return bLast - aLast;
  });

  const threadMessages = selectedUser
    ? myMessages
        .filter(m => m.from_email === selectedUser.email || m.to_email === selectedUser.email)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [];

  // Mark as read when opening thread
  useEffect(() => {
    if (!selectedUser) return;
    threadMessages.filter(m => !m.read && m.to_email === currentUser?.email).forEach(m => markReadMutation.mutate({ id: m.id }));
  }, [selectedUser, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length]);

  const handleSend = () => {
    if (!draft.trim() || !selectedUser) return;
    sendMutation.mutate({
      from_email: currentUser.email,
      from_name: currentUser.full_name || currentUser.email,
      to_email: selectedUser.email,
      to_name: selectedUser.full_name || selectedUser.email,
      body: draft.trim(),
      thread_id: getThreadId(currentUser.email, selectedUser.email),
      read: false,
    });
  };

  const isAdminOrLeader = currentUser?.role === "admin" || currentUser?.role === "unit_leader";

  // Members only see contacts they have an existing conversation with
  // Admins/leaders see all users
  const conversationEmails = new Set(myMessages.map(m =>
    m.from_email === currentUser?.email ? m.to_email : m.from_email
  ));

  const otherUsers = allUsers
    .filter(u => u.email !== currentUser?.email)
    .filter(u => isAdminOrLeader || conversationEmails.has(u.email));

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Sidebar: contacts/threads */}
      <Card className="border-0 shadow-sm w-64 shrink-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {otherUsers.map(u => {
            const tid = getThreadId(currentUser?.email, u.email);
            const thread = threadMap[tid];
            const isSelected = selectedUser?.email === u.email;
            return (
              <button
                key={u.email}
                onClick={() => setSelectedUser(u)}
                className={`w-full text-left px-3 py-3 flex items-center gap-2 border-b border-slate-50 hover:bg-slate-50 transition-colors ${isSelected ? "bg-[#1e3a5f]/5 border-l-2 border-l-[#1e3a5f]" : ""}`}
              >
                <div className="h-8 w-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-[#1e3a5f]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{u.full_name || u.email}</p>
                  {thread?.messages?.length > 0 && (
                    <p className="text-xs text-slate-400 truncate">
                      {thread.messages.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]?.body}
                    </p>
                  )}
                </div>
                {thread?.unread > 0 && (
                  <Badge className="bg-[#1e3a5f] text-white text-xs h-5 w-5 flex items-center justify-center p-0 rounded-full shrink-0">
                    {thread.unread}
                  </Badge>
                )}
              </button>
            );
          })}
          {otherUsers.length === 0 && (
            <p className="text-xs text-slate-400 text-center p-6">No other users registered</p>
          )}
        </div>
      </Card>

      {/* Chat area */}
      <Card className="border-0 shadow-sm flex-1 flex flex-col overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center">
                <User className="h-4 w-4 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{selectedUser.full_name || selectedUser.email}</p>
                <p className="text-xs text-slate-400">{selectedUser.email}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadMessages.map(m => {
                const isMe = m.from_email === currentUser?.email;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${isMe ? "bg-[#1e3a5f] text-white" : "bg-slate-100 text-slate-800"}`}>
                      <p className="leading-relaxed">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-slate-400"}`}>
                        {m.created_date ? format(new Date(m.created_date), "h:mm a, dd MMM") : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {threadMessages.length === 0 && (
                <p className="text-center text-sm text-slate-400 mt-20">No messages yet. Start the conversation!</p>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t border-slate-100 flex gap-2">
              <Textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="resize-none flex-1"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <Button onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#152d4a] self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a person to start messaging</p>
          </div>
        )}
      </Card>
    </div>
  );
}