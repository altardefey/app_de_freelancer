import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSession } from "../context/SessionContext";
import { listCompletedJobs, listProfessionalReviews, updateJobRating } from "../data/remote";
import type { CompletedJob } from "../types/app";
import { useAppearance } from "../ui/Appearance";
import { Button, Empty, Notice, Page } from "../ui/components";
import { Shell } from "../ui/Shell";

export function ServiceHistoryScreen() {
  const { user, role } = useSession();
  const { colors, ui } = useAppearance();
  const professional = role === "profissional";
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [ratingId, setRatingId] = useState<string | null>(null);
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setJobs(await (professional ? listProfessionalReviews() : listCompletedJobs()));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [professional]);

  useEffect(() => {
    if (user?.id && role) void load();
  }, [load, user?.id, role]);

  async function rate(id: string, rating: number) {
    if (lock.current) return;
    lock.current = true;
    setRatingId(id);
    setError("");
    try {
      await updateJobRating(id, rating);
      setJobs((items) => items.map((job) => job.id === id ? { ...job, rating } : job));
    } catch {
      setError("Não foi possível salvar sua avaliação. Tente novamente.");
    } finally {
      lock.current = false;
      setRatingId(null);
    }
  }

  const pending = jobs.filter((job) => job.rating == null);
  const reviewed = jobs.filter((job) => job.rating != null);
  function jobRow(job: CompletedJob) {
    return <View key={job.id} style={{ gap: 5, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line }}>
      <Text style={ui.label}>{job.title}</Text>
      {!professional && <Text style={ui.body}>{job.provider}</Text>}
      {job.date ? <Text style={ui.small}>{job.date}</Text> : null}
      {professional ? (job.rating != null && <Text style={ui.label}>{job.rating} de 5 estrelas</Text>) :
        <View style={[ui.row, { gap: 2 }]} accessibilityLabel={job.rating == null ? "Avaliação pendente" : `Sua avaliação: ${job.rating} de 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} accessibilityRole="button" accessibilityLabel={`Avaliar ${job.title} com ${star} ${star === 1 ? "estrela" : "estrelas"}`}
              disabled={ratingId !== null} onPress={() => void rate(job.id, star)}
              style={{ minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
              <Feather name="star" size={22} color={star <= (job.rating ?? 0) ? colors.purple : colors.muted} />
              <Text style={[ui.small, { color: star <= (job.rating ?? 0) ? colors.purple : colors.muted }]}>{star}</Text>
            </Pressable>
          ))}
        </View>}
    </View>;
  }

  return <Shell><Page>
    <Text style={ui.heading}>Serviços concluídos</Text>
    {loading ? <ActivityIndicator color={colors.purple} accessibilityLabel="Carregando serviços concluídos" /> : loadError ?
      <><Notice>Não foi possível carregar seu histórico.</Notice><Button title="Tentar novamente" secondary onPress={() => void load()} /></> :
      !jobs.length ? <Empty icon="check-circle" title="Nenhum serviço concluído" text={professional ? "O histórico aparece aqui quando você conclui um pedido." : "Quando um serviço for concluído, você poderá avaliá-lo aqui."} /> :
      <>
        <View style={ui.card}>
          <Text style={ui.heading}>{professional ? "Aguardando avaliação" : "Para avaliar"} · {pending.length}</Text>
          {pending.length ? pending.map(jobRow) : <Text style={ui.body}>Nenhuma avaliação pendente.</Text>}
        </View>
        <View style={ui.card}>
          <Text style={ui.heading}>{professional ? "Avaliações recebidas" : "Já avaliados"} · {reviewed.length}</Text>
          {reviewed.length ? reviewed.map(jobRow) : <Text style={ui.body}>Nenhum serviço avaliado ainda.</Text>}
        </View>
      </>}
    {error ? <Notice>{error}</Notice> : null}
  </Page></Shell>;
}
