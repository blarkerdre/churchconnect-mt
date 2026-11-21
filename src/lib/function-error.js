// Pull the server's own error message out of a failed functions.invoke call.
export async function functionErrorMessage(error, fallback = "Something went wrong") {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return String(body.error);
  } catch { /* ignore */ }
  return error?.message || fallback;
}
