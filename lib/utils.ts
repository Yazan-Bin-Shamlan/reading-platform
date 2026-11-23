export { cn } from "cn"

/** Names joined with the comma of their script: "، " for Arabic, ", " otherwise. */
export const joinNames = (names: string[]) => names.join(names.some((n) => /[\u0600-\u06FF]/.test(n)) ? "، " : ", ");
