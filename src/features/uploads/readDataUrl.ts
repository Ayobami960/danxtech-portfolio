/**
 * Read a File as a base64 data URL for the JSON document endpoint. FileReader
 * is used instead of btoa(ArrayBuffer) so large PDFs do not blow the call stack
 * and the MIME type is carried in the data URL prefix.
 */
export const readDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read the file."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
