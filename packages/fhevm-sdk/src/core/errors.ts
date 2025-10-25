export class FhevmError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FhevmError";
  }
}

export class FhevmAbortError extends FhevmError {
  constructor(message = "FHEVM operation was cancelled") {
    super(message);
    this.name = "FhevmAbortError";
  }
}
