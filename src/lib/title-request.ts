// Retry only after showing the server's current similarity matches.
export async function titleRequest(url: string, method: string, body: Record<string, unknown>): Promise<Response> {
  const send = (payload: Record<string, unknown>) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const response = await send(body);
  if (response.status !== 409) return response;
  const data = await response.clone().json();
  if (data.requiresConfirmation && window.confirm(`Similar titles:\n${data.duplicates.map((d: { text: string }) => d.text).join('\n')}\n\nContinue anyway?`)) return send({ ...body, confirmDuplicate: true });
  return response;
}
