export class HassError extends Error {
  override name = "HassError";
}

export class AuthStoreError extends HassError {
  override name = "AuthStoreError";
}

export class HttpError extends HassError {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}
