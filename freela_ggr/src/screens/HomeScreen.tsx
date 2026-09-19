import { useRouter } from 'expo-router'; // Importa o navegador em React
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter(); // Hook do React

  return (
    <ScrollView style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.saudacao}>Olá, Profissional! 👋</Text>
        <Text style={styles.subtitulo}>Acompanhe seus orçamentos do mês</Text>
      </View>

      {/* Cards Financeiros */}
      <View style={styles.cardsContainer}>
        <View style={[styles.card, { backgroundColor: '#E8F5E9' }]}>
          <Text style={styles.cardLabel}>Aprovados / Pagos</Text>
          <Text style={[styles.cardValor, { color: '#2E7D32' }]}>R$ 0,00</Text>
        </View>

        <View style={[styles.card, { backgroundColor: '#FFF3E0' }]}>
          <Text style={styles.cardLabel}>Pendentes</Text>
          <Text style={[styles.cardValor, { color: '#EF6C00' }]}>R$ 0,00</Text>
        </View>
      </View>

      {/* Botão Principal chamando a rota em React */}
      <TouchableOpacity 
        style={styles.botaoCriar}
        onPress={() => router.push('/novo-orcamento')}
      >
        <Text style={styles.textoBotao}>+ Criar Novo Orçamento</Text>
      </TouchableOpacity>

      {/* Histórico Vazio */}
      <View style={styles.secaoHistorico}>
        <Text style={styles.tituloSecao}>Orçamentos Recentes</Text>
        <View style={styles.emptyState}>
          <Text style={styles.textoEmpty}>Nenhum orçamento gerado ainda.</Text>
          <Text style={styles.subtextoEmpty}>Clique no botão acima para criar o primeiro em 30 segundos.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20 },
  header: { marginTop: 40, marginBottom: 20 },
  saudacao: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  subtitulo: { fontSize: 14, color: '#666', marginTop: 4 },
  cardsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { flex: 0.48, padding: 16, borderRadius: 12 },
  cardLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
  cardValor: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  botaoCriar: { backgroundColor: '#25D366', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  textoBotao: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  secaoHistorico: { marginBottom: 30 },
  tituloSecao: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 12 },
  emptyState: { backgroundColor: '#FFF', padding: 30, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CCC' },
  textoEmpty: { color: '#333', fontWeight: 'bold', marginBottom: 4 },
  subtextoEmpty: { color: '#888', fontSize: 12, textAlign: 'center' }
});