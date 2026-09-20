import { StyleSheet } from "react-native";

export const locationStyles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  compactRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  field: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "#09090B",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldCompact: {
    flex: 1,
    minHeight: 44,
  },
  fieldDisabled: {
    opacity: 0.45,
  },
  fieldText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  placeholder: {
    color: "#71717A",
    fontWeight: "500",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#18181B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "78%",
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#27272A",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: "#09090B",
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },
  list: {
    marginTop: 12,
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
  },
  optionText: {
    color: "#FAFAFA",
    fontSize: 15,
    fontWeight: "600",
  },
  empty: {
    color: "#71717A",
    textAlign: "center",
    marginTop: 20,
  },
});
