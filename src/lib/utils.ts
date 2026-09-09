import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte uma string de camelCase para snake_case.
 */
const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

/**
 * Converte as chaves de um objeto de camelCase para snake_case (recursivo).
 */
export function keysToSnakeCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== 'object' || obj instanceof Date || (typeof File !== 'undefined' && obj instanceof File)) return obj;
  if (Array.isArray(obj)) return obj.map(item => keysToSnakeCase(item));
  const newObj: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = toSnakeCase(key);
      const value = (obj as any)[key];
      newObj[newKey] = (typeof value === 'object' && value !== null && !(value instanceof Date) && !(typeof File !== 'undefined' && value instanceof File))
        ? keysToSnakeCase(value)
        : value;
    }
  }
  return newObj;
}

/**
 * Converte uma string de snake_case para camelCase.
 */
const toCamelCase = (str: string): string => {
  return str.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
};

/**
 * Converte as chaves de um objeto de snake_case para camelCase (recursivo).
 */
export function keysToCamelCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => keysToCamelCase(item));
  const newObj: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = toCamelCase(key);
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        newObj[newKey] = keysToCamelCase(value);
      } else {
        newObj[newKey] = value;
      }
    }
  }
  return newObj;
}

/**
 * Cria um objeto Date no fuso horário local a partir de uma string ISO (YYYY-MM-DD).
 */
export function createLocalDateFromISO(isoDateString: string): Date {
    const parts = isoDateString.split('-').map(p => parseInt(p, 10));
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Normaliza uma string para agrupamento (remove acentos, espaços extras e converte para minúsculas).
 * Ex: "Farmácia " -> "farmacia"
 */
export function normalizeForGrouping(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/**
 * Formata uma string para exibição (Primeira letra maiúscula).
 */
export function capitalize(str: string): string {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Trunca uma string para um tamanho máximo e adiciona reticências.
 */
export function truncate(str: string, length: number): string {
    if (!str) return "";
    return str.length > length ? str.substring(0, length) + "..." : str;
}