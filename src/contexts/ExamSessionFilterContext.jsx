import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const ExamSessionFilterContext = createContext(null);

const ALL = "all";
const UNASSIGNED = "unassigned";

const storageKey = (tenantId) => `wofbi_session_filter_${tenantId || "none"}`;

export function ExamSessionFilterProvider({ children }) {
  const { tenantId } = useTenantQuery();
  const [sessionId, setSessionIdState] = useState(ALL);
  const [touched, setTouched] = useState(false);

  const { data: sessions = [] } = useQuery({
    queryKey: ["exam-sessions-filter", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_sessions")
        .select("id, name, status, starts_on, ends_on")
        .eq("tenant_id", tenantId)
        .order("starts_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Restore any previously chosen edition for this tenant.
  useEffect(() => {
    if (!tenantId) return;
    const saved = sessionStorage.getItem(storageKey(tenantId));
    if (saved) {
      setSessionIdState(saved);
      setTouched(true);
    } else {
      setTouched(false);
      setSessionIdState(ALL);
    }
  }, [tenantId]);

  // Default to the open session (or most recent closed one) on first load.
  useEffect(() => {
    if (touched || !sessions.length) return;
    const open = sessions.find((s) => ["open", "active"].includes((s.status || "").toLowerCase()));
    setSessionIdState(open ? open.id : ALL);
  }, [sessions, touched]);

  const setSessionId = (value) => {
    setSessionIdState(value);
    setTouched(true);
    if (tenantId) sessionStorage.setItem(storageKey(tenantId), value);
  };

  const sessionMap = useMemo(
    () => Object.fromEntries(sessions.map((s) => [s.id, s])),
    [sessions]
  );

  const value = useMemo(
    () => ({
      sessionId,
      setSessionId,
      sessions,
      sessionMap,
      isAll: sessionId === ALL,
      isUnassigned: sessionId === UNASSIGNED,
      sessionName:
        sessionId === ALL
          ? "All editions"
          : sessionId === UNASSIGNED
            ? "Unassigned edition"
            : sessionMap[sessionId]?.name || "",
      /** Apply the edition filter to a supabase query builder. */
      applySession: (query, column = "session_id") => {
        if (sessionId === ALL) return query;
        if (sessionId === UNASSIGNED) return query.is(column, null);
        return query.eq(column, sessionId);
      },
    }),
    [sessionId, sessions, sessionMap] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <ExamSessionFilterContext.Provider value={value}>
      {children}
    </ExamSessionFilterContext.Provider>
  );
}

const FALLBACK = {
  sessionId: ALL,
  setSessionId: () => {},
  sessions: [],
  sessionMap: {},
  isAll: true,
  isUnassigned: false,
  sessionName: "All editions",
  applySession: (q) => q,
};

export function useExamSessionFilter() {
  return useContext(ExamSessionFilterContext) || FALLBACK;
}

export const EXAM_SESSION_ALL = ALL;
export const EXAM_SESSION_UNASSIGNED = UNASSIGNED;
