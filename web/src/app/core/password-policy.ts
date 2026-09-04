/**
 * Politica de contrasenas del sistema.
 *
 * Refleja exactamente las reglas que valida el backend en
 * `backend/app/security.py` (PASSWORD_RULES). El backend tambien las expone en
 * `GET /api/auth/password-policy`; si cambian alli, hay que actualizar esta lista.
 */

export interface PasswordRule {
  codigo: string;
  descripcion: string;
  patron: RegExp;
}

/** Longitud minima exigida a una contrasena nueva. */
export const PASSWORD_MIN_LENGTH = 12;

/** Intentos fallidos consecutivos antes de que el backend bloquee la cuenta. */
export const MAX_INTENTOS_LOGIN = 3;

export const PASSWORD_RULES: PasswordRule[] = [
  {
    codigo: 'longitud',
    descripcion: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    patron: new RegExp(`.{${PASSWORD_MIN_LENGTH},}`),
  },
  { codigo: 'minuscula', descripcion: 'Al menos una letra minúscula (a-z)', patron: /[a-z]/ },
  { codigo: 'mayuscula', descripcion: 'Al menos una letra mayúscula (A-Z)', patron: /[A-Z]/ },
  { codigo: 'numero', descripcion: 'Al menos un número (0-9)', patron: /\d/ },
  { codigo: 'especial', descripcion: 'Al menos un carácter especial (!, @, #, $…)', patron: /[^A-Za-z0-9]/ },
];

export function reglasCumplidas(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter(r => r.patron.test(password));
}

export function reglasFaltantes(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter(r => !r.patron.test(password));
}

export function esPasswordValida(password: string): boolean {
  return reglasFaltantes(password).length === 0;
}

/** Fuerza aproximada entre 0 y 1, segun cuantas reglas se cumplen. */
export function fuerzaPassword(password: string): number {
  if (!password) return 0;
  return reglasCumplidas(password).length / PASSWORD_RULES.length;
}

export function etiquetaFuerza(password: string): string {
  const f = fuerzaPassword(password);
  if (f < 0.4) return 'Débil';
  if (f < 0.8) return 'Media';
  if (f < 1) return 'Buena';
  return 'Fuerte';
}
