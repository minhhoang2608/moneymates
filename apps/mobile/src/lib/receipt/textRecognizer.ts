/** On-device OCR: image uri in, recognised text lines out (top to bottom). */
export type TextRecognizer = { recognize(uri: string): Promise<string[]> };
