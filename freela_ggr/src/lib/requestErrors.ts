type RequestError = { code?: string; status?: number; message?: string; details?: string };

export function rateLimitMessage(error: RequestError): string | null {
  if (error.code !== "PT429" && error.status !== 429 &&
      error.code !== "over_request_rate_limit" &&
      !["over_email_send_rate_limit", "over_sms_send_rate_limit"].includes(error.code ?? "") &&
      !/rate.?limit|too many requests/i.test(error.message ?? "")) return null;
  try {
    const seconds = JSON.parse(error.details ?? "{}").retry_after_seconds;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return `Você atingiu o limite temporário. Aguarde ${Math.ceil(seconds)} segundos e tente novamente.`;
    }
  } catch { /* o auth pode mandar os detalhes fora do formato json */ }
  return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
}

export function mutationError(error: RequestError): Error {
  if (error.code === "PT402") return new Error("Você usou os 10 orçamentos deste mês. Aguarde a renovação da franquia.");
  if ((error.code === "PT400" || error.code === "PT409") && error.message) return new Error(error.message);
  return new Error(rateLimitMessage(error) ?? "Não foi possível salvar. Tente novamente em instantes.");
}
