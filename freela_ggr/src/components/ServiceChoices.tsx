import { useState } from "react";
import { Text, View } from "react-native";
import { SERVICE_OPTIONS, findForbiddenService } from "../data/serviceOptions";
import { normalize } from "../utils/searchTools";
import { useAppearance } from "../ui/Appearance";
import { Button, Field } from "../ui/components";

export function ServiceChoices({ values, onChange, single = false, extra = [], disabled = false }: {
  values: string[];
  onChange: (values: string[]) => void;
  single?: boolean;
  extra?: string[];
  disabled?: boolean;
}) {
  const { ui } = useAppearance();
  const [query, setQuery] = useState("");
  const term = normalize(query);
  const options = [...new Set([...extra, ...SERVICE_OPTIONS])];
  const matches = term ? options.filter((option) => normalize(option).includes(term)).slice(0, 6) : [];
  const custom = query.trim();
  const canAdd = (single || values.length < 30) && custom.length >= 3 && !findForbiddenService(custom) &&
    !options.some((option) => normalize(option) === term) && !values.some((value) => normalize(value) === term);

  function add(option: string) {
    onChange(single ? [option] : [...values, option]);
    setQuery("");
  }

  return <View style={{ gap: 8 }}>
    {single && values.length > 0 && <Text style={ui.label}>Categoria do anúncio</Text>}
    <Field label={single ? "Buscar categoria" : "Buscar tipos de serviço"} value={query} onChangeText={setQuery}
      editable={!disabled} maxLength={100} placeholder="Ex.: design, limpeza ou elétrica" />
    {values.map((value) => <Button key={value} title={single ? `Remover categoria ${value}` : `${value} · remover`} secondary disabled={disabled}
      onPress={() => onChange(values.filter((item) => item !== value))} />)}
    {matches.filter((option) => !values.includes(option)).map((option) => <Button key={option} title={option} secondary
      disabled={disabled || (!single && values.length >= 30)} onPress={() => add(option)} />)}
    {canAdd && <Button title={`Criar categoria “${custom}”`} secondary disabled={disabled} onPress={() => add(custom)} />}
    {!!term && findForbiddenService(custom) && <Text style={ui.small}>Escolha uma categoria permitida.</Text>}
  </View>;
}
