import { NextResponse } from 'next/server'

interface ApiResponseMeta {
  total?: number
  page?: number
  limit?: number
}

export function apiSuccess<T>(data: T, meta?: ApiResponseMeta, status = 200) {
  const body: { success: true; data: T; meta?: ApiResponseMeta } = { success: true, data }
  if (meta) {
    body.meta = meta
  }
  return NextResponse.json(body, { status })
}

export function apiError(error: string, status = 400, details?: unknown) {
  const body: { success: false; error: string; details?: unknown } = { success: false, error }
  if (details !== undefined) {
    body.details = details
  }
  return NextResponse.json(body, { status })
}
