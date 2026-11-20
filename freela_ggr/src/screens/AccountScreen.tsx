import { useEffect, useRef, useState } from "react";
import { Pressable, type ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { ProfessionalDetails, ProfileSettingsForm } from "../components/ProfileSettingsForm";
import { loadProfileSettings, type ProfileSettings } from "../data/profileSettings";
import { SubscriptionCancellation } from "../components/SubscriptionCancellation";
import { AccountCredentialEditor } from "../components/AccountCredentialEditor";
import { LegalConsent } from "../components/LegalConsent";
import { PortfolioImage } from "../components/ServicePublisher";
import { useSession } from "../context/SessionContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useAppearance } from "../ui/Appearance";
import { Button, Notice, Page } from "../ui/components";
import { Shell } from "../ui/Shell";

export function AccountScreen() {
  const { user, role, location, logout } = useSession();
  const { usage } = useSubscription();
  const { colors, ui } = useAppearance();
  const scroll = useRef<ScrollView>(null);
  const scrollToEditor = useRef(false);
  const reduceMotion = useReducedMotion();
  const professional = role === "profissional";
  const [profile, setProfile] = useState<ProfileSettings>();
  const [profileError, setProfileError] = useState("");
  const [editing, setEditing] = useState(false);
  const [credential, setCredential] = useState<"email" | "password" | "phone" | null>(null);
  const [documents, setDocuments] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  async function editProfile() {
    if (!user?.id) return;
    setProfileError("");
    try {
      setProfile(await loadProfileSettings(user.id));
      scrollToEditor.current = true;
      setEditing(true);
    } catch (failure) {
      const code = (failure as { code?: string })?.code;
      setProfileError(code === "42703" || code === "PGRST204" ? "O banco ainda precisa da atualização de perfil. Aplique profile-settings.sql e depois order-quotes.sql no Supabase." : "Não foi possível carregar suas configurações. Tente novamente.");
    }
  }

  useEffect(() => {
    if (!user?.id || !role) return;
    let active = true;
    void loadProfileSettings(user.id).then((value) => { if (active) setProfile(value); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, role]);

  const region = [location.neighborhood, location.city, location.uf].filter(Boolean).join(", ");

  const email = user?.email ?? "";
  const maskedEmail = email.replace(/^(.{2})[^@]*(@.*)$/, "$1•••$2");
  const phone = profile?.whatsapp;
  const maskedPhone = phone ? "(" + phone.slice(0, 2) + ") •••••-" + phone.slice(-4) : "Não informado";

  return <Shell><Page scrollRef={scroll}>
    <View style={ui.card}>
      <View style={ui.row}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lavender, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          {profile?.avatar_path ? (
            <PortfolioImage path={profile.avatar_path} avatar style={{ width: 64, height: 64 }}
              fallback={<Feather name="user" size={27} color={colors.purple} />} />
          ) : <Feather name="user" size={27} color={colors.purple} />}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={ui.title}>{profile?.first_name || "Minha conta"}</Text>
          <Text style={ui.body}>{professional ? "Perfil profissional" : "Perfil de cliente"}</Text>
        </View>
      </View>
      {professional && usage?.premium && <View style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.green }}>
        <Text style={[ui.label, { color: "#1F1633" }]}>Freela+</Text>
      </View>}
      <Button title={professional ? "Editar perfil profissional" : "Editar perfil e interesses"} icon="edit-2" secondary disabled={editing} onPress={() => void editProfile()} />
      {profileError && <Notice>{profileError}</Notice>}
    </View>
    {editing && profile && user && (
      <View onLayout={({ nativeEvent }) => {
        if (!scrollToEditor.current) return;
        scrollToEditor.current = false;
        scroll.current?.scrollTo({ y: Math.max(0, nativeEvent.layout.y - 16), animated: !reduceMotion });
      }}>
        <ProfileSettingsForm userId={user.id} professional={professional} initial={profile}
          onSave={(value) => { setProfile(value); setEditing(false); }} onClose={() => setEditing(false)} />
      </View>
    )}
    <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.heading}>Dados pessoais</Text>
      <PersonalRow label="Nome" value={profile?.first_name || "Não informado"} edit={editing ? undefined : () => void editProfile()} />
      <PersonalRow label="E-mail" value={maskedEmail || "Não informado"} edit={email ? () => setCredential("email") : undefined} />
      <PersonalRow label="Senha" value="••••••••" edit={email ? () => setCredential("password") : undefined} />
      <PersonalRow label="Nascimento" value={profile?.birth_date?.split("-").reverse().join("/") || "Não informado"} />
      <PersonalRow label="Telefone" value={maskedPhone} edit={() => setCredential("phone")} />
      {region ? <>
        <View style={ui.divider} />
        <View style={{ gap: 4 }}>
          <Text style={ui.label}>Região</Text>
          <Text style={ui.body}>{region}</Text>
        </View>
      </> : null}
      {!professional && !!profile?.services?.length && <>
        <View style={ui.divider} />
        <View style={{ gap: 4 }}>
          <Text style={ui.label}>Serviços de interesse</Text>
          <Text style={ui.body}>{profile.services.join(" · ")}</Text>
        </View>
      </>}
    </View>
    {professional && profile && (profile.bio || profile.services?.length || profile.instagram_url || profile.website_url || profile.whatsapp_business) ? (
      <View style={ui.card}>
        <Text accessibilityRole="header" style={ui.heading}>Sobre o profissional</Text>
        <ProfessionalDetails profile={profile} />
      </View>
    ) : null}
    <View style={ui.card}>
      <Text style={ui.heading}>Configurações</Text>
      {professional && <Button title={usage?.premium ? "Gerenciar Freela+" : "Conhecer o Freela+"} secondary onPress={() => router.push("/freela-plus")} />}
      {professional && usage?.premium && user && <SubscriptionCancellation userId={user.id} />}
      <Pressable accessibilityRole="button" aria-expanded={documents} onPress={() => setDocuments(!documents)} style={[ui.row, { minHeight: 44 }]}>
        <Feather name="shield" size={18} color={colors.muted} />
        <Text style={[ui.label, { flex: 1 }]}>Termos e privacidade</Text>
        <Feather name={documents ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {documents && <LegalConsent />}
      <View style={ui.divider} />
      <Button title="Sair da conta" icon="log-out" secondary busy={signingOut} onPress={async () => {
        setSigningOut(true);
        setError("");
        try {
          await logout();
          router.replace("/");
        } catch {
          setError("Não foi possível sair. Tente novamente.");
        } finally {
          setSigningOut(false);
        }
      }} />
      {error ? <Notice>{error}</Notice> : null}
    </View>
    {credential && user && <AccountCredentialEditor field={credential} email={email} userId={user.id}
      close={() => setCredential(null)}
      onPhoneSaved={(whatsapp) => setProfile((current) => current ? { ...current, whatsapp } : current)} />}
  </Page></Shell>;
}

function PersonalRow({ label, value, edit }: { label: string; value: string; edit?: () => void }) {
  const { colors, ui } = useAppearance();
  return <View style={[ui.row, { minHeight: 44, borderTopWidth: 1, borderTopColor: colors.line }]}>
    <Text style={[ui.label, { width: 94 }]}>{label}</Text>
    <Text style={[ui.body, { flex: 1 }]}>{value}</Text>
    {edit && <Pressable accessibilityRole="button" accessibilityLabel={"Editar " + label.toLowerCase()} onPress={edit}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <Feather name="edit-2" size={18} color={colors.purple} />
    </Pressable>}
  </View>;
}
