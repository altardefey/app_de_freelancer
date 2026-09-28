export type ApiError = { message: string; code?: string; status?: number; details?: string };
export async function webApi<T>(action: string, payload: unknown = {}): Promise<T> {
  const response = await fetch("/api/gateway", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error?.message ?? "Não foi possível concluir a operação."), result.error);
  return result.data as T;
}
