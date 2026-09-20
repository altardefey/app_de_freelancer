import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Logo } from "../components/Logo";
import { createBudget } from "../data/remote";
import type { Budget } from "../types/app";
import { styles } from "./HomeScreen.styles";

function formatCurrency(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function NovoOrcamento({
  onBack,
  onCreate,
}: {
  onBack: () => void;
  onCreate: (budget: Budget) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [servico, setServico] = useState("");
  const [valor, setValor] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(sendWhatsapp: boolean) {
    if (!cliente.trim() || !servico.trim() || !valor.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha cliente, serviço e valor.");
      return;
    }

    setSaving(true);
    const budget = await createBudget({
      client: cliente.trim(),
      service: servico.trim(),
      value: valor,
      whatsapp: whatsapp.replace(/\D/g, "") || undefined,
    });

    if (sendWhatsapp) {
      const digits = whatsapp.replace(/\D/g, "");
      if (digits.length < 10) {
        Alert.alert(
          "Orçamento salvo",
          "Informe um WhatsApp válido para enviar a mensagem.",
        );
      } else {
        const message = encodeURIComponent(
          `Olá, ${cliente.trim()}! Segue o orçamento de ${servico.trim()}: ${valor}.${
            detalhes.trim() ? `\n\n${detalhes.trim()}` : ""
          }`,
        );
        Linking.openURL(`https://wa.me/55${digits}?text=${message}`);
      }
    }

    onCreate(budget);
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Logo />
        <Pressable style={styles.logoutButton} hitSlop={12} onPress={onBack}>
          <Feather name="arrow-left" size={15} color="#71717A" />
          <Text style={styles.logout}>Voltar</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.overlineGreen}>NOVO ORÇAMENTO</Text>
        <Text style={styles.pageTitle}>Monte a proposta.</Text>
        <Text style={styles.pageSubtitle}>
          Preencha os dados do cliente. O envio fica pronto para o WhatsApp.
        </Text>

        <Text style={styles.formSectionTitle}>Cliente</Text>
        <Text style={styles.label}>Nome</Text>
        <TextInput
          value={cliente}
          onChangeText={setCliente}
          placeholder="Nome do cliente"
          placeholderTextColor="#71717A"
          style={styles.input}
        />
        <Text style={styles.label}>WhatsApp</Text>
        <TextInput
          value={whatsapp}
          onChangeText={(value) => setWhatsapp(formatWhatsapp(value))}
          placeholder="(11) 99999-9999"
          placeholderTextColor="#71717A"
          keyboardType="phone-pad"
          style={styles.input}
        />

        <Text style={styles.formSectionTitle}>Serviço</Text>
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          value={servico}
          onChangeText={setServico}
          placeholder="Ex.: Pintura residencial"
          placeholderTextColor="#71717A"
          style={styles.input}
        />
        <Text style={styles.label}>Valor</Text>
        <TextInput
          value={valor}
          onChangeText={(value) => setValor(formatCurrency(value))}
          placeholder="R$ 0,00"
          placeholderTextColor="#71717A"
          keyboardType="numeric"
          style={styles.input}
        />
        <Text style={styles.label}>Observações</Text>
        <TextInput
          value={detalhes}
          onChangeText={setDetalhes}
          multiline
          placeholder="Escopo, prazo ou materiais"
          placeholderTextColor="#71717A"
          style={[styles.input, styles.messageInput]}
        />

        <Pressable
          style={[styles.greenButton, styles.formPrimaryButton]}
          disabled={saving}
          onPress={() => handleSave(false)}
        >
          <Text style={styles.greenButtonText}>
            {saving ? "Salvando..." : "Salvar orçamento"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.secondaryFormButton}
          disabled={saving}
          onPress={() => handleSave(true)}
        >
          <Feather name="message-circle" size={16} color="#FFFFFF" />
          <Text style={styles.secondaryFormButtonText}>Salvar e enviar no WhatsApp</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default NovoOrcamento;
