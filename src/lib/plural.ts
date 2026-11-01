/** Czech plural: 1 kartička, 2–4 kartičky, 0 or 5+ kartiček. */
export const plural = (n: number, one: string, few: string, many: string) =>
  `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`
export const cardsWord = (n: number) => plural(n, 'kartička', 'kartičky', 'kartiček')
