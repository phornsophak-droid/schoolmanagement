import { syncUpsertSetting } from '../lib/supabase';

export const getPinForUser = (userId: string, role: string): string => {
  const customPinsStr = localStorage.getItem('school_custom_pins');
  if (customPinsStr) {
    const customPins = JSON.parse(customPinsStr);
    if (customPins[userId]) return customPins[userId];
  }
  return role === 'principal' ? '1111' : '1234';
};

export const setPinForUser = (userId: string, newPin: string) => {
  const customPinsStr = localStorage.getItem('school_custom_pins');
  const customPins = customPinsStr ? JSON.parse(customPinsStr) : {};
  customPins[userId] = newPin;
  localStorage.setItem('school_custom_pins', JSON.stringify(customPins));
  syncUpsertSetting('school_custom_pins', customPins).catch(console.error);
};

// Emergency PIN for the principal — a self-set break-glass code so the principal
// can still get in if they forget their account password or the internet is down
// (their normal PIN is disabled once migrated). Kept in localStorage so it works
// offline, and synced so it can be restored on another device.
export const EMERGENCY_PIN_KEY = 'school_principal_emergency_pin';

export const getEmergencyPin = (): string => {
  try { return localStorage.getItem(EMERGENCY_PIN_KEY) || ''; } catch { return ''; }
};

export const setEmergencyPin = (pin: string) => {
  const v = (pin || '').trim();
  if (v) localStorage.setItem(EMERGENCY_PIN_KEY, v);
  else localStorage.removeItem(EMERGENCY_PIN_KEY);
  syncUpsertSetting(EMERGENCY_PIN_KEY, v).catch(console.error);
};
