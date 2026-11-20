import { useState } from "react";
import { Modal, Text, View } from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import { minimumSignupAge } from "../security/validation";
import { useAppearance } from "../ui/Appearance";
import { Button, Field } from "../ui/components";

LocaleConfig.locales["pt-BR"] = {
  monthNames: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
  monthNamesShort: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  dayNames: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
};
LocaleConfig.defaultLocale = "pt-BR";

export function BirthDateField({ value, onChange, role, disabled }: {
  value: string; onChange: (date: string) => void; role: "cliente" | "profissional"; disabled?: boolean;
}) {
  const { colors, ui } = useAppearance();
  const [open, setOpen] = useState(false);
  const age = minimumSignupAge(role);
  const now = new Date().toISOString().slice(0, 10);
  const latest = String(Number(now.slice(0, 4)) - age) + now.slice(4);
  const current = /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && value <= latest
    && Number.isFinite(Date.parse(value)) ? value : latest;
  const display = value.split("-").reverse().join("/");

  return <View style={{ gap: 8 }}>
    <Field label="Data de nascimento" placeholder="DD/MM/AAAA" value={display} editable={!disabled}
      keyboardType="number-pad" maxLength={10} onChangeText={(input) => {
        const digits = input.replace(/\D/g, "").slice(0, 8);
        const pieces = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean);
        onChange(pieces.reverse().join("-"));
      }} />
    <Text style={ui.small}>Idade mínima para este perfil: {age} anos.</Text>
    <Button title="Escolher no calendário" icon="calendar" secondary disabled={disabled} onPress={() => setOpen(true)} />
    <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={ui.modal}>
        <View style={[ui.sheet, { padding: 16, gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>Data de nascimento</Text>
          <Calendar initialDate={current} minDate="1900-01-01" maxDate={latest} enableSwipeMonths
            markedDates={{ [current]: { selected: true, selectedColor: colors.purple, selectedTextColor: colors.white } }}
            theme={{ calendarBackground: colors.canvas, monthTextColor: colors.ink, dayTextColor: colors.ink, textDisabledColor: colors.muted, textSectionTitleColor: colors.muted, arrowColor: colors.purple }}
            onDayPress={({ dateString }) => { onChange(dateString); setOpen(false); }} />
          <Button title="Fechar calendário" secondary onPress={() => setOpen(false)} />
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}
