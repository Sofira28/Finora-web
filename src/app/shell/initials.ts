/** Iniciales del nombre (máximo dos), en mayúscula. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]]
  return letters
    .map((word) => (word ? Array.from(word)[0] : ''))
    .join('')
    .toLocaleUpperCase('es-CO')
}
