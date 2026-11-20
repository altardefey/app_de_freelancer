import { useRef, useState } from "react";
import { Image, Linking, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { saveProfileSettings, type ProfileSettings, type PublicProfessionalProfile } from "../data/profileSettings";
import { rateLimitMessage } from "../lib/requestErrors";
import { useAppearance } from "../ui/Appearance";
import { Button, Field, Notice } from "../ui/components";
import { pickJpeg } from "./pickJpeg";
import { ServiceChoices } from "./ServiceChoices";
import { PortfolioImage } from "./ServicePublisher";

export function ProfessionalDetails({ profile }: { profile: PublicProfessionalProfile }) {
  const { ui } = useAppearance();
  function link(title: string, url: string | null) {
    if (!url || !/^https:\/\//i.test(url)) return null;
    return <Button title={title} secondary onPress={() => void Linking.openURL(url).catch(() => {})} />;
  }
  return <View style={{ gap: 12 }}>
    {profile.bio && <Text style={ui.body}>{profile.bio}</Text>}
    {!!profile.services?.length && <Text style={ui.label}>{profile.services.join(" · ")}</Text>}
    {link("Instagram profissional", profile.instagram_url)}
    {link("Site do serviço", profile.website_url)}
    {link("WhatsApp Business", profile.whatsapp_business ? "https://wa.me/55" + profile.whatsapp_business : null)}
  </View>;
}

export function ProfileSettingsForm({ userId, professional, initial, onSave, onClose }: {
  userId: string;
  professional: boolean;
  initial: ProfileSettings;
  onSave: (profile: ProfileSettings) => void;
  onClose: () => void;
}) {
  const { ui } = useAppearance();
  const [draft, setDraft] = useState({ ...initial, services: initial.services ?? [] });
  const [photo, setPhoto] = useState<{ id: string; data: string }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function pick() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const image = await pickJpeg();
      if (image) setPhoto({ id: Crypto.randomUUID(), data: image });
    } catch {
      setError("Não foi possível preparar a foto. Escolha outra imagem.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      onSave(await saveProfileSettings(userId, draft, photo));
    } catch (failure) {
      const request = failure && typeof failure === "object"
        ? failure as { code?: string; status?: number; message?: string; details?: string }
        : {};
      const limited = rateLimitMessage(request);
      if (limited) {
        setError(limited);
      } else if (request.code && /^[A-Z0-9]{5,8}$/.test(request.code)) {
        setError("Não foi possível salvar o perfil. Código: " + request.code + ".");
      } else {
        setError(failure instanceof Error ? failure.message : "Não foi possível salvar o perfil. Tente novamente.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <View style={ui.card}>
    <Text style={ui.heading}>{professional ? "Editar perfil profissional" : "Editar serviços de interesse"}</Text>
    <Field label="Primeiro nome" value={draft.first_name ?? ""} onChangeText={(first_name) => setDraft((value) => ({ ...value, first_name }))} maxLength={60} editable={!busy} />
    <Text style={ui.small}>{professional ? "A foto aparece nos seus anúncios." : "A foto é visível na sua Conta."}</Text>
      {photo ? <Image accessibilityLabel="Prévia da foto de perfil" source={{ uri: "data:image/jpeg;base64," + photo.data }} style={{ width: 80, height: 80, borderRadius: 40 }} /> :
        draft.avatar_path && <PortfolioImage path={draft.avatar_path} avatar />}
      <Button title="Escolher foto de perfil" secondary disabled={busy} onPress={() => void pick()} />
      {(photo || draft.avatar_path) && <Button title="Remover foto" secondary disabled={busy} onPress={() => {
        setPhoto(undefined);
        setDraft((value) => ({ ...value, avatar_path: null }));
      }} />}
    {professional && <>
      <Text style={ui.small}>Bio, links e número comercial são opcionais e aparecem nos seus anúncios.</Text>
      <Field label="Bio" value={draft.bio ?? ""} onChangeText={(bio) => setDraft((value) => ({ ...value, bio }))} maxLength={500} multiline editable={!busy} />
      <Field label="Instagram profissional" value={draft.instagram_url ?? ""} onChangeText={(instagram_url) => setDraft((value) => ({ ...value, instagram_url }))} maxLength={300} autoCapitalize="none" keyboardType="url" editable={!busy} placeholder="instagram.com/seuperfil" />
      <Field label="Site do serviço" value={draft.website_url ?? ""} onChangeText={(website_url) => setDraft((value) => ({ ...value, website_url }))} maxLength={300} autoCapitalize="none" keyboardType="url" editable={!busy} placeholder="seusite.com.br" />
      <Field label="WhatsApp Business" value={draft.whatsapp_business ?? ""} onChangeText={(whatsapp_business) => setDraft((value) => ({ ...value, whatsapp_business }))} maxLength={24} keyboardType="phone-pad" editable={!busy} placeholder="(11) 99999-9999" />
      <Text style={ui.small}>Use o número comercial com DDD. O número do cadastro continua separado.</Text>
    </>}
    <Text style={ui.label}>{professional ? "Serviços que você oferece" : "Serviços que você procura"}</Text>
    <ServiceChoices values={draft.services} onChange={(services) => setDraft((value) => ({ ...value, services }))} disabled={busy} />
    {error ? <Notice>{error}</Notice> : null}
    <Button title="Salvar alterações" busy={busy} onPress={() => void save()} />
    <Button title="Cancelar" secondary disabled={busy} onPress={onClose} />
  </View>;
}
