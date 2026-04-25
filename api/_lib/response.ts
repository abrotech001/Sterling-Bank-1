import { VercelResponse } from "@vercel/node";

export function success(res: VercelResponse, data: any, statusCode: number = 200) {
  res.status(statusCode).json(data);
}

export function error(res: VercelResponse, message: string, statusCode: number = 400) {
  res.status(statusCode).json({ error: message });
}

export function created(res: VercelResponse, data: any) {
  res.status(201).json(data);
}

export function notFound(res: VercelResponse, message: string = "Resource not found") {
  res.status(404).json({ error: message });
}

export function unauthorized(res: VercelResponse, message: string = "Unauthorized") {
  res.status(401).json({ error: message });
}

export function conflict(res: VercelResponse, message: string = "Conflict") {
  res.status(409).json({ error: message });
}

export function badRequest(res: VercelResponse, message: string = "Bad request") {
  res.status(400).json({ error: message });
}

export function serverError(res: VercelResponse, message: string = "Internal server error") {
  res.status(500).json({ error: message });
}
