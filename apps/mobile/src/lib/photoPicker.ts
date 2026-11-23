import * as ImagePicker from "expo-image-picker";

export interface PhotoPicker {
  /** Resolves to the picked image URI, or null on cancel or denied permission. */
  pick(): Promise<string | null>;
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
    return result.assets[0]?.uri ?? null;
  },
};
