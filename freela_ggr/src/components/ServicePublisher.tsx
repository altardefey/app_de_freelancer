import { useEffect, useRef, useState } from "react";
import { Image, type ImageStyle, type StyleProp, Platform, Pressable, Switch, Text, View } from "react-native";
import { toByteArray } from "base64-js";
import * as Crypto from "expo-crypto";
import { pickJpeg } from "./pickJpeg";
import { ServiceChoices } from "./ServiceChoices";
import { loadProfileSettings } from "../data/profileSettings";
import { mutationError } from "../lib/requestErrors";
import { useSubscription } from "../context/SubscriptionContext";
import { useSession } from "../context/SessionContext";
import { findForbiddenService } from "../data/serviceOptions";
import { supabase } from "../lib/supabase";
import { webApi } from "../lib/webApi";
import type { Service } from "../types/app";
import { useAppearance } from "../ui/Appearance";
import { Button, Field, Notice } from "../ui/components";

const bucket = "service-portfolio";

export function PortfolioImage({ path, avatar = false, style, fallback }: { path: string; avatar?: boolean; style?: StyleProp<ImageStyle>; fallback?: React.ReactNode }) {
  const { ui } = useAppearance();
  const [image, setImage] = useState<{ path: string; uri: string }>();
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    let current = true;
    async function load() {
      if (Platform.OS === "web") return "data:image/jpeg;base64," + await webApi<string>("portfolioImage", { path });
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
      if (error) throw error;
      return data.signedUrl;
    }
    void load().then((uri) => { if (current) setImage({ path, uri }); }).catch(() => { if (current) setFailed(path); });
    return () => { current = false; };
  }, [path]);
  if (failed === path) return fallback ?? <Text style={ui.small}>Imagem indisponível.</Text>;
  if (image?.path !== path) return fallback ?? <Text style={ui.small}>{avatar ? "Carregando foto…" : "Carregando portfólio…"}</Text>;
  return <Image source={{ uri: image.uri }} accessibilityLabel={avatar ? "Foto de perfil" : "Exemplo de trabalho do profissional"} style={[avatar ? { width: 80, height: 80, borderRadius: 40 } : { width: "100%", height: 220, borderRadius: 12 }, style]} resizeMode={avatar || style ? "cover" : "contain"} />;
}

