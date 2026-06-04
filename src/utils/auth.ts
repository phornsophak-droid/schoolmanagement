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
};
