export const validateTestMarks = (maximum: number, obtained: number): void => {
  if (!Number.isFinite(maximum) || maximum <= 0 ||
      !Number.isFinite(obtained) || obtained < 0 || obtained > maximum) {
    throw new Error('Marks must be between zero and the maximum, and maximum marks must be greater than zero.');
  }
};
