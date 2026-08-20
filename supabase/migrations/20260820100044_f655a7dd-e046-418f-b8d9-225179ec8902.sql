REVOKE ALL ON FUNCTION public.ensure_trivia_quizzes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_trivia_quiz_safe(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_trivia_attempt(uuid, uuid, jsonb, integer, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_trivia_leaderboard(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_trivia_quizzes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trivia_quiz_safe(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_trivia_attempt(uuid, uuid, jsonb, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trivia_leaderboard(uuid, text, text, integer) TO authenticated;