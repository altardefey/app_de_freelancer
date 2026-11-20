import { Platform } from "react-native";
import { toByteArray } from "base64-js";
import { supabase } from "../lib/supabase";
import { webApi } from "../lib/webApi";
import { profileSettings, uuid } from "../security/validation";
import { findForbiddenService } from "./serviceOptions";

export type ProfileSettings = ReturnType<typeof profileSettings> & { birth_date?: string | null };
export type PublicProfessionalProfile = Omit<ProfileSettings, "first_name" | "whatsapp" | "birth_date">;
const columns = "services,first_name,whatsapp,bio,instagram_url,website_url,whatsapp_business,avatar_path";
const bucket = "service-portfolio";

export async function loadProfileSettings(userId: string): Promise<ProfileSettings> {
  if (Platform.OS === "web") return webApi<ProfileSettings>("profileSettings");
  const result = await supabase.from("profiles").select(`${columns},birth_date`).eq("id", userId).single();
  if (result.error?.code === "42703") {
    const legacy = await supabase.from("profiles").select(columns).eq("id", userId).single();
    if (legacy.error) throw legacy.error;
    return legacy.data;
  }
  if (result.error) throw result.error;
  return result.data;
}

export async function loadProfessionalCard(provider: string): Promise<PublicProfessionalProfile | null> {
  uuid(provider);
  if (Platform.OS === "web") return webApi<PublicProfessionalProfile | null>("professionalCard", { provider });
  const { data, error } = await supabase.rpc("professional_card", { provider });
  if (error) throw error;
  return data;
}

export async function saveProfileSettings(userId: string, draft: ProfileSettings, photo?: { id: string; data: string }) {
  const { birth_date, ...fields } = draft;
  const update = profileSettings({ ...fields, avatar_path: photo ? userId + "/avatar-" + photo.id + ".jpg" : draft.avatar_path });
  if (update.services.some(findForbiddenService)) throw new Error("Escolha tipos de serviço permitidos.");
  if (Platform.OS === "web") {
    if (photo) await webApi("uploadProfileAvatar", { id: photo.id, image: photo.data });
    await webApi("saveProfileSettings", update);
  } else {
    if (photo && update.avatar_path) {
      const bytes = new Uint8Array(toByteArray(photo.data));
      const { error } = await supabase.storage.from(bucket).upload(update.avatar_path, bytes.buffer, { contentType: "image/jpeg" });
      if (error && error.status !== 409 && error.statusCode !== "Duplicate") throw error;
    }
    const previous = await supabase.from("profiles").select("avatar_path").eq("id", userId).single();
    if (previous.error) throw previous.error;
    const { whatsapp: _phone, ...editable } = update;
    const { error } = await supabase.from("profiles").update(editable).eq("id", userId).select("id").single();
    if (error) throw error;
    if (previous.data.avatar_path && previous.data.avatar_path !== update.avatar_path) {
      await supabase.storage.from(bucket).remove([previous.data.avatar_path]);
    }
  }
  return { ...update, birth_date };
}
