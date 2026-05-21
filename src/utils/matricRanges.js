const MATRIC_RANGES = {
  '100': { min: 258411, max: 259091 },
  '200': { min: 244043, max: 251166 },
  '300': { min: 244018, max: 244080 },
  '400': { min: 236849, max: 236898 },
  '500': { min: 231518, max: 231580 },
};

function isMatricInRange(matricNumber, level) {
  const range = MATRIC_RANGES[String(level)];
  if (!range) return false;
  const trimmed = String(matricNumber).trim();
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || String(num) !== trimmed) return false;
  return num >= range.min && num <= range.max;
}

module.exports = { MATRIC_RANGES, isMatricInRange };