export function ServicePublisher({ service, suggestedCategories, onPublished }: { service?: Service; suggestedCategories?: string[]; onPublished?: () => void } = {}) {
  const { usage } = useSubscription();
  const limit = usage?.premium ? 10 : 3;
  const { user, location } = useSession();
  const { colors, ui } = useAppearance();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(service?.title ?? "");
  const [categories, setCategories] = useState<string[]>(service?.category ? [service.category] : []);
  const [description, setDescription] = useState(service?.description ?? "");
  const initiallyNegotiable = !!service?.priceNegotiable || service?.price.trim().toLowerCase() === "a combinar";
  const [negotiable, setNegotiable] = useState(initiallyNegotiable);
  const [price, setPrice] = useState(initiallyNegotiable ? "" : service?.price ?? "");
  const [remote, setRemote] = useState(service?.remote ?? false);
  const [existing, setExisting] = useState(service?.portfolioPaths ?? []);
  const [photos, setPhotos] = useState<{ id: string; data: string }[]>([]);
  const count = existing.length + photos.length;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(false);
  const lock = useRef(false);
  const id = useRef<string | null>(null);
  async function pick() {
    if (lock.current || count >= limit) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const photo = await pickJpeg();
      if (!photo) return;
      setPhotos((items) => [...items, { id: Crypto.randomUUID(), data: photo }]);
    } catch {
      setMessage("Escolha uma imagem menor para o portfólio.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function publish() {
    if (!user || lock.current) return;
    const clean = title.trim();
    if (!categories[0] || findForbiddenService(categories[0])) return setMessage("Escolha uma categoria para o anúncio.");
    const priceText = negotiable ? "A combinar" : price.trim();
    const priceChanged = !service || negotiable !== Boolean(service.priceNegotiable) || priceText !== service.price.trim();
    if (priceChanged && (!priceText || priceText.length > 10)) return setMessage("Informe um valor de até 10 caracteres.");
    if (clean.length < 3 || !description.trim() || findForbiddenService(clean) || findForbiddenService(description)) {
      return setMessage("Informe um título, uma descrição permitida e um preço inicial.");
    }
    if (!service && !remote && (!location.uf || !location.city || !location.neighborhood)) return setMessage("Complete a região da conta para publicar um serviço presencial.");
    if (count > limit) return setMessage("Remova fotos para respeitar o limite do seu plano.");
    lock.current = true;
    setBusy(true);
    setMessage("");
    id.current ??= service?.id ?? Crypto.randomUUID();
    const serviceId = id.current;
    const newPaths = photos.map((photo) => `${user.id}/${serviceId}-${photo.id}.jpg`);
    const paths = [...existing, ...newPaths];
    const payload = { id: serviceId, title: clean, description: description.trim(), price: priceText, fixed_price_cents: null, price_negotiable: negotiable, remote, category: categories[0],  };
    let uploading = false;
    try {
      const profile = service ? null : await loadProfileSettings(user.id);
      if (!service && !profile?.first_name?.trim()) return setMessage("Preencha seu primeiro nome em Conta → Editar perfil antes de publicar.");
      uploading = true;
      for (const [index, photo] of photos.entries()) {
        if (Platform.OS === "web") {
          await webApi("uploadPortfolioPhoto", { id: serviceId, photoId: photo.id, image: photo.data });
        } else {
          const bytes = new Uint8Array(toByteArray(photo.data));
          const { error } = await supabase.storage.from(bucket).upload(newPaths[index], bytes.buffer, { contentType: "image/jpeg" });
          if (error && error.status !== 409 && error.statusCode !== "Duplicate") throw error;
        }
      }
      uploading = false;
      if (Platform.OS === "web") {
        if (service) await webApi("updatePortfolio", { id: serviceId, photos: paths, category: categories[0], title: clean, ...(priceChanged ? { price: priceText, ...(negotiable ? { price_negotiable: true } : {}) } : {}) });
        else await webApi("publishService", { id: serviceId, title: clean, description: payload.description, price: priceText, ...(negotiable ? { price_negotiable: true } : {}), remote, category: categories[0], photos: paths });
      } else if (service) {
        const { error } = await supabase.from("services").update({ portfolio_path: null, portfolio_paths: paths, category: categories[0], title: clean, ...(priceChanged ? { price: priceText, fixed_price_cents: null, price_negotiable: false } : {}) })
          .eq("id", serviceId).eq("provider_id", user.id).select("id").single();
        if (error) throw error;
        const removed = (service.portfolioPaths ?? []).filter((path) => !paths.includes(path));
        if (removed.length) await supabase.storage.from(bucket).remove(removed);
      } else {
        const { error } = await supabase.from("services").insert({
          ...payload, provider_id: user.id, provider: profile!.first_name,
          portfolio_paths: paths, uf: remote ? "" : location.uf, city: remote ? "" : location.city,
          neighborhood: remote ? "" : location.neighborhood,
        });
        if (error?.code === "23505") {
          const { data } = await supabase.from("services").select("id").eq("id", serviceId).eq("provider_id", user.id).maybeSingle();
          if (!data) throw error;
        } else if (error) throw error;
      }
      setOpen(false);
      setPublished(true);
      if (!service) {
        setTitle("");
        setCategories([]);
        setDescription("");
        setPrice("");
        setNegotiable(false);
        setRemote(false);
      }
      setPhotos([]);
      if (service) setExisting(paths);
      onPublished?.();
      id.current = null;
    } catch (failure) {
      const error = failure as { code?: string; status?: number; message?: string };
      if (["42703", "PGRST204", "PGRST202"].includes(error.code ?? "")) {
        setMessage("Aplique as migrações do perfil e dos anúncios no Supabase e tente novamente.");
      } else if (error.code === "PT400" || error.code === "PT429") {
        setMessage(mutationError(error).message);
      } else if (Platform.OS === "web" && error.status === 400 && error.message) {
        setMessage(error.message);
      } else if (uploading) {
        setMessage("Não foi possível enviar as fotos. Confira a conexão ou remova a foto e tente novamente.");
      } else {
        setMessage("Não foi possível salvar o anúncio. Seus campos foram mantidos.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <View style={ui.card}>
    {published && <Text accessibilityLiveRegion="polite" style={ui.body}>{service ? "Portfólio atualizado." : "Serviço publicado no catálogo."}</Text>}
    {open ? <>
      <Text style={ui.heading}>{service ? "Editar anúncio" : "Seu serviço no catálogo"}</Text>
      <ServiceChoices values={categories} onChange={setCategories} extra={suggestedCategories} single disabled={busy} />
      <Field label="Nome do serviço" value={title} onChangeText={setTitle} maxLength={100} editable={!busy} placeholder="Ex.: Edição de vídeo" />
      {!service && <>
      <Field label="Descrição do trabalho" value={description} onChangeText={setDescription} maxLength={1000} editable={!busy} multiline />

      <View style={ui.between}><Text style={ui.label}>Serviço remoto para todo o Brasil</Text>
        <Switch accessibilityLabel="Serviço remoto para todo o Brasil" value={remote} onValueChange={setRemote} disabled={busy} /></View>
      </>}
      {!negotiable && <Field label="Valor do serviço" value={price} onChangeText={setPrice} maxLength={10} editable={!busy} placeholder="Ex.: R$ 150" />}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: negotiable, disabled: busy }}
        disabled={busy} onPress={() => setNegotiable(!negotiable)} style={[ui.row, { minHeight: 44 }]}>
        <Text style={[ui.heading, { color: colors.purple }]}>{negotiable ? "☑" : "☐"}</Text>
        <Text style={ui.label}>A combinar</Text>
      </Pressable>
      <Text style={ui.label}>Portfólio · {count} de {limit} fotos</Text>
      {existing.map((path, index) => <View key={path} style={{ gap: 8 }}>
        <PortfolioImage path={path} />
        <Button title={`Remover foto ${index + 1}`} secondary disabled={busy} onPress={() => setExisting((items) => items.filter((item) => item !== path))} />
      </View>)}
      {photos.map((photo, index) => <View key={photo.id} style={{ gap: 8 }}>
        <Image accessibilityLabel="Prévia do portfólio" source={{ uri: "data:image/jpeg;base64," + photo.data }} style={{ width: "100%", height: 160 }} resizeMode="contain" />
        <Button title={`Remover foto ${existing.length + index + 1}`} secondary disabled={busy} onPress={() => {
          setPhotos((items) => items.filter((_, position) => position !== index));
        }} />
      </View>)}
      <Button title="Adicionar foto do portfólio (opcional)" secondary disabled={busy || count >= limit} onPress={() => void pick()} />
      <Text style={ui.small}>As fotos aparecem no anúncio. Use imagens que você tem autorização para divulgar.</Text>
      {message ? <Notice>{message}</Notice> : null}
      <Button title={service ? "Salvar anúncio" : "Publicar serviço"} busy={busy} onPress={() => void publish()} />
      <Button title="Fechar formulário" secondary disabled={busy} onPress={() => setOpen(false)} />
    </> : <Button title={service ? "Editar anúncio de " + service.title : "Adicionar um serviço"} icon="plus" secondary onPress={() => { setOpen(true); setPublished(false); }} />}
  </View>;
}
