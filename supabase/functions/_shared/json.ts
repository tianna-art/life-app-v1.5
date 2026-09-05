/** Pull the first JSON object out of a model response and parse it safely. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    // What came back is the only thing that says why. Without it this reads
    // the same whether the answer was empty, prose, or cut off mid-object.
    const seen = trimmed.length === 0 ? '(empty)' : trimmed.slice(0, 200);
    throw new Error(`Model did not return a JSON object. Got: ${seen}`);
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error(
      `Model returned JSON that would not parse. Got: ${candidate.slice(start, start + 200)}`
    );
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
}

export const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export function preflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return null;
}
