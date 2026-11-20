import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ServicePublisher } from "../components/ServicePublisher";
import { useSession } from "../context/SessionContext";
import { loadProfileSettings } from "../data/profileSettings";
import { listServices } from "../data/remote";
import type { Service } from "../types/app";
import { useAppearance } from "../ui/Appearance";
import { Button, Notice, Page } from "../ui/components";
import { Shell } from "../ui/Shell";

export function MyListingsScreen() {
  const { user, role } = useSession();
  const { colors, ui } = useAppearance();
  const userId = user?.id;
  const professional = role === "profissional";
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setServices(await listServices(true));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId || !professional) return;
    let active = true;
    setCategories(undefined);
    void loadProfileSettings(userId).then((profile) => {
      if (active) setCategories(profile.services ?? undefined);
    }).catch(() => {});
    return () => { active = false; };
  }, [userId, professional]);

  useEffect(() => {
    if (userId && professional) void load();
  }, [userId, professional, load]);

  return <Shell><Page>
    <Text style={ui.title}>Meus anúncios</Text>
    {professional ? <>
      <ServicePublisher suggestedCategories={categories} onPublished={() => void load()} />
      {loading ? <ActivityIndicator color={colors.purple} accessibilityLabel="Carregando anúncios" /> : null}
      {loadError ? <>
        <Notice>Não foi possível carregar seus anúncios.</Notice>
        <Button title="Tentar novamente" secondary onPress={() => void load()} />
      </> : null}
      {services.map((service) => <View key={service.id} style={{ gap: 5, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line }}>
        <Text style={ui.label}>{service.title}</Text>
        {service.unavailable && <Text style={ui.small}>Indisponível no momento. Volta a aceitar pedidos no próximo mês.</Text>}
        <Text style={ui.body}>{service.remote ? "Remoto" : "Presencial"} · {service.price} · {service.portfolioPaths?.length ?? 0} fotos</Text>
        <ServicePublisher service={service} suggestedCategories={categories} onPublished={() => void load()} />
      </View>)}
    </> : <Notice>Somente profissionais podem gerenciar anúncios.</Notice>}
  </Page></Shell>;
}
