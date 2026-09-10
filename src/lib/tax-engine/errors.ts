/**
 * Thrown when a required tax configuration is missing or invalid.
 * These errors surface as user-friendly messages in the mass calculation UI.
 */
export class TaxConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxConfigurationError";
  }
}
