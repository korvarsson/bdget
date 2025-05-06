import CryptoJS from 'crypto-js';

// IMPORTANT: In a real-world scenario, this secret should be more robustly managed,
// potentially derived from a user password or stored more securely.
// For this local-run app, we'll use a simple, hardcoded secret.
const SECRET_KEY = 'your-super-secret-key-for-local-budget-app'; // Replace with a more complex key if desired

export const encryptData = (data: string): string => {
  try {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  } catch (error) {
    console.error("Encryption failed:", error);
    return ''; // Return empty string or handle error appropriately
  }
};

export const decryptData = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  } catch (error) {
    console.error("Decryption failed:", error);
    // Handle cases where decryption might fail (e.g., wrong key, corrupted data)
    return ''; // Return empty string or handle error appropriately
  }
};

// Helper functions for localStorage with encryption

export const saveEncryptedToLocalStorage = (key: string, value: string) => {
  if (typeof window !== 'undefined' && value) {
    const encryptedValue = encryptData(value);
    if (encryptedValue) {
      localStorage.setItem(key, encryptedValue);
    }
  }
};

export const loadDecryptedFromLocalStorage = (key: string): string => {
  if (typeof window !== 'undefined') {
    const encryptedValue = localStorage.getItem(key);
    if (encryptedValue) {
      return decryptData(encryptedValue);
    }
  }
  return '';
};

export const saveToLocalStorage = (key: string, value: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

export const loadFromLocalStorage = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

