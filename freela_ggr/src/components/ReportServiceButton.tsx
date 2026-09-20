import { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { styles } from "../screens/HomeScreen.styles";

export function ReportServiceButton({
  serviceTitle,
}: {
  serviceTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <>
      <Pressable
        style={styles.reportButton}
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation?.();
          setOpen(true);
        }}
        accessibilityLabel="Denunciar serviço"
      >
        <Feather name="flag" size={16} color="#F87171" />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>DENUNCIAR</Text>
            <Text style={styles.modalTitle}>{serviceTitle}</Text>
            <Text style={styles.modalProvider}>Conte-nos o que aconteceu.</Text>
            <TextInput
              multiline
              value={message}
              onChangeText={setMessage}
              placeholder="Descreva o ocorrido"
              placeholderTextColor="#71717A"
              style={[styles.input, styles.messageInput]}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setOpen(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButtonSmall}
                onPress={() => {
                  if (!message.trim()) {
                    Alert.alert("Campo obrigatório", "Conte-nos o que aconteceu.");
                    return;
                  }
                  setOpen(false);
                  setMessage("");
                  Alert.alert("Denúncia enviada", "Vamos analisar o relato.");
                }}
              >
                <Text style={styles.primaryButtonText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
