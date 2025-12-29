// Validierungsregeln für das Formular

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

// Nur Buchstaben, Leerzeichen, Bindestriche und Umlaute
export const validateName = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  const regex = /^[a-zA-ZäöüÄÖÜßéèêëàâáåãæçíìîïñóòôõøúùûýÿžšđ\s\-']+$/;
  if (!regex.test(value)) {
    return { isValid: false, message: 'Nur Buchstaben, Leerzeichen und Bindestriche erlaubt' };
  }
  if (value.length < 2) {
    return { isValid: false, message: 'Mindestens 2 Zeichen erforderlich' };
  }
  if (value.length > 50) {
    return { isValid: false, message: 'Maximal 50 Zeichen erlaubt' };
  }
  return { isValid: true };
};

// Ort-Validierung (ähnlich wie Name, aber auch Zahlen erlaubt für Postleitzahl)
export const validateOrt = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  const regex = /^[a-zA-ZäöüÄÖÜßéèêëàâáåãæçíìîïñóòôõøúùûýÿžšđ0-9\s\-\.\/']+$/;
  if (!regex.test(value)) {
    return { isValid: false, message: 'Ungültige Zeichen enthalten' };
  }
  if (value.length < 2) {
    return { isValid: false, message: 'Mindestens 2 Zeichen erforderlich' };
  }
  if (value.length > 100) {
    return { isValid: false, message: 'Maximal 100 Zeichen erlaubt' };
  }
  return { isValid: true };
};

// Staatsangehörigkeit
export const validateStaatsangehoerigkeit = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  const regex = /^[a-zA-ZäöüÄÖÜß\s\-]+$/;
  if (!regex.test(value)) {
    return { isValid: false, message: 'Nur Buchstaben erlaubt' };
  }
  return { isValid: true };
};

// KV-Nummer: Buchstabe + 9 Ziffern oder flexibles Format
export const validateKvNummer = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  // Entferne Leerzeichen für die Validierung
  const cleanValue = value.replace(/\s/g, '');
  // Mindestens 8 Zeichen, alphanumerisch
  const regex = /^[A-Za-z0-9]{8,15}$/;
  if (!regex.test(cleanValue)) {
    return { isValid: false, message: 'KV-Nummer: 8-15 alphanumerische Zeichen' };
  }
  return { isValid: true };
};

// Versichertennummer: 10 Zeichen, Buchstabe + 9 Ziffern
export const validateVersichertennummer = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  const cleanValue = value.replace(/\s/g, '');
  // Typisches Format: Buchstabe + 9 Ziffern
  const regex = /^[A-Za-z][0-9]{9}$/;
  if (!regex.test(cleanValue)) {
    return { isValid: false, message: 'Format: 1 Buchstabe + 9 Ziffern (z.B. A123456789)' };
  }
  return { isValid: true };
};

// Krankenkasse
export const validateKrankenkasse = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  const regex = /^[a-zA-ZäöüÄÖÜß0-9\s\-\.]+$/;
  if (!regex.test(value)) {
    return { isValid: false, message: 'Ungültige Zeichen enthalten' };
  }
  if (value.length < 2) {
    return { isValid: false, message: 'Mindestens 2 Zeichen erforderlich' };
  }
  return { isValid: true };
};

// IBAN-Validierung (deutsches Format)
export const validateIBAN = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  // Entferne Leerzeichen für die Validierung
  const cleanValue = value.replace(/\s/g, '').toUpperCase();
  // Deutsches IBAN Format: DE + 2 Prüfziffern + 18 Ziffern = 22 Zeichen
  const regex = /^DE[0-9]{20}$/;
  if (!regex.test(cleanValue)) {
    return { isValid: false, message: 'Ungültige IBAN (Format: DE + 20 Ziffern)' };
  }
  return { isValid: true };
};

// Jahresbeitrag (mindestens 300 €)
export const validateJahresbeitrag = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  // Entferne Währungssymbole, Leerzeichen und ersetze Komma durch Punkt
  const cleanValue = value.replace(/[€\s]/g, '').replace(',', '.');
  const amount = parseFloat(cleanValue);
  if (isNaN(amount)) {
    return { isValid: false, message: 'Bitte geben Sie eine gültige Zahl ein' };
  }
  if (amount < 300) {
    return { isValid: false, message: 'Mindestens 300 € erforderlich' };
  }
  if (amount > 100000) {
    return { isValid: false, message: 'Maximal 100.000 € erlaubt' };
  }
  return { isValid: true };
};

// Datum-Validierung
export const validateDate = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  // Prüfe ob gültiges Datum
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { isValid: false, message: 'Ungültiges Datum' };
  }
  return { isValid: true };
};

// Geburtsdatum-Validierung (nicht in der Zukunft, nicht älter als 120 Jahre)
export const validateGeburtsdatum = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { isValid: false, message: 'Ungültiges Datum' };
  }
  const today = new Date();
  if (date > today) {
    return { isValid: false, message: 'Geburtsdatum darf nicht in der Zukunft liegen' };
  }
  const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  if (date < minDate) {
    return { isValid: false, message: 'Ungültiges Geburtsdatum' };
  }
  return { isValid: true };
};

// Telefon-Validierung (optional)
export const validateTelefon = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: true }; // Optional
  }
  // Erlaubt: +, Zahlen, Leerzeichen, Bindestriche, Klammern
  const regex = /^[\+0-9\s\-\(\)\/]+$/;
  if (!regex.test(value)) {
    return { isValid: false, message: 'Ungültiges Telefonnummer-Format' };
  }
  // Mindestens 6 Ziffern
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length < 6) {
    return { isValid: false, message: 'Mindestens 6 Ziffern erforderlich' };
  }
  if (digitsOnly.length > 20) {
    return { isValid: false, message: 'Maximal 20 Ziffern erlaubt' };
  }
  return { isValid: true };
};

// E-Mail-Validierung (optional)
export const validateEmail = (value: string): ValidationResult => {
  if (!value.trim()) {
    return { isValid: true }; // Optional
  }
  const regex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!regex.test(value)) {
    return { isValid: false, message: 'Ungültiges E-Mail-Format' };
  }
  return { isValid: true };
};

// Select-Validierung
export const validateSelect = (value: string): ValidationResult => {
  if (!value || !value.trim()) {
    return { isValid: false, message: 'Bitte wählen Sie eine Option' };
  }
  return { isValid: true };
};

// Allgemeine Pflichtfeld-Validierung
export const validateRequired = (value: string): ValidationResult => {
  if (!value || !value.trim()) {
    return { isValid: false, message: 'Dieses Feld ist erforderlich' };
  }
  return { isValid: true };
};
