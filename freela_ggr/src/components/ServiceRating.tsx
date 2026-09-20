import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "../screens/HomeScreen.styles";

export function ServiceRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number) => void;
}) {
  return (
    <View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={6}>
            <Ionicons
              name={value && star <= value ? "star" : "star-outline"}
              size={22}
              color={value && star <= value ? "#FACC15" : "#52525B"}
            />
          </Pressable>
        ))}
      </View>
      <Text style={styles.ratingHint}>
        {value ? `Você avaliou com ${value} estrela${value > 1 ? "s" : ""}.` : "Avalie este serviço concluído."}
      </Text>
    </View>
  );
}
