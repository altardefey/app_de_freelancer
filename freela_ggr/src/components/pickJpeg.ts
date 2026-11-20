import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { PHOTO_MAX_BASE64_LENGTH } from "../data/photoLimits";

export async function pickJpeg(): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], allowsMultipleSelection: false, exif: false,
  });
  if (result.canceled) return;
  const asset = result.assets[0];
  const web = Platform.OS === "web";
  const browserUri = web && asset.file ? URL.createObjectURL(asset.file) : undefined;
  try {
    if (asset.width < 1 || asset.height < 1 || asset.width * asset.height > 32_000_000) throw new Error();
    const uri = browserUri ?? asset.uri;
    if (web && !/^(blob:|data:image\/)/i.test(uri)) {
      throw new Error("Selecione a foto pelo seletor de arquivos.");
    }

    const context = ImageManipulator.manipulate(uri);
    if (Math.max(asset.width, asset.height) > 1600) {
      context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
    }
    const rendered = await context.renderAsync();
    for (const compress of [0.82, 0.65, 0.48]) {
      const jpeg = await rendered.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
      if (web && jpeg.uri.startsWith("blob:")) URL.revokeObjectURL(jpeg.uri);
      if (jpeg.base64 && jpeg.base64.length <= PHOTO_MAX_BASE64_LENGTH) return jpeg.base64;
    }
    throw new Error("A foto ultrapassa 2 MB mesmo após a compressão.");
  } finally {
    if (browserUri) URL.revokeObjectURL(browserUri);
    if (web && asset.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
  }
}
