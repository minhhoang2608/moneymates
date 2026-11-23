import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import { newId } from "@/db/ids";

export interface PhotoPicker {
  /** Resolves to a durable copy of the picked image, or null on cancel or denied permission. */
  pick(): Promise<string | null>;
}

function extensionOf(uri: string): string {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(uri.split("?")[0] ?? "");
  return match ? match[1]!.toLowerCase() : "jpg";
}

/** Copies a picker cache file into the app's document directory so it survives a restart. */
function persist(sourceUri: string): string {
  const dir = new Directory(Paths.document, "attachments");
  dir.create({ idempotent: true, intermediates: true });
  const target = new File(dir, `${newId()}.${extensionOf(sourceUri)}`);
  new File(sourceUri).copy(target);
  return target.uri;
}

export const photoPicker: PhotoPicker = {
  async pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled) return null;
    const uri = result.assets[0]?.uri;
    return uri ? persist(uri) : null;
  },
};
