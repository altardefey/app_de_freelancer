import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';

export default function NovoOrcamentoScreen() {
  const [cliente, setCliente] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [servico, setServico] = useState('');
  const [valor, setValor] = useState('');

  const handleGerarPDF = () => {
    if (!cliente || !valor) {
      Alert.alert('Atenção', 'Preencha ao menos o nome do cliente e o valor.');
      return;
    }
    Alert.alert('Sucesso!', `Orçamento para ${cliente} criado com sucesso!`);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.titulo}>Dados do Cliente</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Nome do Cliente" 
        value={cliente}
        onChangeText={setCliente}
      />
      <TextInput 
        style={styles.input} 
        placeholder="WhatsApp (ex: 11999999999)" 
        keyboardType="phone-pad"
        value={whatsapp}
        onChangeText={setWhatsapp}
      />

      <Text style={styles.titulo}>Detalhes do Serviço/Produto</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Descrição do Serviço ou Produto" 
        value={servico}
        onChangeText={setServico}
      />
      <TextInput 
        style={styles.input} 
        placeholder="Valor Total (R$)" 
        keyboardType="numeric"
        value={valor}
        onChangeText={setValor}
      />

      <TouchableOpacity style={styles.botaoGerar} onPress={handleGerarPDF}>
        <Text style={styles.textoBotao}>Gerar e Enviar via WhatsApp</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 20 },
  titulo: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 10, color: '#333' },
  input: { backgroundColor: '#F0F2F5', padding: 14, borderRadius: 8, marginBottom: 12, fontSize: 15 },
  botaoGerar: { backgroundColor: '#128C7E', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  textoBotao: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});